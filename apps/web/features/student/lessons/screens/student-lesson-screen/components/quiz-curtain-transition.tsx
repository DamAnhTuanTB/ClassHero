"use client";

import { motion, useReducedMotion } from "framer-motion";
import { BookCurtainEffect } from "@/features/student/lessons/screens/student-lesson-screen/components/quiz-transition-effects/book-curtain-effect";
import { CompassPortalEffect } from "@/features/student/lessons/screens/student-lesson-screen/components/quiz-transition-effects/compass-portal-effect";
import { EraserWipeEffect } from "@/features/student/lessons/screens/student-lesson-screen/components/quiz-transition-effects/eraser-wipe-effect";
import { InkSpreadEffect } from "@/features/student/lessons/screens/student-lesson-screen/components/quiz-transition-effects/ink-spread-effect";
import { NotebookFlipEffect } from "@/features/student/lessons/screens/student-lesson-screen/components/quiz-transition-effects/notebook-flip-effect";
import { PageRiffleEffect } from "@/features/student/lessons/screens/student-lesson-screen/components/quiz-transition-effects/page-riffle-effect";
import { PaperTearEffect } from "@/features/student/lessons/screens/student-lesson-screen/components/quiz-transition-effects/paper-tear-effect";
import { PencilPortalEffect } from "@/features/student/lessons/screens/student-lesson-screen/components/quiz-transition-effects/pencil-portal-effect";
import { RocketLaunchEffect } from "@/features/student/lessons/screens/student-lesson-screen/components/quiz-transition-effects/rocket-launch-effect";
import { QuizTransitionBrand } from "@/features/student/lessons/screens/student-lesson-screen/components/quiz-transition-brand";
import { useDocumentScrollLock } from "@/features/student/lessons/hooks/use-document-scroll-lock";
import {
  quizTransitionTimings,
  type ActiveQuizTransitionPhase,
  type QuizTransitionEffectProps,
  type QuizTransitionPhase,
  type QuizTransitionVariant,
} from "@/features/student/lessons/utils/quiz-transition-variant";

const transitionEffects: Record<
  QuizTransitionVariant,
  (props: QuizTransitionEffectProps) => React.ReactNode
> = {
  book: BookCurtainEffect,
  "compass-portal": CompassPortalEffect,
  eraser: EraserWipeEffect,
  "ink-spread": InkSpreadEffect,
  "notebook-flip": NotebookFlipEffect,
  "page-riffle": PageRiffleEffect,
  "paper-tear": PaperTearEffect,
  "pencil-portal": PencilPortalEffect,
  rocket: RocketLaunchEffect,
};

export function QuizCurtainTransition({
  animateStatusFill = true,
  ariaLabel = "Đang chuẩn bị Quiz",
  phase,
  statusText = "Đang chuẩn bị Quiz...",
  variant,
}: {
  animateStatusFill?: boolean;
  ariaLabel?: string;
  phase: QuizTransitionPhase;
  statusText?: string;
  variant: QuizTransitionVariant;
}) {
  if (phase === "idle") return null;

  return (
    <ActiveQuizTransition
      animateStatusFill={animateStatusFill}
      ariaLabel={ariaLabel}
      phase={phase}
      statusText={statusText}
      variant={variant}
    />
  );
}

function ActiveQuizTransition({
  animateStatusFill,
  ariaLabel,
  phase,
  statusText,
  variant,
}: {
  animateStatusFill: boolean;
  ariaLabel: string;
  phase: ActiveQuizTransitionPhase;
  statusText: string;
  variant: QuizTransitionVariant;
}) {
  useDocumentScrollLock();
  const shouldReduceMotion = Boolean(useReducedMotion());
  const isOpening = phase === "opening";
  const panelDuration = shouldReduceMotion
    ? 0.08
    : isOpening
      ? quizTransitionTimings.openMs / 1000
      : quizTransitionTimings.closeMs / 1000;
  const TransitionEffect = transitionEffects[variant];

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[120] isolate overflow-hidden"
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      data-quiz-transition-phase={phase}
      data-quiz-transition-variant={variant}
    >
      {shouldReduceMotion ? (
        <motion.div
          initial={false}
          animate={{ opacity: isOpening ? 0 : 1 }}
          transition={{ duration: 0.08 }}
          className="absolute inset-0 bg-gradient-to-br from-sky-100 via-white to-amber-100 dark:from-slate-950 dark:via-slate-900 dark:to-sky-950"
          aria-hidden="true"
        />
      ) : (
        <TransitionEffect
          panelDuration={panelDuration}
          phase={phase}
          shouldReduceMotion={false}
        />
      )}
      <QuizTransitionBrand
        animateStatusFill={animateStatusFill}
        phase={phase}
        shouldReduceMotion={shouldReduceMotion}
        statusText={statusText}
      />
    </div>
  );
}
