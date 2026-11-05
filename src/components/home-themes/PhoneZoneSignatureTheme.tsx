import React, { useState } from "react";
import { ThemeProps } from "./types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import FeaturedPhones from "@/components/FeaturedPhones";
import {
  Smartphone,
  Wrench,
  ShieldCheck,
  Star,
  Phone,
  MessageSquare,
  Clock,
  ExternalLink,
  Store,
  CheckCircle2,
  Sparkles,
  Zap,
  ArrowRight,
  ChevronRight,
  Settings,
  MapPin,
  Tag,
  ShieldAlert,
  Instagram,
} from "lucide-react";
import { useScrollReveal } from "./useScrollReveal";

export const PhoneZoneSignatureTheme: React.FC<ThemeProps> = ({
  contact,
  phones,
  repairs,
  config,
  onOpenAdmin,
  onNavigateTrack,
  whatsappNumber,
  phonePrimary,
}) => {
  useScrollReveal();

  // Flagship Dual-Intent Hero State: 'buy' vs 'repair'
  const [heroIntent, setHeroIntent] = useState<"buy" | "repair">("buy");
  const [activeCategory, setActiveCategory] = useState<string>("ALL");

  const businessName = contact?.business_name || "PHONEZONE";
  const tagline = contact?.business_tagline || "BEST DEALS EVER • 100% GENUINE PHONES & 30-MIN REPAIRS";
  const cleanWa = (whatsappNumber || phonePrimary || "").replace(/\D/g, "");
  const targetWa = cleanWa ? (cleanWa.length === 10 ? `91${cleanWa}` : cleanWa) : "";

  const openWhatsApp = (phone?: any) => {
    const text = phone
      ? `Hi PhoneZone! I want to buy ${phone.phone_name} (${phone.model || ""}) listed at ₹${Number(phone.selling_price || 0).toLocaleString()}. Is this still available?`
      : `Hi PhoneZone! I want to inquire about available phones and repair timings.`;
    if (targetWa) {
      window.open(`https://wa.me/${targetWa}?text=${encodeURIComponent(text)}`, "_blank");
    }
  };

  const openRepairWhatsApp = (repair: any) => {
    const text = `Hi PhoneZone! I need to repair my phone: ${repair.title} (approx ${repair.price}). When can I visit the Local store?`;
    if (targetWa) {
      window.open(`https://wa.me/${targetWa}?text=${encodeURIComponent(text)}`, "_blank");
    }
  };

  const heroPhone = phones[0] || null;

  const filteredPhones = phones.filter((p) => {
    if (activeCategory === "ALL") return true;
    if (activeCategory === "IPHONE") return /apple|iphone/i.test(p.phone_name || "");
    if (activeCategory === "ANDROID") return !/apple|iphone/i.test(p.phone_name || "");
    if (activeCategory === "BUDGET") return Number(p.selling_price || 0) <= 20000;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-600 selection:text-white">
      {/* 1. Flagship Trust Header Strip */}
      {config.showTrustBar && (
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white text-xs py-2 px-4 shadow-xs">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1.5 font-semibold">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                Govt. Registered • Udyam: {contact?.udyam_number || ""}
              </span>
              <span className="hidden md:inline">• 32-Point Inspected Used Phones</span>

              {contact?.instagram && (
                <a
                  href={`https://instagram.com/${contact.instagram.replace(/^@+/, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-pink-200 hover:text-white hover:underline font-semibold"
                >
                  <Instagram className="h-3.5 w-3.5 text-pink-300" />
                  @{contact.instagram.replace(/^@+/, "")}
                </a>
              )}
            </div>

            {contact?.google_business_url && (
              <a
                href={contact.google_business_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-yellow-200 hover:underline font-medium"
              >
                <Star className="h-3.5 w-3.5 fill-yellow-300" />
                Verified Google Business Profile <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* 2. Flagship Brand Navigation */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo & Identity */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            {contact?.logo_url ? (
              <img src={contact.logo_url} alt={businessName} className="h-9 sm:h-12 w-auto object-contain shrink-0" />
            ) : (
              <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl sm:rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-base sm:text-xl shadow-md shadow-blue-500/25 shrink-0">
                PZ
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-base sm:text-2xl font-black tracking-tight text-slate-900 leading-none truncate">
                  {businessName}
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                  FLAGSHIP
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium line-clamp-1 mt-0.5">
                {tagline}
              </p>
            </div>
          </div>

          {/* Nav Controls */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <button
              onClick={() => document.getElementById("signature-repairs")?.scrollIntoView({ behavior: "smooth" })}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-blue-600 hover:bg-blue-50 flex items-center gap-1"
            >
              <Wrench className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Repairs</span>
            </button>
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateTrack}
              className="hidden md:inline-flex border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold h-9"
            >
              Track Repair
            </Button>
            {contact?.instagram && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="border-pink-300 text-pink-700 hover:bg-pink-50 text-xs font-bold h-8 sm:h-9"
              >
                <a href={`https://instagram.com/${contact.instagram.replace(/^@+/, "")}`} target="_blank" rel="noreferrer">
                  <Instagram className="h-3.5 w-3.5 sm:mr-1 text-pink-600" />
                  <span className="hidden md:inline">Instagram</span>
                </a>
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => openWhatsApp()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 sm:h-9 px-3 sm:px-4 shadow-sm shadow-emerald-600/20"
            >
              <MessageSquare className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Direct WhatsApp</span>
              <span className="sm:hidden">WhatsApp</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenAdmin()}
              className="text-slate-500 hover:text-slate-900 h-8 sm:h-9 w-8 sm:w-auto px-2"
              title="Admin Portal"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* 3. Interactive Dual-Intent Flagship Hero */}
      {config.showHero && (
        <section className="pt-6 pb-12 sm:pt-16 sm:pb-24 px-4 sm:px-6 max-w-7xl mx-auto">
          {/* Dual Toggle Pill Switcher - Responsive Grid */}
          <div className="flex justify-center mb-6 sm:mb-8" data-reveal="fade">
            <div className="w-full max-w-md grid grid-cols-2 p-1.5 bg-slate-200/90 rounded-2xl shadow-inner gap-1">
              <button
                onClick={() => setHeroIntent("buy")}
                className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                  heroIntent === "buy"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]"
                    : "text-slate-700 hover:text-slate-900"
                }`}
              >
                <Smartphone className="h-4 w-4 shrink-0" />
                <span className="truncate">BUY PHONES</span>
              </button>
              <button
                onClick={() => setHeroIntent("repair")}
                className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                  heroIntent === "repair"
                    ? "bg-slate-900 text-white shadow-md scale-[1.02]"
                    : "text-slate-700 hover:text-slate-900"
                }`}
              >
                <Wrench className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="truncate">BOOK REPAIR</span>
              </button>
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-10 items-center">
            {/* Left Column (7 Cols) Dynamic Morph based on heroIntent */}
            <div className="lg:col-span-7 space-y-5 sm:space-y-6" data-reveal="left">
              {heroIntent === "buy" ? (
                <>
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold">
                    <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                    Local's #1 Certified Used Phones &amp; 30-Min Repair Lab
                  </div>

                  <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.1] break-words">
                    Certified Phones.
                    <br />
                    <span className="text-blue-600 underline decoration-blue-200 underline-offset-8">
                      Instant 30-Min Repairs.
                    </span>
                  </h1>

                  <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
                    Buy thoroughly tested pre-owned smartphones with authentic shop bill and 7-day replacement, or get your broken display, battery, and charging port repaired in 30 minutes with warranty.
                  </p>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                    <Button
                      size="lg"
                      onClick={() => {
                        document.getElementById("signature-phones")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 px-6 rounded-xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
                    >
                      <Smartphone className="h-4 w-4" />
                      Browse {phones.length} Verified Phones
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => {
                        document.getElementById("signature-repairs")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="border-emerald-500/40 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold h-12 px-6 rounded-xl flex items-center justify-center gap-2"
                    >
                      <Wrench className="h-4 w-4 text-emerald-600" />
                      Book Express Repair
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                    <Clock className="h-3.5 w-3.5 text-emerald-600" />
                    Express Live Repairs • Done in 30 to 60 Minutes
                  </div>

                  <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.1] break-words">
                    Broken Display? Dead Battery?
                    <br />
                    <span className="text-emerald-600 underline decoration-emerald-200 underline-offset-8">
                      Fixed Right Before You.
                    </span>
                  </h1>

                  <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
                    No data wipe. No waiting days. Bring your iPhone, Samsung, or Redmi for instant display, battery, or charging port repair with original-grade parts and shop warranty.
                  </p>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                    <Button
                      size="lg"
                      onClick={() => {
                        document.getElementById("signature-repairs")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="bg-slate-900 hover:bg-black text-white font-bold h-12 px-6 rounded-xl shadow-lg flex items-center justify-center gap-2"
                    >
                      <Wrench className="h-4 w-4 text-emerald-400" />
                      View Repair Pricing
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => openRepairWhatsApp(repairs[0] || { title: "Display Replacement", price: "₹1,500" })}
                      className="border-emerald-500/40 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold h-12 px-6 rounded-xl flex items-center justify-center gap-2"
                    >
                      <MessageSquare className="h-4 w-4 text-emerald-600" />
                      WhatsApp Booking
                    </Button>
                  </div>
                </>
              )}

              {/* 3 Core Guarantee Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-4 border-t border-slate-200 max-w-lg">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>30-Min Express Repair</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                  <span>32-Point Inspected Phones</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0" />
                  <span>Genuine Parts Warranty</span>
                </div>
              </div>
            </div>

            {/* Right Column: Dynamic Interactive Showcase Card (5 Cols) */}
            <div className="lg:col-span-5" data-reveal="right">
              {heroIntent === "buy" ? (
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl relative overflow-hidden">
                  <div className="flex items-center justify-between mb-4">
                    <Badge className="bg-blue-600 text-white font-bold text-xs">FEATURED DEAL</Badge>
                    <span className="text-xs text-emerald-600 font-bold">100% INVENTORY READY</span>
                  </div>

                  <div className="py-6 flex items-center justify-center min-h-[200px]">
                    {heroPhone?.product_photos && heroPhone.product_photos[0] ? (
                      <img
                        src={heroPhone.product_photos[0]}
                        alt={heroPhone.phone_name}
                        className="h-56 object-contain drop-shadow-xl transition-transform duration-500 hover:scale-105"
                      />
                    ) : (
                      <Smartphone className="h-44 w-44 text-blue-200 stroke-1" />
                    )}
                  </div>

                  <div className="space-y-2 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-extrabold text-xl text-slate-900">{heroPhone?.phone_name || "Apple iPhone 15"}</h3>
                        <p className="text-xs text-slate-500 font-medium">
                          {heroPhone?.model} • {heroPhone?.variant || "128GB"} • {heroPhone?.condition || "Pristine"}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-400 block font-medium">OFFER PRICE</span>
                        <span className="text-2xl font-black text-blue-600">
                          ₹{Number(heroPhone?.selling_price || 52000).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <Button
                      onClick={() => openWhatsApp(heroPhone)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-11 rounded-xl shadow-md mt-2"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      CLAIM THIS PHONE ON WHATSAPP
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl relative overflow-hidden">
                  <div className="flex items-center justify-between mb-4">
                    <Badge className="bg-emerald-500 text-black font-black text-xs">LIVE WORKSHOP</Badge>
                    <span className="text-xs text-slate-400">ESTIMATED 30-45 MINS</span>
                  </div>

                  <div className="py-4 space-y-3">
                    {repairs.slice(0, 3).map((r, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                        <div className="flex items-center gap-3">
                          <span className="text-xl p-1.5 bg-slate-700 rounded-lg">{r.icon}</span>
                          <div>
                            <div className="font-bold text-sm text-white">{r.title}</div>
                            <div className="text-[11px] text-slate-400">{r.duration}</div>
                          </div>
                        </div>
                        <span className="font-black text-emerald-400 text-sm">{r.price}</span>
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={() => {
                      document.getElementById("signature-repairs")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-11 rounded-xl shadow-md mt-4"
                  >
                    SEE ALL REPAIR OPTIONS ({repairs.length})
                  </Button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 4. Flagship Repair Showcase (Placed Upfront for High Conversion) */}
      {config.showRepairs && (
        <section id="signature-repairs" className="py-12 sm:py-20 px-4 sm:px-6 bg-slate-900 text-white">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-xl mx-auto mb-10 sm:mb-12">
              <span className="text-xs font-bold text-emerald-400 tracking-wider uppercase">
                PHONEZONE WORKSHOP &amp; LAB
              </span>
              <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white mt-1">
                Express Mobile &amp; Tablet Repairs
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-2">
                30–60 minute turnaround right before you in Store Lab with genuine parts &amp; shop warranty.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {repairs.map((rep, idx) => (
                <div
                  key={rep.id || idx}
                  data-reveal="fade"
                  className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5 sm:p-6 flex flex-col justify-between hover:border-blue-500 transition-all hover:-translate-y-1"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-2xl sm:text-3xl p-2.5 rounded-xl bg-slate-700/80">{rep.icon}</span>
                      <span className="px-2.5 py-1 rounded-full bg-slate-700 text-slate-300 font-semibold text-xs">
                        {rep.duration}
                      </span>
                    </div>

                    <h3 className="font-extrabold text-base sm:text-lg text-white mb-1.5">{rep.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed mb-4">{rep.description}</p>
                  </div>

                  <div className="pt-4 border-t border-slate-700/80 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">STARTING FROM</span>
                      <span className="text-lg sm:text-xl font-black text-emerald-400">{rep.price}</span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => openRepairWhatsApp(rep)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-md min-h-[44px]"
                    >
                      Book Repair
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 5. Flagship Category Discovery Strip & Phone Inventory */}
      {config.showPhones && (
        <section id="signature-phones" className="py-12 sm:py-20 px-4 sm:px-6 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 sm:mb-10" data-reveal="fade">
            <div>
              <span className="text-xs font-bold text-blue-600 tracking-wider uppercase">
                PHONEZONE VERIFIED INVENTORY
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight mt-1">
                Featured Smartphones
              </h2>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: "ALL", label: `All Phones (${phones.length})` },
                { id: "IPHONE", label: "Apple iPhones" },
                { id: "ANDROID", label: "Android Devices" },
                { id: "BUDGET", label: "Under ₹20,000" },
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCategory(c.id)}
                  className={`px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-bold transition-all ${
                    activeCategory === c.id
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/25"
                      : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Phone Layout Rendering based on config.phoneDisplayMode */}
          {config.phoneDisplayMode && config.phoneDisplayMode !== "grid" ? (
            <div className="w-full">
              <FeaturedPhones
                theme="modern"
                displayMode={config.phoneDisplayMode}
                whatsappNumber={whatsappNumber}
                phonePrimary={phonePrimary}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {filteredPhones.map((phone, idx) => (
                <div
                  key={phone.id || idx}
                  data-reveal="zoom"
                  className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:shadow-xl transition-all duration-300 hover:-translate-y-1.5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs mb-3">
                      <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 font-semibold text-[10px]">
                        {phone.condition || "Tested Grade A"}
                      </Badge>
                      {phone.rating && (
                        <span className="flex items-center gap-1 text-amber-500 font-bold text-xs">
                          <Star className="h-3 w-3 fill-amber-400" /> {phone.rating}
                        </span>
                      )}
                    </div>

                    <h3 className="font-extrabold text-base text-slate-900 line-clamp-1">{phone.phone_name}</h3>
                    <p className="text-xs text-slate-500 mb-3">{phone.model} • {phone.variant || "Standard"}</p>

                    <div className="py-4 flex items-center justify-center min-h-[160px]">
                      {phone.product_photos && phone.product_photos[0] ? (
                        <img
                          src={phone.product_photos[0]}
                          alt={phone.phone_name}
                          className="h-36 object-contain transition-transform duration-300 hover:scale-105"
                        />
                      ) : (
                        <Smartphone className="h-24 w-24 text-slate-200" />
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex flex-col gap-3">
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="text-xl font-black text-slate-900">
                        ₹{Number(phone.selling_price || 0).toLocaleString()}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-600">
                        Bill &amp; Box ✓
                      </span>
                    </div>

                    <Button
                      onClick={() => openWhatsApp(phone)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 rounded-xl shadow-xs min-h-[44px]"
                    >
                      <MessageSquare className="h-3.5 w-3.5 mr-1" /> Lock Deal on WhatsApp
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 6. Store Visit & Location Hub */}
      <section className="py-16 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="bg-blue-50 border border-blue-200 rounded-3xl p-8 sm:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3 max-w-xl text-center md:text-left">
            <Badge className="bg-blue-600 text-white font-bold text-xs">VISIT OUR SITAPUR STORE</Badge>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Get Hands-On With Your Next Phone
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Walk into our store to inspect devices, test cameras, verify battery health reports, or get instant 30-minute repair service.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-2 text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-blue-600" /> {contact?.address || ""}
              </span>
              <span className="flex items-center gap-1.5">
                <Phone className="h-4 w-4 text-emerald-600" /> {phonePrimary || ""}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            {contact?.google_business_url && (
              <Button
                asChild
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-11 px-6 rounded-xl"
              >
                <a href={contact.google_business_url} target="_blank" rel="noreferrer">
                  <MapPin className="h-4 w-4 mr-1.5" /> Open Google Maps
                </a>
              </Button>
            )}
            <Button
              onClick={() => openWhatsApp()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-11 px-6 rounded-xl"
            >
              <MessageSquare className="h-4 w-4 mr-1.5" /> Chat on WhatsApp
            </Button>
          </div>
        </div>
      </section>

      {/* 7. Flagship Footer */}
      <footer className="bg-slate-900 text-white py-12 px-4 sm:px-6 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <span className="font-extrabold text-white text-base">{businessName}</span>
            <p className="mt-0.5">{contact?.address || "Store Lab, UP"}</p>
          </div>
          <div className="flex items-center gap-4">
            {phonePrimary && <span>Hotline: {phonePrimary}</span>}
            {targetWa && (
              <a href={`https://wa.me/${targetWa}`} target="_blank" rel="noreferrer" className="text-emerald-400 font-bold hover:underline">
                WhatsApp Live
              </a>
            )}
          </div>
          <div>&copy; {new Date().getFullYear()} {businessName}. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
};

