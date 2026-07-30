"use client";

import { motion } from "framer-motion";
import type { QuizTransitionEffectProps } from "@/features/student/lessons/utils/quiz-transition-variant";

const launchTrails = [
  {
    d: "M18 804 C86 715 38 590 116 455",
    opacity: 0.2,
    stroke: "#0ea5e9",
    strokeWidth: 5,
  },
  {
    d: "M-8 732 C54 654 24 552 88 430",
    opacity: 0.14,
    stroke: "#38bdf8",
    strokeWidth: 3,
  },
  {
    d: "M372 812 C304 720 354 592 276 458",
    opacity: 0.18,
    stroke: "#14b8a6",
    strokeWidth: 5,
  },
  {
    d: "M402 742 C338 658 370 548 304 426",
    opacity: 0.13,
    stroke: "#4f8faf",
    strokeWidth: 3,
  },
] as const;

export function RocketLaunchEffect({
  panelDuration,
  phase,
  shouldReduceMotion,
}: QuizTransitionEffectProps) {
  const isOpening = phase === "opening";

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { y: "100%" }}
      animate={{ y: isOpening ? "-100%" : "0%" }}
      transition={{ duration: panelDuration, ease: [0.76, 0, 0.24, 1] }}
      className="absolute inset-0 overflow-hidden bg-gradient-to-b from-[#f7fbff] via-sky-50 to-cyan-100 dark:from-slate-950 dark:via-sky-950 dark:to-cyan-950"
      aria-hidden="true"
    >
      <motion.span
        initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.7 }}
        animate={{ opacity: isOpening ? 0 : 0.34, scale: isOpening ? 1.18 : 1 }}
        transition={{ duration: shouldReduceMotion ? 0.08 : panelDuration * 0.82 }}
        className="absolute -left-20 top-[9%] h-52 w-52 rounded-full border-[18px] border-sky-400/15"
      />
      <motion.span
        initial={shouldReduceMotion ? false : { opacity: 0, rotate: -12, scale: 0.72 }}
        animate={{
          opacity: isOpening ? 0 : 0.32,
          rotate: isOpening ? 18 : 8,
          scale: isOpening ? 1.16 : 1,
        }}
        transition={{
          delay: shouldReduceMotion || isOpening ? 0 : panelDuration * 0.12,
          duration: shouldReduceMotion ? 0.08 : panelDuration * 0.76,
        }}
        className="absolute -right-16 top-[14%] h-40 w-40 rounded-[2.75rem] border-[14px] border-amber-400/15"
      />

      <motion.svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 390 844"
        preserveAspectRatio="none"
      >
        {launchTrails.map((trail, index) => (
          <motion.path
            key={trail.d}
            d={trail.d}
            fill="none"
            stroke={trail.stroke}
            strokeLinecap="round"
            strokeWidth={trail.strokeWidth}
            initial={
              shouldReduceMotion ? false : { opacity: 0, pathLength: 0, pathOffset: 0.18 }
            }
            animate={{
              opacity: isOpening ? 0 : trail.opacity,
              pathLength: isOpening ? 0 : 1,
              pathOffset: isOpening ? 0.82 : 0,
            }}
            transition={{
              delay:
                shouldReduceMotion || isOpening
                  ? 0
                  : panelDuration * (0.14 + index * 0.06),
              duration: shouldReduceMotion ? 0.08 : panelDuration * 0.72,
              ease: [0.22, 1, 0.36, 1],
            }}
          />
        ))}
      </motion.svg>

      <span className="absolute left-[22%] top-[29%] h-3 w-3 rounded-full bg-sky-500/30" />
      <span className="absolute right-[8%] top-[42%] h-2.5 w-2.5 rounded-full bg-amber-500/40" />
      <span className="absolute bottom-[13%] -left-16 h-40 w-56 rounded-[50%] bg-white/70 blur-sm dark:bg-slate-700/45" />
      <span className="absolute -right-20 bottom-[7%] h-52 w-72 rounded-[50%] bg-sky-200/60 blur-sm dark:bg-sky-800/45" />

      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white/70 to-transparent dark:from-slate-950/80" />
    </motion.div>
  );
}
