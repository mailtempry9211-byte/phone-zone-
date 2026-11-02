import React, { useState } from "react";
import {
  Sparkles,
  TrendingUp,
  Package,
  Wrench,
  Users,
  MessageSquare,
  DollarSign,
  Search,
  Plus,
  RefreshCw,
  LayoutDashboard,
  Smartphone,
  FileText,
  Clock,
  Layers,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardOverviewData } from "./useDashboardData";
import { DashboardPrefs, StyleSwitch, loadDashboardPrefs } from "./StyleSwitch";
import { Greeting } from "./widgets/Greeting";
import { StatCard } from "./widgets/StatCard";
import { SalesChart } from "./widgets/SalesChart";
import { BrandDonut } from "./widgets/BrandDonut";
import { StockAging } from "./widgets/StockAging";
import { RepairPipeline } from "./widgets/RepairPipeline";
import { RecentInvoices } from "./widgets/RecentInvoices";
import { AlertsPanel } from "./widgets/AlertsPanel";
import { QuickActions } from "./widgets/QuickActions";
import { formatINR, formatNumberIN } from "./dashboardFormat";
import { RepairsDashboardView } from "./views/RepairsDashboardView";
import { SalesDashboardView } from "./views/SalesDashboardView";
import { PurchaseDashboardView } from "./views/PurchaseDashboardView";
import { ShoppingBag } from "lucide-react";

interface DashboardShellProps {
  data: DashboardOverviewData;
  isLoading: boolean;
  isAdmin: boolean;
  userName: string;
  themeMode?: "dark" | "light";
  onToggleThemeMode?: () => void;
  onRefresh: () => void;
  onNavigateTab: (tab: string) => void;
  onQuickAction: (action: string) => void;
}

export const DashboardShell: React.FC<DashboardShellProps> = ({
  data,
  isLoading,
  isAdmin,
  userName,
  themeMode,
  onToggleThemeMode,
  onRefresh,
  onNavigateTab,
  onQuickAction,
}) => {
  const [prefs, setPrefs] = useState<DashboardPrefs>(() => {
    try {
      if (typeof loadDashboardPrefs === "function") {
        return loadDashboardPrefs();
      }
    } catch {
      // fallback safe default
    }
    return { style: "glass", mode: "dark", reduceMotion: false };
  });

  const [activeSubView, setActiveSubView] = useState<"overview" | "sales" | "repairs" | "stock" | "purchase">("overview");
  const [chartRange, setChartRange] = useState<"week" | "month" | "year">("week");
  const [searchQuery, setSearchQuery] = useState("");

  const effectiveMode = themeMode || prefs.mode;
  const isLight = effectiveMode === "light";
  const isDarkTeal = !isLight && prefs.style === "darkteal";

  // Build sparkline arrays from series
  const salesSparkline = (data.series || []).map((s) => s.sales || 0);

  // Shell themes styling
  const rootClasses = isLight
    ? "min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-8"
    : isDarkTeal
    ? "min-h-screen bg-[#070b12] text-slate-100 p-4 sm:p-8 relative overflow-hidden"
    : "min-h-screen bg-[#0b0f19] text-white p-4 sm:p-8 relative overflow-hidden";

  return (
    <div className={rootClasses}>
      {/* Dynamic Ambient Background Blobs for Glass & Dark Teal */}
      {!isLight && prefs.style === "glass" && (
        <>
          <div className="absolute top-10 left-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute top-40 right-10 w-96 h-96 bg-amber-500/10 rounded-full blur-[130px] pointer-events-none" />
          <div className="absolute bottom-20 left-1/3 w-96 h-96 bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />
        </>
      )}

      {!isLight && isDarkTeal && (
        <>
          <div className="absolute top-0 left-0 w-[30rem] h-[30rem] bg-teal-500/10 rounded-full blur-[140px] pointer-events-none" />
          <div className="absolute top-0 right-1/4 w-[24rem] h-[24rem] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />
        </>
      )}

      <div className="relative z-10 max-w-7xl mx-auto space-y-6 sm:space-y-8">
        {/* Top Header & Bar */}
        <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b ${
          isLight ? "border-slate-300" : "border-white/10"
        }`}>
          <div className="flex items-center gap-3">
            <span className={`font-mono text-xs uppercase tracking-wider ${isLight ? "text-slate-600" : "text-slate-400"}`}>
              Workspace / <span className={`font-bold ${isLight ? "text-slate-900" : "text-white"}`}>Dashboard Overview</span>
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Backend Live" />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Actions Bar */}
            <QuickActions
              hasRepairs={data.repairs.available}
              styleMode={prefs.style}
              isLight={isLight}
              onNewSale={() => onQuickAction("new_sale")}
              onNewRepair={() => onQuickAction("new_repair")}
              onAddPhone={() => onQuickAction("add_phone")}
              onAddCustomer={() => onQuickAction("add_customer")}
              onScanImei={() => onQuickAction("scan_imei")}
            />

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className={`h-9 px-3 rounded-xl border transition-colors ${
                isLight
                  ? "bg-white border-slate-300 text-slate-800 hover:bg-slate-100 shadow-xs"
                  : "bg-black/20 border-white/10 text-slate-300 hover:text-white"
              }`}
              title="Refresh Dashboard Numbers"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </Button>

            {/* Visual Style Switcher & Synchronized Dark/Light Toggle */}
            <StyleSwitch
              prefs={prefs}
              onChangePrefs={setPrefs}
              themeMode={effectiveMode}
              onToggleThemeMode={onToggleThemeMode}
            />
          </div>
        </div>

        {/* 1. IST Greeting Banner & Natural Language Summary */}
        <Greeting userName={userName} data={data} isDarkTeal={isDarkTeal} isLight={isLight} />

        {/* 2. Sub-views Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: "overview", label: "Executive Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
            { id: "sales", label: "Sales & Revenue", icon: <TrendingUp className="h-4 w-4" /> },
            { id: "purchase", label: "Purchase & Valuations", icon: <ShoppingBag className="h-4 w-4" /> },
            ...(isAdmin ? [{ id: "repairs", label: "Repairs Pipeline", icon: <Wrench className="h-4 w-4" /> }] : []),
            { id: "stock", label: "Inventory & Brands", icon: <Package className="h-4 w-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubView(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeSubView === tab.id
                  ? isLight
                    ? "bg-slate-900 text-white shadow-md shadow-slate-900/20"
                    : isDarkTeal
                    ? "bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20"
                    : "bg-white/20 text-white backdrop-blur-md shadow-lg border border-white/20"
                  : isLight
                  ? "bg-white text-slate-800 hover:text-black border border-slate-300 font-bold shadow-xs hover:bg-slate-100"
                  : "bg-black/20 text-slate-400 hover:text-slate-200 border border-white/5"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* 3. Executive Overview Content */}
        {activeSubView === "overview" && (
          <div className="space-y-6">
            {/* Primary Key Metric Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {/* Main Card: Today's Sales */}
              <StatCard
                title="Today's Sales"
                value={formatINR(data.today.salesAmount)}
                numericValue={data.today.salesAmount}
                previousValue={data.yesterday.salesAmount}
                subValue={`${data.today.phonesSold} phone${data.today.phonesSold === 1 ? "" : "s"} sold today`}
                icon={<TrendingUp className="h-4 w-4" />}
                isMainHighlight={!isLight && prefs.style === "glass"}
                styleMode={prefs.style}
                accentColor="emerald"
                sparklineData={salesSparkline}
                isLight={isLight}
                onClick={() => setActiveSubView("sales")}
              />

              {/* Today's Profit (Admin Only) */}
              {isAdmin && data.today.profit !== undefined && (
                <StatCard
                  title="Today's Profit"
                  value={formatINR(data.today.profit)}
                  numericValue={data.today.profit}
                  previousValue={data.yesterday.profit}
                  subValue="Net margin after cost"
                  icon={<DollarSign className="h-4 w-4 text-emerald-400" />}
                  styleMode={prefs.style}
                  accentColor="teal"
                  isLight={isLight}
                  onClick={() => setActiveSubView("sales")}
                />
              )}

              {/* Phones in Stock */}
              <StatCard
                title="Phones in Stock"
                value={`${formatNumberIN(data.stock.count)}`}
                numericValue={data.stock.count}
                subValue={
                  isAdmin && data.stock.value !== undefined
                    ? `Worth ${formatINR(data.stock.value)}`
                    : "Active catalog ready"
                }
                icon={<Package className="h-4 w-4 text-cyan-400" />}
                styleMode={prefs.style}
                accentColor="blue"
                isLight={isLight}
                onClick={() => setActiveSubView("stock")}
              />

              {/* Repairs Pending / Ready */}
              <StatCard
                title="Repairs in Queue"
                value={`${data.repairs.pending}`}
                subValue={
                  data.repairs.readyForDelivery > 0
                    ? `${data.repairs.readyForDelivery} ready for delivery!`
                    : "Active workshop jobs"
                }
                icon={<Wrench className="h-4 w-4 text-amber-400" />}
                styleMode={prefs.style}
                accentColor="amber"
                isLight={isLight}
                onClick={() => setActiveSubView("repairs")}
              />

              {/* Repair Balance Due */}
              {isAdmin && data.repairs.balanceDue !== undefined && (
                <StatCard
                  title="Repair Balance Due"
                  value={formatINR(data.repairs.balanceDue)}
                  numericValue={data.repairs.balanceDue}
                  subValue="Outstanding on open jobs"
                  icon={<ShieldCheck className="h-4 w-4 text-purple-400" />}
                  styleMode={prefs.style}
                  accentColor="rose"
                  isLight={isLight}
                  onClick={() => setActiveSubView("repairs")}
                />
              )}

              {/* Repair Revenue (Item 8) */}
              {isAdmin && (
                <StatCard
                  title="Repair Revenue"
                  value={formatINR(data.repairs.totalRevenue || 0)}
                  numericValue={data.repairs.totalRevenue || 0}
                  subValue={
                    data.repairs.todayDelivered && data.repairs.todayDelivered > 0
                      ? `${data.repairs.todayDelivered} delivered today (${formatINR(data.repairs.todayRevenue || 0)})`
                      : `${data.repairs.totalDelivered || 0} total delivered repairs`
                  }
                  icon={<Wrench className="h-4 w-4 text-emerald-400" />}
                  styleMode={prefs.style}
                  accentColor="emerald"
                  isLight={isLight}
                  onClick={() => setActiveSubView("repairs")}
                />
              )}

              {/* Customers & Sellers */}
              <StatCard
                title="Customer Base"
                value={`${data.people.customers}`}
                subValue={`+${data.people.newCustomers30d} new in last 30 days`}
                icon={<Users className="h-4 w-4 text-indigo-400" />}
                styleMode={prefs.style}
                accentColor="teal"
                isLight={isLight}
                onClick={() => onNavigateTab("customers")}
              />

              {/* Unread Messages */}
              <StatCard
                title="Website Inquiries"
                value={`${data.messages.unread}`}
                subValue="Unread customer messages"
                icon={<MessageSquare className="h-4 w-4 text-emerald-400" />}
                styleMode={prefs.style}
                accentColor="emerald"
                isLight={isLight}
                onClick={() => onNavigateTab("messages")}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8">
                <SalesChart
                  series={data.series}
                  range={chartRange}
                  onChangeRange={setChartRange}
                  showProfit={isAdmin}
                  styleMode={prefs.style}
                  isLight={isLight}
                />
              </div>
              <div className="lg:col-span-4">
                <AlertsPanel
                  alerts={data.alerts}
                  styleMode={prefs.style}
                  isLight={isLight}
                  onNavigateTab={onNavigateTab}
                />
              </div>
            </div>

            {isAdmin && (
              <RepairPipeline
                repairs={data.repairs}
                styleMode={prefs.style}
                isLight={isLight}
                onSelectJob={() => setActiveSubView("repairs")}
                onOpenRepairsTab={() => onNavigateTab("repairs")}
              />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4">
                <BrandDonut
                  brands={data.brands}
                  totalStock={data.stock.count}
                  styleMode={prefs.style}
                  isLight={isLight}
                />
              </div>
              <div className="lg:col-span-4">
                <StockAging
                  buckets={data.stock.agingBuckets}
                  totalStock={data.stock.count}
                  styleMode={prefs.style}
                  isLight={isLight}
                />
              </div>
              <div className="lg:col-span-4">
                <RecentInvoices
                  invoices={data.recentInvoices}
                  styleMode={prefs.style}
                  isLight={isLight}
                  onSelectInvoice={() => onNavigateTab("invoices")}
                />
              </div>
            </div>
          </div>
        )}

        {/* 4. Full Dedicated Sales & Revenue Dashboard View */}
        {activeSubView === "sales" && (
          <SalesDashboardView
            data={data}
            styleMode={prefs.style}
            isLight={isLight}
            isAdmin={isAdmin}
            chartRange={chartRange}
            onChangeRange={setChartRange}
            onNavigateTab={onNavigateTab}
            onQuickAction={onQuickAction}
          />
        )}

        {/* 5. Full Dedicated Repair Workshop Operations Dashboard View */}
        {activeSubView === "repairs" && (
          <RepairsDashboardView
            data={data}
            styleMode={prefs.style}
            isLight={isLight}
            onNavigateTab={onNavigateTab}
            onQuickAction={onQuickAction}
          />
        )}

        {/* 6. Inventory & Stock Command Center */}
        {activeSubView === "stock" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <BrandDonut
                brands={data.brands}
                totalStock={data.stock.count}
                styleMode={prefs.style}
                isLight={isLight}
              />
              <StockAging
                buckets={data.stock.agingBuckets}
                totalStock={data.stock.count}
                styleMode={prefs.style}
                isLight={isLight}
              />
            </div>
          </div>
        )}

        {/* 7. Full Dedicated Purchase Valuation & Stock Inflow View (Item 7) */}
        {activeSubView === "purchase" && (
          <PurchaseDashboardView
            data={data}
            styleMode={prefs.style}
            isLight={isLight}
            isAdmin={isAdmin}
            onNavigateTab={onNavigateTab}
            onQuickAction={onQuickAction}
          />
        )}
      </div>
    </div>
  );
};

