"use client";

import { motion } from "framer-motion";
import type { QuizTransitionEffectProps } from "@/features/student/lessons/utils/quiz-transition-variant";

const compassTicks = Array.from({ length: 24 }, (_, index) => index * 15);

export function CompassPortalEffect({ panelDuration, phase }: QuizTransitionEffectProps) {
  const isOpening = phase === "opening";

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2">
        <motion.div
          initial={{ rotate: -45, scale: 0 }}
          animate={{ rotate: isOpening ? 220 : 0, scale: isOpening ? 0 : 28 }}
          transition={{ duration: panelDuration, ease: [0.76, 0, 0.24, 1] }}
          className="h-full w-full rounded-full bg-gradient-to-br from-[#fffdf8] via-sky-50 to-cyan-100 shadow-[0_0_90px_rgb(14_165_233_/_18%)] dark:from-slate-950 dark:via-sky-950 dark:to-cyan-950"
        />
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isOpening ? 0 : 0.22 }}
        transition={{ duration: panelDuration * 0.7 }}
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgb(14 165 233 / 10%) 1px,transparent 1px),linear-gradient(90deg,rgb(14 165 233 / 8%) 1px,transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <motion.div
        initial={{ opacity: 0, rotate: -160, scale: 0.35 }}
        animate={
          isOpening
            ? { opacity: 0, rotate: 210, scale: 0.25 }
            : { opacity: 1, rotate: 0, scale: 1 }
        }
        transition={{
          duration: panelDuration * (isOpening ? 0.86 : 1.08),
          ease: [0.22, 1, 0.36, 1],
        }}
        className="absolute left-1/2 top-1/2 h-[19rem] w-[19rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-700/20 sm:h-[22rem] sm:w-[22rem]"
      >
        <div className="absolute inset-4 rounded-full border-[3px] border-cyan-600/30" />
        <div className="absolute inset-9 rounded-full border border-dashed border-amber-500/40" />
        {compassTicks.map((rotation) => (
          <span
            key={rotation}
            className="absolute left-1/2 top-0 h-3 w-0.5 origin-[50%_9.5rem] bg-sky-800/35 sm:origin-[50%_11rem]"
            style={{ rotate: `${rotation}deg` }}
          />
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: isOpening ? 0 : 1, scaleX: isOpening ? 0 : 1 }}
        transition={{ delay: panelDuration * 0.26, duration: panelDuration * 0.62 }}
        className="absolute left-[7%] right-[7%] top-1/2 h-px origin-center bg-gradient-to-r from-transparent via-cyan-600/35 to-transparent"
      />
      <motion.div
        initial={{ opacity: 0, scaleY: 0 }}
        animate={{ opacity: isOpening ? 0 : 1, scaleY: isOpening ? 0 : 1 }}
        transition={{ delay: panelDuration * 0.26, duration: panelDuration * 0.62 }}
        className="absolute bottom-[7%] left-1/2 top-[7%] w-px origin-center bg-gradient-to-b from-transparent via-cyan-600/35 to-transparent"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: isOpening ? 0 : 1, scale: isOpening ? 0.82 : 1 }}
        transition={{
          delay: isOpening ? 0 : panelDuration * 0.18,
          duration: panelDuration * (isOpening ? 0.46 : 0.64),
          ease: "easeOut",
        }}
        className="absolute inset-0 origin-center"
      >
        <span className="absolute left-[8%] top-[14%] text-5xl font-black text-sky-800/15 motion-safe:animate-[spin_15s_linear_infinite]">
          45°
        </span>
        <span className="absolute right-[8%] top-[20%] text-6xl font-black text-blue-800/15 motion-safe:animate-[spin_18s_linear_infinite_reverse]">
          △
        </span>
        <span className="absolute bottom-[15%] left-[12%] text-6xl font-black text-cyan-800/15 motion-safe:animate-[spin_17s_linear_infinite_reverse]">
          ○
        </span>
        <span className="absolute bottom-[12%] right-[10%] text-5xl font-black text-amber-700/18 motion-safe:animate-[spin_14s_linear_infinite]">
          360°
        </span>
      </motion.div>
    </div>
  );
}
