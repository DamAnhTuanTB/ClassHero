import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { GuestRouteGuard } from "@/components/common/auth/guest-route-guard";
import { AuthRouteLayout } from "@/components/common/auth/auth-route-layout";
import { getServerAuthUser } from "@/features/auth/session/server-auth-session";
import { getPostLoginRedirectPath } from "@/features/auth/utils/post-login-redirect";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const serverAuthUser = await getServerAuthUser();

  if (serverAuthUser) {
    redirect(getPostLoginRedirectPath(serverAuthUser.role));
  }

  return (
    <GuestRouteGuard>
      <AuthRouteLayout>{children}</AuthRouteLayout>
    </GuestRouteGuard>
  );
}
