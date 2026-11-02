import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Printer, ArrowUpRight, ArrowDownLeft, RotateCcw, Wrench, Smartphone, User, Phone, MapPin, Calendar, ExternalLink, Loader2 } from "lucide-react";
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
  const [isPrinting, setIsPrinting] = useState(false);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  React.useEffect(() => {
    if (open && invoice?.id) {
      setIsLoadingDetail(true);
      fetch(`/api/invoices/${invoice.id}`, { credentials: "include" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) setDetailData(data);
        })
        .catch(() => {})
        .finally(() => setIsLoadingDetail(false));
    } else {
      setDetailData(null);
    }
  }, [open, invoice?.id]);

  if (!invoice) return null;

  const active = detailData || invoice;
  const invNumber = active.number || active.invoice_number || "INV-001";
  const invType = (active.type || active.invoice_type || "sale").toLowerCase();
  const partyName = active.party || active.party_name || active.customer_name || active.seller_name || "Customer";
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
  const shopName = active.shop_name || "";
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
      const res = await fetch(`/api/invoices/${invoice.id}/html`, { credentials: "include" });
      if (!res.ok) {
        throw new Error("Could not retrieve invoice print document");
      }
      const html = await res.text();
      printHtml(html);
      toast.success(`Printing invoice #${invNumber}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to print invoice");
    } finally {
      setIsPrinting(false);
    }
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
          icon: <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />,
          label: "Sale Invoice",
          tabName: "Sold Phones Tab",
          badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300",
        };
      case "purchase":
        return {
          icon: <ArrowDownLeft className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />,
          label: "Purchase Voucher",
          tabName: "Inventory Tab",
          badgeClass: "bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/80 dark:text-blue-300",
        };
      case "repair":
        return {
          icon: <Wrench className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />,
          label: "Repair Ticket",
          tabName: "Repairs Tab",
          badgeClass: "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300",
        };
      case "return":
        return {
          icon: <RotateCcw className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />,
          label: "Return Invoice",
          tabName: "Returns Tab",
          badgeClass: "bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300",
        };
      default:
        return {
          icon: <FileText className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />,
          label: "Invoice",
          tabName: "Transaction Tab",
          badgeClass: "bg-slate-50 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200",
        };
    }
  };

  const badge = getBadgeConfig();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-white dark:bg-[#0c1322] border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl p-0 overflow-hidden shadow-2xl">
        {/* Header Banner */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/40">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className={`gap-1 font-bold text-xs py-0.5 ${badge.badgeClass}`}>
                  {badge.icon}
                  {badge.label}
                </Badge>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 text-[10px] font-bold">
                  ✓ Recorded
                </Badge>
              </div>
              <DialogTitle className="text-xl font-mono font-black tracking-tight text-slate-900 dark:text-white">
                {invNumber}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Calendar className="h-3.5 w-3.5" />
                {formattedDate}
              </DialogDescription>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Amount</span>
              <div className="text-xl font-mono font-black text-emerald-600 dark:text-emerald-400">
                {formatINR(amount)}
              </div>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Party details */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-blue-500" />
              Party / Counterpart Details
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-sm text-slate-900 dark:text-white">{partyName}</div>
                {partyPhone && (
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                    <Phone className="h-3 w-3" />
                    <span>{partyPhone}</span>
                  </div>
                )}
              </div>
              {partyPhone && (
                <a
                  href={`tel:${partyPhone}`}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Call
                </a>
              )}
            </div>
          </div>

          {/* Device details (if attached) */}
          {(phoneName || brand || model || imei) && (
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5 text-teal-500" />
                Device / Inventory Item
              </div>
              <div className="space-y-1">
                <div className="font-bold text-sm text-slate-900 dark:text-white">
                  {phoneName || [brand, model].filter(Boolean).join(" ") || "Phone Device"}
                </div>
                {(variant || colour || condition) && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {variant && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">
                        {variant}
                      </span>
                    )}
                    {colour && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">
                        {colour}
                      </span>
                    )}
                    {condition && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold capitalize">
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

          {/* Action Buttons */}
          <div className="flex gap-2.5 pt-2">
            <Button
              type="button"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 gap-1.5"
              onClick={handlePrint}
              disabled={isPrinting}
            >
              {isPrinting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Rendering Invoice...
                </>
              ) : (
                <>
                  <Printer className="h-4 w-4" />
                  Print / View Invoice
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-slate-300 dark:border-slate-700 font-bold h-10 gap-1.5"
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
