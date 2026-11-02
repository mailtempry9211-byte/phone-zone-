import React, { useState } from "react";
import { ThemeProps } from "./types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Smartphone,
  Wrench,
  ShieldCheck,
  Star,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  ArrowRight,
  TrendingUp,
  Tag,
  Flame,
  Award,
  Instagram,
  ExternalLink,
} from "lucide-react";

export const BentoProTheme: React.FC<ThemeProps> = ({
  contact,
  phones,
  repairs,
  config,
  onOpenAdmin,
  onNavigateTrack,
  whatsappNumber,
  phonePrimary,
}) => {
  const [selectedBrand, setSelectedBrand] = useState<string>("ALL");

  const businessName = contact?.business_name || "PhoneZone";
  const tagline = contact?.business_tagline || "Engineered for Quality • Certified Pre-Owned";
  const cleanWa = (whatsappNumber || phonePrimary || "").replace(/\D/g, "");
  const targetWa = cleanWa ? (cleanWa.length === 10 ? `91${cleanWa}` : cleanWa) : "";

  const openWhatsApp = (phone?: any) => {
    const text = phone
      ? `Hi! I want to buy the ${phone.phone_name} (${phone.model || ""}) for ₹${Number(phone.selling_price || 0).toLocaleString()} listed on PhoneZone Bento.`
      : `Hi ${businessName}! I'm checking your verified phone stock.`;
    if (targetWa) {
      window.open(`https://wa.me/${targetWa}?text=${encodeURIComponent(text)}`, "_blank");
    }
  };

  const openRepairWhatsApp = (repair: any) => {
    const text = `Hi! I'd like to book ${repair.title} (₹${repair.price}) at PhoneZone Workshop.`;
    if (targetWa) {
      window.open(`https://wa.me/${targetWa}?text=${encodeURIComponent(text)}`, "_blank");
    }
  };

  const heroPhone = phones[0] || null;

  const filteredPhones = phones.filter((p) => {
    if (selectedBrand === "ALL") return true;
    if (selectedBrand === "APPLE") return /apple|iphone/i.test(p.phone_name || "");
    if (selectedBrand === "ANDROID") return !/apple|iphone/i.test(p.phone_name || "");
    if (selectedBrand === "BUDGET") return Number(p.selling_price || 0) <= 20000;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans selection:bg-emerald-500 selection:text-black">
      {/* 1. Bento Top Header */}
      <header className="sticky top-0 z-40 bg-[#070b14]/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-400 flex items-center justify-center font-black text-black text-base shadow-lg shadow-emerald-500/20">
              PZ
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-white flex items-center gap-2">
                {businessName}
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  BENTO PRO
                </span>
              </span>
              <p className="text-[11px] text-slate-400 hidden sm:block">{tagline}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {contact?.instagram && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-8 px-2.5 text-xs font-bold border-pink-500/40 bg-pink-500/10 text-pink-300 hover:bg-pink-500/20"
              >
                <a href={`https://instagram.com/${contact.instagram.replace(/^@+/, "")}`} target="_blank" rel="noreferrer">
                  <Instagram className="h-3.5 w-3.5 mr-1 text-pink-400" />
                  <span className="hidden sm:inline">@{contact.instagram.replace(/^@+/, "")}</span>
                </a>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateTrack}
              className="h-8 px-3 text-xs border-slate-700 bg-slate-900/80 text-slate-300 hover:text-white"
            >
              <Clock className="h-3.5 w-3.5 mr-1 text-emerald-400" />
              Track Repair
            </Button>
            <Button
              size="sm"
              onClick={() => openWhatsApp()}
              className="h-8 px-3.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black shadow-md shadow-emerald-500/20"
            >
              WhatsApp Support
            </Button>
            <button
              onClick={() => onOpenAdmin()}
              title="Admin Panel"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors ml-1"
            >
              ⚙️
            </button>
          </div>
        </div>
      </header>

      {/* 2. Bento Grid Hero Section */}
      <section className="py-8 sm:py-12 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Tile 1: Featured Flagship Hero (Span 2) */}
          <div className="md:col-span-2 lg:col-span-2 bg-gradient-to-br from-slate-900 via-[#0d1424] to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden group shadow-xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />

            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <Flame className="h-3 w-3 text-emerald-400" />
                  FLAGSHIP SHOWCASE
                </span>
                <span className="text-xs text-slate-400">100% In-Stock</span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                {heroPhone ? heroPhone.phone_name : "Premium Certified Phones"}
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                  Save Up To 60%
                </span>
              </h1>

              <p className="text-xs sm:text-sm text-slate-400 mt-2.5 max-w-md">
                Every smartphone goes through our rigorous 32-point diagnostic inspection with genuine bill, box, and testing warranty.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {heroPhone && (
                <Button
                  onClick={() => openWhatsApp(heroPhone)}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-500/25"
                >
                  Buy {heroPhone.model} • ₹{Number(heroPhone.selling_price || 0).toLocaleString()}
                </Button>
              )}
              <a
                href="#bento-phones"
                className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-2 flex items-center gap-1"
              >
                <span>Browse {phones.length} Phones</span>
                <ArrowRight className="h-3.5 w-3.5 text-emerald-400" />
              </a>
            </div>
          </div>

          {/* Tile 2: 30-Min Express Repair */}
          <div className="bg-[#0b101c] border border-slate-800 rounded-3xl p-6 flex flex-col justify-between shadow-xl">
            <div>
              <div className="h-10 w-10 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 mb-4">
                <Wrench className="h-5 w-5" />
              </div>
              <h3 className="font-extrabold text-base text-white">30-Min Express Repair</h3>
              <p className="text-xs text-slate-400 mt-1">
                Display, battery &amp; charging port fixed right in front of you with 6-month warranty.
              </p>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-teal-300">FROM ₹300</span>
              <a
                href="#bento-repairs"
                className="text-xs text-teal-400 hover:text-teal-300 font-bold flex items-center gap-1"
              >
                <span>View Rates</span>
                <ArrowRight className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* Tile 3: Trust & Verification */}
          <div className="bg-[#0b101c] border border-slate-800 rounded-3xl p-6 flex flex-col justify-between shadow-xl">
            <div>
              <div className="h-10 w-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="font-extrabold text-base text-white">Govt. Udyam Certified</h3>
              <p className="text-xs text-slate-400 mt-1">
                Authentic GST invoices &amp; IMEI warranty cards for 100% legal buyer protection.
              </p>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800">
              <span className="text-[11px] font-mono text-slate-400">
                {contact?.udyam_number || ""}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Phone Catalog Section */}
      {config.showPhones && (
        <section id="bento-phones" className="py-12 px-4 sm:px-6 max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <span className="text-xs font-mono font-bold text-emerald-400 tracking-wider uppercase">
                // CERTIFIED HARDWARE
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
                Available Phone Inventory
              </h2>
            </div>

            {/* Brand Filter */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: "ALL", label: `All Devices (${phones.length})` },
                { id: "APPLE", label: "Apple" },
                { id: "ANDROID", label: "Android" },
                { id: "BUDGET", label: "Under ₹20,000" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedBrand(f.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    selectedBrand === f.id
                      ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
                      : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {filteredPhones.map((phone, idx) => (
              <div
                key={phone.id || idx}
                className="bg-[#0b101c] border border-slate-800 rounded-3xl p-5 hover:border-emerald-500/40 transition-all duration-300 flex flex-col justify-between group shadow-lg hover:-translate-y-1"
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-3">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      {phone.condition || "TESTED A+"}
                    </span>
                    <span className="text-xs font-bold text-slate-400">{phone.variant || "Standard"}</span>
                  </div>

                  <h3 className="font-extrabold text-base text-white line-clamp-1">{phone.phone_name}</h3>
                  <p className="text-xs text-slate-400 mb-3">{phone.model || phone.phone_name}</p>

                  <div className="py-4 flex items-center justify-center min-h-[150px]">
                    {phone.product_photos && phone.product_photos[0] ? (
                      <img
                        src={phone.product_photos[0]}
                        alt={phone.phone_name}
                        className="h-36 object-contain group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <Smartphone className="h-20 w-20 text-slate-700" />
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80">
                  <div className="flex items-baseline justify-between mb-3">
                    <div>
                      <span className="text-lg font-black text-white">
                        ₹{Number(phone.selling_price || 0).toLocaleString()}
                      </span>
                      <p className="text-[10px] text-slate-500">Shop Bill + Warranty</p>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 font-bold">READY TO DISPATCH</span>
                  </div>

                  <Button
                    onClick={() => openWhatsApp(phone)}
                    className="w-full bg-emerald-500/15 hover:bg-emerald-500 text-emerald-300 hover:text-black font-bold text-xs py-2 rounded-xl border border-emerald-500/30 transition-all"
                  >
                    Claim on WhatsApp
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. Repair Services Section */}
      <section id="bento-repairs" className="py-16 px-4 sm:px-6 max-w-7xl mx-auto border-t border-slate-800/80">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs font-mono font-bold text-teal-400 tracking-wider uppercase">
            // RAPID WORKSHOP REPAIRS
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
            Express Mobile &amp; Tablet Services
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-2">
            Professional diagnosis with high-grade components and transparent upfront pricing.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {repairs.map((rep) => (
            <div
              key={rep.id}
              className="bg-[#0b101c] border border-slate-800 rounded-3xl p-5 hover:border-teal-500/40 transition-all flex flex-col justify-between shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{rep.icon}</span>
                  <span className="text-[10px] font-mono text-teal-300 bg-teal-500/15 px-2 py-0.5 rounded-full border border-teal-500/30">
                    {rep.duration}
                  </span>
                </div>
                <h3 className="font-extrabold text-base text-white">{rep.title}</h3>
                <p className="text-xs text-slate-400 mt-1">{rep.description}</p>
              </div>

              <div className="pt-4 border-t border-slate-800/80 mt-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 block">ESTIMATED COST</span>
                  <span className="text-base font-black text-teal-300">{rep.price}</span>
                </div>
                <Button
                  size="sm"
                  onClick={() => openRepairWhatsApp(rep)}
                  className="bg-teal-500/20 hover:bg-teal-500 text-teal-300 hover:text-black font-bold text-xs rounded-xl border border-teal-500/30"
                >
                  Book Repair
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Footer */}
      <footer className="py-8 px-4 border-t border-slate-800 bg-[#05070e] text-center text-xs text-slate-500">
        <p>© 2026 {businessName}. All rights reserved. Local, UP, India.</p>
      </footer>
    </div>
  );
};
export default BentoProTheme;

