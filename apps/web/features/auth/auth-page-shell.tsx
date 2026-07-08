import { ChevronLeft, GraduationCap } from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

type AuthPageShellProps = {
  children: ReactNode;
  maxWidth?: "md" | "lg";
  variant?: "login" | "student" | "parent" | "recovery";
};

type IllustrationType = "login" | "student" | "parent" | "secure";

const theme = {
  login: {
    primary: "#4f46e5",
    secondary: "#7c3aed",
    soft: "from-indigo-50 via-white to-violet-50",
    titleFirst: "Chào mừng bạn",
    titleSecond: "trở lại!",
    titleAccent: "text-indigo-600",
    description: "Đăng nhập để tiếp tục hành trình học tập và chinh phục mục tiêu.",
    illustration: "login" as IllustrationType,
    illustrationSrc: "/images/auth/reference/auth-hero-login-transparent.png",
    badge: "Học thông minh, tiến bộ mỗi ngày",
    blob: "from-indigo-100 via-sky-100 to-violet-100 lg:from-indigo-100 lg:via-sky-100 lg:to-violet-100",
  },
  student: {
    primary: "#0284c7",
    secondary: "#2563eb",
    soft: "from-sky-50 via-white to-blue-50",
    titleFirst: "Tạo tài khoản",
    titleSecond: "học sinh",
    titleAccent: "text-sky-600",
    description: "Điền thông tin để bắt đầu hành trình học thú vị và hiệu quả.",
    illustration: "student" as IllustrationType,
    illustrationSrc: "/images/auth/reference/auth-hero-student-transparent.png",
    badge: "Không gian học tập riêng",
    blob: "from-sky-100 via-cyan-50 to-blue-100 lg:from-sky-100 lg:via-cyan-50 lg:to-blue-100",
  },
  parent: {
    primary: "#059669",
    secondary: "#10b981",
    soft: "from-emerald-50 via-white to-green-50",
    titleFirst: "Tạo tài khoản",
    titleSecond: "phụ huynh",
    titleAccent: "text-emerald-600",
    description: "Theo dõi tiến độ học tập của con mọi lúc, mọi nơi.",
    illustration: "parent" as IllustrationType,
    illustrationSrc: "/images/auth/reference/auth-hero-parent-transparent.png",
    badge: "Đồng hành cùng con",
    blob: "from-emerald-100 via-green-50 to-teal-100 lg:from-emerald-100 lg:via-green-50 lg:to-teal-100",
  },
  recovery: {
    primary: "#0284c7",
    secondary: "#4f46e5",
    soft: "from-sky-50 via-white to-indigo-50",
    titleFirst: "Quay lại lớp",
    titleSecond: "học",
    titleAccent: "text-sky-600",
    description: "Khôi phục tài khoản nhanh để tiếp tục bài học đang chờ.",
    illustration: "secure" as IllustrationType,
    illustrationSrc: "/images/auth/reference/auth-hero-login-transparent.png",
    badge: "An toàn và nhanh gọn",
    blob: "from-sky-100 via-indigo-50 to-blue-100 lg:from-sky-100 lg:via-indigo-50 lg:to-blue-100",
  },
} satisfies Record<
  NonNullable<AuthPageShellProps["variant"]>,
  {
    primary: string;
    secondary: string;
    soft: string;
    titleFirst: string;
    titleSecond: string;
    titleAccent: string;
    description: string;
    illustration: IllustrationType;
    illustrationSrc: string;
    badge: string;
    blob: string;
  }
>;

export function AuthPageShell({
  children,
  maxWidth: _maxWidth = "md",
  variant = "login",
}: AuthPageShellProps) {
  const currentTheme = theme[variant];
  const authStyle = {
    "--auth-primary": currentTheme.primary,
    "--auth-secondary": currentTheme.secondary,
  } as CSSProperties;
  const showBackLink = variant !== "login";

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#f4f6fb] px-3 py-4 text-slate-950 sm:px-6 sm:py-8 lg:px-8"
      style={authStyle}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_12%,rgba(79,70,229,.08),transparent_28%),radial-gradient(circle_at_88%_18%,rgba(16,185,129,.08),transparent_26%)]" />

      <section
        className={`relative mx-auto min-h-[calc(100vh-2rem)] max-w-[560px] overflow-hidden rounded-2xl bg-gradient-to-br ${currentTheme.soft} shadow-xl shadow-slate-900/10 ring-1 ring-slate-200/80 sm:min-h-[calc(100vh-4rem)] lg:grid lg:max-w-[1280px] lg:grid-cols-[1fr_0.94fr] lg:rounded-[2.35rem]`}
      >
        <div className="relative min-h-[24.5rem] px-6 pb-28 pt-6 sm:px-8 sm:pb-28 sm:pt-8 lg:min-h-full lg:px-10 lg:pb-12 lg:pt-10 xl:px-14">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="inline-flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-950/14">
                <GraduationCap className="h-6 w-6" aria-hidden="true" />
              </span>
              <span>
                <span className="inline-flex items-baseline leading-none tracking-normal">
                  <span className="font-[var(--font-display)] text-[1.45rem] font-extrabold text-blue-700">
                    Class
                  </span>
                  <span className="font-[var(--font-display)] text-[1.45rem] font-extrabold text-sky-600">
                    Hero
                  </span>
                </span>
                <span className="block text-xs font-semibold text-slate-500">
                  {currentTheme.badge}
                </span>
              </span>
            </Link>

            {showBackLink ? (
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white/80 px-4 text-sm font-extrabold text-slate-500 shadow-sm ring-1 ring-slate-200/80 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white hover:text-[var(--auth-primary)] hover:shadow-md"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Quay lại đăng nhập
              </Link>
            ) : null}
          </div>

          <div className="relative z-20 mt-12 max-w-[15.25rem] sm:mt-16 sm:max-w-[22rem] lg:mt-20 lg:max-w-[24rem] xl:mt-24 xl:max-w-[30rem]">
            <h1 className="font-[var(--font-display)] text-[2.45rem] font-extrabold leading-[1.02] text-slate-950 sm:text-5xl lg:text-6xl xl:text-7xl">
              <span className="block whitespace-nowrap">{currentTheme.titleFirst}</span>
              <span className={`block whitespace-nowrap ${currentTheme.titleAccent}`}>
                {currentTheme.titleSecond}
              </span>
            </h1>
            <p className="mt-5 max-w-[13.75rem] text-sm font-semibold leading-6 text-slate-600 sm:max-w-[22rem] lg:max-w-[18rem] lg:text-base lg:leading-7 xl:max-w-[20rem]">
              {currentTheme.description}
            </p>
          </div>

          <div
            className={`pointer-events-none absolute bottom-3 right-0 z-0 h-36 w-64 rounded-[50%] bg-gradient-to-br ${currentTheme.blob} opacity-90 blur-sm sm:h-44 sm:w-72 lg:bottom-4 lg:right-7 lg:h-56 lg:w-[24rem] xl:bottom-5 xl:h-64 xl:w-[27rem]`}
            aria-hidden="true"
          />
          <img
            src={currentTheme.illustrationSrc}
            alt=""
            className={`pointer-events-none absolute right-0 z-10 object-contain lg:right-7 xl:right-9 ${
              currentTheme.illustration === "parent"
                ? "bottom-0 h-56 w-64 sm:h-[18rem] sm:w-[20rem] lg:bottom-4 lg:h-[21rem] lg:w-[24rem] xl:bottom-5 xl:h-[23rem] xl:w-[26rem]"
                : currentTheme.illustration === "student"
                  ? "bottom-4 h-56 w-56 sm:bottom-5 sm:h-[18rem] sm:w-[18rem] lg:bottom-12 lg:h-[21rem] lg:w-[21rem] xl:bottom-14 xl:h-[23rem] xl:w-[23rem]"
                  : "bottom-0 h-56 w-56 sm:h-[18rem] sm:w-[18rem] lg:bottom-4 lg:h-[21rem] lg:w-[21rem] xl:bottom-5 xl:h-[23rem] xl:w-[23rem]"
            }`}
          />
        </div>

        <div className="relative z-20 -mt-12 px-5 pb-5 sm:px-7 sm:pb-7 lg:mt-0 lg:flex lg:min-h-full lg:items-center lg:justify-center lg:bg-white lg:px-10 lg:py-10 xl:px-14">
          <div className="w-full rounded-[1.7rem] bg-white/94 p-5 shadow-xl shadow-slate-900/10 ring-1 ring-slate-200/80 backdrop-blur sm:p-6 lg:max-w-[39rem] lg:bg-transparent lg:p-0 lg:shadow-none lg:ring-0">
            {children}
          </div>
        </div>
      </section>
    </main>
  );
}
