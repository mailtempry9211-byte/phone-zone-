import React, { useState } from "react";
import { ThemeProps } from "./types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Smartphone,
  Wrench,
  ShieldCheck,
  Check,
  Clock,
  Sparkles,
  ShoppingBag,
  Zap,
  Tag,
  PhoneCall,
  Search,
} from "lucide-react";

export const CompactRetailTheme: React.FC<ThemeProps> = ({
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
  const [search, setSearch] = useState("");

  const businessName = contact?.business_name || "PhoneZone";
  const cleanWa = (whatsappNumber || phonePrimary || "").replace(/\D/g, "");
  const targetWa = cleanWa ? (cleanWa.length === 10 ? `91${cleanWa}` : cleanWa) : "";

  const openWhatsApp = (phone?: any) => {
    const text = phone
      ? `Hello PhoneZone! I want to purchase ${phone.phone_name} (${phone.model || ""}) for ₹${Number(phone.selling_price || 0).toLocaleString()}.`
      : `Hello ${businessName}! Please share current available phones.`;
    if (targetWa) {
      window.open(`https://wa.me/${targetWa}?text=${encodeURIComponent(text)}`, "_blank");
    }
  };

  const openRepairWhatsApp = (repair: any) => {
    const text = `Hi! I need urgent repair: ${repair.title} (Starting ${repair.price}).`;
    if (targetWa) {
      window.open(`https://wa.me/${targetWa}?text=${encodeURIComponent(text)}`, "_blank");
    }
  };

  const filteredPhones = phones.filter((p) => {
    if (filterBrand === "APPLE" && !/apple|iphone/i.test(p.phone_name || "")) return false;
    if (filterBrand === "ANDROID" && /apple|iphone/i.test(p.phone_name || "")) return false;
    if (filterBrand === "BUDGET" && Number(p.selling_price || 0) > 20000) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const name = (p.phone_name || "").toLowerCase();
      const model = (p.model || "").toLowerCase();
      return name.includes(q) || model.includes(q);
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans">
      {/* 1. High Efficiency Top Bar */}
      <header className="bg-orange-600 text-white sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-white text-orange-600 flex items-center justify-center font-black text-sm shadow-xs">
              PZ
            </div>
            <div>
              <span className="font-extrabold text-sm sm:text-base tracking-tight leading-tight block">
                {businessName} Express Retail
              </span>
              <span className="text-[10px] text-orange-100 font-mono">
                {phones.length} VERIFIED PHONES IN STOCK
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={onNavigateTrack}
              className="h-7 text-xs bg-white/20 text-white hover:bg-white/30 border-none px-2.5"
            >
              <Clock className="h-3 w-3 mr-1" />
              Track
            </Button>
            <Button
              size="sm"
              onClick={() => openWhatsApp()}
              className="h-7 text-xs font-bold bg-white text-orange-600 hover:bg-orange-50 px-3 shadow-xs"
            >
              Order on WhatsApp
            </Button>
            <button
              onClick={() => onOpenAdmin()}
              className="p-1 text-orange-200 hover:text-white"
              title="Admin"
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* Rapid Category Filter Strip */}
        <div className="bg-orange-700/80 px-4 py-2 border-t border-orange-500/40">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 overflow-x-auto">
            <div className="flex items-center gap-1.5 shrink-0">
              {[
                { id: "ALL", label: `All (${phones.length})` },
                { id: "APPLE", label: "Apple iPhones" },
                { id: "ANDROID", label: "Android" },
                { id: "BUDGET", label: "Under ₹20K" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setFilterBrand(cat.id)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                    filterBrand === cat.id
                      ? "bg-white text-orange-700 shadow-xs"
                      : "text-orange-100 hover:bg-orange-600/60"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="relative shrink-0 w-44 sm:w-60">
              <input
                type="text"
                placeholder="Search phone model..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-7 pl-7 pr-2 rounded-md bg-orange-800/80 border border-orange-500/50 text-white text-xs placeholder:text-orange-200 focus:outline-none focus:bg-orange-900"
              />
              <Search className="h-3.5 w-3.5 text-orange-300 absolute left-2 top-2" />
            </div>
          </div>
        </div>
      </header>

      {/* 2. Fast Scanning Catalog Grid */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-8">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-orange-600" />
              In-Stock Smartphones ({filteredPhones.length})
            </h2>
            <span className="text-xs text-slate-500 font-mono">100% Guaranteed 32-Pt Check</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {filteredPhones.map((phone, idx) => (
              <div
                key={phone.id || idx}
                className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col justify-between hover:shadow-lg hover:border-orange-400 transition-all group"
              >
                <div>
                  <div className="aspect-square bg-slate-50 rounded-lg flex items-center justify-center p-2 mb-2 relative overflow-hidden">
                    {phone.product_photos && phone.product_photos[0] ? (
                      <img
                        src={phone.product_photos[0]}
                        alt={phone.phone_name}
                        className="h-full object-contain group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <Smartphone className="h-14 w-14 text-slate-300" />
                    )}
                    <span className="absolute top-1 left-1 bg-black/75 text-white text-[9px] font-mono px-1.5 py-0.5 rounded">
                      {phone.condition || "Grade A"}
                    </span>
                  </div>

                  <h3 className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-1">{phone.phone_name}</h3>
                  <p className="text-[11px] text-slate-500 line-clamp-1">{phone.model} • {phone.variant || "Std"}</p>
                </div>

                <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                  <div>
                    <span className="text-sm font-black text-slate-900 block leading-tight">
                      ₹{Number(phone.selling_price || 0).toLocaleString()}
                    </span>
                    <span className="text-[9px] text-emerald-600 font-bold">Tested</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => openWhatsApp(phone)}
                    className="h-7 px-2 text-[11px] font-bold bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    Buy Now
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Rapid Repair Pricing Ticker */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Wrench className="h-4 w-4 text-orange-600" />
                Workshop Repair Rate Sheet (Counter Delivery)
              </h3>
              <p className="text-xs text-slate-500">Same-day turnaround for display, battery, and charging port</p>
            </div>
            <span className="text-xs font-mono font-bold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-md border border-orange-200">
              Instant 30-Min Service
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {repairs.map((rep) => (
              <button
                key={rep.id}
                onClick={() => openRepairWhatsApp(rep)}
                className="p-3 rounded-xl border border-slate-200 hover:border-orange-500 hover:bg-orange-50/50 text-left transition-all flex flex-col justify-between"
              >
                <div>
                  <span className="text-xl mb-1 block">{rep.icon}</span>
                  <p className="font-bold text-xs text-slate-800 line-clamp-1">{rep.title}</p>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-baseline justify-between">
                  <span className="text-xs font-black text-orange-600">{rep.price}</span>
                  <span className="text-[9px] text-slate-400">{rep.duration}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>

      <footer className="bg-slate-800 text-slate-400 text-xs py-6 px-4 text-center mt-12">
        <p>© 2026 {businessName}. Express Mobile Sales &amp; Workshop. Local.</p>
      </footer>
    </div>
  );
};
export default CompactRetailTheme;

