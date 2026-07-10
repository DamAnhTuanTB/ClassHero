import { z } from "zod";
import type { AdminPublishStatus, AdminSubject } from "@/features/admin-courses/data";
import { isAllowedVideoUrl } from "@/features/admin-courses/utils";

export const learningPathSchema = z.object({
  title: z.string().trim().min(2, "Nhập tên lộ trình").max(160),
  slug: z
    .string()
    .trim()
    .min(2, "Slug tối thiểu 2 ký tự")
    .max(180)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug dùng chữ thường, số và dấu gạch")
    .optional()
    .or(z.literal("")),
  subject: z.enum(["MATH", "PHYSICS", "CHEMISTRY"]),
  grade: z.coerce.number().int().min(3).max(12),
  originalPriceVnd: z.coerce.number().int().min(0, "Giá không âm"),
  salePriceVnd: z.coerce.number().int().min(0).optional().or(z.literal("")),
  status: z.enum(["DRAFT", "PUBLISHED", "HIDDEN", "ARCHIVED"]),
  trialEnabled: z.boolean(),
  sortOrder: z.coerce.number().int().min(0),
});

export const lessonSchema = z.object({
  orderIndex: z.coerce.number().int().min(1, "Thứ tự bắt đầu từ 1").max(500),
  title: z.string().trim().min(2, "Nhập tên buổi học").max(180),
  shortDescription: z.string().trim().max(500).optional(),
  scheduledAt: z.string().optional(),
  examOpenAt: z.string().optional(),
  videoUrl: z
    .string()
    .trim()
    .max(2048)
    .optional()
    .refine((value) => !value || isAllowedVideoUrl(value), {
      message: "Chỉ nhận YouTube hoặc Google Drive",
    }),
  completionMinScore: z.coerce.number().min(0).max(10),
  status: z.enum(["DRAFT", "PUBLISHED", "HIDDEN", "ARCHIVED"]),
});

export type LearningPathFormValues = {
  title: string;
  slug?: string;
  subject: AdminSubject;
  grade: number;
  originalPriceVnd: number;
  salePriceVnd: number | "";
  status: AdminPublishStatus;
  trialEnabled: boolean;
  sortOrder: number;
};

export type LessonFormValues = {
  orderIndex: number;
  title: string;
  shortDescription?: string;
  scheduledAt?: string;
  examOpenAt?: string;
  videoUrl?: string;
  completionMinScore: number;
  status: AdminPublishStatus;
};

export const emptyPathValues: LearningPathFormValues = {
  title: "",
  slug: "",
  subject: "MATH",
  grade: 7,
  originalPriceVnd: 0,
  salePriceVnd: "",
  status: "DRAFT",
  trialEnabled: true,
  sortOrder: 0,
};

export const emptyLessonValues: LessonFormValues = {
  orderIndex: 1,
  title: "",
  shortDescription: "",
  scheduledAt: "",
  examOpenAt: "",
  videoUrl: "",
  completionMinScore: 7,
  status: "DRAFT",
};
