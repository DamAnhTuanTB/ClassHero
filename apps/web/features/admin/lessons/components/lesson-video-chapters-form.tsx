"use client";

import { Check, Loader2, ListOrdered, Plus, Trash2, Wand2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  useForm as useHookForm,
  useFieldArray,
  useWatch as useHookFormWatch,
} from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { TextField } from "@/components/common/forms/text-field";
import {
  DEFAULT_CUSTOM_VIDEO_SETTINGS,
  type CustomVideoSettings,
} from "@/components/shared/custom-youtube-player";
import { updateAdminLessonVideoSettings } from "@/features/admin/courses/api/admin-lessons-api";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import {
  resolveVideoPlaybackOffsetTime,
  resolveVisibleVideoTimelineIndexes,
  type VideoPlaybackWindow,
} from "@/lib/video-player-time";
import { cn } from "@/lib/utils";

interface LessonVideoChaptersFormProps {
  lessonId: string;
  videoUrl: string | null | undefined;
  initialSettings: CustomVideoSettings | null | undefined;
  onPreviewSettingsChange?: (settings: CustomVideoSettings) => void;
  playbackWindow?: VideoPlaybackWindow | null;
}

const chapterSchema = z.object({
  sourceTime: z.number().nonnegative().optional(),
  sourceTimeString: z
    .string()
    .regex(
      /^(?:(?:\d+):)?([0-5]?\d):([0-5]?\d)$/,
      "Sai định dạng (VD: 01:30 hoặc 1:05:30)",
    )
    .min(1, "Vui lòng nhập"),
  title: z.string().min(1, "Tiêu đề không được để trống"),
});

const chaptersFormSchema = z.object({
  chapters: z.array(chapterSchema).min(1, "Cần ít nhất một mốc thời gian hợp lệ"),
});

const youtubeChaptersResponseSchema = z.object({
  chapters: z
    .array(
      z.object({
        time: z.number().nonnegative(),
        title: z.string(),
      }),
    )
    .optional(),
});

type ChaptersFormValues = z.infer<typeof chaptersFormSchema>;

const CHAPTER_PREVIEW_DEBOUNCE_MS = 180;

function parseChapterTimestamp(timeString: string) {
  const parts = timeString.split(":").map(Number);
  if (parts.length === 3) {
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  }
  if (parts.length === 2) {
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  }
  return parts[0] || 0;
}

function formatChapterTimestamp(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) {
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function getPlaybackStartTime(settings: CustomVideoSettings | null | undefined) {
  return settings?.isDisabled
    ? 0
    : (settings?.startTimeInSeconds ?? DEFAULT_CUSTOM_VIDEO_SETTINGS.startTimeInSeconds);
}

function resolveChapterSourceTime(chapter: ChaptersFormValues["chapters"][number]) {
  const parsedSourceTime = parseChapterTimestamp(chapter.sourceTimeString);
  if (
    chapter.sourceTime !== undefined &&
    chapter.sourceTimeString === formatChapterTimestamp(chapter.sourceTime)
  ) {
    return chapter.sourceTime;
  }

  return parsedSourceTime;
}

export function LessonVideoChaptersForm({
  lessonId,
  videoUrl,
  initialSettings,
  onPreviewSettingsChange,
  playbackWindow,
}: LessonVideoChaptersFormProps) {
  const queryClient = useQueryClient();
  const session = useAuthSessionStore((state) => state.session);
  const [isOpen, setIsOpen] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const playbackStartTime = getPlaybackStartTime(initialSettings);
  const playbackEndTime = playbackWindow?.endTimeInSeconds ?? Number.MAX_SAFE_INTEGER;

  const form = useHookForm<ChaptersFormValues>({
    resolver: zodResolver(chaptersFormSchema),
    mode: "onChange",
    defaultValues: {
      chapters: (initialSettings?.chapters || []).map((c) => ({
        sourceTime: c.time,
        sourceTimeString: formatChapterTimestamp(c.time),
        title: c.title,
      })),
    },
  });

  const {
    register,
    control,
    handleSubmit,
    formState: { isSubmitting, errors, isValid },
    setValue,
  } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "chapters",
  });

  const watchedChapters = useHookFormWatch({
    control,
    name: "chapters",
  });
  const playableChapterIndexes = useMemo(
    () =>
      new Set(
        resolveVisibleVideoTimelineIndexes(
          fields.map((field) => field.sourceTime),
          playbackStartTime,
          playbackEndTime,
        ),
      ),
    [fields, playbackEndTime, playbackStartTime],
  );
  const currentPlayableChapterIndexes = useMemo(
    () =>
      new Set(
        resolveVisibleVideoTimelineIndexes(
          (watchedChapters ?? []).map((chapter) =>
            chapterSchema.shape.sourceTimeString.safeParse(chapter.sourceTimeString)
              .success
              ? resolveChapterSourceTime(chapter)
              : undefined,
          ),
          playbackStartTime,
          playbackEndTime,
        ),
      ),
    [watchedChapters, playbackEndTime, playbackStartTime],
  );

  // Gửi callback để preview thay đổi realtime
  useEffect(() => {
    if (!onPreviewSettingsChange || !watchedChapters) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const parsedChapters = watchedChapters
        .map((c) => {
          return {
            title: c.title,
            time: resolveChapterSourceTime(c),
          };
        })
        .filter((c) => c.title !== "");

      onPreviewSettingsChange({
        ...DEFAULT_CUSTOM_VIDEO_SETTINGS,
        ...(initialSettings || {}),
        chapters: parsedChapters,
      });
    }, CHAPTER_PREVIEW_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [watchedChapters, initialSettings, onPreviewSettingsChange, playbackStartTime]);

  const updateMutation = useMutation({
    mutationFn: (newSettings: CustomVideoSettings) => {
      if (!session?.accessToken) throw new Error("Chưa đăng nhập");
      return updateAdminLessonVideoSettings(lessonId, newSettings, session.accessToken);
    },
    onSuccess: (updatedLesson) => {
      queryClient.setQueriesData({ queryKey: ["admin-lesson", lessonId] }, updatedLesson);
      void queryClient.invalidateQueries({ queryKey: ["admin-lesson", lessonId] });
      toast.success("Lưu mốc thời gian thành công");
      setIsOpen(false);
    },
    onError: (error: Error) => {
      toast.error(
        getUserFacingErrorMessage(
          error,
          "Chưa lưu được mốc thời gian. Vui lòng thử lại.",
        ),
      );
    },
  });

  const onSubmit = (values: ChaptersFormValues) => {
    const parsedChapters = values.chapters.map((c) => ({
      title: c.title,
      time: resolveChapterSourceTime(c),
    }));

    const fullSettings: CustomVideoSettings = {
      ...DEFAULT_CUSTOM_VIDEO_SETTINGS,
      ...(initialSettings || {}),
      chapters: parsedChapters,
    };
    updateMutation.mutate(fullSettings);
  };

  const extractYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2] && match[2].length === 11 ? match[2] : null;
  };

  const handleScrapeChapters = async () => {
    if (!videoUrl) {
      toast.error("Chưa có liên kết video YouTube");
      return;
    }
    const videoId = extractYoutubeId(videoUrl);
    if (!videoId) {
      toast.error("Liên kết video không hợp lệ");
      return;
    }

    setIsScraping(true);
    try {
      const res = await fetch(`/api/youtube/chapters?videoId=${videoId}`);
      if (!res.ok) throw new Error("Không thể lấy dữ liệu");
      const result = youtubeChaptersResponseSchema.safeParse(await res.json());
      if (!result.success) {
        throw new Error("Dữ liệu chapter từ YouTube không hợp lệ");
      }
      const chapters = result.data.chapters ?? [];

      if (chapters.length > 0) {
        const mappedChapters = chapters.map((c) => ({
          sourceTime: c.time,
          sourceTimeString: formatChapterTimestamp(c.time),
          title: c.title,
        }));
        setValue("chapters", mappedChapters, { shouldValidate: true, shouldDirty: true });
        toast.success(`Đã tự động lấy ${chapters.length} mốc thời gian`);
      } else {
        toast.warning("Video này không có mốc thời gian nào");
      }
    } catch {
      toast.error("Có lỗi xảy ra khi lấy dữ liệu tự động");
    } finally {
      setIsScraping(false);
    }
  };

  if (!isOpen) {
    return (
      <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] overflow-hidden mt-4">
        <button
          onClick={() => setIsOpen(true)}
          className="w-full flex items-center justify-between p-4 bg-[var(--theme-surface-sunken)] hover:bg-[var(--theme-border)] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--theme-primary)]/10 text-[var(--theme-primary)]">
              <ListOrdered className="w-4 h-4" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-[var(--theme-text-strong)]">
                Mốc thời gian Video
              </h3>
              <p className="text-xs text-[var(--theme-text-muted)] mt-0.5">
                {fields.length > 0
                  ? `Đã cấu hình ${fields.length} mốc thời gian`
                  : "Chưa cấu hình mốc thời gian nào"}
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-[var(--theme-primary)] bg-[var(--theme-primary)]/10 px-3 py-1.5 rounded-full">
            Thiết lập
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] overflow-hidden shadow-sm mt-4">
      <div className="flex items-center justify-between gap-4 p-4 bg-[var(--theme-surface-sunken)] border-b border-[var(--theme-border)]">
        <div className="font-bold text-[var(--theme-text-strong)] flex items-center gap-2">
          <ListOrdered className="w-4 h-4 text-[var(--theme-primary)]" />
          Quản lý Mốc Thời Gian
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="theme-button-neutral flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          aria-label="Đóng quản lý mốc thời gian"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-col gap-3 border-b border-[var(--theme-border)] bg-[var(--theme-surface)]/50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 text-sm text-[var(--theme-text-muted)]">
          Tạo các điểm neo trên thanh tiến trình để học viên dễ theo dõi.
        </p>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleScrapeChapters}
            disabled={isScraping}
            className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-blue-50 px-3 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20"
          >
            {isScraping ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
            Tự động lấy từ YouTube
          </button>
          <button
            type="submit"
            form="lesson-video-chapters-form"
            disabled={
              fields.length === 0 || !isValid || isSubmitting || updateMutation.isPending
            }
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--theme-primary)] px-5 text-sm font-semibold text-white shadow-sm transition-all enabled:hover:bg-[var(--theme-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)] focus:ring-offset-2 focus:ring-offset-[var(--theme-surface)] disabled:cursor-not-allowed disabled:opacity-50 dark:text-[var(--theme-primary-foreground)]"
          >
            {isSubmitting || updateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang lưu...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Lưu danh sách Chapters
              </>
            )}
          </button>
        </div>
      </div>

      <form
        id="lesson-video-chapters-form"
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4 p-4"
      >
        {fields.length === 0 ? (
          <div className="text-center py-8 bg-[var(--theme-surface-sunken)] rounded-lg border border-dashed border-[var(--theme-border)]">
            <ListOrdered className="w-8 h-8 text-[var(--theme-text-muted)]/50 mx-auto mb-2" />
            <p className="text-sm text-[var(--theme-text-muted)]">
              Chưa có mốc thời gian nào
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {fields.map((field, index) => {
              const isOutsidePlayback =
                field.sourceTime !== undefined && !playableChapterIndexes.has(index);
              const chapterValue = watchedChapters?.[index];
              const sourceTime = chapterValue
                ? chapterSchema.shape.sourceTimeString.safeParse(
                    chapterValue.sourceTimeString,
                  ).success
                  ? resolveChapterSourceTime(chapterValue)
                  : field.sourceTime
                : field.sourceTime;
              const isPlaybackTimeAvailable =
                sourceTime !== undefined && currentPlayableChapterIndexes.has(index);

              return (
                <div
                  key={field.id}
                  aria-disabled={isOutsidePlayback || undefined}
                  className={cn(
                    "relative flex items-start gap-3 rounded-lg border p-3",
                    isOutsidePlayback
                      ? "border-[var(--theme-border)] bg-[var(--theme-bg-hover)]/45 opacity-65"
                      : "border-[var(--theme-border)] bg-[var(--theme-surface-sunken)]",
                  )}
                >
                  <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-[7.5rem_7.5rem_minmax(0,1fr)]">
                    <div className="col-span-1">
                      <TextField
                        id={`chapters.${index}.playbackTime`}
                        type="text"
                        label="Thời gian"
                        value={
                          !isPlaybackTimeAvailable
                            ? "—"
                            : formatChapterTimestamp(
                                resolveVideoPlaybackOffsetTime(
                                  sourceTime,
                                  playbackStartTime,
                                ),
                              )
                        }
                        readOnly
                        disabled
                        icon={null}
                      />
                    </div>

                    <div className="col-span-1">
                      <TextField
                        id={`chapters.${index}.sourceTimeString`}
                        type="text"
                        label="Thời gian gốc"
                        placeholder="VD: 01:30"
                        readOnly={isOutsidePlayback}
                        aria-disabled={isOutsidePlayback || undefined}
                        tabIndex={isOutsidePlayback ? -1 : undefined}
                        error={errors.chapters?.[index]?.sourceTimeString}
                        icon={null}
                        {...register(`chapters.${index}.sourceTimeString`)}
                      />
                    </div>

                    <div className="col-span-1">
                      <TextField
                        id={`chapters.${index}.title`}
                        label="Tên phần"
                        placeholder="Ví dụ: Giới thiệu chung"
                        readOnly={isOutsidePlayback}
                        aria-disabled={isOutsidePlayback || undefined}
                        tabIndex={isOutsidePlayback ? -1 : undefined}
                        error={errors.chapters?.[index]?.title}
                        icon={null}
                        {...register(`chapters.${index}.title`)}
                      />
                      {isOutsidePlayback && (
                        <span className="mt-1.5 inline-flex rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface)] px-2 py-0.5 text-[0.7rem] font-bold text-[var(--theme-text-muted)]">
                          Ngoài đoạn phát
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(index)}
                    disabled={isOutsidePlayback}
                    className="mt-[34px] text-red-500/50 transition-colors enabled:hover:text-red-500 disabled:cursor-not-allowed disabled:text-[var(--theme-text-muted)]/40"
                    title="Xóa"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={() =>
            append({ sourceTime: undefined, sourceTimeString: "", title: "" })
          }
          className="w-full flex items-center justify-center gap-2 p-2.5 border-2 border-dashed border-[var(--theme-border)] rounded-lg text-sm font-semibold text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:border-[var(--theme-text-muted)] transition-colors mt-4"
        >
          <Plus className="w-4 h-4" />
          Thêm mốc thời gian mới
        </button>
      </form>
    </div>
  );
}
