"use client";

import { ChevronLeft, GraduationCap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AuthDevHydrationBoundary } from "@/components/common/auth/auth-dev-hydration-boundary";

type AuthVariant = "login" | "student" | "parent" | "recovery";
type IllustrationType = "login" | "student" | "parent" | "secure";

const authBrandSlogan = "Học thông minh, vững tương lai";

const theme = {
  login: {
    titleFirst: "Chào mừng bạn",
    titleSecond: "trở lại!",
    description: "Tiếp tục học tập, chinh phục mục tiêu.",
    illustration: "login" as IllustrationType,
    illustrationSrc: "/images/auth/reference/auth-hero-login-inclusive-transparent.png",
  },
  student: {
    titleFirst: "Tạo tài khoản",
    titleSecond: "học sinh",
    description: "Bắt đầu hành trình học thú vị.",
    illustration: "student" as IllustrationType,
    illustrationSrc: "/images/auth/reference/auth-hero-student-inclusive-transparent.png",
  },
  parent: {
    titleFirst: "Tạo tài khoản",
    titleSecond: "phụ huynh",
    description: "Nắm tiến độ của con mỗi ngày.",
    illustration: "parent" as IllustrationType,
    illustrationSrc: "/images/auth/reference/auth-hero-parent-transparent.png",
  },
  recovery: {
    titleFirst: "Quay lại",
    titleSecond: "lớp học",
    description: "Bài học đang chờ bạn.",
    illustration: "secure" as IllustrationType,
    illustrationSrc: "/images/auth/reference/auth-hero-recovery-transparent.png",
  },
} satisfies Record<
  AuthVariant,
  {
    titleFirst: string;
    titleSecond: string;
    description: string;
    illustration: IllustrationType;
    illustrationSrc: string;
  }
>;

function getAuthVariant(pathname: string): AuthVariant {
  if (pathname.includes("/register/student")) {
    return "student";
  }

  if (pathname.includes("/register/parent")) {
    return "parent";
  }

  if (pathname.includes("/forgot-password") || pathname.includes("/reset-password")) {
    return "recovery";
  }

  return "login";
}

export function AuthRouteLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const variant = getAuthVariant(pathname);
  const currentTheme = theme[variant];
  const showBackLink = variant !== "login";

  return (
    <main
      data-auth-variant={variant}
      className="theme-page relative overflow-hidden px-3 py-4 sm:px-6 sm:py-8 lg:px-8"
    >
      <div className="theme-auth-ambient pointer-events-none absolute inset-0" />

      <section className="theme-auth-shell relative mx-auto min-h-[calc(100vh-2rem)] max-w-[560px] overflow-hidden rounded-2xl sm:min-h-[calc(100vh-4rem)] lg:grid lg:max-w-[1280px] lg:grid-cols-[1fr_0.94fr] lg:rounded-[2.35rem]">
        <div className="relative h-[25rem] px-6 pb-28 pt-6 sm:h-[26.125rem] sm:px-8 sm:pb-28 sm:pt-8 lg:h-auto lg:min-h-full lg:px-10 lg:pb-12 lg:pt-10 xl:px-14">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="inline-flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--theme-brand-secondary),var(--theme-brand-primary))] text-[var(--theme-brand-foreground)] shadow-[var(--theme-shadow-sm)]">
                <GraduationCap className="h-6 w-6" aria-hidden="true" />
              </span>
              <span>
                <span className="inline-flex items-baseline leading-none tracking-normal">
                  <span className="font-[var(--font-display)] text-[1.45rem] font-extrabold text-[var(--theme-brand-primary)]">
                    Class
                  </span>
                  <span className="font-[var(--font-display)] text-[1.45rem] font-extrabold text-[var(--theme-brand-secondary)]">
                    Hero
                  </span>
                </span>
                <span className="block text-xs font-extrabold text-[var(--theme-brand-secondary)]">
                  {authBrandSlogan}
                </span>
              </span>
            </Link>

            {showBackLink ? (
              <Link
                href="/login"
                className="theme-button-subtle hidden min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-extrabold backdrop-blur transition hover:-translate-y-0.5 sm:inline-flex"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Đăng nhập
              </Link>
            ) : null}
          </div>

          <div className="relative z-20 mt-10 max-w-none sm:mt-16 sm:max-w-[22rem] lg:mt-20 lg:max-w-[24rem] xl:mt-24 xl:max-w-[30rem]">
            <h1 className="font-[var(--font-display)] text-[2.45rem] font-extrabold leading-[1.02] text-[var(--theme-text-strong)] sm:text-5xl lg:text-6xl xl:text-7xl">
              <span className="block whitespace-nowrap">{currentTheme.titleFirst}</span>
              <span className="block whitespace-nowrap text-[var(--auth-accent,var(--theme-primary))]">
                {currentTheme.titleSecond}
              </span>
            </h1>
            <p className="mt-5 max-w-[50%] text-sm font-extrabold leading-6 text-[var(--theme-text)] sm:max-w-[22rem] lg:max-w-none lg:whitespace-nowrap lg:text-lg lg:leading-7 xl:max-w-none">
              {currentTheme.description}
            </p>
          </div>

          <div
            className={`theme-auth-blob pointer-events-none absolute bottom-3 right-0 z-0 h-36 w-64 rounded-[50%] opacity-90 blur-sm sm:h-44 sm:w-72 ${
              currentTheme.illustration === "student"
                ? "lg:bottom-[6.75rem] lg:right-7 lg:h-56 lg:w-[24rem] xl:bottom-[8rem] xl:h-64 xl:w-[27rem]"
                : "lg:bottom-4 lg:right-7 lg:h-56 lg:w-[24rem] xl:bottom-5 xl:h-64 xl:w-[27rem]"
            }`}
            aria-hidden="true"
          />
          <img
            src={currentTheme.illustrationSrc}
            alt=""
            className={`pointer-events-none absolute z-10 object-contain ${
              currentTheme.illustration === "login"
                ? "bottom-0 right-[-1rem] h-[15.2rem] w-[17.1rem] sm:right-[-2rem] sm:h-[20rem] sm:w-[22rem] lg:bottom-4 lg:right-3 lg:h-[24rem] lg:w-[26rem] xl:bottom-5 xl:right-3 xl:h-[26rem] xl:w-[29rem]"
                : currentTheme.illustration === "parent"
                  ? "bottom-0 right-0 h-56 w-64 sm:h-[18rem] sm:w-[20rem] lg:bottom-4 lg:right-7 lg:h-[21rem] lg:w-[24rem] xl:bottom-5 xl:right-9 xl:h-[23rem] xl:w-[26rem]"
                  : currentTheme.illustration === "student"
                    ? "bottom-0 right-0 h-56 w-56 sm:h-[18rem] sm:w-[18rem] lg:bottom-[7rem] lg:right-[2.125rem] lg:h-[21rem] lg:w-[21rem] xl:bottom-[8.75rem] xl:right-9 xl:h-[23rem] xl:w-[23rem]"
                    : "bottom-0 right-0 h-56 w-56 sm:h-[18rem] sm:w-[18rem] lg:bottom-4 lg:right-7 lg:h-[21rem] lg:w-[21rem] xl:bottom-5 xl:right-9 xl:h-[23rem] xl:w-[23rem]"
            }`}
          />
        </div>

        <div className="relative z-20 -mt-12 px-5 pb-5 sm:px-7 sm:pb-7 lg:mt-0 lg:flex lg:min-h-full lg:items-center lg:justify-center lg:bg-[var(--theme-surface)] lg:px-10 lg:py-10 xl:px-14">
          <div className="theme-form-shell w-full rounded-[1.7rem] p-5 backdrop-blur sm:p-6 lg:max-w-[39rem] lg:p-8 xl:p-10">
            <AuthDevHydrationBoundary>{children}</AuthDevHydrationBoundary>
          </div>
        </div>
      </section>
    </main>
  );
}
