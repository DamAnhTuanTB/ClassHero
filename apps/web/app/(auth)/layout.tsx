import type { ReactNode } from "react";
import { AppToaster } from "@/app/toaster";
import { AuthRouteLayout } from "@/features/auth";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AuthRouteLayout>{children}</AuthRouteLayout>
      <AppToaster />
    </>
  );
}
