import Link from "next/link";

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
        Nền Next.js App Router đã sẵn sàng cho các màn hình public, student, parent và
        admin trong các subtask tiếp theo.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white transition hover:bg-sky-700"
        >
          Đăng nhập
        </Link>
        <Link
          href="/register/student"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:border-sky-200 hover:text-sky-700"
        >
          Đăng ký học sinh
        </Link>
        <Link
          href="/register/parent"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:border-sky-200 hover:text-sky-700"
        >
          Đăng ký phụ huynh
        </Link>
      </div>
    </main>
  );
}
