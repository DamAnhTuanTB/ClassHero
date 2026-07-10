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
      <section className="grid gap-4">
        <div className="pr-14">
          <h2 className="text-lg font-extrabold text-slate-950">
            Lộ trình lưu trữ
          </h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Khôi phục lộ trình để đưa về danh sách chính.
          </p>
        </div>

        {paths.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-lg bg-white text-slate-500 ring-1 ring-slate-200">
              <Trash2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="mt-3 text-sm font-extrabold text-slate-900">
              Chưa có lộ trình lưu trữ
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm font-extrabold text-slate-800">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                Chọn tất cả
              </label>
              {selectedPathIds.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={restoreSelected}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 text-sm font-extrabold text-emerald-700 transition hover:bg-emerald-50"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Khôi phục ({selectedPathIds.length})
                  </button>
                  <button
                    type="button"
                    onClick={deleteSelected}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-3 text-sm font-extrabold text-rose-700 transition hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Xóa vĩnh viễn ({selectedPathIds.length})
                  </button>
                </div>
              ) : null}
            </div>
            {paths.map((path) => (
              <article
                key={path.id}
                className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
              >
                <label
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-slate-50"
                  aria-label={`Chọn ${path.title}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedPathIds.includes(path.id)}
                    onChange={() => togglePath(path.id)}
                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                </label>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-extrabold text-slate-950">
                      {path.title}
                    </p>
                    <StatusBadge status={path.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
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
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-extrabold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Khôi phục
                  </button>
                  <button
                    type="button"
                    onClick={() => onPermanentDelete([path.id])}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm font-extrabold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Xóa vĩnh viễn
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </EditorDialogShell>
  );
}
