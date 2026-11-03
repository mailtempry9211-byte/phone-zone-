import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  Download,
  FileText,
  BarChart3,
  Calendar,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  Wrench,
  Building2,
  CreditCard,
  Banknote,
  Search,
  Printer,
  ChevronRight,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { formatINR } from "./dashboard/dashboardFormat";
import { InvoiceDetailDialog } from "./dashboard/widgets/InvoiceDetailDialog";

interface AccountingTabProps {
  financialYear?: string;
  shopId?: string;
  onNavigateTab?: (tab: string) => void;
}

export const AccountingTab: React.FC<AccountingTabProps> = ({
  financialYear,
  shopId,
  onNavigateTab,
}) => {
  const [dateRange, setDateRange] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activeView, setActiveView] = useState<"ledger" | "cogs" | "cashbook">("ledger");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  // Helper to format date into SQLite format 'YYYY-MM-DD HH:MM:SS'
  const formatSqliteDate = (d: Date, endOfDay = false) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const y = d.getFullYear();
    const m = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const h = endOfDay ? "23:59:59" : pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
    return `${y}-${m}-${day} ${h}`;
  };

  // Fetch comprehensive business data: phones, invoices, dealer ledger, and repairs
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["accounting-master", dateRange, startDate, endDate, financialYear, shopId],
    queryFn: async () => {
      // 1. Fetch Phones
      let phonesQuery = (supabase as any).from("phones").select("*");
      // 2. Fetch Invoices
      let invoicesQuery = (supabase as any).from("invoices").select("*");
      // 3. Fetch Dealer Ledger
      let dealerLedgerQuery = (supabase as any).from("dealer_ledger").select("*");
      // 4. Fetch Repairs
      let repairsQuery = (supabase as any).from("repairs").select("*");

      const [phonesRes, invoicesRes, dealerLedgerRes, repairsRes] = await Promise.all([
        phonesQuery,
        invoicesQuery,
        dealerLedgerQuery,
        repairsQuery,
      ]);

      const phones = (phonesRes.data || []) as any[];
      const invoices = (invoicesRes.data || []) as any[];
      const dealerLedger = (dealerLedgerRes.data || []) as any[];
      const repairs = (repairsRes.data || []) as any[];

      return {
        phones,
        invoices,
        dealerLedger,
        repairs,
      };
    },
    refetchInterval: 30000,
  });

  // Calculate cutoff range for filtering
  const dateCutoffs = useMemo(() => {
    const now = new Date();
    if (dateRange === "today") {
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      return { from: formatSqliteDate(todayStart), to: null };
    }
    if (dateRange === "yesterday") {
      const yStart = new Date(now);
      yStart.setDate(yStart.getDate() - 1);
      yStart.setHours(0, 0, 0, 0);
      const yEnd = new Date(now);
      yEnd.setDate(yEnd.getDate() - 1);
      yEnd.setHours(23, 59, 59, 999);
      return { from: formatSqliteDate(yStart), to: formatSqliteDate(yEnd, true) };
    }
    if (dateRange === "week") {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - 7);
      weekStart.setHours(0, 0, 0, 0);
      return { from: formatSqliteDate(weekStart), to: null };
    }
    if (dateRange === "month") {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      return { from: formatSqliteDate(monthStart), to: null };
    }
    if (dateRange === "custom" && startDate) {
      const s = new Date(startDate + "T00:00:00");
      const e = endDate ? new Date(endDate + "T23:59:59") : null;
      return { from: formatSqliteDate(s), to: e ? formatSqliteDate(e, true) : null };
    }
    return { from: null, to: null };
  }, [dateRange, startDate, endDate]);

  // Unified Financial Ledger Transactions
  const ledgerEntries = useMemo(() => {
    if (!data) return [];
    const entries: Array<{
      id: string;
      date: string;
      type: "sale" | "purchase" | "dealer_purchase" | "repair";
      refNo: string;
      item: string;
      partyName: string;
      paymentMode: string;
      inflow: number;
      outflow: number;
      profit: number;
      raw: any;
    }> = [];

    // Add Sales (from phones that are sold)
    data.phones
      .filter((p) => p.is_sold)
      .forEach((p) => {
        const inv = data.invoices.find((i) => i.phone_id === p.id && i.invoice_type === "sale");
        const sellPrice = Number(p.selling_price || 0);
        const buyPrice = Number(p.purchase_price || 0);
        entries.push({
          id: `sale-${p.id}`,
          date: p.sold_date || p.created_at || "",
          type: "sale",
          refNo: inv?.invoice_number || `SAL-${p.id.slice(0, 6)}`,
          item: `${p.phone_name} ${p.model || ""}`.trim(),
          partyName: p.customers?.name || "Retail Buyer",
          paymentMode: p.payment_method || "cash",
          inflow: sellPrice,
          outflow: 0,
          profit: sellPrice - buyPrice,
          raw: inv || { ...p, invoice_type: "sale", amount: sellPrice, id: p.id },
        });
      });

    // Add Customer Purchases (from phones)
    data.phones.forEach((p) => {
      const inv = data.invoices.find((i) => i.phone_id === p.id && i.invoice_type === "purchase");
      const buyPrice = Number(p.purchase_price || 0);
      entries.push({
        id: `pur-${p.id}`,
        date: p.purchase_date || p.created_at || "",
        type: "purchase",
        refNo: inv?.invoice_number || `PUR-${p.id.slice(0, 6)}`,
        item: `${p.phone_name} ${p.model || ""}`.trim(),
        partyName: p.sellers?.name || "Customer Seller",
        paymentMode: p.payment_method || "cash",
        inflow: 0,
        outflow: buyPrice,
        profit: 0,
        raw: inv || { ...p, invoice_type: "purchase", amount: buyPrice, id: p.id },
      });
    });

    // Add Dealer Batch Purchases (from dealer ledger)
    data.dealerLedger.forEach((dl) => {
      entries.push({
        id: `dl-${dl.id}`,
        date: dl.created_at || "",
        type: "dealer_purchase",
        refNo: dl.reference_id ? `DL-${dl.reference_id.slice(0, 6)}` : "B2B-PUR",
        item: dl.description || "Dealer Batch Stock",
        partyName: "B2B Supplier",
        paymentMode: dl.payment_mode || "upi",
        inflow: 0,
        outflow: Number(dl.amount || 0),
        profit: 0,
        raw: {
          id: dl.id,
          number: dl.reference_id || "B2B-PUR",
          type: "purchase",
          party: "B2B Supplier",
          amount: dl.amount,
          created_at: dl.created_at,
          payment_method: dl.payment_mode,
        },
      });
    });

    // Add Repairs
    data.repairs.forEach((r) => {
      const amount = Number(r.estimated_cost || r.repair_cost || 0);
      entries.push({
        id: `rep-${r.id}`,
        date: r.created_at || "",
        type: "repair",
        refNo: `REP-${String(r.id).slice(0, 6)}`,
        item: `${r.brand || ""} ${r.model || "Handset"} Repair`,
        partyName: r.customer_name || "Repair Customer",
        paymentMode: r.payment_mode || "cash",
        inflow: amount,
        outflow: 0,
        profit: amount,
        raw: {
          id: r.id,
          number: `REP-${String(r.id).slice(0, 6)}`,
          type: "repair",
          party: r.customer_name,
          partyPhone: r.customer_phone,
          amount,
          phoneName: `${r.brand || ""} ${r.model || ""}`,
          created_at: r.created_at,
        },
      });
    });

    // Filter by date cutoff if active
    let filtered = entries;
    if (dateCutoffs.from) {
      filtered = filtered.filter((e) => e.date >= dateCutoffs.from!);
    }
    if (dateCutoffs.to) {
      filtered = filtered.filter((e) => e.date <= dateCutoffs.to!);
    }

    // Filter by type
    if (typeFilter !== "all") {
      filtered = filtered.filter((e) => e.type === typeFilter);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.refNo.toLowerCase().includes(q) ||
          e.item.toLowerCase().includes(q) ||
          e.partyName.toLowerCase().includes(q)
      );
    }

    // Sort descending by date
    return filtered.sort((a, b) => (b.date > a.date ? 1 : -1));
  }, [data, dateCutoffs, typeFilter, searchQuery]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let grossRevenue = 0;
    let cogs = 0;
    let grossProfit = 0;
    let totalCash = 0;
    let totalOnline = 0;
    let totalOutflow = 0;

    ledgerEntries.forEach((e) => {
      grossRevenue += e.inflow;
      totalOutflow += e.outflow;
      grossProfit += e.profit;

      const isCash = (e.paymentMode || "").toLowerCase().includes("cash");
      if (e.inflow > 0) {
        if (isCash) totalCash += e.inflow;
        else totalOnline += e.inflow;
      }
    });

    // Inventory value (stock on shelf)
    const availablePhones = data?.phones.filter((p) => !p.is_sold) || [];
    const stockValue = availablePhones.reduce((sum, p) => sum + Number(p.selling_price || 0), 0);
    const stockCost = availablePhones.reduce((sum, p) => sum + Number(p.purchase_price || 0), 0);

    // COGS is the cost of phones that have been sold
    const soldPhones = data?.phones.filter((p) => p.is_sold) || [];
    cogs = soldPhones.reduce((sum, p) => sum + Number(p.purchase_price || 0), 0);

    const marginPct = grossRevenue > 0 ? ((grossProfit / grossRevenue) * 100).toFixed(1) : "0.0";

    return {
      grossRevenue,
      cogs,
      grossProfit,
      marginPct,
      stockValue,
      stockCost,
      stockCount: availablePhones.length,
      soldCount: soldPhones.length,
      totalCash,
      totalOnline,
      totalOutflow,
    };
  }, [ledgerEntries, data]);

  // Export to CSV
  const handleExportCSV = () => {
    if (ledgerEntries.length === 0) {
      toast.error("No entries to export");
      return;
    }
    const headers = ["Date", "Type", "Reference", "Handset / Item", "Party", "Payment Mode", "Inflow (₹)", "Outflow (₹)", "Gross Profit (₹)"];
    const rows = ledgerEntries.map((e) => [
      e.date,
      e.type,
      e.refNo,
      `"${e.item.replace(/"/g, '""')}"`,
      `"${e.partyName.replace(/"/g, '""')}"`,
      e.paymentMode,
      e.inflow,
      e.outflow,
      e.profit,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `PhoneZone_Accounting_Ledger_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Accounting Ledger exported as CSV");
  };

  // Generate Official P&L Statement HTML
  const handlePrintProfitLoss = () => {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Profit & Loss Statement - PhoneZone</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #1e293b; }
    .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; }
    .title { font-size: 24px; font-weight: 800; text-transform: uppercase; margin: 0; color: #0f172a; }
    .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .kpi-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; background: #f8fafc; }
    .kpi-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; }
    .kpi-value { font-size: 18px; font-weight: 800; margin-top: 4px; }
    .green { color: #16a34a; }
    .blue { color: #2563eb; }
    .table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
    .table th, .table td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
    .table th { background: #f1f5f9; font-weight: 700; }
    .text-right { text-align: right; }
    .footer { margin-top: 32px; font-size: 11px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <h1 class="title">PhoneZone Mobile Hub</h1>
    <div class="subtitle">Official Financial P&L Statement • Generated: ${new Date().toLocaleString("en-IN")}</div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Gross Revenue</div>
      <div class="kpi-value green">₹${metrics.grossRevenue.toLocaleString("en-IN")}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Cost of Goods Sold</div>
      <div class="kpi-value">₹${metrics.cogs.toLocaleString("en-IN")}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Net Gross Profit</div>
      <div class="kpi-value green">₹${metrics.grossProfit.toLocaleString("en-IN")} (${metrics.marginPct}%)</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Stock Valuation</div>
      <div class="kpi-value blue">₹${metrics.stockValue.toLocaleString("en-IN")} (${metrics.stockCount} units)</div>
    </div>
  </div>

  <h3>Transaction Ledger (${ledgerEntries.length} Records)</h3>
  <table class="table">
    <thead>
      <tr>
        <th>Date</th>
        <th>Type</th>
        <th>Ref No</th>
        <th>Description / Handset</th>
        <th>Party</th>
        <th>Mode</th>
        <th class="text-right">Inflow (₹)</th>
        <th class="text-right">Outflow (₹)</th>
        <th class="text-right">Profit (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${ledgerEntries
        .map(
          (e) => `
        <tr>
          <td>${new Date(e.date).toLocaleDateString("en-IN")}</td>
          <td>${e.type.toUpperCase()}</td>
          <td>${e.refNo}</td>
          <td>${e.item}</td>
          <td>${e.partyName}</td>
          <td>${e.paymentMode}</td>
          <td class="text-right">${e.inflow > 0 ? "₹" + e.inflow.toLocaleString("en-IN") : "-"}</td>
          <td class="text-right">${e.outflow > 0 ? "₹" + e.outflow.toLocaleString("en-IN") : "-"}</td>
          <td class="text-right">${e.profit > 0 ? "+₹" + e.profit.toLocaleString("en-IN") : "-"}</td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  </table>

  <div class="footer">
    PhoneZone ERP • Computer Generated Financial Statement
  </div>
</body>
</html>
    `;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) {
      setTimeout(() => win.print(), 500);
    } else {
      toast.success("Report generated in new window");
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "sale":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold">Sale</Badge>;
      case "purchase":
        return <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/40 text-[10px] font-bold">Stock Buy</Badge>;
      case "dealer_purchase":
        return <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/40 text-[10px] font-bold">B2B Dealer</Badge>;
      case "repair":
        return <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-bold">Repair</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 1. Header & Actions Bar (Fully Responsive) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Sales Accounting & Financial Ledger
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Audited cashflow, cost of goods, gross margins, and live daily transaction records.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCSV}
            className="text-xs h-9 font-bold border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export CSV
          </Button>
          <Button
            size="sm"
            onClick={handlePrintProfitLoss}
            className="text-xs h-9 font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm"
          >
            <Printer className="h-3.5 w-3.5 mr-1.5" />
            Print P&L Statement
          </Button>
        </div>
      </div>

      {/* 2. Live KPI Cards (2 cols on mobile, 4 on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Gross Revenue */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <CardHeader className="p-3.5 sm:p-4 pb-1">
            <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Gross Revenue</span>
              <ArrowUpRight className="h-4 w-4 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3.5 sm:p-4 pt-1">
            <div className="text-lg sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {formatINR(metrics.grossRevenue)}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {metrics.soldCount} handsets sold
            </p>
          </CardContent>
        </Card>

        {/* COGS (Cost of Goods Sold) */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <CardHeader className="p-3.5 sm:p-4 pb-1">
            <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Cost of Goods (COGS)</span>
              <ArrowDownLeft className="h-4 w-4 text-cyan-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3.5 sm:p-4 pt-1">
            <div className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white">
              {formatINR(metrics.cogs)}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Stock purchase cost basis
            </p>
          </CardContent>
        </Card>

        {/* Gross Profit */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <CardHeader className="p-3.5 sm:p-4 pb-1">
            <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Net Gross Profit</span>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3.5 sm:p-4 pt-1">
            <div className="text-lg sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {formatINR(metrics.grossProfit)}
            </div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
              +{metrics.marginPct}% profit margin
            </p>
          </CardContent>
        </Card>

        {/* Stock Asset Valuation */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <CardHeader className="p-3.5 sm:p-4 pb-1">
            <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Stock Asset Valuation</span>
              <Package className="h-4 w-4 text-blue-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3.5 sm:p-4 pt-1">
            <div className="text-lg sm:text-2xl font-black text-blue-600 dark:text-blue-400">
              {formatINR(metrics.stockValue)}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {metrics.stockCount} phones on shelf
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Cashbook Breakdown Cards (Cash vs UPI/Online) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-emerald-500/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Banknote className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Cash in Hand Collected</span>
              <div className="text-xl font-mono font-black text-emerald-600 dark:text-emerald-400">
                {formatINR(metrics.totalCash)}
              </div>
            </div>
          </div>
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20 text-xs">
            Direct Cash
          </Badge>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-blue-500/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Digital / UPI / Bank Inflow</span>
              <div className="text-xl font-mono font-black text-blue-600 dark:text-blue-400">
                {formatINR(metrics.totalOnline)}
              </div>
            </div>
          </div>
          <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-500/20 text-xs">
            UPI / Banking
          </Badge>
        </div>
      </div>

      {/* 4. Filter Toolbar (Responsive Grid/Wrap) */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Period Select */}
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Period:</span>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-32 h-8 text-xs rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time (FY 26-27)</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="week">Past 7 Days</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Type Select */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Type:</span>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-28 h-8 text-xs rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="sale">Sales Only</SelectItem>
                <SelectItem value="purchase">Stock Buy</SelectItem>
                <SelectItem value="dealer_purchase">B2B Dealer</SelectItem>
                <SelectItem value="repair">Repairs</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom Date Inputs */}
          {dateRange === "custom" && (
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-32 h-8 text-xs rounded-lg"
              />
              <span className="text-xs text-slate-400">to</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-32 h-8 text-xs rounded-lg"
              />
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search party or ref..."
            className="pl-8 h-8 text-xs rounded-lg"
          />
        </div>
      </div>

      {/* 5. Master Ledger Table & Mobile Cards */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Audited Financial Daybook ({ledgerEntries.length} Records)
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Click any row to open full transaction voucher, customer details, or print invoice.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading accounting ledger...</div>
          ) : ledgerEntries.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No transactions found for the selected period.
            </div>
          ) : (
            <>
              {/* Desktop View Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                    <tr>
                      <th className="py-3 px-4 font-bold">Date & Time</th>
                      <th className="py-3 px-4 font-bold">Type</th>
                      <th className="py-3 px-4 font-bold">Reference #</th>
                      <th className="py-3 px-4 font-bold">Item Description</th>
                      <th className="py-3 px-4 font-bold">Party Name</th>
                      <th className="py-3 px-4 font-bold">Payment Mode</th>
                      <th className="py-3 px-4 font-bold text-right text-emerald-500">Inflow (+)</th>
                      <th className="py-3 px-4 font-bold text-right text-slate-500">Outflow (-)</th>
                      <th className="py-3 px-4 font-bold text-right text-emerald-500">Profit</th>
                      <th className="py-3 px-4 font-bold text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {ledgerEntries.map((e) => (
                      <tr
                        key={e.id}
                        onClick={() => setSelectedInvoice(e.raw)}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {new Date(e.date).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3 px-4">{getTypeBadge(e.type)}</td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                          {e.refNo}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white max-w-[200px] truncate">
                          {e.item}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          {e.partyName}
                        </td>
                        <td className="py-3 px-4 capitalize font-mono text-slate-500">
                          {e.paymentMode}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {e.inflow > 0 ? formatINR(e.inflow) : "-"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-500">
                          {e.outflow > 0 ? formatINR(e.outflow) : "-"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {e.profit > 0 ? `+${formatINR(e.profit)}` : "-"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 rounded-lg text-slate-400 hover:text-white"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View (Zero Horizontal Scroll!) */}
              <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800/60 p-2 space-y-2">
                {ledgerEntries.map((e) => (
                  <div
                    key={e.id}
                    onClick={() => setSelectedInvoice(e.raw)}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 active:scale-[0.99] transition-all cursor-pointer space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {getTypeBadge(e.type)}
                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                          {e.refNo}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(e.date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">
                          {e.item}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Party: {e.partyName} • <span className="capitalize">{e.paymentMode}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {e.inflow > 0 ? (
                          <div className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                            +{formatINR(e.inflow)}
                          </div>
                        ) : (
                          <div className="font-mono font-bold text-sm text-slate-600 dark:text-slate-400">
                            -{formatINR(e.outflow)}
                          </div>
                        )}
                        {e.profit > 0 && (
                          <div className="text-[10px] text-emerald-500 font-bold">
                            Margin +{formatINR(e.profit)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Invoice / Transaction Detail Dialog */}
      <InvoiceDetailDialog
        open={!!selectedInvoice}
        onOpenChange={(open) => !open && setSelectedInvoice(null)}
        invoice={selectedInvoice}
        onNavigateTab={onNavigateTab}
      />
    </div>
  );
};

export default AccountingTab;
