import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Globe,
  Wifi,
  WifiOff,
  Copy,
  ExternalLink,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Power,
  QrCode,
  Smartphone,
} from "lucide-react";
import QRCode from "qrcode";
import { LOCAL_API_BASE } from "@/lib/data/config";

export const NgrokUniversalControl: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: status, isFetching, refetch } = useQuery({
    queryKey: ["ngrok-status"],
    queryFn: async () => {
      const res = await fetch(`${LOCAL_API_BASE}/ngrok/status`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch Ngrok status");
      const data = await res.json();
      if (data.running && data.lastUrl) {
        QRCode.toDataURL(data.lastUrl, { width: 180, margin: 1 })
          .then((url) => setQrDataUrl(url))
          .catch(() => {});
      } else {
        setQrDataUrl(null);
      }
      return data;
    },
    refetchInterval: open ? 3000 : 8000,
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${LOCAL_API_BASE}/ngrok/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start Ngrok tunnel");
      return data;
    },
    onSuccess: (data) => {
      toast.success("Ngrok tunnel online!");
      if (data.url) {
        QRCode.toDataURL(data.url, { width: 180, margin: 1 }).then((u) => setQrDataUrl(u)).catch(() => {});
      }
      queryClient.invalidateQueries({ queryKey: ["ngrok-status"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Error starting Ngrok tunnel");
    },
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${LOCAL_API_BASE}/ngrok/stop`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to stop Ngrok tunnel");
      return data;
    },
    onSuccess: () => {
      toast.info("Ngrok tunnel stopped. Shop is offline from internet.");
      setQrDataUrl(null);
      queryClient.invalidateQueries({ queryKey: ["ngrok-status"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Error stopping Ngrok tunnel");
    },
  });

  const autoStartMutation = useMutation({
    mutationFn: async (autoStart: boolean) => {
      const res = await fetch(`${LOCAL_API_BASE}/ngrok/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ autoStart }),
      });
      if (!res.ok) throw new Error("Failed to save auto-start setting");
      return res.json();
    },
    onSuccess: (_data, autoStart) => {
      toast.success(autoStart ? "Ngrok auto-start enabled" : "Ngrok auto-start disabled");
      queryClient.invalidateQueries({ queryKey: ["ngrok-status"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update setting");
    },
  });

  const isRunning = Boolean(status?.running);
  const autoStart = Boolean(status?.autoStart ?? true);
  const activeUrl = status?.lastUrl || "";

  const handleCopyUrl = () => {
    if (!activeUrl) return;
    navigator.clipboard.writeText(activeUrl);
    toast.success("Public Ngrok URL copied to clipboard!");
  };

  return (
    <>
      {/* Universal Top Header Pill Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={`h-9 px-3 text-xs font-bold border transition-all flex items-center gap-1.5 shadow-sm ${
          isRunning
            ? "border-blue-300 bg-blue-50 text-blue-900 hover:bg-blue-100"
            : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
        }`}
        onClick={() => setOpen(true)}
      >
        <Globe
          className={`h-4 w-4 ${isRunning ? "text-blue-600 animate-pulse" : "text-slate-500"}`}
        />
        <span className="hidden sm:inline">Online:</span>
        {isRunning ? (
          <span className="flex items-center gap-1 text-blue-700 font-semibold">
            <span className="h-2 w-2 rounded-full bg-blue-500"></span>
            Online
          </span>
        ) : (
          <span className="flex items-center gap-1 text-slate-500">
            <span className="h-2 w-2 rounded-full bg-slate-400"></span>
            Offline
          </span>
        )}
      </Button>

      {/* Control Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-between pr-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                  <Globe className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-slate-900">
                    Remote Mobile Access (Ngrok)
                  </DialogTitle>
                  <DialogDescription className="text-xs text-gray-500">
                    Access PhoneZone securely from phone or outside shop
                  </DialogDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-500 hover:text-slate-800"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Status Card */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Tunnel Status:</span>
                {isRunning ? (
                  <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-[11px] gap-1">
                    <Wifi className="h-3 w-3 text-emerald-600" /> Online &amp; Accessible
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-slate-200 text-slate-700 border-slate-300 font-bold text-[11px] gap-1">
                    <WifiOff className="h-3 w-3 text-slate-500" /> Offline / Local Only
                  </Badge>
                )}
              </div>

              {isRunning && activeUrl && (
                <div className="border-t border-slate-200/80 pt-2 space-y-1.5">
                  <span className="text-xs text-slate-500 block">Public URL:</span>
                  <div className="flex items-center gap-1.5 bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-xs font-mono font-semibold text-blue-700 truncate flex-1">
                      {activeUrl}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-600 hover:text-blue-700"
                      onClick={handleCopyUrl}
                      title="Copy URL"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-600 hover:text-blue-700"
                      asChild
                    >
                      <a href={activeUrl} target="_blank" rel="noreferrer" title="Open Link">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </div>
                </div>
              )}

              {status?.claimedDomain && (
                <div className="flex items-center justify-between border-t border-slate-200/80 pt-2 text-xs">
                  <span className="text-slate-500">Static Domain:</span>
                  <span className="font-semibold text-slate-800 font-mono text-[11px]">{status.claimedDomain}</span>
                </div>
              )}
            </div>

            {/* QR Code for Mobile Scanning */}
            {isRunning && qrDataUrl && (
              <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/50 flex flex-col items-center justify-center gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                  <Smartphone className="h-4 w-4 text-blue-600" /> Scan QR from Mobile to Open Shop
                </div>
                <div className="p-2 bg-white rounded-lg border border-blue-200 shadow-xs">
                  <img src={qrDataUrl} alt="Ngrok QR" className="w-36 h-36 object-contain" />
                </div>
              </div>
            )}

            {/* Auto-Start on App Launch Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white shadow-xs">
              <div className="space-y-0.5">
                <Label htmlFor="ngrok_autostart" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Auto-start on Application Launch
                </Label>
                <p className="text-[11px] text-gray-500">
                  PhoneZone start hote hi Ngrok tunnel automatically online ho jayega.
                </p>
              </div>
              <Switch
                id="ngrok_autostart"
                checked={autoStart}
                disabled={autoStartMutation.isPending}
                onCheckedChange={(checked) => autoStartMutation.mutate(checked)}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {!isRunning ? (
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9"
                  onClick={() => startMutation.mutate()}
                  disabled={startMutation.isPending}
                >
                  {startMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Starting Tunnel...
                    </>
                  ) : (
                    <>
                      <Wifi className="h-4 w-4 mr-1.5" /> Start Ngrok Tunnel
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="flex-1 border-rose-300 text-rose-700 hover:bg-rose-50 font-semibold text-xs h-9"
                  onClick={() => stopMutation.mutate()}
                  disabled={stopMutation.isPending}
                >
                  {stopMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Stopping Tunnel...
                    </>
                  ) : (
                    <>
                      <Power className="h-4 w-4 mr-1.5 text-rose-600" /> Stop Tunnel (Go Offline)
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          <DialogFooter className="sm:justify-between border-t pt-3">
            <span className="text-[11px] text-gray-400">
              {isRunning ? "Reachable worldwide with TLS encryption" : "Local offline mode: 127.0.0.1"}
            </span>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default NgrokUniversalControl;
