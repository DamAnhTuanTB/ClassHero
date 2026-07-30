"use client";

import { useReducedMotion } from "framer-motion";
import { useCallback, useRef, useState } from "react";
import type { StudentLessonTab } from "@/features/student/lessons/types/student-lesson-types";
import {
  pickQuizTransitionVariant,
  quizTransitionTimings,
  type QuizTransitionPhase,
  type QuizTransitionVariant,
} from "@/features/student/lessons/utils/quiz-transition-variant";

export type PracticeTabTarget = Extract<StudentLessonTab, "flashcard" | "quiz">;

export function usePracticeTabTransition(
  onSelectTab: (tab: StudentLessonTab) => void,
) {
  const shouldReduceMotion = Boolean(useReducedMotion());
  const [autoStartTarget, setAutoStartTarget] =
    useState<PracticeTabTarget | null>(null);
  const [phase, setPhase] = useState<QuizTransitionPhase>("idle");
  const [target, setTarget] = useState<PracticeTabTarget | null>(null);
  const [variant, setVariant] = useState<QuizTransitionVariant>("book");
  const isCompletingRef = useRef(false);
  const isTransitioningRef = useRef(false);
  const lastVariantRef = useRef<QuizTransitionVariant | null>(null);
  const targetRef = useRef<PracticeTabTarget | null>(null);

  const openPracticeTab = useCallback(
    async (nextTarget: PracticeTabTarget) => {
      if (isTransitioningRef.current) return;

      isTransitioningRef.current = true;
      targetRef.current = nextTarget;
      setTarget(nextTarget);
      const nextVariant = pickQuizTransitionVariant(lastVariantRef.current);
      lastVariantRef.current = nextVariant;
      setVariant(nextVariant);
      setPhase("closing");

      await waitForTransition(
        shouldReduceMotion
          ? quizTransitionTimings.reducedCloseMs
          : quizTransitionTimings.closeMs,
      );
      setPhase("closed");
      onSelectTab(nextTarget);
      setAutoStartTarget(nextTarget);
    },
    [onSelectTab, shouldReduceMotion],
  );

  const completePracticeTabOpen = useCallback(
    async (completedTarget: PracticeTabTarget) => {
      if (
        !isTransitioningRef.current ||
        isCompletingRef.current ||
        targetRef.current !== completedTarget
      ) {
        return;
      }

      isCompletingRef.current = true;
      setAutoStartTarget(null);
      setPhase("opening");
      await waitForTransition(
        shouldReduceMotion
          ? quizTransitionTimings.reducedOpenMs
          : quizTransitionTimings.openMs,
      );
      setPhase("idle");
      setTarget(null);
      targetRef.current = null;
      isCompletingRef.current = false;
      isTransitioningRef.current = false;
    },
    [shouldReduceMotion],
  );

  return {
    autoStartTarget,
    completePracticeTabOpen,
    openPracticeTab,
    phase,
    target,
    variant,
  };
}

function waitForTransition(durationMs: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}
