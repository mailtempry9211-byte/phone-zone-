import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertTriangle,
  Send,
  Key,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  QrCode,
  Smartphone,
  Wrench,
  RefreshCw,
  Radio,
  Play,
  Square,
  Copy,
  Check,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Users,
  Upload,
  Image as ImageIcon,
  Paperclip,
  ShieldAlert,
  Zap,
  ListFilter,
  Eye,
  Sliders,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Contact {
  id: string;
  name: string;
  phone: string;
  address?: string;
  shop_name?: string;
  type: "customer" | "seller" | "dealer" | "repair_customer" | "custom";
}

export default function MarketingTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Campaign State
  const [campaignName, setCampaignName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [dryRun, setDryRun] = useState(false);

  // Recipient Selection State
  const [audienceCategory, setAudienceCategory] = useState<"all" | "customer" | "seller" | "dealer" | "repair_customer" | "csv">("all");
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContactPhones, setSelectedContactPhones] = useState<Set<string>>(new Set());
  const [csvContacts, setCsvContacts] = useState<Contact[]>([]);

  // Media Attachment State
  const [mediaAttachment, setMediaAttachment] = useState<{ name: string; url: string; type: string } | null>(null);

  // Ultra Pro Max Anti-Ban State
  const [antiBanEnabled, setAntiBanEnabled] = useState(true);
  const [delayMin, setDelayMin] = useState(25);
  const [delayMax, setDelayMax] = useState(65);
  const [simulateTyping, setSimulateTyping] = useState(true);
  const [cooldownBatchSize, setCooldownBatchSize] = useState(15);
  const [cooldownMinutes, setCooldownMinutes] = useState(3);

  // Campaign Logs Modal
  const [viewingCampaign, setViewingCampaign] = useState<any | null>(null);

  // Template Management
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateContent, setNewTemplateContent] = useState("");
  const [tokenDesc, setTokenDesc] = useState("");
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [optOutPhone, setOptOutPhone] = useState("");

  // OpenWA Gateway State
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

  // Fetch all aggregated contacts
  const { data: contactsData, isLoading: loadingContacts } = useQuery({
    queryKey: ["wa-all-contacts"],
    queryFn: async () => {
      const res = await fetch("/api/wa/contacts");
      return res.ok ? res.json() : { contacts: [], counts: {} };
    },
  });

  const allSystemContacts: Contact[] = contactsData?.contacts || [];

  // Active contact list based on tab
  const activeContactsList = useMemo(() => {
    let list: Contact[] = [];
    if (audienceCategory === "csv") {
      list = csvContacts;
    } else if (audienceCategory === "all") {
      list = allSystemContacts;
    } else {
      list = allSystemContacts.filter((c) => c.type === audienceCategory);
    }

    if (contactSearch.trim()) {
      const q = contactSearch.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          (c.shop_name && c.shop_name.toLowerCase().includes(q))
      );
    }
    return list;
  }, [audienceCategory, allSystemContacts, csvContacts, contactSearch]);

  const handleSelectAllToggle = () => {
    const next = new Set(selectedContactPhones);
    const allVisibleSelected = activeContactsList.every((c) => next.has(c.phone));

    if (allVisibleSelected) {
      // Unselect all visible
      for (const c of activeContactsList) {
        next.delete(c.phone);
      }
    } else {
      // Select all visible
      for (const c of activeContactsList) {
        next.add(c.phone);
      }
    }
    setSelectedContactPhones(next);
  };

  const handleToggleSinglePhone = (phone: string) => {
    const next = new Set(selectedContactPhones);
    if (next.has(phone)) {
      next.delete(phone);
    } else {
      next.add(phone);
    }
    setSelectedContactPhones(next);
  };

  // CSV / XLSX Parser
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const parsed: Contact[] = [];
      const seen = new Set<string>();

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const parts = line.split(/[,\t;]/).map((p) => p.replace(/^["']|["']$/g, "").trim());
        if (parts.length === 0) continue;

        // Try to identify phone column (10 to 12 digits)
        let name = `Recipient ${i + 1}`;
        let phone = "";

        for (const part of parts) {
          const clean = part.replace(/\D/g, "");
          if (clean.length === 10 || clean.length === 12) {
            phone = clean.length === 12 && clean.startsWith("91") ? clean.slice(2) : clean;
          } else if (part.length > 2 && isNaN(Number(part)) && name.startsWith("Recipient")) {
            name = part;
          }
        }

        if (phone && !seen.has(phone)) {
          seen.add(phone);
          parsed.push({
            id: `csv_${i}`,
            name,
            phone,
            type: "custom",
          });
        }
      }

      setCsvContacts(parsed);
      setAudienceCategory("csv");
      // Pre-select all uploaded contacts
      const autoSelected = new Set(selectedContactPhones);
      parsed.forEach((p) => autoSelected.add(p.phone));
      setSelectedContactPhones(autoSelected);

      toast({
        title: "File Processed Successfully",
        description: `Imported ${parsed.length} unique phone numbers from ${file.name}.`,
      });
    };
    reader.readAsText(file);
  };

  // Media Attachment Upload
  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 16 * 1024 * 1024) {
      toast({ title: "File Too Large", description: "Media attachments must be under 16MB.", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setMediaAttachment({
        name: file.name,
        url: reader.result as string,
        type: file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "document",
      });
      toast({ title: "Media Attached", description: `${file.name} ready for WhatsApp broadcast.` });
    };
    reader.readAsDataURL(file);
  };

  // Queries for OpenWA & Campaigns
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

  const { data: campaigns = [], refetch: refetchCampaigns } = useQuery({
    queryKey: ["wa-campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/wa/campaigns");
      return res.ok ? res.json() : [];
    },
    refetchInterval: 10000,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["wa-templates"],
    queryFn: async () => {
      const res = await fetch("/api/wa/templates");
      return res.ok ? res.json() : [];
    },
  });

  const { data: tokens = [] } = useQuery({
    queryKey: ["wa-tokens"],
    queryFn: async () => {
      const res = await fetch("/api/wa/tokens");
      return res.ok ? res.json() : [];
    },
  });

  // Query for viewing campaign logs
  const { data: campaignLogs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ["campaign-logs", viewingCampaign?.id],
    queryFn: async () => {
      if (!viewingCampaign?.id) return [];
      const res = await fetch(`/api/wa/campaigns/${viewingCampaign.id}/logs`);
      return res.ok ? res.json() : [];
    },
    enabled: !!viewingCampaign?.id,
  });

  // Server management mutations
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

  const createTemplateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/wa/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTemplateName, content: newTemplateContent }),
      });
      if (!res.ok) throw new Error("Failed to create template");
      return res.json();
    },
    onSuccess: (t) => {
      toast({ title: "Template Created", description: `Template "${t.name}" saved.` });
      setNewTemplateName("");
      setNewTemplateContent("");
      setSelectedTemplateId(t.id);
      queryClient.invalidateQueries({ queryKey: ["wa-templates"] });
    },
  });

  // Launch Campaign Mutation
  const launchCampaignMutation = useMutation({
    mutationFn: async () => {
      if (!campaignName.trim()) throw new Error("Campaign name is required.");

      let templateIdToUse = selectedTemplateId;
      if (!templateIdToUse) {
        if (!customMessage.trim()) throw new Error("Please select a template or type a custom message.");
        // Create an ad-hoc template
        const tRes = await fetch("/api/wa/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: `${campaignName} Template`, content: customMessage.trim() }),
        });
        const createdT = await tRes.json();
        templateIdToUse = createdT.id;
      }

      // Collect selected recipients
      const selectedList: Contact[] = [];
      const allAvailable = [...allSystemContacts, ...csvContacts];
      for (const c of allAvailable) {
        if (selectedContactPhones.has(c.phone)) {
          selectedList.push(c);
        }
      }

      if (selectedList.length === 0) {
        throw new Error("Please select at least one recipient from the list below.");
      }

      const res = await fetch("/api/wa/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaignName.trim(),
          template_id: templateIdToUse,
          dry_run: dryRun,
          audience: audienceCategory,
          recipients: selectedList,
          media_url: mediaAttachment?.url || null,
          media_type: mediaAttachment?.type || null,
          delay_min: delayMin,
          delay_max: delayMax,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to launch campaign");
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Campaign Launched Successfully!",
        description: `Queued ${data.total_count} personalized messages with Anti-Ban protection.`,
      });
      setCampaignName("");
      setSelectedContactPhones(new Set());
      setMediaAttachment(null);
      refetchCampaigns();
    },
    onError: (err: any) => {
      toast({ title: "Campaign Error", description: err.message, variant: "destructive" });
    },
  });

  // Token Management
  const createTokenMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/wa/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: tokenDesc }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedToken(data.token);
      setTokenDesc("");
      queryClient.invalidateQueries({ queryKey: ["wa-tokens"] });
    },
  });

  const revokeTokenMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/wa/tokens/${id}/revoke`, { method: "POST" });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Token Revoked" });
      queryClient.invalidateQueries({ queryKey: ["wa-tokens"] });
    },
  });

  const optOutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/wa/opt-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: optOutPhone }),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Opt-Out Recorded", description: `Phone ${optOutPhone} will receive no marketing messages.` });
      setOptOutPhone("");
    },
  });

  return (
    <div className="space-y-6">
      {/* OpenWA Direct WhatsApp Gateway Card */}
      <Card className="border-emerald-300 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-emerald-50 via-teal-50 to-white pb-3 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base text-emerald-950 font-bold">
                <Radio className="h-5 w-5 text-emerald-600" /> OpenWA Self-Hosted WhatsApp API Gateway
              </CardTitle>
              <CardDescription className="text-xs">
                Direct WhatsApp integration via OpenWA REST API. Scan QR or link via Phone Number to dispatch Invoices &amp; Marketing automatically.
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
                📖 WhatsApp Features &amp; Setup Complete Guide (व्हाट्सएप फीचर्स उपयोग करने की पूरी गाइड)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div className="border rounded-md p-3 bg-white space-y-1">
                  <div className="font-bold text-emerald-700">1. Click-to-Chat (wa.me URL)</div>
                  <p className="text-gray-600">
                    बिल्कुल ज़ीरो सेटअप। मोबाइल, टैबलेट, APK या ब्राउज़र में तुरंत चलता है।
                  </p>
                </div>
                <div className="border rounded-md p-3 bg-white space-y-1">
                  <div className="font-bold text-blue-700">2. OpenWA Gateway (पूर्ण ऑटोमेशन)</div>
                  <p className="text-gray-600">
                    बैकग्राउंड में अपने-आप PDF और टेक्स्ट मैसेज चले जाते हैं।
                  </p>
                </div>
                <div className="border rounded-md p-3 bg-white space-y-1">
                  <div className="font-bold text-purple-700">3. Chrome Extension (PC मार्केटिंग)</div>
                  <p className="text-gray-600">
                    WhatsApp Web में सुरक्षित अंतराल (25-70 सेकंड) के साथ मैसेज कतार में भेजता है।
                  </p>
                </div>
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
                className={openWaTab === "repairs" ? "bg-indigo-700 hover:bg-indigo-800" : ""}
                onClick={() => setOpenWaTab("repairs")}
              >
                <Wrench className="h-4 w-4 mr-1.5" /> Repair Dept WhatsApp Session
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ULTRA PRO MAX CAMPAIGN BUILDER & ANTI-BAN SUITE */}
      <Card className="border-sky-300 shadow-md">
        <CardHeader className="bg-gradient-to-r from-sky-50 via-blue-50 to-white pb-3 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg text-sky-950 font-bold">
                <Send className="h-5 w-5 text-sky-600" /> WhatsApp Marketing Campaign &amp; Broadcast
              </CardTitle>
              <CardDescription className="text-xs">
                Broadcast personalized promotional messages, festivals offers, stock updates &amp; media attachments.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-sky-600 text-white flex items-center gap-1 text-xs">
                <Zap className="h-3.5 w-3.5" /> Ultra Pro Max Anti-Ban Active
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-5">
          {/* STEP 1: CAMPAIGN DETAILS & MESSAGE COMPOSITION */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700">Campaign Name *</label>
                <Input
                  placeholder="e.g. Diwali Super Discount 2026 / iPhone Stock Update"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-gray-700">Choose Saved Template</label>
                  <span className="text-[11px] text-gray-500">or type custom below</span>
                </div>
                <select
                  className="w-full h-9 px-3 py-1.5 border rounded-md text-xs bg-white"
                  value={selectedTemplateId}
                  onChange={(e) => {
                    setSelectedTemplateId(e.target.value);
                    const found = templates.find((t: any) => t.id === e.target.value);
                    if (found) setCustomMessage(found.content);
                  }}
                >
                  <option value="">-- Choose Template or Type Below --</option>
                  {templates.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-gray-700">Message Content *</label>
                  <div className="flex gap-1 text-[11px]">
                    <span className="text-gray-400">Click to insert:</span>
                    <button
                      type="button"
                      onClick={() => setCustomMessage((m) => m + " {name}")}
                      className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-mono text-[10px]"
                    >
                      &#123;name&#125;
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomMessage((m) => m + " {shop_name}")}
                      className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-mono text-[10px]"
                    >
                      &#123;shop_name&#125;
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomMessage((m) => m + " {phone}")}
                      className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-mono text-[10px]"
                    >
                      &#123;phone&#125;
                    </button>
                  </div>
                </div>
                <Textarea
                  placeholder="Hello {name}, Special festival discount available at {shop_name}! Visit us today..."
                  rows={4}
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  className="text-xs"
                />
              </div>

              {/* Media Attachment */}
              <div className="border border-dashed rounded-lg p-3 bg-slate-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4 text-sky-600" />
                    <div>
                      <div className="text-xs font-semibold text-gray-800">Media Attachment (Image / Video / PDF)</div>
                      <div className="text-[10px] text-gray-500">Send an offer flyer, brochure, or phone photo</div>
                    </div>
                  </div>
                  <div>
                    <label className="cursor-pointer inline-flex items-center justify-center h-7 px-2.5 rounded bg-white border border-gray-300 text-xs text-gray-700 hover:bg-slate-50">
                      <Upload className="h-3 w-3 mr-1" /> Choose File
                      <input type="file" accept="image/*,video/*,application/pdf" className="hidden" onChange={handleMediaUpload} />
                    </label>
                  </div>
                </div>

                {mediaAttachment && (
                  <div className="mt-2.5 p-2 bg-white rounded border flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 overflow-hidden">
                      {mediaAttachment.type === "image" ? (
                        <img src={mediaAttachment.url} alt="Attached" className="h-9 w-9 object-cover rounded" />
                      ) : (
                        <FileText className="h-7 w-7 text-blue-600" />
                      )}
                      <div className="truncate">
                        <div className="font-semibold truncate">{mediaAttachment.name}</div>
                        <div className="text-[10px] text-gray-400 uppercase">{mediaAttachment.type}</div>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setMediaAttachment(null)}
                      className="h-6 px-1.5 text-xs text-red-500"
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* STEP 2: ULTRA PRO MAX ANTI-BAN PROTECTION SUITE */}
            <div className="space-y-3 bg-slate-50/80 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-1.5 font-bold text-xs text-gray-800">
                  <ShieldAlert className="h-4 w-4 text-emerald-600" />
                  Ultra Pro Max Anti-Ban Safety Suite
                </div>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]">
                  WhatsApp Protection Active
                </Badge>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex justify-between font-semibold text-gray-700 mb-1">
                    <span>Human-Like Randomized Typing Delay:</span>
                    <span className="text-emerald-700 font-mono font-bold">{delayMin}s – {delayMax}s per message</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div>
                      <span className="text-[10px] text-gray-500">Min Jitter (Seconds):</span>
                      <Input
                        type="number"
                        min={15}
                        max={120}
                        value={delayMin}
                        onChange={(e) => setDelayMin(Number(e.target.value))}
                        className="h-7 text-xs bg-white font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500">Max Jitter (Seconds):</span>
                      <Input
                        type="number"
                        min={25}
                        max={180}
                        value={delayMax}
                        onChange={(e) => setDelayMax(Number(e.target.value))}
                        className="h-7 text-xs bg-white font-mono"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Meta detects automated blasting. Random 25-65s gaps prevent algorithm triggers.
                  </p>
                </div>

                <div className="flex items-center justify-between border-t pt-2">
                  <div>
                    <div className="font-semibold text-gray-800">Simulate Human Typing Activity</div>
                    <div className="text-[10px] text-gray-500">Sends &quot;typing...&quot; presence indicator before sending</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={simulateTyping}
                    onChange={(e) => setSimulateTyping(e.target.checked)}
                    className="h-4 w-4 rounded text-emerald-600"
                  />
                </div>

                <div className="border-t pt-2 space-y-1">
                  <div className="flex justify-between font-semibold text-gray-800">
                    <span>Smart Batch Cooldown Break:</span>
                    <span className="text-sky-700 font-semibold">Pause {cooldownMinutes}m after {cooldownBatchSize} msgs</span>
                  </div>
                  <p className="text-[10px] text-gray-400">
                    Takes automatic rest intervals like a real human shop staff typing from a phone.
                  </p>
                </div>

                <div className="flex items-center gap-2 border-t pt-2">
                  <input
                    type="checkbox"
                    id="dryRunMarketing"
                    checked={dryRun}
                    onChange={(e) => setDryRun(e.target.checked)}
                    className="h-4 w-4 rounded text-blue-600"
                  />
                  <label htmlFor="dryRunMarketing" className="text-xs font-semibold text-gray-700 cursor-pointer">
                    Dry Run Test (Simulate queue without actual WhatsApp delivery)
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* STEP 3: RECIPIENT AUDIENCE SELECTION (ALL / CUSTOMERS / SELLERS / DEALERS / CSV) */}
          <div className="border-t pt-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-sky-600" /> Choose Campaign Recipients
                </h4>
                <p className="text-xs text-gray-500">
                  Select all contacts or pick specific individuals. Supports Excel/CSV list uploads.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-sky-50 text-sky-800 border-sky-300 font-bold px-3 py-1 text-xs">
                  Selected: {selectedContactPhones.size} contacts
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSelectAllToggle}
                  className="h-8 text-xs border-sky-300 text-sky-700 hover:bg-sky-50"
                >
                  {activeContactsList.every((c) => selectedContactPhones.has(c.phone)) && activeContactsList.length > 0
                    ? "Deselect All Visible"
                    : `Select All Visible (${activeContactsList.length})`}
                </Button>
              </div>
            </div>

            {/* Audience Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-lg border border-slate-200">
              <Button
                type="button"
                size="sm"
                variant={audienceCategory === "all" ? "default" : "ghost"}
                onClick={() => setAudienceCategory("all")}
                className={`h-7 px-2.5 text-xs ${audienceCategory === "all" ? "bg-slate-900 text-white" : ""}`}
              >
                All Directory ({allSystemContacts.length})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={audienceCategory === "customer" ? "default" : "ghost"}
                onClick={() => setAudienceCategory("customer")}
                className={`h-7 px-2.5 text-xs ${audienceCategory === "customer" ? "bg-emerald-600 text-white" : ""}`}
              >
                Customers ({contactsData?.counts?.customers || 0})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={audienceCategory === "seller" ? "default" : "ghost"}
                onClick={() => setAudienceCategory("seller")}
                className={`h-7 px-2.5 text-xs ${audienceCategory === "seller" ? "bg-amber-600 text-white" : ""}`}
              >
                Sellers ({contactsData?.counts?.sellers || 0})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={audienceCategory === "dealer" ? "default" : "ghost"}
                onClick={() => setAudienceCategory("dealer")}
                className={`h-7 px-2.5 text-xs ${audienceCategory === "dealer" ? "bg-sky-600 text-white" : ""}`}
              >
                Dealers (B2B) ({contactsData?.counts?.dealers || 0})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={audienceCategory === "repair_customer" ? "default" : "ghost"}
                onClick={() => setAudienceCategory("repair_customer")}
                className={`h-7 px-2.5 text-xs ${audienceCategory === "repair_customer" ? "bg-indigo-600 text-white" : ""}`}
              >
                Repair Clients ({contactsData?.counts?.repair_customers || 0})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={audienceCategory === "csv" ? "default" : "ghost"}
                onClick={() => setAudienceCategory("csv")}
                className={`h-7 px-2.5 text-xs gap-1 ${audienceCategory === "csv" ? "bg-purple-600 text-white" : "text-purple-700"}`}
              >
                <Upload className="h-3 w-3" /> Upload Excel/CSV ({csvContacts.length})
              </Button>
            </div>

            {/* CSV File Dropzone if CSV tab selected */}
            {audienceCategory === "csv" && (
              <div className="border border-purple-200 bg-purple-50/50 rounded-lg p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-bold text-purple-900">Upload External Contact List (CSV / TXT / Excel)</div>
                  <div className="text-purple-700 text-[11px]">
                    File should contain phone numbers and optional contact names.
                  </div>
                </div>
                <label className="cursor-pointer inline-flex items-center justify-center h-8 px-3 rounded bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs">
                  <Upload className="h-3.5 w-3.5 mr-1.5" /> Choose CSV File
                  <input type="file" accept=".csv,.txt" className="hidden" onChange={handleCsvUpload} />
                </label>
              </div>
            )}

            {/* Search filter for contacts */}
            <div className="flex gap-2">
              <Input
                placeholder="Filter visible contacts by name, phone, or shop..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="h-8 text-xs bg-white max-w-sm"
              />
            </div>

            {/* Recipients Table */}
            <div className="border rounded-lg max-h-56 overflow-y-auto bg-white">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0">
                  <TableRow className="h-8">
                    <TableHead className="w-10 text-center">
                      <input
                        type="checkbox"
                        checked={activeContactsList.length > 0 && activeContactsList.every((c) => selectedContactPhones.has(c.phone))}
                        onChange={handleSelectAllToggle}
                        className="rounded"
                      />
                    </TableHead>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Phone</TableHead>
                    <TableHead className="text-xs">Category</TableHead>
                    <TableHead className="text-xs">Location / Firm</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingContacts ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-xs text-gray-400">
                        Loading contact directory...
                      </TableCell>
                    </TableRow>
                  ) : activeContactsList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-xs text-gray-400">
                        No contacts found matching the selected filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    activeContactsList.map((contact) => {
                      const isSelected = selectedContactPhones.has(contact.phone);
                      return (
                        <TableRow
                          key={contact.phone}
                          className={`h-8 cursor-pointer text-xs ${isSelected ? "bg-sky-50/60 font-semibold" : "hover:bg-slate-50"}`}
                          onClick={() => handleToggleSinglePhone(contact.phone)}
                        >
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSinglePhone(contact.phone)}
                              className="rounded"
                            />
                          </TableCell>
                          <TableCell className="text-gray-900">{contact.name}</TableCell>
                          <TableCell className="font-mono text-gray-600">{contact.phone}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] capitalize ${
                                contact.type === "dealer"
                                  ? "bg-sky-50 text-sky-700 border-sky-300"
                                  : contact.type === "seller"
                                  ? "bg-amber-50 text-amber-700 border-amber-300"
                                  : contact.type === "repair_customer"
                                  ? "bg-indigo-50 text-indigo-700 border-indigo-300"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-300"
                              }`}
                            >
                              {contact.type.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-gray-500 truncate max-w-[200px]">
                            {contact.shop_name || contact.address || "Sitapur"}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Launch Campaign Action Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t pt-4">
            <div className="text-xs text-gray-500">
              Targeting: <strong className="text-sky-900">{selectedContactPhones.size} contacts</strong> with randomized delay &amp; media.
            </div>
            <Button
              size="lg"
              onClick={() => launchCampaignMutation.mutate()}
              disabled={launchCampaignMutation.isPending || selectedContactPhones.size === 0 || !campaignName}
              className="bg-sky-600 hover:bg-sky-700 text-white min-w-[240px] shadow-sm font-semibold"
            >
              <Send className="h-4 w-4 mr-2" />
              {launchCampaignMutation.isPending
                ? "Launching Broadcast..."
                : `Broadcast to ${selectedContactPhones.size} Recipients`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* CAMPAIGN PERFORMANCE & DELIVERY REPORT LOGS */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ListFilter className="h-5 w-5 text-sky-600" /> Broadcast Campaigns &amp; Delivery Reports
              </CardTitle>
              <CardDescription className="text-xs">
                Inspect real-time transmission status, delivery logs, sent/failed metrics for past broadcasts.
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => refetchCampaigns()} className="h-8 text-xs gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh Reports
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-xs">Campaign Name</TableHead>
                  <TableHead className="text-xs">Created Date</TableHead>
                  <TableHead className="text-center text-xs">Total Targets</TableHead>
                  <TableHead className="text-center text-xs">Delivered / Sent</TableHead>
                  <TableHead className="text-center text-xs">Failed</TableHead>
                  <TableHead className="text-center text-xs">Status</TableHead>
                  <TableHead className="text-right text-xs">Delivery Logs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-400 text-xs">
                      No broadcast campaigns executed yet. Launch a campaign above to see delivery statistics.
                    </TableCell>
                  </TableRow>
                ) : (
                  campaigns.map((c: any) => (
                    <TableRow key={c.id} className="text-xs hover:bg-slate-50/80">
                      <TableCell className="font-semibold text-gray-900">{c.name}</TableCell>
                      <TableCell className="text-gray-500">{new Date(c.created_at).toLocaleDateString("en-IN")}</TableCell>
                      <TableCell className="text-center font-bold">{c.total_count || 0}</TableCell>
                      <TableCell className="text-center font-bold text-emerald-600">
                        {c.sent_count || 0}
                      </TableCell>
                      <TableCell className="text-center font-bold text-red-600">
                        {c.failed_count || 0}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={`capitalize text-[10px] ${
                            c.status === "completed"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                              : c.status === "running"
                              ? "bg-blue-50 text-blue-700 border-blue-300 animate-pulse"
                              : "bg-slate-50 text-slate-700"
                          }`}
                        >
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setViewingCampaign(c)}
                          className="h-7 text-xs text-sky-700 hover:text-sky-900 hover:bg-sky-50 gap-1"
                        >
                          <Eye className="h-3.5 w-3.5" /> View Log
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Campaign Recipient Logs Modal */}
      <Dialog open={!!viewingCampaign} onOpenChange={(open) => !open && setViewingCampaign(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <FileText className="h-5 w-5 text-sky-600" />
              Recipient Delivery Log: {viewingCampaign?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex justify-between items-center text-xs text-gray-600 bg-slate-50 p-2.5 rounded border">
              <span>Total: <strong>{viewingCampaign?.total_count || 0}</strong></span>
              <span className="text-emerald-700">Sent: <strong>{viewingCampaign?.sent_count || 0}</strong></span>
              <span className="text-red-700">Failed: <strong>{viewingCampaign?.failed_count || 0}</strong></span>
              <span>Status: <strong className="capitalize">{viewingCampaign?.status}</strong></span>
            </div>

            <div className="border rounded-lg max-h-72 overflow-y-auto">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0">
                  <TableRow className="h-8">
                    <TableHead className="text-xs">Recipient</TableHead>
                    <TableHead className="text-xs">Phone</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Dispatched At</TableHead>
                    <TableHead className="text-xs">Details / Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingLogs ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-xs text-gray-400">
                        Loading detailed logs...
                      </TableCell>
                    </TableRow>
                  ) : campaignLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-xs text-gray-400">
                        No recipient log records found for this campaign.
                      </TableCell>
                    </TableRow>
                  ) : (
                    campaignLogs.map((log: any) => (
                      <TableRow key={log.id} className="text-xs h-8">
                        <TableCell className="font-semibold text-gray-900">{log.customer_name || "Contact"}</TableCell>
                        <TableCell className="font-mono text-gray-600">{log.customer_phone}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] capitalize ${
                              log.status === "sent"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                : log.status === "failed"
                                ? "bg-red-50 text-red-700 border-red-300"
                                : "bg-amber-50 text-amber-700 border-amber-300"
                            }`}
                          >
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-500">
                          {log.sent_at ? new Date(log.sent_at).toLocaleTimeString() : "-"}
                        </TableCell>
                        <TableCell className="text-gray-400 truncate max-w-[200px]">
                          {log.error || "Delivered successfully"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingCampaign(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Templates Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Message Templates
          </CardTitle>
          <CardDescription>
            Supported variables: <code className="bg-muted px-1 rounded">&#123;name&#125;</code>,{" "}
            <code className="bg-muted px-1 rounded">&#123;shop_name&#125;</code>,{" "}
            <code className="bg-muted px-1 rounded">&#123;phone&#125;</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Input
                placeholder="Template Name (e.g. Service Reminder / Festival Offer)"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
              />
              <Textarea
                placeholder="Hello {name}, your phone is ready at {shop_name}..."
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
