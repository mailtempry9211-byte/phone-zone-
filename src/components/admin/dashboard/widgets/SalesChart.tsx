import React, { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { formatINR } from "../dashboardFormat";

interface SalesChartProps {
  series: Array<{
    label: string;
    date: string;
    sales: number;
    profit?: number;
    count: number;
  }>;
  range: "week" | "month" | "year";
  onChangeRange: (r: "week" | "month" | "year") => void;
  showProfit?: boolean;
  styleMode?: "glass" | "darkteal";
  isLight?: boolean;
}

export const SalesChart: React.FC<SalesChartProps> = ({
  series,
  range,
  onChangeRange,
  showProfit = false,
  styleMode = "glass",
  isLight = false,
}) => {
  const [activeMetric, setActiveMetric] = useState<"sales" | "both">("both");

  const totalSales = series.reduce((acc, curr) => acc + (curr.sales || 0), 0);
  const totalProfit = series.reduce((acc, curr) => acc + (curr.profit || 0), 0);
  const totalVolume = series.reduce((acc, curr) => acc + (curr.count || 0), 0);

  const containerStyle = isLight
    ? "bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-sm text-slate-900"
    : styleMode === "glass"
    ? "bg-white/[0.08] backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl text-white"
    : "bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl text-white";

  return (
    <div className={containerStyle}>
      {/* Header with Segmented Range Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h3 className={`font-extrabold text-lg ${isLight ? "text-slate-900" : "text-white"}`}>
              Sales & Revenue Velocity
            </h3>
            {showProfit && (
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                isLight ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
              }`}>
                PROFIT VISIBLE
              </span>
            )}
          </div>
          <p className={`text-xs mt-0.5 font-medium ${isLight ? "text-slate-600" : "text-slate-400"}`}>
            Total {formatINR(totalSales)} revenue ({totalVolume} phones)
            {showProfit ? ` • Net Profit ${formatINR(totalProfit)}` : ""}
          </p>
        </div>

        {/* Range Buttons */}
        <div className={`inline-flex p-1 rounded-xl self-start sm:self-auto text-xs font-bold border ${
          isLight ? "bg-slate-100 border-slate-200/90 text-slate-700" : "bg-black/30 border-white/10 text-slate-400"
        }`}>
          <button
            onClick={() => onChangeRange("week")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              range === "week"
                ? isLight
                  ? "bg-teal-600 text-white font-bold shadow-xs"
                  : "bg-teal-500 text-slate-950 font-bold shadow-xs"
                : isLight
                ? "text-slate-600 hover:text-slate-900 font-medium"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => onChangeRange("month")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              range === "month"
                ? isLight
                  ? "bg-teal-600 text-white font-bold shadow-xs"
                  : "bg-teal-500 text-slate-950 font-bold shadow-xs"
                : isLight
                ? "text-slate-600 hover:text-slate-900 font-medium"
                : "text-slate-400 hover:text-white"
            }`}
          >
            30 Days
          </button>
          <button
            onClick={() => onChangeRange("year")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              range === "year"
                ? isLight
                  ? "bg-teal-600 text-white font-bold shadow-xs"
                  : "bg-teal-500 text-slate-950 font-bold shadow-xs"
                : isLight
                ? "text-slate-600 hover:text-slate-900 font-medium"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Financial Year
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-64 sm:h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke={isLight ? "#e2e8f0" : "#ffffff10"} vertical={false} />

            <XAxis
              dataKey="label"
              stroke={isLight ? "#475569" : "#94a3b8"}
              fontSize={11}
              fontWeight={600}
              tickLine={false}
              axisLine={false}
              dy={10}
            />

            <YAxis
              stroke={isLight ? "#475569" : "#94a3b8"}
              fontSize={11}
              fontWeight={600}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
              dx={-5}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload;
                  return (
                    <div className={`rounded-xl p-3 shadow-2xl text-xs space-y-1 border ${
                      isLight
                        ? "bg-white border-slate-200 text-slate-900"
                        : "bg-slate-900/95 border-slate-700/80 text-white"
                    }`}>
                      <div className={`font-bold pb-1 border-b ${isLight ? "text-slate-900 border-slate-200" : "text-white border-slate-800"}`}>
                        {item.label} ({item.date})
                      </div>
                      <div className="text-teal-600 dark:text-teal-400 flex items-center justify-between gap-4 font-semibold">
                        <span>Sales:</span>
                        <span className="font-bold">{formatINR(item.sales)}</span>
                      </div>
                      <div className={`${isLight ? "text-slate-600" : "text-slate-300"} flex items-center justify-between gap-4`}>
                        <span>Phones:</span>
                        <span className="font-bold">{item.count} sold</span>
                      </div>
                      {showProfit && item.profit !== undefined && (
                        <div className={`flex items-center justify-between gap-4 pt-1 border-t text-emerald-600 dark:text-emerald-400 font-semibold ${
                          isLight ? "border-slate-200" : "border-slate-800"
                        }`}>
                          <span>Profit:</span>
                          <span className="font-bold">{formatINR(item.profit)}</span>
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />

            <Area
              type="monotone"
              dataKey="sales"
              name="Sales"
              stroke="#14b8a6"
              strokeWidth={2.5}
              fill="url(#salesGrad)"
            />

            {showProfit && (
              <Area
                type="monotone"
                dataKey="profit"
                name="Profit"
                stroke="#10b981"
                strokeWidth={2}
                strokeDasharray="4 4"
                fill="url(#profitGrad)"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

