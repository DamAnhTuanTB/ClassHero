"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Captions,
  Check,
  Download,
  Loader2,
  LocateFixed,
  LocateOff,
  Plus,
  Search,
  X,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  DEFAULT_CUSTOM_VIDEO_SETTINGS,
  type CustomVideoSettings,
  type VideoChapter,
} from "@/components/shared/custom-youtube-player";
import {
  type AdminVideoTranscriptDraft,
  fetchAdminLessonVideoTranscript,
  updateAdminLessonVideoSettings,
} from "@/features/admin/courses/api/admin-lessons-api";
import { TranscriptRefreshConfirmDialog } from "@/features/admin/lessons/components/transcript-refresh-confirm-dialog";
import { LessonVideoTranscriptRow } from "@/features/admin/lessons/components/lesson-video-transcript-row";
import {
  transcriptFormSchema,
  transcriptTimestampPattern,
  type TranscriptFormValues,
} from "@/features/admin/lessons/schemas/lesson-video-transcript-schema";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";
import { cn } from "@/lib/utils";

interface LessonVideoTranscriptPanelProps {
  lessonId: string;
  initialSettings: CustomVideoSettings | null | undefined;
  onPlayFromTime: (timeInSeconds: number) => boolean;
  subscribeToPlaybackTime: (listener: (timeInSeconds: number) => void) => () => void;
}

export function LessonVideoTranscriptPanel({
  lessonId,
  initialSettings,
  onPlayFromTime,
  subscribeToPlaybackTime,
}: LessonVideoTranscriptPanelProps) {
  const queryClient = useQueryClient();
  const accessToken = useAuthSessionStore((state) => state.session?.accessToken) ?? "";
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [draftLanguage, setDraftLanguage] = useState(
    initialSettings?.transcriptLanguage ?? "",
  );
  const [hasFetchedDraft, setHasFetchedDraft] = useState(false);
  const [isRefreshConfirmOpen, setIsRefreshConfirmOpen] = useState(false);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const [activeTranscriptIndex, setActiveTranscriptIndex] = useState<number | null>(null);
  const [transcriptSourceOffset, setTranscriptSourceOffset] = useState(
    getPlaybackStartOffset(initialSettings),
  );
  const [draftChapters, setDraftChapters] = useState<VideoChapter[]>(
    initialSettings?.chapters ?? [],
  );
  const [playbackWindow, setPlaybackWindow] = useState<Pick<
    AdminVideoTranscriptDraft,
    "playbackStartTime" | "playbackEndTime" | "videoDuration"
  > | null>(null);
  const [timelineRevision, setTimelineRevision] = useState(0);

  const form = useForm<TranscriptFormValues>({
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      segments: toTranscriptFormSegments(
        initialSettings?.transcript ?? [],
        getPlaybackStartOffset(initialSettings),
      ),
    },
  });
  const {
    control,
    formState: { isDirty, isSubmitting },
    handleSubmit,
    getValues,
    register,
    reset,
    setValue,
  } = form;
  const { append, fields, remove } = useFieldArray({
    control,
    name: "segments",
  });
  const watchedSegmentsRef = useRef(getValues("segments"));
  const currentPlaybackTimeRef = useRef(0);
  const activeTranscriptIndexRef = useRef<number | null>(null);
  const transcriptListRef = useRef<HTMLDivElement>(null);
  const transcriptRowRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    setDraftChapters(initialSettings?.chapters ?? []);
  }, [initialSettings?.chapters]);

  const syncActiveTranscript = useCallback((timeInSeconds: number) => {
    currentPlaybackTimeRef.current = timeInSeconds;
    const nextActiveIndex = findActiveTranscriptIndex(
      watchedSegmentsRef.current,
      timeInSeconds,
    );
    if (activeTranscriptIndexRef.current === nextActiveIndex) {
      return;
    }

    activeTranscriptIndexRef.current = nextActiveIndex;
    setActiveTranscriptIndex(nextActiveIndex);
  }, []);

  useEffect(() => {
    watchedSegmentsRef.current = getValues("segments");
    syncActiveTranscript(currentPlaybackTimeRef.current);
  }, [fields, getValues, syncActiveTranscript, timelineRevision]);

  useEffect(
    () => subscribeToPlaybackTime(syncActiveTranscript),
    [subscribeToPlaybackTime, syncActiveTranscript],
  );

  useEffect(() => {
    if (
      !isOpen ||
      !isAutoScrollEnabled ||
      searchQuery.trim() ||
      activeTranscriptIndex === null
    ) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const container = transcriptListRef.current;
      const activeRow = transcriptRowRefs.current[activeTranscriptIndex];
      if (!container || !activeRow) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const rowRect = activeRow.getBoundingClientRect();
      const rowTopInsideContainer = container.scrollTop + rowRect.top - containerRect.top;
      const centeredScrollTop =
        rowTopInsideContainer -
        Math.max(0, (container.clientHeight - activeRow.offsetHeight) / 2);

      container.scrollTo({
        behavior: "smooth",
        top: Math.max(0, centeredScrollTop),
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activeTranscriptIndex, isAutoScrollEnabled, isOpen, searchQuery]);

  const visibleRows = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase("vi");
    const currentSegments = getValues("segments");
    const filteredRows = fields
      .map((field, index) => ({
        field,
        index,
        value: currentSegments[index],
      }))
      .filter(({ value }) => {
        if (!normalizedQuery) {
          return true;
        }
        return (
          value?.text.toLocaleLowerCase("vi").includes(normalizedQuery) ||
          value?.timeString.includes(normalizedQuery)
        );
      });

    return filteredRows.map((row, visibleIndex) => {
      const chapter = getActiveTranscriptChapter(draftChapters, row.value);
      const previousRow = filteredRows[visibleIndex - 1];
      const previousChapter = previousRow
        ? getActiveTranscriptChapter(draftChapters, previousRow.value)
        : undefined;

      return {
        ...row,
        chapter,
        showChapterHeader:
          Boolean(chapter) &&
          (!previousChapter ||
            previousChapter.time !== chapter?.time ||
            previousChapter.title !== chapter?.title),
      };
    });
  }, [draftChapters, fields, getValues, searchQuery, timelineRevision]);

  const fetchMutation = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error("Phiên đăng nhập chưa sẵn sàng");
      }
      return fetchAdminLessonVideoTranscript(lessonId, accessToken);
    },
    onSuccess: (draft) => {
      reset({ segments: toTranscriptFormSegments(draft.segments) });
      setTranscriptSourceOffset(draft.playbackStartTime);
      setDraftLanguage(draft.language);
      setDraftChapters(draft.chapters);
      setHasFetchedDraft(true);
      setPlaybackWindow({
        playbackStartTime: draft.playbackStartTime,
        playbackEndTime: draft.playbackEndTime,
        videoDuration: draft.videoDuration,
      });
      setSearchQuery("");
      if (draft.segments.length === 0) {
        toast.warning("Không có đoạn transcript nào trong khoảng video đang phát");
      } else {
        toast.success(
          `Đã lấy ${draft.segments.length.toLocaleString("vi-VN")} đoạn transcript (${draft.languageLabel})`,
        );
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Không thể lấy transcript từ YouTube");
    },
  });

  const saveMutation = useMutation({
    mutationFn: (settings: CustomVideoSettings) => {
      if (!accessToken) {
        throw new Error("Phiên đăng nhập chưa sẵn sàng");
      }
      return updateAdminLessonVideoSettings(lessonId, settings, accessToken);
    },
    onSuccess: (_, settings) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-lesson", lessonId] });
      reset({
        segments: toTranscriptFormSegments(
          settings.transcript ?? [],
          transcriptSourceOffset,
        ),
      });
      setHasFetchedDraft(false);
      toast.success("Đã lưu bản chép lời video");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Không thể lưu bản chép lời");
    },
  });

  const handleFetchTranscript = () => {
    if (fields.length > 0) {
      setIsRefreshConfirmOpen(true);
      return;
    }
    fetchMutation.mutate();
  };

  const handleConfirmRefresh = () => {
    setIsRefreshConfirmOpen(false);
    fetchMutation.mutate();
  };

  const handlePlayFromTime = useCallback(
    (segment: TranscriptFormValues["segments"][number] | undefined) => {
      if (!segment || !transcriptTimestampPattern.test(segment.timeString)) {
        toast.warning("Hãy nhập mốc thời gian hợp lệ trước khi phát");
        return;
      }

      if (!onPlayFromTime(getTranscriptSegmentTime(segment))) {
        toast.warning("Trình phát chưa sẵn sàng, vui lòng thử lại");
      }
    },
    [onPlayFromTime],
  );

  const onSubmit = (values: TranscriptFormValues) => {
    const parsedValues = transcriptFormSchema.safeParse(values);
    if (!parsedValues.success) {
      toast.error(
        parsedValues.error.issues[0]?.message || "Dữ liệu transcript không hợp lệ",
      );
      return;
    }

    const transcript = parsedValues.data.segments
      .map((segment) => {
        const playbackTime = getTranscriptSegmentTime(segment);
        const sourceTime = roundTranscriptTime(playbackTime + transcriptSourceOffset);
        return {
          ...(segment.endTime !== undefined && segment.endTime >= playbackTime
            ? {
                endTime: roundTranscriptTime(segment.endTime + transcriptSourceOffset),
              }
            : {}),
          time: sourceTime,
          text: segment.text.trim(),
        };
      })
      .sort((first, second) => first.time - second.time);

    saveMutation.mutate({
      ...DEFAULT_CUSTOM_VIDEO_SETTINGS,
      ...(initialSettings ?? {}),
      transcriptLanguage: draftLanguage || undefined,
      transcript,
    });
  };

  if (!isOpen) {
    return (
      <div className="mt-4 overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)]">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex min-h-16 w-full items-center justify-between gap-3 bg-[var(--theme-surface-sunken)] p-4 text-left transition-colors hover:bg-[var(--theme-bg-hover)]"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--theme-primary)]/10 text-[var(--theme-primary)]">
              <Captions className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block font-bold text-[var(--theme-text-strong)]">
                Bản chép lời video
              </span>
              <span className="mt-0.5 block text-xs text-[var(--theme-text-muted)]">
                {fields.length > 0
                  ? `Đã lưu ${fields.length.toLocaleString("vi-VN")} đoạn`
                  : "Chưa có transcript"}
              </span>
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-[var(--theme-primary)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--theme-primary)]">
            Mở transcript
          </span>
        </button>
      </div>
    );
  }

  const isBusy = fetchMutation.isPending || saveMutation.isPending || isSubmitting;

  return (
    <>
      <section className="mt-4 overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] shadow-sm">
        <header className="flex items-center justify-between gap-4 border-b border-[var(--theme-border)] bg-[var(--theme-surface-sunken)] p-4">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 font-bold text-[var(--theme-text-strong)]">
              <Captions
                className="h-4 w-4 text-[var(--theme-primary)]"
                aria-hidden="true"
              />
              Bản chép lời video
            </h3>
            <p className="mt-1 text-xs text-[var(--theme-text-muted)]">
              Duyệt và chỉnh sửa trước khi lưu vào buổi học.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="theme-button-neutral flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            aria-label="Đóng bản chép lời"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="flex flex-col gap-3 border-b border-[var(--theme-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--theme-text-strong)]">
              {fields.length > 0
                ? `${fields.length.toLocaleString("vi-VN")} đoạn theo trình tự thời gian`
                : "Chưa có dữ liệu transcript"}
              {(isDirty || hasFetchedDraft) && fields.length > 0 && (
                <span className="ml-2 rounded-full bg-[var(--theme-warning-bg)] px-2 py-0.5 text-[0.7rem] font-bold text-[var(--theme-warning-text)]">
                  Chưa lưu
                </span>
              )}
            </p>
            <p className="mt-1 text-xs text-[var(--theme-text-muted)]">
              {draftLanguage
                ? `Ngôn ngữ: ${draftLanguage}`
                : "Ưu tiên tiếng Việt nếu YouTube cung cấp."}
            </p>
            {playbackWindow && (
              <>
                <p className="mt-1 text-xs font-medium text-[var(--theme-primary)]">
                  Đã lọc theo khoảng phát{" "}
                  {formatTranscriptTimestamp(playbackWindow.playbackStartTime)}–
                  {formatTranscriptTimestamp(playbackWindow.playbackEndTime)}
                  {playbackWindow.playbackEndTime < playbackWindow.videoDuration
                    ? " của video gốc"
                    : ""}
                </p>
                <p className="mt-1 text-xs text-[var(--theme-text-muted)]">
                  Mốc transcript tính từ 0:00 của phần video sau khi cắt.
                </p>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={handleFetchTranscript}
            disabled={isBusy || !accessToken}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[var(--theme-primary)] px-4 text-sm font-semibold text-white transition enabled:hover:bg-[var(--theme-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {fetchMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            {fields.length > 0 ? "Lấy lại từ YouTube" : "Lấy transcript từ YouTube"}
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          {fields.length > 0 && (
            <div className="border-b border-[var(--theme-border)] p-4">
              <label className="relative block">
                <span className="sr-only">Tìm trong transcript</span>
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--theme-text-muted)]"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Tìm trong video"
                  className="h-11 w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] pl-10 pr-3 text-sm text-[var(--theme-text-strong)] outline-none transition placeholder:text-[var(--theme-text-muted)] focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary)]/20"
                />
              </label>
            </div>
          )}

          {fields.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center p-6 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--theme-bg-hover)] text-[var(--theme-text-muted)]">
                <Captions className="h-6 w-6" aria-hidden="true" />
              </span>
              <p className="mt-3 text-sm font-semibold text-[var(--theme-text-strong)]">
                Chưa có bản chép lời
              </p>
              <p className="mt-1 max-w-sm text-xs leading-5 text-[var(--theme-text-muted)]">
                Hệ thống chỉ lấy được caption công khai. Video không có caption vẫn phát
                bình thường.
              </p>
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="flex min-h-36 items-center justify-center p-6 text-center text-sm text-[var(--theme-text-muted)]">
              Không tìm thấy nội dung phù hợp.
            </div>
          ) : (
            <div
              ref={transcriptListRef}
              className="relative max-h-[34rem] overflow-y-auto"
            >
              {visibleRows.map(({ chapter, field, index, showChapterHeader, value }) => (
                <Fragment key={field.id}>
                  {showChapterHeader && chapter && (
                    <div className="sticky top-0 z-20 flex flex-col gap-2 border-b border-[var(--theme-border)] bg-[var(--theme-surface)] px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-2">
                        <BookOpen
                          className="h-4 w-4 shrink-0 text-[var(--theme-primary)]"
                          aria-hidden="true"
                        />
                        <h4 className="truncate text-base font-extrabold text-[var(--theme-text-strong)]">
                          {chapter.title}
                        </h4>
                      </div>
                      <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
                        <button
                          type="button"
                          aria-pressed={isAutoScrollEnabled}
                          aria-label={
                            isAutoScrollEnabled
                              ? "Tắt tự động cuộn transcript theo video"
                              : "Bật tự động cuộn transcript theo video"
                          }
                          title={
                            isAutoScrollEnabled
                              ? "Tắt tự động cuộn theo video"
                              : "Bật tự động cuộn theo video"
                          }
                          onClick={() =>
                            setIsAutoScrollEnabled((isEnabled) => !isEnabled)
                          }
                          className={cn(
                            "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]/30",
                            isAutoScrollEnabled
                              ? "border-[var(--theme-primary)]/30 bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/15"
                              : "border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text-muted)] hover:bg-[var(--theme-bg-hover)]",
                          )}
                        >
                          {isAutoScrollEnabled ? (
                            <LocateFixed className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <LocateOff className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          Tự cuộn: {isAutoScrollEnabled ? "Bật" : "Tắt"}
                        </button>
                        <span className="w-fit shrink-0 whitespace-nowrap rounded-md bg-[var(--theme-primary)]/15 px-2.5 py-1 text-xs font-bold text-[var(--theme-primary)]">
                          Bắt đầu lúc {formatTranscriptTimestamp(chapter.time)}
                        </span>
                      </div>
                    </div>
                  )}
                  <LessonVideoTranscriptRow
                    active={activeTranscriptIndex === index}
                    control={control}
                    getValues={getValues}
                    index={index}
                    isBusy={isBusy}
                    onPlayFromTime={handlePlayFromTime}
                    onRemove={remove}
                    register={register}
                    rowRefs={transcriptRowRefs}
                    setTimelineRevision={setTimelineRevision}
                    setValue={setValue}
                    striped={index % 2 === 1}
                    timeString={value?.timeString ?? ""}
                  />
                </Fragment>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-[var(--theme-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => append({ timeString: "", text: "" })}
              disabled={isBusy || fields.length >= 10_000}
              className="theme-button-neutral inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:opacity-50"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Thêm đoạn
            </button>
            <button
              type="submit"
              disabled={fields.length === 0 || isBusy || !accessToken}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[var(--theme-primary)] px-5 text-sm font-semibold text-white transition enabled:hover:bg-[var(--theme-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saveMutation.isPending || isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="h-4 w-4" aria-hidden="true" />
              )}
              Lưu bản chép lời
            </button>
          </div>
        </form>
      </section>
      <TranscriptRefreshConfirmDialog
        isOpen={isRefreshConfirmOpen}
        onCancel={() => setIsRefreshConfirmOpen(false)}
        onConfirm={handleConfirmRefresh}
      />
    </>
  );
}

export function formatTranscriptTimestamp(totalSeconds: number) {
  const roundedSeconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(roundedSeconds / 3600);
  const minutes = Math.floor((roundedSeconds % 3600) / 60);
  const seconds = roundedSeconds % 60;
  const secondsText = seconds.toString().padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secondsText}`;
  }
  return `${minutes}:${secondsText}`;
}

export function parseTimestamp(value: string) {
  return value
    .split(":")
    .map(Number)
    .reduce((total, part) => total * 60 + part, 0);
}

function findActiveTranscriptIndex(
  segments: TranscriptFormValues["segments"] | undefined,
  currentTime: number,
) {
  let latestActiveIndex: number | null = null;
  let latestActiveTime = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < (segments?.length ?? 0); index += 1) {
    const segment = segments?.[index];
    if (!segment) {
      continue;
    }
    if (!transcriptTimestampPattern.test(segment.timeString)) {
      continue;
    }

    const segmentTime = getTranscriptSegmentTime(segment);
    const nextSegment = segments?.[index + 1];
    const nextSegmentTime =
      nextSegment && transcriptTimestampPattern.test(nextSegment.timeString)
        ? getTranscriptSegmentTime(nextSegment)
        : undefined;
    const segmentEndTime = segment.endTime ?? nextSegmentTime ?? segmentTime;
    if (
      currentTime >= segmentTime &&
      currentTime < segmentEndTime &&
      segmentTime >= latestActiveTime
    ) {
      latestActiveIndex = index;
      latestActiveTime = segmentTime;
    }
  }

  return latestActiveIndex;
}

function toTranscriptFormSegments(
  segments: NonNullable<CustomVideoSettings["transcript"]>,
  sourceOffset = 0,
) {
  return [...segments]
    .sort((first, second) => first.time - second.time)
    .map((segment) => ({
      ...(segment.endTime !== undefined
        ? { endTime: Math.max(0, segment.endTime - sourceOffset) }
        : {}),
      time: Math.max(0, segment.time - sourceOffset),
      timeString: formatTranscriptTimestamp(Math.max(0, segment.time - sourceOffset)),
      text: segment.text,
    }));
}

function getTranscriptSegmentTime(
  segment: Pick<TranscriptFormValues["segments"][number], "time" | "timeString">,
) {
  return segment.time ?? parseTimestamp(segment.timeString);
}

function roundTranscriptTime(timeInSeconds: number) {
  return Math.round(timeInSeconds * 1000) / 1000;
}

function getPlaybackStartOffset(settings: CustomVideoSettings | null | undefined) {
  if (settings?.isDisabled === true) {
    return 0;
  }

  return settings?.startTimeInSeconds ?? DEFAULT_CUSTOM_VIDEO_SETTINGS.startTimeInSeconds;
}

function getActiveTranscriptChapter(
  chapters: VideoChapter[],
  segment: TranscriptFormValues["segments"][number] | undefined,
) {
  if (!segment || !transcriptTimestampPattern.test(segment.timeString)) {
    return undefined;
  }

  const time = getTranscriptSegmentTime(segment);
  return [...chapters]
    .sort((first, second) => second.time - first.time)
    .find((chapter) => chapter.time <= time);
}
