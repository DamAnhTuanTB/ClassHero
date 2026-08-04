import {
  ArrowLeft,
  BookOpen,
  CircleAlert,
  Home,
  RefreshCcw,
} from "lucide-react";
import Link from "next/link";
import { ClassHeroLogo } from "@/components/common/brand/classhero-logo";
import type { AppThemeMode } from "@/lib/theme-store";
import { cn } from "@/lib/utils";

type StudentErrorActionIcon = "back" | "book" | "home" | "retry";

type StudentErrorActionBase = {
  icon?: StudentErrorActionIcon;
  label: string;
  pending?: boolean;
  tone?: "primary" | "secondary";
};

export type StudentErrorAction =
  | (StudentErrorActionBase & {
      href: string;
      onClick?: never;
    })
  | (StudentErrorActionBase & {
      href?: never;
      onClick: () => unknown;
    });

export function StudentDataErrorState({
  className,
  description,
  initialThemeMode,
  primaryAction,
  secondaryAction,
  title,
  variant = "page",
}: {
  className?: string;
  description: string;
  initialThemeMode?: AppThemeMode;
  primaryAction?: StudentErrorAction;
  secondaryAction?: StudentErrorAction;
  title: string;
  variant?: "compact" | "page" | "section";
}) {
  const actions = [primaryAction, secondaryAction].filter(
    (action): action is StudentErrorAction => Boolean(action),
  );
  const content = (
    <section
      role="alert"
      className={cn(
        "w-full border border-rose-200 bg-white text-center shadow-[0_18px_50px_-42px_rgb(225_29_72_/_45%)] dark:border-rose-400/20 dark:bg-[var(--theme-surface)]",
        variant === "page" &&
          "max-w-xl rounded-[1.75rem] px-5 py-8 shadow-lg sm:px-8 sm:py-10",
        variant === "section" &&
          "flex min-h-56 flex-col items-center justify-center rounded-[1.5rem] px-5 py-8 sm:px-8",
        variant === "compact" &&
          "flex min-h-44 flex-col items-center justify-center rounded-2xl px-4 py-6 sm:px-6",
        className,
      )}
    >
      {variant === "page" ? (
        <ClassHeroLogo
          className="mx-auto mb-6 h-14 max-w-[14rem] sm:h-16"
          priority
        />
      ) : null}

      <span
        className={cn(
          "mx-auto grid place-items-center border border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-400/20 dark:bg-rose-500/15 dark:text-rose-300",
          variant === "page"
            ? "h-20 w-20 rounded-3xl"
            : "h-12 w-12 rounded-2xl",
        )}
      >
        <CircleAlert
          className={variant === "page" ? "h-10 w-10" : "h-6 w-6"}
          aria-hidden="true"
        />
      </span>

      <p
        role="heading"
        aria-level={variant === "page" ? 1 : 2}
        className={cn(
          "font-black text-slate-950 dark:text-[var(--theme-text-strong)]",
          variant === "page"
            ? "mt-5 text-xl sm:text-2xl"
            : "mt-4 text-base sm:text-lg",
        )}
      >
        {title}
      </p>
      <p
        className={cn(
          "mx-auto max-w-md font-medium text-slate-500 dark:text-[var(--theme-text-muted)]",
          variant === "page"
            ? "mt-3 text-sm leading-6 sm:text-base"
            : "mt-2 text-sm leading-6",
        )}
      >
        {description}
      </p>

      {actions.length > 0 ? (
        <div
          className={cn(
            "mt-5 grid w-full max-w-md gap-3",
            actions.length > 1 && "sm:grid-cols-2",
          )}
        >
          {actions.map((action) => (
            <StudentErrorActionControl
              key={`${action.label}-${"href" in action ? action.href : "button"}`}
              action={action}
            />
          ))}
        </div>
      ) : null}
    </section>
  );

  if (variant !== "page") return content;

  return (
    <main
      className="fixed inset-0 z-[9999] flex min-h-dvh overflow-y-auto px-4 py-6 sm:px-6 sm:py-8"
      data-theme={initialThemeMode}
      style={{ background: "var(--student-screen-bg)" }}
    >
      <div className="my-auto mx-auto w-full max-w-xl">{content}</div>
    </main>
  );
}

function StudentErrorActionControl({ action }: { action: StudentErrorAction }) {
  const Icon = getStudentErrorActionIcon(action.icon);
  const className = cn(
    "inline-flex min-h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-black text-white focus-visible:outline-none focus-visible:ring-4 disabled:cursor-wait disabled:opacity-70",
    action.tone === "secondary"
      ? "student-learn-cta-3d-emerald bg-emerald-500 hover:bg-emerald-400 focus-visible:ring-emerald-200 dark:focus-visible:ring-emerald-500/30"
      : "student-learn-cta-3d bg-sky-600 hover:bg-sky-500 focus-visible:ring-sky-200 dark:focus-visible:ring-sky-500/30",
  );
  const content = (
    <>
      <Icon
        className={cn("h-4 w-4 shrink-0", action.pending && "animate-spin")}
        aria-hidden="true"
      />
      {action.pending ? "Đang tải lại" : action.label}
    </>
  );

  if (action.href !== undefined) {
    return (
      <Link href={action.href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.pending}
      aria-busy={action.pending || undefined}
      className={cn(className, "cursor-pointer")}
    >
      {content}
    </button>
  );
}

function getStudentErrorActionIcon(icon?: StudentErrorActionIcon) {
  if (icon === "back") return ArrowLeft;
  if (icon === "book") return BookOpen;
  if (icon === "home") return Home;
  return RefreshCcw;
}
