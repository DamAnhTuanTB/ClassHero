export function StudentCourseDetailHeroArt({
  thumbnailImageUrl,
  title,
}: {
  thumbnailImageUrl?: string;
  title: string;
}) {
  if (thumbnailImageUrl) {
    return (
      <div className="student-course-detail-hero-art relative min-h-[14.5rem] overflow-hidden rounded-[1.15rem] bg-slate-100 dark:bg-[var(--theme-surface-muted)]">
        <img
          src={thumbnailImageUrl}
          alt={`Ảnh khóa học ${title}`}
          decoding="async"
          loading="eager"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className="student-course-detail-hero-art relative min-h-[14.5rem] overflow-hidden rounded-[1.15rem] bg-gradient-to-br from-blue-500 via-sky-500 to-cyan-400 text-white dark:from-sky-900 dark:via-blue-950 dark:to-cyan-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_16%,rgb(255_255_255_/_40%)_0_0.38rem,transparent_0.42rem),radial-gradient(circle_at_74%_14%,rgb(255_255_255_/_56%)_0_0.22rem,transparent_0.25rem),radial-gradient(circle_at_94%_52%,rgb(255_255_255_/_11%)_0_3.8rem,transparent_3.9rem)]" />
      <div className="absolute left-8 top-7 text-4xl font-light italic leading-none opacity-90">
        <span className="block">a</span>
        <span className="mt-1 block h-px w-12 bg-white/85" />
        <span className="block">b</span>
      </div>
      <div className="absolute left-[9.25rem] top-11 text-3xl font-semibold opacity-90">
        =
      </div>
      <div className="absolute left-[12rem] top-7 text-4xl font-light italic leading-none opacity-90">
        <span className="block">c</span>
        <span className="mt-1 block h-px w-12 bg-white/85" />
        <span className="block">d</span>
      </div>
      <div className="absolute left-8 top-[8.2rem] h-20 w-28 border-b-2 border-l-2 border-white/90">
        <span className="absolute -right-2 bottom-[-0.4rem] text-2xl font-bold">x</span>
        <span className="absolute -left-2 -top-5 text-2xl font-bold">y</span>
        <span className="absolute left-4 top-10 h-1 w-28 -rotate-35 rounded-full bg-white/90" />
      </div>
      <p className="absolute left-[13rem] top-[8.5rem] text-3xl font-semibold">
        x + y = 12
      </p>
      <span className="absolute right-[17rem] top-8 text-4xl font-black text-amber-300 drop-shadow">
        π
      </span>
      <span className="absolute right-[21rem] top-10 text-4xl text-amber-300 drop-shadow">
        ★
      </span>
      <div className="absolute bottom-0 right-[7.25rem] h-[10.7rem] w-[11rem] rounded-t-[1.45rem] bg-gradient-to-br from-cyan-200 via-sky-500 to-blue-700 shadow-2xl ring-1 ring-white/30">
        <div className="absolute inset-x-3 top-4 h-2 rounded-full bg-white/55" />
        <div className="absolute inset-x-4 top-11 text-center text-3xl font-black tracking-wide">
          TOÁN
        </div>
        <div className="absolute inset-x-0 top-[4.5rem] text-center text-7xl font-black drop-shadow">
          7
        </div>
      </div>
      <div className="absolute bottom-2 right-[5.75rem] h-28 w-6 rotate-12 rounded-full bg-gradient-to-b from-yellow-200 via-yellow-400 to-orange-400 shadow-lg" />
      <div className="absolute bottom-4 right-[13rem] h-28 w-20 rotate-[-12deg] border-b-[6.5rem] border-l-[2rem] border-r-[2rem] border-b-amber-300 border-l-transparent border-r-transparent opacity-95" />
      <div className="absolute bottom-2 right-4 h-24 w-20 rotate-3 rounded-2xl bg-gradient-to-br from-orange-200 to-rose-400 p-2 shadow-xl">
        <div className="mb-2 h-7 rounded-md bg-cyan-100/80 text-right text-sm font-bold text-cyan-700">
          123
        </div>
        <div className="grid grid-cols-3 gap-1">
          {Array.from({ length: 9 }, (_, index) => (
            <span key={index} className="h-3 rounded-sm bg-white/82" />
          ))}
        </div>
      </div>
    </div>
  );
}
