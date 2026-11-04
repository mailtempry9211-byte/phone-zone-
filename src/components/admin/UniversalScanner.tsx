import React, { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  QrCode,
  ScanLine,
  Camera,
  Upload,
  Search,
  Loader2,
  Wrench,
  ShoppingBag,
  AlertTriangle,
  CheckCircle2,
  Plus,
  ArrowRight,
  Receipt,
  FileText,
  Eye,
  Calendar,
} from "lucide-react";
import { decodeBarcode } from "./ImeiScanButton";
import ProcessSaleDialog from "./ProcessSaleDialog";
import RepairDetailDialog from "./RepairDetailDialog";
import AddPhoneDialog from "./AddPhoneDialog";
import AddRepairDialog from "./AddRepairDialog";
import { InvoiceDetailDialog } from "./dashboard/widgets/InvoiceDetailDialog";
import { formatINR } from "./dashboard/dashboardFormat";

export interface UniversalScannerProps {
  className?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialQuery?: string;
}

export const UniversalScanner: React.FC<UniversalScannerProps> = ({
  className = "",
  isOpen,
  onOpenChange,
  initialQuery = "",
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const modalOpen = isOpen !== undefined ? isOpen : internalOpen;
  const setModalOpen = (val: boolean) => {
    setInternalOpen(val);
    onOpenChange?.(val);
  };
  const [manualCode, setManualCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [unmatchedResult, setUnmatchedResult] = useState<{
    code: string;
    isSold?: boolean;
    phone?: any;
  } | null>(null);

  // Unified Invoice Search Results State
  const [invoiceSearchResults, setInvoiceSearchResults] = useState<{
    query: string;
    sales: any[];
    purchases: any[];
    repairs: any[];
    total: number;
  } | null>(null);
  const [resultTab, setResultTab] = useState<"all" | "sales" | "purchases" | "repairs">("all");

  // Routed Target Dialog States
  const [viewingInvoice, setViewingInvoice] = useState<any | null>(null);
  const [selectedPhoneForSale, setSelectedPhoneForSale] = useState<any | null>(null);
  const [saleDialogOpen, setSaleDialogOpen] = useState(false);

  const [selectedRepairJob, setSelectedRepairJob] = useState<any | null>(null);
  const [repairDialogOpen, setRepairDialogOpen] = useState(false);

  const [inwardPhoneImei, setInwardPhoneImei] = useState<string>("");
  const [addPhoneDialogOpen, setAddPhoneDialogOpen] = useState(false);

  const [addRepairDialogOpen, setAddRepairDialogOpen] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  // Sync initial query if provided when dialog opens
  useEffect(() => {
    if (modalOpen && initialQuery && initialQuery.trim()) {
      setManualCode(initialQuery.trim());
      processScannedCode(initialQuery.trim());
    }
  }, [modalOpen, initialQuery]);

  const displayedItems = invoiceSearchResults
    ? resultTab === "sales"
      ? invoiceSearchResults.sales
      : resultTab === "purchases"
      ? invoiceSearchResults.purchases
      : resultTab === "repairs"
      ? invoiceSearchResults.repairs
      : [
          ...invoiceSearchResults.sales,
          ...invoiceSearchResults.purchases,
          ...invoiceSearchResults.repairs,
        ]
    : [];

  // Smart Routing Core Logic
  const processScannedCode = async (rawCode: string) => {
    if (!rawCode || !rawCode.trim()) return;

    let code = rawCode.trim();

    // Check if code is a URL (e.g. tracking URL from repair QR or sales sticker)
    try {
      if (code.startsWith("http://") || code.startsWith("https://")) {
        const url = new URL(code);
        const jobParam = url.searchParams.get("job") || url.searchParams.get("jobNo");
        const imeiParam = url.searchParams.get("imei");
        const phoneParam = url.searchParams.get("phone");
        if (jobParam) code = jobParam;
        else if (imeiParam) code = imeiParam;
        else if (phoneParam) code = phoneParam;
      }
    } catch {}

    setScanning(true);
    setStatusMsg(`Searching: ${code}...`);
    setUnmatchedResult(null);
    setInvoiceSearchResults(null);

    try {
      // 1. INVOICE SEARCH CHECK (Sales Invoices, Purchase Bills, or Repair Invoices)
      try {
        setStatusMsg("Looking up invoices, purchase bills & repair records...");
        const invRes = await fetch(`/api/invoices/search?q=${encodeURIComponent(code)}`);
        if (invRes.ok) {
          const invData = await invRes.json();
          if (invData && invData.total > 0) {
            if (invData.total === 1) {
              if (invData.sales.length === 1) {
                const s = invData.sales[0];
                toast.success(`Found Sales Invoice: ${s.invoice_number} (${s.party_name})`);
                setViewingInvoice(s.raw || s);
                setModalOpen(false);
                setScanning(false);
                return;
              } else if (invData.purchases.length === 1) {
                const p = invData.purchases[0];
                toast.success(`Found Purchase Bill: ${p.invoice_number} (${p.party_name})`);
                setViewingInvoice(p.raw || p);
                setModalOpen(false);
                setScanning(false);
                return;
              } else if (invData.repairs.length === 1) {
                const r = invData.repairs[0];
                toast.success(`Found Repair Job / Invoice: ${r.invoice_number} (${r.party_name})`);
                setSelectedRepairJob(r.raw || r);
                setRepairDialogOpen(true);
                setModalOpen(false);
                setScanning(false);
                return;
              }
            } else {
              setInvoiceSearchResults(invData);
              setResultTab("all");
              setScanning(false);
              return;
            }
          }
        }
      } catch {}

      // 2. REPAIR JOB CHECK: Does it match a Repair Job Number? (starts with RJ- or search match)
      if (/^RJ-/i.test(code) || code.toLowerCase().includes("rj-")) {
        setStatusMsg("Looking up repair job records...");
        const res = await fetch(`/api/repair/jobs?search=${encodeURIComponent(code)}`);
        if (res.ok) {
          const list = await res.json();
          const matched = Array.isArray(list)
            ? list.find((j: any) => j.job_no?.toLowerCase() === code.toLowerCase()) || list[0]
            : null;

          if (matched) {
            toast.success(`Found Repair Job: ${matched.job_no} (${matched.customer_name})`);
            setSelectedRepairJob(matched);
            setRepairDialogOpen(true);
            setModalOpen(false);
            setScanning(false);
            return;
          }
        }
      }

      // 3. PHONE INVENTORY CHECK: Is it a 15-digit IMEI or phone record?
      const digitsOnly = code.replace(/\D/g, "");
      const isLikelyImei = digitsOnly.length >= 14 && digitsOnly.length <= 16;

      if (isLikelyImei || /^[a-f0-9-]{36}$/i.test(code)) {
        setStatusMsg("Looking up phone inventory...");
        const phoneRes = await fetch("/api/pg/phones/select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            columns: "*",
            filter_column: isLikelyImei ? "imei_number" : "id",
            filter_op: "eq",
            filter_value: isLikelyImei ? digitsOnly : code,
          }),
        });

        if (phoneRes.ok) {
          const phones = await phoneRes.json();
          if (Array.isArray(phones) && phones.length > 0) {
            const phone = phones[0];
            if (!phone.is_sold) {
              // Phone is in stock -> open Process Sale Dialog
              toast.success(`Found Phone: ${phone.phone_name} ${phone.model} (In Stock). Ready for sale!`);
              setSelectedPhoneForSale(phone);
              setSaleDialogOpen(true);
              setModalOpen(false);
              setScanning(false);
              return;
            } else {
              // Phone is already sold -> offer viewing invoice directly
              setUnmatchedResult({
                code: isLikelyImei ? digitsOnly : code,
                isSold: true,
                phone,
              });
              setScanning(false);
              return;
            }
          }
        }

        // Also check if this IMEI belongs to an existing repair job
        const repairByImeiRes = await fetch(`/api/repair/by-imei/${digitsOnly}`);
        if (repairByImeiRes.ok) {
          const rJobs = await repairByImeiRes.json();
          if (Array.isArray(rJobs) && rJobs.length > 0) {
            const latestJob = rJobs[0];
            toast.info(`Found Repair Job for IMEI: ${latestJob.job_no}`);
            setSelectedRepairJob(latestJob);
            setRepairDialogOpen(true);
            setModalOpen(false);
            setScanning(false);
            return;
          }
        }

        // Not in inventory and no repair job -> Offer Inward or Repair
        setUnmatchedResult({
          code: isLikelyImei ? digitsOnly : code,
          isSold: false,
        });
        setScanning(false);
        return;
      }

      // 4. GENERAL SEARCH FALLBACK (Search both repairs and inventory by text)
      setStatusMsg("Searching database...");
      const [rSearch, pSearch] = await Promise.all([
        fetch(`/api/repair/jobs?search=${encodeURIComponent(code)}`).then((r) => (r.ok ? r.json() : [])),
        fetch("/api/pg/phones/select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            columns: "*",
            filter_column: "phone_name",
            filter_op: "ilike",
            filter_value: `%${code}%`,
          }),
        }).then((r) => (r.ok ? r.json() : [])),
      ]);

      if (Array.isArray(rSearch) && rSearch.length > 0) {
        const j = rSearch[0];
        toast.success(`Found Repair Job: ${j.job_no}`);
        setSelectedRepairJob(j);
        setRepairDialogOpen(true);
        setModalOpen(false);
        return;
      }

      if (Array.isArray(pSearch) && pSearch.length > 0) {
        const p = pSearch.find((x: any) => !x.is_sold) || pSearch[0];
        if (!p.is_sold) {
          toast.success(`Found Phone: ${p.phone_name} ${p.model}`);
          setSelectedPhoneForSale(p);
          setSaleDialogOpen(true);
          setModalOpen(false);
          return;
        }
      }

      // Nothing found
      setUnmatchedResult({ code });
    } catch (err: any) {
      toast.error(err.message || "Failed to process scan");
    } finally {
      setScanning(false);
    }
  };

  const handleImageFile = async (file: File) => {
    try {
      setScanning(true);
      setStatusMsg("Decoding barcode / QR from image...");
      const result = await decodeBarcode(file);
      if (result && result.text) {
        await processScannedCode(result.text);
      } else {
        toast.error("Could not find a valid barcode or QR code in the photo. Please try a clearer picture or enter manually.");
        setScanning(false);
      }
    } catch (err: any) {
      toast.error("Error processing image file");
      setScanning(false);
    }
  };

  return (
    <>
      {/* 1. Universal Top Header Trigger Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={className || "h-7 px-2 text-xs font-semibold bg-slate-900 border border-blue-500/40 text-blue-300 hover:bg-slate-800 hover:text-blue-200 shadow-sm flex items-center gap-1 transition-all"}
        title="Universal Scanner (Barcode / QR / OCR / Search)"
        onClick={() => {
          setModalOpen(true);
          setUnmatchedResult(null);
          setManualCode("");
        }}
      >
        <QrCode className="h-3.5 w-3.5 text-blue-400" />
        <span className="hidden xl:inline">Scan</span>
      </Button>

      {/* Hidden File Inputs for Native Camera and Upload */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) handleImageFile(file);
        }}
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) handleImageFile(file);
        }}
      />

      {/* 2. Universal Scanner Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className={invoiceSearchResults && invoiceSearchResults.total > 0 ? "max-w-2xl max-h-[90vh] overflow-y-auto" : "max-w-md"}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-blue-600" />
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                Universal PhoneZone Search & Scanner
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-gray-500 dark:text-gray-400">
              Search any <strong>Invoice No</strong> (Sale <span className="font-mono text-emerald-600">SAL-</span>, Purchase <span className="font-mono text-blue-600">PUR-</span>, Repair <span className="font-mono text-amber-600">RJ-</span>), IMEI, or Customer. Instant routing to invoice preview, print, or status.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Quick Action Buttons: Camera vs Photo */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                className="h-20 flex flex-col items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm"
                disabled={scanning}
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="h-6 w-6" />
                <span className="text-xs font-semibold">Camera Scan (Live)</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-20 flex flex-col items-center justify-center gap-1.5 border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 rounded-xl shadow-sm"
                disabled={scanning}
                onClick={() => uploadInputRef.current?.click()}
              >
                <Upload className="h-6 w-6 text-slate-700 dark:text-slate-300" />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Upload Photo / File</span>
              </Button>
            </div>

            {/* Manual Text / USB Barcode Gun Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Type Invoice No, IMEI, or Job No</span>
                <span className="text-[10px] text-gray-400 font-normal">Press Enter to Search</span>
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. SAL-..., PUR-..., RJ-..., or 15-digit IMEI"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      processScannedCode(manualCode);
                    }
                  }}
                  disabled={scanning}
                  className="text-xs font-mono"
                  autoFocus
                />
                <Button
                  type="button"
                  size="sm"
                  className="bg-slate-900 hover:bg-black text-white shrink-0 text-xs"
                  disabled={scanning || !manualCode.trim()}
                  onClick={() => processScannedCode(manualCode)}
                >
                  <Search className="h-3.5 w-3.5 mr-1" /> Search
                </Button>
              </div>
            </div>

            {/* Loading Indicator */}
            {scanning && (
              <div className="flex items-center justify-center gap-2 py-3 text-xs text-blue-700 dark:text-blue-300 font-bold bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-500/30 rounded-xl">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{statusMsg || "Searching across all invoices and database..."}</span>
              </div>
            )}

            {/* Multiple Invoice / Transaction Search Results */}
            {invoiceSearchResults && invoiceSearchResults.total > 0 && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-900/80 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-100">
                    <Receipt className="h-4 w-4 text-blue-600" />
                    <span>Found {invoiceSearchResults.total} Matching Invoices & Records</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    "{invoiceSearchResults.query}"
                  </Badge>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setResultTab("all")}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      resultTab === "all"
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                        : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    All ({invoiceSearchResults.total})
                  </button>
                  {invoiceSearchResults.sales.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setResultTab("sales")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        resultTab === "sales"
                          ? "bg-emerald-600 text-white"
                          : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
                      }`}
                    >
                      Sales ({invoiceSearchResults.sales.length})
                    </button>
                  )}
                  {invoiceSearchResults.purchases.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setResultTab("purchases")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        resultTab === "purchases"
                          ? "bg-blue-600 text-white"
                          : "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-300"
                      }`}
                    >
                      Purchases ({invoiceSearchResults.purchases.length})
                    </button>
                  )}
                  {invoiceSearchResults.repairs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setResultTab("repairs")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        resultTab === "repairs"
                          ? "bg-amber-600 text-white"
                          : "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300"
                      }`}
                    >
                      Repairs ({invoiceSearchResults.repairs.length})
                    </button>
                  )}
                </div>

                {/* Items List */}
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {displayedItems.map((item: any, idx: number) => (
                    <div
                      key={item.id || idx}
                      className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/90 hover:border-blue-400 dark:hover:border-blue-500 transition-all shadow-xs flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                            item.invoice_type === "sale"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : item.invoice_type === "purchase"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          }`}>
                            {item.invoice_type === "sale" ? "Sale Invoice" : item.invoice_type === "purchase" ? "Purchase Bill" : "Repair Sheet"}
                          </span>
                          <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                            {item.invoice_number}
                          </span>
                          {item.date && (
                            <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                              <Calendar className="h-2.5 w-2.5" />
                              {item.date.slice(0, 10)}
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                          Party: <strong className="text-slate-700 dark:text-slate-300">{item.party_name}</strong> {item.party_phone ? `(${item.party_phone})` : ""}
                        </div>
                      </div>

                      <div className="text-right shrink-0 space-y-1">
                        <div className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                          {formatINR(item.amount)}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 px-2.5 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs flex items-center gap-1"
                          onClick={() => {
                            if (item.invoice_type === "repair") {
                              setSelectedRepairJob(item.raw || item);
                              setRepairDialogOpen(true);
                              setModalOpen(false);
                            } else {
                              setViewingInvoice(item.raw || item);
                              setModalOpen(false);
                            }
                          }}
                        >
                          <Eye className="h-3 w-3" /> View / Print
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unmatched / Decision Banner */}
            {unmatchedResult && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/80 space-y-2.5">
                {unmatchedResult.isSold ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                      Phone is ALREADY SOLD!
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      <strong>{unmatchedResult.phone?.phone_name} {unmatchedResult.phone?.model}</strong> (IMEI: {unmatchedResult.phone?.imei_number}) was already sold.
                    </p>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between">
                      <span>Sale Price: ₹{unmatchedResult.phone?.selling_price?.toLocaleString("en-IN")}</span>
                      {unmatchedResult.phone?.invoice_number && (
                        <span className="font-mono text-xs text-blue-600 dark:text-blue-400 font-bold">
                          Invoice: {unmatchedResult.phone?.invoice_number}
                        </span>
                      )}
                    </div>
                    {unmatchedResult.phone?.invoice_number && (
                      <Button
                        type="button"
                        size="sm"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs mt-1"
                        onClick={() => {
                          setViewingInvoice(unmatchedResult.phone);
                          setModalOpen(false);
                        }}
                      >
                        <Receipt className="h-3.5 w-3.5 mr-1" /> View Sale Invoice
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Code Not Found in Active Inventory or Invoices
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      Code <strong>{unmatchedResult.code}</strong> is not in available phone stock, invoices, or repair records. Choose an action:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                        onClick={() => {
                          setInwardPhoneImei(unmatchedResult.code);
                          setAddPhoneDialogOpen(true);
                          setModalOpen(false);
                        }}
                      >
                        <ShoppingBag className="h-3.5 w-3.5 mr-1" /> Inward / Buy Phone
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-indigo-300 text-indigo-700 dark:border-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 text-xs"
                        onClick={() => {
                          setAddRepairDialogOpen(true);
                          setModalOpen(false);
                        }}
                      >
                        <Wrench className="h-3.5 w-3.5 mr-1" /> New Repair Job
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2b. Auto-Routed Invoice Detail Dialog for Sales / Purchases */}
      {viewingInvoice && (
        <InvoiceDetailDialog
          open={!!viewingInvoice}
          onOpenChange={(open) => {
            if (!open) setViewingInvoice(null);
          }}
          invoice={viewingInvoice}
        />
      )}

      {/* 3. Auto-Routed Process Sale Dialog */}
      {selectedPhoneForSale && (
        <ProcessSaleDialog
          phone={selectedPhoneForSale}
          open={saleDialogOpen}
          onOpenChange={(open) => {
            setSaleDialogOpen(open);
            if (!open) setSelectedPhoneForSale(null);
          }}
        />
      )}

      {/* 4. Auto-Routed Repair Job Detail & Status Dialog */}
      {selectedRepairJob && (
        <RepairDetailDialog
          job={selectedRepairJob}
          open={repairDialogOpen}
          onOpenChange={(open) => {
            setRepairDialogOpen(open);
            if (!open) setSelectedRepairJob(null);
          }}
          onRefresh={() => {}}
        />
      )}

      {/* 5. Inward / Purchase Phone Dialog if scanned IMEI not in stock */}
      <AddPhoneDialog
        open={addPhoneDialogOpen}
        onOpenChange={setAddPhoneDialogOpen}
        initialImei={inwardPhoneImei}
      />

      {/* 6. New Repair Job Dialog if chosen */}
      <AddRepairDialog
        open={addRepairDialogOpen}
        onOpenChange={setAddRepairDialogOpen}
        onSuccess={() => {}}
      />
    </>
  );
};

export default UniversalScanner;

