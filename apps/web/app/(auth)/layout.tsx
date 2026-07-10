import type { ReactNode } from "react";
import { AuthRouteLayout } from "@/features/auth";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthRouteLayout>{children}</AuthRouteLayout>;
}
