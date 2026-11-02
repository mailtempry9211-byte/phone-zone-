import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatINR } from "../dashboardFormat";

interface BrandDonutProps {
  brands: Array<{
    name: string;
    count: number;
    value?: number;
  }>;
  totalStock: number;
  styleMode?: "glass" | "darkteal";
  isLight?: boolean;
}

const BRAND_COLORS = [
  "#38bdf8", // Sky Blue (Apple)
  "#14b8a6", // Teal (Samsung)
  "#f59e0b", // Amber (Xiaomi)
  "#ef4444", // Red (OnePlus)
  "#8b5cf6", // Purple (Vivo/Oppo)
  "#64748b", // Slate (Others)
];

export const BrandDonut: React.FC<BrandDonutProps> = ({ brands, totalStock, styleMode = "glass", isLight = false }) => {
  const containerStyle = isLight
    ? "bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm text-slate-900"
    : styleMode === "glass"
    ? "bg-white/[0.08] backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl"
    : "bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl";

  const chartData = brands.map((b) => ({
    name: b.name,
    value: b.count,
    stockValue: b.value,
  }));

  return (
    <div className={containerStyle}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className={`font-extrabold text-base ${isLight ? "text-slate-900" : "text-white"}`}>Stock by Brand</h3>
          <p className={`text-xs font-medium ${isLight ? "text-slate-600" : "text-slate-400"}`}>Inventory brand distribution</p>
        </div>
        <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full border ${
          isLight ? "bg-slate-100 text-slate-800 border-slate-300" : "bg-white/10 text-slate-300 border-white/10"
        }`}>
          {totalStock} devices
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
        {/* Donut Chart with Center Total */}
        <div className="relative w-44 h-44 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                innerRadius={50}
                outerRadius={72}
                paddingAngle={4}
                dataKey="value"
              >
                {chartData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={BRAND_COLORS[index % BRAND_COLORS.length]}
                    stroke={isLight ? "#ffffff" : "#0b0f19"}
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className={`rounded-xl p-2.5 shadow-xl text-xs space-y-0.5 border ${
                        isLight ? "bg-white border-slate-200 text-slate-900" : "bg-slate-900 border-slate-800 text-slate-100"
                      }`}>
                        <span className={`font-bold ${isLight ? "text-slate-900" : "text-white"}`}>{data.name}</span>
                        <div className={isLight ? "text-slate-600 font-medium" : "text-slate-300"}>{data.value} phones in stock</div>
                        {data.stockValue !== undefined && (
                          <div className="text-teal-600 dark:text-teal-400 font-bold">{formatINR(data.stockValue)}</div>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className={`text-2xl font-black ${isLight ? "text-slate-900" : "text-white"}`}>{totalStock}</span>
            <span className={`text-[10px] uppercase tracking-widest font-mono font-bold ${
              isLight ? "text-slate-600" : "text-slate-400"
            }`}>Stock</span>
          </div>
        </div>

        {/* Legend List */}
        <div className="w-full space-y-2">
          {brands.map((b, idx) => {
            const color = BRAND_COLORS[idx % BRAND_COLORS.length];
            const pct = totalStock > 0 ? Math.round((b.count / totalStock) * 100) : 0;
            return (
              <div key={b.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className={`font-bold ${isLight ? "text-slate-900" : "text-slate-200"}`}>{b.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`font-mono font-semibold ${isLight ? "text-slate-600" : "text-slate-400"}`}>{pct}%</span>
                  <span className={`font-black min-w-[24px] text-right ${isLight ? "text-slate-900" : "text-white"}`}>{b.count}</span>
                  {b.value !== undefined && (
                    <span className={`font-mono text-[11px] font-bold hidden sm:inline-block ${
                      isLight ? "text-teal-700" : "text-teal-400"
                    }`}>
                      {formatINR(b.value)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

