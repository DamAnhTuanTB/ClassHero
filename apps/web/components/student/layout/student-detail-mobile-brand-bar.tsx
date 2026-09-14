"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { ClassHeroLogo } from "@/components/common/brand/classhero-logo";
import { useAutoHidingStudentHeader } from "@/components/student/layout/use-auto-hiding-student-header";
import { StudentAiChatHeaderTrigger } from "@/features/student/ai-chat/components/student-ai-chat-header-trigger";
import type { AiChatEntryContext } from "@/features/student/ai-chat/utils/ai-chat-link";

export function StudentDetailMobileBrandBar({
  aiChatContext,
}: {
  aiChatContext?: AiChatEntryContext;
}) {
  const router = useRouter();
  const headerRef = useAutoHidingStudentHeader();

  return (
    <>
      <div className="-mx-4 -mt-4 h-[4.5rem] sm:-mx-6 lg:hidden" aria-hidden="true" />
      <header
        ref={headerRef}
        className="fixed inset-x-0 top-0 z-40 translate-y-0 border-b border-sky-100 bg-white py-2 pl-1 pr-2 transition-[translate] duration-[650ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[translate] dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] sm:pl-2 sm:pr-4 lg:hidden motion-reduce:transition-none"
      >
        <div className="flex min-h-14 items-center gap-1.5">
          <button
            type="button"
            onClick={() => router.back()}
            className="grid h-11 w-10 shrink-0 place-items-center rounded-xl text-slate-700 transition hover:bg-sky-50 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100 dark:text-[var(--theme-text)] dark:hover:bg-[var(--theme-surface-soft)] dark:hover:text-sky-300"
            aria-label="Quay lại màn trước"
          >
            <ChevronLeft className="h-8 w-8" strokeWidth={2.8} aria-hidden="true" />
          </button>
          <div className="inline-flex min-w-0 items-center">
            <ClassHeroLogo className="h-10 max-w-[9rem]" priority />
          </div>
          {aiChatContext ? (
            <StudentAiChatHeaderTrigger
              context={aiChatContext}
              testId="student-ai-chat-trigger-mobile"
            />
          ) : null}
        </div>
      </header>
    </>
  );
}
