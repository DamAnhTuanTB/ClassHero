export function LoadingState() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="h-11 rounded-lg bg-slate-100" />
        <div className="mt-4 grid gap-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-20 rounded-lg bg-slate-100" />
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="h-6 w-40 rounded bg-slate-100" />
        <div className="mt-4 grid gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-11 rounded-lg bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
