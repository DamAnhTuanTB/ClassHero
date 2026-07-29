"use client";

import { motion } from "framer-motion";
import type { QuizTransitionEffectProps } from "@/features/student/lessons/utils/quiz-transition-variant";

export function BookCurtainEffect({
  panelDuration,
  phase,
  shouldReduceMotion,
}: QuizTransitionEffectProps) {
  const isOpening = phase === "opening";
  const panelTransition = {
    duration: panelDuration,
    ease: [0.76, 0, 0.24, 1] as const,
  };

  return (
    <>
      <motion.div
        initial={shouldReduceMotion ? false : { x: "-100%" }}
        animate={{ x: isOpening ? "-100%" : "0%" }}
        transition={panelTransition}
        className="absolute inset-y-0 left-0 w-[50.5%] overflow-hidden bg-gradient-to-br from-sky-50 via-sky-100 to-blue-300 dark:from-slate-100 dark:via-sky-200 dark:to-blue-400"
        aria-hidden="true"
      >
        <span className="absolute -left-14 top-[12%] h-44 w-44 rounded-full border-[20px] border-sky-500/10" />
        <span className="absolute bottom-[10%] left-[14%] h-16 w-16 rotate-12 rounded-2xl border-8 border-cyan-600/15 motion-safe:animate-[spin_13s_linear_infinite]" />
        <svg
          viewBox="0 0 64 64"
          className="absolute right-[13%] top-[8%] h-14 w-14 -rotate-6 text-cyan-700/15 motion-safe:animate-[spin_11s_linear_infinite_reverse]"
        >
          <path
            d="M32 7 58 55H6Z"
            fill="none"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="7"
          />
        </svg>
        <span className="absolute right-[12%] top-[24%] text-5xl font-black text-sky-700/15 motion-safe:animate-[spin_10s_linear_infinite]">
          ?
        </span>
        <span className="absolute left-[14%] top-[34%] -rotate-12 font-serif text-5xl font-black text-blue-700/15 motion-safe:animate-[spin_14s_linear_infinite_reverse]">
          π
        </span>
        <svg
          viewBox="0 0 72 56"
          className="absolute bottom-[34%] right-[10%] h-14 w-20 rotate-6 text-cyan-700/15 motion-safe:animate-[spin_15s_linear_infinite]"
        >
          <path
            d="M5 29h11l8 18L36 8h31"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="6"
          />
        </svg>
        <span className="absolute left-[13%] top-[57%] -rotate-6 font-serif text-5xl font-black text-sky-800/15 motion-safe:animate-[spin_16s_linear_infinite_reverse]">
          ∫
        </span>
        <span className="absolute left-[18%] top-[71%] rotate-6 font-serif text-4xl font-black text-cyan-700/15 motion-safe:animate-[spin_13s_linear_infinite]">
          x²
        </span>
        <span className="absolute right-[13%] top-[76%] -rotate-12 text-4xl font-black text-blue-700/15 motion-safe:animate-[spin_15s_linear_infinite_reverse]">
          ≠
        </span>
        <span className="absolute inset-y-0 right-0 w-1 bg-sky-300/55 shadow-[0_0_24px_rgb(14_165_233_/_16%)]" />
      </motion.div>

      <motion.div
        initial={shouldReduceMotion ? false : { x: "100%" }}
        animate={{ x: isOpening ? "100%" : "0%" }}
        transition={panelTransition}
        className="absolute inset-y-0 right-0 w-[50.5%] overflow-hidden bg-gradient-to-bl from-amber-50 via-amber-100 to-orange-200 dark:from-amber-50 dark:via-amber-100 dark:to-orange-300"
        aria-hidden="true"
      >
        <span className="absolute -right-16 bottom-[14%] h-48 w-48 rounded-full border-[22px] border-amber-500/10" />
        <span className="absolute right-[18%] top-[17%] h-14 w-14 rotate-45 rounded-2xl border-8 border-amber-600/15 motion-safe:animate-[spin_15s_linear_infinite_reverse]" />
        <span className="absolute left-[16%] top-[8%] -rotate-12 text-4xl font-black text-amber-700/15 motion-safe:animate-[spin_11s_linear_infinite]">
          ×
        </span>
        <svg
          viewBox="0 0 64 64"
          className="absolute right-[10%] top-[36%] h-16 w-16 rotate-6 text-amber-700/15 motion-safe:animate-[spin_13s_linear_infinite]"
        >
          <path
            d="M17 9h30l14 23-14 23H17L3 32Z"
            fill="none"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="7"
          />
        </svg>
        <span className="absolute left-[14%] top-[29%] rotate-6 font-serif text-5xl font-black text-orange-700/15 motion-safe:animate-[spin_16s_linear_infinite_reverse]">
          Σ
        </span>
        <span className="absolute bottom-[36%] right-[17%] -rotate-6 text-5xl font-black text-amber-700/15 motion-safe:animate-[spin_12s_linear_infinite]">
          ÷
        </span>
        <span className="absolute bottom-[13%] left-[17%] rotate-12 text-4xl font-black text-orange-700/15 motion-safe:animate-[spin_14s_linear_infinite_reverse]">
          ∞
        </span>
        <span className="absolute inset-y-0 left-0 w-1 bg-amber-300/55 shadow-[0_0_24px_rgb(245_158_11_/_14%)]" />
      </motion.div>
    </>
  );
}
