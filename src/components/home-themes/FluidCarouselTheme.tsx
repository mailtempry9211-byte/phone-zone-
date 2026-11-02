import React, { useState, useRef } from "react";
import { ThemeProps } from "./types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Smartphone,
  Wrench,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Flame,
  Sparkles,
  Zap,
  SlidersHorizontal,
  Clock,
  CheckCircle2,
  PhoneCall,
  Search,
} from "lucide-react";

export const FluidCarouselTheme: React.FC<ThemeProps> = ({
  contact,
  phones,
  repairs,
  config,
  onOpenAdmin,
  onNavigateTrack,
  whatsappNumber,
  phonePrimary,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<string>("ALL");
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  const businessName = contact?.business_name || "PhoneZone";
  const tagline = contact?.business_tagline || "Fluid Motion • Ultra Fast Mobile Showcase";
  const cleanWa = (whatsappNumber || phonePrimary || "").replace(/\D/g, "");
  const targetWa = cleanWa ? (cleanWa.length === 10 ? `91${cleanWa}` : cleanWa) : "";

  const openWhatsApp = (phone?: any) => {
    const text = phone
      ? `Hi ${businessName}! I am interested in buying ${phone.phone_name} (${phone.model || ""}) for ₹${Number(phone.selling_price || 0).toLocaleString()} from your Fluid Carousel store.`
      : `Hi ${businessName}! I am browsing your phone inventory.`;
    if (targetWa) {
      window.open(`https://wa.me/${targetWa}?text=${encodeURIComponent(text)}`, "_blank");
    }
  };

  const openRepairWhatsApp = (repair: any) => {
    const text = `Hi ${businessName}! I want to book ${repair.title} (Starting at ${repair.price}).`;
    if (targetWa) {
      window.open(`https://wa.me/${targetWa}?text=${encodeURIComponent(text)}`, "_blank");
    }
  };

  const filteredPhones = phones.filter((p) => {
    if (selectedFilter === "ALL") return true;
    if (selectedFilter === "APPLE") return /apple|iphone/i.test(p.phone_name || "");
    if (selectedFilter === "ANDROID") return !/apple|iphone/i.test(p.phone_name || "");
    if (selectedFilter === "UNDER20K") return Number(p.selling_price || 0) <= 20000;
    return true;
  });

  const scrollCarousel = (direction: "left" | "right") => {
    if (carouselRef.current) {
      const scrollAmount = direction === "left" ? -340 : 340;
      carouselRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  const currentHeroPhone = filteredPhones[activeIndex] || phones[0] || null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-violet-600 selection:text-white">
      {/* Top Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-violet-600/20 via-fuchsia-600/10 to-transparent blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-xl border-b border-violet-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-600/30">
              <SlidersHorizontal className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-violet-200 to-fuchsia-300 bg-clip-text text-transparent">
                {businessName}
              </span>
              <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-950 border border-violet-800/60 text-violet-300">
                FLUID 3D
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              onClick={onNavigateTrack}
              variant="outline"
              size="sm"
              className="border-violet-800/50 bg-slate-900/80 text-violet-300 hover:bg-violet-900/40 text-xs rounded-xl"
            >
              <Clock className="h-3.5 w-3.5 mr-1" />
              Track Repair
            </Button>
            <Button
              onClick={() => openWhatsApp()}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-900/30"
            >
              <Smartphone className="h-3.5 w-3.5 mr-1.5" />
              WhatsApp
            </Button>
            <Button
              onClick={() => onOpenAdmin()}
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-white text-xs"
            >
              Staff
            </Button>
          </div>
        </div>
      </header>

      {/* Main Fluid Showcase Hero */}
      <section className="relative pt-10 pb-16 px-4 sm:px-6 max-w-7xl mx-auto overflow-hidden">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-900/30 border border-violet-700/40 text-violet-300 text-xs font-semibold backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-violet-400 animate-spin" />
            Smooth Motion Fluid Carousel • 32-Point Verified Devices
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            Swipe. Inspect.{" "}
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
              Own Premium Phones.
            </span>
          </h1>
          <p className="text-slate-400 text-sm sm:text-base">{tagline}</p>

          {/* Quick Filter Bar */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {[
              { id: "ALL", label: `All Devices (${phones.length})` },
              { id: "APPLE", label: "Apple iPhones" },
              { id: "ANDROID", label: "Android Flagships" },
              { id: "UNDER20K", label: "Under ₹20,000" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedFilter(f.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  selectedFilter === f.id
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-600/40"
                    : "bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white hover:border-violet-700/50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Carousel Navigation Arrows */}
        <div className="flex items-center justify-between mb-4 px-2">
          <span className="text-xs font-semibold text-slate-400">
            Showing <strong className="text-white">{filteredPhones.length}</strong> phones available right now:
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => scrollCarousel("left")}
              className="p-2 rounded-xl bg-slate-900 border border-violet-900/40 text-violet-300 hover:bg-violet-950 transition-colors"
              aria-label="Previous"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => scrollCarousel("right")}
              className="p-2 rounded-xl bg-slate-900 border border-violet-900/40 text-violet-300 hover:bg-violet-950 transition-colors"
              aria-label="Next"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Fluid Horizontal Scrollable Stage */}
        <div
          ref={carouselRef}
          className="flex gap-5 overflow-x-auto pb-6 pt-2 scroll-smooth no-scrollbar snap-x snap-mandatory"
          style={{ scrollbarWidth: "none" }}
        >
          {filteredPhones.length === 0 ? (
            <div className="w-full text-center py-16 bg-slate-900/40 rounded-3xl border border-slate-800">
              <Smartphone className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-300 font-semibold">No phones matching this filter right now.</p>
              <Button
                onClick={() => setSelectedFilter("ALL")}
                variant="outline"
                size="sm"
                className="mt-4 border-violet-700 text-violet-300"
              >
                Show All Inventory
              </Button>
            </div>
          ) : (
            filteredPhones.map((phone, idx) => {
              const price = Number(phone.selling_price || 0);
              const originalPrice = phone.original_price ? Number(phone.original_price) : 0;
              const discount = originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;

              return (
                <div
                  key={phone.id || idx}
                  className="flex-shrink-0 w-[290px] sm:w-[320px] snap-center bg-gradient-to-b from-slate-900/90 via-slate-900 to-slate-950 rounded-3xl border border-violet-900/30 p-5 shadow-xl hover:border-violet-500/60 hover:shadow-2xl hover:shadow-violet-900/20 transition-all duration-300 flex flex-col justify-between group"
                >
                  <div className="space-y-4">
                    {/* Top tags */}
                    <div className="flex items-center justify-between">
                      <Badge className="bg-violet-950/80 border border-violet-700/50 text-violet-300 text-[10px]">
                        {phone.condition || "Inspected A+"}
                      </Badge>
                      {discount > 0 ? (
                        <Badge className="bg-rose-950 border border-rose-800/60 text-rose-300 text-[10px] font-bold">
                          {discount}% OFF
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-950 border border-emerald-800/60 text-emerald-300 text-[10px]">
                          In Stock
                        </Badge>
                      )}
                    </div>

                    {/* Phone Image Container */}
                    <div className="h-48 rounded-2xl bg-gradient-to-tr from-slate-950 to-violet-950/40 border border-violet-900/20 flex items-center justify-center overflow-hidden relative group-hover:scale-[1.02] transition-transform">
                      {phone.image_url ? (
                        <img
                          src={phone.image_url}
                          alt={phone.phone_name}
                          className="h-44 w-auto object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)]"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-violet-400">
                          <Smartphone className="h-16 w-16 stroke-1 mb-2 opacity-80" />
                          <span className="text-[11px] text-slate-500">Genuine Device</span>
                        </div>
                      )}
                    </div>

                    {/* Phone Details */}
                    <div>
                      <h3 className="font-extrabold text-base text-white line-clamp-1 group-hover:text-violet-300 transition-colors">
                        {phone.phone_name}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {phone.storage || "128 GB"} • {phone.ram ? `${phone.ram} RAM • ` : ""}
                        {phone.color || "Midnight"}
                      </p>
                    </div>

                    {/* Pricing */}
                    <div className="flex items-baseline gap-2 pt-1 border-t border-slate-800/60">
                      <span className="text-2xl font-black text-white">
                        ₹{price.toLocaleString()}
                      </span>
                      {originalPrice > price && (
                        <span className="text-xs text-slate-500 line-through">
                          ₹{originalPrice.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Buy Button */}
                  <div className="pt-4">
                    <Button
                      onClick={() => openWhatsApp(phone)}
                      className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-violet-900/30 flex items-center justify-center gap-1.5"
                    >
                      <Smartphone className="h-3.5 w-3.5" />
                      Buy Instantly on WhatsApp
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Express Repair Services Carousel Section */}
      {config.showRepairs !== false && (
        <section className="py-14 px-4 sm:px-6 max-w-7xl mx-auto border-t border-violet-900/20">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-950 border border-violet-800/50 text-violet-400 text-xs font-semibold mb-2">
                <Wrench className="h-3.5 w-3.5" />
                Workshop & Lab
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                Express Repairs in 30 Minutes
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Original parts, ESD-safe lab inspection, 90-day guarantee.
              </p>
            </div>
            <Button
              onClick={onNavigateTrack}
              variant="outline"
              size="sm"
              className="border-violet-700/60 text-violet-300 hover:bg-violet-900/30 text-xs rounded-xl"
            >
              Track Repair Status
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {repairs
              .filter((r) => r.active !== false)
              .map((repair) => (
                <div
                  key={repair.id}
                  className="bg-slate-900/70 border border-violet-900/30 rounded-2xl p-5 hover:border-violet-500/40 transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-violet-950 border border-violet-800/40 flex items-center justify-center text-lg">
                        {repair.icon || "🔧"}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-white">{repair.title}</h4>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3 text-violet-400" />
                          {repair.duration}
                        </span>
                      </div>
                    </div>
                    <Badge className="bg-emerald-950/80 border border-emerald-800/50 text-emerald-300 font-extrabold text-xs">
                      {repair.price}
                    </Badge>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2">{repair.description}</p>

                  <Button
                    onClick={() => openRepairWhatsApp(repair)}
                    size="sm"
                    className="w-full bg-slate-800 hover:bg-violet-900 text-slate-200 hover:text-white font-semibold text-xs rounded-xl transition-colors"
                  >
                    Book This Repair
                  </Button>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Store Location & Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-10 px-4 text-center text-slate-500 text-xs">
        <div className="max-w-4xl mx-auto space-y-3">
          <p className="text-slate-300 font-semibold">
            {businessName} • {contact?.address || ""}
          </p>
          <p>
            Call: {phonePrimary || ""} | WhatsApp: {whatsappNumber || phonePrimary || ""}
          </p>
          <p className="text-[11px] text-slate-600">
            All devices certified with 32-point hardware inspection. © 2026 {businessName}.
          </p>
        </div>
      </footer>
    </div>
  );
};

