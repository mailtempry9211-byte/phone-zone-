import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Send, Key, FileText, CheckCircle2, XCircle, Clock, QrCode, Smartphone, Wrench, RefreshCw, Radio, Play, Square, Copy, Check, HelpCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function MarketingTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [campaignName, setCampaignName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [dryRun, setDryRun] = useState(false);

  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateContent, setNewTemplateContent] = useState("");
  const [tokenDesc, setTokenDesc] = useState("");
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [optOutPhone, setOptOutPhone] = useState("");
  // OpenWA Gateway Dual Session State
  const [openWaTab, setOpenWaTab] = useState<"sales" | "repairs">("sales");
  const [gatewayUrl, setGatewayUrl] = useState("http://127.0.0.1:2785");
  const [apiKey, setApiKey] = useState("");
  const [unifiedMode, setUnifiedMode] = useState(false);
  const [testingPhone, setTestingPhone] = useState("");
  const [testMessage, setTestMessage] = useState("Hello from PhoneZone WhatsApp Gateway!");

  // Server management & Pairing Code
  const [linkMode, setLinkMode] = useState<"qr" | "pairing_code">("qr");
  const [pairingPhone, setPairingPhone] = useState("");
  const [pairingCodeResult, setPairingCodeResult] = useState<{ code: string; status: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const { data: serverStatus, refetch: refetchServerStatus } = useQuery({
    queryKey: ["openwa-server-status"],
    queryFn: async () => {
      const res = await fetch("/api/wa/gateway/server-status");
      return res.ok ? res.json() : { running: false, port: 2785 };
    },
    refetchInterval: 5000,
  });

  const { data: adminSettings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      return res.ok ? res.json() : null;
    },
  });

  const { data: gatewayConfig } = useQuery({
    queryKey: ["openwa-config"],
    queryFn: async () => {
      const res = await fetch("/api/wa/gateway/config");
      if (res.ok) {
        const d = await res.json();
        setGatewayUrl(d.serverUrl || "http://127.0.0.1:2785");
        setApiKey(d.apiKey || "");
        setUnifiedMode(!!d.unifiedMode);
        return d;
      }
      return null;
    },
  });

  const { data: salesSession, refetch: refetchSales } = useQuery({
    queryKey: ["openwa-session-sales"],
    queryFn: async () => {
      const res = await fetch("/api/wa/gateway/session/sales");
      return res.ok ? res.json() : null;
    },
    refetchInterval: 8000,
  });

  const { data: repairSession, refetch: refetchRepair } = useQuery({
    queryKey: ["openwa-session-repairs"],
    queryFn: async () => {
      const res = await fetch("/api/wa/gateway/session/repairs");
      return res.ok ? res.json() : null;
    },
    refetchInterval: 8000,
  });

  const startServerMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/wa/gateway/start-server", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start OpenWA server");
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "OpenWA Server Started", description: data.message || "Gateway server is now running on port 2785." });
      refetchServerStatus();
      refetchSales();
      refetchRepair();
    },
    onError: (err: any) => {
      toast({ title: "Start Failed", description: err.message, variant: "destructive" });
    },
  });

  const stopServerMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/wa/gateway/stop-server", { method: "POST" });
      return res.ok ? res.json() : null;
    },
    onSuccess: () => {
      toast({ title: "OpenWA Server Stopped", description: "Gateway server stopped." });
      refetchServerStatus();
      refetchSales();
      refetchRepair();
    },
    onError: (err: any) => {
      toast({ title: "Stop Failed", description: err.message, variant: "destructive" });
    },
  });

  const requestPairingCodeMutation = useMutation({
    mutationFn: async () => {
      if (!pairingPhone.trim()) throw new Error("Please enter your 10-digit WhatsApp phone number");
      const res = await fetch("/api/wa/gateway/pairing-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: openWaTab, phone: pairingPhone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate pairing code");
      return data;
    },
    onSuccess: (data) => {
      setPairingCodeResult({ code: data.pairingCode, status: data.status });
      toast({
        title: "Pairing Code Generated!",
        description: `Code: ${data.pairingCode}. Enter this in WhatsApp on your phone.`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Pairing Code Error", description: err.message, variant: "destructive" });
    },
  });

  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/wa/gateway/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverUrl: gatewayUrl, apiKey, unifiedMode }),
      });
      if (!res.ok) throw new Error("Failed to save OpenWA config");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Gateway Config Saved", description: "OpenWA gateway settings updated." });
      queryClient.invalidateQueries({ queryKey: ["openwa-config"] });
    },
  });

  const sendTestMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/wa/gateway/send-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: testingPhone, message: testMessage, channel: openWaTab }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Failed to send message via OpenWA");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "WhatsApp Sent!", description: `Test message dispatched via ${openWaTab} session.` });
    },
    onError: (err: any) => {
      toast({ title: "Send Failed", description: err.message, variant: "destructive" });
    },
  });


  // Fetch status
  const { data: queueStatus } = useQuery({
    queryKey: ["wa-queue-status"],
    queryFn: async () => {
      const res = await fetch("/api/wa/queue/status");
      return res.ok ? res.json() : { pending: 0, sent: 0, failed: 0 };
    },
    refetchInterval: 10000,
  });

  // Fetch templates
  const { data: templates = [] } = useQuery({
    queryKey: ["wa-templates"],
    queryFn: async () => {
      const res = await fetch("/api/wa/templates");
      return res.ok ? res.json() : [];
    },
  });

  // Fetch campaigns
  const { data: campaigns = [] } = useQuery({
    queryKey: ["wa-campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/wa/campaigns");
      return res.ok ? res.json() : [];
    },
  });

  // Fetch tokens
  const { data: tokens = [] } = useQuery({
    queryKey: ["wa-tokens"],
    queryFn: async () => {
      const res = await fetch("/api/wa/tokens");
      return res.ok ? res.json() : [];
    },
  });

  // Create Campaign Mutation
  const createCampaignMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/wa/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaignName,
          template_id: selectedTemplateId,
          dry_run: dryRun,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create campaign");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Campaign Created",
        description: `Queued ${data.total_count} opted-in message(s).`,
      });
      setCampaignName("");
      queryClient.invalidateQueries({ queryKey: ["wa-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["wa-queue-status"] });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Create Template Mutation
  const createTemplateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/wa/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTemplateName,
          content: newTemplateContent,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create template");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Template Saved", description: "Template is ready to use in campaigns." });
      setNewTemplateName("");
      setNewTemplateContent("");
      queryClient.invalidateQueries({ queryKey: ["wa-templates"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Create Token Mutation
  const createTokenMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/wa/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: tokenDesc || "Chrome Extension" }),
      });
      if (!res.ok) throw new Error("Failed to create token");
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedToken(data.token);
      setTokenDesc("");
      queryClient.invalidateQueries({ queryKey: ["wa-tokens"] });
    },
  });

  // Revoke Token Mutation
  const revokeTokenMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/wa/tokens/${id}/revoke`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to revoke token");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Token Revoked", description: "The extension token can no longer access the queue." });
      queryClient.invalidateQueries({ queryKey: ["wa-tokens"] });
    },
  });

  // Opt-out Mutation
  const optOutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/wa/opt-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: optOutPhone }),
      });
      if (!res.ok) throw new Error("Failed to opt out phone");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Opt-Out Recorded", description: `Phone ${optOutPhone} will receive no marketing messages.` });
      setOptOutPhone("");
    },
  });

  return (
    <div className="space-y-6">
      {adminSettings?.whatsappChannel === "click_to_chat" && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <AlertTitle className="font-semibold text-amber-950">
            Recommended for Marketing: Use Chrome Extension or OpenWA Gateway
          </AlertTitle>
          <AlertDescription className="text-xs text-amber-800 mt-1">
            PhoneZone is currently in <strong>Click-to-Chat (wa.me)</strong> mode in Settings. Because Click-to-Chat opens each chat one by one, for bulk promotional marketing we strongly recommend using the <strong>PhoneZone Chrome Extension</strong> or <strong>OpenWA Gateway</strong> so you don't have to manually confirm each customer message.
          </AlertDescription>
        </Alert>
      )}
      
      {/* OpenWA Direct WhatsApp Gateway Card */}
      <Card className="border-green-300 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-emerald-50 via-teal-50 to-white pb-3 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base text-emerald-950 font-bold">
                <Radio className="h-5 w-5 text-emerald-600" /> OpenWA Self-Hosted WhatsApp API Gateway
              </CardTitle>
              <CardDescription className="text-xs">
                Direct WhatsApp integration via OpenWA REST API. Scan QR or link via Phone Number to dispatch Invoices & Updates automatically.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {serverStatus?.running ? (
                <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 font-semibold flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Gateway Running (Port 2785)
                </Badge>
              ) : (
                <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 font-semibold flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500" /> Gateway Offline
                </Badge>
              )}
              {serverStatus?.running ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-50"
                  disabled={stopServerMutation.isPending}
                  onClick={() => stopServerMutation.mutate()}
                >
                  <Square className="h-3 w-3 mr-1 fill-red-600 text-red-600" /> Stop Server
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={startServerMutation.isPending}
                  onClick={() => startServerMutation.mutate()}
                >
                  <Play className="h-3 w-3 mr-1 fill-white text-white" />
                  {startServerMutation.isPending ? "Starting Server..." : "Start Gateway Server"}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-emerald-800"
                onClick={() => setShowGuide(!showGuide)}
              >
                <HelpCircle className="h-3.5 w-3.5 mr-1" />
                {showGuide ? "Hide Guide" : "WhatsApp Guide"}
                {showGuide ? <ChevronUp className="h-3.5 w-3.5 ml-1" /> : <ChevronDown className="h-3.5 w-3.5 ml-1" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-5">
          {/* Detailed Guide Accordion */}
          {showGuide && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs space-y-3">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                📖 WhatsApp Features & Setup Complete Guide (व्हाट्सएप फीचर्स उपयोग करने की पूरी गाइड)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div className="border rounded-md p-3 bg-white space-y-1">
                  <div className="font-bold text-emerald-700">1. Click-to-Chat (wa.me URL)</div>
                  <p className="text-gray-600">
                    बिल्कुल ज़ीरो सेटअप। मोबाइल, टैबलेट, APK या ब्राउज़र में तुरंत चलता है। इनवॉइस शेयर बटन दबाते ही कस्टमर का व्हाट्सएप चैट खुल जाएगा जहां से आप PDF शेयर कर सकते हैं।
                  </p>
                </div>
                <div className="border rounded-md p-3 bg-white space-y-1">
                  <div className="font-bold text-blue-700">2. OpenWA Gateway (पूर्ण ऑटोमेशन)</div>
                  <p className="text-gray-600">
                    ऊपर <strong>&quot;Start Gateway Server&quot;</strong> दबाएं। QR कोड स्कैन करें या <strong>&quot;Pairing Code&quot;</strong> से अपने फोन नंबर से लिंक करें। इनवॉइस और शपथ पत्र बैकग्राउंड में अपने-आप PDF बनकर कस्टमर को चले जाएंगे!
                  </p>
                </div>
                <div className="border rounded-md p-3 bg-white space-y-1">
                  <div className="font-bold text-purple-700">3. Chrome Extension (PC मार्केटिंग)</div>
                  <p className="text-gray-600">
                    अगर आप मेन कंप्यूटर से बल्क मार्केटिंग या ऑफर्स भेजना चाहते हैं, तो Chrome Extension का उपयोग करें। यह WhatsApp Web में सुरक्षित अंतराल (25-70 सेकंड) के साथ मैसेज कतार में भेजता है।
                  </p>
                </div>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded text-emerald-900 flex items-center gap-2">
                <span className="font-bold">📱 APK / सेम फोन यूज़र्स के लिए:</span>
                अगर आप उसी फोन में PhoneZone चला रहे हैं जिसमें व्हाट्सएप है, तो <strong>&quot;Link with Phone Number (Pairing Code)&quot;</strong> टैब चुनें और 8-अंकों का कोड डालकर बिना कैमरा के सीधे लिंक करें!
              </div>
            </div>
          )}

          {/* Channel Selector: Sales vs Repairs */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-4">
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={openWaTab === "sales" ? "default" : "outline"}
                className={openWaTab === "sales" ? "bg-emerald-700 hover:bg-emerald-800" : ""}
                onClick={() => setOpenWaTab("sales")}
              >
                <Smartphone className="h-4 w-4 mr-1.5" /> Sales WhatsApp Session
              </Button>
              <Button
                type="button"
                size="sm"
                variant={openWaTab === "repairs" ? "default" : "outline"}
                className={openWaTab === "repairs" ? "bg-purple-700 hover:bg-purple-800" : ""}
                onClick={() => setOpenWaTab("repairs")}
              >
                <Wrench className="h-4 w-4 mr-1.5" /> Repair Dept WhatsApp Session
              </Button>
            </div>

            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={unifiedMode}
                onChange={(e) => {
                  setUnifiedMode(e.target.checked);
                  saveConfigMutation.mutate();
                }}
                className="rounded text-emerald-600"
              />
              <span>Use single WhatsApp number for both Sales & Repairs</span>
            </label>
          </div>

          {/* Active Session Status & QR / Pairing Code */}
          {(() => {
            const activeSession = openWaTab === "sales" ? salesSession : repairSession;
            const isConnected = activeSession?.connected;
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Active Channel:</span>
                    <Badge className={openWaTab === "sales" ? "bg-emerald-600" : "bg-purple-600"}>
                      {openWaTab === "sales" ? "Sales & Purchase Invoices" : "Repair Jobs & Service Status"}
                    </Badge>
                  </div>

                  <div className="p-3 bg-slate-50 border rounded-lg space-y-1.5 text-xs text-slate-700">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Connection Status:</span>
                      <span className="font-semibold flex items-center gap-1">
                        {isConnected ? (
                          <span className="text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Connected & Ready
                          </span>
                        ) : (
                          <span className="text-amber-600 flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" /> Waiting to Link WhatsApp
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Gateway URL:</span>
                      <span className="font-mono">{gatewayUrl}</span>
                    </div>
                    <div className="flex items-center justify-between bg-blue-50 border border-blue-200 p-2 rounded text-xs text-blue-800 mt-2">
                      <span className="truncate mr-2"><strong>Dashboard API Key:</strong> <code className="bg-white px-1.5 py-0.5 rounded border font-mono text-[11px]">owa_k1_8601ace41a7...</code></span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 text-[11px] text-blue-700 bg-white shrink-0"
                        onClick={() => {
                          navigator.clipboard.writeText("owa_k1_8601ace41a71a68b753a9c04e887ada2c47ef79e7f07fcf99618af4ac6bd2a57");
                          toast({ title: "Copied!", description: "API Key copied to clipboard." });
                        }}
                      >
                        Copy Key
                      </Button>
                    </div>
                  </div>

                  {/* Test Dispatch Form */}
                  <div className="border p-3 rounded-lg space-y-2 bg-white">
                    <span className="text-xs font-semibold block text-gray-700">Quick Test Message Dispatch</span>
                    <div className="flex gap-2">
                      <Input
                        placeholder="10-digit mobile"
                        value={testingPhone}
                        onChange={(e) => setTestingPhone(e.target.value)}
                        className="text-xs h-8"
                      />
                      <Button
                        size="sm"
                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                        disabled={!testingPhone || sendTestMutation.isPending}
                        onClick={() => sendTestMutation.mutate()}
                      >
                        {sendTestMutation.isPending ? "Sending..." : "Send Test"}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Right Panel: QR Code OR Pairing Code Linking */}
                <div className="border rounded-xl bg-slate-50 p-4 space-y-3">
                  {/* Mode Selector */}
                  <div className="flex border-b pb-2 gap-2 justify-center">
                    <Button
                      type="button"
                      size="sm"
                      variant={linkMode === "qr" ? "default" : "ghost"}
                      className={`h-7 text-xs ${linkMode === "qr" ? "bg-emerald-700 hover:bg-emerald-800" : ""}`}
                      onClick={() => setLinkMode("qr")}
                    >
                      <QrCode className="h-3.5 w-3.5 mr-1" /> Scan QR Code
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={linkMode === "pairing_code" ? "default" : "ghost"}
                      className={`h-7 text-xs ${linkMode === "pairing_code" ? "bg-emerald-700 hover:bg-emerald-800" : ""}`}
                      onClick={() => setLinkMode("pairing_code")}
                    >
                      <Smartphone className="h-3.5 w-3.5 mr-1" /> Link with Phone Number (Pairing Code)
                    </Button>
                  </div>

                  {isConnected ? (
                    <div className="text-center space-y-2 py-6">
                      <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="h-7 w-7" />
                      </div>
                      <h4 className="font-bold text-sm text-slate-800">WhatsApp Number Linked & Active</h4>
                      <p className="text-xs text-gray-500 max-w-xs mx-auto">
                        This session is active. Invoices, sapath patra, and repair job updates will be dispatched automatically.
                      </p>
                    </div>
                  ) : linkMode === "qr" ? (
                    /* QR Code Mode */
                    <div className="flex flex-col items-center justify-center text-center min-h-[200px] py-2">
                      {activeSession?.qrCode ? (
                        <div className="space-y-2">
                          <img
                            src={activeSession.qrCode}
                            alt="WhatsApp QR Code"
                            className="w-44 h-44 border p-1 rounded-lg bg-white shadow-sm mx-auto"
                          />
                          <p className="text-xs text-gray-600 font-medium">
                            Scan from WhatsApp &rarr; Linked Devices &rarr; Link a Device
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 mt-1"
                            onClick={() => (openWaTab === "sales" ? refetchSales() : refetchRepair())}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" /> Refresh QR
                          </Button>
                        </div>
                      ) : (
                        <div className="text-center space-y-2 text-gray-500 text-xs py-4">
                          <QrCode className="h-10 w-10 text-gray-400 mx-auto" />
                          <p>
                            {serverStatus?.running
                              ? "Waiting for OpenWA session QR code..."
                              : "Gateway server is offline. Click 'Start Gateway Server' above."}
                          </p>
                          {serverStatus?.running ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7"
                              onClick={() => (openWaTab === "sales" ? refetchSales() : refetchRepair())}
                            >
                              <RefreshCw className="h-3 w-3 mr-1" /> Refresh QR
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className="text-xs h-7 bg-emerald-600 hover:bg-emerald-700"
                              disabled={startServerMutation.isPending}
                              onClick={() => startServerMutation.mutate()}
                            >
                              <Play className="h-3 w-3 mr-1" /> Start Gateway Server
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Pairing Code Mode (No Camera Needed) */
                    <div className="space-y-3 py-2 text-left">
                      <div className="text-xs text-gray-600">
                        Enter your 10-digit WhatsApp phone number to receive an 8-character code for linking without camera:
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="e.g. 9044136105"
                          value={pairingPhone}
                          onChange={(e) => setPairingPhone(e.target.value)}
                          className="text-xs h-8"
                        />
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 shrink-0"
                          disabled={!pairingPhone || requestPairingCodeMutation.isPending}
                          onClick={() => requestPairingCodeMutation.mutate()}
                        >
                          {requestPairingCodeMutation.isPending ? "Generating..." : "Get Pairing Code"}
                        </Button>
                      </div>

                      {pairingCodeResult?.code && (
                        <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-3 text-center space-y-2">
                          <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
                            Your 8-Character Pairing Code:
                          </span>
                          <div className="flex items-center justify-center gap-2">
                            <span className="font-mono text-2xl font-black text-emerald-950 tracking-widest bg-white px-4 py-1 rounded border border-emerald-200 shadow-inner">
                              {pairingCodeResult.code}
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-9 px-3 text-xs border-emerald-300 text-emerald-800 bg-white hover:bg-emerald-100"
                              onClick={() => {
                                navigator.clipboard.writeText(pairingCodeResult.code);
                                setCopiedCode(true);
                                setTimeout(() => setCopiedCode(false), 2000);
                                toast({ title: "Copied!", description: "Pairing code copied to clipboard." });
                              }}
                            >
                              {copiedCode ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                            </Button>
                          </div>
                          <div className="text-[11px] text-gray-600 text-left bg-white p-2.5 rounded border border-emerald-100 space-y-1">
                            <p className="font-semibold text-emerald-900">अपने व्हाट्सएप में कोड कैसे दर्ज करें:</p>
                            <p>1. फोन में WhatsApp &rarr; <strong>Settings</strong> (या Three Dots) &rarr; <strong>Linked Devices</strong> खोलें</p>
                            <p>2. <strong>&quot;Link a Device&quot;</strong> पर टैप करें &rarr; नीचे <strong>&quot;Link with phone number instead&quot;</strong> चुनें</p>
                            <p>3. यह 8-अंकों का कोड टाइप करें। आपका डिवाइस तुरंत लिंक हो जाएगा!</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Risk Warning Alert */}
      <Alert className="border-amber-400 bg-amber-50 text-amber-900">
        <AlertTriangle className="h-5 w-5 text-amber-600" />
        <AlertTitle className="font-semibold">WhatsApp Automation & Ban Safety Warning</AlertTitle>
        <AlertDescription className="text-sm">
          Automating WhatsApp Web carries the risk of phone number suspension by Meta.
          PhoneZone strictly dispatches only to opted-in customers with safe 25–70 second gaps and a daily cap (50 msgs/day).
          For large volume commercial messaging, consider Meta&apos;s official WhatsApp Business Cloud API.
        </AlertDescription>
      </Alert>

      {/* Queue Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pending Queue</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueStatus?.pending || 0}</div>
            <p className="text-xs text-muted-foreground">Waiting for extension dispatch</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Delivered Today</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueStatus?.sent || 0}</div>
            <p className="text-xs text-muted-foreground">Successfully sent messages</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Failed / Skipped</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueStatus?.failed || 0}</div>
            <p className="text-xs text-muted-foreground">Errors or non-WhatsApp numbers</p>
          </CardContent>
        </Card>
      </div>

      {/* Campaign Launcher */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" /> Create Marketing Campaign
          </CardTitle>
          <CardDescription>
            Target all opted-in customers and repair clients. Messages are queued safely with randomized delays.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Campaign Name</label>
              <Input
                placeholder="e.g. Diwali Festival Offer 2026"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Message Template</label>
              <select
                className="w-full h-10 px-3 py-2 border rounded-md text-sm bg-background"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
              >
                <option value="">-- Choose Template --</option>
                {templates.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="dryRun"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="dryRun" className="text-sm text-gray-700">
              Dry Run (populate queue as sent without sending actual messages)
            </label>
          </div>

          <Button
            onClick={() => createCampaignMutation.mutate()}
            disabled={!campaignName || !selectedTemplateId || createCampaignMutation.isPending}
          >
            Launch Campaign
          </Button>
        </CardContent>
      </Card>

      {/* Templates Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Message Templates
          </CardTitle>
          <CardDescription>
            Supported variables: <code className="bg-muted px-1 rounded">&#123;name&#125;</code>, <code className="bg-muted px-1 rounded">&#123;phone&#125;</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Input
                placeholder="Template Name (e.g. Service Reminder)"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
              />
              <Textarea
                placeholder="Hello {name}, your phone is ready for pickup at PhoneZone..."
                rows={4}
                value={newTemplateContent}
                onChange={(e) => setNewTemplateContent(e.target.value)}
              />
              <Button
                variant="outline"
                onClick={() => createTemplateMutation.mutate()}
                disabled={!newTemplateName || !newTemplateContent}
              >
                Save Template
              </Button>
            </div>
            <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
              <h4 className="text-xs font-semibold uppercase text-gray-500">Saved Templates</h4>
              {templates.length === 0 ? (
                <p className="text-xs text-gray-400">No templates created yet.</p>
              ) : (
                templates.map((t: any) => (
                  <div key={t.id} className="text-sm p-2 border rounded bg-slate-50">
                    <div className="font-semibold text-xs">{t.name}</div>
                    <div className="text-xs text-gray-600 line-clamp-2">{t.content}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Extension Tokens & Setup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" /> Chrome Extension Access Tokens
          </CardTitle>
          <CardDescription>
            Authenticate the Chrome extension to retrieve the dispatch queue securely.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Description (e.g. Shop Counter PC Chrome)"
              value={tokenDesc}
              onChange={(e) => setTokenDesc(e.target.value)}
            />
            <Button onClick={() => createTokenMutation.mutate()}>Generate Token</Button>
          </div>

          {generatedToken && (
            <Alert className="bg-green-50 border-green-300">
              <AlertTitle className="text-green-800 font-bold">New Token Generated</AlertTitle>
              <AlertDescription className="text-xs font-mono break-all text-green-900 mt-1 select-all">
                {generatedToken}
                <div className="mt-2 text-xs font-sans text-gray-600">
                  Copy this token now and paste it into the PhoneZone Chrome Extension settings popup.
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted text-gray-700">
                <tr>
                  <th className="p-2">Description</th>
                  <th className="p-2">Created</th>
                  <th className="p-2">Status</th>
                  <th className="p-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {tokens.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-3 text-center text-gray-400">
                      No tokens issued.
                    </td>
                  </tr>
                ) : (
                  tokens.map((tok: any) => (
                    <tr key={tok.id} className="border-t">
                      <td className="p-2 font-medium">{tok.description || "Extension"}</td>
                      <td className="p-2 text-gray-500">{new Date(tok.created_at).toLocaleDateString()}</td>
                      <td className="p-2">
                        {tok.revoked_at ? (
                          <Badge variant="destructive">Revoked</Badge>
                        ) : (
                          <Badge className="bg-green-600">Active</Badge>
                        )}
                      </td>
                      <td className="p-2 text-right">
                        {!tok.revoked_at && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => revokeTokenMutation.mutate(tok.id)}
                          >
                            Revoke
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Opt-Out Tool */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Customer Opt-Out Form</CardTitle>
          <CardDescription>
            If a customer requests not to receive WhatsApp promotions, submit their phone number here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 max-w-md">
            <Input
              placeholder="10-digit Phone Number"
              value={optOutPhone}
              onChange={(e) => setOptOutPhone(e.target.value)}
            />
            <Button
              variant="outline"
              onClick={() => optOutMutation.mutate()}
              disabled={!optOutPhone}
            >
              Opt Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

