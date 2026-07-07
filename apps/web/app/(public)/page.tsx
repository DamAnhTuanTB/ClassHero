export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
        Learning path MVP
      </p>
      <h1 className="mt-4 text-4xl font-semibold text-slate-950">
        Hệ thống học theo lộ trình
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-slate-700">
        Nền Next.js App Router đã sẵn sàng cho các màn hình public,
        student, parent và admin trong các subtask tiếp theo.
      </p>
    </main>
  );
}
