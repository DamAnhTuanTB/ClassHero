import type { ReactNode } from "react";
import { AppToaster } from "@/app/toaster";
import { GuestRouteGuard } from "@/features/auth/components/guest-route-guard";
import { AuthRouteLayout } from "@/features/auth";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <GuestRouteGuard>
        <AuthRouteLayout>{children}</AuthRouteLayout>
      </GuestRouteGuard>
      <AppToaster />
    </>
  );
}
