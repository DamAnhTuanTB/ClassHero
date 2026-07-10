import { z } from "zod";
import type {
  AdminEditableStatus,
  AdminPublishStatus,
  AdminSubject,
} from "@/features/admin-courses/data";
import { isAllowedVideoUrl } from "@/features/admin-courses/utils";
import { requiredTrimmedText } from "@/lib/form-validation";

export const learningPathSchema = z.object({
  title: requiredTrimmedText({ requiredMessage: "Nhập tên lộ trình" }),
  slug: requiredTrimmedText({ requiredMessage: "Nhập slug" }),
  thumbnailFileName: z.string().trim().max(180).optional(),
  thumbnailImageUrl: z.string().trim().optional(),
  description: z.string().trim().max(600, "Mô tả tối đa 600 ký tự"),
  subject: z.enum(["MATH", "PHYSICS", "CHEMISTRY"], {
    error: "Chọn môn",
  }),
  grade: z.coerce.number({ error: "Chọn lớp" }).int().min(3, "Chọn lớp").max(12),
  originalPriceVnd: z
    .number({ error: "Nhập giá gốc" })
    .int("Giá phải là số nguyên")
    .min(0, "Giá không âm"),
  salePriceVnd: z
    .number()
    .int("Giá phải là số nguyên")
    .min(0, "Giá không âm")
    .optional()
    .or(z.literal("")),
  status: z.enum(["DRAFT", "PUBLISHED", "HIDDEN"]),
  sortOrder: z.coerce.number().int().min(0),
});

export const lessonSchema = z.object({
  orderIndex: z.coerce.number().int().min(1, "Thứ tự bắt đầu từ 1").max(500),
  title: requiredTrimmedText({
    requiredMessage: "Nhập tên buổi học",
    maxLength: 180,
  }),
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

export const chapterSchema = z.object({
  orderIndex: z.coerce.number().int().min(1, "Thứ tự bắt đầu từ 1").max(200),
  title: requiredTrimmedText({
    requiredMessage: "Nhập tên chương học",
    maxLength: 180,
  }),
  overview: z.string().trim().max(500, "Tổng quan tối đa 500 ký tự").optional(),
  objectives: z.string().trim().max(600, "Mục tiêu tối đa 600 ký tự").optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "HIDDEN", "ARCHIVED"]),
});

export type LearningPathFormValues = {
  title: string;
  slug: string;
  thumbnailFileName: string;
  thumbnailImageUrl: string;
  description: string;
  subject: AdminSubject | "";
  grade: number | "";
  originalPriceVnd: number | "";
  salePriceVnd: number | "";
  status: AdminEditableStatus;
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

export type ChapterFormValues = {
  orderIndex: number;
  title: string;
  overview?: string;
  objectives?: string;
  status: AdminPublishStatus;
};

export const emptyPathValues: LearningPathFormValues = {
  title: "",
  slug: "",
  thumbnailFileName: "",
  thumbnailImageUrl: "",
  description: "",
  subject: "",
  grade: "",
  originalPriceVnd: "",
  salePriceVnd: "",
  status: "DRAFT",
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

export const emptyChapterValues: ChapterFormValues = {
  orderIndex: 1,
  title: "",
  overview: "",
  objectives: "",
  status: "PUBLISHED",
};
