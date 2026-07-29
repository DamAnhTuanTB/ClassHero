"use client";

import { motion } from "framer-motion";
import { RadicalExpression } from "@/features/student/lessons/screens/student-lesson-screen/components/quiz-transition-effects/radical-expression";
import type { QuizTransitionEffectProps } from "@/features/student/lessons/utils/quiz-transition-variant";
import { cn } from "@/lib/utils";

const rifflePages = [
  "bg-slate-200",
  "bg-sky-100",
  "bg-amber-100",
  "bg-cyan-100",
  "bg-slate-100",
  "bg-emerald-50",
  "bg-amber-50",
  "bg-white",
] as const;

type PageFormula = {
  content: string;
  isRadical?: boolean;
};

const pageFormulas: readonly PageFormula[] = [
  { content: "π" },
  { content: "x", isRadical: true },
  { content: "Σ" },
  { content: "a²" },
  { content: "∞" },
  { content: "△" },
  { content: "7 × 8" },
  { content: "x + y" },
];

function renderPageFormula(formula: PageFormula | undefined) {
  if (!formula) {
    return null;
  }

  return formula.isRadical ? (
    <RadicalExpression radicand={formula.content} />
  ) : (
    formula.content
  );
}

export function PageRiffleEffect({ panelDuration, phase }: QuizTransitionEffectProps) {
  const isOpening = phase === "opening";

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ perspective: "1000px" }}
      aria-hidden="true"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isOpening ? 0 : 1 }}
        transition={{ duration: panelDuration * 0.65 }}
        className="absolute inset-0 bg-gradient-to-br from-sky-100 via-white to-amber-50 dark:from-slate-200 dark:via-slate-50 dark:to-amber-100"
      />

      {rifflePages.map((pageColor, index) => (
        <motion.div
          key={pageColor}
          initial={{
            opacity: 0,
            rotateY: -82,
            rotateZ: 5 - index * 0.75,
            x: "112%",
          }}
          animate={
            isOpening
              ? {
                  opacity: index < 5 ? 0 : 1,
                  rotateY: 78,
                  rotateZ: -8 + index * 0.7,
                  x: "-116%",
                }
              : {
                  opacity: 1,
                  rotateY: 0,
                  rotateZ: (index - 4) * 0.3,
                  x: "0%",
                }
          }
          transition={{
            delay: isOpening ? (rifflePages.length - 1 - index) * 0.026 : index * 0.032,
            duration: panelDuration * (isOpening ? 0.64 : 0.72),
            ease: [0.22, 1, 0.36, 1],
          }}
          className={cn(
            "absolute -inset-y-[2%] -left-[5%] right-[2%] origin-right overflow-hidden rounded-r-[2rem] border-[3px] border-white/75 shadow-[-18px_0_45px_rgb(15_23_42_/_28%)] will-change-transform",
            pageColor,
          )}
        >
          <div className="absolute bottom-0 left-[13%] top-0 w-0.5 bg-red-300/45" />
          <div
            className="absolute inset-0 opacity-80"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg,transparent 0,transparent 35px,rgb(14 165 233 / 16%) 36px,rgb(14 165 233 / 16%) 37px)",
            }}
          />
          <span className="absolute right-[9%] top-[8%] rounded-full border border-slate-300 bg-white/85 px-3 py-1 text-xs font-black text-slate-500 shadow-sm">
            {index + 1}
          </span>
          <span className="absolute left-[19%] top-[17%] -rotate-6 text-7xl font-black text-sky-700/15">
            {renderPageFormula(pageFormulas[index])}
          </span>
          <span className="absolute bottom-[14%] right-[12%] rotate-6 text-6xl font-black text-amber-600/14">
            {renderPageFormula(pageFormulas[(index + 3) % pageFormulas.length])}
          </span>
        </motion.div>
      ))}

      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: isOpening ? 0 : 0.7, scale: isOpening ? 1.3 : 1 }}
        transition={{ delay: panelDuration * 0.4, duration: panelDuration * 0.5 }}
        className="absolute bottom-[4%] right-[1%] z-10 h-24 w-24 rounded-tl-[5rem] bg-gradient-to-br from-transparent via-slate-300/35 to-slate-500/30 shadow-[-10px_-10px_28px_rgb(15_23_42_/_18%)]"
      />
    </div>
  );
}
