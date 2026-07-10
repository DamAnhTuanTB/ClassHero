import { Eye, Plus } from "lucide-react";

export function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
      <Eye className="mx-auto h-9 w-9 text-slate-400" aria-hidden="true" />
      <h2 className="mt-3 text-lg font-extrabold text-slate-950">
        Không có lộ trình phù hợp
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
        Thử đổi bộ lọc hoặc tạo lộ trình mới cho môn và lớp đang cần nhập nội dung.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 text-sm font-extrabold text-white transition hover:bg-sky-700"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Thêm lộ trình
      </button>
    </div>
  );
}
