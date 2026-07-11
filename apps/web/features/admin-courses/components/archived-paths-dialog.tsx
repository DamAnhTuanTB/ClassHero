"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge, StatusBadge } from "@/features/admin-courses/components/badges";
import { EditorDialogShell } from "@/features/admin-courses/components/editor-dialog-shell";
import { subjectLabels, type AdminLearningPath } from "@/features/admin-courses/data";
import { formatDateTime, formatPrice } from "@/features/admin-courses/utils";

export function ArchivedPathsDialog({
  isOpen,
  paths,
  onClose,
  onPermanentDelete,
  onRestore,
}: {
  isOpen: boolean;
  paths: AdminLearningPath[];
  onClose: () => void;
  onPermanentDelete: (pathIds: string[]) => void;
  onRestore: (pathIds: string[]) => void;
}) {
  const [selectedPathIds, setSelectedPathIds] = useState<string[]>([]);
  const allPathIds = useMemo(() => paths.map((path) => path.id), [paths]);
  const allSelected = paths.length > 0 && selectedPathIds.length === paths.length;

  useEffect(() => {
    setSelectedPathIds((current) =>
      current.filter((pathId) => allPathIds.includes(pathId)),
    );
  }, [allPathIds]);

  function togglePath(pathId: string) {
    setSelectedPathIds((current) =>
      current.includes(pathId)
        ? current.filter((selectedId) => selectedId !== pathId)
        : [...current, pathId],
    );
  }

  function toggleAll() {
    setSelectedPathIds(allSelected ? [] : allPathIds);
  }

  function restoreSelected() {
    onRestore(selectedPathIds);
    setSelectedPathIds([]);
  }

  function deleteSelected() {
    onPermanentDelete(selectedPathIds);
  }

  return (
    <EditorDialogShell
      ariaLabel="Lộ trình lưu trữ"
      isOpen={isOpen}
      onClose={onClose}
    >
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="theme-dialog-header shrink-0 px-4 py-3 pr-20 sm:px-5 sm:py-3 sm:pr-20">
          <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
            Lộ trình lưu trữ
          </h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {paths.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-5 text-center">
              <div className="mx-auto grid h-11 w-11 place-items-center rounded-lg bg-[var(--theme-surface)] text-[var(--theme-text-muted)] ring-1 ring-[var(--theme-border)]">
                <Trash2 className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="mt-3 text-sm font-extrabold text-[var(--theme-text-strong)]">
                Chưa có lộ trình lưu trữ
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm font-extrabold text-[var(--theme-text-strong)]">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="admin-theme-checkbox"
                />
                Chọn tất cả
              </label>
              {paths.map((path) => (
                <article
                  key={path.id}
                  className="grid gap-3 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
                >
                  <label
                    className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)]"
                    aria-label={`Chọn ${path.title}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPathIds.includes(path.id)}
                      onChange={() => togglePath(path.id)}
                      className="admin-theme-checkbox"
                    />
                  </label>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className="truncate text-sm font-extrabold text-[var(--theme-text-strong)]"
                      >
                        {path.title}
                      </p>
                      <StatusBadge status={path.status} />
                    </div>
                    <div
                      className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-[var(--theme-text-muted)]"
                    >
                      <Badge>{subjectLabels[path.subject]}</Badge>
                      <Badge>Lớp {path.grade}</Badge>
                      <Badge>{formatPrice(path.salePriceVnd ?? path.originalPriceVnd)}</Badge>
                      <Badge>Cập nhật {formatDateTime(path.updatedAt)}</Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onRestore([path.id])}
                      className="theme-button-success-subtle inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-extrabold transition"
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      Khôi phục
                    </button>
                    <button
                      type="button"
                      onClick={() => onPermanentDelete([path.id])}
                      className="theme-button-danger-subtle inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-extrabold transition"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Xóa vĩnh viễn
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="theme-dialog-footer shrink-0 p-3 sm:p-4">
          {selectedPathIds.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="theme-button-neutral col-span-2 inline-flex min-h-11 min-w-0 items-center justify-center whitespace-nowrap rounded-lg px-4 text-center text-sm font-extrabold transition sm:col-span-1 sm:w-auto"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={restoreSelected}
                className="theme-button-success inline-flex min-h-11 min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-2 text-center text-xs font-extrabold leading-5 transition sm:w-auto sm:px-4 sm:text-sm"
              >
                <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
                Khôi phục ({selectedPathIds.length})
              </button>
              <button
                type="button"
                onClick={deleteSelected}
                className="theme-button-danger inline-flex min-h-11 min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-2 text-center text-xs font-extrabold leading-5 transition sm:w-auto sm:px-4 sm:text-sm"
              >
                <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                Xóa vĩnh viễn ({selectedPathIds.length})
              </button>
            </div>
          ) : (
            <div className="sm:flex sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="theme-button-neutral inline-flex min-h-11 w-full items-center justify-center whitespace-nowrap rounded-lg px-4 text-sm font-extrabold transition sm:w-auto"
              >
                Hủy
              </button>
            </div>
          )}
        </div>
      </section>
    </EditorDialogShell>
  );
}
