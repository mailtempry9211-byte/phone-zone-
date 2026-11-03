import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Printer,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
  Wrench,
  Smartphone,
  User,
  Phone,
  MapPin,
  Calendar,
  ExternalLink,
  Loader2,
  Eye,
  Download,
  CreditCard,
} from "lucide-react";
import { formatINR } from "../dashboardFormat";
import { printHtml } from "@/lib/printHtml";
import { toast } from "sonner";

interface InvoiceDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any | null;
  onNavigateTab?: (tab: string) => void;
}

export const InvoiceDetailDialog: React.FC<InvoiceDetailDialogProps> = ({
  open,
  onOpenChange,
  invoice,
  onNavigateTab,
}) => {
  const [activeTab, setActiveTab] = useState<"summary" | "document">("summary");
  const [isPrinting, setIsPrinting] = useState(false);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [invoiceHtml, setInvoiceHtml] = useState<string | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isLoadingHtml, setIsLoadingHtml] = useState(false);

  useEffect(() => {
    if (open && invoice?.id) {
      setActiveTab("summary");
      setIsLoadingDetail(true);
      fetch(`/api/invoices/${invoice.id}`, { credentials: "include" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) setDetailData(data);
        })
        .catch(() => {})
        .finally(() => setIsLoadingDetail(false));

      // Also pre-fetch HTML document so preview is instant
      setIsLoadingHtml(true);
      fetch(`/api/invoices/${invoice.id}/html`, { credentials: "include" })
        .then((res) => (res.ok ? res.text() : null))
        .then((html) => {
          if (html) setInvoiceHtml(html);
        })
        .catch(() => {})
        .finally(() => setIsLoadingHtml(false));
    } else {
      setDetailData(null);
      setInvoiceHtml(null);
    }
  }, [open, invoice?.id]);

  if (!invoice) return null;

  const active = detailData || invoice;
  const invNumber = active.number || active.invoice_number || "INV-001";
  const invType = (active.type || active.invoice_type || "sale").toLowerCase();
  const partyName = active.party || active.party_name || active.customer_name || active.seller_name || "Counterpart";
  const partyPhone = active.partyPhone || active.customer_phone || active.seller_phone || "";
  const partyAddress = active.customer_address || active.seller_address || "";
  const amount = Number(active.amount || 0);
  const phoneName = active.phoneName || active.phone_name || "";
  const brand = active.brand || (phoneName ? phoneName.split(" ")[0] : "");
  const model = active.model || "";
  const imei = active.imei || active.imei_number || "";
  const variant = active.variant || "";
  const colour = active.colour || "";
  const condition = active.condition || "";
  const paymentMethod = active.payment_method || active.payment_mode || "Cash";
  const shopName = active.shop_name || "Main Store";
  const dateStr = active.date || active.created_at || active.issued_at;
  const formattedDate = dateStr
    ? new Date(dateStr).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Recent";

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      let html = invoiceHtml;
      if (!html) {
        const res = await fetch(`/api/invoices/${invoice.id}/html`, { credentials: "include" });
        if (!res.ok) throw new Error("Could not retrieve invoice document");
        html = await res.text();
        setInvoiceHtml(html);
      }
      printHtml(html);
      toast.success(`Sent invoice #${invNumber} to printer`);
    } catch (err: any) {
      toast.error(err.message || "Failed to print invoice");
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownloadHtml = () => {
    if (!invoiceHtml) return;
    const blob = new Blob([invoiceHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Invoice-${invNumber}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded invoice file");
  };

  const handleGoToTab = () => {
    onOpenChange(false);
    if (!onNavigateTab) return;
    if (invType === "sale") {
      onNavigateTab("sold");
    } else if (invType === "purchase") {
      onNavigateTab("inventory");
    } else if (invType === "repair") {
      onNavigateTab("repairs");
    } else if (invType === "return") {
      onNavigateTab("returns");
    } else {
      onNavigateTab("sold");
    }
  };

  const getBadgeConfig = () => {
    switch (invType) {
      case "sale":
        return {
          icon: <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />,
          label: "Customer Sale Invoice",
          tabName: "View in Sold Phones",
          badgeClass: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
        };
      case "purchase":
        return {
          icon: <ArrowDownLeft className="h-3.5 w-3.5 text-cyan-400" />,
          label: "Stock Purchase Voucher",
          tabName: "View in Inventory",
          badgeClass: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
        };
      case "repair":
        return {
          icon: <Wrench className="h-3.5 w-3.5 text-amber-400" />,
          label: "Repair Work Order",
          tabName: "View in Repairs",
          badgeClass: "bg-amber-500/10 text-amber-300 border-amber-500/30",
        };
      case "return":
        return {
          icon: <RotateCcw className="h-3.5 w-3.5 text-rose-400" />,
          label: "Return Credit Note",
          tabName: "View in Returns",
          badgeClass: "bg-rose-500/10 text-rose-300 border-rose-500/30",
        };
      default:
        return {
          icon: <FileText className="h-3.5 w-3.5 text-slate-400" />,
          label: "Transaction Voucher",
          tabName: "View Transactions",
          badgeClass: "bg-slate-500/10 text-slate-300 border-slate-500/30",
        };
    }
  };

  const badge = getBadgeConfig();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-2xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-white dark:bg-[#0c1322] border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl shadow-2xl">
        {/* Header Banner */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/60 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <Badge variant="outline" className={`gap-1 font-bold text-xs py-0.5 ${badge.badgeClass}`}>
                  {badge.icon}
                  {badge.label}
                </Badge>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                  ✓ Verified in DB
                </Badge>
              </div>
              <DialogTitle className="text-lg sm:text-xl font-mono font-black tracking-tight text-slate-900 dark:text-white">
                {invNumber}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                {formattedDate} • {shopName}
              </DialogDescription>
            </div>

            <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Billed</span>
              <div className="text-lg sm:text-2xl font-mono font-black text-emerald-600 dark:text-emerald-400">
                {formatINR(amount)}
              </div>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setActiveTab("summary")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === "summary"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Transaction Details
            </button>
            <button
              onClick={() => setActiveTab("document")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === "document"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              Live Invoice Document Preview
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4 text-xs">
          {activeTab === "summary" ? (
            <>
              {/* Party details */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-blue-500" />
                  {invType === "sale" ? "Customer Details" : "Seller / Supplier Details"}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white">{partyName}</div>
                    {partyPhone && (
                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        <Phone className="h-3 w-3" />
                        <span>{partyPhone}</span>
                      </div>
                    )}
                    {partyAddress && (
                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                        <MapPin className="h-3 w-3" />
                        <span>{partyAddress}</span>
                      </div>
                    )}
                  </div>
                  {partyPhone && (
                    <a
                      href={`tel:${partyPhone}`}
                      className="self-start sm:self-auto px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1"
                    >
                      <Phone className="h-3 w-3" /> Call
                    </a>
                  )}
                </div>
              </div>

              {/* Device details (if attached) */}
              {(phoneName || brand || model || imei) && (
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 space-y-2.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Smartphone className="h-3.5 w-3.5 text-cyan-400" />
                    Handset & Inventory Specifications
                  </div>
                  <div className="space-y-1">
                    <div className="font-bold text-sm text-slate-900 dark:text-white">
                      {phoneName || [brand, model].filter(Boolean).join(" ") || "Handset Device"}
                    </div>
                    {(variant || colour || condition) && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {variant && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-[10px] font-bold">
                            {variant}
                          </span>
                        )}
                        {colour && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-[10px] font-bold">
                            {colour}
                          </span>
                        )}
                        {condition && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold capitalize">
                            {condition} Condition
                          </span>
                        )}
                      </div>
                    )}
                    {imei && (
                      <div className="pt-1 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        IMEI: <strong className="text-slate-900 dark:text-white">{imei}</strong>
                        {active.imei2 && <span> • IMEI2: {active.imei2}</span>}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Payment & Settlement Summary */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-purple-400" />
                  Financial Settlement
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400">Payment Mode:</span>
                    <span className="block font-bold capitalize text-slate-800 dark:text-slate-200">
                      {paymentMethod}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Financial Year:</span>
                    <span className="block font-bold text-slate-800 dark:text-slate-200">
                      {active.financial_year || "2026-27"}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              {isLoadingHtml ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  <span>Loading official document preview...</span>
                </div>
              ) : invoiceHtml ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1">
                    <span>Live rendered A4 document from server</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDownloadHtml}
                      className="h-7 text-xs gap-1 border-slate-300 dark:border-slate-700"
                    >
                      <Download className="h-3 w-3" /> Save File
                    </Button>
                  </div>
                  <div className="border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden shadow-inner bg-white">
                    <iframe
                      srcDoc={invoiceHtml}
                      title={`Invoice ${invNumber}`}
                      className="w-full h-[400px] sm:h-[460px] border-0"
                    />
                  </div>
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-slate-400">
                  Preview not available for this record.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 shrink-0">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <Button
              type="button"
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold h-10 gap-1.5 rounded-xl shadow-md"
              onClick={handlePrint}
              disabled={isPrinting}
            >
              {isPrinting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending to Printer...
                </>
              ) : (
                <>
                  <Printer className="h-4 w-4" />
                  Print Official Document
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold h-10 gap-1.5 rounded-xl"
              onClick={handleGoToTab}
            >
              <ExternalLink className="h-4 w-4" />
              {badge.tabName}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceDetailDialog;
