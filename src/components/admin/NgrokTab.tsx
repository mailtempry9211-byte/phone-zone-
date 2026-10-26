import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { LOCAL_API_BASE } from "@/lib/data/config";

interface NgrokState {
  authtoken: string;
  claimedDomain: string;
  isEnabled: boolean;
  lastUrl: string | null;
  running: boolean;
  error: string | null;
}

export default function NgrokTab() {
  const [state, setState] = useState<NgrokState>({
    authtoken: "",
    claimedDomain: "",
    isEnabled: false,
    lastUrl: null,
    running: false,
    error: null,
  });
  const [tokenInput, setTokenInput] = useState("");
  const [domainInput, setDomainInput] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${LOCAL_API_BASE}/ngrok/status`, { credentials: "include" });
      if (res.ok) {
        const data: NgrokState = await res.json();
        setState(data);
        setTokenInput(data.authtoken || "");
        setDomainInput(data.claimedDomain || "");

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
        body: JSON.stringify({ authtoken: tokenInput, claimedDomain: domainInput }),
      });
      if (!res.ok) throw new Error("Failed to save settings");
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
      <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-sm">
                <Globe className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-lg sm:text-xl font-bold text-gray-900">
                  Remote Mobile Access (Embedded Ngrok)
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-gray-600">
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
                <Badge variant="outline" className="text-gray-500 border-gray-300 gap-1.5">
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
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">1. Tunnel Credentials</CardTitle>
              <CardDescription className="text-xs text-gray-500">
                Create a free account at{" "}
                <a
                  href="https://dashboard.ngrok.com/signup"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 underline font-medium"
                >
                  dashboard.ngrok.com
                </a>{" "}
                and copy your Auth Token.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="ngrok_token" className="text-xs font-semibold">
                  Ngrok Auth Token *
                </Label>
                <div className="relative mt-1">
                  <Input
                    id="ngrok_token"
                    type={showToken ? "text" : "password"}
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="e.g. 2sA19x... (from ngrok dashboard)"
                    className="pr-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="ngrok_domain" className="text-xs font-semibold">
                  Claimed Domain (Optional)
                </Label>
                <Input
                  id="ngrok_domain"
                  type="text"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value.replace(/^https?:\/\//i, '').replace(/\/+$/, ''))}
                  onBlur={() => setDomainInput((prev) => prev.replace(/^https?:\/\//i, '').replace(/\/+$/, '').trim())}
                  placeholder="e.g. talented-wolf-primarily.ngrok-free.app"
                  className="font-mono text-sm mt-1"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Enter hostname only (e.g. talented-wolf-primarily.ngrok-free.app). https:// and trailing / are stripped automatically.
                </p>
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

                <Button variant="outline" onClick={handleSaveSettings} disabled={loading}>
                  Save Settings
                </Button>

                <Button variant="ghost" size="sm" onClick={fetchStatus}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
                </Button>
              </div>

              {state.error && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  <strong>Tunnel Error:</strong> {state.error}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Feature Highlights */}
          <Card className="bg-slate-50 border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Security &amp; Native Mobile App Experience
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-gray-600 space-y-2">
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
          <Card className={state.running ? "border-emerald-300 bg-white shadow-md" : "border-gray-200 bg-gray-50"}>
            <CardHeader className="pb-2 text-center">
              <CardTitle className="text-base font-semibold flex items-center justify-center gap-2">
                <Smartphone className="h-5 w-5 text-blue-600" />
                Mobile Connection QR
              </CardTitle>
              <CardDescription className="text-xs">
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
                    <div className="p-2.5 bg-slate-100 rounded-lg border text-center font-mono text-xs text-blue-700 break-all select-all font-semibold">
                      {state.lastUrl}
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={copyUrl}>
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
                <div className="py-12 flex flex-col items-center text-center text-gray-400 space-y-3">
                  <div className="p-4 bg-gray-100 rounded-full">
                    <QrCode className="h-10 w-10 text-gray-400" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-600">Tunnel is Offline</p>
                    <p className="text-xs text-gray-400 max-w-xs">
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

