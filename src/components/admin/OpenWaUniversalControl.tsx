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
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  MessageSquare,
  RefreshCw,
  QrCode,
  Phone,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Zap,
  LogOut,
  Send,
  Copy,
} from "lucide-react";
import { LOCAL_API_BASE } from "@/lib/data";

interface BaileysStatus {
  connected: boolean;
  state: "disconnected" | "connecting" | "qr_ready" | "connected";
  qr: string | null;
  phone?: string | null;
  name?: string | null;
  user: {
    id: string;
    name: string;
  } | null;
}

export const OpenWaUniversalControl: React.FC<{ className?: string }> = ({ className = "" }) => {
  const [open, setOpen] = useState(false);
  const [pairingPhone, setPairingPhone] = useState("");
  const [generatedPairingCode, setGeneratedPairingCode] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const queryClient = useQueryClient();

  // Poll status from Baileys engine
  const { data: status, isFetching, refetch } = useQuery<BaileysStatus>({
    queryKey: ["baileys-status"],
    queryFn: async () => {
      const res = await fetch(`${LOCAL_API_BASE}/wa/baileys/status`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch WhatsApp status");
      return res.json();
    },
    refetchInterval: open ? 3000 : 10000,
  });

  const isConnected = Boolean(status?.connected);
  const connectedPhone = status?.user?.id?.split("@")[0] || status?.phone;
  const connectedName = status?.user?.name || status?.name;

  // Restart / Re-init mutation
  const initMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${LOCAL_API_BASE}/wa/baileys/init`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to restart engine");
      return data;
    },
    onSuccess: () => {
      toast.success("WhatsApp engine restarted. Generating QR code...");
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to restart engine");
    },
  });

  // Logout / Disconnect mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${LOCAL_API_BASE}/wa/baileys/logout`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to logout");
      return data;
    },
    onSuccess: () => {
      toast.info("WhatsApp disconnected. You can scan QR code to re-link.");
      setGeneratedPairingCode(null);
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to logout");
    },
  });

  // Request Pairing Code Mutation
  const pairingCodeMutation = useMutation({
    mutationFn: async (phone: string) => {
      const clean = phone.replace(/\D/g, "");
      const res = await fetch(`${LOCAL_API_BASE}/wa/baileys/pairing-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone: clean }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate pairing code");
      return data;
    },
    onSuccess: (data) => {
      setGeneratedPairingCode(data.code || "CODE_SENT");
      toast.success("Pairing code generated! Enter it in WhatsApp on your phone.");
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to generate pairing code");
    },
  });

  const handleSendTest = async () => {
    const clean = testPhone.replace(/\D/g, "");
    if (!clean) {
      toast.error("Enter a valid mobile number for test message");
      return;
    }
    setSendingTest(true);
    try {
      const res = await fetch(`${LOCAL_API_BASE}/wa/baileys/send-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          phone: clean,
          message: "🎉 Hello from PhoneZone ERP! Your Native WhatsApp gateway is active and working perfectly.",
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Test dispatch failed");
      toast.success(`Test message sent successfully to +${clean}!`);
      setTestPhone("");
    } catch (err: any) {
      toast.error(err.message || "Failed to dispatch test message");
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <>
      {/* Universal Top Header Pill Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={
          className ||
          `h-8 px-2.5 text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-sm ${
            isConnected
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
              : status?.state === "connecting"
              ? "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
              : "border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-800"
          }`
        }
        onClick={() => setOpen(true)}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            isConnected
              ? "bg-emerald-500 animate-pulse"
              : status?.state === "connecting"
              ? "bg-amber-500 animate-ping"
              : "bg-slate-400"
          }`}
        />
        <MessageSquare className="h-3.5 w-3.5" />
        <span>
          {isConnected
            ? `WA: +${connectedPhone?.slice(-4) || "Live"}`
            : status?.state === "connecting"
            ? "WA: Connecting..."
            : "WA: Offline"}
        </span>
      </Button>

      {/* WhatsApp Control Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Zap className="h-5 w-5 text-emerald-600" /> WhatsApp Gateway Control (Baileys Engine)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Direct WebSocket WhatsApp connection. 100% browser-free, instant startup, works on Cloud &amp; Desktop.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Live Status Card */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Gateway Status:</span>
                {isConnected ? (
                  <Badge className="bg-emerald-600 text-white font-semibold text-xs flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Connected &amp; Ready
                  </Badge>
                ) : status?.state === "qr_ready" ? (
                  <Badge className="bg-blue-600 text-white font-semibold text-xs flex items-center gap-1">
                    <QrCode className="h-3 w-3" /> QR Ready to Scan
                  </Badge>
                ) : status?.state === "connecting" ? (
                  <Badge className="bg-amber-500 text-white font-semibold text-xs flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Connecting...
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-slate-600 border-slate-300 text-xs">
                    Disconnected
                  </Badge>
                )}
              </div>

              {isConnected && (
                <div className="border-t border-slate-200/80 pt-2 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Connected Phone:</span>
                    <span className="font-mono font-bold text-emerald-700">+{connectedPhone}</span>
                  </div>
                  {connectedName && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">WhatsApp Name:</span>
                      <span className="font-semibold text-slate-800">{connectedName}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* If NOT connected: Show QR or Pairing Code options */}
            {!isConnected && (
              <div className="border rounded-xl p-4 bg-white space-y-4">
                {status?.qr && (
                  <div className="flex flex-col items-center justify-center p-3 border rounded-lg bg-slate-50 space-y-2">
                    <img
                      src={status.qr}
                      alt="WhatsApp QR Code"
                      className="w-48 h-48 rounded border border-emerald-300 p-1 bg-white shadow-xs"
                    />
                    <p className="text-[11px] text-gray-500 text-center">
                      Open WhatsApp &gt; Linked Devices &gt; Link a Device &gt; Scan this QR.
                    </p>
                  </div>
                )}

                {/* Pairing Code by Phone Number */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-emerald-600" /> Or Link with Phone Number (Pairing Code)
                  </label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="10-digit mobile number"
                      value={pairingPhone}
                      onChange={(e) => setPairingPhone(e.target.value)}
                      maxLength={10}
                      className="h-8 text-xs bg-white"
                    />
                    <Button
                      size="sm"
                      className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs shrink-0"
                      disabled={pairingCodeMutation.isPending || !pairingPhone.trim()}
                      onClick={() => pairingCodeMutation.mutate(pairingPhone.trim())}
                    >
                      {pairingCodeMutation.isPending ? "Generating..." : "Get Code"}
                    </Button>
                  </div>
                </div>

                {generatedPairingCode && (
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-300 text-center space-y-1.5">
                    <span className="text-[11px] text-emerald-900 font-medium block">
                      Enter this 8-digit code in WhatsApp &gt; Linked Devices:
                    </span>
                    <div className="flex items-center justify-center gap-2">
                      <code className="text-2xl font-mono font-bold tracking-widest text-emerald-950 bg-white px-4 py-1 rounded border border-emerald-400 select-all">
                        {generatedPairingCode}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-emerald-400 text-emerald-800 hover:bg-emerald-100"
                        onClick={() => {
                          navigator.clipboard.writeText(generatedPairingCode);
                          toast.success("Pairing code copied!");
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick Test Message Dispatcher */}
            {isConnected && (
              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2">
                <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5 text-emerald-600" /> Send Quick Test Message
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Recipient 10-digit mobile number"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    maxLength={10}
                    className="h-8 text-xs bg-white border-emerald-300"
                  />
                  <Button
                    size="sm"
                    className="h-8 bg-emerald-700 hover:bg-emerald-800 text-white text-xs shrink-0"
                    disabled={sendingTest || !testPhone.trim()}
                    onClick={handleSendTest}
                  >
                    {sendingTest ? <Loader2 className="h-3 w-3 animate-spin" /> : "Send"}
                  </Button>
                </div>
              </div>
            )}

            {/* Controls / Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs h-8 border-slate-300"
                onClick={() => initMutation.mutate()}
                disabled={initMutation.isPending}
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${initMutation.isPending ? "animate-spin" : ""}`} />
                Restart Engine
              </Button>

              {isConnected && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs h-8 border-rose-300 text-rose-700 hover:bg-rose-50"
                  onClick={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                >
                  <LogOut className="h-3.5 w-3.5 mr-1" /> Disconnect Number
                </Button>
              )}
            </div>
          </div>

          <DialogFooter className="sm:justify-between border-t pt-3">
            <span className="text-[11px] text-gray-500">
              {isConnected ? "✅ Automated billing & PDF dispatch active" : "Offline: Click-to-chat fallback active"}
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
