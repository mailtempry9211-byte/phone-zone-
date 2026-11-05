import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Palette,
  Layout,
  Wrench,
  Smartphone,
  CheckCircle2,
  Sparkles,
  Layers,
  Eye,
  Plus,
  Trash2,
  Edit2,
  RotateCcw,
  Save,
  Check,
  Compass,
  Zap,
  Crown,
  Box,
  SlidersHorizontal,
  Columns,
  List,
  Camera,
  FlipHorizontal,
  Bookmark,
  Grid,
  Terminal,
  ShoppingBag,
  Radio,
  Flame,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { RepairItem, DEFAULT_REPAIR_SERVICES } from "@/lib/repairServices";
export type { RepairItem };
export { DEFAULT_REPAIR_SERVICES };

export interface HomepageConfig {
  showTrustBar: boolean;
  showHero: boolean;
  showFeatures: boolean;
  showPhones: boolean;
  showRepairs: boolean;
  showContact: boolean;
  showHours: boolean;
  phoneDisplayMode: "grid" | "carousel" | "showcase";
  heroHeadline?: string;
  heroSubheadline?: string;
}

export const HOMEPAGE_THEMES = [
  {
    id: "phonezone_signature",
    name: "01 • PhoneZone Signature",
    tagline: "Original brand-led flagship with interactive dual-intent Buy/Repair toggle & instant WhatsApp deal lock",
    icon: Store,
    accentColor: "bg-blue-600 text-white",
    previewBg: "bg-gradient-to-br from-blue-50 to-white",
    cardStyle: "border border-blue-200 bg-white shadow-md",
  },
  {
    id: "neon",
    name: "02 • Neon Glassmorphism",
    tagline: "Futuristic dark cyber tech storefront, emerald & cyan lighting, floating telemetry",
    icon: Zap,
    accentColor: "bg-cyan-500 text-black",
    previewBg: "bg-[#07090e]",
    cardStyle: "border border-cyan-500/40 bg-[#0f131f] shadow-[0_0_15px_rgba(6,182,212,0.25)] text-slate-100",
  },
  {
    id: "apple_minimal",
    name: "03 • Apple-Inspired Minimal",
    tagline: "Cupertino product-first retail, generous whitespace, charcoal typography & island bar",
    icon: Compass,
    accentColor: "bg-black text-white",
    previewBg: "bg-[#fbfbfd]",
    cardStyle: "border border-slate-200/80 bg-white shadow-xs rounded-2xl",
  },
  {
    id: "glassmorphism",
    name: "04 • Frosted Glass UI",
    tagline: "Light translucent frosted panels, floating pastel gradient orbs & interactive device selector",
    icon: Sparkles,
    accentColor: "bg-indigo-600 text-white",
    previewBg: "bg-gradient-to-br from-indigo-100 via-sky-50 to-pink-50",
    cardStyle: "border border-white/60 bg-white/70 backdrop-blur-md shadow-lg",
  },
  {
    id: "luxury",
    name: "05 • Black & Gold Luxury",
    tagline: "Matte obsidian black, brushed champagne gold highlights & atelier concierge showroom",
    icon: Crown,
    accentColor: "bg-gradient-to-r from-amber-500 to-yellow-300 text-black",
    previewBg: "bg-[#090a0d]",
    cardStyle: "border border-amber-500/30 bg-[#121319] shadow-[0_10px_25px_rgba(245,158,11,0.15)] text-amber-50",
  },
  {
    id: "bento_pro",
    name: "06 • Bento Grid Pro",
    tagline: "Modern modular bento layout, interactive feature tiles for stock, repairs, ratings & warranty",
    icon: Layers,
    accentColor: "bg-emerald-600 text-white",
    previewBg: "bg-slate-900",
    cardStyle: "border border-slate-700 bg-slate-800/90 text-white shadow-xl",
  },
  {
    id: "compact_retail",
    name: "07 • Compact Express Retail",
    tagline: "Fast POS-style dense inventory browser with category filters & rapid WhatsApp checkouts",
    icon: ShoppingBag,
    accentColor: "bg-orange-600 text-white",
    previewBg: "bg-orange-50/60",
    cardStyle: "border border-orange-200 bg-white shadow-sm",
  },
  {
    id: "brutalist",
    name: "08 • Neo-Brutalist Tech",
    tagline: "High-contrast thick black borders, bold typography, vibrant pop accents & raw hardware tags",
    icon: Terminal,
    accentColor: "bg-yellow-400 text-black border-2 border-black",
    previewBg: "bg-yellow-50",
    cardStyle: "border-2 border-black bg-white shadow-[4px_4px_0px_#000]",
  },
  {
    id: "fluid_carousel",
    name: "09 • Fluid Showcase Carousel",
    tagline: "Smooth swipeable device cards, interactive 3D phone stage & fluid touch physics",
    icon: SlidersHorizontal,
    accentColor: "bg-violet-600 text-white",
    previewBg: "bg-gradient-to-tr from-violet-950 via-slate-900 to-indigo-950",
    cardStyle: "border border-violet-500/30 bg-violet-900/40 text-violet-100 shadow-xl",
  },
  {
    id: "split_slider",
    name: "10 • Split Inspection Slider",
    tagline: "Dual split-pane hero, side-by-side device inspection & live condition grading inspector",
    icon: Radio,
    accentColor: "bg-rose-600 text-white",
    previewBg: "bg-gradient-to-r from-slate-900 to-rose-950",
    cardStyle: "border border-rose-500/30 bg-rose-950/40 text-white shadow-lg",
  },
];

const StorefrontCustomizerTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  // Active theme selection
  const [selectedTheme, setSelectedTheme] = useState<string>("modern");

  // Sections configuration
  const [config, setConfig] = useState<HomepageConfig>({
    showTrustBar: true,
    showHero: true,
    showFeatures: true,
    showPhones: true,
    showRepairs: true,
    showContact: true,
    showHours: true,
    phoneDisplayMode: "grid",
    heroHeadline: "",
    heroSubheadline: "",
  });

  // Repair services list
  const [repairs, setRepairs] = useState<RepairItem[]>(DEFAULT_REPAIR_SERVICES);

  // Edit / Add modal state
  const [editingItem, setEditingItem] = useState<RepairItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch current settings from backend
  const { data: settingsData, isLoading } = useQuery({
    queryKey: ["storefront-settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings", { credentials: "include" });
      if (!res.ok) {
        // Fallback to /config if not logged in
        const fallback = await fetch("/api/config");
        if (fallback.ok) return fallback.json();
        throw new Error("Failed to load storefront settings");
      }
      return res.json();
    },
  });

  // Populate state on load
  useEffect(() => {
    if (settingsData) {
      if (settingsData.homepageTheme) {
        setSelectedTheme(settingsData.homepageTheme);
      }
      if (settingsData.homepageConfig) {
        setConfig((prev) => ({
          ...prev,
          ...settingsData.homepageConfig,
        }));
      }
      if (Array.isArray(settingsData.repairServices) && settingsData.repairServices.length > 0) {
        const defaultIcons: Record<string, string> = {
          screen: "📱",
          battery: "🔋",
          charging: "🔌",
          software: "💻",
          water: "💧",
          general: "🔧",
        };

        setRepairs(
          settingsData.repairServices.map((r: any, idx: number) => ({
            id: r.id || `rep-${idx + 1}`,
            icon: r.icon || defaultIcons[r.id] || "📱",
            title: r.title || r.name || "Custom Repair",
            price: r.price || (r.startingFrom !== undefined ? `₹${Number(r.startingFrom).toLocaleString()}` : "₹500"),
            duration: r.duration || "30–60 mins",
            description: r.description || "Repair service with warranty",
            active: r.active !== false,
          }))
        );
      }
    }
  }, [settingsData]);

  // Handle instant theme selection & apply
  const handleSelectAndApplyTheme = async (themeId: string) => {
    setSelectedTheme(themeId);
    try {
      const payload = {
        homepage_theme: themeId,
        homepage_config: JSON.stringify(config),
      };
      let res = await fetch("/api/settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        res = await fetch("/api/settings", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      if (res.ok) {
        await queryClient.invalidateQueries({ queryKey: ["storefront-settings"] });
        await queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
        const themeObj = HOMEPAGE_THEMES.find((t) => t.id === themeId);
        toast.success(`✨ Theme "${themeObj?.name || themeId}" applied live!`);
      }
    } catch {
      // Local state is preserved
    }
  };

  // Handle saving all customizer settings
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        homepage_theme: selectedTheme,
        homepage_config: JSON.stringify(config),
        repair_services_catalog: JSON.stringify(repairs),
      };

      let res = await fetch("/api/settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        res = await fetch("/api/settings", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save settings");
      }

      await queryClient.invalidateQueries({ queryKey: ["storefront-settings"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      toast.success("Storefront theme & customization saved successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save storefront customizations");
    } finally {
      setIsSaving(false);
    }
  };

  // Repair item management
  const handleOpenAddModal = () => {
    setEditingItem({
      id: `rep-${Date.now()}`,
      icon: "📱",
      title: "",
      price: "₹",
      duration: "30–60 mins",
      description: "",
      active: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: RepairItem) => {
    setEditingItem({ ...item });
    setIsModalOpen(true);
  };

  const handleSaveModalItem = () => {
    if (!editingItem || !editingItem.title.trim()) {
      toast.error("Please enter a service title");
      return;
    }
    setRepairs((prev) => {
      const exists = prev.some((r) => r.id === editingItem.id);
      if (exists) {
        return prev.map((r) => (r.id === editingItem.id ? editingItem : r));
      }
      return [...prev, editingItem];
    });
    setIsModalOpen(false);
    setEditingItem(null);
    toast.success("Service updated in list (Click 'Save All Changes' to apply)");
  };

  const handleDeleteItem = (id: string) => {
    setRepairs((prev) => prev.filter((r) => r.id !== id));
    toast.info("Service removed from list");
  };

  const handleToggleItemActive = (id: string) => {
    setRepairs((prev) =>
      prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r))
    );
  };

  const handleResetRepairs = () => {
    setRepairs(DEFAULT_REPAIR_SERVICES);
    toast.info("Repair services reset to defaults");
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Palette className="h-6 w-6 text-blue-200" />
            <h2 className="text-xl sm:text-2xl font-bold">Homepage Theme & Storefront Customizer</h2>
          </div>
          <p className="text-blue-100 text-sm max-w-2xl">
            Personalize your store look with 5 unique design templates, toggle homepage sections, change phone showcase style, and customize repair pricing tiles.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => window.open("/", "_blank")}
            variant="secondary"
            className="bg-white/90 text-blue-900 hover:bg-white font-semibold text-xs sm:text-sm shadow-sm"
          >
            <Eye className="h-4 w-4 mr-1.5" />
            View Live Store
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs sm:text-sm shadow-md"
          >
            <Save className="h-4 w-4 mr-1.5" />
            {isSaving ? "Saving..." : "Save All Changes"}
          </Button>
        </div>
      </div>

      {/* 1. Theme Template Switcher */}
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-600" />
                Select Store Theme (10 Premium Templates)
              </CardTitle>
              <CardDescription>
                Choose the visual style that fits your brand. Each theme alters colors, typography, card borders, and buttons.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs font-semibold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700">
              Active: {HOMEPAGE_THEMES.find((t) => t.id === selectedTheme)?.name}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {HOMEPAGE_THEMES.map((theme) => {
              const Icon = theme.icon;
              const isSelected = selectedTheme === theme.id;
              return (
                <div
                  key={theme.id}
                  onClick={() => handleSelectAndApplyTheme(theme.id)}
                  className={`relative rounded-2xl p-4 cursor-pointer transition-all duration-300 border-2 ${
                    isSelected
                      ? "border-blue-600 ring-2 ring-blue-500/30 shadow-lg scale-[1.02]"
                      : "border-slate-200 hover:border-slate-300 hover:shadow-md"
                  } ${theme.previewBg} flex flex-col justify-between`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 rounded-xl bg-white/80 shadow-xs">
                        <Icon className="h-5 w-5 text-slate-800" />
                      </div>
                      {isSelected ? (
                        <span className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                          <Check className="h-3 w-3" /> Active Live
                        </span>
                      ) : (
                        <span className="text-xs text-blue-600 font-semibold hover:underline">
                          Click to apply
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-sm text-slate-900 mb-1">{theme.name}</h3>
                    <p className="text-xs text-slate-600 mb-4 line-clamp-3 leading-relaxed">
                      {theme.tagline}
                    </p>
                  </div>

                  {/* Micro Preview Card */}
                  <div className={`p-2.5 rounded-xl ${theme.cardStyle} text-xs mt-2`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-[11px]">📱 iPhone 14 Pro</span>
                      <span className="font-bold text-[11px] text-emerald-600">₹62,000</span>
                    </div>
                    <div className="flex gap-1 mt-1.5">
                      <div className={`h-4 rounded px-2 flex items-center justify-center text-[9px] font-bold ${theme.accentColor} text-white w-full`}>
                        {isSelected ? "Active On Storefront" : "Switch To This"}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 2. Homepage Sections & Phone Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sections Visibility */}
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Layers className="h-5 w-5 text-blue-600" />
              Homepage Sections Visibility
            </CardTitle>
            <CardDescription>
              Toggle specific sections on or off to customize what your customers see.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
              <div>
                <Label className="font-semibold text-sm cursor-pointer">Top Trust Bar</Label>
                <p className="text-xs text-slate-500">Udyam Registration and Google Business Reviews banner</p>
              </div>
              <Switch
                checked={config.showTrustBar}
                onCheckedChange={(val) => setConfig((prev) => ({ ...prev, showTrustBar: val }))}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
              <div>
                <Label className="font-semibold text-sm cursor-pointer">Hero Section</Label>
                <p className="text-xs text-slate-500">Business Logo, Welcome Heading, and Action Buttons</p>
              </div>
              <Switch
                checked={config.showHero}
                onCheckedChange={(val) => setConfig((prev) => ({ ...prev, showHero: val }))}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
              <div>
                <Label className="font-semibold text-sm cursor-pointer">Why Choose Us</Label>
                <p className="text-xs text-slate-500">3 value proposition cards: Quality, Quick Service & Best Prices</p>
              </div>
              <Switch
                checked={config.showFeatures}
                onCheckedChange={(val) => setConfig((prev) => ({ ...prev, showFeatures: val }))}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
              <div>
                <Label className="font-semibold text-sm cursor-pointer">Featured Phones</Label>
                <p className="text-xs text-slate-500">Live inventory phones available for purchase</p>
              </div>
              <Switch
                checked={config.showPhones}
                onCheckedChange={(val) => setConfig((prev) => ({ ...prev, showPhones: val }))}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
              <div>
                <Label className="font-semibold text-sm cursor-pointer">Repair Services Catalog</Label>
                <p className="text-xs text-slate-500">Customizable repair services and instant booking tiles</p>
              </div>
              <Switch
                checked={config.showRepairs}
                onCheckedChange={(val) => setConfig((prev) => ({ ...prev, showRepairs: val }))}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
              <div>
                <Label className="font-semibold text-sm cursor-pointer">Contact &amp; Business Hours</Label>
                <p className="text-xs text-slate-500">Contact form, phone, Instagram, and store opening timings</p>
              </div>
              <Switch
                checked={config.showContact}
                onCheckedChange={(val) => setConfig((prev) => ({ ...prev, showContact: val }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Phone Display Style & Hero Text */}
        <Card className="border shadow-sm flex flex-col justify-between">
          <div>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-indigo-600" />
                Featured Phones Display Mode
              </CardTitle>
              <CardDescription>
                Choose how second-hand phones are arranged on the storefront.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-[380px] overflow-y-auto p-1.5 scrollbar-thin rounded-xl bg-slate-50/80 border">
                {[
                  { id: "grid", name: "Responsive Grid", desc: "Classic 2–6 card columns with hover lift", icon: Layout },
                  { id: "carousel", name: "Fluid Carousel", desc: "Horizontal scroll strip with arrows", icon: SlidersHorizontal },
                  { id: "showcase", name: "Luxury Showcase", desc: "Wide spotlight presentation cards", icon: Crown },
                  { id: "bento", name: "Bento Interactive", desc: "Featured deal spotlight + 4 deal tiles", icon: Layers },
                  { id: "masonry", name: "Dynamic Masonry", desc: "Pinterest-style staggered height cards", icon: Columns },
                  { id: "list_compact", name: "Dense List Table", desc: "Fast-scanning catalog rows with instant buy", icon: List },
                  { id: "polaroid", name: "Retro Polaroid", desc: "Vintage snapshots with white frame & tilt", icon: Camera },
                  { id: "cards_3d", name: "3D Perspective Tilt", desc: "Interactive depth tilt & flip on hover", icon: FlipHorizontal },
                  { id: "minimal_strip", name: "Minimal Ticker", desc: "Clean luxury text & photo bar", icon: Bookmark },
                  { id: "magazine", name: "Editorial Lookbook", desc: "Full-bleed magazine fashion cards", icon: Flame },
                  { id: "cyber_feed", name: "Futuristic HUD", desc: "Terminal readout with bracketed corners", icon: Terminal },
                  { id: "split_slider", name: "Split Focus Slider", desc: "Hero spotlight left, thumbnails right", icon: Radio },
                ].map((mode) => {
                  const Icon = mode.icon;
                  const isCurrent = config.phoneDisplayMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={async () => {
                        const newConfig = { ...config, phoneDisplayMode: mode.id as any };
                        setConfig(newConfig);
                        try {
                          await fetch("/api/settings", {
                            method: "PUT",
                            credentials: "include",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ homepage_config: JSON.stringify(newConfig) }),
                          });
                          await queryClient.invalidateQueries({ queryKey: ["storefront-settings"] });
                          toast.success(`✨ Phone listing style: ${mode.name} applied live!`);
                        } catch {}
                      }}
                      className={`p-2.5 rounded-xl border-2 text-left flex flex-col justify-between transition-all ${
                        isCurrent
                          ? "border-blue-600 bg-blue-50/90 shadow-sm ring-1 ring-blue-500/30 scale-[1.02]"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <Icon className={`h-4 w-4 ${isCurrent ? "text-blue-600" : "text-slate-600"}`} />
                        {isCurrent && <span className="h-2 w-2 rounded-full bg-blue-600" />}
                      </div>
                      <div>
                        <p className="font-bold text-[11px] sm:text-xs text-slate-900 leading-tight">{mode.name}</p>
                        <p className="text-[10px] text-slate-500 leading-tight mt-0.5 line-clamp-2">{mode.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Custom Hero Subtext */}
              <div className="pt-4 border-t space-y-3">
                <div>
                  <Label htmlFor="heroHeadline" className="text-xs font-semibold">
                    Custom Hero Welcome Tag (Optional)
                  </Label>
                  <Input
                    id="heroHeadline"
                    placeholder="e.g. Best Deals on Pre-Owned Phones &amp; Repairs"
                    value={config.heroHeadline || ""}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, heroHeadline: e.target.value }))
                    }
                    className="mt-1 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="heroSubheadline" className="text-xs font-semibold">
                    Custom Store Subtitle / Pitch (Optional)
                  </Label>
                  <Input
                    id="heroSubheadline"
                    placeholder="e.g. Thoroughly tested devices, 100% genuine parts, transparent pricing."
                    value={config.heroSubheadline || ""}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, heroSubheadline: e.target.value }))
                    }
                    className="mt-1 text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </div>

          <div className="p-4 bg-slate-50 border-t rounded-b-xl flex items-center justify-between text-xs text-slate-600">
            <span>Changes persist on SQLite &amp; Supabase automatically.</span>
            <Button size="sm" onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
              <Save className="h-3.5 w-3.5 mr-1" /> Save
            </Button>
          </div>
        </Card>
      </div>

      {/* 3. Repair Services Catalog Manager */}
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Wrench className="h-5 w-5 text-indigo-600" />
                Repair Services Tiles Customization
              </CardTitle>
              <CardDescription>
                Add, edit prices, icons, or toggle repair tiles that customers see on your homepage.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetRepairs}
                className="text-xs text-slate-600 hover:text-slate-900"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Reset Defaults
              </Button>
              <Button
                size="sm"
                onClick={handleOpenAddModal}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add New Service
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {repairs.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-xl border transition-all ${
                  item.active
                    ? "bg-white border-slate-200 shadow-xs hover:shadow-md"
                    : "bg-slate-50 border-dashed border-slate-300 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{item.icon}</span>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{item.title}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-bold text-emerald-600">{item.price}</span>
                        <span className="text-[11px] text-slate-400">• {item.duration}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-500 hover:text-blue-600"
                      onClick={() => handleOpenEditModal(item)}
                      title="Edit Service"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-red-600"
                      onClick={() => handleDeleteItem(item.id)}
                      title="Delete Service"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-slate-600 line-clamp-2 mb-3">{item.description}</p>

                <div className="flex items-center justify-between pt-2 border-t text-xs">
                  <span className="text-slate-500 text-[11px]">
                    {item.active ? "Visible on Storefront" : "Hidden from Storefront"}
                  </span>
                  <Switch
                    checked={item.active}
                    onCheckedChange={() => handleToggleItemActive(item.id)}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save All Storefront Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Edit / Add Service Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem?.title ? "Edit Repair Service" : "Add Repair Service"}
            </DialogTitle>
            <DialogDescription>
              Customize the title, price, estimated repair duration, and icon.
            </DialogDescription>
          </DialogHeader>

          {editingItem && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-1">
                  <Label htmlFor="itemIcon" className="text-xs font-semibold">Icon</Label>
                  <Input
                    id="itemIcon"
                    value={editingItem.icon}
                    onChange={(e) =>
                      setEditingItem((prev) => prev ? { ...prev, icon: e.target.value } : null)
                    }
                    placeholder="📱"
                    className="text-center text-xl mt-1"
                  />
                </div>
                <div className="col-span-3">
                  <Label htmlFor="itemTitle" className="text-xs font-semibold">Service Name</Label>
                  <Input
                    id="itemTitle"
                    value={editingItem.title}
                    onChange={(e) =>
                      setEditingItem((prev) => prev ? { ...prev, title: e.target.value } : null)
                    }
                    placeholder="e.g. Screen Replacement"
                    className="mt-1 text-sm font-medium"
                  />
                </div>
              </div>

              {/* Quick emoji picker bar */}
              <div className="flex gap-2 p-1.5 bg-slate-100 rounded-lg">
                {["📱", "🔋", "🔌", "💻", "💧", "🔧", "📷", "🔊", "⚡", "🛡️"].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() =>
                      setEditingItem((prev) => prev ? { ...prev, icon: emoji } : null)
                    }
                    className="text-base p-1 hover:bg-white rounded transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="itemPrice" className="text-xs font-semibold">Price (₹)</Label>
                  <Input
                    id="itemPrice"
                    value={editingItem.price}
                    onChange={(e) =>
                      setEditingItem((prev) => prev ? { ...prev, price: e.target.value } : null)
                    }
                    placeholder="₹1,500"
                    className="mt-1 text-sm font-bold text-emerald-700"
                  />
                </div>
                <div>
                  <Label htmlFor="itemDuration" className="text-xs font-semibold">Duration</Label>
                  <Input
                    id="itemDuration"
                    value={editingItem.duration}
                    onChange={(e) =>
                      setEditingItem((prev) => prev ? { ...prev, duration: e.target.value } : null)
                    }
                    placeholder="30–60 mins"
                    className="mt-1 text-sm"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="itemDesc" className="text-xs font-semibold">Description</Label>
                <Input
                  id="itemDesc"
                  value={editingItem.description}
                  onChange={(e) =>
                    setEditingItem((prev) => prev ? { ...prev, description: e.target.value } : null)
                  }
                  placeholder="e.g. Original high-quality OLED screen replacement with warranty"
                  className="mt-1 text-sm"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border">
                <div>
                  <Label className="font-semibold text-xs">Active on Homepage</Label>
                  <p className="text-[11px] text-slate-500">Enable to display this tile</p>
                </div>
                <Switch
                  checked={editingItem.active}
                  onCheckedChange={(val) =>
                    setEditingItem((prev) => prev ? { ...prev, active: val } : null)
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveModalItem} className="bg-blue-600 hover:bg-blue-700 text-white">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StorefrontCustomizerTab;

