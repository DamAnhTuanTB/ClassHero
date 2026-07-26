"use client";

import { Check, Loader2, Settings } from "lucide-react";
import { useState } from "react";
import { useForm as useHookForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { FieldLabel } from "@/components/common/forms/field-label";
import { TextField } from "@/components/common/forms/text-field";
import {
  CustomVideoSettings,
  DEFAULT_CUSTOM_VIDEO_SETTINGS,
} from "@/components/shared/custom-youtube-player";
import { updateAdminLessonVideoSettings } from "@/features/admin/courses/api/admin-lessons-api";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface LessonVideoSettingsFormProps {
  lessonId: string;
  initialSettings: CustomVideoSettings | null | undefined;
}

const customVideoSettingsSchema = z.object({
  isDisabled: z.boolean(),
  startTimeInSeconds: z
    .number({ message: "Vui lòng nhập số hợp lệ" })
    .min(0, "Thời gian phải ≥ 0"),
  endTimeCutInSeconds: z
    .number({ message: "Vui lòng nhập số hợp lệ" })
    .min(0, "Thời gian phải ≥ 0"),
  introOverlayDurationInSeconds: z
    .number({ message: "Vui lòng nhập số hợp lệ" })
    .min(0, "Thời gian phải ≥ 0"),
  pauseOverlayDurationInSeconds: z
    .number({ message: "Vui lòng nhập số hợp lệ" })
    .min(0, "Thời gian phải ≥ 0"),
  seekStepInSeconds: z
    .number({ message: "Vui lòng nhập số hợp lệ" })
    .min(1, "Bước nhảy phải ≥ 1"),
  letterboxTopPercentage: z.number({ message: "Vui lòng nhập số hợp lệ" }).min(0).max(50),
  letterboxBottomPercentage: z
    .number({ message: "Vui lòng nhập số hợp lệ" })
    .min(0)
    .max(50),
  letterboxLeftPercentage: z
    .number({ message: "Vui lòng nhập số hợp lệ" })
    .min(0)
    .max(50),
  letterboxRightPercentage: z
    .number({ message: "Vui lòng nhập số hợp lệ" })
    .min(0)
    .max(50),
  hasWatermark: z.boolean(),
});

export function LessonVideoSettingsForm({
  lessonId,
  initialSettings,
}: LessonVideoSettingsFormProps) {
  const queryClient = useQueryClient();
  const session = useAuthSessionStore((state) => state.session);
  const [isOpen, setIsOpen] = useState(false);

  const bottomPercent = initialSettings?.letterboxBottomPercentage ?? 0;

  const form = useHookForm<CustomVideoSettings>({
    resolver: zodResolver(customVideoSettingsSchema),
    mode: "onChange",
    defaultValues: {
      ...DEFAULT_CUSTOM_VIDEO_SETTINGS,
      ...initialSettings,
      letterboxBottomPercentage: bottomPercent,
      letterboxTopPercentage: initialSettings?.letterboxTopPercentage ?? 0,
      letterboxLeftPercentage: initialSettings?.letterboxLeftPercentage ?? 0,
      letterboxRightPercentage: initialSettings?.letterboxRightPercentage ?? 0,
    },
  });

  const {
    register,
    watch,
    handleSubmit,
    formState: { errors },
  } = form;
  const isDisabled = watch("isDisabled");

  const topLetterbox = watch("letterboxTopPercentage") ?? 0;
  const bottomLetterbox = watch("letterboxBottomPercentage") ?? 0;
  const leftLetterbox = watch("letterboxLeftPercentage") ?? 0;
  const rightLetterbox = watch("letterboxRightPercentage") ?? 0;

  const updateMutation = useMutation({
    mutationFn: async (data: CustomVideoSettings) => {
      if (!session?.accessToken) throw new Error("Unauthorized");
      return updateAdminLessonVideoSettings(lessonId, data, session.accessToken);
    },
    onSuccess: () => {
      toast.success("Đã lưu cài đặt video");
      queryClient.invalidateQueries({ queryKey: ["admin-lesson", lessonId] });
      setIsOpen(false);
    },
    onError: () => {
      toast.error("Có lỗi xảy ra khi lưu cài đặt video");
    },
  });

  const onSubmit = (data: CustomVideoSettings) => {
    updateMutation.mutate({
      ...DEFAULT_CUSTOM_VIDEO_SETTINGS,
      ...(initialSettings ?? {}),
      ...data,
    });
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="mt-4 flex items-center justify-center gap-2 w-full p-3 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] hover:bg-[var(--theme-surface-hover)] transition-colors text-sm font-semibold text-[var(--theme-text)]"
      >
        <Settings className="w-4 h-4" />
        Tùy chỉnh Video Player cho buổi học này
      </button>
    );
  }

  return (
    <div className="mt-4 border border-[var(--theme-border)] bg-[var(--theme-surface)] rounded-xl overflow-hidden">
      <div className="bg-[var(--theme-surface-sunken)] p-4 border-b border-[var(--theme-border)] flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-[var(--theme-text-strong)]">
          <Settings className="w-4 h-4 text-[var(--theme-primary)]" />
          Cài đặt Custom Video Player
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-xs font-semibold text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]"
        >
          Đóng
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-5">
        <label className="flex items-center gap-3 p-3 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-sunken)] cursor-pointer hover:bg-[var(--theme-border)] transition-colors">
          <input
            type="checkbox"
            className="w-5 h-5 rounded border-gray-300 text-[var(--theme-primary)] focus:ring-[var(--theme-primary)] bg-[var(--theme-surface)]"
            {...register("isDisabled")}
          />
          <div className="flex-1">
            <p className="font-bold text-[var(--theme-text-strong)] text-sm">
              Sử dụng YouTube Player mặc định
            </p>
            <p className="text-xs text-[var(--theme-text-muted)] mt-0.5">
              Tắt hoàn toàn giao diện tùy chỉnh và sử dụng khung phát video gốc của
              YouTube (có logo, quảng cáo...).
            </p>
          </div>
        </label>

        {!isDisabled && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField
                id="startTime"
                type="number"
                label="Bỏ qua phần đầu (giây)"
                error={errors.startTimeInSeconds}
                icon={null}
                {...register("startTimeInSeconds", { valueAsNumber: true })}
              />
              <TextField
                id="endTimeCut"
                type="number"
                label="Bỏ qua phần cuối (giây)"
                error={errors.endTimeCutInSeconds}
                icon={null}
                {...register("endTimeCutInSeconds", { valueAsNumber: true })}
              />
              <TextField
                id="introOverlay"
                type="number"
                label="Thời gian che Intro (giây)"
                error={errors.introOverlayDurationInSeconds}
                icon={null}
                {...register("introOverlayDurationInSeconds", { valueAsNumber: true })}
              />
              <TextField
                id="pauseOverlay"
                type="number"
                label="Thời gian che Pause (giây)"
                error={errors.pauseOverlayDurationInSeconds}
                icon={null}
                {...register("pauseOverlayDurationInSeconds", { valueAsNumber: true })}
              />
              <TextField
                id="seekStep"
                type="number"
                label="Bước nhảy khi Tua (giây)"
                error={errors.seekStepInSeconds}
                icon={null}
                {...register("seekStepInSeconds", { valueAsNumber: true })}
              />
            </div>

            <div className="space-y-4 pt-2">
              <label className="flex items-center gap-3 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-gray-300 text-[var(--theme-primary)] focus:ring-[var(--theme-primary)] bg-[var(--theme-surface)]"
                  {...register("hasWatermark")}
                />
                <span className="font-semibold text-[var(--theme-text-strong)] text-sm">
                  Hiện Logo ClassHero góc trên bên phải
                </span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                <div>
                  <FieldLabel id="letterboxLeft" label="Độ dày viền đen - Trái (%)" />
                  <div className="flex items-center gap-3 mt-2 w-full">
                    <input
                      id="letterboxLeft"
                      type="range"
                      min={0}
                      max={50}
                      step={0.5}
                      className="flex-1 h-2 bg-[var(--theme-border)] rounded-lg appearance-none cursor-pointer accent-[var(--theme-primary)]"
                      {...register("letterboxLeftPercentage", { valueAsNumber: true })}
                    />
                    <span className="font-semibold text-[var(--theme-text-strong)] text-sm w-9 text-right">
                      {leftLetterbox}%
                    </span>
                  </div>
                </div>

                <div>
                  <FieldLabel id="letterboxRight" label="Độ dày viền đen - Phải (%)" />
                  <div className="flex items-center gap-3 mt-2 w-full">
                    <input
                      id="letterboxRight"
                      type="range"
                      min={0}
                      max={50}
                      step={0.5}
                      className="flex-1 h-2 bg-[var(--theme-border)] rounded-lg appearance-none cursor-pointer accent-[var(--theme-primary)]"
                      {...register("letterboxRightPercentage", { valueAsNumber: true })}
                    />
                    <span className="font-semibold text-[var(--theme-text-strong)] text-sm w-9 text-right">
                      {rightLetterbox}%
                    </span>
                  </div>
                </div>

                <div>
                  <FieldLabel id="letterboxTop" label="Độ dày viền đen - Trên (%)" />
                  <div className="flex items-center gap-3 mt-2 w-full">
                    <input
                      id="letterboxTop"
                      type="range"
                      min={0}
                      max={50}
                      step={0.5}
                      className="flex-1 h-2 bg-[var(--theme-border)] rounded-lg appearance-none cursor-pointer accent-[var(--theme-primary)]"
                      {...register("letterboxTopPercentage", { valueAsNumber: true })}
                    />
                    <span className="font-semibold text-[var(--theme-text-strong)] text-sm w-9 text-right">
                      {topLetterbox}%
                    </span>
                  </div>
                </div>

                <div>
                  <FieldLabel id="letterboxBottom" label="Độ dày viền đen - Dưới (%)" />
                  <div className="flex items-center gap-3 mt-2 w-full">
                    <input
                      id="letterboxBottom"
                      type="range"
                      min={0}
                      max={50}
                      step={0.5}
                      className="flex-1 h-2 bg-[var(--theme-border)] rounded-lg appearance-none cursor-pointer accent-[var(--theme-primary)]"
                      {...register("letterboxBottomPercentage", { valueAsNumber: true })}
                    />
                    <span className="font-semibold text-[var(--theme-text-strong)] text-sm w-9 text-right">
                      {bottomLetterbox}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="theme-button-primary inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-6 font-extrabold"
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Lưu cài đặt Video
          </button>
        </div>
      </form>
    </div>
  );
}
