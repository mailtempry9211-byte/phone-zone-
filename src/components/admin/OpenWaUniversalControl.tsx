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
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  MessageSquare,
  Play,
  Square,
  RefreshCw,
  ExternalLink,
  QrCode,
  Phone,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Radio,
  Power,
} from "lucide-react";
import { LOCAL_API_BASE } from "@/lib/data/config";

export const OpenWaUniversalControl: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [pairingPhone, setPairingPhone] = useState("");
  const [generatedPairingCode, setGeneratedPairingCode] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Poll server status every 5 seconds
  const { data: serverStatus, isFetching, refetch } = useQuery({
    queryKey: ["openwa-server-status"],
    queryFn: async () => {
      const res = await fetch(`${LOCAL_API_BASE}/wa/gateway/server-status`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch OpenWA status");
      return res.json();
    },
    refetchInterval: open ? 3000 : 8000,
  });

  const { data: configData } = useQuery({
    queryKey: ["openwa-config"],
    queryFn: async () => {
      const res = await fetch(`${LOCAL_API_BASE}/wa/gateway/config`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch OpenWA config");
      return res.json();
    },
  });

  // Start Server Mutation
  const startServerMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${LOCAL_API_BASE}/wa/gateway/start-server`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start OpenWA server");
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "OpenWA Server started!");
      queryClient.invalidateQueries({ queryKey: ["openwa-server-status"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Error starting OpenWA server");
    },
  });

  // Stop Server Mutation
  const stopServerMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${LOCAL_API_BASE}/wa/gateway/stop-server`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to stop OpenWA server");
      return data;
    },
    onSuccess: () => {
      toast.info("OpenWA Server stopped");
      queryClient.invalidateQueries({ queryKey: ["openwa-server-status"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Error stopping OpenWA server");
    },
  });

  // Auto-Start Toggle Mutation
  const autoStartMutation = useMutation({
    mutationFn: async (autoStart: boolean) => {
      const res = await fetch(`${LOCAL_API_BASE}/wa/gateway/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ autoStart }),
      });
      if (!res.ok) throw new Error("Failed to update auto-start setting");
      return res.json();
    },
    onSuccess: (_data, autoStart) => {
      toast.success(autoStart ? "OpenWA auto-start enabled" : "OpenWA auto-start disabled");
      queryClient.invalidateQueries({ queryKey: ["openwa-config"] });
      queryClient.invalidateQueries({ queryKey: ["openwa-server-status"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update setting");
    },
  });

  // Request Pairing Code Mutation
  const pairingCodeMutation = useMutation({
    mutationFn: async (phone: string) => {
      const res = await fetch(`${LOCAL_API_BASE}/wa/gateway/pairing-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone, channel: "sales" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to request pairing code");
      return data;
    },
    onSuccess: (data) => {
      setGeneratedPairingCode(data.pairingCode || "CODE_SENT");
      toast.success("Pairing code generated! Check your WhatsApp on mobile.");
      queryClient.invalidateQueries({ queryKey: ["openwa-server-status"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to generate pairing code");
    },
  });

  const isServerRunning = Boolean(serverStatus?.running);
  const sessionInfo = serverStatus?.session;
  const isConnected = Boolean(sessionInfo?.connected);
  const autoStart = Boolean(configData?.autoStart ?? serverStatus?.autoStart ?? true);

  return (
    <>
      {/* Universal Top Header Pill Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={`h-9 px-3 text-xs font-bold border transition-all flex items-center gap-1.5 shadow-sm ${
          isServerRunning && isConnected
            ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            : isServerRunning
            ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
            : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
        }`}
        onClick={() => setOpen(true)}
      >
        <MessageSquare
          className={`h-4 w-4 ${
            isServerRunning && isConnected
              ? "text-emerald-600"
              : isServerRunning
              ? "text-amber-500 animate-pulse"
              : "text-slate-500"
          }`}
        />
        <span className="hidden sm:inline">WhatsApp:</span>
        {isServerRunning && isConnected ? (
          <span className="flex items-center gap-1 text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            Ready
          </span>
        ) : isServerRunning ? (
          <span className="flex items-center gap-1 text-amber-700">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping"></span>
            Linking
          </span>
        ) : (
          <span className="flex items-center gap-1 text-slate-500">
            <span className="h-2 w-2 rounded-full bg-slate-400"></span>
            Stopped
          </span>
        )}
      </Button>

      {/* Control Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-between pr-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-slate-900">
                    OpenWA WhatsApp Gateway
                  </DialogTitle>
                  <DialogDescription className="text-xs text-gray-500">
                    Automated background PDF bills &amp; text dispatch
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
                <span className="text-xs font-semibold text-slate-600">Gateway Service (Port 2785):</span>
                {isServerRunning ? (
                  <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-[11px] gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Running {serverStatus?.pid ? `(PID: ${serverStatus.pid})` : ""}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-rose-100 text-rose-800 border-rose-300 font-bold text-[11px] gap-1">
                    <Power className="h-3 w-3 text-rose-500" /> Offline / Stopped
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-slate-200/80 pt-2">
                <span className="text-xs font-semibold text-slate-600">WhatsApp Session:</span>
                {isConnected ? (
                  <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-[11px] gap-1">
                    <Radio className="h-3 w-3 text-emerald-600" /> Connected {sessionInfo?.phone ? `(${sessionInfo.phone})` : ""}
                  </Badge>
                ) : isServerRunning ? (
                  <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 font-bold text-[11px] gap-1">
                    <AlertCircle className="h-3 w-3 text-amber-600" /> Scan QR / Pairing Code Needed
                  </Badge>
                ) : (
                  <span className="text-xs text-gray-400">Server not started</span>
                )}
              </div>

              {sessionInfo?.pushName && (
                <div className="flex items-center justify-between border-t border-slate-200/80 pt-2 text-xs">
                  <span className="text-slate-500">Account Name:</span>
                  <span className="font-semibold text-slate-800">{sessionInfo.pushName}</span>
                </div>
              )}
            </div>

            {/* Auto-Start on App Launch Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white shadow-xs">
              <div className="space-y-0.5">
                <Label htmlFor="openwa_autostart" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Auto-start on Application Launch
                </Label>
                <p className="text-[11px] text-gray-500">
                  PhoneZone start hote hi OpenWA server aur session automatically shuru ho jayega.
                </p>
              </div>
              <Switch
                id="openwa_autostart"
                checked={autoStart}
                disabled={autoStartMutation.isPending}
                onCheckedChange={(checked) => autoStartMutation.mutate(checked)}
              />
            </div>

            {/* Server Controls */}
            <div className="flex gap-2">
              {!isServerRunning ? (
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9"
                  onClick={() => startServerMutation.mutate()}
                  disabled={startServerMutation.isPending}
                >
                  {startServerMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Starting Server...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-1.5 fill-current" /> Start WhatsApp Gateway
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="flex-1 border-rose-300 text-rose-700 hover:bg-rose-50 font-semibold text-xs h-9"
                  onClick={() => stopServerMutation.mutate()}
                  disabled={stopServerMutation.isPending}
                >
                  {stopServerMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Stopping...
                    </>
                  ) : (
                    <>
                      <Square className="h-4 w-4 mr-1.5 fill-current text-rose-600" /> Stop Gateway Service
                    </>
                  )}
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3 text-xs"
                asChild
              >
                <a
                  href="http://127.0.0.1:2785/dashboard"
                  target="_blank"
                  rel="noreferrer"
                  title="Open Official OpenWA Web Dashboard"
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Dashboard
                </a>
              </Button>
            </div>

            {/* Quick Pairing Section if Not Connected */}
            {isServerRunning && !isConnected && (
              <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/60 space-y-2">
                <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-amber-700" /> Link WhatsApp via Phone Pairing Code
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter 10-digit Phone (e.g. 8418944572)"
                    value={pairingPhone}
                    onChange={(e) => setPairingPhone(e.target.value)}
                    className="h-8 text-xs bg-white"
                  />
                  <Button
                    size="sm"
                    className="h-8 bg-amber-600 hover:bg-amber-700 text-white text-xs shrink-0"
                    disabled={pairingCodeMutation.isPending || !pairingPhone.trim()}
                    onClick={() => pairingCodeMutation.mutate(pairingPhone.trim())}
                  >
                    {pairingCodeMutation.isPending ? "Generating..." : "Get Code"}
                  </Button>
                </div>
                {generatedPairingCode && (
                  <div className="p-2 bg-white rounded border border-amber-300 text-center">
                    <span className="text-[10px] text-gray-500 block">Enter this code in WhatsApp &gt; Linked Devices:</span>
                    <span className="text-lg font-mono font-bold tracking-widest text-slate-900">{generatedPairingCode}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="sm:justify-between border-t pt-3">
            <span className="text-[11px] text-gray-400">
              {isConnected ? "Direct auto-send active for bills & repairs" : "Offline fallback: wa.me click-to-chat"}
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

export default OpenWaUniversalControl;

