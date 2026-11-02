import React from "react";
import { ArrowUpRight, ArrowDownRight, Minus, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { calcPercentChange } from "../dashboardFormat";

interface StatCardProps {
  title: string;
  value: string;
  numericValue?: number;
  subValue?: string;
  previousValue?: number;
  icon?: React.ReactNode;
  isMainHighlight?: boolean;
  styleMode?: "glass" | "darkteal";
  accentColor?: "teal" | "amber" | "blue" | "rose" | "emerald";
  sparklineData?: number[];
  onClick?: () => void;
  isLight?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  numericValue,
  subValue,
  previousValue,
  icon,
  isMainHighlight = false,
  styleMode = "glass",
  accentColor = "teal",
  sparklineData,
  onClick,
  isLight = false,
}) => {
  const change = previousValue !== undefined && numericValue !== undefined
    ? calcPercentChange(numericValue, previousValue)
    : null;

  // Accents for Dark Teal cards
  const topBorderMap = {
    teal: "border-t-2 border-t-teal-400",
    amber: "border-t-2 border-t-amber-400",
    blue: "border-t-2 border-t-blue-400",
    rose: "border-t-2 border-t-rose-400",
    emerald: "border-t-2 border-t-emerald-400",
  };

  const bgStyle = isMainHighlight
    ? isLight
      ? "bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md border-emerald-500"
      : "bg-gradient-to-br from-emerald-600/90 via-teal-700/80 to-slate-900/90 text-white shadow-lg shadow-emerald-500/20 border-emerald-400/30"
    : isLight
    ? `bg-white hover:bg-slate-50 border-slate-200/90 text-slate-900 shadow-sm ${topBorderMap[accentColor]}`
    : styleMode === "glass"
    ? "bg-white/[0.08] hover:bg-white/[0.12] backdrop-blur-xl border-white/10 text-white shadow-lg"
    : `bg-slate-900/80 hover:bg-slate-900 border-slate-800 text-slate-100 ${topBorderMap[accentColor]}`;

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl sm:rounded-3xl p-5 border transition-all ${bgStyle} ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs font-bold tracking-wider uppercase ${
          isMainHighlight ? "text-emerald-100" : isLight ? "text-slate-600" : "text-slate-300/80"
        }`}>
          {title}
        </span>
        {icon && (
          <span className={`p-2 rounded-xl ${
            isMainHighlight ? "bg-white/20 text-white" : isLight ? "bg-slate-100 text-slate-700 border border-slate-200" : "bg-white/10 text-slate-200"
          }`}>
            {icon}
          </span>
        )}
      </div>

      <div className="space-y-1">
        <div className={`text-2xl sm:text-3xl font-black tracking-tight ${
          isMainHighlight ? "text-white" : isLight ? "text-slate-900" : "text-white"
        }`}>
          {value}
        </div>

        <div className="flex items-center justify-between pt-1">
          {subValue && (
            <span className={`text-xs font-semibold ${
              isMainHighlight ? "text-emerald-100" : isLight ? "text-slate-600" : "text-slate-300/90"
            }`}>
              {subValue}
            </span>
          )}

          {change && (
            <div
              className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                change.direction === "up"
                  ? isLight
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                  : change.direction === "down"
                  ? isLight
                    ? "bg-rose-50 text-rose-800 border-rose-300"
                    : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                  : isLight
                  ? "bg-slate-100 text-slate-800 border-slate-300"
                  : "bg-slate-500/20 text-slate-300 border-slate-500/30"
              }`}
            >
              {change.direction === "up" && <ArrowUpRight className="h-3 w-3" />}
              {change.direction === "down" && <ArrowDownRight className="h-3 w-3" />}
              {change.direction === "flat" && <Minus className="h-3 w-3" />}
              <span>{change.value}% vs yesterday</span>
            </div>
          )}
        </div>
      </div>

      {/* Decorative Sparkline SVG */}
      {sparklineData && sparklineData.length > 1 && (
        <div className="mt-3 pt-2 border-t border-white/5 h-8 flex items-end">
          <svg className="w-full h-6 overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 24">
            <polyline
              fill="none"
              stroke={isMainHighlight ? "#a7f3d0" : accentColor === "teal" ? "#2dd4bf" : "#f59e0b"}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={sparklineData
                .map((val, idx) => {
                  const max = Math.max(...sparklineData, 1);
                  const x = (idx / (sparklineData.length - 1)) * 100;
                  const y = 22 - (val / max) * 18;
                  return `${x},${y}`;
                })
                .join(" ")}
            />
          </svg>
        </div>
      )}
    </motion.div>
  );
};

