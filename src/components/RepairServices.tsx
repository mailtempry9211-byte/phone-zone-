import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, Phone, Wrench, ShieldCheck, Clock } from "lucide-react";
import { data } from "@/lib/data";

export interface RepairTile {
  id?: string;
  icon: string;
  title: string;
  price: string;
  duration: string;
  description: string;
  active?: boolean;
}

interface RepairServicesProps {
  whatsappNumber?: string;
  phonePrimary?: string;
  customServices?: RepairTile[];
  theme?: string;
}

const DEFAULT_SERVICES: RepairTile[] = [
  {
    icon: "📱",
    title: "Screen Replacement",
    price: "₹1,500",
    duration: "30–60 mins",
    description: "High-quality screen replacement with warranty",
    active: true,
  },
  {
    icon: "🔋",
    title: "Battery Replacement",
    price: "₹800",
    duration: "15–30 mins",
    description: "Original battery with extended backup & warranty",
    active: true,
  },
  {
    icon: "🔌",
    title: "Charging Port Repair",
    price: "₹600",
    duration: "20–45 mins",
    description: "Fix slow charging, loose connector, or mic issue",
    active: true,
  },
  {
    icon: "💻",
    title: "Software Issues",
    price: "₹300",
    duration: "30–90 mins",
    description: "OS flashing, FRP unlock, bootloop fix, performance tune",
    active: true,
  },
  {
    icon: "💧",
    title: "Water Damage Repair",
    price: "₹1,200",
    duration: "2–24 hours",
    description: "Deep chemical cleaning and motherboard restoration",
    active: true,
  },
  {
    icon: "🔧",
    title: "General Repairs",
    price: "₹500",
    duration: "30–120 mins",
    description: "Camera lens, speaker, earpiece, back glass replacement",
    active: true,
  },
];

const RepairServices: React.FC<RepairServicesProps> = ({
  whatsappNumber: propWa,
  phonePrimary: propPhone,
  customServices,
  theme = "modern",
}) => {
  const [waNumber, setWaNumber] = useState<string>(propWa || "");
  const [phoneNum, setPhoneNum] = useState<string>(propPhone || "");

  useEffect(() => {
    if (propWa) setWaNumber(propWa);
    if (propPhone) setPhoneNum(propPhone);
    if (!propWa || !propPhone) {
      data
        .getContactInfo()
        .then((info) => {
          if (info) {
            if (!propWa) setWaNumber(info.whatsapp_number || info.phone_primary || "");
            if (!propPhone) setPhoneNum(info.phone_primary || "");
          }
        })
        .catch(() => {});
    }
  }, [propWa, propPhone]);

  // Determine active services
  const rawList = customServices && customServices.length > 0 ? customServices : DEFAULT_SERVICES;
  const services = rawList.filter((s) => s.active !== false);

  // Theme-specific wrapper and card classes
  const isNeon = theme === "neon";
  const isGlass = theme === "glassmorphism";
  const isBrutalist = theme === "brutalist";
  const isLuxury = theme === "luxury";

  let sectionBg = "bg-gray-50/80";
  let headingColor = "text-gray-900";
  let subColor = "text-gray-600";
  let cardClass = "bg-white rounded-2xl shadow-sm border border-slate-200/80 hover:shadow-xl hover:-translate-y-1 mac-card";
  let priceColor = "text-emerald-600";
  let waBtnClass = "bg-emerald-600 hover:bg-emerald-700 text-white font-semibold";
  let callBtnClass = "border-slate-300 hover:bg-slate-50 text-slate-800";

  if (isGlass) {
    sectionBg = "bg-white/30 backdrop-blur-md";
    headingColor = "text-slate-900";
    subColor = "text-slate-600";
    cardClass = "backdrop-blur-xl bg-white/70 border border-white/60 rounded-3xl shadow-xl hover:shadow-2xl hover:bg-white/85 hover:-translate-y-1.5 mac-card";
    priceColor = "text-blue-600 font-extrabold";
    waBtnClass = "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-indigo-500/20";
  } else if (isNeon) {
    sectionBg = "bg-[#090c14]";
    headingColor = "text-cyan-400";
    subColor = "text-slate-400";
    cardClass = "bg-[#0e1220] border border-cyan-500/40 rounded-2xl shadow-[0_0_15px_rgba(6,182,212,0.12)] hover:shadow-[0_0_25px_rgba(6,182,212,0.35)] hover:border-cyan-400 hover:-translate-y-1.5 mac-card text-slate-100";
    priceColor = "text-cyan-300 font-bold";
    waBtnClass = "bg-cyan-500 hover:bg-cyan-400 text-black font-bold shadow-[0_0_15px_rgba(6,182,212,0.4)]";
    callBtnClass = "border-cyan-500/50 text-cyan-300 hover:bg-cyan-950/50";
  } else if (isBrutalist) {
    sectionBg = "bg-[#fefce8]";
    headingColor = "text-black font-black uppercase tracking-tight";
    subColor = "text-neutral-700 font-mono";
    cardClass = "brutalist-card bg-white rounded-xl p-6 font-mono";
    priceColor = "text-black font-black text-2xl";
    waBtnClass = "brutalist-btn bg-emerald-400 hover:bg-emerald-300 text-black font-black border-2 border-black";
    callBtnClass = "brutalist-btn bg-yellow-300 hover:bg-yellow-200 text-black font-black border-2 border-black";
  } else if (isLuxury) {
    sectionBg = "bg-[#0a0b0f]";
    headingColor = "text-amber-300 font-serif";
    subColor = "text-amber-200/70";
    cardClass = "bg-gradient-to-b from-[#131520] to-[#0d0e15] border border-amber-500/30 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:border-amber-400/70 hover:shadow-[0_15px_35px_rgba(245,158,11,0.2)] hover:-translate-y-1.5 mac-card text-amber-50";
    priceColor = "text-amber-400 font-serif font-bold";
    waBtnClass = "bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:brightness-110 text-black font-bold shadow-lg shadow-amber-500/20";
    callBtnClass = "border-amber-500/40 text-amber-300 hover:bg-amber-950/40";
  }

  return (
    <section id="repairs" className={`py-16 md:py-24 ${sectionBg} transition-colors duration-500`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-3 bg-blue-50 text-blue-700 border border-blue-200/60">
            <Wrench className="h-3.5 w-3.5" />
            Expert Repair Workshop
          </div>
          <h2 className={`text-3xl sm:text-4xl font-extrabold ${headingColor} tracking-tight mb-3`}>
            Professional Repair Services
          </h2>
          <p className={`text-base sm:text-lg ${subColor} max-w-2xl mx-auto leading-relaxed`}>
            Genuine spare parts, expert micro-soldering, transparent pricing, and instant turnaround.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {services.map((service, index) => (
            <div
              key={service.id || index}
              className={`${cardClass} p-6 sm:p-7 flex flex-col justify-between transition-all duration-300`}
            >
              <div>
                <div className="text-4xl sm:text-5xl mb-4 select-none transform hover:scale-110 transition-transform">
                  {service.icon}
                </div>
                <h3 className={`font-bold text-lg sm:text-xl mb-2 ${isNeon ? "text-slate-100" : isLuxury ? "text-amber-100 font-serif" : "text-gray-900"}`}>
                  {service.title}
                </h3>
                <div className="flex justify-between items-center mb-3">
                  <span className={`text-2xl sm:text-3xl font-extrabold ${priceColor}`}>
                    {service.price}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${
                    isNeon ? "bg-cyan-950/60 text-cyan-300 border border-cyan-500/30" :
                    isLuxury ? "bg-amber-950/50 text-amber-300 border border-amber-500/30" :
                    isBrutalist ? "border-2 border-black bg-yellow-200 font-bold" :
                    "bg-slate-100 text-slate-700"
                  }`}>
                    <Clock className="h-3 w-3" />
                    {service.duration}
                  </span>
                </div>
                <p className={`text-sm mb-6 leading-relaxed ${isNeon ? "text-slate-400" : isLuxury ? "text-amber-200/60" : "text-gray-600"}`}>
                  {service.description}
                </p>
              </div>

              <div className="flex gap-2.5 pt-2">
                <Button
                  className={`flex-1 h-10 ${waBtnClass} transition-transform active:scale-95`}
                  onClick={() => {
                    const clean = (waNumber || phoneNum || "").replace(/\D/g, "");
                    const target = clean ? (clean.length === 10 ? `91${clean}` : clean) : "";
                    const message = `Hi! I need ${service.title} (${service.price}). When can I bring my device?`;
                    if (target) {
                      window.open(`https://wa.me/${target}?text=${encodeURIComponent(message)}`, "_blank");
                    }
                  }}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  WhatsApp
                </Button>
                <Button
                  variant="outline"
                  className={`h-10 px-3.5 ${callBtnClass} transition-transform active:scale-95`}
                  onClick={() => {
                    const clean = (phoneNum || waNumber || "").replace(/\D/g, "");
                    if (clean) window.open(`tel:${clean}`, "_self");
                  }}
                  title="Call Shop"
                >
                  <Phone className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default RepairServices;
