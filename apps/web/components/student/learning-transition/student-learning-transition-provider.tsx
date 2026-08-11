"use client";

import { useReducedMotion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { QuizCurtainTransition } from "@/features/student/lessons/screens/student-lesson-screen/components/quiz-curtain-transition";
import { useStudentLessonPrefetch } from "@/features/student/lessons/hooks/use-student-lesson-queries";
import {
  pickQuizTransitionVariant,
  quizTransitionTimings,
  type QuizTransitionPhase,
  type QuizTransitionVariant,
} from "@/features/student/lessons/utils/quiz-transition-variant";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";

type StudentLearningTransitionContextValue = {
  isTransitioning: boolean;
  openLesson: (lessonId: string) => Promise<void>;
};

const StudentLearningTransitionContext =
  createContext<StudentLearningTransitionContextValue | null>(null);

export function StudentLearningTransitionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const prefetchLesson = useStudentLessonPrefetch();
  const shouldReduceMotion = Boolean(useReducedMotion());
  const [phase, setPhase] = useState<QuizTransitionPhase>("idle");
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [variant, setVariant] = useState<QuizTransitionVariant>("book");
  const isTransitioningRef = useRef(false);
  const lastVariantRef = useRef<QuizTransitionVariant | null>(null);

  const openLesson = useCallback(
    async (lessonId: string) => {
      if (isTransitioningRef.current) {
        return;
      }

      const normalizedLessonId = lessonId.trim();
      if (!normalizedLessonId) {
        return;
      }

      isTransitioningRef.current = true;
      const targetPath = `/student/lessons/${encodeURIComponent(normalizedLessonId)}`;
      const nextVariant = pickQuizTransitionVariant(lastVariantRef.current);
      lastVariantRef.current = nextVariant;
      setVariant(nextVariant);
      setPhase("closing");
      router.prefetch(targetPath);

      try {
        await Promise.all([
          prefetchLesson(normalizedLessonId),
          waitForTransition(
            shouldReduceMotion
              ? quizTransitionTimings.reducedCloseMs
              : quizTransitionTimings.closeMs,
          ),
        ]);
        setPendingPath(targetPath);
        setPhase("closed");
        router.push(targetPath);
      } catch (error) {
        toast.error("Chưa mở được buổi học", {
          description:
            getUserFacingErrorMessage(error, "Bạn thử lại sau ít phút nhé."),
        });
        setPhase("opening");
        await waitForTransition(
          shouldReduceMotion
            ? quizTransitionTimings.reducedOpenMs
            : quizTransitionTimings.openMs,
        );
        setPhase("idle");
        isTransitioningRef.current = false;
      }
    },
    [prefetchLesson, router, shouldReduceMotion],
  );

  useEffect(() => {
    if (!pendingPath || pathname !== pendingPath) {
      return;
    }

    let cancelled = false;

    async function revealLesson() {
      setPhase("opening");
      await waitForTransition(
        shouldReduceMotion
          ? quizTransitionTimings.reducedOpenMs
          : quizTransitionTimings.openMs,
      );

      if (cancelled) {
        return;
      }

      setPhase("idle");
      setPendingPath(null);
      isTransitioningRef.current = false;
    }

    void revealLesson();

    return () => {
      cancelled = true;
    };
  }, [pathname, pendingPath, shouldReduceMotion]);

  const contextValue = useMemo(
    () => ({
      isTransitioning: phase !== "idle",
      openLesson,
    }),
    [openLesson, phase],
  );

  return (
    <StudentLearningTransitionContext.Provider value={contextValue}>
      {children}
      <QuizCurtainTransition
        animateStatusFill={false}
        ariaLabel="Đang mở buổi học"
        phase={phase}
        statusText="Học thông minh - Vững tương lai"
        variant={variant}
      />
    </StudentLearningTransitionContext.Provider>
  );
}

export function useStudentLearningTransition() {
  const context = useContext(StudentLearningTransitionContext);

  if (!context) {
    throw new Error(
      "useStudentLearningTransition must be used inside StudentLearningTransitionProvider",
    );
  }

  return context;
}

function waitForTransition(durationMs: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}
