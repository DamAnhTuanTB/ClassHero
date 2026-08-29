"use client";

import { ImagePlus, Plus, Shapes } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";

import type {
  AdminQuizFigureAiTargetMode,
  AdminQuizQuestion,
} from "@/features/admin/quiz/api/admin-quiz-api";
import { cn } from "@/lib/utils";

const AiDialog = dynamic(
  () =>
    import("@/features/admin/quiz/components/admin-quiz-figure-ai-dialog").then(
      (module) => module.AdminQuizFigureAiDialog,
    ),
  { ssr: false },
);

const ACTIVE_STATUSES = new Set(["QUEUED", "RENDERING", "REPAIRING"]);

export function AdminQuizQuestionFigureAiMenu({
  hasSolutionText,
  question,
  setId,
}: {
  hasSolutionText: boolean;
  question: AdminQuizQuestion;
  setId: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 16 });
  const [targetMode, setTargetMode] = useState<AdminQuizFigureAiTargetMode | null>(null);
  const questionFigure =
    question.figures.find((figure) => figure.role === "QUESTION") ?? null;
  const solutionFigure =
    question.figures.find((figure) => figure.role === "SOLUTION") ?? null;
  const activeSolutionTargetMode = solutionFigure?.pendingAiTargetMode ?? null;

  useEffect(() => {
    if (!isOpen) return;
    const updatePosition = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuPosition({
        top: rect.bottom + 8,
        right: Math.max(16, window.innerWidth - rect.right),
      });
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    updatePosition();
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  const options: FigureAiMenuOption[] = [
    {
      targetMode: "QUESTION",
      label: "Tạo hình cho đề bài",
      description: "Sinh một hình mới từ nội dung đề hiện tại.",
      icon: Plus,
      disabledReason: activeReason(questionFigure?.status),
    },
    {
      targetMode: "SOLUTION",
      label: "Tạo hình cho lời giải",
      description: "Tạo một hình hoàn chỉnh mới từ đề bài và lời giải.",
      icon: Shapes,
      disabledReason: !hasSolutionText
        ? "Cần có lời giải bằng chữ trước."
        : solutionActiveReason(
            solutionFigure?.status,
            activeSolutionTargetMode,
            "SOLUTION",
          ),
    },
  ];

  return (
    <>
      <div className="relative" ref={rootRef}>
        <button
          aria-expanded={isOpen}
          aria-haspopup="menu"
          aria-label="Tạo hình mới bằng AI"
          className="theme-button-primary-subtle grid h-10 w-10 place-items-center rounded-lg"
          onClick={() => setIsOpen((current) => !current)}
          title="Tạo hình mới bằng AI"
          type="button"
        >
          <ImagePlus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              aria-label="Chọn chế độ tạo hình AI"
              className="fixed z-[90] w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-1.5 shadow-xl"
              ref={menuRef}
              role="menu"
              style={{ right: menuPosition.right, top: menuPosition.top }}
            >
              {options.map((option) => {
                const Icon = option.icon;
                const disabled = Boolean(option.disabledReason);
                return (
                  <button
                    aria-disabled={disabled}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition",
                      disabled
                        ? "cursor-not-allowed opacity-55"
                        : "hover:bg-[var(--theme-primary-soft)] focus-visible:bg-[var(--theme-primary-soft)]",
                    )}
                    disabled={disabled}
                    key={option.targetMode}
                    onClick={() => {
                      setIsOpen(false);
                      setTargetMode(option.targetMode);
                    }}
                    role="menuitem"
                    type="button"
                  >
                    <span className="theme-button-primary-subtle mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-extrabold text-[var(--theme-text-strong)]">
                        {option.label}
                      </span>
                      <span className="mt-0.5 block whitespace-normal break-words text-xs leading-5 text-[var(--theme-text-muted)]">
                        {option.disabledReason ?? option.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
      {targetMode ? (
        <AiDialog
          figure={targetMode === "QUESTION" ? questionFigure : solutionFigure}
          isOpen
          onClose={() => setTargetMode(null)}
          questionFigure={questionFigure}
          questionId={question.id}
          setId={setId}
          targetMode={targetMode}
        />
      ) : null}
    </>
  );
}

type FigureAiMenuOption = {
  targetMode: AdminQuizFigureAiTargetMode;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;
  disabledReason: string | null;
};

function activeReason(status: string | undefined) {
  return status && ACTIVE_STATUSES.has(status)
    ? "Hình đang được xử lý, vui lòng chờ hoàn tất."
    : null;
}

function solutionActiveReason(
  status: string | undefined,
  activeTargetMode: AdminQuizFigureAiTargetMode | null,
  optionTargetMode: "SOLUTION",
) {
  if (!status || !ACTIVE_STATUSES.has(status)) return null;
  return activeTargetMode === optionTargetMode
    ? "Hình đang được xử lý, vui lòng chờ hoàn tất."
    : "Chờ hình đang tạo hoàn tất.";
}
