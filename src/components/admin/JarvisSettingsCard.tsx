import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Sparkles,
  Key,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  Eye,
  EyeOff,
  Cpu,
  Volume2,
  RefreshCw,
} from "lucide-react";

export const JarvisSettingsCard: React.FC = () => {
  const queryClient = useQueryClient();
  const [provider, setProvider] = useState<string>("gemini");
  const [apiKey, setApiKey] = useState<string>("");
  const [model, setModel] = useState<string>("gemini-2.5-flash-lite");
  const [customUrl, setCustomUrl] = useState<string>("");
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [autoSpeak, setAutoSpeak] = useState<boolean>(false);
  const [ocrEngine, setOcrEngine] = useState<string>("auto");
  const [showKey, setShowKey] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);

  // Fetch current AI settings
  const { data: config, isLoading } = useQuery({
    queryKey: ["ai-config-settings"],
    queryFn: async () => {
      const res = await fetch("/api/ai/config", { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setProvider(d.provider || "gemini");
        setModel(d.model || "gemini-2.5-flash-lite");
        setCustomUrl(d.customUrl || "");
        setVoiceEnabled(d.voiceEnabled !== false);
        setAutoSpeak(Boolean(d.autoSpeak));
        setOcrEngine(d.ocrEngine || "auto");
        sessionStorage.setItem("pz_ocr_engine", d.ocrEngine || "auto");
        return d;
      }
      return null;
    },
  });

  // Save AI Settings Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (provider === "gemini" && apiKey) {
        const cleanKey = apiKey.trim();
        if (!cleanKey.startsWith("AIzaSy")) {
          throw new Error("Invalid Gemini API Key! Google Gemini keys always start with 'AIzaSy...'. Browser ne aapka login password fill kar diya tha, kripya asli Gemini key paste karein.");
        }
      }
      const res = await fetch("/api/ai/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          provider,
          apiKey: apiKey || undefined,
          model,
          customUrl: customUrl || undefined,
          voiceEnabled,
          autoSpeak,
          ocrEngine,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save settings");
      sessionStorage.setItem("pz_ocr_engine", ocrEngine);
      return data;
    },
    onSuccess: () => {
      toast.success("JARVIS AI Settings Saved Successfully!");
      setApiKey("");
      queryClient.invalidateQueries({ queryKey: ["ai-config"] });
      queryClient.invalidateQueries({ queryKey: ["ai-config-settings"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save AI configuration");
    },
  });

  // Test Connection
  const handleTestConnection = async () => {
    if (provider === "gemini" && apiKey && !apiKey.trim().startsWith("AIzaSy")) {
      toast.error("Invalid Gemini API Key! Key must start with 'AIzaSy...'. Please do not test with your login password.");
      return;
    }
    setTesting(true);
    try {
      const res = await fetch("/api/ai/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          provider,
          apiKey: apiKey || undefined,
          model,
          customUrl: customUrl || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Connection test failed");
      }
      toast.success(`Connected! ${data.message || "JARVIS is online."}`);
    } catch (err: any) {
      toast.error(err.message || "Could not connect to AI Provider");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="border-indigo-300 dark:border-indigo-900 shadow-md">
      <CardHeader className="bg-gradient-to-r from-indigo-50 via-purple-50 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 pb-3 border-b">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base text-indigo-950 dark:text-indigo-200 font-bold">
              <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              PhoneZone JARVIS AI Copilot &amp; AI Vision Setup
            </CardTitle>
            <CardDescription className="text-xs">
              Configure free Google Gemini, Groq, or OpenRouter keys for full ERP voice/text automation and AI Vision OCR.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {config?.hasKey || config?.isConfigured ? (
              <Badge className="bg-emerald-600 text-white flex items-center gap-1 text-xs">
                <CheckCircle2 className="h-3 w-3" /> JARVIS Online
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50 text-xs">
                Key Missing (Offline)
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {/* Step-by-Step Free Key Guide */}
        <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs space-y-2">
          <div className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center justify-between">
            <span>🎁 100% Free Lifetime Key Kaise Paayein (30 Seconds Step-by-Step):</span>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 font-semibold underline"
            >
              Get Free Gemini Key ↗
            </a>
          </div>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            1. <strong>aistudio.google.com/app/apikey</strong> par click karein (Google Account se login karein).<br />
            2. <strong>"Create API key"</strong> dabayein aur key copy karke neeche paste karein.<br />
            3. Yeh <strong>100% Free (No Credit Card required)</strong> hai aur daily 1,500 requests deta hai!
          </p>
        </div>

        {/* Provider Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Primary AI Provider (चुने)
            </Label>
            <select
              value={provider}
              onChange={(e) => {
                const p = e.target.value;
                setProvider(p);
                if (p === "gemini") setModel("gemini-2.5-flash-lite");
                else if (p === "groq") setModel("llama-3.3-70b-versatile");
                else if (p === "openrouter") setModel("meta-llama/llama-3.3-70b-instruct:free");
              }}
              className="w-full h-9 px-3 rounded-md border text-xs bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
            >
              <option value="gemini">Google Gemini AI Studio (Recommended - 100% Free)</option>
              <option value="groq">Groq Cloud (Llama 3.3 70B - Ultra Fast 500 T/s)</option>
              <option value="openrouter">OpenRouter (Free Open Source Models)</option>
              <option value="ollama">Local Ollama / LM Studio (100% Offline)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Model Name
            </Label>
            {provider === "gemini" ? (
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full h-9 px-3 rounded-md border text-xs bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
              >
                <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite (Recommended - 100% Free & Stable)</option>
                <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Ultra Fast & Lightweight)</option>
                <option value="gemini-3.5-flash">gemini-3.5-flash (High Intelligence)</option>
                <option value="gemini-flash-latest">gemini-flash-latest (Auto Latest)</option>
              </select>
            ) : (
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. llama-3.3-70b-versatile or meta-llama/llama-3.3-70b-instruct:free"
                className="h-9 text-xs"
              />
            )}
          </div>
        </div>

        {/* API Key Input */}
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
            <span>{provider.toUpperCase()} API Key:</span>
            {config?.hasKey && (
              <span className="text-[11px] text-emerald-600 font-normal">
                ✅ Existing key is active in database (leave blank to keep current)
              </span>
            )}
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type="text"
                name="gemini_api_key_custom_token"
                autoComplete="new-password"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                style={!showKey ? ({ WebkitTextSecurity: "disc" } as any) : undefined}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={config?.hasKey ? "•••••••••••••••••••••••• (Leave blank to keep)" : "AIzaSy..."}
                className="h-9 text-xs pr-10 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testing}
              className="h-9 text-xs shrink-0"
            >
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
              Test Key
            </Button>
          </div>
        </div>

        {/* Custom URL if Ollama or OpenAI compatible */}
        {(provider === "ollama" || provider === "custom") && (
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Custom Endpoint URL
            </Label>
            <Input
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="http://127.0.0.1:11434"
              className="h-9 text-xs"
            />
          </div>
        )}

        {/* OCR & Scanning Engine Selection */}
        <div className="space-y-2 pt-2 border-t">
          <div>
            <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Aadhaar & IMEI Scanning Engine (OCR Mode)
            </Label>
            <p className="text-[11px] text-gray-500">
              Chunein ki Aadhaar card aur IMEI scan kis engine se process hona chahiye:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div
              onClick={() => setOcrEngine("auto")}
              className={`cursor-pointer p-3 rounded-lg border text-left transition-all ${
                ocrEngine === "auto"
                  ? "border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 ring-1 ring-indigo-600 shadow-sm"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
              }`}
            >
              <div className="font-semibold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                ⚡ Auto Hybrid (Best)
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                Pehle Cloud AI Vision se scan karega. Agar AI key na ho ya fail ho, toh automatic offline QR/OCR se data nikal lega.
              </p>
            </div>

            <div
              onClick={() => setOcrEngine("ai_only")}
              className={`cursor-pointer p-3 rounded-lg border text-left transition-all ${
                ocrEngine === "ai_only"
                  ? "border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 ring-1 ring-indigo-600 shadow-sm"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
              }`}
            >
              <div className="font-semibold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                🤖 AI Vision Only
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                Sirf Gemini/Cloud AI se padhega. Device aur Render server pe 0% CPU/RAM load. Local offline OCR band rahega.
              </p>
            </div>

            <div
              onClick={() => setOcrEngine("offline_only")}
              className={`cursor-pointer p-3 rounded-lg border text-left transition-all ${
                ocrEngine === "offline_only"
                  ? "border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 ring-1 ring-indigo-600 shadow-sm"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
              }`}
            >
              <div className="font-semibold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                🔒 Offline Only
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                100% Local (Secure QR + Tesseract). Cloud AI ko koi photo ya request nahi jayegi, internet ke bina chalega.
              </p>
            </div>
          </div>
        </div>

        {/* Voice & Auto-Speak Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
          <div className="flex items-center justify-between p-2.5 rounded-lg border bg-slate-50 dark:bg-slate-900">
            <div className="space-y-0.5">
              <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                Voice Commands (Speech-to-Text)
              </Label>
              <p className="text-[10px] text-gray-500">Mic se bolkar command dene ki suvidha</p>
            </div>
            <Switch checked={voiceEnabled} onCheckedChange={setVoiceEnabled} />
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-lg border bg-slate-50 dark:bg-slate-900">
            <div className="space-y-0.5">
              <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                Voice Reply (Auto-Speak TTS)
              </Label>
              <p className="text-[10px] text-gray-500">Jarvis uttar bolkar aawaz me sunayega</p>
            </div>
            <Switch checked={autoSpeak} onCheckedChange={setAutoSpeak} />
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <Button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs h-9 px-5 shadow-sm"
          >
            {saveMutation.isPending ? "Saving..." : "Save JARVIS AI Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default JarvisSettingsCard;
