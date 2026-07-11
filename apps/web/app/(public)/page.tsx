import Link from "next/link";

export default function HomePage() {
  return (
    <main className="theme-page mx-auto flex max-w-5xl flex-col justify-center px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-[var(--theme-text-muted)]">
        Learning path MVP
      </p>
      <h1 className="mt-4 text-4xl font-semibold text-[var(--theme-text-strong)]">
        Hệ thống học theo lộ trình
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--theme-text)]">
        Nền Next.js App Router đã sẵn sàng cho các màn hình public, student, parent và
        admin trong các subtask tiếp theo.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--theme-primary)] px-4 text-sm font-semibold text-[var(--theme-primary-foreground)] transition hover:bg-[var(--theme-primary-hover)]"
        >
          Đăng nhập
        </Link>
        <Link
          href="/register/student"
          className="theme-button-subtle inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold transition"
        >
          Đăng ký học sinh
        </Link>
        <Link
          href="/register/parent"
          className="theme-button-subtle inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold transition"
        >
          Đăng ký phụ huynh
        </Link>
      </div>
    </main>
  );
}
