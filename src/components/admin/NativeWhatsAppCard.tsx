import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  QrCode,
  Smartphone,
  CheckCircle2,
  RefreshCw,
  LogOut,
  Send,
  Zap,
  ShieldCheck,
  AlertCircle,
  Copy,
} from "lucide-react";

interface BaileysStatus {
  connected: boolean;
  state: "disconnected" | "connecting" | "qr_ready" | "connected";
  qr: string | null;
  user: {
    id: string;
    name: string;
  } | null;
}

export const NativeWhatsAppCard: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"qr" | "code">("qr");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [gettingCode, setGettingCode] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testMsg, setTestMsg] = useState("Hello from PhoneZone ERP! WhatsApp is live.");
  const [sendingTest, setSendingTest] = useState(false);

  // Poll status while QR is showing or connecting
  const { data: status, refetch, isFetching } = useQuery<BaileysStatus>({
    queryKey: ["baileys-status"],
    queryFn: async () => {
      const res = await fetch("/api/wa/baileys/status", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load WhatsApp status");
      return res.json();
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.connected ? 15000 : 3000; // Poll faster when scanning QR
    },
  });

  const initMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/wa/baileys/init", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed to initialize WhatsApp");
      return res.json();
    },
    onSuccess: () => {
      toast.success("WhatsApp engine restarted. Generating QR code...");
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to start WhatsApp");
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/wa/baileys/logout", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed to logout");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Disconnected from WhatsApp. New QR code ready.");
      setPairingCode(null);
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to logout");
    },
  });

  const handleRequestPairingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = phoneNumber.replace(/\D/g, "");
    if (clean.length < 10) {
      toast.error("Please enter a valid 10-digit mobile number");
      return;
    }
    setGettingCode(true);
    setPairingCode(null);
    try {
      const res = await fetch("/api/wa/baileys/pairing-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone: clean }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to get pairing code");
      setPairingCode(data.code);
      toast.success("Pairing code generated! Enter it on your phone.");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate pairing code");
    } finally {
      setGettingCode(false);
    }
  };

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.replace(/\D/g, "")) {
      toast.error("Please enter recipient mobile number");
      return;
    }
    setSendingTest(true);
    try {
      const res = await fetch("/api/wa/baileys/send-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone: testPhone, message: testMsg }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delivery failed");
      toast.success(`WhatsApp message sent successfully to ${testPhone}!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    } finally {
      setSendingTest(false);
    }
  };

  const isConnected = status?.connected;

  return (
    <Card className="border-emerald-500/50 shadow-md overflow-hidden bg-gradient-to-b from-card to-card/95">
      <CardHeader className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-emerald-900/90 text-white p-5 border-b border-emerald-800/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-emerald-400 fill-emerald-400" />
              <CardTitle className="text-lg font-bold text-white tracking-tight">
                Native WhatsApp Engine (In-Process Baileys)
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-emerald-200/80">
              Zero-configuration WhatsApp automation. Sends GST/Non-GST invoices, PDF bills, and receipts directly from Render Cloud 24/7.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isConnected ? (
              <Badge className="bg-emerald-500 text-slate-950 font-bold px-3 py-1 gap-1.5 shadow-sm text-xs">
                <span className="h-2 w-2 rounded-full bg-slate-950 animate-pulse" />
                WhatsApp Live &amp; Connected
              </Badge>
            ) : status?.state === "qr_ready" ? (
              <Badge variant="outline" className="border-amber-400 text-amber-300 bg-amber-950/60 font-semibold text-xs px-2.5 py-1">
                Scan QR Code to Link
              </Badge>
            ) : (
              <Badge variant="outline" className="border-slate-500 text-slate-300 font-semibold text-xs px-2.5 py-1">
                {status?.state === "connecting" ? "Connecting..." : "Disconnected"}
              </Badge>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-8 text-xs bg-slate-800/80 hover:bg-slate-700 border-slate-600 text-white gap-1"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-6">
        {isConnected ? (
          /* ================= CONNECTED VIEW ================= */
          <div className="space-y-6">
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <div>
                  <h4 className="font-bold text-base text-emerald-400 flex items-center gap-2">
                    {status.user?.name || "PhoneZone WhatsApp"}
                  </h4>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    Phone: +{status.user?.id}
                  </p>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400/80 mt-1 font-medium">
                    ✓ Automated PDF invoices &amp; message dispatch active
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                  className="h-9 border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/40 text-xs gap-1.5"
                >
                  <LogOut className="h-4 w-4" />
                  Disconnect WhatsApp
                </Button>
              </div>
            </div>

            {/* Quick Test Message Dispatch */}
            <div className="rounded-xl border p-4 bg-muted/20 space-y-3">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-emerald-500" />
                <h5 className="font-semibold text-sm">Send Quick Test WhatsApp Message</h5>
              </div>
              <form onSubmit={handleSendTestMessage} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="test-phone" className="text-xs font-medium">Recipient Mobile (10-Digit)</Label>
                  <Input
                    id="test-phone"
                    placeholder="9876543210"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    className="mt-1 h-9 text-xs"
                    required
                  />
                </div>
                <div className="sm:col-span-2 flex gap-2 items-end">
                  <div className="flex-1">
                    <Label htmlFor="test-msg" className="text-xs font-medium">Message</Label>
                    <Input
                      id="test-msg"
                      value={testMsg}
                      onChange={(e) => setTestMsg(e.target.value)}
                      className="mt-1 h-9 text-xs"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={sendingTest}
                    className="h-9 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1.5 font-bold shrink-0"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {sendingTest ? "Sending..." : "Send Test"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          /* ================= UNCONNECTED VIEW (QR / PAIRING CODE) ================= */
          <div className="space-y-6">
            <div className="flex items-center justify-center gap-2 border-b pb-3">
              <Button
                size="sm"
                variant={activeTab === "qr" ? "default" : "outline"}
                onClick={() => setActiveTab("qr")}
                className={`text-xs gap-1.5 h-8 ${activeTab === "qr" ? "bg-emerald-600 hover:bg-emerald-500 text-white" : ""}`}
              >
                <QrCode className="h-4 w-4" /> Scan QR Code (अनुशंसित)
              </Button>
              <Button
                size="sm"
                variant={activeTab === "code" ? "default" : "outline"}
                onClick={() => setActiveTab("code")}
                className={`text-xs gap-1.5 h-8 ${activeTab === "code" ? "bg-emerald-600 hover:bg-emerald-500 text-white" : ""}`}
              >
                <Smartphone className="h-4 w-4" /> Link with Phone Number (पेयरिंग कोड)
              </Button>
            </div>

            {activeTab === "qr" ? (
              /* QR CODE TAB */
              <div className="flex flex-col items-center justify-center text-center space-y-4 py-2">
                {status?.qr ? (
                  <div className="p-3 bg-white rounded-2xl border-2 border-emerald-500/40 shadow-xl inline-block">
                    <img
                      src={status.qr}
                      alt="WhatsApp QR Code"
                      className="w-56 h-56 sm:w-64 sm:h-64 object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-2xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center text-muted-foreground gap-3">
                    <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
                    <p className="text-xs font-medium">Generating WhatsApp QR Code...</p>
                  </div>
                )}

                <div className="max-w-md space-y-1.5 text-xs text-muted-foreground">
                  <p className="font-bold text-foreground text-sm">
                    अपने मोबाइल WhatsApp से QR Code स्कैन करें:
                  </p>
                  <ol className="list-decimal list-inside text-left space-y-1 bg-muted/30 p-3 rounded-lg border">
                    <li>अपने फोन में <strong>WhatsApp</strong> खोलें।</li>
                    <li>ऊपर <strong>3 डॉट्स</strong> (⋮) दबाकर <strong>Linked Devices</strong> पर जाएँ।</li>
                    <li><strong>Link a Device</strong> पर क्लिक करके ऊपर वाले QR Code को स्कैन करें।</li>
                  </ol>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => initMutation.mutate()}
                  disabled={initMutation.isPending}
                  className="h-8 text-xs gap-1.5 text-emerald-600 dark:text-emerald-400 border-emerald-300"
                >
                  <RefreshCw className={`h-3 w-3 ${initMutation.isPending ? "animate-spin" : ""}`} />
                  QR कोड रीलोड करें
                </Button>
              </div>
            ) : (
              /* PAIRING CODE TAB */
              <div className="max-w-md mx-auto space-y-4 py-2">
                <div className="text-center space-y-1">
                  <h4 className="font-bold text-sm">फ़ोन नंबर से लिंक करें (Pairing Code)</h4>
                  <p className="text-xs text-muted-foreground">
                    अगर कैमरा काम नहीं कर रहा, तो अपना 10 अंकों का मोबाइल नंबर डालें और 8 अंकों का कोड अपने WhatsApp में दर्ज करें।
                  </p>
                </div>

                <form onSubmit={handleRequestPairingCode} className="space-y-3">
                  <div>
                    <Label htmlFor="pairing-phone" className="text-xs font-medium">आपका WhatsApp मोबाइल नंबर</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="pairing-phone"
                        type="tel"
                        placeholder="e.g. 9876543210"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        required
                        className="h-9 text-xs"
                      />
                      <Button
                        type="submit"
                        disabled={gettingCode}
                        className="h-9 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shrink-0"
                      >
                        {gettingCode ? "Generating..." : "Get Code"}
                      </Button>
                    </div>
                  </div>
                </form>

                {pairingCode && (
                  <div className="p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-center space-y-2">
                    <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                      यह 8 अंकों का कोड अपने WhatsApp में दर्ज करें:
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <code className="text-2xl font-mono font-black text-emerald-600 dark:text-emerald-400 tracking-widest bg-white dark:bg-black/50 px-4 py-1.5 rounded-lg border border-emerald-300 select-all">
                        {pairingCode}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(pairingCode);
                          toast.success("Code copied!");
                        }}
                        className="h-9 w-9 p-0"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      WhatsApp ➔ Linked Devices ➔ Link with phone number instead ➔ Enter Code
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Benefits Footnote */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 flex items-start gap-2.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
          <p>
            <strong>100% Noob-Friendly:</strong> किसी दूसरे सर्वर या Chrome की ज़रूरत नहीं है। यह सीधे आपके Render क्लाउड में 25MB RAM में चलता है। एक बार लिंक होने के बाद दुकान बंद होने पर भी WhatsApp बिल व PDF जाते रहेंगे।
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
