import { StudentLessonScreen } from "@/features/student/lessons/screens/student-lesson-screen";
import type { StudentLessonTab } from "@/features/student/lessons/types/student-lesson-types";
import { getServerThemeMode } from "@/lib/server-theme";

const validTabs = new Set<StudentLessonTab>(["lesson", "quiz", "flashcard", "test"]);

export default async function StudentLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ lessonId }, query, initialThemeMode] = await Promise.all([
    params,
    searchParams,
    getServerThemeMode(),
  ]);
  const initialTab = validTabs.has(query.tab as StudentLessonTab)
    ? (query.tab as StudentLessonTab)
    : "lesson";

  return (
    <StudentLessonScreen
      lessonId={lessonId}
      initialTab={initialTab}
      initialThemeMode={initialThemeMode}
    />
  );
}
