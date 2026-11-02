import React from "react";
import { Clock, AlertCircle } from "lucide-react";

interface StockAgingProps {
  buckets: {
    d0_30: number;
    d31_60: number;
    d61_90: number;
    d90plus: number;
  };
  totalStock: number;
  styleMode?: "glass" | "darkteal";
  isLight?: boolean;
}

export const StockAging: React.FC<StockAgingProps> = ({ buckets, totalStock, styleMode = "glass", isLight = false }) => {
  const containerStyle = isLight
    ? "bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm text-slate-900"
    : styleMode === "glass"
    ? "bg-white/[0.08] backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl"
    : "bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl";

  const total = Math.max(totalStock, 1);

  const tiers = [
    { label: "0–30 Days", count: buckets.d0_30, color: "bg-emerald-500", text: "Fresh Inventory", status: "optimal" },
    { label: "31–60 Days", count: buckets.d31_60, color: "bg-teal-500", text: "Healthy Rotation", status: "normal" },
    { label: "61–90 Days", count: buckets.d61_90, color: "bg-amber-500", text: "Slow Movers", status: "warning" },
    { label: "90+ Days", count: buckets.d90plus, color: "bg-rose-500", text: "Stale / Discount Needed", status: "critical" },
  ];

  return (
    <div className={containerStyle}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className={`h-4 w-4 ${isLight ? "text-amber-600" : "text-amber-400"}`} />
          <h3 className={`font-extrabold text-base ${isLight ? "text-slate-900" : "text-white"}`}>
            Stock Aging Analysis
          </h3>
        </div>
        <span className={`text-xs font-mono font-medium ${isLight ? "text-slate-600" : "text-slate-400"}`}>
          Days since purchase
        </span>
      </div>

      <div className="space-y-3.5">
        {tiers.map((t) => {
          const pct = Math.round((t.count / total) * 100);
          return (
            <div key={t.label} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`font-extrabold ${isLight ? "text-slate-900" : "text-slate-200"}`}>
                    {t.label}
                  </span>
                  <span className={`text-[11px] font-medium ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                    ({t.text})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-mono font-semibold ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                    {pct}%
                  </span>
                  <span className={`font-black ${isLight ? "text-slate-900" : "text-white"}`}>
                    {t.count} phones
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className={`h-2.5 w-full rounded-full overflow-hidden ${isLight ? "bg-slate-200" : "bg-black/30"}`}>
                <div
                  className={`h-full ${t.color} rounded-full transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

