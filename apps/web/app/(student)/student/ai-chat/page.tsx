import { Suspense } from "react";
import { StudentAiChatScreen } from "@/features/student/ai-chat/screens/student-ai-chat-screen";
import { getServerThemeMode } from "@/lib/server-theme";

export default async function StudentAiChatPage() {
  const initialThemeMode = await getServerThemeMode();
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--student-screen-bg)]" />}>
      <StudentAiChatScreen initialThemeMode={initialThemeMode} />
    </Suspense>
  );
}
