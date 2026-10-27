import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Wrench, Search, AlertTriangle, History, Smartphone, User, ShieldAlert, Wifi, WifiOff, Globe, Loader2, CheckCircle2 } from "lucide-react";
import RepairHistoryPanel from "./RepairHistoryPanel";
import ImeiScanButton from "./ImeiScanButton";
import AadhaarScanButton from "./AadhaarScanButton";
import RepairShareModal from "./RepairShareModal";
import { useTacLookup } from "@/hooks/useTacLookup";

interface AddRepairDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const COMMON_PROBLEMS = [
  "Screen / Display Broken",
  "Battery Draining Fast / Dead",
  "Charging Port Loose / Not Charging",
  "Mic / Speaker Not Working",
  "Water Damage / Liquid Spill",
  "Dead / No Power",
  "Software / Boot Loop / Hanging",
  "Camera Blurry / Broken",
  "Network / Wi-Fi Issue",
  "Back Glass Broken",
  "Other Hardware Issue",
];

export const AddRepairDialog: React.FC<AddRepairDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  // Customer state
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [idProofType, setIdProofType] = useState("aadhaar");
  const [idNumber, setIdNumber] = useState("");
  const [existingCustomerId, setExistingCustomerId] = useState<string | null>(null);

  // Device state
  const [imei, setImei] = useState("");
  const [deviceBrand, setDeviceBrand] = useState("");
  const [deviceModel, setDeviceModel] = useState("");
  const [problem, setProblem] = useState("");
  const [selectedCommonProblem, setSelectedCommonProblem] = useState("");
  const [passcodeNote, setPasscodeNote] = useState("");

  // Accessories checkboxes
  const [accSim, setAccSim] = useState(false);
  const [accTray, setAccTray] = useState(false);
  const [accCover, setAccCover] = useState(false);
  const [accCharger, setAccCharger] = useState(false);
  const [accSd, setAccSd] = useState(false);

  // Cost & technician
  const [estimate, setEstimate] = useState("");
  const [advancePaid, setAdvancePaid] = useState("");
  const [technician, setTechnician] = useState("");
  const [warrantyDays, setWarrantyDays] = useState("30");

  // History & warning states
  const [imeiHistory, setImeiHistory] = useState<any[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Job Sheet WhatsApp Dispatch Dialog
  const [createdJobForShare, setCreatedJobForShare] = useState<any | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // TAC Lookup & Specs Auto-fill
  const { status: tacStatus, info: tacInfo, error: tacError, fetchOnline: tacFetch } = useTacLookup(
    imei,
    ({ brand, phoneName, model }) => {
      if (brand && !deviceBrand) setDeviceBrand(brand);
      if (model && !deviceModel) setDeviceModel(model);
      else if (phoneName && !deviceModel) setDeviceModel(phoneName);
    }
  );

  useEffect(() => {
    if (tacInfo?.found) {
      if (tacInfo.brand && !deviceBrand) setDeviceBrand(tacInfo.brand);
      if (tacInfo.model && !deviceModel) setDeviceModel(tacInfo.model);
      else if (tacInfo.phoneName && !deviceModel) setDeviceModel(tacInfo.phoneName);
    }
  }, [tacInfo]);

  // Auto-search customer by phone
  useEffect(() => {
    const cleanPhone = customerPhone.replace(/\D/g, "");
    if (cleanPhone.length === 10) {
      fetch(`/api/repair/customers/by-phone/${cleanPhone}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            setExistingCustomerId(data.id);
            if (!customerName) setCustomerName(data.name || "");
            if (!customerAddress && data.address) setCustomerAddress(data.address);
            if (!idNumber && data.id_number) {
              setIdNumber(data.id_number);
              if (data.id_proof_type) setIdProofType(data.id_proof_type);
            }
            toast({
              title: "Existing Customer Found",
              description: `Loaded details for ${data.name}`,
            });
          } else {
            setExistingCustomerId(null);
          }
        })
        .catch(() => {});
    } else {
      setExistingCustomerId(null);
    }
  }, [customerPhone]);

  // Check IMEI repair history
  useEffect(() => {
    const cleanImei = imei.trim();
    if (cleanImei.length >= 14) {
      fetch(`/api/repair/by-imei/${cleanImei}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((jobs) => {
          if (Array.isArray(jobs) && jobs.length > 0) {
            setImeiHistory(jobs);
          } else {
            setImeiHistory([]);
          }
        })
        .catch(() => setImeiHistory([]));
    } else {
      setImeiHistory([]);
    }
  }, [imei]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim() || !customerPhone.trim()) {
      toast({
        title: "Validation Error",
        description: "Customer Name and Mobile Number are required.",
        variant: "destructive",
      });
      return;
    }



    const finalProblem = problem.trim() || selectedCommonProblem;
    if (!finalProblem) {
      toast({
        title: "Validation Error",
        description: "Please specify the problem or issue reported.",
        variant: "destructive",
      });
      return;
    }

    const accessoriesList: string[] = [];
    if (accSim) accessoriesList.push("SIM");
    if (accTray) accessoriesList.push("SIM Tray");
    if (accCover) accessoriesList.push("Cover / Case");
    if (accCharger) accessoriesList.push("Charger / Cable");
    if (accSd) accessoriesList.push("SD / Memory Card");

    setSubmitting(true);
    try {
      const payload: any = {
        device_brand: deviceBrand.trim(),
        device_model: deviceModel.trim(),
        imei: imei.trim(),
        problem: finalProblem,
        accessories_received: accessoriesList.join(", ") || "None",
        passcode_note: passcodeNote.trim(),
        estimate: Number(estimate) || null,
        advance_paid: Number(advancePaid) || 0,
        technician: technician.trim() || "Main Workshop",
        warranty_days: Number(warrantyDays) || 30,
      };

      if (existingCustomerId) {
        payload.repair_customer_id = existingCustomerId;
      } else {
        payload.customer = {
          name: customerName.trim(),
          phone: customerPhone.trim(),
          address: customerAddress.trim(),
          id_proof_type: idProofType,
          id_number: idNumber.trim(),
        };
      }

      const res = await fetch("/api/repair/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create repair job.");
      }

      toast({
        title: "Repair Job Created",
        description: `Job ${data.job_no} logged successfully.`,
      });

      // Auto-learn TAC if new
      fetch("/api/tac/auto-learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imei: imei.trim(),
          brand: deviceBrand.trim(),
          model: deviceModel.trim(),
          phoneName: `${deviceBrand} ${deviceModel}`.trim(),
        }),
      }).catch(() => {});

      onSuccess();
      setCreatedJobForShare(data);
      setShareModalOpen(true);
    } catch (err: any) {
      toast({
        title: "Error Creating Job",
        description: err.message || "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const hasMotherboardHistory = imeiHistory.some((j) => !!j.board_replaced);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-blue-700">
            <Wrench className="h-6 w-6" />
            <DialogTitle className="text-xl">New Device Repair Job</DialogTitle>
          </div>
        </DialogHeader>

        {/* History warning banner if previously repaired */}
        {imeiHistory.length > 0 && (
          <div
            className={`p-3 rounded-lg border text-sm flex items-center justify-between ${
              hasMotherboardHistory
                ? "bg-red-50 border-red-300 text-red-800"
                : "bg-amber-50 border-amber-300 text-amber-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {hasMotherboardHistory ? (
                <ShieldAlert className="h-5 w-5 text-red-600 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
              )}
              <div>
                <span className="font-semibold">
                  {hasMotherboardHistory
                    ? "Warning: Previous repair included Motherboard Replacement!"
                    : "This phone was previously repaired at our shop!"}
                </span>{" "}
                ({imeiHistory.length} record{imeiHistory.length > 1 ? "s" : ""})
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="bg-white ml-2 text-xs"
              onClick={() => setShowHistoryModal(true)}
            >
              <History className="w-3.5 h-3.5 mr-1" />
              View History
            </Button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Section 1: Customer */}
          <div className="border rounded-lg p-3.5 bg-gray-50/60 space-y-3">
            <div className="flex items-center justify-between border-b pb-1.5 flex-wrap gap-2">
              <div className="flex items-center gap-1.5 font-semibold text-sm text-gray-800">
                <User className="h-4 w-4 text-blue-600" />
                Customer Details
              </div>
              <AadhaarScanButton
                disabled={submitting}
                onResult={(data) => {
                  if (data.name) setCustomerName(data.name);
                  if (data.address) setCustomerAddress(data.address);
                  if (data.idNumber) {
                    setIdNumber(data.idNumber);
                    setIdProofType("aadhaar");
                  }
                  if (data.mobile && !customerPhone) setCustomerPhone(data.mobile);
                  toast({
                    title: "Aadhaar Scanned",
                    description: `Loaded data for ${data.name || "customer"}`,
                  });
                }}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cust-phone" className="text-xs">
                  Mobile Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="cust-phone"
                  placeholder="10-digit mobile"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  maxLength={10}
                  required
                />
              </div>
              <div>
                <Label htmlFor="cust-name" className="text-xs">
                  Customer Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="cust-name"
                  placeholder="Full name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="cust-addr" className="text-xs">Address</Label>
                <Input
                  id="cust-addr"
                  placeholder="City / Area"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="cust-id" className="text-xs">ID Number (Optional)</Label>
                <Input
                  id="cust-id"
                  placeholder="Aadhaar / Voter / PAN"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Device */}
          <div className="border rounded-lg p-3.5 bg-gray-50/60 space-y-3">
            <div className="flex items-center gap-1.5 font-semibold text-sm text-gray-800 border-b pb-1.5">
              <Smartphone className="h-4 w-4 text-blue-600" />
              Device Information
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <Label htmlFor="dev-imei" className="text-xs font-semibold text-gray-900">
                    IMEI (15 Digits) <span className="text-red-600 font-bold">*</span>
                  </Label>
                  <ImeiScanButton
                    disabled={submitting}
                    onResult={(r) => {
                      setImei(r.imei);
                      if (r.via === "barcode") {
                        tacFetch(r.imei).catch(() => {});
                      }
                    }}
                  />
                </div>
                <Input
                  id="dev-imei"
                  placeholder="Mandatory 15-digit IMEI"
                  value={imei}
                  onChange={(e) => setImei(e.target.value)}
                  maxLength={16}
                  required
                  className="font-mono text-sm border-blue-400 focus:border-blue-600"
                />
                {tacStatus !== "idle" && (
                  <div
                    className={`text-xs mt-1.5 flex items-center gap-1 flex-wrap ${
                      tacStatus === "found"
                        ? "text-emerald-700"
                        : tacStatus === "error"
                          ? "text-red-500"
                          : "text-gray-500"
                    }`}
                    role="status"
                  >
                    {tacStatus === "checking" && (
                      <><Loader2 className="h-3 w-3 animate-spin text-blue-500" /> Checking TAC database...</>
                    )}
                    {tacStatus === "found" && (
                      <div className="flex items-center gap-1 flex-wrap">
                        <Wifi className="h-3 w-3 text-emerald-600 shrink-0" />
                        <span className="font-semibold">{tacInfo?.brand} {tacInfo?.phoneName || tacInfo?.model}</span>
                        <Badge variant="outline" className="text-[10px] py-0 px-1 border-emerald-300 bg-emerald-50 text-emerald-800">
                          ✓ Auto-filled
                        </Badge>
                      </div>
                    )}
                    {tacStatus === "fetching" && (
                      <><Globe className="h-3 w-3 animate-spin text-blue-600" /> Fetching specs from Hicelltek API...</>
                    )}
                    {tacStatus === "miss" && (
                      <div className="flex items-center gap-1 flex-wrap text-[11px]">
                        <WifiOff className="h-3 w-3 text-amber-500 shrink-0" />
                        <span>TAC not in local DB.</span>
                        {(tacInfo?.fetchMode as string) === "ask" && tacInfo?.hasKeys ? (
                          <button
                            type="button"
                            className="underline font-semibold text-blue-600 hover:text-blue-800"
                            onClick={() => tacFetch(imei)}
                          >
                            Look up online?
                          </button>
                        ) : (tacInfo?.fetchMode as string) === "off" ? (
                          <span className="text-gray-400">(online lookup off)</span>
                        ) : tacInfo?.hasKeys === false ? (
                          <span className="text-gray-400">(no API key)</span>
                        ) : null}
                      </div>
                    )}
                    {tacStatus === "error" && <>{tacError || "TAC lookup failed."}</>}
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="dev-brand" className="text-xs">Brand</Label>
                <Input
                  id="dev-brand"
                  placeholder="e.g. Samsung, Apple"
                  value={deviceBrand}
                  onChange={(e) => setDeviceBrand(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="dev-model" className="text-xs">Model</Label>
                <Input
                  id="dev-model"
                  placeholder="e.g. Galaxy S21"
                  value={deviceModel}
                  onChange={(e) => setDeviceModel(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Problem & Accessories */}
          <div className="border rounded-lg p-3.5 bg-gray-50/60 space-y-3">
            <div className="font-semibold text-sm text-gray-800 border-b pb-1.5">
              Problem & Accessories
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Common Problem Selection</Label>
              <select
                className="w-full text-sm border rounded-md p-2 bg-white"
                value={selectedCommonProblem}
                onChange={(e) => {
                  setSelectedCommonProblem(e.target.value);
                  if (e.target.value && !problem) setProblem(e.target.value);
                }}
              >
                <option value="">-- Choose common problem (or type below) --</option>
                {COMMON_PROBLEMS.map((p, idx) => (
                  <option key={idx} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="prob-desc" className="text-xs">
                Detailed Problem Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="prob-desc"
                placeholder="Describe fault, customer complaints, diagnosis observations..."
                rows={2}
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                required
              />
            </div>

            <div className="pt-1">
              <Label className="text-xs mb-1.5 block text-gray-700">Accessories Received with Phone:</Label>
              <div className="flex flex-wrap gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox checked={accSim} onCheckedChange={(c) => setAccSim(!!c)} />
                  <span>SIM Card</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox checked={accTray} onCheckedChange={(c) => setAccTray(!!c)} />
                  <span>SIM Tray</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox checked={accCover} onCheckedChange={(c) => setAccCover(!!c)} />
                  <span>Back Cover</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox checked={accCharger} onCheckedChange={(c) => setAccCharger(!!c)} />
                  <span>Charger / Cable</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox checked={accSd} onCheckedChange={(c) => setAccSd(!!c)} />
                  <span>SD Card</span>
                </label>
              </div>
            </div>

            <div>
              <Label htmlFor="pass-note" className="text-xs">Passcode / Pattern / Lock Note</Label>
              <Input
                id="pass-note"
                placeholder="PIN / Lock details for testing"
                value={passcodeNote}
                onChange={(e) => setPasscodeNote(e.target.value)}
              />
            </div>
          </div>

          {/* Section 4: Commercials & Technician */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border rounded-lg p-3.5 bg-gray-50/60">
            <div>
              <Label htmlFor="cost-est" className="text-xs">Estimate (₹)</Label>
              <Input
                id="cost-est"
                type="number"
                placeholder="0"
                value={estimate}
                onChange={(e) => setEstimate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="cost-adv" className="text-xs">Advance Paid (₹)</Label>
              <Input
                id="cost-adv"
                type="number"
                placeholder="0"
                value={advancePaid}
                onChange={(e) => setAdvancePaid(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="tech-name" className="text-xs">Technician</Label>
              <Input
                id="tech-name"
                placeholder="Tech name"
                value={technician}
                onChange={(e) => setTechnician(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="warranty" className="text-xs">Warranty (Days)</Label>
              <Input
                id="warranty"
                type="number"
                placeholder="30"
                value={warrantyDays}
                onChange={(e) => setWarrantyDays(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
              disabled={submitting}
            >
              {submitting ? "Logging Job..." : "Create Repair Job"}
            </Button>
          </DialogFooter>
        </form>

        {/* Previous repair history dialog */}
        <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Previous Repair History for IMEI: {imei}</DialogTitle>
            </DialogHeader>
            <RepairHistoryPanel jobs={imeiHistory} />
            <DialogFooter>
              <Button onClick={() => setShowHistoryModal(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Job Sheet WhatsApp Prompt Dialog */}
        {createdJobForShare && (
          <RepairShareModal
            open={shareModalOpen}
            onOpenChange={(isOpen) => {
              setShareModalOpen(isOpen);
              if (!isOpen) {
                setCreatedJobForShare(null);
                onOpenChange(false);
              }
            }}
            job={createdJobForShare}
            mode="jobsheet"
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AddRepairDialog;

