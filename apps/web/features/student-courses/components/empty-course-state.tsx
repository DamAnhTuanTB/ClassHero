import { SearchX } from "lucide-react";

export function EmptyCourseState({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-dashed border-[var(--theme-border-strong)] bg-[var(--theme-surface)] p-5 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]">
        <SearchX className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="mt-3 text-base font-extrabold text-[var(--theme-text-strong)]">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--theme-text-muted)]">
        {description}
      </p>
    </section>
  );
}
