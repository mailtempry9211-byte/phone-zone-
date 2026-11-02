import React from "react";
import { Smartphone, Check } from "lucide-react";
import { motion } from "framer-motion";

export const STAGES = [
  { key: "received", label: "Received" },
  { key: "diagnosing", label: "Diagnosing" },
  { key: "waiting_parts", label: "Waiting Parts" },
  { key: "in_progress", label: "Repairing" },
  { key: "ready", label: "Ready" },
  { key: "delivered", label: "Delivered" },
];

interface RepairStageTrackProps {
  currentStage: string;
  reduceMotion?: boolean;
}

export const RepairStageTrack: React.FC<RepairStageTrackProps> = ({
  currentStage,
  reduceMotion = false,
}) => {
  const currentIndex = Math.max(
    0,
    STAGES.findIndex((s) => s.key === currentStage)
  );

  const fillPercent = (currentIndex / (STAGES.length - 1)) * 100;

  return (
    <div className="py-3 px-2 w-full">
      <div className="relative flex items-center justify-between">
        {/* Background track line */}
        <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-800 -translate-y-1/2 z-0 rounded-full" />

        {/* Animated Active Teal Fill Line */}
        <motion.div
          className="absolute top-1/2 left-0 h-1 bg-gradient-to-r from-teal-500 to-emerald-400 -translate-y-1/2 z-0 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${fillPercent}%` }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.8, ease: "easeInOut" }}
        />

        {/* 6 Stage Dots */}
        {STAGES.map((st, idx) => {
          const isPassed = idx < currentIndex;
          const isCurrent = idx === currentIndex;

          return (
            <div key={st.key} className="relative z-10 flex flex-col items-center">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                  isCurrent
                    ? "bg-teal-400 text-slate-950 ring-4 ring-teal-400/30 scale-110 shadow-lg shadow-teal-400/50"
                    : isPassed
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-800 text-slate-500 border border-slate-700"
                }`}
              >
                {isPassed ? <Check className="h-3 w-3 stroke-[3]" /> : idx + 1}
              </div>

              <span
                className={`text-[10px] mt-1.5 font-medium whitespace-nowrap hidden sm:block ${
                  isCurrent ? "text-teal-300 font-bold" : isPassed ? "text-slate-300" : "text-slate-500"
                }`}
              >
                {st.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

