"use client";

import { motion } from "framer-motion";
import { RadicalExpression } from "@/features/student/lessons/screens/student-lesson-screen/components/quiz-transition-effects/radical-expression";
import type { QuizTransitionEffectProps } from "@/features/student/lessons/utils/quiz-transition-variant";

export function EraserWipeEffect({
  panelDuration,
  phase,
  shouldReduceMotion,
}: QuizTransitionEffectProps) {
  const isOpening = phase === "opening";

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <motion.div
        initial={
          shouldReduceMotion
            ? false
            : {
                clipPath: "inset(0 100% 0 0)",
              }
        }
        animate={{
          clipPath: isOpening ? "inset(0 0 0 100%)" : "inset(0 0 0 0)",
        }}
        transition={{ duration: panelDuration, ease: [0.76, 0, 0.24, 1] }}
        className="absolute inset-0 bg-[linear-gradient(135deg,#f7fff9_0%,#ecfdf5_48%,#ecfeff_100%)] dark:bg-[linear-gradient(135deg,#020617_0%,#022c22_48%,#083344_100%)]"
      >
        <div className="absolute inset-0 opacity-70 [background-image:repeating-linear-gradient(0deg,transparent_0_42px,rgb(14_165_233_/_12%)_43px_44px)]" />
        <span className="absolute left-[10%] top-[14%] -rotate-6 font-serif text-6xl font-black text-emerald-800/18">
          a² + b²
        </span>
        <span className="absolute right-[10%] top-[28%] rotate-6 text-5xl font-black text-teal-700/18">
          <RadicalExpression />
        </span>
        <span className="absolute bottom-[23%] left-[13%] rotate-3 font-serif text-5xl font-black text-emerald-700/16">
          πr²
        </span>
        <span className="absolute bottom-[14%] right-[14%] -rotate-6 text-5xl font-black text-teal-800/16">
          7 × 8
        </span>
      </motion.div>
    </div>
  );
}
