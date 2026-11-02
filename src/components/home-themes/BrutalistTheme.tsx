import React, { useState } from "react";
import { ThemeProps } from "./types";
import { Button } from "@/components/ui/button";
import {
  Smartphone,
  Wrench,
  ShieldCheck,
  Check,
  Clock,
  Terminal,
  Zap,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export const BrutalistTheme: React.FC<ThemeProps> = ({
  contact,
  phones,
  repairs,
  config,
  onOpenAdmin,
  onNavigateTrack,
  whatsappNumber,
  phonePrimary,
}) => {
  const [filterBrand, setFilterBrand] = useState<string>("ALL");

  const businessName = contact?.business_name || "PHONEZONE";
  const cleanWa = (whatsappNumber || phonePrimary || "").replace(/\D/g, "");
  const targetWa = cleanWa ? (cleanWa.length === 10 ? `91${cleanWa}` : cleanWa) : "";

  const openWhatsApp = (phone?: any) => {
    const text = phone
      ? `[DEAL-LOCK] I want to buy ${phone.phone_name} (${phone.model || ""}) for ₹${Number(phone.selling_price || 0).toLocaleString()} from PhoneZone Brutalist catalog.`
      : `[INQUIRY] Hello ${businessName}!`;
    if (targetWa) {
      window.open(`https://wa.me/${targetWa}?text=${encodeURIComponent(text)}`, "_blank");
    }
  };

  const openRepairWhatsApp = (repair: any) => {
    const text = `[REPAIR-BOOK] Booking ${repair.title} (${repair.price}).`;
    if (targetWa) {
      window.open(`https://wa.me/${targetWa}?text=${encodeURIComponent(text)}`, "_blank");
    }
  };

  const filteredPhones = phones.filter((p) => {
    if (filterBrand === "APPLE" && !/apple|iphone/i.test(p.phone_name || "")) return false;
    if (filterBrand === "ANDROID" && /apple|iphone/i.test(p.phone_name || "")) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#f4f4f0] text-black font-mono selection:bg-black selection:text-yellow-300">
      {/* 1. Industrial Ticker Header */}
      <div className="bg-black text-yellow-300 py-1.5 px-4 text-xs font-bold tracking-widest border-b-2 border-black flex justify-between items-center">
        <span>● LIVE PHONEZONE INVENTORY HUD // 32-POINT CHECKED</span>
        <span className="hidden sm:inline">UDYAM: {contact?.udyam_number || ""}</span>
      </div>

      <header className="border-b-4 border-black bg-white px-4 sm:px-8 py-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="border-2 border-black bg-yellow-400 text-black px-2.5 py-1 font-black text-lg shadow-[3px_3px_0px_#000]">
              PZ
            </div>
            <div>
              <h1 className="font-black text-lg tracking-tighter uppercase">{businessName}</h1>
              <p className="text-[10px] text-slate-600 font-sans font-bold">NEO-BRUTALIST TECH STORE</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateTrack}
              className="border-2 border-black bg-white px-3 py-1 text-xs font-bold shadow-[2px_2px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5"
            >
              TRACK REPAIR
            </button>
            <button
              onClick={() => openWhatsApp()}
              className="border-2 border-black bg-yellow-400 px-4 py-1 text-xs font-black shadow-[3px_3px_0px_#000] hover:bg-yellow-300"
            >
              WHATSAPP
            </button>
            <button
              onClick={() => onOpenAdmin()}
              className="border-2 border-black bg-white p-1 shadow-[2px_2px_0px_#000]"
              title="Admin"
            >
              ⚙️
            </button>
          </div>
        </div>
      </header>

      {/* 2. Brutalist Hero Block */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <div className="border-4 border-black bg-yellow-300 p-6 sm:p-10 shadow-[8px_8px_0px_#000] mb-12">
          <div className="inline-block border-2 border-black bg-white px-3 py-0.5 text-xs font-black mb-4 shadow-[2px_2px_0px_#000]">
            VERIFIED PRE-OWNED SMARTPHONES
          </div>
          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-none uppercase">
            CERTIFIED PHONES.
            <br />
            NO FAKE CLAIMS.
          </h2>
          <p className="text-sm font-sans font-bold text-slate-800 mt-4 max-w-xl">
            Clean original devices directly inspected in our Local workshop. Authentic shop bill with 7-day replacement guarantee.
          </p>

          <div className="mt-6 flex flex-wrap gap-4">
            <button
              onClick={() => openWhatsApp(phones[0])}
              className="border-2 border-black bg-black text-white px-6 py-2.5 text-xs font-black tracking-wider uppercase shadow-[4px_4px_0px_#facc15] hover:bg-slate-900"
            >
              CLAIM LATEST DEAL (₹{Number(phones[0]?.selling_price || 0).toLocaleString()})
            </button>
          </div>
        </div>

        {/* 3. Catalog Header & Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b-2 border-black pb-4">
          <h3 className="font-black text-xl tracking-tight uppercase flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            STOCK_FEED [{filteredPhones.length} DEVICES]
          </h3>

          <div className="flex gap-2">
            {[
              { id: "ALL", label: "ALL" },
              { id: "APPLE", label: "APPLE" },
              { id: "ANDROID", label: "ANDROID" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterBrand(f.id)}
                className={`border-2 border-black px-3 py-1 text-xs font-black ${
                  filterBrand === f.id
                    ? "bg-black text-white shadow-[2px_2px_0px_#facc15]"
                    : "bg-white text-black shadow-[2px_2px_0px_#000]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Brutalist Phone Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredPhones.map((phone, idx) => (
            <div
              key={phone.id || idx}
              className="border-4 border-black bg-white p-4 shadow-[6px_6px_0px_#000] flex flex-col justify-between hover:translate-x-1 hover:translate-y-1 transition-transform"
            >
              <div>
                <div className="flex items-center justify-between text-xs font-bold border-b-2 border-black pb-2 mb-3">
                  <span className="bg-yellow-300 px-1.5 py-0.5 border border-black text-[10px]">
                    {phone.condition || "TESTED A"}
                  </span>
                  <span className="text-[10px]">{phone.variant || "Standard"}</span>
                </div>

                <h4 className="font-black text-base uppercase leading-tight line-clamp-1">{phone.phone_name}</h4>
                <p className="text-xs text-slate-600 font-sans mb-3">{phone.model}</p>

                <div className="h-40 border-2 border-dashed border-black bg-[#fafaf7] flex items-center justify-center p-2 mb-4">
                  {phone.product_photos && phone.product_photos[0] ? (
                    <img
                      src={phone.product_photos[0]}
                      alt={phone.phone_name}
                      className="h-full object-contain"
                    />
                  ) : (
                    <Smartphone className="h-16 w-16 text-black" />
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between border-t-2 border-black pt-3 mb-3">
                  <span className="text-xl font-black">₹{Number(phone.selling_price || 0).toLocaleString()}</span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-500 px-1">
                    READY
                  </span>
                </div>

                <button
                  onClick={() => openWhatsApp(phone)}
                  className="w-full border-2 border-black bg-yellow-400 hover:bg-yellow-300 py-2 text-xs font-black shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 uppercase"
                >
                  BUY ON WHATSAPP
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 5. Brutalist Repairs Sheet */}
        <div className="mt-16 border-4 border-black bg-white p-6 sm:p-8 shadow-[8px_8px_0px_#000]">
          <h3 className="font-black text-xl uppercase mb-2 flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            WORKSHOP DIAGNOSTICS &amp; REPAIRS
          </h3>
          <p className="text-xs font-sans text-slate-700 mb-6">
            Instant counter diagnosis with authentic replacement parts.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {repairs.map((rep) => (
              <div
                key={rep.id}
                className="border-2 border-black p-4 bg-[#fafaf7] flex flex-col justify-between shadow-[3px_3px_0px_#000]"
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-bold mb-2">
                    <span className="text-xl">{rep.icon}</span>
                    <span className="border border-black bg-white px-1.5 py-0.5 text-[10px]">
                      {rep.duration}
                    </span>
                  </div>
                  <h4 className="font-black text-sm uppercase">{rep.title}</h4>
                  <p className="text-xs font-sans text-slate-600 mt-1">{rep.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t-2 border-black flex items-center justify-between">
                  <span className="font-black text-sm">{rep.price}</span>
                  <button
                    onClick={() => openRepairWhatsApp(rep)}
                    className="border border-black bg-black text-white px-3 py-1 text-[11px] font-bold hover:bg-slate-800"
                  >
                    BOOK
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t-4 border-black bg-black text-white py-6 text-center text-xs">
        <p>© 2026 {businessName} BRUTALIST HUD. .</p>
      </footer>
    </div>
  );
};
export default BrutalistTheme;

