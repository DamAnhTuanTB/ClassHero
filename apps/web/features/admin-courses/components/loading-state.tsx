export function LoadingState() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4">
        <div className="h-11 rounded-lg bg-[var(--theme-surface-soft)]" />
        <div className="mt-4 grid gap-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-20 rounded-lg bg-[var(--theme-surface-soft)]" />
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4">
        <div className="h-6 w-40 rounded bg-[var(--theme-surface-soft)]" />
        <div className="mt-4 grid gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-11 rounded-lg bg-[var(--theme-surface-soft)]" />
          ))}
        </div>
      </div>
    </div>
  );
}
