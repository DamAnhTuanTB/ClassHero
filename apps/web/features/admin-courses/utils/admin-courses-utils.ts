import type { AdminLearningPath, AdminLesson } from "@/features/admin-courses/data";
import type {
  LearningPathFormValues,
  LessonFormValues,
} from "@/features/admin-courses/schemas";

export function toPathFormValues(path: AdminLearningPath): LearningPathFormValues {
  return {
    title: path.title,
    slug: path.slug,
    subject: path.subject,
    grade: path.grade,
    originalPriceVnd: path.originalPriceVnd,
    salePriceVnd: path.salePriceVnd ?? "",
    status: path.status,
    trialEnabled: path.trialEnabled,
    sortOrder: path.sortOrder,
  };
}

export function toLearningPathPayload(values: LearningPathFormValues) {
  return {
    title: values.title.trim(),
    slug: values.slug ? values.slug.trim() : createSlug(values.title),
    subject: values.subject,
    grade: Number(values.grade),
    originalPriceVnd: Number(values.originalPriceVnd),
    salePriceVnd: values.salePriceVnd === "" ? null : Number(values.salePriceVnd),
    status: values.status,
    trialEnabled: values.trialEnabled,
    sortOrder: Number(values.sortOrder),
  };
}

export function toLessonFormValues(lesson: AdminLesson): LessonFormValues {
  return {
    orderIndex: lesson.orderIndex,
    title: lesson.title,
    shortDescription: lesson.shortDescription,
    scheduledAt: lesson.scheduledAt,
    examOpenAt: lesson.examOpenAt,
    videoUrl: lesson.videoUrl,
    completionMinScore: lesson.completionMinScore,
    status: lesson.status,
  };
}

export function toLessonPayload(values: LessonFormValues): Omit<AdminLesson, "id"> {
  return {
    orderIndex: Number(values.orderIndex),
    title: values.title.trim(),
    shortDescription: values.shortDescription?.trim() ?? "",
    scheduledAt: values.scheduledAt ?? "",
    examOpenAt: values.examOpenAt ?? "",
    videoUrl: values.videoUrl?.trim() ?? "",
    completionMinScore: Number(values.completionMinScore),
    status: values.status,
  };
}

export function byLessonOrder(left: AdminLesson, right: AdminLesson) {
  return left.orderIndex - right.orderIndex;
}

export function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function formatPrice(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDateTime(value: string) {
  if (!value) {
    return "Chưa đặt";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function isAllowedVideoUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");

    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      (hostname === "youtube.com" ||
        hostname === "m.youtube.com" ||
        hostname === "youtu.be" ||
        hostname === "youtube-nocookie.com" ||
        hostname === "drive.google.com")
    );
  } catch {
    return false;
  }
}

function createSlug(title: string) {
  return (
    title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "d")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-") || "lo-trinh"
  );
}
