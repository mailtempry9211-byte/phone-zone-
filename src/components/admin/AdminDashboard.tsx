import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { data } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import InventoryTab from "./InventoryTab";
import SoldTab from "./SoldTab";
import CustomersTab from "./CustomersTab";
import SellersTab from "./SellersTab";
import DealersTab from "./DealersTab";
import MessagesTab from "./MessagesTab";
import AccountingTab from "./AccountingTab";
import DatabaseTab from "./DatabaseTab";
import SettingsTab from "./SettingsTab";
import ReturnsTab from "./ReturnsTab";
import StorageTab from "./StorageTab";
import RepairsTab from "./RepairsTab";
import MarketingTab from "./MarketingTab";
import UsersTab from "./UsersTab";
import NgrokTab from "./NgrokTab";
import StorefrontCustomizerTab from "./StorefrontCustomizerTab";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useFinancialYear } from "@/hooks/useFinancialYear";
import UniversalScanner from "./UniversalScanner";
import OpenWaUniversalControl from "./OpenWaUniversalControl";
import NgrokUniversalControl from "./NgrokUniversalControl";
import StorageUsageCard from "./StorageUsageCard";
import FinancialYearSwitcher from "./FinancialYearSwitcher";
import ShopSwitcher from "./ShopSwitcher";
import PasswordChangeDialog from "./PasswordChangeDialog";
import { toast } from "sonner";

import {
  LayoutDashboard,
  ShoppingBag,
  CheckCircle2,
  RotateCcw,
  Users,
  UserCheck,
  Building2,
  Calculator,
  Wrench,
  Palette,
  MessageSquare,
  Globe,
  ShieldCheck,
  Inbox,
  HardDrive,
  Database,
  Settings2,
  Menu,
  X,
  ChevronRight,
  Store,
  LogOut,
  Sparkles,
  Sun,
  Moon,
  Zap,
  Crown,
  ArrowLeft,
  RotateCw,
} from "lucide-react";

const DashboardTab = React.lazy(() => import("./dashboard/DashboardTab"));

export type DepartmentMode = "sales" | "repairs" | "management" | "all";

interface AdminDashboardProps {
  initialDepartment?: DepartmentMode;
  onBack?: () => void;
  user?: any;
  onOpenLogout?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  badgeColor?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

interface AdminThemeAccent {
  name: string;
  badge: string;
  accentText: string;
  accentBorder: string;
  accentBg: string;
  activeItemBg: string;
  glowClass: string;
  activeDot: string;
}

const ADMIN_THEMES: Record<string, AdminThemeAccent> = {
  neon: {
    name: "Cyber Neon",
    badge: "CYBER NEON",
    accentText: "text-cyan-400",
    accentBorder: "border-cyan-500/50",
    accentBg: "bg-cyan-500/10",
    activeItemBg: "bg-gradient-to-r from-cyan-500/20 to-emerald-500/10 border-cyan-500/40 text-cyan-200",
    glowClass: "shadow-[0_0_20px_rgba(6,182,212,0.25)]",
    activeDot: "bg-cyan-400 shadow-[0_0_8px_#22d3ee]",
  },
  luxury: {
    name: "Black & Gold Luxury",
    badge: "LUXURY GOLD",
    accentText: "text-amber-400",
    accentBorder: "border-amber-500/50",
    accentBg: "bg-amber-500/10",
    activeItemBg: "bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border-amber-500/40 text-amber-200",
    glowClass: "shadow-[0_0_20px_rgba(245,158,11,0.2)]",
    activeDot: "bg-amber-400 shadow-[0_0_8px_#fbbf24]",
  },
  apple_minimal: {
    name: "Apple Minimal",
    badge: "MINIMAL PRO",
    accentText: "text-slate-200",
    accentBorder: "border-slate-500/40",
    accentBg: "bg-slate-500/10",
    activeItemBg: "bg-slate-800 border-slate-600 text-white",
    glowClass: "shadow-none",
    activeDot: "bg-white",
  },
  glassmorphism: {
    name: "Frosted Glass",
    badge: "AERO GLASS",
    accentText: "text-indigo-300",
    accentBorder: "border-indigo-400/40",
    accentBg: "bg-indigo-500/10",
    activeItemBg: "bg-white/10 backdrop-blur-xl border-white/20 text-indigo-100",
    glowClass: "shadow-[0_0_20px_rgba(99,102,241,0.2)]",
    activeDot: "bg-indigo-400 shadow-[0_0_8px_#818cf8]",
  },
  bento_pro: {
    name: "Bento Pro",
    badge: "BENTO PRO",
    accentText: "text-emerald-400",
    accentBorder: "border-emerald-500/40",
    accentBg: "bg-emerald-500/10",
    activeItemBg: "bg-emerald-500/20 border-emerald-500/40 text-emerald-200",
    glowClass: "shadow-[0_0_20px_rgba(16,185,129,0.2)]",
    activeDot: "bg-emerald-400 shadow-[0_0_8px_#34d399]",
  },
  compact_retail: {
    name: "Compact Retail",
    badge: "EXPRESS POS",
    accentText: "text-orange-400",
    accentBorder: "border-orange-500/40",
    accentBg: "bg-orange-500/10",
    activeItemBg: "bg-orange-500/20 border-orange-500/40 text-orange-200",
    glowClass: "shadow-[0_0_20px_rgba(249,115,22,0.2)]",
    activeDot: "bg-orange-400 shadow-[0_0_8px_#fb923c]",
  },
  brutalist: {
    name: "Neo-Brutalist",
    badge: "BRUTALIST",
    accentText: "text-yellow-400",
    accentBorder: "border-yellow-400",
    accentBg: "bg-yellow-400/10",
    activeItemBg: "bg-yellow-400/20 border-2 border-yellow-400 text-yellow-300",
    glowClass: "shadow-[4px_4px_0px_#facc15]",
    activeDot: "bg-yellow-400",
  },
  fluid_carousel: {
    name: "Fluid Carousel",
    badge: "FLUID SHOWCASE",
    accentText: "text-violet-400",
    accentBorder: "border-violet-500/40",
    accentBg: "bg-violet-500/10",
    activeItemBg: "bg-violet-500/20 border-violet-500/40 text-violet-200",
    glowClass: "shadow-[0_0_20px_rgba(139,92,246,0.2)]",
    activeDot: "bg-violet-400 shadow-[0_0_8px_#a78bfa]",
  },
  split_slider: {
    name: "Split Inspection",
    badge: "SPLIT INSPECTOR",
    accentText: "text-rose-400",
    accentBorder: "border-rose-500/40",
    accentBg: "bg-rose-500/10",
    activeItemBg: "bg-rose-500/20 border-rose-500/40 text-rose-200",
    glowClass: "shadow-[0_0_20px_rgba(244,63,94,0.2)]",
    activeDot: "bg-rose-400 shadow-[0_0_8px_#fb7185]",
  },
  phonezone_signature: {
    name: "PhoneZone Signature",
    badge: "SIGNATURE",
    accentText: "text-teal-400",
    accentBorder: "border-teal-500/40",
    accentBg: "bg-teal-500/10",
    activeItemBg: "bg-gradient-to-r from-teal-500/20 to-blue-500/10 border-teal-500/40 text-teal-200",
    glowClass: "shadow-[0_0_20px_rgba(20,184,166,0.2)]",
    activeDot: "bg-teal-400 shadow-[0_0_8px_#2dd4bf]",
  },
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  initialDepartment = "sales",
  onBack,
  user,
  onOpenLogout,
}) => {
  const [activeTab, setActiveTabState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get("tab");
      if (tabParam) return tabParam;
      const stored = sessionStorage.getItem("phonezone_admin_tab");
      if (stored) return stored;
    }
    return "dashboard";
  });

  const [tabHistory, setTabHistory] = useState<string[]>([activeTab]);

  const setActiveTab = (tab: string) => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("phonezone_admin_tab", tab);
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState({}, "", url.toString());
    }
    if (tab !== activeTab) {
      setTabHistory((prev) => [...prev, tab]);
    }
    setActiveTabState(tab);
  };

  const handleAdminBack = () => {
    if (tabHistory.length > 1) {
      const nextHistory = tabHistory.slice(0, -1);
      const prevTab = nextHistory[nextHistory.length - 1];
      setTabHistory(nextHistory);
      sessionStorage.setItem("phonezone_admin_tab", prevTab);
      const url = new URL(window.location.href);
      url.searchParams.set("tab", prevTab);
      window.history.replaceState({}, "", url.toString());
      setActiveTabState(prevTab);
    } else if (activeTab !== "dashboard") {
      setActiveTab("dashboard");
    } else {
      toast.info("Already at start of Admin Panel. Use [Storefront] button to view public store.", { duration: 2500 });
    }
  };
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on Escape key press
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  const [themeMode, setThemeMode] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("phonezone_admin_mode") as "dark" | "light") || "dark";
    }
    return "dark";
  });

  const toggleThemeMode = () => {
    setThemeMode((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("phonezone_admin_mode", next);
      return next;
    });
  };

  useEffect(() => {
    if (initialDepartment === "repairs") setActiveTab("repairs");
    else if (initialDepartment === "management") setActiveTab("ngrok");
    else if (initialDepartment === "sales") setActiveTab("dashboard");
  }, [initialDepartment]);

  // Read active homepage theme so Admin styles sync with storefront design
  const { data: configData } = useQuery({
    queryKey: ["storefront-config-admin"],
    queryFn: async () => {
      const res = await fetch("/api/config");
      if (res.ok) return res.json();
      return null;
    },
    staleTime: 15 * 1000,
  });

  const brandKey = configData?.homepageTheme || "phonezone_signature";
  const activeBrand = ADMIN_THEMES[brandKey] || ADMIN_THEMES.phonezone_signature;

  const { active: activeFy } = useFinancialYear();
  const activeYear = activeFy?.label || "default";

  const { data: stats } = useQuery({
    queryKey: ["admin-stats", activeYear],
    queryFn: () => data.getAdminStats(),
  });

  const { data: repairStats } = useQuery({
    queryKey: ["repair-accounting-stats", activeYear],
    queryFn: async () => {
      const res = await fetch("/api/repair/accounting");
      if (res.ok) return res.json();
      return null;
    },
  });

  const userRoles: string[] = Array.isArray(user?.roles) && user.roles.length > 0
    ? user.roles
    : user?.role
    ? [user.role]
    : [];
  const isAdminOrOwner = userRoles.some((r) => ["admin", "master_admin", "owner"].includes(r));
  const isRepairUser = !isAdminOrOwner && userRoles.some((r) => ["repair_admin", "technician", "repair"].includes(r));
  const isSalesUser = !isAdminOrOwner && !isRepairUser;

  // Navigation sections for modern left sidebar (strictly scoped by staff role)
  const navSections: NavSection[] = [
    ...(isAdminOrOwner ? [
      {
        title: "Core Overview",
        items: [
          {
            id: "dashboard",
            label: "Live Dashboard",
            icon: LayoutDashboard,
            badge: "REALTIME",
            badgeColor: activeBrand.accentBg + " " + activeBrand.accentText + " border " + activeBrand.accentBorder,
          },
        ],
      },
    ] : []),
    ...(!isRepairUser ? [{
      title: "Sales & Stock",
      items: [
        {
          id: "inventory",
          label: "Inventory Stock",
          icon: ShoppingBag,
          badge: stats?.totalPhones !== undefined ? stats.totalPhones : undefined,
          badgeColor: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
        },
        {
          id: "sold",
          label: "Sold Phones",
          icon: CheckCircle2,
        },
        ...(isAdminOrOwner ? [
          {
            id: "returns",
            label: "Returns & Refunds",
            icon: RotateCcw,
          },
        ] : []),
        {
          id: "customers",
          label: "Customer Directory",
          icon: Users,
          badge: stats?.totalCustomers !== undefined ? stats.totalCustomers : undefined,
          badgeColor: "bg-slate-700 text-slate-300",
        },
        {
          id: "sellers",
          label: "Phone Suppliers",
          icon: UserCheck,
        },
        ...(isAdminOrOwner ? [
          {
            id: "dealers",
            label: "B2B Dealers",
            icon: Building2,
          },
          {
            id: "accounting",
            label: "Sales Accounting",
            icon: Calculator,
          },
        ] : []),
      ],
    }] : []),
    ...(!isSalesUser ? [{
      title: "Repair Department",
      items: [
        {
          id: "repairs",
          label: "Repair Operations",
          icon: Wrench,
          badge: repairStats?.pending_jobs ? `${repairStats.pending_jobs} ACTIVE` : undefined,
          badgeColor: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
        },
      ],
    }] : []),
    ...(isAdminOrOwner ? [
      {
        title: "Storefront & Marketing",
        items: [
          {
            id: "storefront",
            label: "Storefront & 10+ Themes",
            icon: Palette,
            badge: "10 THEMES",
            badgeColor: "bg-purple-500/20 text-purple-300 border border-purple-500/30",
          },
          {
            id: "marketing",
            label: "WhatsApp Marketing",
            icon: MessageSquare,
          },
        ],
      },
      {
        title: "System & Management",
        items: [
          {
            id: "ngrok",
            label: "Online Access (Ngrok)",
            icon: Globe,
          },
          {
            id: "users",
            label: "Staff & Permissions",
            icon: ShieldCheck,
          },
          {
            id: "messages",
            label: "Customer Messages",
            icon: Inbox,
          },
          {
            id: "storage",
            label: "Media & Storage",
            icon: HardDrive,
          },
          {
            id: "database",
            label: "Database & Backup",
            icon: Database,
          },
          {
            id: "settings",
            label: "Store Settings",
            icon: Settings2,
          },
        ],
      },
    ] : [
      {
        title: "Communications",
        items: [
          {
            id: "messages",
            label: "Customer Messages",
            icon: Inbox,
          },
        ],
      },
    ]),
  ];

  // Auto-redirect if non-admin user lands on unauthorized tab
  useEffect(() => {
    if (isRepairUser) {
      if (activeTab !== "repairs") {
        setActiveTab("repairs");
      }
      return;
    }

    if (isSalesUser) {
      const allowedSalesTabs = ["inventory", "sold", "customers", "sellers", "messages"];
      if (!allowedSalesTabs.includes(activeTab)) {
        setActiveTab("inventory");
      }
      return;
    }

    if (!isAdminOrOwner) {
      const allowedTabIds = new Set(navSections.flatMap((s) => s.items.map((i) => i.id)));
      if (!allowedTabIds.has(activeTab)) {
        setActiveTab(isRepairUser ? "repairs" : "inventory");
      }
    }
  }, [isAdminOrOwner, isRepairUser, isSalesUser, activeTab]);

  const getTabLabel = (id: string) => {
    for (const sec of navSections) {
      const found = sec.items.find((i) => i.id === id);
      if (found) return found.label;
    }
    return "Management";
  };

  const handleSelectTab = (tabId: string) => {
    let target = tabId;
    if (tabId === "invoices" || tabId === "sales") target = "sold";
    else if (tabId === "purchases" || tabId === "stock") target = "inventory";
    setActiveTab(target);
    setSidebarOpen(false);
  };

  const isDark = themeMode === "dark";

  return (
    <div
      className={`min-h-screen w-full flex antialiased overflow-x-hidden ${
        isDark ? "bg-[#07090e] text-slate-100" : "bg-slate-100/80 text-slate-900"
      }`}
    >
      {/* ----------------- DYNAMIC OVERLAY BACKDROP ----------------- */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm transition-opacity duration-200"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ----------------- DYNAMIC OVERLAY SIDEBAR DRAWER ----------------- */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 sm:w-80 max-w-[88vw] flex flex-col justify-between transition-transform duration-300 ease-out shadow-2xl ${
          isDark ? "bg-[#0a0d14] border-r border-slate-800/90" : "bg-white border-r border-slate-200 shadow-2xl"
        } ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Brand & Theme Accent Header */}
        <div className={`p-4 border-b ${isDark ? "border-slate-800/80" : "border-slate-200"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`h-9 w-9 rounded-xl flex items-center justify-center font-black text-white text-base shadow-lg ${
                  brandKey === "luxury"
                    ? "bg-gradient-to-tr from-amber-600 via-yellow-500 to-amber-300 text-black shadow-amber-500/20"
                    : brandKey === "neon"
                    ? "bg-gradient-to-tr from-cyan-600 via-teal-500 to-emerald-400 shadow-cyan-500/30"
                    : "bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 shadow-blue-500/20"
                }`}
              >
                PZ
              </div>
              <div>
                <h1
                  className={`font-black text-sm tracking-tight flex items-center gap-1.5 ${
                    isDark ? "text-white" : "text-slate-950"
                  }`}
                >
                  PhoneZone ERP
                  <span
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-sm border ${activeBrand.accentBg} ${activeBrand.accentText} ${activeBrand.accentBorder}`}
                  >
                    {activeBrand.badge}
                  </span>
                </h1>
                <p className={`text-[11px] font-semibold ${isDark ? "text-slate-400" : "text-slate-700"}`}>
                  Store &amp; Workshop Suite
                </p>
              </div>
            </div>

            {/* Close Sidebar Drawer Button */}
            <button
              onClick={() => setSidebarOpen(false)}
              className={`p-1.5 rounded-lg transition-colors ${
                isDark ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100"
              }`}
              title="Close Menu (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Quick Back to Storefront Link */}
          {onBack && (
            <div className={`mt-3.5 pt-3 border-t ${isDark ? "border-slate-800/60" : "border-slate-200"}`}>
              <button
                onClick={() => {
                  setSidebarOpen(false);
                  onBack();
                }}
                className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition-all shadow-sm ${
                  isDark
                    ? "bg-slate-900/80 hover:bg-slate-800 border-slate-700/80 text-blue-300"
                    : "bg-blue-50 hover:bg-blue-100 border-blue-300 text-blue-900"
                }`}
              >
                <Store className="h-3.5 w-3.5 text-blue-600" />
                <span>View Public Storefront</span>
              </button>
            </div>
          )}
        </div>

        {/* Scrollable Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          {navSections.map((sec, secIdx) => (
            <div key={secIdx} className="space-y-1">
              <div
                className={`px-3 pb-1.5 text-[10px] font-black uppercase tracking-wider ${
                  isDark ? "text-slate-400" : "text-slate-900"
                }`}
              >
                {sec.title}
              </div>
              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTab(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all group ${
                      isActive
                        ? isDark
                          ? `${activeBrand.activeItemBg} shadow-sm border font-semibold`
                          : "bg-blue-50 text-blue-950 border-2 border-blue-400 font-black shadow-xs"
                        : isDark
                        ? "text-slate-400 hover:text-slate-200 hover:bg-slate-900/80"
                        : "text-slate-900 hover:text-black hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          isActive
                            ? isDark
                              ? activeBrand.accentText
                              : "text-blue-700"
                            : isDark
                            ? "text-slate-500 group-hover:text-slate-300"
                            : "text-slate-700 group-hover:text-black"
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge !== undefined && (
                      <span
                        className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full shrink-0 ${
                          item.badgeColor || (isDark ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-950")
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* User Footer Profile & Dark/Light Toggle */}
        <div
          className={`p-3 border-t ${
            isDark ? "border-slate-800/80 bg-[#07090e]" : "border-slate-200 bg-slate-50"
          } space-y-2.5`}
        >
          {/* Quick Dark/Light Switch inside Sidebar */}
          <div className="flex items-center justify-between px-2 py-1 text-xs">
            <span className={`text-[11px] font-bold ${isDark ? "text-slate-400" : "text-slate-800"}`}>
              Interface Mode:
            </span>
            <button
              onClick={toggleThemeMode}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                isDark
                  ? "bg-slate-900 border-slate-700 text-amber-300 hover:bg-slate-800"
                  : "bg-white border-slate-300 text-slate-900 hover:bg-slate-100 shadow-xs font-black"
              }`}
            >
              {isDark ? (
                <>
                  <Sun className="h-3 w-3 text-amber-400" />
                  <span>Light</span>
                </>
              ) : (
                <>
                  <Moon className="h-3 w-3 text-indigo-600" />
                  <span>Dark</span>
                </>
              )}
            </button>
          </div>

          {/* User profile card */}
          <div
            className={`flex items-center justify-between p-2 rounded-xl border ${
              isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`h-8 w-8 rounded-full border flex items-center justify-center text-xs font-black uppercase shrink-0 ${
                  isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-200 border-slate-300 text-slate-900"
                }`}
              >
                {(user?.displayName || user?.email || "US").slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-bold truncate ${isDark ? "text-slate-200" : "text-slate-950"}`}>
                  {user?.displayName || user?.email || "Staff User"}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${activeBrand.activeDot} animate-pulse`} />
                  <span className={`text-[10px] font-mono font-bold ${isDark ? "text-slate-400" : "text-slate-700"}`}>
                    {isAdminOrOwner
                      ? "Owner / Admin"
                      : isRepairUser
                      ? (userRoles.includes("repair_admin") ? "Repair Admin" : "Technician")
                      : (userRoles.includes("sales_admin") ? "Sales Admin" : "Sales Staff")}
                  </span>
                </div>
              </div>
            </div>

            {onOpenLogout && (
              <button
                onClick={onOpenLogout}
                title="Log out"
                className={`p-1.5 rounded-lg transition-colors ${
                  isDark ? "text-slate-400 hover:text-rose-400 hover:bg-slate-800" : "text-slate-700 hover:text-rose-600 hover:bg-slate-100"
                }`}
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ----------------- RIGHT CANVAS CONTENT ----------------- */}
      <div className="flex-1 min-w-0 w-full flex flex-col h-screen overflow-y-auto overflow-x-hidden">
        {/* Top Canvas Bar (Sticky, High Contrast & Themed) */}
        <header
          className={`sticky top-0 z-30 backdrop-blur-md px-2.5 sm:px-4 py-2 flex items-center justify-between gap-2 border-b transition-colors overflow-x-hidden shrink-0 ${
            isDark
              ? "bg-[#0a0d14]/95 border-slate-800/90 text-white"
              : "bg-white/95 border-slate-200 text-slate-900 shadow-xs"
          }`}
        >
          {/* Left: 3-Line Hamburger Menu & Breadcrumb */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 shrink">
            <button
              onClick={() => setSidebarOpen(true)}
              className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 font-black text-xs transition-all shadow-sm shrink-0 ${
                isDark
                  ? "bg-slate-900 border-slate-700 text-amber-300 hover:bg-slate-800 hover:text-white hover:border-amber-400"
                  : "bg-white border-slate-300 text-slate-900 hover:bg-slate-100"
              }`}
              title="Open Navigation Menu (3 Lines / Sidebar)"
            >
              <Menu className="h-4 w-4 text-amber-400 shrink-0" />
              <span className="font-extrabold tracking-wider text-[11px]">MENU</span>
            </button>

            <div className="flex items-center gap-2 min-w-0 truncate">
              <div
                className={`h-7 w-7 rounded-lg flex items-center justify-center font-black text-xs text-white shadow shrink-0 hidden sm:flex ${
                  brandKey === "luxury"
                    ? "bg-gradient-to-tr from-amber-600 via-yellow-500 to-amber-300 text-black shadow-amber-500/20"
                    : brandKey === "neon"
                    ? "bg-gradient-to-tr from-cyan-600 via-teal-500 to-emerald-400 shadow-cyan-500/30"
                    : "bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 shadow-blue-500/20"
                }`}
              >
                PZ
              </div>
              <div className="min-w-0 truncate">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs font-black tracking-tight text-slate-400 hidden xl:inline">
                    PhoneZone ERP
                  </span>
                  <span className="text-xs font-bold text-slate-600 hidden xl:inline">•</span>
                  <h2 className="text-xs sm:text-sm font-extrabold tracking-tight truncate text-cyan-300">
                    {getTabLabel(activeTab)}
                  </h2>
                </div>
              </div>
            </div>
          </div>

          {/* Right: High-contrast visible tool pills & theme toggle (Zero horizontal scroll) */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 py-0.5 overflow-x-hidden">
            {/* Quick Navigation: Back & Refresh for Desktop App & Web */}
            <div className="flex items-center gap-1 border-r border-slate-700/40 pr-1.5 mr-0.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAdminBack}
                className={`h-7 px-2 text-xs font-bold border transition-all flex items-center gap-1 shadow-sm ${
                  isDark
                    ? "bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white"
                    : "bg-white border-slate-300 text-slate-800 hover:bg-slate-100"
                }`}
                title="Go Back (Alt + Left Arrow)"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-blue-500" />
                <span className="hidden lg:inline">Back</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
                className={`h-7 px-2 text-xs font-bold border transition-all flex items-center gap-1 shadow-sm ${
                  isDark
                    ? "bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white"
                    : "bg-white border-slate-300 text-slate-800 hover:bg-slate-100"
                }`}
                title="Refresh Page (F5 / Ctrl + R)"
              >
                <RotateCw className="h-3.5 w-3.5 text-emerald-500" />
                <span className="hidden lg:inline">Refresh</span>
              </Button>
            </div>

            {/* Global Dark / Light Switch */}
            <button
              onClick={toggleThemeMode}
              className={`h-7 px-2 rounded-lg border text-xs font-bold transition-all flex items-center gap-1 shadow-sm ${
                isDark
                  ? "bg-slate-900 border-slate-700 text-amber-300 hover:bg-slate-800"
                  : "bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200"
              }`}
              title={`Switch to ${isDark ? "Light" : "Dark"} Mode`}
            >
              {isDark ? (
                <>
                  <Sun className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span className="hidden md:inline text-[11px]">Light</span>
                </>
              ) : (
                <>
                  <Moon className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                  <span className="hidden md:inline text-[11px]">Dark</span>
                </>
              )}
            </button>

            {/* Financial Year Switcher (Admin only) */}
            {isAdminOrOwner && (
              <FinancialYearSwitcher
                className={`h-7 px-2 text-xs font-bold border transition-all flex items-center gap-1 shadow-sm ${
                  isDark
                    ? "bg-slate-900 border-slate-700 text-slate-100 hover:bg-slate-800"
                    : "bg-white border-slate-300 text-slate-800 hover:bg-slate-100"
                }`}
              />
            )}

            {/* Global Company / Store Branch Switcher */}
            <ShopSwitcher isDark={isDark} />

            {/* Universal Scanner Trigger */}
            <UniversalScanner
              className={`h-7 px-2 text-xs font-bold border transition-all flex items-center gap-1 shadow-sm ${
                isDark
                  ? "bg-slate-900 border-blue-500/40 text-blue-300 hover:bg-slate-800"
                  : "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
              }`}
            />

            {/* WhatsApp Control Pill (Admin only) */}
            {isAdminOrOwner && (
              <div className="hidden sm:block">
                <OpenWaUniversalControl
                  className={`h-7 px-2 text-xs font-bold border transition-all flex items-center gap-1 shadow-sm ${
                    isDark
                      ? "bg-slate-900 border-emerald-500/40 text-emerald-300 hover:bg-slate-800"
                      : "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                  }`}
                />
              </div>
            )}

            {/* Ngrok Control Pill (Admin only) */}
            {isAdminOrOwner && (
              <div className="hidden lg:block">
                <NgrokUniversalControl
                  className={`h-7 px-2 text-xs font-bold border transition-all flex items-center gap-1 shadow-sm ${
                    isDark
                      ? "bg-slate-900 border-sky-500/40 text-sky-300 hover:bg-slate-800"
                      : "bg-sky-50 border-sky-200 text-sky-800 hover:bg-sky-100"
                  }`}
                />
              </div>
            )}

            {/* Storage Usage Pill (Admin only) */}
            {isAdminOrOwner && (
              <div className="hidden 2xl:block">
                <StorageUsageCard
                  compact
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold border transition-all ${
                    isDark
                      ? "bg-slate-900 border-slate-700 text-slate-200"
                      : "bg-white border-slate-200 text-slate-700 shadow-xs"
                  }`}
                />
              </div>
            )}

            {/* Password Change Dialog */}
            <PasswordChangeDialog
              className={`h-7 px-2 text-xs font-bold border transition-all flex items-center gap-1 shadow-sm ${
                isDark
                  ? "bg-slate-900 border-slate-700 text-slate-100 hover:bg-slate-800"
                  : "bg-white border-slate-300 text-slate-800 hover:bg-slate-100"
              }`}
            />

            {/* Back to Storefront Link */}
            {onBack && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBack}
                className={`h-7 px-2 text-xs font-bold border transition-all ${
                  isDark
                    ? "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
                    : "border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
                }`}
              >
                <Store className="h-3.5 w-3.5 mr-1 text-teal-500" />
                <span className="hidden xl:inline">Storefront</span>
              </Button>
            )}

            {/* Prominent Logout Button Next to Storefront */}
            {onOpenLogout && (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenLogout}
                title="Logout"
                className={`h-7 px-2.5 text-xs font-bold border transition-all ${
                  isDark
                    ? "border-rose-900/60 bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 hover:text-rose-100"
                    : "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
                }`}
              >
                <LogOut className="h-3.5 w-3.5 mr-1 text-rose-400" />
                <span>Logout</span>
              </Button>
            )}
          </div>
        </header>

        {/* Main Canvas View Body (Guaranteed 0 Horizontal Scroll) */}
        <main className="flex-1 min-w-0 w-full overflow-x-hidden p-2 sm:p-4 md:p-6">
          {/* LIVE DASHBOARD TAB — FULL SCREEN CANVAS (No extra white boxes!) */}
          {activeTab === "dashboard" && isAdminOrOwner && (
            <ErrorBoundary label="Live Dashboard">
              <React.Suspense
                fallback={
                  <div className="p-16 text-center text-slate-400 font-mono">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-400 mx-auto mb-4" />
                    Loading Real-Time Storefront Dashboard...
                  </div>
                }
              >
                <DashboardTab
                  isAdmin={isAdminOrOwner}
                  onNavigateTab={(tab) => handleSelectTab(tab)}
                  onQuickAction={(action) => {
                    if (action === "new_sale") handleSelectTab("sold");
                    else if (action === "new_repair") handleSelectTab("repairs");
                    else if (action === "add_phone") handleSelectTab("inventory");
                    else if (action === "add_customer") handleSelectTab("customers");
                  }}
                  financialYear={activeYear}
                  themeMode={themeMode}
                  onToggleThemeMode={toggleThemeMode}
                />
              </React.Suspense>
            </ErrorBoundary>
          )}

          {/* ALL OTHER TABS — SCOPED CONTAINER WITH AUTO DARK/LIGHT THEME */}
          {activeTab !== "dashboard" && (
            <div
              className={`p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto min-h-screen ${
                isDark ? "admin-dark-wrapper dark" : "bg-slate-50/60"
              }`}
            >
              {/* Department Summary Cards when inside Sales/Inventory */}
              {["inventory", "sold", "returns", "accounting"].includes(activeTab) && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <Card className={isDark ? "bg-[#0d111c] border-slate-800 text-slate-100" : "bg-white border-slate-200"}>
                    <CardHeader className="pb-1 p-4">
                      <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Phones in Stock
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="text-2xl font-black text-blue-500">{stats?.totalPhones || 0}</div>
                      <p className="text-[11px] text-slate-400">Available inventory</p>
                    </CardContent>
                  </Card>

                  {isAdminOrOwner && (
                    <Card className={isDark ? "bg-[#0d111c] border-slate-800 text-slate-100" : "bg-white border-slate-200"}>
                      <CardHeader className="pb-1 p-4">
                        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Total Revenue
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-black text-emerald-500">
                          ₹{(stats?.totalRevenue || 0).toLocaleString()}
                        </div>
                        <p className="text-[11px] text-slate-400">Phones sold this FY</p>
                      </CardContent>
                    </Card>
                  )}

                  <Card className={isDark ? "bg-[#0d111c] border-slate-800 text-slate-100" : "bg-white border-slate-200"}>
                    <CardHeader className="pb-1 p-4">
                      <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Total Customers
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className={`text-2xl font-black ${isDark ? "text-slate-100" : "text-slate-800"}`}>
                        {stats?.totalCustomers || 0}
                      </div>
                      <p className="text-[11px] text-slate-400">Registered phone buyers</p>
                    </CardContent>
                  </Card>

                  <Card className={isDark ? "bg-[#0d111c] border-slate-800 text-slate-100" : "bg-white border-slate-200"}>
                    <CardHeader className="pb-1 p-4">
                      <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Total Suppliers
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className={`text-2xl font-black ${isDark ? "text-slate-100" : "text-slate-800"}`}>
                        {stats?.totalSellers || 0}
                      </div>
                      <p className="text-[11px] text-slate-400">Phone suppliers</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Department Summary Cards when inside Repairs */}
              {activeTab === "repairs" && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <Card className={isDark ? "bg-[#0d111c] border-indigo-500/30 text-slate-100" : "bg-white border-indigo-100"}>
                    <CardHeader className="pb-1 p-4">
                      <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Total Jobs
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="text-2xl font-black text-indigo-400">{repairStats?.total_jobs || 0}</div>
                      <p className="text-[11px] text-slate-400">Workshop tickets</p>
                    </CardContent>
                  </Card>

                  <Card className={isDark ? "bg-[#0d111c] border-emerald-500/30 text-slate-100" : "bg-white border-emerald-100"}>
                    <CardHeader className="pb-1 p-4">
                      <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Repair Revenue
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="text-2xl font-black text-emerald-400">
                        ₹{Number(repairStats?.total_revenue || 0).toLocaleString()}
                      </div>
                      <p className="text-[11px] text-slate-400">Delivered devices</p>
                    </CardContent>
                  </Card>

                  <Card className={isDark ? "bg-[#0d111c] border-blue-500/30 text-slate-100" : "bg-white border-blue-100"}>
                    <CardHeader className="pb-1 p-4">
                      <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Net Profit
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="text-2xl font-black text-blue-400">
                        ₹{Number(repairStats?.net_profit || 0).toLocaleString()}
                      </div>
                      <p className="text-[11px] text-slate-400">Labor after parts</p>
                    </CardContent>
                  </Card>

                  <Card className={isDark ? "bg-[#0d111c] border-amber-500/30 text-slate-100" : "bg-white border-amber-100"}>
                    <CardHeader className="pb-1 p-4">
                      <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Active in Workshop
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="text-2xl font-black text-amber-400">{repairStats?.pending_jobs || 0}</div>
                      <p className="text-[11px] text-slate-400">In-progress devices</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Tab Bodies */}
              {activeTab === "inventory" && (isAdminOrOwner || isSalesUser) && (
                <ErrorBoundary label="Inventory">
                  <InventoryTab onNavigateTab={(tab) => setActiveTab(tab)} />
                </ErrorBoundary>
              )}

              {activeTab === "sold" && (isAdminOrOwner || isSalesUser) && (
                <ErrorBoundary label="Sold">
                  <SoldTab />
                </ErrorBoundary>
              )}

              {activeTab === "returns" && isAdminOrOwner && (
                <ErrorBoundary label="Returns">
                  <ReturnsTab />
                </ErrorBoundary>
              )}

              {activeTab === "customers" && (isAdminOrOwner || isSalesUser) && (
                <ErrorBoundary label="Customers">
                  <CustomersTab />
                </ErrorBoundary>
              )}

              {activeTab === "sellers" && (isAdminOrOwner || isSalesUser) && (
                <ErrorBoundary label="Sellers">
                  <SellersTab />
                </ErrorBoundary>
              )}

              {activeTab === "dealers" && isAdminOrOwner && (
                <ErrorBoundary label="Dealers">
                  <DealersTab />
                </ErrorBoundary>
              )}

              {activeTab === "accounting" && isAdminOrOwner && (
                <ErrorBoundary label="Sales Accounting">
                  <AccountingTab />
                </ErrorBoundary>
              )}

              {activeTab === "repairs" && (isAdminOrOwner || isRepairUser) && (
                <ErrorBoundary label="Repairs">
                  <RepairsTab />
                </ErrorBoundary>
              )}

              {activeTab === "storefront" && isAdminOrOwner && (
                <ErrorBoundary label="Storefront & Themes">
                  <StorefrontCustomizerTab />
                </ErrorBoundary>
              )}

              {activeTab === "marketing" && isAdminOrOwner && (
                <ErrorBoundary label="WhatsApp Marketing">
                  <MarketingTab />
                </ErrorBoundary>
              )}

              {activeTab === "ngrok" && isAdminOrOwner && (
                <ErrorBoundary label="Online">
                  <NgrokTab />
                </ErrorBoundary>
              )}

              {activeTab === "users" && isAdminOrOwner && (
                <ErrorBoundary label="Staff & Roles">
                  <UsersTab />
                </ErrorBoundary>
              )}

              {activeTab === "messages" && (isAdminOrOwner || isSalesUser) && (
                <ErrorBoundary label="Messages">
                  <MessagesTab />
                </ErrorBoundary>
              )}

              {activeTab === "storage" && isAdminOrOwner && (
                <ErrorBoundary label="Storage">
                  <StorageTab />
                </ErrorBoundary>
              )}

              {activeTab === "database" && isAdminOrOwner && (
                <ErrorBoundary label="Database">
                  <DatabaseTab />
                </ErrorBoundary>
              )}

              {activeTab === "settings" && isAdminOrOwner && (
                <ErrorBoundary label="Settings">
                  <SettingsTab />
                </ErrorBoundary>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
