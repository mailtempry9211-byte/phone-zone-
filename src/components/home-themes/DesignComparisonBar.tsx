import React, { useState } from "react";
import { ThemeDesignId } from "./types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Palette,
  Eye,
  Check,
  RotateCcw,
  Monitor,
  Tablet,
  Smartphone,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Sparkles,
  Zap,
  Crown,
  Compass,
  Layers,
  Store,
  ShoppingBag,
  Terminal,
  Radio,
} from "lucide-react";
import { toast } from "sonner";

export interface DesignComparisonBarProps {
  activeTheme: ThemeDesignId;
  publishedTheme: ThemeDesignId;
  onSelectTheme: (themeId: ThemeDesignId) => void;
  onPublishTheme: (themeId: ThemeDesignId) => Promise<void>;
  onExitPreview: () => void;
  viewportMode: "desktop" | "tablet" | "mobile";
  onChangeViewport: (mode: "desktop" | "tablet" | "mobile") => void;
  onOpenAdminCustomizer: () => void;
  isPublishing?: boolean;
}

export const THEME_OPTIONS: Array<{
  id: ThemeDesignId;
  name: string;
  subtitle: string;
  tag: string;
  icon: any;
  colorClass: string;
}> = [
  {
    id: "phonezone_signature",
    name: "01 • PZ Signature",
    subtitle: "Brand-led flagship, interactive dual-intent buy/repair hero",
    tag: "FLAGSHIP",
    icon: Store,
    colorClass: "from-blue-600 to-indigo-600 text-white",
  },
  {
    id: "neon",
    name: "02 • Neon Glass",
    subtitle: "Cyber matrix, dark glowing borders, HUD telemetry",
    tag: "FUTURISTIC",
    icon: Zap,
    colorClass: "from-cyan-500 to-emerald-400 text-black",
  },
  {
    id: "apple_minimal",
    name: "03 • Apple Minimal",
    subtitle: "Cupertino product-first, generous whitespace, charcoal typography",
    tag: "MINIMALIST",
    icon: Compass,
    colorClass: "from-slate-800 to-black text-white",
  },
  {
    id: "glassmorphism",
    name: "04 • Frosted Glass",
    subtitle: "Translucent glass panels, ambient pastel gradient orbs",
    tag: "AERO LIGHT",
    icon: Sparkles,
    colorClass: "from-indigo-600 to-sky-500 text-white",
  },
  {
    id: "luxury",
    name: "05 • Black & Gold",
    subtitle: "Matte obsidian, brushed champagne gold, atelier showroom",
    tag: "LUXURY VIP",
    icon: Crown,
    colorClass: "from-amber-500 to-yellow-300 text-black",
  },
  {
    id: "bento_pro",
    name: "06 • Bento Pro",
    subtitle: "Modular grid cards, telemetry widgets, warranty badges",
    tag: "BENTO GRID",
    icon: Layers,
    colorClass: "from-emerald-600 to-teal-500 text-white",
  },
  {
    id: "compact_retail",
    name: "07 • Compact Retail",
    subtitle: "Fast POS-style dense inventory with category filters",
    tag: "EXPRESS POS",
    icon: ShoppingBag,
    colorClass: "from-orange-600 to-amber-500 text-white",
  },
  {
    id: "brutalist",
    name: "08 • Brutalist",
    subtitle: "High-contrast thick black borders, raw monospace badges",
    tag: "NEO BRUTAL",
    icon: Terminal,
    colorClass: "from-yellow-400 to-yellow-500 text-black",
  },
  {
    id: "fluid_carousel",
    name: "09 • Fluid Carousel",
    subtitle: "Touch swipe physics, 3D device stage, live phone cards",
    tag: "FLUID STAGE",
    icon: SlidersHorizontal,
    colorClass: "from-violet-600 to-fuchsia-500 text-white",
  },
  {
    id: "split_slider",
    name: "10 • Split Slider",
    subtitle: "Dual-pane split inspection stage & side-by-side spec sheet",
    tag: "INSPECTION",
    icon: Radio,
    colorClass: "from-teal-500 to-cyan-500 text-slate-950",
  },
];

export const DesignComparisonBar: React.FC<DesignComparisonBarProps> = ({
  activeTheme,
  publishedTheme,
  onSelectTheme,
  onPublishTheme,
  onExitPreview,
  viewportMode,
  onChangeViewport,
  onOpenAdminCustomizer,
  isPublishing = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isLive = activeTheme === publishedTheme;

  return (
    <aside aria-label="Storefront Theme Switcher" className="sticky top-0 z-50 w-full bg-[#0a0d14]/95 backdrop-blur-xl border-b border-white/10 shadow-[0_10px_35px_rgba(0,0,0,0.5)] text-white select-none transition-all duration-300">
      {/* Top Bar Header */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 flex items-center justify-between gap-3">
        {/* Left: Studio Branding & Status */}
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-xs">
            <Palette className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs tracking-wider uppercase text-slate-200">
                PHONEZONE DESIGN STUDIO
              </span>
              {isLive ? (
                <Badge className="bg-emerald-950 text-emerald-400 border-emerald-500/40 text-[10px] font-mono py-0 h-4">
                  LIVE STOREFRONT
                </Badge>
              ) : (
                <Badge className="bg-amber-950 text-amber-300 border-amber-500/40 text-[10px] font-mono py-0 h-4 animate-pulse">
                  PREVIEWING UNSAVED
                </Badge>
              )}
            </div>
            <p className="hidden sm:block text-[10px] text-slate-400">
              5 completely distinct structural layouts with live inventory &amp; real animations
            </p>
          </div>
        </div>

        {/* Middle: Viewport Switcher Controls */}
        <div className="hidden lg:flex items-center gap-1 bg-[#131826] p-1 rounded-xl border border-white/10 text-xs">
          <button
            onClick={() => onChangeViewport("desktop")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
              viewportMode === "desktop"
                ? "bg-blue-600 text-white font-semibold shadow-xs"
                : "text-slate-400 hover:text-white"
            }`}
            title="Desktop 100% Full Viewport"
          >
            <Monitor className="h-3.5 w-3.5" />
            <span>Desktop</span>
          </button>
          <button
            onClick={() => onChangeViewport("tablet")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
              viewportMode === "tablet"
                ? "bg-blue-600 text-white font-semibold shadow-xs"
                : "text-slate-400 hover:text-white"
            }`}
            title="Simulated Tablet 768px Frame"
          >
            <Tablet className="h-3.5 w-3.5" />
            <span>Tablet (768px)</span>
          </button>
          <button
            onClick={() => onChangeViewport("mobile")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
              viewportMode === "mobile"
                ? "bg-blue-600 text-white font-semibold shadow-xs"
                : "text-slate-400 hover:text-white"
            }`}
            title="Simulated Mobile 390px Frame"
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span>Mobile (390px)</span>
          </button>
        </div>

        {/* Right Actions: Apply/Publish & Collapse */}
        <div className="flex items-center gap-2">
          {!isLive && (
            <Button
              size="sm"
              variant="outline"
              onClick={onExitPreview}
              className="border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs h-7 sm:h-8 px-2.5"
            >
              <RotateCcw className="h-3 w-3 sm:mr-1" />
              <span className="hidden sm:inline">Revert</span>
            </Button>
          )}

          <Button
            size="sm"
            disabled={isLive || isPublishing}
            onClick={() => onPublishTheme(activeTheme)}
            className={`text-xs font-bold h-7 sm:h-8 px-3 transition-all ${
              isLive
                ? "bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 cursor-default"
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 active:scale-95"
            }`}
          >
            <Check className="h-3.5 w-3.5 mr-1" />
            <span>{isLive ? "Active Live" : isPublishing ? "Publishing..." : "Apply & Publish"}</span>
          </Button>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            title={isCollapsed ? "Expand Design Bar" : "Collapse Design Bar"}
          >
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Theme Selection Strip */}
      {!isCollapsed && (
        <div className="border-t border-white/10 bg-[#07090f]/90 py-2.5 px-3 sm:px-6">
          <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1 hidden sm:inline">
              SELECT DESIGN:
            </span>

            {THEME_OPTIONS.map((theme) => {
              const Icon = theme.icon;
              const isSelected = activeTheme === theme.id;
              const isCurrentPublished = publishedTheme === theme.id;

              return (
                <button
                  key={theme.id}
                  onClick={() => onSelectTheme(theme.id)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-left border shrink-0 transition-all duration-200 ${
                    isSelected
                      ? "bg-gradient-to-r from-blue-900/60 to-indigo-900/60 border-cyan-400/70 shadow-[0_0_20px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/50"
                      : "bg-[#111624] border-white/10 hover:border-white/30 text-slate-300 hover:bg-[#161d30]"
                  }`}
                >
                  <div
                    className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 bg-gradient-to-tr ${theme.colorClass}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white tracking-tight">{theme.name}</span>
                      {isCurrentPublished && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Published" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 block font-mono">{theme.tag}</span>
                  </div>
                </button>
              );
            })}

            <Button
              size="sm"
              variant="ghost"
              onClick={onOpenAdminCustomizer}
              className="text-slate-400 hover:text-white text-xs h-9 px-2.5 shrink-0 ml-auto"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
              Customizer
            </Button>
          </div>
        </div>
      )}
    </aside>
  );
};

