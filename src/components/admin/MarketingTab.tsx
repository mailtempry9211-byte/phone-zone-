import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Send, Key, FileText, CheckCircle2, XCircle, Clock, QrCode, Smartphone, Wrench, RefreshCw, Radio } from "lucide-react";
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base text-emerald-950 font-bold">
                <Radio className="h-5 w-5 text-emerald-600" /> OpenWA Self-Hosted WhatsApp API Gateway
              </CardTitle>
              <CardDescription className="text-xs">
                Direct WhatsApp integration via OpenWA REST API. Scan QR once to send PDF Invoices and Repair Updates automatically.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-white">
                Dual Session Support
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-5">
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

          {/* Active Session Status & QR Code */}
          {(() => {
            const activeSession = openWaTab === "sales" ? salesSession : repairSession;
            const isConnected = activeSession?.connected;
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
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
                            <Clock className="h-3.5 w-3.5" /> Scan QR to Link Device
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

                {/* QR Code Frame */}
                <div className="flex flex-col items-center justify-center p-4 border rounded-xl bg-slate-50 text-center min-h-[220px]">
                  {isConnected ? (
                    <div className="text-center space-y-2">
                      <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="h-7 w-7" />
                      </div>
                      <h4 className="font-bold text-sm text-slate-800">WhatsApp Number Linked</h4>
                      <p className="text-xs text-gray-500 max-w-xs">
                        This session is active. Invoices and repair job updates will be sent automatically.
                      </p>
                    </div>
                  ) : activeSession?.qrCode ? (
                    <div className="space-y-2">
                      <img
                        src={activeSession.qrCode}
                        alt="WhatsApp QR Code"
                        className="w-44 h-44 border p-1 rounded-lg bg-white shadow-sm mx-auto"
                      />
                      <p className="text-xs text-gray-600 font-medium">
                        Scan from WhatsApp &rarr; Linked Devices &rarr; Link a Device
                      </p>
                    </div>
                  ) : (
                    <div className="text-center space-y-2 text-gray-500 text-xs">
                      <QrCode className="h-10 w-10 text-gray-400 mx-auto" />
                      <p>Connecting to OpenWA gateway at {gatewayUrl}...</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() => (openWaTab === "sales" ? refetchSales() : refetchRepair())}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" /> Refresh QR
                      </Button>
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

