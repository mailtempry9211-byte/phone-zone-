import React, { useState, useMemo } from "react";
import {
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Search,
  Plus,
  AlertTriangle,
  Users,
  Smartphone,
  ShieldCheck,
  Building2,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatNumberIN } from "../dashboardFormat";
import { DashboardOverviewData } from "../useDashboardData";

interface PurchaseDashboardViewProps {
  data: DashboardOverviewData;
  styleMode?: "glass" | "darkteal";
  isLight?: boolean;
  isAdmin?: boolean;
  onNavigateTab: (tab: string) => void;
  onQuickAction: (action: string) => void;
}

export const PurchaseDashboardView: React.FC<PurchaseDashboardViewProps> = ({
  data,
  styleMode = "glass",
  isLight = false,
  isAdmin = true,
  onNavigateTab,
  onQuickAction,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const pOverview = data.purchaseOverview;

  const modelAverages = useMemo(() => {
    if (!pOverview?.modelAverages) return [];
    if (!searchTerm.trim()) return pOverview.modelAverages;
    const term = searchTerm.toLowerCase();
    return pOverview.modelAverages.filter(
      (m) =>
        m.phone_name?.toLowerCase().includes(term) ||
        m.model?.toLowerCase().includes(term)
    );
  }, [pOverview, searchTerm]);

  const cardBg = isLight
    ? "bg-white border-slate-200 text-slate-900 shadow-sm"
    : "bg-slate-900/90 border-slate-800 text-white";

  return (
    <div className="space-y-6">
      {/* 1. Header & Stock Inflow Summary */}
      <div className={`p-6 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${cardBg}`}>
        <div>
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-emerald-500" />
            <h2 className="text-xl font-bold">Purchase & Stock Valuation Hub</h2>
          </div>
          <p className={`text-xs mt-1 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
            Track incoming stock velocity, historical purchase prices per brand/model, and supplier performance to negotiate the best rates.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => onQuickAction("add_phone")}
            className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-bold"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Buy / Add Phone
          </Button>
          <Button
            variant="outline"
            onClick={() => onNavigateTab("sellers")}
            className={`rounded-2xl text-xs font-bold border ${
              isLight
                ? "border-slate-300 text-slate-700 hover:bg-slate-100"
                : "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
            }`}
          >
            <Users className="h-4 w-4 mr-1.5" />
            Suppliers Directory
          </Button>
        </div>
      </div>

      {/* 2. Key Inflow & Low Stock Inflow Alerts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`p-5 rounded-2xl border ${cardBg}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${isLight ? "text-slate-500" : "text-slate-400"}`}>Incoming Stock (7 Days)</span>
            <ShoppingBag className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-black">
            {pOverview?.incoming7dCount || 0} <span className="text-sm font-normal text-slate-400">phones</span>
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Total Purchase Volume: {formatINR(pOverview?.incoming7dAmount || 0)}
          </div>
        </div>

        <div className={`p-5 rounded-2xl border ${cardBg}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${isLight ? "text-slate-500" : "text-slate-400"}`}>Previous 7 Days Intake</span>
            <TrendingUp className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-black">
            {pOverview?.incomingPrev7dCount || 0} <span className="text-sm font-normal text-slate-400">phones</span>
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {pOverview && pOverview.incoming7dCount >= pOverview.incomingPrev7dCount
              ? "📈 Intake trend is stable or increasing"
              : "📉 Intake slower than previous week"}
          </div>
        </div>

        <div className={`p-5 rounded-2xl border ${cardBg}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${isLight ? "text-slate-500" : "text-slate-400"}`}>Stock Inflow Alert</span>
            <AlertTriangle className={`h-4 w-4 ${pOverview?.isLowIncoming ? "text-amber-400" : "text-emerald-400"}`} />
          </div>
          <div className="mt-2">
            {pOverview?.isLowIncoming ? (
              <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs px-2 py-0.5 font-bold">
                Low Inflow Alert (&lt; 3 phones)
              </Badge>
            ) : (
              <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs px-2 py-0.5 font-bold">
                Healthy Stock Intake
              </Badge>
            )}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            {pOverview?.isLowIncoming ? "Reach out to suppliers/dealers to replenish catalog." : "Supply pace is currently sufficient."}
          </div>
        </div>

        <div className={`p-5 rounded-2xl border ${cardBg}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${isLight ? "text-slate-500" : "text-slate-400"}`}>Active Suppliers Count</span>
            <Users className="h-4 w-4 text-purple-400" />
          </div>
          <div className="mt-2 text-2xl font-black">
            {data.people.sellers || 0} <span className="text-sm font-normal text-slate-400">suppliers</span>
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {pOverview?.topSellers?.length || 0} frequent sellers on file
          </div>
        </div>
      </div>

      {/* 3. Model-Wise Historical Purchase Valuation Tool (Item 7 core requirement) */}
      <div className={`p-6 rounded-3xl border ${cardBg} space-y-4`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-cyan-400" />
              Model Valuation & Pricing Intelligence
            </h3>
            <p className={`text-xs mt-0.5 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
              Average, minimum, and maximum prices paid for each model. Use this to negotiate deals with customers and sellers.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search model (e.g. Vivo T2 Pro)..."
              className={`pl-9 h-8 text-xs rounded-xl ${
                isLight ? "bg-slate-100 border-slate-300" : "bg-slate-800 border-slate-700"
              }`}
            />
          </div>
        </div>

        {modelAverages.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No models found matching "{searchTerm}".
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className={`border-b ${isLight ? "border-slate-200 text-slate-600" : "border-slate-800 text-slate-400"}`}>
                  <th className="pb-2.5 font-bold">Model / Device Name</th>
                  <th className="pb-2.5 font-bold text-center">Purchased Count</th>
                  <th className="pb-2.5 font-bold text-right text-emerald-400">Avg Purchase Price</th>
                  <th className="pb-2.5 font-bold text-right">Price Range (Min - Max)</th>
                  <th className="pb-2.5 font-bold text-right text-cyan-400">Avg Selling Price</th>
                  <th className="pb-2.5 font-bold text-center">Expected Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {modelAverages.map((m, idx) => {
                  const margin = m.avg_selling_price > m.avg_purchase_price
                    ? m.avg_selling_price - m.avg_purchase_price
                    : 0;
                  const marginPct = m.avg_purchase_price > 0
                    ? Math.round((margin / m.avg_purchase_price) * 100)
                    : 0;

                  return (
                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 font-semibold">
                        {m.phone_name}
                        {m.model && m.model !== m.phone_name && (
                          <span className="block text-[11px] text-slate-400 font-mono">{m.model}</span>
                        )}
                      </td>
                      <td className="py-2.5 text-center font-bold">
                        <Badge
                          variant="outline"
                          className={`text-[11px] px-2.5 py-0.5 font-bold font-mono transition-colors ${
                            isLight
                              ? "bg-slate-100 border-slate-300 text-slate-800"
                              : "bg-slate-800/90 border-slate-700 text-cyan-300 shadow-xs"
                          }`}
                        >
                          {m.units_purchased}x
                        </Badge>
                      </td>
                      <td className="py-2.5 text-right font-bold text-emerald-400">
                        {formatINR(m.avg_purchase_price)}
                      </td>
                      <td className="py-2.5 text-right font-mono text-slate-400">
                        {formatINR(m.min_purchase_price)} - {formatINR(m.max_purchase_price)}
                      </td>
                      <td className="py-2.5 text-right font-bold text-cyan-400">
                        {m.avg_selling_price ? formatINR(m.avg_selling_price) : "-"}
                      </td>
                      <td className="py-2.5 text-center">
                        {margin > 0 ? (
                          <span className="text-emerald-400 font-bold">+{marginPct}% ({formatINR(margin)})</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Brand Average Purchases & Top Suppliers Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Brand-Wise Purchases */}
        <div className={`p-6 rounded-3xl border ${cardBg} space-y-3`}>
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-amber-500" />
            Brand Purchase Averages
          </h3>
          <div className="space-y-2">
            {(pOverview?.brandAverages || []).map((b, idx) => {
              const brandName = !b.brand || b.brand.toLowerCase().includes("object") ? "Other Devices" : b.brand;
              return (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-colors ${
                    isLight
                      ? "bg-slate-50 hover:bg-slate-100/90 border-slate-200 text-slate-900 shadow-xs"
                      : "bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 text-slate-100"
                  }`}
                >
                  <div>
                    <span className={`font-bold ${isLight ? "text-slate-950" : "text-white"}`}>{brandName}</span>
                    <span className={`text-[11px] ml-2 font-semibold ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                      ({b.units} units bought)
                    </span>
                  </div>
                  <div className="text-right">
                    <span className={`font-extrabold ${isLight ? "text-emerald-700" : "text-emerald-400"}`}>
                      {formatINR(b.avg_purchase_price)} avg
                    </span>
                    {b.avg_selling_price > 0 && (
                      <span className={`block text-[11px] font-medium ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                        Sells ~ {formatINR(b.avg_selling_price)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Suppliers */}
        <div className={`p-6 rounded-3xl border ${cardBg} space-y-3`}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-500" />
              Top Suppliers by Volume
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigateTab("sellers")}
              className={`text-xs h-7 font-bold ${
                isLight ? "text-cyan-700 hover:text-cyan-800 hover:bg-cyan-50" : "text-cyan-400 hover:text-cyan-300"
              }`}
            >
              All Sellers &rarr;
            </Button>
          </div>
          <div className="space-y-2">
            {(pOverview?.topSellers || []).map((s, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-colors ${
                  isLight
                    ? "bg-slate-50 hover:bg-slate-100/90 border-slate-200 text-slate-900 shadow-xs"
                    : "bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 text-slate-100"
                }`}
              >
                <div>
                  <span className={`font-bold ${isLight ? "text-slate-950" : "text-white"}`}>{s.name}</span>
                  {s.phone && (
                    <span className={`text-[11px] ml-2 font-mono font-semibold ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                      {s.phone}
                    </span>
                  )}
                  <span className={`block text-[11px] font-medium ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                    {s.phones_supplied} phones supplied
                  </span>
                </div>
                <div className="text-right">
                  <span className={`font-extrabold ${isLight ? "text-slate-950" : "text-white"}`}>
                    {formatINR(s.total_volume)}
                  </span>
                  <span className={`block text-[11px] font-medium ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                    Avg {formatINR(s.avg_ticket)}/phone
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
