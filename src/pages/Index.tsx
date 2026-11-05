import React, { useState, useEffect, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { data as dataDriver } from "@/lib/data";
import { ContactInfo } from "@/lib/data/types";
import { ThemeDesignId } from "@/components/home-themes/types";
import { DEFAULT_REPAIR_SERVICES } from "@/lib/repairServices";
import { useAuth } from "@/hooks/useAuth";
import { StorefrontTopBar } from "@/components/StorefrontTopBar";
import { StorefrontBusinessHub } from "@/components/StorefrontBusinessHub";

// Ultra-lightweight dynamic theme loading: Only load the 1 active theme instead of all 10
const NeonGlassTheme = React.lazy(() =>
  import("@/components/home-themes/NeonGlassTheme").then((m) => ({ default: m.NeonGlassTheme }))
);
const AppleMinimalTheme = React.lazy(() =>
  import("@/components/home-themes/AppleMinimalTheme").then((m) => ({ default: m.AppleMinimalTheme }))
);
const FrostedGlassTheme = React.lazy(() =>
  import("@/components/home-themes/FrostedGlassTheme").then((m) => ({ default: m.FrostedGlassTheme }))
);
const BlackGoldLuxuryTheme = React.lazy(() =>
  import("@/components/home-themes/BlackGoldLuxuryTheme").then((m) => ({ default: m.BlackGoldLuxuryTheme }))
);
const PhoneZoneSignatureTheme = React.lazy(() =>
  import("@/components/home-themes/PhoneZoneSignatureTheme").then((m) => ({ default: m.PhoneZoneSignatureTheme }))
);
const BentoProTheme = React.lazy(() =>
  import("@/components/home-themes/BentoProTheme").then((m) => ({ default: m.BentoProTheme }))
);
const CompactRetailTheme = React.lazy(() =>
  import("@/components/home-themes/CompactRetailTheme").then((m) => ({ default: m.CompactRetailTheme }))
);
const BrutalistTheme = React.lazy(() =>
  import("@/components/home-themes/BrutalistTheme").then((m) => ({ default: m.BrutalistTheme }))
);
const FluidCarouselTheme = React.lazy(() =>
  import("@/components/home-themes/FluidCarouselTheme").then((m) => ({ default: m.FluidCarouselTheme }))
);
const SplitSliderTheme = React.lazy(() =>
  import("@/components/home-themes/SplitSliderTheme").then((m) => ({ default: m.SplitSliderTheme }))
);

// Lazy-load Admin Panel so public mobile storefront loads at maximum speed
const AdminPanel = React.lazy(() => import("@/components/AdminPanel"));

const Index: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const hasPreviewParam = typeof window !== "undefined" && window.location.search.includes("admin_preview=1");
  const isAdminPreview = Boolean(user || hasPreviewParam);

  const [showAdmin, setShowAdminState] = useState(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("admin") === "1" || urlParams.get("view") === "admin") return true;
      if (sessionStorage.getItem("phonezone_admin_active") === "true") return true;
    }
    return false;
  });

  const setShowAdmin = (active: boolean) => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("phonezone_admin_active", active ? "true" : "false");
      const url = new URL(window.location.href);
      if (active) {
        url.searchParams.set("admin", "1");
      } else {
        url.searchParams.delete("admin");
        url.searchParams.delete("tab");
      }
      window.history.replaceState({}, "", url.toString());
    }
    setShowAdminState(active);
  };
  const [adminDept, setAdminDept] = useState<"sales" | "repairs">("sales");
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Theme & Preview state
  const [publishedTheme, setPublishedTheme] = useState<ThemeDesignId>("phonezone_signature");
  const [activeTheme, setActiveTheme] = useState<ThemeDesignId>("phonezone_signature");
  const [viewportMode, setViewportMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [isPublishing, setIsPublishing] = useState(false);

  // Normalize any theme string to one of our 10 themes
  const normalizeTheme = (raw?: string): ThemeDesignId => {
    if (!raw) return "phonezone_signature";
    const valid: ThemeDesignId[] = [
      "neon",
      "apple_minimal",
      "glassmorphism",
      "luxury",
      "phonezone_signature",
      "bento_pro",
      "compact_retail",
      "brutalist",
      "fluid_carousel",
      "split_slider",
    ];
    if (valid.includes(raw as ThemeDesignId)) return raw as ThemeDesignId;
    return "phonezone_signature";
  };

  useEffect(() => {
    const fetchContact = async () => {
      try {
        const info = await dataDriver.getContactInfo();
        setContact(info);
        if (info?.homepage_theme) {
          const norm = normalizeTheme(info.homepage_theme);
          setPublishedTheme(norm);
          setActiveTheme(norm);
        }
      } catch (e) {
        console.error("Failed to fetch contact info", e);
      } finally {
        setLoading(false);
      }
    };
    fetchContact();
  }, []);

  // Fetch real phone inventory
  const { data: phones = [] } = useQuery({
    queryKey: ["storefront-phones"],
    queryFn: () => dataDriver.listPublicPhones(24),
  });

  const handlePublishTheme = async (themeId: ThemeDesignId) => {
    setIsPublishing(true);
    try {
      const payload = {
        homepage_theme: themeId,
      };

      // Try PUT first, fallback to POST
      let res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          toast.error("Please log into Admin Panel to publish this design permanently.", {
            action: {
              label: "Login",
              onClick: () => setShowAdmin(true),
            },
          });
          return;
        }
        res = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "include",
        });
      }

      if (res.ok) {
        setPublishedTheme(themeId);
        setActiveTheme(themeId);
        queryClient.invalidateQueries({ queryKey: ["storefront-settings"] });
        toast.success(`Design published! "${themeId.toUpperCase().replace("_", " ")}" is now live on the storefront.`);
      } else {
        if (res.status === 401 || res.status === 403) {
          toast.error("Please log into Admin Panel to publish this design permanently.", {
            action: {
              label: "Login",
              onClick: () => setShowAdmin(true),
            },
          });
          return;
        }
        throw new Error("Server rejected settings update");
      }
    } catch (err: any) {
      console.error("Failed to publish theme:", err);
      // Even if network fails, keep state live locally
      setPublishedTheme(themeId);
      toast.success(`Applied "${themeId}" to storefront`);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleExitPreview = () => {
    setActiveTheme(publishedTheme);
    toast.info(`Reverted to published live design: ${publishedTheme}`);
  };

  if (showAdmin) {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-slate-950 text-cyan-400 font-mono">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400 mx-auto mb-3" />
            <p className="text-xs tracking-wider">LOADING ADMIN SUITE...</p>
          </div>
        }
      >
        <AdminPanel onBack={() => setShowAdmin(false)} initialDepartment={adminDept} />
      </Suspense>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#07090e] text-slate-100">
        <div className="text-center font-mono">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4" />
          <p className="text-cyan-400 text-sm tracking-wider">LOADING PHONEZONE STOREFRONT...</p>
        </div>
      </div>
    );
  }

  const rawConfig = contact?.homepage_config || {};
  const config = {
    showTrustBar: rawConfig.showTrustBar !== false,
    showHero: rawConfig.showHero !== false,
    showFeatures: rawConfig.showFeatures !== false,
    showPhones: rawConfig.showPhones !== false,
    showRepairs: true, // Always show repairs so customers see repair service prominent
    showContact: rawConfig.showContact !== false,
    showHours: rawConfig.showHours !== false,
    phoneDisplayMode: (rawConfig.phoneDisplayMode as any) || "grid",
    heroHeadline: rawConfig.heroHeadline || "",
    heroSubheadline: rawConfig.heroSubheadline || "",
  };

  const repairs =
    contact?.repair_services && contact.repair_services.length > 0
      ? (contact.repair_services as any)
      : DEFAULT_REPAIR_SERVICES;

  const phonePrimary = contact?.phone_primary || "";
  const whatsappNumber = contact?.whatsapp_number || phonePrimary || "";

  // Render the currently selected concept
  const renderTheme = () => {
    const props = {
      contact,
      phones,
      repairs,
      config,
      onOpenAdmin: (dept?: "sales" | "repairs") => {
        if (dept) setAdminDept(dept);
        setShowAdmin(true);
      },
      onNavigateTrack: () => navigate("/track"),
      whatsappNumber,
      phonePrimary,
    };

    switch (activeTheme) {
      case "neon":
        return <NeonGlassTheme {...props} />;
      case "apple_minimal":
        return <AppleMinimalTheme {...props} />;
      case "glassmorphism":
        return <FrostedGlassTheme {...props} />;
      case "luxury":
        return <BlackGoldLuxuryTheme {...props} />;
      case "bento_pro":
        return <BentoProTheme {...props} />;
      case "compact_retail":
        return <CompactRetailTheme {...props} />;
      case "brutalist":
        return <BrutalistTheme {...props} />;
      case "fluid_carousel":
        return <FluidCarouselTheme {...props} />;
      case "split_slider":
        return <SplitSliderTheme {...props} />;
      case "phonezone_signature":
      default:
        return <PhoneZoneSignatureTheme {...props} />;
    }
  };

  const isLightTheme = ["apple_minimal", "brutalist", "glassmorphism"].includes(activeTheme);

  return (
    <div className={`min-h-screen w-full max-w-full overflow-x-hidden flex flex-col ${isLightTheme ? 'bg-[#f8fafc] text-slate-900' : 'bg-slate-950 text-slate-100'}`}>
      {/* 1. Global Storefront Top Trust & Social Strip */}
      <StorefrontTopBar
        contact={contact}
        whatsappNumber={whatsappNumber}
        phonePrimary={phonePrimary}
        onOpenAdmin={() => setShowAdmin(true)}
        onNavigateTrack={() => navigate("/track")}
      />

      {/* 2. Active Storefront Theme Canvas */}
      <main className="flex-1 w-full">
        <Suspense
          fallback={
            <div className="py-24 flex flex-col items-center justify-center text-slate-400 font-mono">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mb-2" />
              <p className="text-xs">Loading Storefront...</p>
            </div>
          }
        >
          {renderTheme()}
        </Suspense>
      </main>

      {/* 3. Official Storefront Business Hub (Visit Our Store & Get In Touch + Dark Footer) */}
      <StorefrontBusinessHub
        contact={contact}
        theme={activeTheme}
        whatsappNumber={whatsappNumber}
        phonePrimary={phonePrimary}
      />
    </div>
  );
};

export default Index;
