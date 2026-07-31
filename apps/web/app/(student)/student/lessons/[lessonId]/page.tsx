import { StudentLessonScreen } from "@/features/student/lessons/screens/student-lesson-screen";
import { getServerStudentLesson } from "@/features/student/lessons/api/server-student-lessons-api";
import type { StudentLessonTab } from "@/features/student/lessons/types/student-lesson-types";
import { parseStudentLearningSurface } from "@/features/student/lessons/utils/student-learning-surface-route";
import { getServerThemeMode } from "@/lib/server-theme";

const validTabs = new Set<StudentLessonTab>(["lesson", "quiz", "flashcard", "test"]);

export default async function StudentLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ lessonId }, query] = await Promise.all([params, searchParams]);
  const [initialLesson, initialThemeMode] = await Promise.all([
    getServerStudentLesson(lessonId),
    getServerThemeMode(),
  ]);
  const initialLearningSurface = parseStudentLearningSurface(query);
  const surfaceTab = initialLearningSurface?.kind.startsWith("quiz-")
    ? "quiz"
    : initialLearningSurface?.kind.startsWith("flashcard-")
      ? "flashcard"
      : initialLearningSurface?.kind.startsWith("test-")
        ? "test"
        : null;
  const initialTab =
    surfaceTab ??
    (validTabs.has(query.tab as StudentLessonTab)
      ? (query.tab as StudentLessonTab)
      : "lesson");

  return (
    <StudentLessonScreen
      initialLearningSurface={initialLearningSurface}
      initialLesson={initialLesson}
      lessonId={lessonId}
      initialTab={initialTab}
      initialThemeMode={initialThemeMode}
    />
  );
}
