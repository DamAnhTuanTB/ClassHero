"use client";

import { motion } from "framer-motion";
import { RadicalExpression } from "@/features/student/lessons/screens/student-lesson-screen/components/quiz-transition-effects/radical-expression";
import type { QuizTransitionEffectProps } from "@/features/student/lessons/utils/quiz-transition-variant";

const tearFibers = Array.from({ length: 15 }, (_, index) => ({
  delay: index * 0.018,
  left: index % 2 === 0 ? "48.5%" : "50.5%",
  rotate: index % 2 === 0 ? -28 : 31,
  top: `${3 + index * 6.6}%`,
}));

export function PaperTearEffect({ panelDuration, phase }: QuizTransitionEffectProps) {
  const isOpening = phase === "opening";

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isOpening ? 0 : 1 }}
        transition={{ duration: panelDuration * 0.45 }}
        className="absolute inset-0 bg-sky-100/90 dark:bg-slate-200"
      />

      <motion.div
        initial={{ x: "-105%" }}
        animate={{ x: isOpening ? "-108%" : "0%" }}
        transition={{ duration: panelDuration, ease: [0.76, 0, 0.24, 1] }}
        className="absolute inset-y-0 left-0 w-[52.5%] overflow-hidden bg-[#edf8ff] shadow-[20px_0_45px_rgb(15_23_42_/_28%)] dark:bg-slate-100"
        style={{
          clipPath:
            "polygon(0 0,100% 0,96% 5%,100% 11%,95% 17%,99% 24%,94% 31%,100% 38%,95% 46%,99% 54%,94% 62%,100% 70%,95% 78%,99% 86%,95% 93%,100% 100%,0 100%)",
        }}
      >
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg,transparent 0,transparent 31px,rgb(14 165 233 / 16%) 32px,rgb(14 165 233 / 16%) 33px)",
          }}
        />
        <div className="absolute left-[12%] top-[13%] -rotate-6 font-serif text-6xl font-black text-sky-600/20">
          π
        </div>
        <div className="absolute left-[18%] top-[31%] rotate-3 text-5xl font-black text-blue-700/15">
          a² + b²
        </div>
        <div className="absolute bottom-[26%] left-[10%] -rotate-12 text-7xl font-black text-cyan-700/15">
          <RadicalExpression />
        </div>
        <div className="absolute bottom-[9%] left-[24%] rotate-6 text-4xl font-black text-sky-700/20">
          x + y
        </div>
      </motion.div>

      <motion.div
        initial={{ x: "105%" }}
        animate={{ x: isOpening ? "108%" : "0%" }}
        transition={{ duration: panelDuration, ease: [0.76, 0, 0.24, 1] }}
        className="absolute inset-y-0 right-0 w-[52.5%] overflow-hidden bg-[#fff8df] shadow-[-20px_0_45px_rgb(15_23_42_/_24%)] dark:bg-amber-50"
        style={{
          clipPath:
            "polygon(4% 0,100% 0,100% 100%,4% 100%,0 93%,5% 86%,1% 78%,6% 70%,0 62%,5% 54%,1% 46%,6% 38%,0 31%,5% 24%,1% 17%,6% 11%,1% 5%)",
        }}
      >
        <div
          className="absolute inset-0 opacity-65"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg,transparent 0,transparent 31px,rgb(245 158 11 / 15%) 32px,rgb(245 158 11 / 15%) 33px)",
          }}
        />
        <div className="absolute right-[13%] top-[14%] rotate-6 text-6xl font-black text-amber-600/20">
          Σ
        </div>
        <div className="absolute right-[16%] top-[34%] -rotate-3 text-5xl font-black text-orange-600/15">
          x²
        </div>
        <div className="absolute bottom-[25%] right-[10%] rotate-12 text-7xl font-black text-amber-700/15">
          ∞
        </div>
        <div className="absolute bottom-[10%] right-[23%] -rotate-6 text-4xl font-black text-orange-700/20">
          7 × 8
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scaleY: 0 }}
        animate={{ opacity: isOpening ? 0 : 1, scaleY: isOpening ? 0.8 : 1 }}
        transition={{ duration: panelDuration * 0.7, ease: "easeOut" }}
        className="absolute inset-y-0 left-1/2 z-10 w-1 -translate-x-1/2 origin-top bg-gradient-to-b from-transparent via-sky-300 to-transparent shadow-[0_0_18px_rgb(14_165_233_/_30%)]"
      />

      {tearFibers.map((fiber, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 0, scale: 0.2, x: 0 }}
          animate={
            isOpening
              ? {
                  opacity: 0,
                  scale: 1.4,
                  x: index % 2 === 0 ? -70 : 70,
                  y: index % 3 === 0 ? -18 : 16,
                }
              : { opacity: 0.8, scale: 1, x: 0, y: 0 }
          }
          transition={{
            delay: isOpening ? fiber.delay : panelDuration * 0.35 + fiber.delay,
            duration: panelDuration * 0.55,
            ease: "easeOut",
          }}
          className="absolute z-10 h-1.5 w-7 rounded-full bg-white shadow-sm"
          style={{
            left: fiber.left,
            rotate: `${fiber.rotate}deg`,
            top: fiber.top,
          }}
        />
      ))}
    </div>
  );
}
