import React, { useState, useRef } from "react";
import {
  Smartphone,
  RotateCw,
  Maximize2,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  DollarSign,
  Package,
  Wrench,
  Users,
  Store,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DevicePreset {
  id: string;
  name: string;
  width: number;
  height: number;
  type: "ios" | "android";
}

const PRESETS: DevicePreset[] = [
  { id: "iphone-15-pro", name: "iPhone 15 Pro", width: 393, height: 852, type: "ios" },
  { id: "galaxy-s24", name: "Galaxy S24", width: 412, height: 915, type: "android" },
  { id: "compact-android", name: "Compact Phone (360px)", width: 360, height: 780, type: "android" },
  { id: "pixel-8", name: "Pixel 8", width: 412, height: 892, type: "android" },
];

export const MobileEmulator: React.FC = () => {
  const [selectedPreset, setSelectedPreset] = useState<DevicePreset>(PRESETS[0]);
  const [isLandscape, setIsLandscape] = useState(false);
  const [scale, setScale] = useState(0.9);
  const [currentUrl, setCurrentUrl] = useState("/?admin=1&tab=dashboard");
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const activeWidth = isLandscape ? selectedPreset.height : selectedPreset.width;
  const activeHeight = isLandscape ? selectedPreset.width : selectedPreset.height;

  const navigateTo = (url: string) => {
    setCurrentUrl(url);
    if (iframeRef.current) {
      iframeRef.current.src = url;
    }
  };

  const reloadIframe = () => {
    setIframeKey((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      {/* Top Controller Bar */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/90 backdrop-blur px-4 flex items-center justify-between gap-4 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-bold text-sm text-cyan-400">
            <Smartphone className="h-5 w-5" />
            <span>PhoneZone Real Device Simulator</span>
          </div>
          <Badge variant="outline" className="bg-cyan-950/60 text-cyan-300 border-cyan-800 text-[10px]">
            Live Interactive Viewport
          </Badge>
        </div>

        {/* Preset Selectors */}
        <div className="hidden md:flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => setSelectedPreset(preset)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                selectedPreset.id === preset.id
                  ? "bg-cyan-500 text-slate-950 shadow-sm font-bold"
                  : "text-slate-300 hover:text-white hover:bg-slate-700/60"
              }`}
            >
              {preset.name}
            </button>
          ))}
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-2">
          {/* Rotate Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsLandscape(!isLandscape)}
            className="h-8 text-xs border-slate-700 hover:bg-slate-800 text-slate-200 gap-1.5"
            title="Rotate Device"
          >
            <RotateCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{isLandscape ? "Landscape" : "Portrait"}</span>
          </Button>

          {/* Scale Select */}
          <div className="flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700 text-xs">
            <span className="text-slate-400 text-[10px]">Zoom:</span>
            {[0.8, 0.9, 1.0].map((s) => (
              <button
                key={s}
                onClick={() => setScale(s)}
                className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                  scale === s ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-white"
                }`}
              >
                {Math.round(s * 100)}%
              </button>
            ))}
          </div>

          {/* Reload Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={reloadIframe}
            className="h-8 w-8 p-0 border-slate-700 hover:bg-slate-800 text-slate-200"
            title="Reload Screen"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>

          {/* Open Raw in New Tab */}
          <a
            href={currentUrl}
            target="_blank"
            rel="noreferrer"
            className="h-8 px-2.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-200 text-xs flex items-center gap-1 font-semibold"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Direct Link</span>
          </a>
        </div>
      </header>

      {/* Quick Navigation Drawer Strip */}
      <div className="h-10 bg-slate-900 border-b border-slate-800/80 px-4 flex items-center gap-2 overflow-x-auto text-xs shrink-0 scrollbar-none">
        <span className="text-slate-500 text-[11px] uppercase font-bold shrink-0">Quick Jump:</span>
        <button
          onClick={() => navigateTo("/?admin=1&tab=dashboard")}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold shrink-0 transition-colors ${
            currentUrl.includes("tab=dashboard")
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          <LayoutDashboard className="h-3.5 w-3.5" />
          Live Dashboard
        </button>

        <button
          onClick={() => navigateTo("/?admin=1&tab=accounting")}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold shrink-0 transition-colors ${
            currentUrl.includes("tab=accounting")
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
          Accounting & Daybook
        </button>

        <button
          onClick={() => navigateTo("/?admin=1&tab=inventory")}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold shrink-0 transition-colors ${
            currentUrl.includes("tab=inventory")
              ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          <Package className="h-3.5 w-3.5 text-blue-400" />
          Inventory Stock
        </button>

        <button
          onClick={() => navigateTo("/?admin=1&tab=sold")}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold shrink-0 transition-colors ${
            currentUrl.includes("tab=sold")
              ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400" />
          Sold Handsets
        </button>

        <button
          onClick={() => navigateTo("/?admin=1&tab=repairs")}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold shrink-0 transition-colors ${
            currentUrl.includes("tab=repairs")
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          <Wrench className="h-3.5 w-3.5 text-amber-400" />
          Repair Workshop
        </button>

        <button
          onClick={() => navigateTo("/?admin=1&tab=customers")}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold shrink-0 transition-colors ${
            currentUrl.includes("tab=customers")
              ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          <Users className="h-3.5 w-3.5 text-purple-400" />
          Customers
        </button>

        <button
          onClick={() => navigateTo("/")}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold shrink-0 transition-colors ${
            currentUrl === "/"
              ? "bg-teal-500/20 text-teal-300 border border-teal-500/40"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          <Store className="h-3.5 w-3.5 text-teal-400" />
          Storefront Home
        </button>
      </div>

      {/* Main Emulator Stage */}
      <main className="flex-1 overflow-auto flex items-center justify-center p-4 sm:p-8 relative bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
        {/* Phone Chassis Container */}
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "center center",
            transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          className="relative shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_0_12px_#1e293b,0_0_0_14px_#334155] rounded-[52px] p-3 bg-slate-900 border border-slate-700"
        >
          {/* Top Speaker / Dynamic Island */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center">
            <div className="w-24 h-5 bg-black rounded-full flex items-center justify-end px-3">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-800" />
            </div>
          </div>

          {/* Screen Bezel and Iframe Screen */}
          <div
            style={{
              width: `${activeWidth}px`,
              height: `${activeHeight}px`,
            }}
            className="relative rounded-[42px] overflow-hidden bg-black shadow-inner"
          >
            <iframe
              key={iframeKey}
              ref={iframeRef}
              src={currentUrl}
              title="Mobile Device Screen"
              className="w-full h-full border-0 select-auto"
            />
          </div>

          {/* Bottom Home Indicator Bar */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-32 h-1 bg-slate-600 rounded-full opacity-60 z-30 pointer-events-none" />
        </div>
      </main>

      {/* Bottom Status Footer */}
      <footer className="h-8 border-t border-slate-800/80 bg-slate-900 px-4 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
        <div>
          Current Viewport: <strong className="text-slate-200">{activeWidth} × {activeHeight} px</strong> ({selectedPreset.name})
        </div>
        <div>
          URL: <code className="text-cyan-400 font-mono">{currentUrl}</code>
        </div>
      </footer>
    </div>
  );
};

export default MobileEmulator;
