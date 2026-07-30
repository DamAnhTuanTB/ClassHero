"use client";

import { motion } from "framer-motion";
import { RadicalExpression } from "@/features/student/lessons/screens/student-lesson-screen/components/quiz-transition-effects/radical-expression";
import type { QuizTransitionEffectProps } from "@/features/student/lessons/utils/quiz-transition-variant";

export function PencilPortalEffect({
  panelDuration,
  phase,
  shouldReduceMotion,
}: QuizTransitionEffectProps) {
  const isOpening = phase === "opening";

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2">
        <motion.div
          initial={shouldReduceMotion ? false : { scale: 0 }}
          animate={{ scale: isOpening ? 0 : 26 }}
          transition={{ duration: panelDuration, ease: [0.76, 0, 0.24, 1] }}
          className="h-full w-full rounded-full bg-gradient-to-br from-[#fffdf8] via-sky-50 to-amber-100 shadow-[0_0_70px_rgb(14_165_233_/_18%)] dark:from-slate-950 dark:via-sky-950 dark:to-amber-950"
        />
      </div>

      <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 sm:h-80 sm:w-80">
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.55 }}
          animate={
            isOpening
              ? { opacity: 0, rotate: 220, scale: 0.7 }
              : { opacity: 1, rotate: 360, scale: 1 }
          }
          transition={{
            duration: shouldReduceMotion
              ? 0.08
              : panelDuration * (isOpening ? 0.82 : 1.5),
            ease: [0.22, 1, 0.36, 1],
          }}
          className="relative h-full w-full rounded-full border-[5px] border-dashed border-sky-700/25"
        ></motion.div>
      </div>

      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: isOpening ? 0 : 1, scale: isOpening ? 0.82 : 1 }}
        transition={{
          delay: shouldReduceMotion || isOpening ? 0 : panelDuration * 0.18,
          duration: shouldReduceMotion ? 0.08 : panelDuration * (isOpening ? 0.46 : 0.64),
          ease: "easeOut",
        }}
        className="absolute inset-0 origin-center"
      >
        <span className="absolute left-[9%] top-[16%] font-serif text-6xl font-black text-sky-800/15 motion-safe:animate-[spin_14s_linear_infinite]">
          π
        </span>
        <span className="absolute right-[10%] top-[23%] text-5xl font-black text-blue-800/15 motion-safe:animate-[spin_11s_linear_infinite_reverse]">
          <RadicalExpression />
        </span>
        <span className="absolute bottom-[17%] left-[15%] text-5xl font-black text-cyan-800/15 motion-safe:animate-[spin_13s_linear_infinite_reverse]">
          Σ
        </span>
      </motion.div>
    </div>
  );
}
