import { HomeAuthActions } from "@/features/public-home/components/home-auth-actions";

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
      <HomeAuthActions />
    </main>
  );
}
