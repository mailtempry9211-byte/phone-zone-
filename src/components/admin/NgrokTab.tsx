import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Globe,
  Wifi,
  WifiOff,
  Copy,
  ExternalLink,
  Loader2,
  QrCode,
  ShieldCheck,
  Smartphone,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import QRCode from "qrcode";
import { LOCAL_API_BASE } from "@/lib/data";

interface NgrokState {
  authtoken: string;
  claimedDomain: string;
  isEnabled: boolean;
  autoStart?: boolean;
  lastUrl: string | null;
  running: boolean;
  error: string | null;
}

export default function NgrokTab() {
  const [state, setState] = useState<NgrokState>({
    authtoken: "",
    claimedDomain: "",
    isEnabled: false,
    autoStart: true,
    lastUrl: null,
    running: false,
    error: null,
  });
  const [tokenInput, setTokenInput] = useState("");
  const [domainInput, setDomainInput] = useState("");
  const [autoStartInput, setAutoStartInput] = useState(true);
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const isDirtyRef = useRef(false);
  const initialLoadedRef = useRef(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${LOCAL_API_BASE}/ngrok/status`, { credentials: "include" });
      if (res.ok) {
        const data: NgrokState = await res.json();
        setState(data);
        if (!initialLoadedRef.current || !isDirtyRef.current) {
          setTokenInput(data.authtoken || "");
          setDomainInput(data.claimedDomain || "");
          setAutoStartInput(data.autoStart ?? true);
          initialLoadedRef.current = true;
        }

        if (data.running && data.lastUrl) {
          generateQr(data.lastUrl);
        } else {
          setQrDataUrl(null);
        }
      }
    } catch (_err) {
      // offline / desktop not running
    }
  };

  const generateQr = async (url: string) => {
    try {
      const qr = await QRCode.toDataURL(url, {
        width: 260,
        margin: 2,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
      setQrDataUrl(qr);
    } catch (_e) {
      setQrDataUrl(null);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveSettings = async () => {
    try {
      const res = await fetch(`${LOCAL_API_BASE}/ngrok/save`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authtoken: tokenInput, claimedDomain: domainInput, autoStart: autoStartInput }),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      isDirtyRef.current = false;
      toast.success("Ngrok configuration saved");
      fetchStatus();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    }
  };

  const handleToggleOnline = async () => {
    setLoading(true);
    try {
      if (state.running) {
        // Stop
        const res = await fetch(`${LOCAL_API_BASE}/ngrok/stop`, {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to stop tunnel");
        toast.info("Ngrok tunnel stopped. Shop is now offline from internet.");
      } else {
        // Start
        if (!tokenInput.trim()) {
          toast.error("Please enter your Ngrok Auth Token first");
          setLoading(false);
          return;
        }
        const res = await fetch(`${LOCAL_API_BASE}/ngrok/start`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ authtoken: tokenInput, claimedDomain: domainInput }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to start tunnel");
        toast.success(`Online! Live at ${data.url}`);
      }
      await fetchStatus();
    } catch (err: any) {
      toast.error(err.message || "Tunnel operation failed");
    } finally {
      setLoading(false);
    }
  };

  const copyUrl = () => {
    if (state.lastUrl) {
      navigator.clipboard.writeText(state.lastUrl);
      toast.success("Live URL copied to clipboard!");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <Card className="border-blue-200 dark:border-blue-900/60 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-900/90 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-sm">
                <Globe className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  Remote Mobile Access (Embedded Ngrok)
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                  Put your PhoneZone store &amp; repair portal online without static IP or port forwarding.
                </CardDescription>
              </div>
            </div>
            <div>
              {state.running ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white px-3 py-1 text-xs gap-1.5 shadow-sm">
                  <Wifi className="h-3.5 w-3.5 animate-pulse" /> LIVE ONLINE
                </Badge>
              ) : (
                <Badge variant="outline" className="text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700 gap-1.5">
                  <WifiOff className="h-3.5 w-3.5" /> LOCAL ONLY
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Configuration & Controls */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="bg-white dark:bg-slate-900/70 border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">1. Tunnel Credentials</CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                Create a free account at{" "}
                <a
                  href="https://dashboard.ngrok.com/signup"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 dark:text-sky-400 underline font-medium"
                >
                  dashboard.ngrok.com
                </a>{" "}
                and copy your Auth Token.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="ngrok_token" className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Ngrok Auth Token *
                </Label>
                <div className="relative mt-1">
                  <Input
                    id="ngrok_token"
                    type={showToken ? "text" : "password"}
                    value={tokenInput}
                    onChange={(e) => {
                      isDirtyRef.current = true;
                      setTokenInput(e.target.value);
                    }}
                    placeholder="e.g. 2sA19x... (from ngrok dashboard)"
                    className="pr-10 font-mono text-sm bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="ngrok_domain" className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Claimed Domain (Optional)
                </Label>
                <Input
                  id="ngrok_domain"
                  type="text"
                  value={domainInput}
                  onChange={(e) => {
                    isDirtyRef.current = true;
                    setDomainInput(e.target.value.replace(/^https?:\/\//i, '').replace(/\/+$/, ''));
                  }}
                  onBlur={() => setDomainInput((prev) => prev.replace(/^https?:\/\//i, '').replace(/\/+$/, '').trim())}
                  placeholder="e.g. talented-wolf-primarily.ngrok-free.app"
                  className="font-mono text-sm mt-1 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Enter hostname only (e.g. talented-wolf-primarily.ngrok-free.app). https:// and trailing / are stripped automatically.
                </p>
              </div>

              {/* Auto-Start Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <div className="space-y-0.5">
                  <Label htmlFor="ngrok_tab_autostart" className="text-xs font-bold text-slate-800 dark:text-slate-100 cursor-pointer">
                    Auto-start Tunnel on Application Launch
                  </Label>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    PhoneZone start hote hi Ngrok tunnel automatic start ho jayega aur live URL active rahegi.
                  </p>
                </div>
                <Switch
                  id="ngrok_tab_autostart"
                  checked={autoStartInput}
                  onCheckedChange={setAutoStartInput}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  onClick={handleToggleOnline}
                  disabled={loading}
                  className={
                    state.running
                      ? "bg-rose-600 hover:bg-rose-700 text-white font-medium"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                  }
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : state.running ? (
                    <WifiOff className="h-4 w-4 mr-2" />
                  ) : (
                    <Wifi className="h-4 w-4 mr-2" />
                  )}
                  {state.running ? "Stop Online Tunnel" : "Go Online Now"}
                </Button>

                <Button variant="outline" onClick={handleSaveSettings} disabled={loading} className="border-slate-300 dark:border-slate-700">
                  Save Settings
                </Button>

                <Button variant="ghost" size="sm" onClick={fetchStatus}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
                </Button>
              </div>

              {state.error && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300">
                  <strong>Tunnel Error:</strong> {state.error}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Feature Highlights */}
          <Card className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Security &amp; Native Mobile App Experience
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-600 dark:text-slate-300 space-y-2">
              <p>
                • <strong>HTTPS Enforced:</strong> All remote traffic from mobile phones travels over TLS 1.3 encrypted tunnel.
              </p>
              <p>
                • <strong>Mobile Optimized (PWA Style):</strong> Phones accessing this URL get a touch-friendly app layout with zero horizontal overflow, quick bottom bar, and camera scanner access.
              </p>
              <p>
                • <strong>First-Run Lock:</strong> Initial admin installation can only be completed locally, preventing remote takeover.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right: Live URL & Mobile QR */}
        <div className="lg:col-span-5 space-y-6">
          <Card className={state.running ? "border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900/80 shadow-md" : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50"}>
            <CardHeader className="pb-2 text-center">
              <CardTitle className="text-base font-semibold flex items-center justify-center gap-2 text-slate-900 dark:text-white">
                <Smartphone className="h-5 w-5 text-blue-600 dark:text-cyan-400" />
                Mobile Connection QR
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                Scan with any Android / iPhone camera to open immediately
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center p-6 space-y-4">
              {state.running && qrDataUrl ? (
                <>
                  <div className="p-3 bg-white border-2 border-emerald-400 rounded-2xl shadow-sm">
                    <img src={qrDataUrl} alt="Ngrok Mobile QR" className="w-52 h-52 object-contain" />
                  </div>

                  <div className="w-full space-y-2">
                    <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700 text-center font-mono text-xs text-blue-700 dark:text-cyan-300 break-all select-all font-semibold">
                      {state.lastUrl}
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 text-xs border-slate-300 dark:border-slate-700" onClick={copyUrl}>
                        <Copy className="h-3.5 w-3.5 mr-1" /> Copy Link
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => window.open(state.lastUrl || "", "_blank")}
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-12 flex flex-col items-center text-center text-slate-400 dark:text-slate-500 space-y-3">
                  <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full">
                    <QrCode className="h-10 w-10 text-slate-400 dark:text-slate-500" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Tunnel is Offline</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                      Enter your Auth Token on the left and click &quot;Go Online Now&quot; to generate your live QR code.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

