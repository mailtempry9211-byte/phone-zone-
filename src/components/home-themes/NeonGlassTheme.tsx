import React, { useState } from "react";
import { ThemeProps } from "./types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Smartphone,
  Wrench,
  ShieldCheck,
  Zap,
  Activity,
  Cpu,
  Radio,
  Clock,
  Phone,
  MessageSquare,
  ArrowRight,
  ChevronRight,
  ExternalLink,
  Star,
  Settings,
  Sparkles,
  Lock,
} from "lucide-react";
import { useScrollReveal } from "./useScrollReveal";

export const NeonGlassTheme: React.FC<ThemeProps> = ({
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
  const [activeFilter, setActiveFilter] = useState<string>("ALL");

  const businessName = contact?.business_name || "PHONEZONE";
  const tagline = contact?.business_tagline || "CYBER PRECISION • CERTIFIED SMARTPHONES";
  const cleanWa = (whatsappNumber || phonePrimary || "").replace(/\D/g, "");
  const targetWa = cleanWa ? (cleanWa.length === 10 ? `91${cleanWa}` : cleanWa) : "";

  const openWhatsApp = (phone?: any) => {
    const text = phone
      ? `Hello! I would like to lock the deal for ${phone.phone_name} (${phone.model || ""}) listed at ₹${Number(phone.selling_price || 0).toLocaleString()}. Is it available?`
      : `Hello ${businessName}! I'm inquiring about phone inventory & repair services.`;
    if (targetWa) {
      window.open(`https://wa.me/${targetWa}?text=${encodeURIComponent(text)}`, "_blank");
    }
  };

  const openRepairWhatsApp = (repair: any) => {
    const text = `Hello! I need ${repair.title} (approx ${repair.price}). When can I bring my device?`;
    if (targetWa) {
      window.open(`https://wa.me/${targetWa}?text=${encodeURIComponent(text)}`, "_blank");
    }
  };

  const filteredPhones = phones.filter((p) => {
    if (activeFilter === "ALL") return true;
    if (activeFilter === "APPLE") return /apple|iphone/i.test(p.phone_name || "");
    if (activeFilter === "ANDROID") return !/apple|iphone/i.test(p.phone_name || "");
    if (activeFilter === "UNDER20K") return Number(p.selling_price || 0) <= 20000;
    return true;
  });

  const heroPhone = phones[0] || null;

  return (
    <div className="min-h-screen bg-[#06080e] text-slate-100 font-sans selection:bg-cyan-500 selection:text-black relative overflow-x-hidden">
      {/* Dynamic Ambient Neon Blur Backdrops */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none animate-ambient-glow" />
      <div className="absolute top-96 right-10 w-[28rem] h-[28rem] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none animate-ambient-glow" />
      <div className="absolute top-[60rem] left-10 w-96 h-96 bg-purple-500/10 rounded-full blur-[130px] pointer-events-none" />

      {/* 1. Cyber Header Navigation */}
      <header className="sticky top-0 z-40 bg-[#080b13]/85 backdrop-blur-xl border-b border-cyan-500/20 shadow-[0_4px_30px_rgba(6,182,212,0.12)]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {contact?.logo_url ? (
              <img
                src={contact.logo_url}
                alt={businessName}
                className="h-8 sm:h-12 w-auto object-contain drop-shadow-[0_0_12px_rgba(6,182,212,0.4)] shrink-0"
              />
            ) : (
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)] shrink-0">
                <Zap className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-mono text-base sm:text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 truncate">
                  {businessName}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950/80 text-cyan-400 border border-cyan-500/30 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" /> LIVE
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400 font-mono tracking-tight line-clamp-1">
                {tagline}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <button
              onClick={() => document.getElementById("repair-matrix")?.scrollIntoView({ behavior: "smooth" })}
              className="text-xs font-mono font-bold text-cyan-400 hover:text-cyan-300 px-2 py-1 flex items-center gap-1"
            >
              <Wrench className="h-3 w-3" />
              <span className="hidden sm:inline">Repairs</span>
            </button>
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateTrack}
              className="hidden md:inline-flex items-center gap-1.5 border-cyan-500/30 text-cyan-300 hover:bg-cyan-950/40 font-mono text-xs h-9"
            >
              <Radio className="h-3.5 w-3.5 text-cyan-400" />
              Track Repair
            </Button>
            <Button
              size="sm"
              onClick={() => openWhatsApp()}
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs h-8 sm:h-9 px-3 sm:px-4 shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all active:scale-95"
            >
              <MessageSquare className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">WhatsApp Store</span>
              <span className="sm:hidden">WhatsApp</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenAdmin()}
              className="text-slate-400 hover:text-cyan-300 hover:bg-cyan-950/30 h-8 sm:h-9 w-8 sm:w-auto p-1"
              title="Admin Portal"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* 2. Asymmetric Cyber Hero Section */}
      {config.showHero && (
        <section className="relative pt-12 pb-20 sm:pt-20 sm:pb-28 px-4 sm:px-6 max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            {/* Left 7 Cols: Cyber Typography & Value Hook */}
            <div className="lg:col-span-7 space-y-6" data-reveal="left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 text-xs font-mono shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                <Activity className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                <span>32-POINT HARDWARE DIAGNOSTICS • ZERO FRAUD POLICY</span>
              </div>

              <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight leading-tight">
                CERTIFIED <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 drop-shadow-[0_0_30px_rgba(6,182,212,0.4)]">SMARTPHONES</span>.
                <br />
                INSTANT REPAIR MATRIX.
              </h1>

              <p className="text-sm sm:text-base md:text-lg text-slate-300 max-w-xl leading-relaxed">
                {contact?.business_tagline || "Discover rigorously tested second-hand smartphones with genuine displays, original batteries, and authentic bill/box documentation at Local's premiere tech hub."}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  size="lg"
                  onClick={() => {
                    document.getElementById("phones-matrix")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-extrabold h-12 px-6 shadow-[0_0_25px_rgba(6,182,212,0.5)] transition-all hover:scale-105 active:scale-95"
                >
                  <Smartphone className="h-4 w-4 mr-2" />
                  ACCESS INVENTORY ({phones.length})
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    document.getElementById("repair-matrix")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="border-cyan-500/40 text-cyan-300 hover:bg-cyan-950/50 font-mono font-bold h-12 px-6 backdrop-blur-md"
                >
                  <Wrench className="h-4 w-4 mr-2 text-cyan-400" />
                  30-MIN REPAIR BAY
                </Button>
              </div>

              {/* Quick Telemetry Pills */}
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-cyan-500/20 max-w-lg">
                <div className="bg-[#0b101c]/80 border border-cyan-500/30 rounded-xl p-3 text-center">
                  <div className="text-xl sm:text-2xl font-mono font-bold text-cyan-400">100%</div>
                  <div className="text-[10px] text-slate-400 font-mono uppercase">IMEI Verified</div>
                </div>
                <div className="bg-[#0b101c]/80 border border-emerald-500/30 rounded-xl p-3 text-center">
                  <div className="text-xl sm:text-2xl font-mono font-bold text-emerald-400">30 MIN</div>
                  <div className="text-[10px] text-slate-400 font-mono uppercase">Express Fix</div>
                </div>
                <div className="bg-[#0b101c]/80 border border-purple-500/30 rounded-xl p-3 text-center">
                  <div className="text-xl sm:text-2xl font-mono font-bold text-purple-400">7 DAYS</div>
                  <div className="text-[10px] text-slate-400 font-mono uppercase">Warranty</div>
                </div>
              </div>
            </div>

            {/* Right 5 Cols: Floating Futuristic HUD Device Showcase */}
            <div className="lg:col-span-5 relative" data-reveal="right">
              <div className="relative mx-auto max-w-sm rounded-3xl p-1 bg-gradient-to-b from-cyan-500/50 via-emerald-500/20 to-transparent shadow-[0_0_50px_rgba(6,182,212,0.25)]">
                <div className="rounded-[22px] bg-[#0c1220] border border-cyan-500/40 p-6 relative overflow-hidden animate-float-slow">
                  {/* Neon Grid Mesh in Card */}
                  <div className="absolute inset-0 bg-[radial-gradient(#06b6d4_1px,transparent_1px)] [background-size:16px_16px] opacity-15 pointer-events-none" />

                  {/* Header Badge */}
                  <div className="flex items-center justify-between pb-4 border-b border-cyan-500/20">
                    <span className="font-mono text-xs text-cyan-400 font-bold flex items-center gap-1.5">
                      <Cpu className="h-4 w-4" /> HARDWARE LAB
                    </span>
                    <Badge className="bg-emerald-950/80 text-emerald-300 border-emerald-500/40 font-mono text-[10px]">
                      READY FOR DISPATCH
                    </Badge>
                  </div>

                  {/* Device Photo / Visual */}
                  <div className="py-6 flex items-center justify-center relative">
                    {heroPhone?.product_photos && heroPhone.product_photos[0] ? (
                      <img
                        src={heroPhone.product_photos[0]}
                        alt={heroPhone.phone_name}
                        className="h-56 sm:h-64 object-contain filter drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)] transition-transform duration-500 hover:scale-105"
                      />
                    ) : (
                      <div className="h-56 w-44 rounded-2xl bg-cyan-950/50 border border-cyan-500/40 flex flex-col items-center justify-center text-cyan-400 gap-2">
                        <Smartphone className="h-16 w-16 stroke-1 animate-pulse" />
                        <span className="font-mono text-[10px] tracking-wider uppercase">GENUINE DEVICE</span>
                      </div>
                    )}
                  </div>

                  {/* Device Telemetry Specs */}
                  <div className="space-y-3 pt-4 border-t border-cyan-500/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-base text-white font-mono">
                          {heroPhone?.phone_name || "Apple iPhone 15"}
                        </h3>
                        <p className="text-xs text-slate-400 font-mono">
                          {heroPhone?.model || "A3090"} • {heroPhone?.variant || "128GB"}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-400 block font-mono">BEST DEAL</span>
                        <span className="text-xl font-mono font-black text-cyan-400">
                          ₹{Number(heroPhone?.selling_price || 52000).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <Button
                      onClick={() => openWhatsApp(heroPhone)}
                      className="w-full bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black font-mono font-bold text-xs h-10 shadow-[0_0_20px_rgba(6,182,212,0.35)]"
                    >
                      <Zap className="h-3.5 w-3.5 mr-1.5" />
                      INSTANT LOCK VIA WHATSAPP
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 3. Live Telemetry Trust Strip */}
      {config.showTrustBar && (
        <div className="bg-[#080d1a] border-y border-cyan-500/20 py-4 px-4">
          <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 text-center font-mono">
            <div className="flex items-center justify-center gap-2.5 text-xs text-slate-300">
              <ShieldCheck className="h-5 w-5 text-cyan-400 shrink-0" />
              <span>GOVT. UDYAM VERIFIED</span>
            </div>
            <div className="flex items-center justify-center gap-2.5 text-xs text-slate-300">
              <Cpu className="h-5 w-5 text-emerald-400 shrink-0" />
              <span>32-STEP TEST BENCH</span>
            </div>
            <div className="flex items-center justify-center gap-2.5 text-xs text-slate-300">
              <Clock className="h-5 w-5 text-purple-400 shrink-0" />
              <span>30-MIN INSTANT FIX</span>
            </div>
            <div className="flex items-center justify-center gap-2.5 text-xs text-slate-300">
              <Star className="h-5 w-5 text-yellow-400 shrink-0" />
              <span>100% CLEAN BILL &amp; IMEI</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Featured Phones Cyber Grid */}
      {config.showPhones && (
        <section id="phones-matrix" className="py-16 sm:py-24 px-4 sm:px-6 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10" data-reveal="fade">
            <div>
              <div className="text-cyan-400 font-mono text-xs font-bold tracking-widest uppercase mb-1">
                // SYSTEM INVENTORY
              </div>
              <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white font-mono">
                AVAILABLE SMARTPHONES
              </h2>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
              {[
                { id: "ALL", label: `ALL (${phones.length})` },
                { id: "APPLE", label: "APPLE IPHONES" },
                { id: "ANDROID", label: "ANDROID" },
                { id: "UNDER20K", label: "UNDER ₹20,000" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg border transition-all ${
                    activeFilter === f.id
                      ? "bg-cyan-500 text-black border-cyan-400 font-bold shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                      : "bg-[#0b101c] text-slate-400 border-cyan-500/20 hover:border-cyan-500/50 hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredPhones.length === 0 ? (
            <div className="bg-[#0b101c] border border-cyan-500/20 rounded-2xl p-12 text-center text-slate-400 font-mono">
              <Smartphone className="h-10 w-10 mx-auto text-cyan-400 mb-3 opacity-60" />
              <p>NO SMARTPHONES MATCH THIS FILTER QUERY.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredPhones.map((phone, idx) => (
                <div
                  key={phone.id || idx}
                  data-reveal="zoom"
                  className={`group bg-[#0c1220]/90 border border-cyan-500/25 hover:border-cyan-400 rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 hover:shadow-[0_0_30px_rgba(6,182,212,0.25)] hover:-translate-y-1 relative overflow-hidden stagger-${(idx % 6) + 1}`}
                >
                  {/* Card Background Glow on Hover */}
                  <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                  {/* Top Badges */}
                  <div className="flex items-center justify-between text-xs font-mono mb-4">
                    <span className="px-2 py-0.5 rounded-md bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 text-[10px]">
                      {phone.condition || "TESTED EXCELLENT"}
                    </span>
                    {phone.rating && (
                      <span className="flex items-center gap-1 text-amber-400 text-xs">
                        <Star className="h-3 w-3 fill-amber-400" /> {phone.rating}
                      </span>
                    )}
                  </div>

                  {/* Phone Image */}
                  <div className="py-4 flex items-center justify-center min-h-[170px]">
                    {phone.product_photos && phone.product_photos[0] ? (
                      <img
                        src={phone.product_photos[0]}
                        alt={phone.phone_name}
                        className="h-40 object-contain transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <Smartphone className="h-24 w-24 text-cyan-500/40 stroke-1" />
                    )}
                  </div>

                  {/* Details */}
                  <div className="space-y-2 pt-2 border-t border-cyan-500/15">
                    <h3 className="font-mono font-bold text-white text-base truncate group-hover:text-cyan-300 transition-colors">
                      {phone.phone_name}
                    </h3>
                    <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
                      <span>{phone.model || "Official Model"}</span>
                      {phone.variant && <span>• {phone.variant}</span>}
                    </div>

                    <div className="flex items-baseline justify-between pt-2">
                      <span className="font-mono text-xl font-black text-cyan-400">
                        ₹{Number(phone.selling_price || 0).toLocaleString()}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400">
                        GENUINE BILL &amp; IMEI
                      </span>
                    </div>

                    <Button
                      onClick={() => openWhatsApp(phone)}
                      className="w-full bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-black font-mono font-bold text-xs h-9 border border-cyan-500/40 transition-colors mt-2"
                    >
                      <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                      CLAIM VIA WHATSAPP
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 5. Diagnostic Cyber Repair Bay */}
      {config.showRepairs && (
        <section id="repair-matrix" className="py-16 sm:py-24 px-4 sm:px-6 bg-[#080d18] border-y border-cyan-500/20">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-12" data-reveal="fade">
              <span className="text-emerald-400 font-mono text-xs font-bold tracking-widest uppercase">
                // DIAGNOSTIC LAB
              </span>
              <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white font-mono mt-1">
                EXPRESS REPAIR SERVICES
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 font-mono mt-2">
                High-precision hardware repairs with ultrasonic cleaning, ESD protection, and genuine component testing.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {repairs.map((rep, idx) => (
                <div
                  key={rep.id || idx}
                  data-reveal="fade"
                  className="bg-[#0c1220] border border-cyan-500/25 hover:border-emerald-400 rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-[0_0_25px_rgba(16,185,129,0.2)] hover:-translate-y-1 stagger-2"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-3xl p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-500/30">
                        {rep.icon}
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-400 font-mono text-xs border border-emerald-500/30">
                        {rep.duration}
                      </span>
                    </div>

                    <h3 className="font-mono font-bold text-lg text-white mb-2">
                      {rep.title}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono leading-relaxed mb-4">
                      {rep.description}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-cyan-500/20 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 font-mono block">STARTING AT</span>
                      <span className="font-mono text-lg font-bold text-cyan-400">{rep.price}</span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => openRepairWhatsApp(rep)}
                      className="bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs h-8 px-3 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                    >
                      BOOK FIX
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 6. Cyber Footer */}
      <footer className="bg-[#05070c] border-t border-cyan-500/20 py-12 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left font-mono">
          <div>
            <div className="text-base font-bold text-cyan-400 tracking-wider">
              {businessName} • HARDWARE HUB
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {contact?.address || ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400">
            {phonePrimary && (
              <a href={`tel:${phonePrimary}`} className="hover:text-cyan-400 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-cyan-400" /> {phonePrimary}
              </a>
            )}
            {targetWa && (
              <a
                href={`https://wa.me/${targetWa}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-emerald-400 flex items-center gap-1.5"
              >
                <MessageSquare className="h-3.5 w-3.5 text-emerald-400" /> WhatsApp Direct
              </a>
            )}
          </div>

          <div className="text-[11px] text-slate-600">
            &copy; {new Date().getFullYear()} {businessName}. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

