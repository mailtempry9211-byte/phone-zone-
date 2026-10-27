import React, { useState, useRef } from "react";
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
} from "lucide-react";
import { decodeBarcode } from "./ImeiScanButton";
import ProcessSaleDialog from "./ProcessSaleDialog";
import RepairDetailDialog from "./RepairDetailDialog";
import AddPhoneDialog from "./AddPhoneDialog";
import AddRepairDialog from "./AddRepairDialog";

export const UniversalScanner: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [unmatchedResult, setUnmatchedResult] = useState<{
    code: string;
    isSold?: boolean;
    phone?: any;
  } | null>(null);

  // Routed Target Dialog States
  const [selectedPhoneForSale, setSelectedPhoneForSale] = useState<any | null>(null);
  const [saleDialogOpen, setSaleDialogOpen] = useState(false);

  const [selectedRepairJob, setSelectedRepairJob] = useState<any | null>(null);
  const [repairDialogOpen, setRepairDialogOpen] = useState(false);

  const [inwardPhoneImei, setInwardPhoneImei] = useState<string>("");
  const [addPhoneDialogOpen, setAddPhoneDialogOpen] = useState(false);

  const [addRepairDialogOpen, setAddRepairDialogOpen] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

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
    setStatusMsg(`Checking code: ${code}...`);
    setUnmatchedResult(null);

    try {
      // 1. REPAIR CHECK: Does it match a Repair Job Number? (starts with RJ- or search match)
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

      // 2. PHONE INVENTORY CHECK: Is it a 15-digit IMEI or phone record?
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
              // Phone is already sold
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

      // 3. GENERAL SEARCH FALLBACK (Search both repairs and inventory by text)
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
        className="h-9 px-3 text-xs font-bold border-blue-400 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 text-blue-900 shadow-sm flex items-center gap-1.5 transition-all"
        onClick={() => {
          setModalOpen(true);
          setUnmatchedResult(null);
          setManualCode("");
        }}
      >
        <QrCode className="h-4 w-4 text-blue-600" />
        <span>Universal Scan</span>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-blue-600" />
              <DialogTitle className="text-base font-bold text-slate-900">
                Universal PhoneZone Scanner
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-gray-500">
              Scan any QR Code, Barcode, or enter IMEI / Job No. Automatically routes to <strong>Process Sale</strong> or <strong>Repair Status Update</strong>.
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
                className="h-20 flex flex-col items-center justify-center gap-1.5 border-slate-300 hover:bg-slate-50 rounded-xl shadow-sm"
                disabled={scanning}
                onClick={() => uploadInputRef.current?.click()}
              >
                <Upload className="h-6 w-6 text-slate-700" />
                <span className="text-xs font-semibold text-slate-800">Upload Photo / File</span>
              </Button>
            </div>

            {/* Manual Text / USB Barcode Gun Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>Or Type / Scan with Barcode Gun</span>
                <span className="text-[10px] text-gray-400 font-normal">Press Enter to Search</span>
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="15-digit IMEI or Job No (e.g. RJ-MAIN-...)"
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
              <div className="flex items-center justify-center gap-2 py-3 text-xs text-blue-700 font-semibold bg-blue-50 rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{statusMsg || "Scanning & identifying code..."}</span>
              </div>
            )}

            {/* Unmatched / Decision Banner */}
            {unmatchedResult && (
              <div className="border rounded-xl p-3 bg-slate-50 space-y-2.5">
                {unmatchedResult.isSold ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                      Phone is ALREADY SOLD!
                    </div>
                    <p className="text-xs text-gray-600">
                      <strong>{unmatchedResult.phone?.phone_name} {unmatchedResult.phone?.model}</strong> (IMEI: {unmatchedResult.phone?.imei_number}) has already been sold.
                    </p>
                    <div className="text-[11px] text-gray-500">
                      Sale Price: ₹{unmatchedResult.phone?.selling_price?.toLocaleString("en-IN")}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Code Not Found in Active Inventory
                    </div>
                    <p className="text-xs text-gray-600">
                      Code <strong>{unmatchedResult.code}</strong> is not in available phone stock or repair records. Choose an action:
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
                        className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 text-xs"
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
