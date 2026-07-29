"use client";

import { motion } from "framer-motion";
import type { QuizTransitionEffectProps } from "@/features/student/lessons/utils/quiz-transition-variant";

const inkDrops = Array.from({ length: 22 }, (_, index) => ({
  delay: (index % 7) * 0.025,
  left: `${5 + ((index * 37) % 90)}%`,
  size: 5 + (index % 5) * 3,
  top: `${7 + ((index * 31) % 86)}%`,
}));

export function InkSpreadEffect({ panelDuration, phase }: QuizTransitionEffectProps) {
  const isOpening = phase === "opening";

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <motion.div
        initial={{ opacity: 0, rotate: 3, y: "108%" }}
        animate={
          isOpening
            ? { opacity: 1, rotate: -3, x: "0%", y: "-108%" }
            : { opacity: 1, rotate: 0, x: "0%", y: "0%" }
        }
        transition={{ duration: panelDuration, ease: [0.76, 0, 0.24, 1] }}
        className="absolute -inset-[4%] overflow-hidden bg-[#fffdf6] shadow-[0_0_65px_rgb(15_23_42_/_45%)] [will-change:transform,opacity] dark:bg-slate-50"
      >
        <div className="absolute bottom-0 left-[14%] top-0 w-0.5 bg-red-300/45" />
        <div
          className="absolute inset-0 opacity-80"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg,transparent 0,transparent 37px,rgb(14 165 233 / 16%) 38px,rgb(14 165 233 / 16%) 39px)",
          }}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.28, scale: 1 }}
          transition={{
            delay: panelDuration * 0.16,
            duration: panelDuration * 0.78,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="absolute -left-[18%] top-[22%] h-72 w-72 rounded-full bg-gradient-to-br from-sky-300 via-blue-500 to-blue-700 blur-[2px]"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.24, scale: 1 }}
          transition={{
            delay: panelDuration * 0.24,
            duration: panelDuration * 0.72,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="absolute -right-[22%] bottom-[12%] h-80 w-80 rounded-full bg-gradient-to-br from-teal-300 via-cyan-500 to-sky-700 blur-[2px]"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.24, scale: 1 }}
          transition={{
            delay: panelDuration * 0.31,
            duration: panelDuration * 0.66,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="absolute left-[35%] top-[6%] h-40 w-40 rounded-full bg-amber-400/80 mix-blend-multiply"
        />

        <motion.svg
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.75 }}
          transition={{ delay: panelDuration * 0.24, duration: panelDuration * 0.65 }}
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 390 844"
          preserveAspectRatio="none"
        >
          <motion.path
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{
              delay: panelDuration * 0.18,
              duration: panelDuration * 0.72,
              ease: "easeInOut",
            }}
            d="M20 235 C95 160 158 310 242 205 C298 134 345 172 382 118"
            fill="none"
            stroke="#0ea5e9"
            strokeLinecap="round"
            strokeWidth="13"
          />
          <motion.path
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{
              delay: panelDuration * 0.26,
              duration: panelDuration * 0.66,
              ease: "easeInOut",
            }}
            d="M-10 604 C82 530 133 695 220 590 C284 514 335 598 410 530"
            fill="none"
            stroke="#0f766e"
            strokeLinecap="round"
            strokeWidth="16"
          />
          <motion.path
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{
              delay: panelDuration * 0.34,
              duration: panelDuration * 0.58,
              ease: "easeInOut",
            }}
            d="M72 90 C145 55 213 142 323 70"
            fill="none"
            stroke="#f59e0b"
            strokeLinecap="round"
            strokeWidth="8"
          />
        </motion.svg>

        {inkDrops.map((drop, index) => (
          <motion.span
            key={index}
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: 0.2 + (index % 3) * 0.07,
              scale: 1,
            }}
            transition={{
              delay: panelDuration * 0.28 + drop.delay,
              duration: panelDuration * 0.45,
              ease: "easeOut",
            }}
            className="absolute rounded-full bg-blue-800"
            style={{
              height: drop.size,
              left: drop.left,
              top: drop.top,
              width: drop.size,
            }}
          />
        ))}
      </motion.div>
    </div>
  );
}
