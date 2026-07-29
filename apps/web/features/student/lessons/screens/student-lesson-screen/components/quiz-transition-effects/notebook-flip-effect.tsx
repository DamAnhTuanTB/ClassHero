"use client";

import { motion } from "framer-motion";
import { RadicalExpression } from "@/features/student/lessons/screens/student-lesson-screen/components/quiz-transition-effects/radical-expression";
import type { QuizTransitionEffectProps } from "@/features/student/lessons/utils/quiz-transition-variant";
import { cn } from "@/lib/utils";

const notebookPages = [
  {
    className: "bg-sky-100 dark:bg-slate-200",
    delay: 0,
    rotate: -5,
  },
  {
    className: "bg-amber-100 dark:bg-amber-100",
    delay: 0.06,
    rotate: 4,
  },
  {
    className: "bg-white dark:bg-slate-50",
    delay: 0.12,
    rotate: 0,
  },
] as const;

const spiralRings = Array.from({ length: 11 }, (_, index) => index);

export function NotebookFlipEffect({ panelDuration, phase }: QuizTransitionEffectProps) {
  const isOpening = phase === "opening";

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ perspective: "1100px" }}
      aria-hidden="true"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isOpening ? 0 : 1 }}
        transition={{ duration: panelDuration * 0.72 }}
        className="absolute inset-0 bg-gradient-to-br from-sky-100 via-white to-amber-50 dark:from-slate-200 dark:via-slate-50 dark:to-amber-100"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: isOpening ? 0 : 0.45, scale: isOpening ? 1.3 : 1 }}
        transition={{ duration: panelDuration }}
        className="absolute -left-24 top-[8%] h-64 w-64 rounded-full border-[28px] border-cyan-600/12"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.75 }}
        animate={{ opacity: isOpening ? 0 : 0.5, scale: isOpening ? 1.25 : 1 }}
        transition={{ duration: panelDuration }}
        className="absolute -right-20 bottom-[7%] h-60 w-60 rotate-12 rounded-[3rem] border-[26px] border-amber-600/12"
      />

      {notebookPages.map((page, index) => (
        <motion.div
          key={page.className}
          initial={{
            opacity: 0,
            rotate: page.rotate,
            rotateX: -78,
            scale: 0.88,
            y: "112%",
          }}
          animate={
            isOpening
              ? {
                  opacity: index === notebookPages.length - 1 ? 1 : 0,
                  rotate: page.rotate * 1.8,
                  rotateX: 82,
                  scale: 0.92,
                  y: "-112%",
                }
              : {
                  opacity: 1,
                  rotate: page.rotate,
                  rotateX: 0,
                  scale: 1,
                  y: "0%",
                }
          }
          transition={{
            delay: isOpening ? (notebookPages.length - 1 - index) * 0.04 : page.delay,
            duration: panelDuration * (isOpening ? 0.82 : 0.92),
            ease: [0.22, 1, 0.36, 1],
          }}
          className={cn(
            "absolute -inset-x-[8%] -bottom-[4%] top-[4%] origin-bottom overflow-hidden rounded-t-[2rem] border-[3px] border-white/70 shadow-[0_-24px_60px_rgb(15_23_42_/_35%)]",
            page.className,
          )}
        >
          {index === notebookPages.length - 1 ? (
            <>
              <div className="absolute bottom-0 left-[14%] top-0 w-0.5 bg-red-300/55" />
              <div
                className="absolute inset-0 opacity-80"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(0deg,transparent 0,transparent 37px,rgb(14 165 233 / 18%) 38px,rgb(14 165 233 / 18%) 39px)",
                }}
              />
              <div className="absolute left-[19%] top-[13%] -rotate-3 text-5xl font-black text-sky-700/18">
                πr²
              </div>
              <div className="absolute right-[12%] top-[17%] rotate-6 text-5xl font-black text-amber-600/20">
                <RadicalExpression radicand="49" />
              </div>
              <div className="absolute bottom-[22%] left-[18%] rotate-3 text-6xl font-black text-teal-700/16">
                Σ
              </div>
              <div className="absolute bottom-[14%] right-[14%] -rotate-6 text-4xl font-black text-blue-800/15">
                x² + y²
              </div>
            </>
          ) : null}
        </motion.div>
      ))}

      <motion.div
        initial={{ opacity: 0, y: -60 }}
        animate={{ opacity: isOpening ? 0 : 1, y: isOpening ? -80 : 0 }}
        transition={{ delay: panelDuration * 0.28, duration: panelDuration * 0.62 }}
        className="absolute inset-x-[4%] top-[3.2%] z-10 flex justify-around"
      >
        {spiralRings.map((ring) => (
          <span
            key={ring}
            className="h-10 w-4 rounded-full border-[4px] border-slate-700 bg-slate-200 shadow-sm"
          />
        ))}
      </motion.div>
    </div>
  );
}
