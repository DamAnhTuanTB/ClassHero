import type {
  StudentLearningSurface,
  StudentLessonTab,
} from "@/features/student/lessons/types/student-lesson-types";

const LEARNING_SURFACE_QUERY_KEY = "learningSurface";
const LEARNING_SET_ID_QUERY_KEY = "learningSetId";
const LEARNING_ATTEMPT_ID_QUERY_KEY = "learningAttemptId";

type StudentLessonSearchParams = Record<
  string,
  string | string[] | undefined
>;

export function parseStudentLearningSurface(
  searchParams: StudentLessonSearchParams | URLSearchParams,
): StudentLearningSurface | null {
  const kind = readSearchParam(searchParams, LEARNING_SURFACE_QUERY_KEY);
  const setId = readSearchParam(searchParams, LEARNING_SET_ID_QUERY_KEY);
  const attemptId = readSearchParam(
    searchParams,
    LEARNING_ATTEMPT_ID_QUERY_KEY,
  );

  if (!setId) return null;
  if (kind === "flashcard-runner" || kind === "flashcard-result") {
    return { kind, setId };
  }
  if (
    attemptId &&
    (kind === "quiz-runner" || kind === "quiz-result")
  ) {
    return { attemptId, kind, setId };
  }
  return null;
}

export function getBrowserStudentLearningSurface() {
  if (typeof window === "undefined") return null;
  return parseStudentLearningSurface(
    new URLSearchParams(window.location.search),
  );
}

export function getStudentLearningSurfaceHref(
  surface: StudentLearningSurface | null,
) {
  if (typeof window === "undefined") return "";

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.delete(LEARNING_SURFACE_QUERY_KEY);
  nextUrl.searchParams.delete(LEARNING_SET_ID_QUERY_KEY);
  nextUrl.searchParams.delete(LEARNING_ATTEMPT_ID_QUERY_KEY);

  if (surface) {
    nextUrl.searchParams.set("tab", getSurfaceTab(surface.kind));
    nextUrl.searchParams.set(LEARNING_SURFACE_QUERY_KEY, surface.kind);
    nextUrl.searchParams.set(LEARNING_SET_ID_QUERY_KEY, surface.setId);
    if ("attemptId" in surface) {
      nextUrl.searchParams.set(
        LEARNING_ATTEMPT_ID_QUERY_KEY,
        surface.attemptId,
      );
    }
  }

  return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
}

export function isLearningSurfaceKind(
  surface: StudentLearningSurface | null,
  family: StudentLessonTab,
) {
  return surface?.kind.startsWith(`${family}-`) ?? false;
}

function getSurfaceTab(
  kind: StudentLearningSurface["kind"],
): StudentLessonTab {
  return kind.startsWith("quiz-") ? "quiz" : "flashcard";
}

function readSearchParam(
  searchParams: StudentLessonSearchParams | URLSearchParams,
  key: string,
) {
  const value =
    searchParams instanceof URLSearchParams
      ? searchParams.get(key)
      : searchParams[key];
  const normalized = Array.isArray(value) ? value[0] : value;
  return normalized && normalized.length > 0 ? normalized : null;
}
