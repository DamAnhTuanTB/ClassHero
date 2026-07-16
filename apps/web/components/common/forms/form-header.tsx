export function FormHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="pb-1">
      <div className="mb-3 h-1.5 w-12 rounded-full bg-[linear-gradient(90deg,var(--form-primary,var(--auth-primary,var(--theme-primary))),var(--form-secondary,var(--auth-secondary,var(--theme-primary-hover))))]" />
      <h2 className="text-2xl font-extrabold leading-tight text-[var(--theme-text-strong)] sm:text-3xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 text-sm font-semibold leading-6 text-[var(--theme-text-muted)]">
          {description}
        </p>
      ) : null}
    </div>
  );
}
