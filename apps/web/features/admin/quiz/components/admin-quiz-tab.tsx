import { useState } from "react";
import { useAdminQuizSets, useAdminQuizSetMutations } from "../hooks/use-admin-quiz";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { AdminQuizQuestionsModal } from "./admin-quiz-questions-modal";
import { cn } from "@/lib/utils";

interface AdminQuizTabProps {
  lessonId: string;
}

export function AdminQuizTab({ lessonId }: AdminQuizTabProps) {
  const { data: quizSets, isLoading } = useAdminQuizSets(lessonId);
  const { createSet, deleteSet } = useAdminQuizSetMutations(lessonId);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--theme-text-muted)]" />
      </div>
    );
  }

  const handleCreateSet = async () => {
    try {
      setIsCreating(true);
      await createSet.mutateAsync({
        title: `Quiz Set ${quizSets ? quizSets.length + 1 : 1}`,
        difficulty: "MIXED",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-[var(--theme-text-strong)]">Quản lý Quiz</h3>
          <p className="text-sm font-medium text-[var(--theme-text-muted)] mt-1">
            Tạo và quản lý các bộ câu hỏi trắc nghiệm cho bài học này.
          </p>
        </div>
        <button 
          onClick={handleCreateSet} 
          disabled={isCreating}
          className="theme-button-primary inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold transition disabled:opacity-50"
        >
          {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Thêm bộ câu hỏi
        </button>
      </div>

      {!quizSets?.length ? (
        <div className="rounded-xl border-2 border-dashed border-[var(--theme-border)] bg-[var(--theme-bg-subtle)]">
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-[var(--theme-text-muted)] font-medium text-sm mb-4">Chưa có bộ câu hỏi nào</p>
            <button 
              onClick={handleCreateSet} 
              disabled={isCreating}
              className="theme-button-primary-subtle inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold transition disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Tạo bộ câu hỏi đầu tiên
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {quizSets.map((set) => (
            <div key={set.id} className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] shadow-sm">
              <div className="flex flex-row items-center justify-between p-4">
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-[var(--theme-text-strong)]">{set.title}</h4>
                  <div className="text-sm font-medium text-[var(--theme-text-muted)] flex items-center gap-2">
                    {set._count?.questions || 0} câu hỏi • Mức độ: 
                    <span className="rounded-full border border-[var(--theme-border)] px-2 py-0.5 text-xs font-bold text-[var(--theme-text-strong)]">
                      {set.difficulty}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setSelectedSetId(set.id)}
                    className="theme-button-primary-subtle inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition"
                  >
                    Quản lý câu hỏi
                  </button>
                  <button 
                    className="theme-button-danger-subtle inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition"
                    onClick={() => {
                      if (confirm("Bạn có chắc muốn xóa bộ câu hỏi này?")) {
                        deleteSet.mutate(set.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <AdminQuizQuestionsModal
        setId={selectedSetId}
        lessonId={lessonId}
        onClose={() => setSelectedSetId(null)}
      />
    </div>
  );
}
