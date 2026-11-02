import React, { useState } from "react";
import { ThemeProps } from "./types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Smartphone,
  Wrench,
  ShieldCheck,
  ChevronRight,
  Phone,
  MessageSquare,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  Settings,
} from "lucide-react";
import { useScrollReveal } from "./useScrollReveal";

export const AppleMinimalTheme: React.FC<ThemeProps> = ({
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
  const [selectedBrand, setSelectedBrand] = useState<string>("ALL");

  const businessName = contact?.business_name || "PhoneZone";
  const tagline = contact?.business_tagline || "Pro performance. Pre-owned prices.";
  const cleanWa = (whatsappNumber || phonePrimary || "").replace(/\D/g, "");
  const targetWa = cleanWa ? (cleanWa.length === 10 ? `91${cleanWa}` : cleanWa) : "";

  const openWhatsApp = (phone?: any) => {
    const text = phone
      ? `Hi! I would like to inquire about the ${phone.phone_name} (${phone.model || ""}) for ₹${Number(phone.selling_price || 0).toLocaleString()}.`
      : `Hi ${businessName}! I'm looking for a premium smartphone / repair service.`;
    if (targetWa) {
      window.open(`https://wa.me/${targetWa}?text=${encodeURIComponent(text)}`, "_blank");
    }
  };

  const openRepairWhatsApp = (repair: any) => {
    const text = `Hi! I'd like to book an appointment for ${repair.title} (₹${repair.price}).`;
    if (targetWa) {
      window.open(`https://wa.me/${targetWa}?text=${encodeURIComponent(text)}`, "_blank");
    }
  };

  const heroPhone = phones[0] || null;

  const filteredPhones = phones.filter((p) => {
    if (selectedBrand === "ALL") return true;
    if (selectedBrand === "APPLE") return /apple|iphone/i.test(p.phone_name || "");
    if (selectedBrand === "SAMSUNG") return /samsung/i.test(p.phone_name || "");
    if (selectedBrand === "OTHER") return !/apple|iphone|samsung/i.test(p.phone_name || "");
    return true;
  });

  return (
    <div className="min-h-screen bg-[#fbfbfd] text-[#1d1d1f] font-sans antialiased selection:bg-[#0071e3] selection:text-white overflow-x-hidden">
      {/* 1. Cupertino Floating Dynamic Island Navigation */}
      <header className="sticky top-2 z-40 max-w-5xl mx-auto px-2 sm:px-4">
        <div className="bg-white/80 backdrop-blur-2xl border border-black/[0.08] rounded-full px-3 sm:px-5 py-2 sm:py-2.5 shadow-[0_4px_24px_rgba(0,0,0,0.06)] flex items-center justify-between gap-2 sm:gap-4 transition-all">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {contact?.logo_url ? (
              <img src={contact.logo_url} alt={businessName} className="h-7 sm:h-8 w-auto object-contain shrink-0" />
            ) : (
              <div className="h-7 w-7 rounded-full bg-[#1d1d1f] text-white flex items-center justify-center font-bold text-xs shrink-0">
                P
              </div>
            )}
            <span className="font-semibold tracking-tight text-xs sm:text-sm text-[#1d1d1f] truncate">{businessName}</span>
          </div>

          <nav className="hidden sm:flex items-center gap-6 text-xs text-[#86868b] font-medium">
            <button
              onClick={() => document.getElementById("apple-phones")?.scrollIntoView({ behavior: "smooth" })}
              className="hover:text-[#1d1d1f] transition-colors"
            >
              Smartphones
            </button>
            <button
              onClick={() => document.getElementById("apple-repairs")?.scrollIntoView({ behavior: "smooth" })}
              className="hover:text-[#1d1d1f] transition-colors"
            >
              Repairs
            </button>
            <button onClick={onNavigateTrack} className="hover:text-[#1d1d1f] transition-colors">
              Track Repair
            </button>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => document.getElementById("apple-repairs")?.scrollIntoView({ behavior: "smooth" })}
              className="text-xs font-semibold text-[#0071e3] hover:text-[#0077ed] px-2 py-1 sm:hidden"
            >
              Repairs
            </button>
            <Button
              size="sm"
              onClick={() => openWhatsApp()}
              className="bg-[#0071e3] hover:bg-[#0077ed] text-white rounded-full text-xs font-medium h-8 px-3 sm:px-4 shadow-xs transition-transform active:scale-95"
            >
              Contact Us
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenAdmin()}
              className="text-[#86868b] hover:text-[#1d1d1f] rounded-full h-8 w-8 p-0"
              title="Admin"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* 2. Oversized Cupertino Editorial Hero */}
      {config.showHero && (
        <section className="pt-10 sm:pt-24 pb-12 sm:pb-16 px-4 text-center max-w-5xl mx-auto" data-reveal="fade">
          <Badge className="bg-slate-100 hover:bg-slate-100 text-[#86868b] font-medium text-xs px-3.5 py-1 rounded-full border-none mb-4">
            Certified Pre-Owned Storefront • Express Repairs
          </Badge>

          <h1 className="text-3xl sm:text-6xl md:text-7xl font-bold tracking-tight text-[#1d1d1f] leading-[1.08] mb-4 break-words">
            Pro performance.
            <br />
            <span className="text-[#86868b]">Pre-owned prices.</span>
          </h1>

          <p className="text-sm sm:text-xl text-[#86868b] max-w-xl mx-auto mb-6 sm:mb-8 font-normal leading-relaxed">
            {contact?.business_tagline || "Thoroughly tested devices, 100% genuine parts, transparent pricing, and 30-minute expert repair turnaround."}
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mb-10 sm:mb-14 max-w-sm sm:max-w-none mx-auto">
            <Button
              size="lg"
              onClick={() => {
                document.getElementById("apple-phones")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="bg-[#0071e3] hover:bg-[#0077ed] text-white rounded-full px-7 h-11 sm:h-12 text-sm font-medium shadow-sm transition-all hover:scale-105 active:scale-95"
            >
              Browse Collection
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                document.getElementById("apple-repairs")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="bg-white hover:bg-slate-50 text-[#1d1d1f] border-slate-300/80 rounded-full px-7 h-11 sm:h-12 text-sm font-medium"
            >
              Explore Repairs <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          {/* Large Centered Product Showcase */}
          {heroPhone && (
            <div className="relative mx-auto max-w-2xl bg-gradient-to-b from-[#f5f5f7] to-white rounded-3xl p-8 sm:p-12 border border-black/[0.04] shadow-xs">
              <span className="text-xs font-semibold text-[#86868b] uppercase tracking-wider block mb-2">
                FEATURED SPOTLIGHT
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#1d1d1f]">
                {heroPhone.phone_name}
              </h2>
              <p className="text-sm text-[#86868b] mt-1 mb-6">
                {heroPhone.model || "Official Model"} • {heroPhone.variant || "128GB"} • From ₹{Number(heroPhone.selling_price || 0).toLocaleString()}
              </p>

              <div className="py-6 flex justify-center">
                {heroPhone.product_photos && heroPhone.product_photos[0] ? (
                  <img
                    src={heroPhone.product_photos[0]}
                    alt={heroPhone.phone_name}
                    className="h-64 sm:h-80 object-contain drop-shadow-2xl transition-transform duration-700 hover:scale-105"
                  />
                ) : (
                  <Smartphone className="h-48 w-48 text-slate-300 stroke-1" />
                )}
              </div>

              <div className="flex items-center justify-center gap-6 pt-4 text-xs font-medium text-[#86868b] border-t border-black/[0.04]">
                <span>✓ 32-Point Inspected</span>
                <span>✓ Clean IMEI Verified</span>
                <span>✓ 7-Day Replacement</span>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 3. Cupertino Minimal Trust Strip */}
      {config.showTrustBar && (
        <div className="border-y border-black/[0.06] py-6 px-4 bg-white/50">
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center text-xs">
            <div>
              <div className="font-semibold text-[#1d1d1f]">Tested Hardware</div>
              <div className="text-[#86868b] mt-0.5">32-point inspection</div>
            </div>
            <div>
              <div className="font-semibold text-[#1d1d1f]">Express Repairs</div>
              <div className="text-[#86868b] mt-0.5">30-60 min turnaround</div>
            </div>
            <div>
              <div className="font-semibold text-[#1d1d1f]">Clean IMEI</div>
              <div className="text-[#86868b] mt-0.5">Zero blacklist guarantee</div>
            </div>
            <div>
              <div className="font-semibold text-[#1d1d1f]">Udyam Registered</div>
              <div className="text-[#86868b] mt-0.5">Govt. of India verified</div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Cupertino Clean Product Grid */}
      {config.showPhones && (
        <section id="apple-phones" className="py-20 px-4 max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1d1d1f]">
                Explore the line-up.
              </h2>
              <p className="text-sm text-[#86868b] mt-1">
                Every smartphone verified with genuine accessories and clear documentation.
              </p>
            </div>

            {/* Clean Brand Switcher */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-full text-xs font-medium text-[#86868b]">
              {["ALL", "APPLE", "SAMSUNG", "OTHER"].map((b) => (
                <button
                  key={b}
                  onClick={() => setSelectedBrand(b)}
                  className={`px-3 py-1.5 rounded-full transition-all ${
                    selectedBrand === b ? "bg-white text-[#1d1d1f] shadow-xs font-semibold" : "hover:text-[#1d1d1f]"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPhones.map((phone, idx) => (
              <div
                key={phone.id || idx}
                data-reveal="zoom"
                className="bg-white rounded-3xl p-6 border border-black/[0.06] shadow-xs hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-3">
                    <span className="text-[#86868b] font-medium">{phone.condition || "Excellent"}</span>
                    {phone.rating && <span className="text-amber-500 font-semibold">★ {phone.rating}</span>}
                  </div>

                  <h3 className="text-lg font-bold text-[#1d1d1f] tracking-tight">{phone.phone_name}</h3>
                  <p className="text-xs text-[#86868b] mb-4">{phone.model} {phone.variant ? `• ${phone.variant}` : ""}</p>

                  <div className="py-6 flex items-center justify-center min-h-[180px]">
                    {phone.product_photos && phone.product_photos[0] ? (
                      <img
                        src={phone.product_photos[0]}
                        alt={phone.phone_name}
                        className="h-44 object-contain transition-transform duration-300 hover:scale-105"
                      />
                    ) : (
                      <Smartphone className="h-28 w-28 text-slate-200 stroke-1" />
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-black/[0.04] flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-[#86868b] block">Price</span>
                    <span className="text-xl font-bold text-[#1d1d1f]">
                      ₹{Number(phone.selling_price || 0).toLocaleString()}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => openWhatsApp(phone)}
                    className="bg-[#0071e3] hover:bg-[#0077ed] text-white rounded-full text-xs font-medium h-8 px-4"
                  >
                    Buy
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. Horizontal Apple-Style Repair Services Modules */}
      {config.showRepairs && (
        <section id="apple-repairs" className="py-20 px-4 bg-[#f5f5f7] border-y border-black/[0.06]">
          <div className="max-w-4xl mx-auto">
            <div className="text-center max-w-xl mx-auto mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1d1d1f]">
                Fast. Reliable. Certified Repair.
              </h2>
              <p className="text-sm text-[#86868b] mt-2">
                Precision screen, battery, and charging port replacements done with original grade parts.
              </p>
            </div>

            <div className="space-y-3">
              {repairs.map((rep, idx) => (
                <div
                  key={rep.id || idx}
                  data-reveal="fade"
                  className="bg-white rounded-2xl p-5 border border-black/[0.06] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:shadow-md"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl p-3 bg-slate-50 rounded-xl">{rep.icon}</span>
                    <div>
                      <h3 className="font-semibold text-base text-[#1d1d1f]">{rep.title}</h3>
                      <p className="text-xs text-[#86868b] mt-0.5">{rep.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-3 sm:pt-0 border-black/[0.04]">
                    <div className="text-left sm:text-right">
                      <div className="text-xs text-[#86868b]">{rep.duration}</div>
                      <div className="font-bold text-base text-[#1d1d1f]">From {rep.price}</div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => openRepairWhatsApp(rep)}
                      className="bg-slate-100 hover:bg-slate-200 text-[#1d1d1f] rounded-full text-xs font-medium h-8 px-4"
                    >
                      Book <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 6. Cupertino Minimal Footer */}
      <footer className="py-12 px-4 max-w-5xl mx-auto text-xs text-[#86868b] flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-black/[0.06]">
        <div>
          <span className="font-semibold text-[#1d1d1f]">{businessName}</span> • {contact?.address || "Local, UP"}
        </div>
        <div className="flex items-center gap-4">
          {phonePrimary && <span>Tel: {phonePrimary}</span>}
          {targetWa && (
            <a href={`https://wa.me/${targetWa}`} target="_blank" rel="noreferrer" className="hover:text-[#0071e3]">
              WhatsApp
            </a>
          )}
        </div>
        <div>&copy; {new Date().getFullYear()} {businessName}. All rights reserved.</div>
      </footer>
    </div>
  );
};

