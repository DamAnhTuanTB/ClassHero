export function AdminStemFigureReferenceImagePreview({
  accessUrl,
  label,
}: {
  accessUrl: string | null;
  label: string;
}) {
  return (
    <div className="flex min-h-44 items-center justify-center bg-white p-3">
      {accessUrl ? (
        <img
          alt={label}
          className="max-h-64 max-w-full object-contain"
          decoding="async"
          loading="lazy"
          src={accessUrl}
        />
      ) : (
        <span className="text-sm text-slate-500">Không tải được preview</span>
      )}
    </div>
  );
}
