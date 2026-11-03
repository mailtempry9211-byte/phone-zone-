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
import { InvoiceDetailDialog } from "./widgets/InvoiceDetailDialog";
import { AlertsPanel } from "./widgets/AlertsPanel";
import { QuickActions } from "./widgets/QuickActions";
import { formatINR, formatNumberIN } from "./dashboardFormat";
import { RepairsDashboardView } from "./views/RepairsDashboardView";
import { SalesDashboardView } from "./views/SalesDashboardView";
import { PurchaseDashboardView } from "./views/PurchaseDashboardView";
import { ShoppingBag, Calendar } from "lucide-react";

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
  currentRange?: "today" | "yesterday" | "week" | "month" | "year";
  onChangeRange?: (range: "today" | "yesterday" | "week" | "month" | "year") => void;
  selectedDate?: string;
  onChangeSelectedDate?: (date: string) => void;
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
  currentRange = "week",
  onChangeRange,
  selectedDate = "",
  onChangeSelectedDate,
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
  const [searchQuery, setSearchQuery] = useState("");
  const [viewingInvoice, setViewingInvoice] = useState<any | null>(null);

  const activeRange = currentRange || "week";
  const currentMetrics = data.periodMetrics || data.today;
  const displaySalesAmount = currentMetrics.salesAmount ?? (activeRange === "year" ? data.fyTotals?.revenue ?? 0 : data.today.salesAmount);
  const displayPhonesSold = currentMetrics.phonesSold ?? (activeRange === "year" ? data.fyTotals?.soldCount ?? 0 : data.today.phonesSold);
  const displayProfit = currentMetrics.profit ?? (activeRange === "year" ? data.fyTotals?.profit ?? 0 : data.today.profit);

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

        {/* 2. Sub-views Navigation Tabs & Universal Invoice Search */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
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

          {/* Quick Universal Invoice & Transaction Search */}
          <div className="relative min-w-[280px] sm:min-w-[340px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search Invoice # (SAL-, PUR-, RJ-)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchQuery.trim()) {
                  onQuickAction("search_invoice:" + searchQuery.trim());
                }
              }}
              className={`pl-9 pr-16 h-9 text-xs rounded-xl transition-all ${
                isLight
                  ? "bg-white border-slate-300 text-slate-900 focus:border-blue-500 shadow-xs"
                  : "bg-slate-900/80 border-slate-700/80 text-white focus:border-blue-400"
              }`}
            />
            {searchQuery.trim() && (
              <button
                type="button"
                onClick={() => onQuickAction("search_invoice:" + searchQuery.trim())}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-0.5 text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-xs cursor-pointer"
              >
                Search
              </button>
            )}
          </div>
        </div>

        {/* 3. Executive Overview Content */}
        {activeSubView === "overview" && (
          <div className="space-y-6">
            {/* Live Filter Bar: Period & Target Date Selector */}
            <div className={`p-3.5 sm:p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs ${
              isLight ? "bg-white border-slate-200 text-slate-800" : "bg-slate-900/80 border-slate-800 text-slate-200"
            }`}>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-cyan-400 shrink-0" />
                <span className="text-xs font-bold">Analytics Scope:</span>
                <span className="text-xs font-mono font-bold text-cyan-500 dark:text-cyan-400">
                  {selectedDate
                    ? `Single Day: ${selectedDate}`
                    : data.periodLabel || (activeRange === "year" ? "Full Financial Year" : activeRange === "month" ? "Last 30 Days" : activeRange === "week" ? "Last 7 Days" : activeRange === "yesterday" ? "Yesterday" : "Today")}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Period Pills */}
                <div className={`inline-flex p-1 rounded-xl text-xs font-bold border ${
                  isLight ? "bg-slate-100 border-slate-200 text-slate-700" : "bg-black/30 border-white/10 text-slate-400"
                }`}>
                  {[
                    { id: "today", label: "Today" },
                    { id: "yesterday", label: "Yesterday" },
                    { id: "week", label: "7 Days" },
                    { id: "month", label: "30 Days" },
                    { id: "year", label: "Full FY" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        onChangeSelectedDate?.("");
                        onChangeRange?.(p.id as any);
                      }}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        activeRange === p.id && !selectedDate
                          ? isLight
                            ? "bg-teal-600 text-white font-bold shadow-xs"
                            : "bg-teal-500 text-slate-950 font-bold shadow-xs"
                          : isLight
                          ? "text-slate-600 hover:text-slate-900 font-medium"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Specific Date Picker */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">Pick Date:</span>
                  <input
                    type="date"
                    value={selectedDate || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      onChangeSelectedDate?.(val);
                    }}
                    className={`h-8 px-2 text-xs rounded-xl border font-mono transition-colors ${
                      isLight
                        ? "bg-slate-50 border-slate-300 text-slate-900"
                        : "bg-slate-800 border-slate-700 text-slate-100"
                    }`}
                  />
                  {selectedDate && (
                    <button
                      onClick={() => {
                        onChangeSelectedDate?.("");
                        onChangeRange?.("week");
                      }}
                      className="text-xs text-rose-400 hover:text-rose-300 underline font-semibold ml-1"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Primary Key Metric Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {/* Main Card: Sales Revenue */}
              <StatCard
                title={
                  selectedDate
                    ? `Sales on ${new Date(selectedDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`
                    : activeRange === "today"
                    ? "Today's Sales"
                    : activeRange === "yesterday"
                    ? "Yesterday's Sales"
                    : activeRange === "year"
                    ? "FY Total Revenue"
                    : `${data.periodLabel || "Period"} Revenue`
                }
                value={formatINR(displaySalesAmount)}
                numericValue={displaySalesAmount}
                previousValue={activeRange === "today" && !selectedDate ? data.yesterday.salesAmount : undefined}
                subValue={`${displayPhonesSold} phone${displayPhonesSold === 1 ? "" : "s"} sold in period`}
                icon={<TrendingUp className="h-4 w-4" />}
                isMainHighlight={!isLight && prefs.style === "glass"}
                styleMode={prefs.style}
                accentColor="emerald"
                sparklineData={salesSparkline}
                isLight={isLight}
                onClick={() => setActiveSubView("sales")}
              />

              {/* Profit (Admin Only) */}
              {isAdmin && displayProfit !== undefined && (
                <StatCard
                  title={
                    selectedDate
                      ? `Profit on ${new Date(selectedDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`
                      : activeRange === "today"
                      ? "Today's Profit"
                      : activeRange === "yesterday"
                      ? "Yesterday's Profit"
                      : activeRange === "year"
                      ? "FY Gross Profit"
                      : `${data.periodLabel || "Period"} Profit`
                  }
                  value={formatINR(displayProfit)}
                  numericValue={displayProfit}
                  previousValue={activeRange === "today" && !selectedDate ? data.yesterday.profit : undefined}
                  subValue="Net margin after purchase cost"
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
                  range={activeRange === "year" ? "year" : activeRange === "month" ? "month" : "week"}
                  onChangeRange={(r) => {
                    onChangeSelectedDate?.("");
                    onChangeRange?.(r);
                  }}
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
                  onSelectInvoice={(inv) => setViewingInvoice(inv)}
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
            chartRange={activeRange === "year" ? "year" : activeRange === "month" ? "month" : "week"}
            onChangeRange={(r) => {
              onChangeSelectedDate?.("");
              onChangeRange?.(r);
            }}
            onNavigateTab={onNavigateTab}
            onQuickAction={onQuickAction}
            onSelectInvoice={(inv) => setViewingInvoice(inv)}
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

      {/* Real-time Invoice & Transaction Details Dialog */}
      <InvoiceDetailDialog
        open={!!viewingInvoice}
        onOpenChange={(open) => !open && setViewingInvoice(null)}
        invoice={viewingInvoice}
        onNavigateTab={onNavigateTab}
      />
    </div>
  );
};

