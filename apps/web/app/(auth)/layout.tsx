import type { ReactNode } from "react";
import { AppToaster } from "@/app/toaster";
import { GuestRouteGuard } from "@/components/common/auth/guest-route-guard";
import { AuthRouteLayout } from "@/components/common/auth/auth-route-layout";

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
