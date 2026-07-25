import { useState } from "react";
import { useAdminQuizQuestions, useAdminQuizQuestionMutations } from "../hooks/use-admin-quiz";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";

interface AdminQuizQuestionsModalProps {
  setId: string | null;
  lessonId: string;
  onClose: () => void;
}

export function AdminQuizQuestionsModal({ setId, lessonId, onClose }: AdminQuizQuestionsModalProps) {
  const { data: questions, isLoading } = useAdminQuizQuestions(setId || "");
  const { createQuestion, deleteQuestion } = useAdminQuizQuestionMutations(setId || "", lessonId);
  const [isCreating, setIsCreating] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState("");

  if (!setId) return null;

  const handleCreateQuestion = async () => {
    if (!newQuestionText.trim()) return;
    try {
      setIsCreating(true);
      await createQuestion.mutateAsync({
        questionType: "MULTIPLE_CHOICE",
        difficulty: "MEDIUM",
        questionJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: newQuestionText }] }] },
        explanation: "",
        scoreWeight: 1,
      });
      setNewQuestionText("");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <EditorDialogShell
      isOpen={!!setId}
      onClose={onClose}
      ariaLabel="Quản lý câu hỏi"
    >
      <div className="flex flex-col gap-6 py-4">
        <div className="px-6 pt-6">
          <h2 className="text-xl font-bold text-[var(--theme-text-strong)]">Quản lý câu hỏi</h2>
          <p className="text-sm font-medium text-[var(--theme-text-muted)] mt-1">
            Thêm, sửa, xóa các câu hỏi trong bộ câu hỏi này
          </p>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--theme-text-muted)]" />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-subtle)] p-4 space-y-4">
              <h4 className="text-sm font-bold text-[var(--theme-text-strong)]">Thêm câu hỏi mới</h4>
              <textarea
                value={newQuestionText}
                onChange={(e) => setNewQuestionText(e.target.value)}
                placeholder="Nhập nội dung câu hỏi..."
                className="flex min-h-[80px] w-full rounded-md border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2 text-sm text-[var(--theme-text-strong)] placeholder-[var(--theme-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]"
              />
              <button 
                onClick={handleCreateQuestion} 
                disabled={isCreating || !newQuestionText.trim()}
                className="theme-button-primary inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold transition disabled:opacity-50"
              >
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Thêm câu hỏi
              </button>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-bold text-[var(--theme-text-strong)]">Danh sách câu hỏi ({questions?.length || 0})</h4>
              {!questions?.length ? (
                <div className="rounded-xl border-2 border-dashed border-[var(--theme-border)] py-8 text-center text-[var(--theme-text-muted)] text-sm font-medium">
                  Chưa có câu hỏi nào trong bộ này
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {questions.map((q, index) => (
                    <div key={q.id} className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-4 shadow-sm flex items-start justify-between gap-4">
                      <div>
                        <div className="font-bold text-sm text-[var(--theme-text-strong)] mb-1">Câu {index + 1}</div>
                        <div className="text-sm text-[var(--theme-text)] whitespace-pre-wrap">
                          {/* Fallback to render simple text from JSON */}
                          {q.questionJson?.content?.[0]?.content?.[0]?.text || "Không có nội dung"}
                        </div>
                      </div>
                      <button 
                        className="theme-button-danger-subtle shrink-0 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition"
                        onClick={() => {
                          if (confirm("Bạn có chắc muốn xóa câu hỏi này?")) {
                            deleteQuestion.mutate(q.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </EditorDialogShell>
  );
}
