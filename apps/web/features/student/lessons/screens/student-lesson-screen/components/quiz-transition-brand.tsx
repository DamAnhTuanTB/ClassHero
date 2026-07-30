"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Nunito } from "next/font/google";
import { useEffect, useState } from "react";
import { ClassHeroLogo } from "@/components/common/brand/classhero-logo";
import {
  quizTransitionTimings,
  type ActiveQuizTransitionPhase,
} from "@/features/student/lessons/utils/quiz-transition-variant";

const studentMessageFont = Nunito({
  subsets: ["latin", "vietnamese"],
  weight: ["800"],
  display: "swap",
});
const statusFillDurationSeconds = (quizTransitionTimings.closeMs / 1_000) * 0.55;
const countdownStepMs = 734;

export function QuizTransitionBrand({
  animateStatusFill,
  countdownFrom,
  phase,
  shouldReduceMotion,
  statusText,
}: {
  animateStatusFill: boolean;
  countdownFrom?: number;
  phase: ActiveQuizTransitionPhase;
  shouldReduceMotion: boolean;
  statusText: string;
}) {
  const isOpening = phase === "opening";
  const [countdownValue, setCountdownValue] = useState(() =>
    Math.max(1, countdownFrom ?? 1),
  );

  useEffect(() => {
    if (!countdownFrom) return;

    setCountdownValue(Math.max(1, countdownFrom));
    const interval = window.setInterval(() => {
      setCountdownValue((value) => {
        if (value <= 2) {
          window.clearInterval(interval);
          return 1;
        }
        return value - 1;
      });
    }, countdownStepMs);

    return () => window.clearInterval(interval);
  }, [countdownFrom]);

  return (
    <div className="absolute left-1/2 top-1/2 z-20 w-[min(20rem,90vw)] -translate-x-1/2 -translate-y-1/2 sm:w-[min(22rem,80vw)]">
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.72 }}
        animate={isOpening ? { opacity: 0, scale: 0.82 } : { opacity: 1, scale: 1 }}
        transition={{
          duration: shouldReduceMotion ? 0.08 : isOpening ? 0.16 : 0.24,
          delay: shouldReduceMotion || isOpening ? 0 : 0.22,
          ease: "easeOut",
        }}
        className="flex w-full flex-col items-center"
      >
        <div className="relative flex min-h-32 w-full flex-col items-center justify-center">
          <ClassHeroLogo
            className="relative z-10 h-auto w-[17.5rem] max-w-full sm:w-[19.5rem]"
            priority
          />
          <motion.svg
            aria-hidden="true"
            viewBox="0 0 320 42"
            initial={shouldReduceMotion ? false : { opacity: 0, scaleX: 0.72 }}
            animate={{
              opacity: isOpening ? 0 : 1,
              scaleX: isOpening ? 0.78 : 1,
            }}
            transition={{
              delay: shouldReduceMotion || isOpening ? 0 : 0.08,
              duration: shouldReduceMotion ? 0.08 : 0.42,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="relative z-10 -mt-2 h-11 w-[90%] origin-left overflow-visible"
          >
            <motion.path
              d="M16 30 H64"
              fill="none"
              stroke="#006BFF"
              strokeLinecap="round"
              strokeWidth="11"
              initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
              animate={{
                pathLength: isOpening ? 0.4 : 1,
                opacity: isOpening ? 0 : 1,
              }}
              transition={{
                delay: shouldReduceMotion || isOpening ? 0 : 0.08,
                duration: shouldReduceMotion ? 0.08 : 0.25,
                ease: "easeOut",
              }}
            />
            <motion.path
              d="M78 27 H126"
              fill="none"
              stroke="#0ea5e9"
              strokeLinecap="round"
              strokeWidth="11"
              initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
              animate={{
                pathLength: isOpening ? 0.4 : 1,
                opacity: isOpening ? 0 : 1,
              }}
              transition={{
                delay: shouldReduceMotion || isOpening ? 0 : 0.16,
                duration: shouldReduceMotion ? 0.08 : 0.25,
                ease: "easeOut",
              }}
            />
            <motion.path
              d="M140 24 H188"
              fill="none"
              stroke="#14b8a6"
              strokeLinecap="round"
              strokeWidth="11"
              initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
              animate={{
                pathLength: isOpening ? 0.4 : 1,
                opacity: isOpening ? 0 : 1,
              }}
              transition={{
                delay: shouldReduceMotion || isOpening ? 0 : 0.24,
                duration: shouldReduceMotion ? 0.08 : 0.25,
                ease: "easeOut",
              }}
            />
            <motion.path
              d="M202 21 H250"
              fill="none"
              stroke="#4F8FAF"
              strokeLinecap="round"
              strokeWidth="11"
              initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
              animate={{
                pathLength: isOpening ? 0.4 : 1,
                opacity: isOpening ? 0 : 1,
              }}
              transition={{
                delay: shouldReduceMotion || isOpening ? 0 : 0.32,
                duration: shouldReduceMotion ? 0.08 : 0.25,
                ease: "easeOut",
              }}
            />
            <motion.path
              d="M264 18 H312 M302 8 L314 18 L302 28"
              fill="none"
              stroke="#FDAF04"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="10"
              initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
              animate={{
                pathLength: isOpening ? 0.35 : 1,
                opacity: isOpening ? 0 : 1,
              }}
              transition={{
                delay: shouldReduceMotion || isOpening ? 0 : 0.4,
                duration: shouldReduceMotion ? 0.08 : 0.28,
                ease: "easeOut",
              }}
            />
          </motion.svg>
        </div>
        {animateStatusFill ? (
          <p
            className={`${studentMessageFont.className} relative mt-0 whitespace-nowrap text-[1.2rem] font-extrabold not-italic sm:text-[1.45rem]`}
          >
            <span className="text-sky-200">{statusText}</span>
            <motion.span
              aria-hidden="true"
              initial={shouldReduceMotion ? false : { clipPath: "inset(0 100% 0 0)" }}
              animate={{
                clipPath:
                  shouldReduceMotion || !isOpening
                    ? "inset(0 0% 0 0)"
                    : "inset(0 100% 0 0)",
              }}
              transition={{
                delay: shouldReduceMotion || isOpening ? 0 : 0.08,
                duration: shouldReduceMotion
                  ? 0
                  : isOpening
                    ? 0.16
                    : statusFillDurationSeconds,
                ease: isOpening ? "easeOut" : "linear",
              }}
              className="absolute inset-0 text-sky-600"
            >
              {statusText}
            </motion.span>
          </p>
        ) : (
          <p
            className={`${studentMessageFont.className} mt-0 whitespace-nowrap text-center text-[1.25rem] font-extrabold not-italic text-sky-600 sm:text-[1.75rem]`}
          >
            {statusText}
          </p>
        )}
        {countdownFrom ? (
          <div
            data-testid="learning-transition-countdown"
            className="mt-5 grid h-20 w-20 place-items-center rounded-full border-4 border-emerald-200 bg-white/90 shadow-[0_12px_28px_-16px_rgb(5_150_105_/_80%)] dark:border-emerald-400/30 dark:bg-slate-900/90"
            aria-hidden="true"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={countdownValue}
                initial={
                  shouldReduceMotion
                    ? { opacity: 1 }
                    : { opacity: 0, rotate: -12, scale: 0.35, y: 8 }
                }
                animate={{ opacity: 1, rotate: 0, scale: 1, y: 0 }}
                exit={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, rotate: 10, scale: 1.55, y: -8 }
                }
                transition={{
                  duration: shouldReduceMotion ? 0 : 0.2,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="bg-gradient-to-br from-emerald-500 to-teal-600 bg-clip-text [font-family:var(--font-display)] text-5xl font-black leading-none text-transparent drop-shadow-sm"
              >
                {countdownValue}
              </motion.span>
            </AnimatePresence>
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}
