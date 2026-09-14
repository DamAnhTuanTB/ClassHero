import { Suspense } from "react";
import { AdminAiChatScreen } from "@/features/admin/ai-chat/screens/admin-ai-chat-screen";

export default function AdminAiChatPage() {
  return (
    <Suspense fallback={null}>
      <AdminAiChatScreen />
    </Suspense>
  );
}
