import React, { useState } from "react";
import { ThemeProps } from "./types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Smartphone,
  Wrench,
  ShieldCheck,
  Crown,
  Phone,
  MessageSquare,
  Sparkles,
  ArrowRight,
  Star,
  Settings,
  Clock,
  Award,
} from "lucide-react";
import { useScrollReveal } from "./useScrollReveal";

export const BlackGoldLuxuryTheme: React.FC<ThemeProps> = ({
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

  const businessName = contact?.business_name || "PhoneZone";
  const tagline = contact?.business_tagline || "The Art of Verified Luxury & Performance";
  const cleanWa = (whatsappNumber || phonePrimary || "").replace(/\D/g, "");
  const targetWa = cleanWa ? (cleanWa.length === 10 ? `91${cleanWa}` : cleanWa) : "";

  const openWhatsApp = (phone?: any) => {
    const text = phone
      ? `Greetings. I am interested in acquiring the ${phone.phone_name} (${phone.model || ""}) listed at ₹${Number(phone.selling_price || 0).toLocaleString()}. Kindly confirm its availability.`
      : `Greetings ${businessName}. I am inquiring regarding your luxury phone collection and concierge repair service.`;
    if (targetWa) {
      window.open(`https://wa.me/${targetWa}?text=${encodeURIComponent(text)}`, "_blank");
    }
  };

  const openRepairWhatsApp = (repair: any) => {
    const text = `Greetings. I require white-glove repair service for ${repair.title} (${repair.price}).`;
    if (targetWa) {
      window.open(`https://wa.me/${targetWa}?text=${encodeURIComponent(text)}`, "_blank");
    }
  };

  const heroPhone = phones[0] || null;

  return (
    <div className="min-h-screen bg-[#090a0d] text-[#f5f1e8] font-serif selection:bg-amber-400 selection:text-black relative overflow-x-hidden">
      {/* Subtle Warm Gold Lighting Gradient in Background */}
      <div className="absolute top-0 right-1/4 w-[32rem] h-[32rem] bg-amber-500/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[40rem] left-10 w-[28rem] h-[28rem] bg-yellow-500/5 rounded-full blur-[130px] pointer-events-none" />

      {/* 1. Atelier Dark Gold Navigation */}
      <header className="sticky top-0 z-40 bg-[#0d0e13]/90 backdrop-blur-xl border-b border-amber-500/20 shadow-2xl">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-4 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {contact?.logo_url ? (
              <img src={contact.logo_url} alt={businessName} className="h-8 sm:h-10 w-auto object-contain shrink-0" />
            ) : (
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-gradient-to-br from-amber-600 via-yellow-500 to-amber-700 text-black flex items-center justify-center font-bold text-xs sm:text-sm shadow-md shrink-0">
                <Crown className="h-4 w-4" />
              </div>
            )}
            <div className="min-w-0">
              <span className="text-base sm:text-lg font-bold tracking-widest uppercase bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300 bg-clip-text text-transparent block leading-tight truncate">
                {businessName}
              </span>
              <span className="text-[9px] sm:text-[10px] text-amber-300/60 font-sans tracking-widest uppercase">
                ATELIER &amp; SHOWROOM
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 font-sans shrink-0">
            <button
              onClick={() => document.getElementById("luxury-repairs")?.scrollIntoView({ behavior: "smooth" })}
              className="text-xs font-bold text-amber-300 hover:text-amber-200 px-2 py-1 flex items-center gap-1"
            >
              <Wrench className="h-3 w-3" />
              <span className="hidden sm:inline">Repairs</span>
            </button>
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateTrack}
              className="hidden md:inline-flex border-amber-500/30 text-amber-200 hover:bg-amber-950/40 text-xs h-9 px-4"
            >
              Repair Tracking
            </Button>
            <Button
              size="sm"
              onClick={() => openWhatsApp()}
              className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:brightness-110 text-black font-semibold text-xs h-8 sm:h-9 px-3 sm:px-5 shadow-lg shadow-amber-500/20 transition-transform active:scale-95"
            >
              <span className="hidden sm:inline">VIP Concierge</span>
              <span className="sm:hidden">VIP Concierge</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenAdmin()}
              className="text-amber-200/60 hover:text-amber-200 hover:bg-amber-950/30 h-8 sm:h-9 w-8 sm:w-auto p-1"
              title="Admin"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* 2. Cinematic Luxury Hero */}
      {config.showHero && (
        <section className="pt-16 sm:pt-24 pb-20 px-4 sm:px-6 max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            {/* Left Column (7 Cols) */}
            <div className="lg:col-span-7 space-y-6" data-reveal="left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-950/40 border border-amber-500/30 text-amber-300 text-xs font-sans tracking-wide">
                <Crown className="h-3.5 w-3.5 text-amber-400" />
                <span>CERTIFIED LUXURY PRE-OWNED ATELIER</span>
              </div>

              <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-[#fbf8f0] leading-[1.05]">
                The Art of
                <br />
                <span className="bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent">
                  Verified Perfection.
                </span>
              </h1>

              <p className="text-base sm:text-lg text-amber-200/70 font-sans leading-relaxed max-w-xl">
                Every smartphone in our private collection undergoes rigorous 32-point master inspection, IMEI provenance clearance, and original component certification.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-4 font-sans">
                <Button
                  size="lg"
                  onClick={() => {
                    document.getElementById("luxury-phones")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:brightness-110 text-black font-bold h-12 px-8 shadow-xl shadow-amber-500/20 transition-all hover:scale-105 active:scale-95"
                >
                  <Award className="h-4 w-4 mr-2" />
                  VIEW COLLECTION
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    document.getElementById("luxury-repairs")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="border-amber-500/40 text-amber-300 hover:bg-amber-950/40 font-semibold h-12 px-8"
                >
                  <Wrench className="h-4 w-4 mr-2 text-amber-400" />
                  CONCIERGE REPAIR
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-amber-500/20 max-w-lg font-sans">
                <div>
                  <div className="text-2xl font-bold text-amber-300 font-serif">100%</div>
                  <div className="text-xs text-amber-200/60 uppercase tracking-wider">Provenance Guaranteed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-300 font-serif">30 MIN</div>
                  <div className="text-xs text-amber-200/60 uppercase tracking-wider">Turnaround Time</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-300 font-serif">A+ GRADE</div>
                  <div className="text-xs text-amber-200/60 uppercase tracking-wider">Pristine Grading</div>
                </div>
              </div>
            </div>

            {/* Right Column: Framed Cinematic Device (5 Cols) */}
            <div className="lg:col-span-5" data-reveal="right">
              <div className="relative mx-auto max-w-sm rounded-3xl p-0.5 bg-gradient-to-b from-amber-400/60 via-amber-600/30 to-amber-950/20 shadow-[0_20px_50px_rgba(245,158,11,0.15)]">
                <div className="rounded-[22px] bg-[#121319] border border-amber-500/30 p-8 text-center relative overflow-hidden">
                  <span className="text-[11px] font-sans font-bold text-amber-400/80 tracking-widest uppercase block mb-1">
                    CROWN SELECTION
                  </span>
                  <h3 className="text-2xl font-bold text-amber-100 font-serif">
                    {heroPhone?.phone_name || "Apple iPhone 15"}
                  </h3>
                  <p className="text-xs text-amber-200/60 font-sans mt-0.5 mb-6">
                    {heroPhone?.model} • Pristine Grade • {heroPhone?.variant || "128GB"}
                  </p>

                  <div className="py-6 flex justify-center">
                    {heroPhone?.product_photos && heroPhone.product_photos[0] ? (
                      <img
                        src={heroPhone.product_photos[0]}
                        alt={heroPhone.phone_name}
                        className="h-60 object-contain drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)] transition-transform duration-500 hover:scale-105"
                      />
                    ) : (
                      <Smartphone className="h-44 w-44 text-amber-500/30 stroke-1" />
                    )}
                  </div>

                  <div className="pt-6 border-t border-amber-500/20 flex items-center justify-between font-sans">
                    <div className="text-left">
                      <span className="text-[10px] text-amber-200/50 uppercase tracking-wider block">Acquisition Price</span>
                      <span className="text-2xl font-bold text-amber-300 font-serif">
                        ₹{Number(heroPhone?.selling_price || 52000).toLocaleString()}
                      </span>
                    </div>
                    <Button
                      onClick={() => openWhatsApp(heroPhone)}
                      className="bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 text-black font-bold text-xs h-10 px-5 rounded-xl shadow-md"
                    >
                      Acquire Now
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 3. Gold Provenance Strip */}
      {config.showTrustBar && (
        <div className="bg-[#0c0d12] border-y border-amber-500/20 py-5 px-4 font-sans">
          <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center text-xs">
            <div className="flex items-center justify-center gap-2 text-amber-200/80">
              <ShieldCheck className="h-4 w-4 text-amber-400 shrink-0" />
              <span>GOVT. UDYAM REGISTERED</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-amber-200/80">
              <Award className="h-4 w-4 text-amber-400 shrink-0" />
              <span>32-STEP MASTER CERTIFIED</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-amber-200/80">
              <Clock className="h-4 w-4 text-amber-400 shrink-0" />
              <span>30-MIN ATELIER REPAIR</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-amber-200/80">
              <Crown className="h-4 w-4 text-amber-400 shrink-0" />
              <span>GENUINE IMEI CERTIFICATE</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Luxury Phones Editorial Catalog */}
      {config.showPhones && (
        <section id="luxury-phones" className="py-20 px-4 sm:px-6 max-w-7xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-14" data-reveal="fade">
            <span className="text-xs font-sans font-bold text-amber-400 tracking-widest uppercase">
              THE COLLECTION
            </span>
            <h2 className="text-3xl sm:text-5xl font-bold text-amber-100 font-serif mt-1">
              Curated Certified Devices
            </h2>
            <p className="text-xs sm:text-sm text-amber-200/60 font-sans mt-2">
              Flawlessly inspected smartphones backed by transparent ownership history.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 font-sans">
            {phones.map((phone, idx) => (
              <div
                key={phone.id || idx}
                data-reveal="zoom"
                className="bg-gradient-to-b from-[#13151f] to-[#0c0d12] border border-amber-500/25 hover:border-amber-400/70 rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-[0_10px_35px_rgba(245,158,11,0.18)] hover:-translate-y-1.5"
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-3 font-serif">
                    <span className="text-amber-400 text-xs tracking-wider">
                      ★ {phone.condition || "PRISTINE"}
                    </span>
                    <span className="text-amber-200/50 text-[11px] font-sans">AUTHENTIC</span>
                  </div>

                  <h3 className="font-serif font-bold text-lg text-amber-100">{phone.phone_name}</h3>
                  <p className="text-xs text-amber-200/50 mt-0.5 mb-4">{phone.model} • {phone.variant || "Standard"}</p>

                  <div className="py-6 flex items-center justify-center min-h-[170px]">
                    {phone.product_photos && phone.product_photos[0] ? (
                      <img
                        src={phone.product_photos[0]}
                        alt={phone.phone_name}
                        className="h-40 object-contain transition-transform duration-300 hover:scale-105"
                      />
                    ) : (
                      <Smartphone className="h-28 w-28 text-amber-500/20 stroke-1" />
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-amber-500/20 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-amber-200/50 block">Investment</span>
                    <span className="text-xl font-bold text-amber-300 font-serif">
                      ₹{Number(phone.selling_price || 0).toLocaleString()}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => openWhatsApp(phone)}
                    className="bg-amber-500/20 hover:bg-amber-500 text-amber-200 hover:text-black font-semibold text-xs h-8 px-4 border border-amber-500/40 transition-colors"
                  >
                    Acquire
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. White-Glove Repair Atelier */}
      {config.showRepairs && (
        <section id="luxury-repairs" className="py-20 px-4 sm:px-6 bg-[#0b0c11] border-y border-amber-500/20">
          <div className="max-w-6xl mx-auto">
            <div className="text-center max-w-xl mx-auto mb-14">
              <span className="text-xs font-sans font-bold text-amber-400 tracking-widest uppercase">
                WHITE-GLOVE ATELIER
              </span>
              <h2 className="text-3xl sm:text-5xl font-bold text-amber-100 font-serif mt-1">
                Concierge Repairs
              </h2>
              <p className="text-xs sm:text-sm text-amber-200/60 font-sans mt-2">
                Delicate screen restoration, battery renewals, and logic diagnostics performed with surgical precision.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 font-sans">
              {repairs.map((rep, idx) => (
                <div
                  key={rep.id || idx}
                  data-reveal="fade"
                  className="bg-[#12141c] border border-amber-500/25 hover:border-amber-400 rounded-2xl p-6 flex flex-col justify-between transition-all hover:shadow-[0_10px_30px_rgba(245,158,11,0.15)]"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-2xl p-3 bg-amber-950/40 rounded-xl border border-amber-500/30">
                        {rep.icon}
                      </span>
                      <span className="text-xs text-amber-300/80 px-2.5 py-1 rounded-full bg-amber-950/60 border border-amber-500/20">
                        {rep.duration}
                      </span>
                    </div>

                    <h3 className="font-serif font-bold text-lg text-amber-100 mb-1.5">{rep.title}</h3>
                    <p className="text-xs text-amber-200/60 leading-relaxed mb-4">{rep.description}</p>
                  </div>

                  <div className="pt-4 border-t border-amber-500/20 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-amber-200/50 block">ESTIMATE</span>
                      <span className="font-serif text-lg font-bold text-amber-300">{rep.price}</span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => openRepairWhatsApp(rep)}
                      className="bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-semibold text-xs h-8 px-4"
                    >
                      Book Concierge
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 6. Luxury Footer */}
      <footer className="py-12 px-4 sm:px-6 font-sans text-xs text-amber-200/60 border-t border-amber-500/20">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <span className="font-serif font-bold text-amber-100 text-base">{businessName} ATELIER</span>
            <p className="mt-0.5">{contact?.address || ""}</p>
          </div>
          <div className="flex items-center gap-4">
            {phonePrimary && <span>Private Hotline: {phonePrimary}</span>}
            {targetWa && (
              <a href={`https://wa.me/${targetWa}`} target="_blank" rel="noreferrer" className="text-amber-300 font-semibold hover:underline">
                WhatsApp VIP
              </a>
            )}
          </div>
          <div>&copy; {new Date().getFullYear()} {businessName}. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
};

