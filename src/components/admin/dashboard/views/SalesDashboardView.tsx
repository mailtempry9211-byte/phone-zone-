import React from "react";
import {
  TrendingUp,
  ShoppingCart,
  DollarSign,
  Package,
  Calendar,
  ExternalLink,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatNumberIN, formatRelativeTime } from "../dashboardFormat";
import { DashboardOverviewData } from "../useDashboardData";
import { SalesChart } from "../widgets/SalesChart";

interface SalesDashboardViewProps {
  data: DashboardOverviewData;
  styleMode?: "glass" | "darkteal";
  isLight?: boolean;
  isAdmin?: boolean;
  chartRange: "week" | "month" | "year";
  onChangeRange: (r: "week" | "month" | "year") => void;
  onNavigateTab: (tab: string) => void;
  onQuickAction: (action: string) => void;
}

export const SalesDashboardView: React.FC<SalesDashboardViewProps> = ({
  data,
  styleMode = "glass",
  isLight = false,
  isAdmin = true,
  chartRange,
  onChangeRange,
  onNavigateTab,
  onQuickAction,
}) => {
  const rangeSales = (data.series || []).reduce((acc, curr) => acc + (curr.sales || 0), 0);
  const rangeSold = (data.series || []).reduce((acc, curr) => acc + (curr.count || 0), 0);
  const rangeProfit = (data.series || []).reduce((acc, curr) => acc + (curr.profit || 0), 0);

  const totalSales = chartRange === "year" ? (data.fyTotals?.revenue ?? rangeSales) : (rangeSales || data.fyTotals?.revenue || 0);
  const totalSold = chartRange === "year" ? (data.fyTotals?.soldCount ?? rangeSold) : (rangeSold || data.fyTotals?.soldCount || 0);
  const totalProfit = chartRange === "year" ? (data.fyTotals?.profit ?? rangeProfit) : (rangeProfit || data.fyTotals?.profit || 0);
  const avgSellingPrice = totalSold > 0 ? Math.round(totalSales / totalSold) : 0;

  // Filter sales invoices from recentInvoices
  const salesInvoices = (data.recentInvoices || []).filter((inv) => inv.type === "sale");
  const purchaseInvoices = (data.recentInvoices || []).filter((inv) => inv.type === "purchase");

  return (
    <div className="space-y-6">
      {/* 1. Header with Direct Action Triggers */}
      <div className={`p-6 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm ${
        isLight
          ? "bg-white border-slate-200/90 text-slate-900"
          : "bg-slate-900/80 border-slate-800 text-white"
      }`}>
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h2 className={`text-xl font-extrabold ${isLight ? "text-slate-900" : "text-white"}`}>
                Sales & Revenue Analytics
              </h2>
              <p className={`text-xs font-medium ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                Commercial performance, turnover velocity, gross margin, and shop transactions
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            size="sm"
            onClick={() => onQuickAction("new_sale")}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Record New Sale
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigateTab("sold")}
            className={`text-xs font-bold rounded-xl border ${
              isLight
                ? "bg-slate-50 border-slate-300 text-slate-800 hover:bg-slate-100"
                : "bg-slate-800 border-slate-700 text-slate-200 hover:text-white"
            }`}
          >
            Sold Phones Directory
            <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigateTab("accounting")}
            className={`text-xs font-bold rounded-xl border ${
              isLight
                ? "bg-slate-50 border-slate-300 text-slate-800 hover:bg-slate-100"
                : "bg-slate-800 border-slate-700 text-slate-200 hover:text-white"
            }`}
          >
            Sales Accounting & P&L
            <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </div>
      </div>

      {/* 2. Top Metric KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Range Revenue */}
        <div className={`p-5 rounded-2xl border ${
          isLight ? "bg-white border-slate-200 shadow-sm" : "bg-slate-900/80 border-slate-800"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-bold uppercase tracking-wider ${isLight ? "text-slate-600" : "text-slate-400"}`}>
              {chartRange === "week" ? "Last 7 Days Revenue" : chartRange === "month" ? "Last 30 Days Revenue" : "FY Total Revenue"}
            </span>
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>
          <div className={`text-3xl font-black ${isLight ? "text-slate-900" : "text-white"}`}>
            {formatINR(totalSales)}
          </div>
          <p className={`text-xs mt-1 font-semibold ${isLight ? "text-slate-600" : "text-slate-400"}`}>
            {totalSold} phone{totalSold === 1 ? "" : "s"} sold in this window
          </p>
        </div>

        {/* Average Selling Price (ASP) */}
        <div className={`p-5 rounded-2xl border ${
          isLight ? "bg-white border-slate-200 shadow-sm" : "bg-slate-900/80 border-slate-800"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-bold uppercase tracking-wider ${isLight ? "text-slate-600" : "text-slate-400"}`}>
              Average Selling Price (ASP)
            </span>
            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Package className="h-4 w-4" />
            </span>
          </div>
          <div className={`text-3xl font-black ${isLight ? "text-slate-900" : "text-white"}`}>
            {formatINR(avgSellingPrice)}
          </div>
          <p className={`text-xs mt-1 font-semibold ${isLight ? "text-slate-600" : "text-slate-400"}`}>
            Per device realization across inventory
          </p>
        </div>

        {/* Net Profit Margin */}
        {isAdmin && (
          <div className={`p-5 rounded-2xl border ${
            isLight ? "bg-white border-slate-200 shadow-sm" : "bg-slate-900/80 border-slate-800"
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-bold uppercase tracking-wider ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                Estimated Net Profit
              </span>
              <span className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                <DollarSign className="h-4 w-4" />
              </span>
            </div>
            <div className={`text-3xl font-black text-emerald-600 dark:text-emerald-400`}>
              {formatINR(totalProfit)}
            </div>
            <p className={`text-xs mt-1 font-semibold ${isLight ? "text-slate-600" : "text-slate-400"}`}>
              {totalSales > 0 ? `${Math.round((totalProfit / totalSales) * 100)}% margin on sales` : "No sold transactions yet"}
            </p>
          </div>
        )}

        {/* Inventory Value Ready */}
        <div className={`p-5 rounded-2xl border ${
          isLight ? "bg-white border-slate-200 shadow-sm" : "bg-slate-900/80 border-slate-800"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-bold uppercase tracking-wider ${isLight ? "text-slate-600" : "text-slate-400"}`}>
              Active Stock Worth
            </span>
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ShoppingCart className="h-4 w-4" />
            </span>
          </div>
          <div className={`text-3xl font-black ${isLight ? "text-slate-900" : "text-white"}`}>
            {formatINR(data.stock.value || 0)}
          </div>
          <p className={`text-xs mt-1 font-semibold ${isLight ? "text-slate-600" : "text-slate-400"}`}>
            {data.stock.count} phones available in store
          </p>
        </div>
      </div>

      {/* 3. Interactive Sales Velocity Chart */}
      <SalesChart
        series={data.series}
        range={chartRange}
        onChangeRange={onChangeRange}
        showProfit={isAdmin}
        styleMode={styleMode}
        isLight={isLight}
      />

      {/* 4. Recent Commercial Activity Table */}
      <div className={`p-6 rounded-3xl border shadow-sm ${
        isLight ? "bg-white border-slate-200/90 text-slate-900" : "bg-slate-900/80 border-slate-800 text-white"
      }`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className={`font-extrabold text-base ${isLight ? "text-slate-900" : "text-white"}`}>
              Recent Commercial Invoices (Sales & Purchases)
            </h3>
            <p className={`text-xs font-medium ${isLight ? "text-slate-600" : "text-slate-400"}`}>
              Audited shop transactions for current financial year
            </p>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => onNavigateTab("invoices")}
            className={`text-xs font-bold rounded-xl ${
              isLight ? "bg-slate-50 border-slate-300 text-slate-800" : "bg-slate-800 border-slate-700 text-slate-200"
            }`}
          >
            All Invoices
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className={`border-b ${isLight ? "border-slate-200 text-slate-500" : "border-slate-800 text-slate-400"}`}>
                <th className="py-2.5 font-bold uppercase tracking-wider">Invoice #</th>
                <th className="py-2.5 font-bold uppercase tracking-wider">Type</th>
                <th className="py-2.5 font-bold uppercase tracking-wider">Party / Customer</th>
                <th className="py-2.5 font-bold uppercase tracking-wider text-right">Amount</th>
                <th className="py-2.5 font-bold uppercase tracking-wider text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {data.recentInvoices.map((inv) => (
                <tr key={inv.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors`}>
                  <td className="py-3 font-mono font-bold text-slate-900 dark:text-white">
                    {inv.number}
                  </td>
                  <td className="py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                      inv.type === "sale"
                        ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                        : "bg-blue-100 text-blue-900 border-blue-300"
                    }`}>
                      {inv.type}
                    </span>
                  </td>
                  <td className="py-3 font-semibold text-slate-700 dark:text-slate-300">
                    {inv.party}
                  </td>
                  <td className="py-3 text-right font-mono font-black text-slate-900 dark:text-white text-sm">
                    {formatINR(inv.amount)}
                  </td>
                  <td className="py-3 text-right font-mono text-slate-500 dark:text-slate-400">
                    {formatRelativeTime(inv.date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default SalesDashboardView;

