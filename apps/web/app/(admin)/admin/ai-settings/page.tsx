import { Suspense } from "react";
import { AdminAiSettingsScreen } from "@/features/admin/ai-settings/screens/admin-ai-settings-screen";

export default function AdminAiSettingsPage() {
  return (
    <Suspense fallback={null}>
      <AdminAiSettingsScreen />
    </Suspense>
  );
}
