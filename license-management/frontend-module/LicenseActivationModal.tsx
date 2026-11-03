import React, { useState, useEffect } from "react";
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
  ShieldCheck,
  Key,
  Cpu,
  Copy,
  Check,
  Sparkles,
  Lock,
  Unlock,
  AlertCircle,
  Clock,
  LogOut,
  RefreshCw,
} from "lucide-react";

interface LicenseStatus {
  activated: boolean;
  status: string;
  softwareId: string;
  planType?: string;
  isGodMode?: boolean;
  customerName?: string;
  shopName?: string;
  validUntil?: string | null;
  daysRemaining?: number;
  allowedPlatforms?: string[];
  hardwareLockEnabled?: boolean;
  hwid: string;
  platform: string;
  message?: string;
}

interface LicenseActivationModalProps {
  forceOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const LicenseActivationModal: React.FC<LicenseActivationModalProps> = ({
  forceOpen = false,
  onOpenChange,
}) => {
  const [licenseData, setLicenseData] = useState<LicenseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [inputKey, setInputKey] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [shopName, setShopName] = useState("");
  const [copiedHwid, setCopiedHwid] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/license/status");
      if (res.ok) {
        const data = await res.json();
        setLicenseData(data);
      }
    } catch {
      // Offline fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const isOpen = forceOpen || manualOpen || (!loading && licenseData && !licenseData.activated);

  const handleCopyHwid = () => {
    if (licenseData?.hwid) {
      navigator.clipboard.writeText(licenseData.hwid);
      setCopiedHwid(true);
      toast.success("Hardware ID copied to clipboard!");
      setTimeout(() => setCopiedHwid(false), 2500);
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) {
      toast.error("Please enter a valid license activation key or master secret.");
      return;
    }

    setActivating(true);
    try {
      const res = await fetch("/api/license/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey: inputKey.trim(),
          customerName: customerName.trim(),
          shopName: shopName.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error || "Activation failed. Please check key.");
        return;
      }

      if (data.isGodMode) {
        toast.success("🌟 God Mode Activated! Lifetime VIP Free Access Unlocked!");
      } else {
        toast.success(data.message || "License activated successfully!");
      }

      setInputKey("");
      setManualOpen(false);
      onOpenChange?.(false);
      await fetchStatus();
    } catch (err: any) {
      toast.error(err.message || "Network error activating license.");
    } finally {
      setActivating(false);
    }
  };

  const handleDeactivate = async () => {
    if (!confirm("Are you sure you want to deactivate and logout this PC? You can then activate your license on another PC.")) return;
    try {
      const res = await fetch("/api/license/deactivate", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.info("Device deactivated. License is released.");
        fetchStatus();
      } else {
        toast.error(data.error || "Deactivation failed.");
      }
    } catch {
      toast.error("Network error.");
    }
  };

  if (loading) return null;

  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          // If licensed, allow closing; if completely unlicensed, prevent closing without activation
          if (licenseData?.activated) {
            setManualOpen(open);
            onOpenChange?.(open);
          } else {
            toast.warning("License activation is required to use PhoneZone.");
          }
        }}
      >
        <DialogContent className="max-w-md sm:max-w-lg border border-slate-700 bg-[#0d1322] text-white p-6 rounded-3xl shadow-2xl">
          <DialogHeader className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <ShieldCheck className="h-6 w-6" />
              </div>
              {licenseData?.activated && (
                <Badge className={licenseData.isGodMode ? "bg-amber-500 text-black font-extrabold" : "bg-emerald-600 text-white font-bold"}>
                  {licenseData.isGodMode ? "🌟 VIP GOD MODE" : `ACTIVE (${licenseData.daysRemaining}d)`}
                </Badge>
              )}
            </div>

            <DialogTitle className="text-xl font-extrabold text-white tracking-tight">
              {licenseData?.activated ? "PhoneZone License & Device Status" : "Activate PhoneZone License"}
            </DialogTitle>

            <DialogDescription className="text-xs text-slate-400">
              {licenseData?.activated
                ? "This machine is activated and licensed. All LAN, ngrok, and mobile users connected to this server share this activation."
                : "Enter your official activation key or master secret to unlock full features, inventory, accounting, and repairs."}
            </DialogDescription>
          </DialogHeader>

          {/* Machine HWID Card */}
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5 font-semibold">
                <Cpu className="h-3.5 w-3.5 text-blue-400" /> Machine Hardware ID (HWID):
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold uppercase">
                {licenseData?.platform || "EXE"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-xs text-blue-300 bg-slate-950 p-2 rounded-xl border border-slate-800 truncate select-all">
                {licenseData?.hwid || "Detecting HWID..."}
              </code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCopyHwid}
                className="h-8 px-2.5 bg-slate-800 border-slate-700 text-xs text-white hover:bg-slate-700 shrink-0"
              >
                {copiedHwid ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          {/* Active License Details (if already licensed) */}
          {licenseData?.activated ? (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Plan Type:</span>
                  <span className="font-bold text-emerald-400 capitalize">{licenseData.planType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Licensed To:</span>
                  <span className="font-bold text-white">{licenseData.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Shop / Branch:</span>
                  <span className="font-bold text-white">{licenseData.shopName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Validity:</span>
                  <span className="font-mono text-white">
                    {licenseData.validUntil ? new Date(licenseData.validUntil).toLocaleDateString("en-IN") : "Lifetime"}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDeactivate}
                  className="w-full border-rose-500/40 text-rose-400 hover:bg-rose-500/10 text-xs font-bold"
                >
                  <LogOut className="h-3.5 w-3.5 mr-1" /> Deactivate / Transfer to Another PC
                </Button>
              </div>
            </div>
          ) : (
            /* Activation Input Form */
            <form onSubmit={handleActivate} className="space-y-3 py-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>License Key / Master Secret Key</span>
                  <span className="text-[10px] text-blue-400">God Mode Compatible</span>
                </label>
                <div className="relative">
                  <Input
                    placeholder="Enter License Key (e.g. PZON-...) or Secret"
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    required
                    className="font-mono text-xs bg-slate-900 border-slate-700 text-white placeholder-slate-500 pr-10"
                    autoFocus
                  />
                  <Key className="absolute right-3 top-2.5 h-4 w-4 text-slate-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[11px] text-slate-400">Owner Name (Optional)</label>
                  <Input
                    placeholder="e.g. Mohd Zubair"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="text-xs bg-slate-900 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Shop Name (Optional)</label>
                  <Input
                    placeholder="e.g. Mobile World"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    className="text-xs bg-slate-900 border-slate-700 text-white"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={activating}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 mt-2"
              >
                {activating ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Verifying & Activating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Activate License</span>
                  </>
                )}
              </Button>
            </form>
          )}

          <DialogFooter className="border-t border-slate-800 pt-3">
            <div className="w-full flex items-center justify-between text-[11px] text-slate-500">
              <span>Universal License Engine 2026</span>
              {licenseData?.activated && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setManualOpen(false);
                    onOpenChange?.(false);
                  }}
                  className="text-slate-400 hover:text-white text-xs h-7"
                >
                  Close
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LicenseActivationModal;
