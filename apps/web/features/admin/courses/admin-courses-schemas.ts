import { z } from "zod";
import type {
  AdminEditableStatus,
  AdminPublishStatus,
  AdminSubject,
} from "@/features/admin/courses/admin-courses-data";
import { isAllowedVideoUrl } from "@/features/admin/courses/admin-courses-utils";
import { requiredTrimmedText } from "@/lib/form-validation";

export const learningPathSchema = z.object({
  title: requiredTrimmedText({ requiredMessage: "Nhập tên khóa học" }),
  slug: z.string().trim().max(180).optional(),
  thumbnailFileId: z.string().trim().optional(),
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

const referenceDocumentSchema = z
  .object({
    title: z.string().trim().max(180, "Tên tài liệu tối đa 180 ký tự").optional(),
    file: z.custom<File | null>().optional(),
  })
  .superRefine((value, context) => {
    const hasTitle = Boolean(value.title?.trim());
    const file = value.file ?? null;

    if (hasTitle && !file) {
      context.addIssue({
        code: "custom",
        message: "Chọn file tài liệu",
        path: ["file"],
      });
    }

    if (file?.type && file.type !== "application/pdf") {
      context.addIssue({
        code: "custom",
        message: "File phải là PDF",
        path: ["file"],
      });
    }
  });

export const lessonSchema = z.object({
  orderIndex: z.coerce.number().int().min(1, "Thứ tự bắt đầu từ 1").max(500),
  title: requiredTrimmedText({
    requiredMessage: "Nhập tên bài học",
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
  trialEnabled: z.boolean(),
  status: z.enum(["DRAFT", "PUBLISHED", "HIDDEN", "ARCHIVED"]),
  sourceDocumentPageRange: z
    .object({
      sourceDocumentId: z.string().trim().optional(),
      pageStart: z.string().trim().optional(),
      pageEnd: z.string().trim().optional(),
    })
    .superRefine((value, context) => {
      const hasStart = Boolean(value.pageStart?.trim());
      const hasEnd = Boolean(value.pageEnd?.trim());

      if (!hasStart && !hasEnd) {
        return;
      }

      if (!value.sourceDocumentId?.trim()) {
        context.addIssue({
          code: "custom",
          message: "Chọn tài liệu nguồn",
          path: ["sourceDocumentId"],
        });
      }

      if (!hasStart) {
        context.addIssue({
          code: "custom",
          message: "Nhập trang bắt đầu",
          path: ["pageStart"],
        });
      }

      if (!hasEnd) {
        context.addIssue({
          code: "custom",
          message: "Nhập trang kết thúc",
          path: ["pageEnd"],
        });
      }

    }),
  referenceDocuments: z
    .array(referenceDocumentSchema)
    .max(10, "Tối đa 10 tài liệu tham khảo"),
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
  thumbnailFileId: string;
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
  trialEnabled: boolean;
  status: AdminPublishStatus;
  sourceDocumentPageRange: {
    sourceDocumentId?: string;
    pageStart?: string;
    pageEnd?: string;
  };
  referenceDocuments: Array<{
    title?: string;
    file?: File | null;
  }>;
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
  thumbnailFileId: "",
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
  trialEnabled: false,
  status: "PUBLISHED",
  sourceDocumentPageRange: {
    sourceDocumentId: "",
    pageStart: "",
    pageEnd: "",
  },
  referenceDocuments: [],
};

export const emptyChapterValues: ChapterFormValues = {
  orderIndex: 1,
  title: "",
  overview: "",
  objectives: "",
  status: "PUBLISHED",
};
