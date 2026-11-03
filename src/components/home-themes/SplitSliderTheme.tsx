import React, { useState } from "react";
import { ThemeProps } from "./types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Smartphone,
  Wrench,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  ArrowRight,
  Battery,
  Cpu,
  Eye,
  Sliders,
  PhoneCall,
} from "lucide-react";

export const SplitSliderTheme: React.FC<ThemeProps> = ({
  contact,
  phones,
  repairs,
  config,
  onOpenAdmin,
  onNavigateTrack,
  whatsappNumber,
  phonePrimary,
}) => {
  const [activePhoneIndex, setActivePhoneIndex] = useState<number>(0);
  const [brandFilter, setBrandFilter] = useState<string>("ALL");

  const businessName = contact?.business_name || "PhoneZone";
  const tagline = contact?.business_tagline || "Dual-Inspection Showcase • Certified Quality";
  const cleanWa = (whatsappNumber || phonePrimary || "").replace(/\D/g, "");
  const targetWa = cleanWa ? (cleanWa.length === 10 ? `91${cleanWa}` : cleanWa) : "";

  const featured = phones[activePhoneIndex] || phones[0] || null;

  const openWhatsApp = (phone?: any) => {
    const item = phone || featured;
    const text = item
      ? `Hi ${businessName}! I want to buy the inspected ${item.phone_name} (${item.storage || "128GB"}) for ₹${Number(item.selling_price || 0).toLocaleString()} listed on your Split Slider store.`
      : `Hi ${businessName}! I am browsing your phone inventory.`;
    if (targetWa) {
      window.open(`https://wa.me/${targetWa}?text=${encodeURIComponent(text)}`, "_blank");
    }
  };

  const openRepairWhatsApp = (repair: any) => {
    const text = `Hi ${businessName}! I want to book ${repair.title} (₹${repair.price}) at your repair lab.`;
    if (targetWa) {
      window.open(`https://wa.me/${targetWa}?text=${encodeURIComponent(text)}`, "_blank");
    }
  };

  const filteredPhones = phones.filter((p) => {
    if (brandFilter === "ALL") return true;
    if (brandFilter === "APPLE") return /apple|iphone/i.test(p.phone_name || "");
    if (brandFilter === "ANDROID") return !/apple|iphone/i.test(p.phone_name || "");
    if (brandFilter === "BUDGET") return Number(p.selling_price || 0) <= 20000;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-teal-500 selection:text-slate-950">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500 text-slate-950 flex items-center justify-center font-black shadow-md shadow-teal-500/20">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <span className="font-extrabold text-lg text-white tracking-tight">
                {businessName}
              </span>
              <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-950 border border-teal-800 text-teal-300">
                SPLIT SLIDER
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              onClick={onNavigateTrack}
              variant="outline"
              size="sm"
              className="border-slate-700 bg-slate-800 text-slate-300 hover:text-white text-xs rounded-xl"
            >
              <Clock className="h-3.5 w-3.5 mr-1 text-teal-400" />
              Track Repair
            </Button>
            <Button
              onClick={() => openWhatsApp()}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-950/40"
            >
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

      {/* Main Split Hero (Dual Pane) */}
      {featured && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left Pane: Device Canvas & Inspection Preview */}
            <div className="lg:col-span-7 bg-gradient-to-br from-slate-850 via-slate-800 to-slate-900 rounded-3xl border border-slate-700/80 p-6 sm:p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between z-10">
                <Badge className="bg-teal-950 border border-teal-700 text-teal-300 font-bold px-3 py-1">
                  LIVE INSPECTION STAGE
                </Badge>
                <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                  <CheckCircle2 className="h-3.5 w-3.5 text-teal-400" />
                  32-POINT VERIFIED
                </span>
              </div>

              {/* Center Device Visual */}
              <div className="my-8 flex items-center justify-center min-h-[260px] sm:min-h-[320px] relative">
                <div className="absolute w-64 h-64 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />
                {(() => {
                  const img = featured.product_photos?.[0] || featured.photo_url || featured.image_url;
                  return img ? (
                    <img
                      src={img}
                      alt={featured.phone_name}
                      className="max-h-72 w-auto object-contain drop-shadow-[0_20px_35px_rgba(0,0,0,0.8)] transition-transform hover:scale-105 duration-300"
                    />
                  ) : (
                    <div className="text-center p-8 text-teal-400/80">
                      <Smartphone className="h-28 w-28 mx-auto stroke-1 mb-2" />
                      <p className="text-xs text-slate-400">Hardware Grade A+ Certified</p>
                    </div>
                  );
                })()}
              </div>

              {/* Device Selector Thumbnails */}
              <div className="z-10 pt-4 border-t border-slate-700/60">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Select Model to Inspect:
                </p>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                  {phones.slice(0, 6).map((item, idx) => (
                    <button
                      key={item.id || idx}
                      onClick={() => setActivePhoneIndex(idx)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                        activePhoneIndex === idx
                          ? "bg-teal-500 text-slate-950 border-teal-400 shadow-md"
                          : "bg-slate-800/80 text-slate-300 border-slate-700 hover:border-slate-500"
                      }`}
                    >
                      {item.phone_name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Pane: Spec Breakdown & Instant Order */}
            <div className="lg:col-span-5 bg-slate-850/90 rounded-3xl border border-slate-700/80 p-6 sm:p-8 flex flex-col justify-between shadow-2xl">
              <div className="space-y-6">
                <div>
                  <Badge className="bg-slate-800 border border-slate-700 text-slate-300 text-xs mb-2">
                    {featured.condition || "Used • Like New"}
                  </Badge>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                    {featured.phone_name}
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Model: {featured.model || "Official Indian Unit"} • IMEI Tested
                  </p>
                </div>

                {/* Price Box */}
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-baseline justify-between">
                  <div>
                    <span className="text-xs text-slate-400 block font-semibold">Special Storefront Price</span>
                    <span className="text-3xl font-black text-teal-400">
                      ₹{Number(featured.selling_price || 0).toLocaleString()}
                    </span>
                  </div>
                  {featured.original_price && Number(featured.original_price) > Number(featured.selling_price) && (
                    <div className="text-right">
                      <span className="text-xs text-slate-500 line-through block">
                        ₹{Number(featured.original_price).toLocaleString()}
                      </span>
                      <span className="text-xs font-bold text-rose-400">Save ₹{(Number(featured.original_price) - Number(featured.selling_price)).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Spec Highlights Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                    <span className="text-[10px] text-slate-400 block">Storage</span>
                    <span className="font-bold text-sm text-white">{featured.storage || "128 GB"}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                    <span className="text-[10px] text-slate-400 block">RAM</span>
                    <span className="font-bold text-sm text-white">{featured.ram || "6 GB"}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                    <span className="text-[10px] text-slate-400 block">Battery Health</span>
                    <span className="font-bold text-sm text-emerald-400 flex items-center gap-1">
                      <Battery className="h-3.5 w-3.5" />
                      {featured.battery_health ? `${featured.battery_health}%` : "88%+"}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                    <span className="text-[10px] text-slate-400 block">Warranty</span>
                    <span className="font-bold text-sm text-teal-400">7 Days Testing</span>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-teal-400 flex-shrink-0" />
                    <span>Clean IMEI with verified seller KYC records</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-teal-400 flex-shrink-0" />
                    <span>Original display & touch responsiveness tested</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-teal-400 flex-shrink-0" />
                    <span>Free shop invoice with GST/Udyam receipt</span>
                  </div>
                </div>
              </div>

              {/* Instant WhatsApp Action */}
              <div className="pt-6">
                <Button
                  onClick={() => openWhatsApp(featured)}
                  className="w-full h-12 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2 transition-transform active:scale-95"
                >
                  <Smartphone className="h-4 w-4" />
                  Claim This Phone on WhatsApp
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Full Inventory Catalog Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 border-t border-slate-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              All Available Smartphones ({phones.length})
            </h2>
            <p className="text-xs text-slate-400">
              Inspected in store, ready for instant counter purchase or delivery.
            </p>
          </div>

          <div className="flex gap-2">
            {[
              { id: "ALL", label: "All" },
              { id: "APPLE", label: "Apple" },
              { id: "ANDROID", label: "Android" },
              { id: "BUDGET", label: "Under ₹20K" },
            ].map((b) => (
              <button
                key={b.id}
                onClick={() => setBrandFilter(b.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  brandFilter === b.id
                    ? "bg-teal-500 text-slate-950"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredPhones.map((phone, idx) => (
            <div
              key={phone.id || idx}
              className="bg-slate-850 rounded-2xl border border-slate-700/70 p-4 hover:border-teal-500/50 transition-all flex flex-col justify-between space-y-3 group"
            >
              <div className="space-y-3">
                <div className="h-40 rounded-xl bg-slate-900 flex items-center justify-center overflow-hidden">
                  {(() => {
                    const img = phone.product_photos?.[0] || phone.photo_url || phone.image_url;
                    return img ? (
                      <img
                        src={img}
                        alt={phone.phone_name}
                        className="h-36 w-auto object-contain group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <Smartphone className="h-12 w-12 text-slate-600" />
                    );
                  })()}
                </div>

                <div>
                  <h4 className="font-bold text-sm text-white group-hover:text-teal-300 transition-colors line-clamp-1">
                    {phone.phone_name}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {phone.storage || "128 GB"} • {phone.color || "Standard"}
                  </p>
                </div>

                <div className="flex items-baseline justify-between pt-1 border-t border-slate-800">
                  <span className="font-black text-lg text-teal-400">
                    ₹{Number(phone.selling_price || 0).toLocaleString()}
                  </span>
                  <Badge className="bg-slate-800 text-slate-300 text-[10px]">
                    {phone.condition || "Inspected"}
                  </Badge>
                </div>
              </div>

              <Button
                onClick={() => openWhatsApp(phone)}
                size="sm"
                className="w-full bg-slate-800 hover:bg-teal-500 hover:text-slate-950 text-slate-200 font-bold text-xs rounded-xl transition-colors"
              >
                Buy on WhatsApp
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Repair Services Section */}
      {config.showRepairs !== false && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 border-t border-slate-800">
          <div className="mb-6">
            <h2 className="text-xl sm:text-2xl font-black text-white">
              PhoneZone Repair Workshop
            </h2>
            <p className="text-xs text-slate-400">
              Expert technicians, ESD-safe workstation, transparent flat pricing.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {repairs
              .filter((r) => r.active !== false)
              .map((repair) => (
                <div
                  key={repair.id}
                  className="p-5 rounded-2xl bg-slate-850 border border-slate-800 hover:border-slate-700 flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{repair.icon || "🔧"}</span>
                    <Badge className="bg-teal-950 text-teal-300 border border-teal-800 font-bold">
                      {repair.price}
                    </Badge>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">{repair.title}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">{repair.description}</p>
                    <span className="text-[11px] text-teal-400 mt-1 block">
                      Typical time: {repair.duration}
                    </span>
                  </div>
                  <Button
                    onClick={() => openRepairWhatsApp(repair)}
                    size="sm"
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs rounded-xl"
                  >
                    Book Repair
                  </Button>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-8 px-4 text-center text-xs text-slate-500">
        <p className="text-slate-400 font-bold">
          {businessName} • {contact?.address || ""}
        </p>
        <p className="mt-1">
          Phone: {phonePrimary || ""} | WhatsApp: {whatsappNumber || phonePrimary || ""}
        </p>
      </footer>
    </div>
  );
};

