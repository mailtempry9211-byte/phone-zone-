import React from "react";
import { Sparkles, Moon, Sun, Layers, ShieldCheck, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";

export type DashboardStyle = "glass" | "darkteal";
export type DarkTealMode = "dark" | "light";

export interface DashboardPrefs {
  style: DashboardStyle;
  mode: DarkTealMode;
  reduceMotion: boolean;
}

const DEFAULT_PREFS: DashboardPrefs = {
  style: "glass",
  mode: "dark",
  reduceMotion: false,
};

const STORAGE_KEY = "phonezone.dashboard.prefs";

export function loadDashboardPrefs(): DashboardPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    return {
      style: parsed.style === "darkteal" ? "darkteal" : "glass",
      mode: parsed.mode === "light" ? "light" : "dark",
      reduceMotion: Boolean(parsed.reduceMotion),
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function saveDashboardPrefs(prefs: DashboardPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota
  }
}

interface StyleSwitchProps {
  prefs: DashboardPrefs;
  onChangePrefs: (next: DashboardPrefs) => void;
  themeMode?: "dark" | "light";
  onToggleThemeMode?: () => void;
}

export const StyleSwitch: React.FC<StyleSwitchProps> = ({
  prefs,
  onChangePrefs,
  themeMode,
  onToggleThemeMode,
}) => {
  const currentMode = themeMode || prefs.mode;
  const isLight = currentMode === "light";

  const setStyle = (style: DashboardStyle) => {
    const updated = { ...prefs, style };
    saveDashboardPrefs(updated);
    onChangePrefs(updated);
  };

  const handleToggleMode = () => {
    if (onToggleThemeMode) {
      onToggleThemeMode();
    }
    const nextMode = currentMode === "dark" ? "light" : "dark";
    const updated: DashboardPrefs = {
      ...prefs,
      mode: nextMode,
    };
    saveDashboardPrefs(updated);
    onChangePrefs(updated);
  };

  const toggleMotion = () => {
    const updated: DashboardPrefs = {
      ...prefs,
      reduceMotion: !prefs.reduceMotion,
    };
    saveDashboardPrefs(updated);
    onChangePrefs(updated);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Quick Visual Style Segmented Control */}
      <div className={`inline-flex p-1 rounded-xl backdrop-blur-md border text-xs font-medium ${
        isLight ? "bg-slate-200/80 border-slate-300" : "bg-black/40 border-white/10"
      }`}>
        <button
          onClick={() => setStyle("glass")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
            prefs.style === "glass"
              ? isLight
                ? "bg-white text-slate-900 shadow-sm font-bold"
                : "bg-white/20 text-white shadow-xs font-semibold backdrop-blur-sm"
              : isLight
              ? "text-slate-600 hover:text-slate-900"
              : "text-slate-400 hover:text-slate-200"
          }`}
          title="Frosted Glass UI (REF_1)"
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          <span>Glass</span>
        </button>

        <button
          onClick={() => setStyle("darkteal")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
            prefs.style === "darkteal"
              ? "bg-teal-500 text-slate-950 shadow-xs font-bold"
              : isLight
              ? "text-slate-600 hover:text-slate-900"
              : "text-slate-400 hover:text-slate-200"
          }`}
          title="Dark Teal Moorly Style (REF_2)"
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Dark Teal</span>
        </button>
      </div>

      {/* Synchronized Dark / Light Mode Toggle Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleToggleMode}
        className={`h-9 px-3 rounded-xl border flex items-center gap-1.5 font-bold text-xs transition-colors ${
          isLight
            ? "bg-white border-slate-300 text-slate-800 hover:bg-slate-50 shadow-sm"
            : "bg-black/30 border-white/10 text-slate-200 hover:text-white hover:bg-white/10"
        }`}
        title={`Click to switch to ${isLight ? "Dark Mode" : "Light Mode"} (Syncs with Admin & Control Panel)`}
      >
        {isLight ? (
          <>
            <Moon className="h-3.5 w-3.5 text-indigo-600" />
            <span>Dark Mode</span>
          </>
        ) : (
          <>
            <Sun className="h-3.5 w-3.5 text-amber-300" />
            <span>Light Mode</span>
          </>
        )}
      </Button>

      {/* Additional Preferences Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 rounded-xl text-slate-400 hover:text-white"
            title="Dashboard Settings & Animation Controls"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-slate-900 border-slate-800 text-slate-100">
          <DropdownMenuLabel className="text-xs font-mono text-slate-400 uppercase tracking-wider">
            Dashboard Style
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => setStyle("glass")}
            className="cursor-pointer flex items-center justify-between"
          >
            <span>Glass Studio (REF_1)</span>
            {prefs.style === "glass" && <span className="text-amber-400 text-xs font-bold">ACTIVE</span>}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setStyle("darkteal")}
            className="cursor-pointer flex items-center justify-between"
          >
            <span>Dark Teal Moorly (REF_2)</span>
            {prefs.style === "darkteal" && <span className="text-teal-400 text-xs font-bold">ACTIVE</span>}
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-slate-800" />

          <div className="px-2 py-2 flex items-center justify-between">
            <span className="text-xs text-slate-300">Reduce Animations</span>
            <Switch checked={prefs.reduceMotion} onCheckedChange={toggleMotion} />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

