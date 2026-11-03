import React, { useState } from "react";
import { ThemeProps } from "./types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Smartphone,
  Wrench,
  ShieldCheck,
  Sparkles,
  Phone,
  MessageSquare,
  ArrowRight,
  Star,
  Settings,
  Layers,
  Clock,
  Heart,
} from "lucide-react";
import { useScrollReveal } from "./useScrollReveal";

export const FrostedGlassTheme: React.FC<ThemeProps> = ({
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
  const [selectedHeroIndex, setSelectedHeroIndex] = useState(0);

  const businessName = contact?.business_name || "PhoneZone";
  const tagline = contact?.business_tagline || "Light. Pure. Certified Clarity.";
  const cleanWa = (whatsappNumber || phonePrimary || "").replace(/\D/g, "");
  const targetWa = cleanWa ? (cleanWa.length === 10 ? `91${cleanWa}` : cleanWa) : "";

  const openWhatsApp = (phone?: any) => {
    const text = phone
      ? `Hello! I'm interested in ${phone.phone_name} (${phone.model || ""}) for ₹${Number(phone.selling_price || 0).toLocaleString()}. Is this in stock?`
      : `Hello ${businessName}! I'm inquiring about available phones and repair services.`;
    if (targetWa) {
      window.open(`https://wa.me/${targetWa}?text=${encodeURIComponent(text)}`, "_blank");
    }
  };

  const openRepairWhatsApp = (repair: any) => {
    const text = `Hello! I want to book ${repair.title} (approx ${repair.price}).`;
    if (targetWa) {
      window.open(`https://wa.me/${targetWa}?text=${encodeURIComponent(text)}`, "_blank");
    }
  };

  const heroPhone = phones[selectedHeroIndex] || phones[0] || null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#eff6ff] to-[#f1f5f9] text-slate-900 font-sans relative overflow-x-hidden selection:bg-indigo-600 selection:text-white">
      {/* Floating Pastel Gradient Background Orbs */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-purple-200/40 rounded-full blur-[100px] pointer-events-none -z-10 animate-ambient-glow" />
      <div className="absolute top-80 right-10 w-[30rem] h-[30rem] bg-sky-200/50 rounded-full blur-[120px] pointer-events-none -z-10 animate-ambient-glow" />
      <div className="absolute top-[60rem] left-1/3 w-[26rem] h-[26rem] bg-emerald-100/60 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* 1. Floating Frosted Glass Navigation */}
      <header className="sticky top-2 z-40 max-w-6xl mx-auto px-2 sm:px-4">
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl sm:rounded-3xl px-3 sm:px-6 py-2 sm:py-3 shadow-[0_10px_35px_rgba(0,0,0,0.05)] flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {contact?.logo_url ? (
              <img src={contact.logo_url} alt={businessName} className="h-8 sm:h-10 w-auto object-contain shrink-0" />
            ) : (
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-indigo-600 to-sky-600 text-white flex items-center justify-center shadow-sm shrink-0">
                <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
            )}
            <div className="min-w-0">
              <span className="font-bold text-sm sm:text-base tracking-tight text-slate-900 block leading-tight truncate">
                {businessName}
              </span>
              <span className="text-[10px] sm:text-[11px] text-slate-600 font-medium">Aero Glass Edition</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <button
              onClick={() => document.getElementById("frosted-repairs")?.scrollIntoView({ behavior: "smooth" })}
              className="text-xs font-bold text-indigo-700 hover:text-indigo-900 px-2 py-1 flex items-center gap-1"
            >
              <Wrench className="h-3 w-3" />
              <span className="hidden sm:inline">Repairs</span>
            </button>
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateTrack}
              className="hidden md:inline-flex bg-white/80 border-slate-200 hover:bg-white text-slate-800 font-semibold rounded-full text-xs h-9 px-4 backdrop-blur-md"
            >
              Track Status
            </Button>
            <Button
              size="sm"
              onClick={() => openWhatsApp()}
              className="bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs rounded-full h-8 sm:h-9 px-3 sm:px-5 shadow-sm shadow-indigo-600/25"
            >
              <span className="hidden sm:inline">Chat on WhatsApp</span>
              <span className="sm:hidden">WhatsApp</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenAdmin()}
              className="text-slate-600 hover:text-slate-900 rounded-full h-8 sm:h-9 w-8 sm:w-auto p-1"
              title="Admin"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* 2. Layered Aero Hero with Interactive Split Panel */}
      {config.showHero && (
        <section className="pt-12 sm:pt-20 pb-20 px-4 sm:px-6 max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-12 gap-8 items-center">
            {/* Left Column (6 Cols) */}
            <div className="lg:col-span-6 space-y-6" data-reveal="left">
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-indigo-200 text-indigo-950 text-xs font-bold shadow-xs">
                <Sparkles className="h-3.5 w-3.5 text-indigo-700" />
                Pure Quality • 100% Tested Devices
              </span>

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">
                Clear. Honest.
                <br />
                <span className="bg-gradient-to-r from-indigo-700 via-blue-700 to-indigo-950 bg-clip-text text-transparent">
                  Verified Clarity.
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-700 font-medium leading-relaxed max-w-lg">
                Experience crystal-clear phone buying and repairs. Real hardware diagnostics, genuine OEM components, and direct WhatsApp deal verification.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  size="lg"
                  onClick={() => {
                    document.getElementById("frosted-phones")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-2xl h-12 px-7 shadow-lg shadow-indigo-700/25"
                >
                  <Smartphone className="h-4 w-4 mr-2" />
                  Explore Inventory
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    document.getElementById("frosted-repairs")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="bg-white/80 hover:bg-white border-slate-300 text-slate-900 font-bold rounded-2xl h-12 px-7 backdrop-blur-md shadow-xs"
                >
                  <Wrench className="h-4 w-4 mr-2 text-indigo-700" />
                  Service Catalog
                </Button>
              </div>
            </div>

            {/* Right Column: Interactive Featured Product Panel (6 Cols) */}
            <div className="lg:col-span-6" data-reveal="right">
              <div className="bg-white/80 backdrop-blur-2xl border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.06)] relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <Badge className="bg-indigo-100 text-indigo-900 border-indigo-300 text-xs font-bold">
                    DEVICE SPOTLIGHT
                  </Badge>
                  <span className="text-xs text-slate-600 font-medium">Click thumbnail to inspect</span>
                </div>

                {/* Hero Phone Showcase */}
                {heroPhone && (
                  <div className="text-center py-4">
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-900">{heroPhone.phone_name}</h3>
                    <p className="text-xs text-slate-600 font-medium mt-0.5">
                      {heroPhone.model} • {heroPhone.variant || "128GB"} • {heroPhone.condition || "Excellent"}
                    </p>

                    <div className="py-6 flex items-center justify-center min-h-[190px]">
                      {(() => {
                        const img = heroPhone.product_photos?.[0] || heroPhone.photo_url || heroPhone.image_url;
                        return img ? (
                          <img
                            src={img}
                            alt={heroPhone.phone_name}
                            className="h-48 sm:h-56 object-contain filter drop-shadow-xl transition-all duration-500 hover:scale-105"
                          />
                        ) : (
                          <Smartphone className="h-36 w-36 text-indigo-300 stroke-1" />
                        );
                      })()}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                      <div className="text-left">
                        <span className="text-xs text-slate-600 font-semibold block">Verified Price</span>
                        <span className="text-2xl font-extrabold text-indigo-700">
                          ₹{Number(heroPhone.selling_price || 0).toLocaleString()}
                        </span>
                      </div>
                      <Button
                        onClick={() => openWhatsApp(heroPhone)}
                        className="bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold h-10 px-5 shadow-md shadow-indigo-700/20"
                      >
                        <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Lock Deal
                      </Button>
                    </div>
                  </div>
                )}

                {/* Quick Device Switcher Thumbnails */}
                {phones.length > 1 && (
                  <div className="grid grid-cols-4 gap-2 pt-5 border-t border-slate-100 mt-2">
                    {phones.slice(0, 4).map((p, idx) => (
                      <button
                        key={p.id || idx}
                        onClick={() => setSelectedHeroIndex(idx)}
                        className={`p-2 rounded-xl border text-center transition-all ${
                          selectedHeroIndex === idx
                            ? "bg-white border-indigo-500 shadow-sm ring-2 ring-indigo-500/30"
                            : "bg-white/60 border-slate-200 hover:bg-white"
                        }`}
                      >
                        <div className="h-10 flex items-center justify-center">
                          {(() => {
                            const img = p.product_photos?.[0] || p.photo_url || p.image_url;
                            return img ? (
                              <img src={img} alt={p.phone_name} className="h-10 object-contain" />
                            ) : (
                              <Smartphone className="h-6 w-6 text-slate-300" />
                            );
                          })()}
                        </div>
                        <div className="text-[10px] font-bold text-slate-900 truncate mt-1">
                          {p.phone_name?.split(" ")[0]}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 3. Floating Frosted Trust Badges */}
      {config.showTrustBar && (
        <div className="max-w-6xl mx-auto px-4 mb-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/80 backdrop-blur-xl border border-slate-200/90 rounded-2xl p-4 text-center shadow-xs">
              <ShieldCheck className="h-6 w-6 text-indigo-700 mx-auto mb-1.5" />
              <div className="font-extrabold text-sm text-slate-900">Udyam Certified</div>
              <div className="text-xs text-slate-600 font-medium">Reg: {contact?.udyam_number || "UP-71-0045440"}</div>
            </div>
            <div className="bg-white/80 backdrop-blur-xl border border-slate-200/90 rounded-2xl p-4 text-center shadow-xs">
              <Sparkles className="h-6 w-6 text-blue-700 mx-auto mb-1.5" />
              <div className="font-extrabold text-sm text-slate-900">32-Step Quality</div>
              <div className="text-xs text-slate-600 font-medium">Comprehensive hardware check</div>
            </div>
            <div className="bg-white/80 backdrop-blur-xl border border-slate-200/90 rounded-2xl p-4 text-center shadow-xs">
              <Clock className="h-6 w-6 text-teal-700 mx-auto mb-1.5" />
              <div className="font-extrabold text-sm text-slate-900">30-Min Repairs</div>
              <div className="text-xs text-slate-600 font-medium">Live while you watch</div>
            </div>
            <div className="bg-white/80 backdrop-blur-xl border border-slate-200/90 rounded-2xl p-4 text-center shadow-xs">
              <Star className="h-6 w-6 text-amber-600 mx-auto mb-1.5" />
              <div className="font-extrabold text-sm text-slate-900">100% Genuine</div>
              <div className="text-xs text-slate-600 font-medium">Clean IMEI &amp; bill provided</div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Glass-Style Product Collection */}
      {config.showPhones && (
        <section id="frosted-phones" className="py-16 px-4 max-w-6xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-12" data-reveal="fade">
            <span className="inline-block px-3.5 py-1 rounded-full text-xs font-extrabold tracking-wider uppercase bg-indigo-100 text-indigo-950 border border-indigo-300 shadow-xs">
              CERTIFIED DEVICES
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-2">
              Curated Phone Collection
            </h2>
            <p className="text-sm text-slate-600 font-medium mt-1.5">
              Transparent condition ratings with actual device photos and full warranty backing.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {phones.map((phone, idx) => (
              <div
                key={phone.id || idx}
                data-reveal="zoom"
                className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-6 shadow-xs hover:shadow-xl hover:bg-white transition-all duration-300 hover:-translate-y-1.5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-3">
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-950 font-bold border border-indigo-200 text-[11px]">
                      {phone.condition || "Pristine"}
                    </span>
                    {phone.rating && <span className="text-amber-600 font-extrabold">★ {phone.rating}</span>}
                  </div>

                  <h3 className="font-bold text-lg text-slate-900">{phone.phone_name}</h3>
                  <p className="text-xs text-slate-600 font-medium mb-4">{phone.model} • {phone.variant || "Standard"}</p>

                  <div className="py-4 flex items-center justify-center min-h-[170px]">
                    {(() => {
                      const img = phone.product_photos?.[0] || phone.photo_url || phone.image_url;
                      return img ? (
                        <img
                          src={img}
                          alt={phone.phone_name}
                          className="h-44 object-contain filter drop-shadow-md transition-transform duration-300 hover:scale-105"
                        />
                      ) : (
                        <Smartphone className="h-28 w-28 text-slate-300 stroke-1" />
                      );
                    })()}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-600 font-semibold block">Selling Price</span>
                    <span className="text-xl font-extrabold text-indigo-700">
                      ₹{Number(phone.selling_price || 0).toLocaleString()}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => openWhatsApp(phone)}
                    className="bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold h-8 px-4"
                  >
                    Inquire
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. Dynamic 2x3 Frosted Service Grid */}
      {config.showRepairs && (
        <section id="frosted-repairs" className="py-16 px-4 max-w-6xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-12">
            <span className="inline-block px-3.5 py-1 rounded-full text-xs font-extrabold tracking-wider uppercase bg-sky-100 text-sky-950 border border-sky-300 shadow-xs">
              EXPRESS WORKSHOP
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-2">Repair Services</h2>
            <p className="text-sm text-slate-600 font-medium mt-1.5">Honest rates, original grade parts, and fast turnaround.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {repairs.map((rep, idx) => (
              <div
                key={rep.id || idx}
                data-reveal="fade"
                className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-6 shadow-xs hover:shadow-lg transition-all hover:bg-white"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-3xl p-3 bg-gradient-to-tr from-indigo-50 to-sky-50 rounded-2xl shadow-xs">
                    {rep.icon}
                  </span>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-200 text-slate-900 border border-slate-300">
                    {rep.duration}
                  </span>
                </div>

                <h3 className="font-bold text-lg text-slate-900 mb-1.5">{rep.title}</h3>
                <p className="text-xs text-slate-600 font-medium leading-relaxed mb-4">{rep.description}</p>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <span className="font-extrabold text-base text-slate-900">{rep.price}</span>
                  <Button
                    size="sm"
                    onClick={() => openRepairWhatsApp(rep)}
                    className="bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold h-8 px-3"
                  >
                    Book Fix
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6. Frosted Footer */}
      <footer className="mt-20 py-12 px-4 border-t border-slate-200/80 bg-white/70 backdrop-blur-xl text-xs text-slate-700">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <span className="font-extrabold text-slate-900 text-sm">{businessName}</span>
            <p className="text-slate-600 font-medium mt-0.5">{contact?.address || "Local, UP"}</p>
          </div>

          <div className="flex items-center gap-4">
            {phonePrimary && <span className="font-semibold text-slate-800">Call: {phonePrimary}</span>}
            {targetWa && (
              <a href={`https://wa.me/${targetWa}`} target="_blank" rel="noreferrer" className="text-indigo-800 font-bold hover:underline">
                WhatsApp
              </a>
            )}
          </div>

          <div className="text-slate-600 font-medium">&copy; {new Date().getFullYear()} {businessName}. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
};

