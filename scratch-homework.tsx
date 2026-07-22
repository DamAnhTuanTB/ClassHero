<section className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-3">
  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex items-center gap-2">
      <div className="theme-button-primary-subtle grid h-9 w-9 shrink-0 place-items-center rounded-lg">
        <FilePlus2 className="h-4 w-4" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-extrabold text-[var(--theme-text-strong)]">
        Bài tập về nhà
      </h3>
      <span className="rounded-full bg-[var(--theme-surface)] px-2 py-0.5 text-xs font-extrabold text-[var(--theme-text-muted)]">
        {homeworks.length + newHomeworks.length}
      </span>
    </div>
    <button
      type="button"
      onClick={() => {
        onUpdateRange(item.lesson.id, "newSupplements", [
          ...allNewSupplements,
          { id: crypto.randomUUID(), file: null, title: "", type: "HOMEWORK" },
        ]);
      }}
      disabled={isSaving || homeworks.length + newHomeworks.length >= 1}
      className="theme-button-neutral inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-60"
    >
      <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
      Thêm tài liệu
    </button>
  </div>

  {homeworks.length === 0 && newHomeworks.length === 0 ? (
    <div className="rounded-lg border border-dashed border-[var(--theme-border-strong)] bg-[var(--theme-surface)] px-3 py-4 text-sm font-semibold text-[var(--theme-text-muted)]">
      Chưa thêm bài tập về nhà.
    </div>
  ) : (
    <div className="grid gap-3">
      {homeworks.map((document, index) => {
        return (
          <div
            key={document.id}
            className="grid gap-3 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-3 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,0.85fr)_auto]"
          >
            <label className="block min-w-0">
              <span className="mb-1 block text-xs font-bold text-[var(--theme-text-muted)]">
                Tên tài liệu
              </span>
              <input
                type="text"
                value={document.title ?? document.file.originalName}
                readOnly
                disabled
                className="min-h-11 w-full rounded-lg border border-[var(--theme-input-border)] bg-[var(--theme-input-bg-disabled)] px-3 text-sm font-semibold text-[var(--theme-text-strong)] opacity-70 outline-none cursor-not-allowed"
              />
            </label>

            <div className="min-w-0">
              <span className="mb-1 block text-xs font-bold text-[var(--theme-text-muted)]">
                File tài liệu
              </span>
              <div className="mt-1 flex min-h-11 flex-1 items-center gap-3 rounded-xl border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] px-4 text-sm font-semibold text-[var(--theme-text-strong)] transition">
                <FilePlus2 className="h-5 w-5 shrink-0 text-[var(--theme-text-muted)]" />
                <span className="min-w-0 truncate" title={document.file.originalName}>
                  {document.file.originalName}
                </span>
                {document.status && (
                  <div className="ml-auto flex shrink-0 items-center">
                    <DocumentStatusBadge
                      jobStatus={document.processingJob?.status}
                      progress={document.processingJob?.progress}
                      status={document.status}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 lg:mt-[22px]">
              <button
                type="button"
                disabled={!document.file.publicUrl}
                onClick={() => {
                  if (document.file.publicUrl) {
                    window.open(document.file.publicUrl, "_blank");
                  }
                }}
                className="theme-button-neutral inline-flex h-11 w-11 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Eye className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={isDeletingSupplement}
                onClick={() => onDeleteSupplement(item.lesson.id, document.id)}
                aria-label={`Xóa ${document.title ?? document.file.originalName}`}
                className="theme-button-danger-subtle inline-flex h-11 w-11 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        );
      })}

      {newHomeworks.map((newDoc, index) => (
        <div
          key={newDoc.id}
          className="grid gap-3 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-3 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,0.85fr)_auto]"
        >
          <label className="block min-w-0">
            <span className="mb-1 block text-xs font-bold text-[var(--theme-text-muted)]">
              Tên tài liệu
            </span>
            <input
              type="text"
              value={newDoc.title}
              onChange={(e) => {
                const updated = allNewSupplements.map((doc) =>
                  doc.id === newDoc.id ? { ...doc, title: e.target.value } : doc,
                );
                onUpdateRange(item.lesson.id, "newSupplements", updated);
              }}
              placeholder="Ví dụ: Phiếu bài tập"
              className="min-h-11 w-full rounded-lg border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] px-3 text-sm font-semibold text-[var(--theme-text-strong)] outline-none transition focus:border-[var(--theme-primary)] focus:ring-4 focus:ring-[var(--theme-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>

          <div className="min-w-0">
            <span className="mb-1 block text-xs font-bold text-[var(--theme-text-muted)]">
              File tài liệu
            </span>
            <label className="mt-1 flex min-h-11 flex-1 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] px-4 text-sm font-semibold text-[var(--theme-text-strong)] transition hover:border-[var(--theme-primary)] hover:bg-[var(--theme-surface-hover)] focus-within:border-[var(--theme-primary)] focus-within:ring-4 focus-within:ring-[var(--theme-focus-ring)]">
              <Upload className="h-5 w-5 shrink-0 text-[var(--theme-text-muted)]" />
              <span className="min-w-0 truncate">
                {newDoc.file?.name ?? "Chọn file PDF"}
              </span>
              <input
                type="file"
                accept="application/pdf"
                disabled={isSaving}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  const updated = allNewSupplements.map((doc) =>
                    doc.id === newDoc.id ? { ...doc, file } : doc,
                  );
                  onUpdateRange(item.lesson.id, "newSupplements", updated);
                }}
              />
            </label>
          </div>

          <div className="flex items-center gap-2 lg:mt-[22px]">
            <button
              type="button"
              disabled={!newDoc.file}
              onClick={() => {
                if (newDoc.file) {
                  const objectUrl = URL.createObjectURL(newDoc.file);
                  window.open(objectUrl, "_blank");
                }
              }}
              className="theme-button-neutral inline-flex h-11 w-11 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Eye className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => {
                const updated = allNewSupplements.filter((doc) => doc.id !== newDoc.id);
                onUpdateRange(item.lesson.id, "newSupplements", updated);
              }}
              className="theme-button-danger-subtle inline-flex h-11 w-11 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )}
</section>;
