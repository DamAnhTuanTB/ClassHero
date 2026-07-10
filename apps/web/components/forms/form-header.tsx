export function FormHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="pb-1">
      <div className="mb-3 h-1.5 w-12 rounded-full bg-[linear-gradient(90deg,var(--form-primary,var(--auth-primary,#4f46e5)),var(--form-secondary,var(--auth-secondary,#7c3aed)))]" />
      <h2 className="text-2xl font-extrabold leading-tight text-slate-950 sm:text-3xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
          {description}
        </p>
      ) : null}
    </div>
  );
}
