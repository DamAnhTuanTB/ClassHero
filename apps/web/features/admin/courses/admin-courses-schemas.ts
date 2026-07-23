import { z } from "zod";
import type {
  AdminEditableStatus,
  AdminPublishStatus,
  AdminSubject,
} from "@/features/admin/courses/admin-courses-data";
import { getMaximumPrintedPageNumber } from "@/features/admin/courses/admin-course-documents-utils";
import { isAllowedVideoUrl } from "@/features/admin/courses/admin-courses-utils";
import type { AdminSourceDocumentPageApi } from "@/features/admin/courses/types/admin-course-document-types";
import { requiredTrimmedText } from "@/lib/form-validation";

const positiveIntegerTextPattern = /^[1-9]\d*$/;

const sourceDocumentExtractionSchema = z
  .object({
    id: z.string().optional(),
    clientKey: z.string(),
    sourceDocumentId: z.string({ error: "Chọn tài liệu nguồn" }).trim(),
    pageStart: z.string().trim().optional(),
    pageEnd: z.string().trim().optional(),
    hasInteracted: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    const hasStart = Boolean(value.pageStart);
    const hasEnd = Boolean(value.pageEnd);

    if (!value.hasInteracted && !hasStart && !hasEnd) {
      return;
    }

    if (!value.sourceDocumentId) {
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

    const isStartValid = hasStart && positiveIntegerTextPattern.test(value.pageStart!);
    const isEndValid = hasEnd && positiveIntegerTextPattern.test(value.pageEnd!);

    if (hasStart && !isStartValid) {
      context.addIssue({
        code: "custom",
        message: "Trang bắt đầu phải là số nguyên dương",
        path: ["pageStart"],
      });
    }
    if (hasEnd && !isEndValid) {
      context.addIssue({
        code: "custom",
        message: "Trang kết thúc phải là số nguyên dương",
        path: ["pageEnd"],
      });
    }
    if (isStartValid && isEndValid && Number(value.pageEnd) < Number(value.pageStart)) {
      context.addIssue({
        code: "custom",
        message: "Phải lớn hơn hoặc bằng Từ trang",
        path: ["pageEnd"],
      });
    }
  });

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
    id: z.string().optional(),
    clientKey: z.string().optional(),
    originalName: z.string().optional(),
    title: requiredTrimmedText({
      requiredMessage: "Nhập tên tài liệu",
      maxLength: 180,
    }),
    file: z.custom<File | null>().optional(),
    type: z.enum(["PRIMARY_FROM_SOURCE", "SUPPLEMENT", "HOMEWORK"]).default("SUPPLEMENT"),
    status: z.string().optional(),
    extractError: z.string().optional(),
    progress: z.number().optional(),
    url: z.string().optional(),
  })
  .superRefine((value, context) => {
    const file = value.file ?? null;
    const isExisting = Boolean(value.id);

    if (!isExisting && !file) {
      context.addIssue({
        code: "custom",
        message:
          value.type === "PRIMARY_FROM_SOURCE"
            ? "Phải chọn file cho tài liệu nền tảng"
            : value.type === "HOMEWORK"
              ? "Phải chọn file cho bài tập về nhà"
              : "Phải chọn file cho tài liệu bổ sung",
        path: ["file"],
      });
    }

    if (!isExisting && file?.type && file.type !== "application/pdf") {
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
  trialEnabled: z.boolean(),
  status: z.enum(["DRAFT", "PUBLISHED", "HIDDEN", "ARCHIVED"]),
  sourceDocumentExtractions: z
    .array(sourceDocumentExtractionSchema)
    .max(20, "Tối đa 20 khối trích xuất")
    .superRefine((extractions, context) => {
      extractions.forEach((current, currentIndex) => {
        const currentStart = current.pageStart ?? "";
        const currentEnd = current.pageEnd ?? "";
        if (
          !positiveIntegerTextPattern.test(currentStart) ||
          !positiveIntegerTextPattern.test(currentEnd)
        ) {
          return;
        }

        for (let previousIndex = 0; previousIndex < currentIndex; previousIndex += 1) {
          const previous = extractions[previousIndex]!;
          const previousStart = previous.pageStart ?? "";
          const previousEnd = previous.pageEnd ?? "";
          if (
            previous.sourceDocumentId !== current.sourceDocumentId ||
            !positiveIntegerTextPattern.test(previousStart) ||
            !positiveIntegerTextPattern.test(previousEnd)
          ) {
            continue;
          }

          if (
            Number(currentStart) <= Number(previousEnd) &&
            Number(previousStart) <= Number(currentEnd)
          ) {
            context.addIssue({
              code: "custom",
              message: `Khoảng trang xung đột với khối trích xuất ${previousIndex + 1}`,
              path: [currentIndex, "pageStart"],
            });
            break;
          }
        }
      });
    }),
  foundationDocumentOrder: z.array(z.string()).optional(),
  referenceDocuments: z
    .array(referenceDocumentSchema)
    .max(10, "Tối đa 10 tài liệu upload")
    .superRefine((docs, ctx) => {
      const fileKeys = new Set<string>();
      const titleKeys = new Set<string>();
      docs.forEach((doc, index) => {
        const name = doc.file ? doc.file.name : doc.originalName;
        if (name) {
          if (fileKeys.has(name)) {
            ctx.addIssue({
              code: "custom",
              message: "Tài liệu này đã được chọn",
              path: [index, "file"],
            });
          } else {
            fileKeys.add(name);
          }
        }

        if (doc.title) {
          const titleKey = doc.title.trim().toLowerCase();
          if (titleKey) {
            if (titleKeys.has(titleKey)) {
              ctx.addIssue({
                code: "custom",
                message: "Không được đặt tên tài liệu trùng nhau",
                path: [index, "title"],
              });
            } else {
              titleKeys.add(titleKey);
            }
          }
        }
      });
    }),
});

export function createLessonSchema(
  sourceDocuments: Array<{ file: { originalName: string; sizeBytes: number } }> = [],
  sourcePagesByDocumentId: Record<string, AdminSourceDocumentPageApi[]> = {},
) {
  return lessonSchema
    .extend({
      referenceDocuments: z
        .array(referenceDocumentSchema)
        .max(10, "Tối đa 10 tài liệu upload")
        .superRefine((docs, ctx) => {
          const fileKeys = new Set<string>();
          const titleKeys = new Set<string>();
          docs.forEach((doc, index) => {
            const name = doc.file ? doc.file.name : doc.originalName;
            if (name) {
              if (fileKeys.has(name)) {
                ctx.addIssue({
                  code: "custom",
                  message: "Tài liệu này đã được chọn",
                  path: [index, "file"],
                });
              } else {
                fileKeys.add(name);
              }

              if (doc.file) {
                const isMatch = sourceDocuments.some((sd) => {
                  return (
                    sd.file.originalName === doc.file!.name &&
                    sd.file.sizeBytes === doc.file!.size
                  );
                });
                if (isMatch) {
                  ctx.addIssue({
                    code: "custom",
                    message: "Tài liệu này trùng với file nguồn của khóa học",
                    path: [index, "file"],
                  });
                }
              }
            }

            if (doc.title) {
              const titleKey = doc.title.trim().toLowerCase();
              if (titleKey) {
                if (titleKeys.has(titleKey)) {
                  ctx.addIssue({
                    code: "custom",
                    message: "Không được đặt tên tài liệu trùng nhau",
                    path: [index, "title"],
                  });
                } else {
                  titleKeys.add(titleKey);
                }
              }
            }
          });
        }),
    })
    .superRefine((values, context) => {
      values.sourceDocumentExtractions.forEach((extraction, index) => {
        const maximumPrintedPage = getMaximumPrintedPageNumber(
          sourcePagesByDocumentId[extraction.sourceDocumentId] ?? [],
        );
        if (maximumPrintedPage === null) {
          return;
        }

        const boundedFields = [
          {
            field: "pageStart" as const,
            label: "Trang bắt đầu",
            value: extraction.pageStart?.trim() ?? "",
          },
          {
            field: "pageEnd" as const,
            label: "Trang kết thúc",
            value: extraction.pageEnd?.trim() ?? "",
          },
        ];

        boundedFields.forEach(({ field, label, value }) => {
          if (
            positiveIntegerTextPattern.test(value) &&
            Number(value) > maximumPrintedPage
          ) {
            context.addIssue({
              code: "custom",
              message: `${label} tối đa là ${maximumPrintedPage}`,
              path: ["sourceDocumentExtractions", index, field],
            });
          }
        });
      });
    });
}

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
  sourceDocumentExtractions: Array<{
    id?: string;
    clientKey: string;
    sourceDocumentId: string;
    pageStart?: string;
    pageEnd?: string;
    hasInteracted?: boolean;
  }>;
  foundationDocumentOrder: string[];
  referenceDocuments: Array<{
    id?: string;
    clientKey?: string;
    originalName?: string;
    title?: string;
    file?: File | null;
    type?: "PRIMARY_FROM_SOURCE" | "SUPPLEMENT" | "HOMEWORK";
    status?: string;
    extractError?: string;
    progress?: number;
    url?: string;
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
  sourceDocumentExtractions: [
    {
      clientKey: "default-extraction",
      sourceDocumentId: "",
      pageStart: "",
      pageEnd: "",
      hasInteracted: false,
    },
  ],
  foundationDocumentOrder: ["EXTRACTION:default-extraction"],
  referenceDocuments: [],
};

export const emptyChapterValues: ChapterFormValues = {
  orderIndex: 1,
  title: "",
  overview: "",
  objectives: "",
  status: "PUBLISHED",
};
