import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { data as dataDriver } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  MessageSquare,
  Phone,
  ChevronLeft,
  ChevronRight,
  X,
  Heart,
  Smartphone,
  ShieldCheck,
  CheckCircle,
  Sparkles,
  Zap,
  ArrowRight,
  RotateCw,
  Eye,
  Tag,
  Star,
} from "lucide-react";

interface FeaturedPhonesProps {
  theme?: string;
  displayMode?: string;
  whatsappNumber?: string;
  phonePrimary?: string;
}

const FeaturedPhones: React.FC<FeaturedPhonesProps> = ({
  theme = "modern",
  displayMode = "grid",
  whatsappNumber: propWa,
  phonePrimary: propPhone,
}) => {
  const [selectedPhone, setSelectedPhone] = useState<any>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [waNumber, setWaNumber] = useState<string>(propWa || "");
  const [phoneNum, setPhoneNum] = useState<string>(propPhone || "");
  const [activeSplitIndex, setActiveSplitIndex] = useState(0);
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (propWa) setWaNumber(propWa);
    if (propPhone) setPhoneNum(propPhone);
    if (!propWa || !propPhone) {
      dataDriver
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

  const { data: phones, isLoading } = useQuery({
    queryKey: ["featured-phones"],
    queryFn: () => dataDriver.listPublicPhones(24),
  });

  const scrollCarousel = (dir: "left" | "right") => {
    if (carouselRef.current) {
      const scrollAmt = dir === "left" ? -340 : 340;
      carouselRef.current.scrollBy({ left: scrollAmt, behavior: "smooth" });
    }
  };

  const openImageModal = (phone: any, imageIndex: number = 0) => {
    setSelectedPhone(phone);
    setCurrentImageIndex(imageIndex);
  };

  const closeModal = () => {
    setSelectedPhone(null);
    setCurrentImageIndex(0);
  };

  const nextImage = () => {
    if (selectedPhone?.product_photos) {
      setCurrentImageIndex((prev) =>
        prev < selectedPhone.product_photos.length - 1 ? prev + 1 : 0
      );
    }
  };

  const prevImage = () => {
    if (selectedPhone?.product_photos) {
      setCurrentImageIndex((prev) =>
        prev > 0 ? prev - 1 : selectedPhone.product_photos.length - 1
      );
    }
  };

  const toggleFlip = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFlippedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 1) return "TODAY";
    if (diffDays <= 7) return `${diffDays} DAYS AGO`;
    if (diffDays <= 30) return `${Math.ceil(diffDays / 7)} WEEKS AGO`;
    return date.toLocaleDateString();
  };

  const cleanWa = (waNumber || phoneNum || "").replace(/\D/g, "");
  const targetWa = cleanWa ? (cleanWa.length === 10 ? `91${cleanWa}` : cleanWa) : "";
  const cleanPhone = (phoneNum || waNumber || "").replace(/\D/g, "");

  const handleWhatsApp = (phone: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const msg = `Hi! I'm interested in ${phone.phone_name} - ${phone.model} (₹${Number(phone.selling_price || 0).toLocaleString()}). Is this available?`;
    if (targetWa) {
      window.open(`https://wa.me/${targetWa}?text=${encodeURIComponent(msg)}`, "_blank");
    }
  };

  const handleCall = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (cleanPhone) window.open(`tel:${cleanPhone}`, "_self");
  };

  // Theme Visual Tokens
  const isNeon = theme === "neon";
  const isGlass = theme === "glassmorphism";
  const isBrutalist = theme === "brutalist";
  const isLuxury = theme === "luxury";
  const isApple = theme === "apple_minimal";
  const isBentoTheme = theme === "bento_pro";

  let sectionBg = "bg-white";
  let headingColor = "text-gray-900";
  let subColor = "text-gray-600";
  let cardClass = "bg-white rounded-2xl shadow-sm border border-slate-200/90 hover:shadow-xl hover:-translate-y-1 mac-card";
  let priceColor = "text-gray-900";
  let waBtnClass = "bg-emerald-600 hover:bg-emerald-700 text-white font-semibold";

  if (isGlass) {
    sectionBg = "bg-gradient-to-b from-indigo-50/40 via-white/50 to-indigo-50/40";
    headingColor = "text-slate-900";
    subColor = "text-slate-600";
    cardClass = "backdrop-blur-xl bg-white/70 border border-white/60 rounded-3xl shadow-xl hover:shadow-2xl hover:bg-white/85 hover:-translate-y-1.5 mac-card";
    priceColor = "text-indigo-700 font-extrabold";
    waBtnClass = "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-500/20";
  } else if (isNeon) {
    sectionBg = "bg-[#07090e]";
    headingColor = "text-cyan-400";
    subColor = "text-slate-400";
    cardClass = "bg-[#0e1220] border border-cyan-500/40 rounded-2xl shadow-[0_0_15px_rgba(6,182,212,0.12)] hover:shadow-[0_0_25px_rgba(6,182,212,0.35)] hover:border-cyan-400 hover:-translate-y-1.5 mac-card text-slate-100";
    priceColor = "text-cyan-300 font-bold";
    waBtnClass = "bg-cyan-500 hover:bg-cyan-400 text-black font-bold shadow-[0_0_15px_rgba(6,182,212,0.4)]";
  } else if (isBrutalist) {
    sectionBg = "bg-[#faf6ed]";
    headingColor = "text-black font-black uppercase tracking-tight";
    subColor = "text-neutral-700 font-mono";
    cardClass = "brutalist-card bg-white rounded-xl font-mono text-black";
    priceColor = "text-black font-black text-xl";
    waBtnClass = "brutalist-btn bg-emerald-400 hover:bg-emerald-300 text-black font-black border-2 border-black";
  } else if (isLuxury) {
    sectionBg = "bg-[#0b0c10]";
    headingColor = "text-amber-300 font-serif";
    subColor = "text-amber-200/70";
    cardClass = "bg-gradient-to-b from-[#131520] to-[#0c0d13] border border-amber-500/30 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:border-amber-400/70 hover:shadow-[0_15px_35px_rgba(245,158,11,0.2)] hover:-translate-y-1.5 mac-card text-amber-50";
    priceColor = "text-amber-400 font-serif font-bold";
    waBtnClass = "bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:brightness-110 text-black font-bold shadow-lg shadow-amber-500/20";
  } else if (isApple) {
    sectionBg = "bg-slate-50/60";
    cardClass = "bg-white/90 backdrop-blur-md rounded-3xl border border-slate-200/60 shadow-xs hover:shadow-2xl hover:scale-[1.02] mac-card";
    waBtnClass = "bg-black hover:bg-neutral-800 text-white font-medium rounded-full";
  } else if (isBentoTheme) {
    sectionBg = "bg-slate-900 text-slate-100";
    headingColor = "text-white";
    subColor = "text-slate-400";
    cardClass = "bg-slate-800/80 border border-white/10 rounded-2xl shadow-xl hover:border-white/20 hover:-translate-y-1 mac-card text-slate-100";
    priceColor = "text-violet-400 font-extrabold";
    waBtnClass = "bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold";
  }

  // --- SUB-RENDERERS FOR THE 12 MODES ---

  // 1. Standard Grid Card
  const renderGridCard = (phone: any) => (
    <div
      key={phone.id}
      className={`${cardClass} overflow-hidden cursor-pointer group flex flex-col justify-between`}
      onClick={() => openImageModal(phone, 0)}
    >
      <div className="relative aspect-square p-2.5 bg-slate-50/50">
        {phone.product_photos?.length > 0 ? (
          <>
            <img
              src={phone.product_photos[0]}
              alt={phone.phone_name}
              className="w-full h-full object-cover rounded-xl group-hover:scale-105 transition-transform duration-300"
            />
            {phone.product_photos.length > 1 && (
              <div className="absolute bottom-4 right-4 bg-black/75 text-white px-2 py-0.5 rounded-md text-[11px] font-medium">
                1/{phone.product_photos.length}
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full bg-slate-100 rounded-xl flex items-center justify-center">
            <Smartphone className="h-12 w-12 text-slate-400" />
          </div>
        )}
      </div>

      <div className="p-3.5 pt-2 flex flex-col justify-between flex-1">
        <div>
          <div className={`text-lg sm:text-xl font-bold mb-1 ${priceColor}`}>
            ₹{Number(phone.selling_price || 0).toLocaleString()}
          </div>
          <h3 className={`text-sm font-semibold line-clamp-2 leading-snug mb-1 ${isNeon ? "text-slate-100" : isLuxury ? "text-amber-100 font-serif" : "text-slate-900"}`}>
            {phone.phone_name} {phone.model ? `• ${phone.model}` : ""}
          </h3>
          {(phone.variant || phone.colour) && (
            <p className="text-xs text-slate-500 mb-2 truncate">
              {[phone.variant, phone.colour].filter(Boolean).join(" • ")}
            </p>
          )}
          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 mb-2">
            {phone.condition || "TESTED"}
          </span>
        </div>

        <div className="flex gap-1.5 pt-2 border-t border-slate-100">
          <Button size="sm" className={`flex-1 h-8 text-xs ${waBtnClass}`} onClick={(e) => handleWhatsApp(phone, e)}>
            <MessageSquare className="h-3 w-3 mr-1" /> Chat
          </Button>
          <Button size="sm" variant="outline" className="h-8 px-2.5" onClick={handleCall} title="Call Shop">
            <Phone className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );

  // 2. Showcase Card (Wide Spotlight format)
  const renderShowcaseCard = (phone: any) => (
    <div
      key={phone.id}
      className={`${cardClass} overflow-hidden cursor-pointer group flex flex-col md:flex-row transition-all duration-300`}
      onClick={() => openImageModal(phone, 0)}
    >
      <div className="md:w-1/2 relative aspect-square md:aspect-auto p-4 bg-slate-50/50 flex items-center justify-center">
        {phone.product_photos?.length > 0 ? (
          <img src={phone.product_photos[0]} alt={phone.phone_name} className="w-full h-full max-h-72 object-contain group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <Smartphone className="h-24 w-24 text-slate-400" />
        )}
      </div>
      <div className="md:w-1/2 p-6 flex flex-col justify-between">
        <div>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-emerald-100 text-emerald-800 mb-2 inline-block">
            {phone.condition || "Certified Pre-Owned"}
          </span>
          <h3 className={`text-xl sm:text-2xl font-bold mb-1 ${isLuxury ? "font-serif text-amber-200" : ""}`}>{phone.phone_name}</h3>
          <p className="text-sm text-slate-500 mb-3">{phone.model} • {phone.variant || "Standard"}</p>
          <div className={`text-2xl sm:text-3xl font-extrabold mb-4 ${priceColor}`}>
            ₹{Number(phone.selling_price || 0).toLocaleString()}
          </div>
          <div className="space-y-1.5 mb-6 text-xs text-slate-600">
            <div className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> <span>32-Point Quality Testing Verified</span></div>
            <div className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-blue-600" /> <span>Clean IMEI &amp; Bill Guarantee</span></div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button className={`flex-1 h-10 ${waBtnClass}`} onClick={(e) => handleWhatsApp(phone, e)}>
            <MessageSquare className="h-4 w-4 mr-2" /> Inquire on WhatsApp
          </Button>
          <Button variant="outline" className="h-10 px-4" onClick={handleCall}><Phone className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );

  // 3. Dense List Table View (POS Quick Catalog)
  const renderListMode = () => (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-xs">
      <table className="w-full text-left text-xs sm:text-sm">
        <thead className="bg-slate-50 border-b text-slate-600 uppercase text-[11px] font-bold">
          <tr>
            <th className="py-3 px-4">Device</th>
            <th className="py-3 px-4">Variant &amp; Specs</th>
            <th className="py-3 px-4">Condition</th>
            <th className="py-3 px-4">Price</th>
            <th className="py-3 px-4 text-right">Instant Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {phones.map((phone: any) => (
            <tr key={phone.id} className="hover:bg-blue-50/40 transition-colors cursor-pointer" onClick={() => openImageModal(phone, 0)}>
              <td className="py-3 px-4 font-semibold text-slate-900 flex items-center gap-3">
                {phone.product_photos?.[0] ? (
                  <img src={phone.product_photos[0]} alt="" className="h-10 w-10 object-cover rounded-lg border" />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center"><Smartphone className="h-5 w-5 text-slate-400" /></div>
                )}
                <span>{phone.phone_name} <span className="text-slate-500 font-normal">({phone.model})</span></span>
              </td>
              <td className="py-3 px-4 text-slate-600">{[phone.variant, phone.colour].filter(Boolean).join(" • ") || "Standard"}</td>
              <td className="py-3 px-4">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                  {phone.condition || "TESTED"}
                </span>
              </td>
              <td className="py-3 px-4 font-bold text-base text-emerald-600">₹{Number(phone.selling_price || 0).toLocaleString()}</td>
              <td className="py-3 px-4 text-right">
                <Button size="sm" className={`h-8 text-xs ${waBtnClass}`} onClick={(e) => handleWhatsApp(phone, e)}>
                  <MessageSquare className="h-3 w-3 mr-1" /> Buy / Chat
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // 4. Retro Polaroid Mode
  const renderPolaroidCard = (phone: any, index: number) => {
    const rotation = index % 3 === 0 ? "rotate-[-1.5deg]" : index % 3 === 1 ? "rotate-[1.5deg]" : "rotate-0";
    return (
      <div
        key={phone.id}
        onClick={() => openImageModal(phone, 0)}
        className={`bg-white p-3.5 pb-5 rounded-md shadow-md hover:shadow-2xl hover:scale-105 transition-all duration-300 border border-slate-200 cursor-pointer ${rotation}`}
      >
        <div className="aspect-square bg-slate-100 mb-3 overflow-hidden rounded-sm relative">
          {phone.product_photos?.[0] ? (
            <img src={phone.product_photos[0]} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><Smartphone className="h-12 w-12 text-slate-300" /></div>
          )}
          <span className="absolute top-2 left-2 bg-yellow-300 text-black font-mono text-[10px] font-bold px-1.5 py-0.5 shadow-xs">
            ORIGINAL
          </span>
        </div>
        <div className="text-center font-mono">
          <h4 className="text-sm font-bold text-slate-900 truncate">{phone.phone_name}</h4>
          <p className="text-xs text-slate-500 mb-2">{phone.model}</p>
          <div className="text-lg font-black text-emerald-600 mb-3">₹{Number(phone.selling_price || 0).toLocaleString()}</div>
          <Button size="sm" className="w-full h-7 text-xs bg-black text-white hover:bg-neutral-800" onClick={(e) => handleWhatsApp(phone, e)}>
            <MessageSquare className="h-3 w-3 mr-1" /> Reserve via WhatsApp
          </Button>
        </div>
      </div>
    );
  };

  // 5. 3D Flip Card Mode
  const render3DCard = (phone: any) => {
    const isFlipped = !!flippedCards[phone.id];
    return (
      <div key={phone.id} className="h-80 [perspective:1000px] cursor-pointer" onClick={(e) => toggleFlip(phone.id, e)}>
        <div className={`relative w-full h-full transition-transform duration-700 [transform-style:preserve-3d] ${isFlipped ? "[transform:rotateY(180deg)]" : ""}`}>
          {/* Front Face */}
          <div className={`absolute inset-0 [backface-visibility:hidden] ${cardClass} p-4 flex flex-col justify-between`}>
            <div className="relative aspect-square max-h-40 mx-auto w-full rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center">
              {phone.product_photos?.[0] ? (
                <img src={phone.product_photos[0]} alt="" className="w-full h-full object-cover" />
              ) : (
                <Smartphone className="h-12 w-12 text-slate-400" />
              )}
              <span className="absolute bottom-2 right-2 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded flex items-center gap-1">
                <RotateCw className="h-2.5 w-2.5" /> Flip specs
              </span>
            </div>
            <div>
              <div className="text-lg font-bold text-emerald-600 mb-0.5">₹{Number(phone.selling_price || 0).toLocaleString()}</div>
              <h4 className="font-bold text-sm text-slate-900 truncate">{phone.phone_name}</h4>
              <p className="text-xs text-slate-500">{phone.model}</p>
            </div>
            <Button size="sm" className={`h-8 text-xs ${waBtnClass}`} onClick={(e) => handleWhatsApp(phone, e)}>
              <MessageSquare className="h-3 w-3 mr-1" /> Chat on WhatsApp
            </Button>
          </div>

          {/* Back Face */}
          <div className={`absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] ${cardClass} p-5 flex flex-col justify-between bg-gradient-to-br from-slate-900 to-indigo-950 text-white`}>
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-indigo-300">DEVICE AUDIT SPEC</span>
                <span className="text-[10px] text-slate-400">Click to flip</span>
              </div>
              <h4 className="font-bold text-base text-white mb-1">{phone.phone_name}</h4>
              <p className="text-xs text-slate-300 mb-4">{phone.variant || "Standard"} • {phone.colour || "Standard"}</p>
              <div className="space-y-2 text-xs text-slate-200">
                <div className="flex justify-between border-b border-white/10 pb-1">
                  <span>Condition</span>
                  <span className="font-bold text-emerald-400 uppercase">{phone.condition || "A+"}</span>
                </div>
                <div className="flex justify-between border-b border-white/10 pb-1">
                  <span>Box &amp; Bill</span>
                  <span className="text-white">{phone.bill_available ? "Yes (Verified)" : "Store Bill"}</span>
                </div>
                <div className="flex justify-between border-b border-white/10 pb-1">
                  <span>Testing</span>
                  <span className="text-cyan-300">100% Passed</span>
                </div>
              </div>
            </div>
            <Button size="sm" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold" onClick={(e) => handleWhatsApp(phone, e)}>
              <MessageSquare className="h-3 w-3 mr-1" /> Buy for ₹{Number(phone.selling_price || 0).toLocaleString()}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // 6. Minimal Ticker Strip
  const renderMinimalStrip = (phone: any) => (
    <div
      key={phone.id}
      onClick={() => openImageModal(phone, 0)}
      className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-blue-500 hover:shadow-md transition-all flex items-center justify-between gap-4 cursor-pointer"
    >
      <div className="flex items-center gap-3">
        {phone.product_photos?.[0] ? (
          <img src={phone.product_photos[0]} alt="" className="h-12 w-12 object-cover rounded-xl border" />
        ) : (
          <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center"><Smartphone className="h-6 w-6 text-slate-400" /></div>
        )}
        <div>
          <h4 className="font-bold text-sm text-slate-900">{phone.phone_name}</h4>
          <p className="text-xs text-slate-500">{phone.model} • {phone.variant || "Pre-Owned"}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-base font-extrabold text-emerald-600">₹{Number(phone.selling_price || 0).toLocaleString()}</div>
          <span className="text-[10px] text-slate-400">{formatDate(phone.created_at)}</span>
        </div>
        <Button size="sm" className={waBtnClass} onClick={(e) => handleWhatsApp(phone, e)}>
          <MessageSquare className="h-3 w-3 mr-1" /> WhatsApp
        </Button>
      </div>
    </div>
  );

  // 7. Editorial Lookbook Mode
  const renderMagazineCard = (phone: any) => (
    <div
      key={phone.id}
      onClick={() => openImageModal(phone, 0)}
      className="relative aspect-[3/4] rounded-3xl overflow-hidden shadow-xl hover:scale-[1.02] transition-transform duration-300 cursor-pointer group"
    >
      {phone.product_photos?.[0] ? (
        <img src={phone.product_photos[0]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      ) : (
        <div className="w-full h-full bg-slate-800 flex items-center justify-center"><Smartphone className="h-16 w-16 text-slate-500" /></div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-end p-5 text-white">
        <span className="text-[10px] font-mono tracking-widest uppercase text-yellow-400 mb-1">PHONEZONE EDITORIAL</span>
        <h4 className="text-xl font-bold font-serif leading-tight mb-0.5">{phone.phone_name}</h4>
        <p className="text-xs text-slate-300 mb-3">{phone.model} • {phone.variant || "Grade A"}</p>
        <div className="flex items-center justify-between">
          <span className="text-2xl font-serif font-bold text-white">₹{Number(phone.selling_price || 0).toLocaleString()}</span>
          <Button size="sm" className="bg-white/90 hover:bg-white text-black font-bold text-xs rounded-full" onClick={(e) => handleWhatsApp(phone, e)}>
            Inquire
          </Button>
        </div>
      </div>
    </div>
  );

  // 8. Cyberpunk HUD Matrix Mode
  const renderCyberCard = (phone: any) => (
    <div
      key={phone.id}
      onClick={() => openImageModal(phone, 0)}
      className="bg-[#0b0e18] border border-cyan-500/40 rounded-xl p-4 shadow-[0_0_15px_rgba(6,182,212,0.15)] hover:border-cyan-300 hover:shadow-[0_0_25px_rgba(6,182,212,0.35)] transition-all cursor-pointer font-mono text-cyan-200 flex flex-col justify-between"
    >
      <div>
        <div className="flex justify-between items-center text-[10px] text-cyan-400 mb-2 border-b border-cyan-500/20 pb-1">
          <span>// STATUS: READY</span>
          <span>IMEI_VERIFIED</span>
        </div>
        <div className="aspect-square bg-[#05070d] rounded-lg overflow-hidden border border-cyan-500/30 mb-3 flex items-center justify-center relative">
          {phone.product_photos?.[0] ? (
            <img src={phone.product_photos[0]} alt="" className="w-full h-full object-cover" />
          ) : (
            <Smartphone className="h-10 w-10 text-cyan-700" />
          )}
          <span className="absolute top-1.5 left-1.5 text-[9px] bg-cyan-950 text-cyan-300 px-1 py-0.5 border border-cyan-500/50">
            [SYS_OK]
          </span>
        </div>
        <h4 className="text-sm font-bold text-white truncate">{phone.phone_name}</h4>
        <p className="text-[11px] text-slate-400 mb-2">{phone.model}</p>
        <div className="text-lg font-bold text-cyan-300 mb-3">₹{Number(phone.selling_price || 0).toLocaleString()}</div>
      </div>
      <Button size="sm" className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold h-8 text-xs" onClick={(e) => handleWhatsApp(phone, e)}>
        <Zap className="h-3 w-3 mr-1" /> EXECUTE ORDER
      </Button>
    </div>
  );

  // 9. Interactive Bento Box Mode
  const renderBentoLayout = () => {
    if (!phones || phones.length === 0) return null;
    const heroPhone = phones[0];
    const miniPhones = phones.slice(1, 5);

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Giant Hero Spotlight */}
        <div
          className={`lg:col-span-2 ${cardClass} p-6 sm:p-8 flex flex-col md:flex-row justify-between gap-6 cursor-pointer`}
          onClick={() => openImageModal(heroPhone, 0)}
        >
          <div className="md:w-1/2 flex items-center justify-center bg-slate-50/50 rounded-2xl p-4">
            {heroPhone.product_photos?.[0] ? (
              <img src={heroPhone.product_photos[0]} alt="" className="max-h-72 object-contain" />
            ) : (
              <Smartphone className="h-28 w-28 text-slate-300" />
            )}
          </div>
          <div className="md:w-1/2 flex flex-col justify-between">
            <div>
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-gradient-to-r from-blue-600 to-indigo-600 text-white mb-3 inline-block">
                ⚡ TOP DEAL OF THE DAY
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-1">{heroPhone.phone_name}</h3>
              <p className="text-sm text-slate-500 mb-4">{heroPhone.model} • {heroPhone.variant || "Full Kit"}</p>
              <div className="text-3xl font-black text-emerald-600 mb-6">₹{Number(heroPhone.selling_price || 0).toLocaleString()}</div>
              <div className="space-y-1.5 text-xs text-slate-600 mb-6">
                <div>✓ 100% Genuine Display &amp; Battery Health</div>
                <div>✓ Physical Bill &amp; Store Warranty Included</div>
              </div>
            </div>
            <Button className={`h-11 ${waBtnClass} text-sm font-bold`} onClick={(e) => handleWhatsApp(heroPhone, e)}>
              <MessageSquare className="h-4 w-4 mr-2" /> Book This Deal on WhatsApp
            </Button>
          </div>
        </div>

        {/* Right 4 Mini Tiles */}
        <div className="grid grid-cols-2 gap-4">
          {miniPhones.map((p: any) => (
            <div
              key={p.id}
              onClick={() => openImageModal(p, 0)}
              className={`${cardClass} p-3 flex flex-col justify-between cursor-pointer group`}
            >
              <div className="aspect-square bg-slate-50 rounded-xl mb-2 overflow-hidden flex items-center justify-center">
                {p.product_photos?.[0] ? (
                  <img src={p.product_photos[0]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                ) : (
                  <Smartphone className="h-8 w-8 text-slate-300" />
                )}
              </div>
              <div>
                <h4 className="font-bold text-xs text-slate-900 truncate">{p.phone_name}</h4>
                <div className="text-xs font-bold text-emerald-600 mb-2">₹{Number(p.selling_price || 0).toLocaleString()}</div>
              </div>
              <Button size="sm" className="h-7 text-[11px] bg-slate-900 text-white hover:bg-blue-600" onClick={(e) => handleWhatsApp(p, e)}>
                Chat
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // 10. Split Focus Slider
  const renderSplitSlider = () => {
    if (!phones || phones.length === 0) return null;
    const current = phones[activeSplitIndex] || phones[0];

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Big Display on Left */}
        <div className={`lg:col-span-2 ${cardClass} p-6 sm:p-8 flex flex-col md:flex-row items-center gap-8`}>
          <div className="md:w-1/2 aspect-square max-h-80 w-full flex items-center justify-center bg-slate-50 rounded-2xl p-4 cursor-pointer" onClick={() => openImageModal(current, 0)}>
            {current.product_photos?.[0] ? (
              <img src={current.product_photos[0]} alt="" className="max-h-72 object-contain" />
            ) : (
              <Smartphone className="h-28 w-28 text-slate-300" />
            )}
          </div>
          <div className="md:w-1/2">
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 mb-3 inline-block">
              FEATURED INVENTORY
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-1">{current.phone_name}</h3>
            <p className="text-sm text-slate-500 mb-4">{current.model} • {current.variant || "Standard"}</p>
            <div className="text-3xl font-black text-emerald-600 mb-6">₹{Number(current.selling_price || 0).toLocaleString()}</div>
            <div className="flex gap-2">
              <Button className={`flex-1 h-11 ${waBtnClass} text-sm font-bold`} onClick={(e) => handleWhatsApp(current, e)}>
                <MessageSquare className="h-4 w-4 mr-2" /> Inquire via WhatsApp
              </Button>
              <Button variant="outline" className="h-11 px-4" onClick={handleCall}><Phone className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>

        {/* Scrollable Selector on Right */}
        <div className="flex flex-col gap-2.5 max-h-[460px] overflow-y-auto pr-1 scrollbar-thin">
          {phones.map((p: any, idx: number) => (
            <div
              key={p.id}
              onClick={() => setActiveSplitIndex(idx)}
              className={`p-3 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                activeSplitIndex === idx
                  ? "border-blue-600 bg-blue-50/70 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-3">
                {p.product_photos?.[0] ? (
                  <img src={p.product_photos[0]} alt="" className="h-10 w-10 object-cover rounded-lg border" />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center"><Smartphone className="h-5 w-5 text-slate-400" /></div>
                )}
                <div>
                  <h5 className="font-bold text-xs text-slate-900 truncate max-w-[140px]">{p.phone_name}</h5>
                  <p className="text-[11px] text-slate-500">{p.model}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-emerald-600">₹{Number(p.selling_price || 0).toLocaleString()}</div>
                <span className="text-[10px] text-blue-600 font-medium">Select</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <section id="phones" className={`py-16 md:py-24 ${sectionBg} transition-colors duration-500`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row items-center justify-between mb-12 gap-4">
            <div className="text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-2 bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                <Sparkles className="h-3.5 w-3.5" /> Certified Second-Hand Stock
              </div>
              <h2 className={`text-3xl sm:text-4xl font-extrabold ${headingColor} tracking-tight`}>
                Featured Mobile Phones
              </h2>
              <p className={`text-sm sm:text-base ${subColor} mt-1`}>
                100% verified, thoroughly tested smartphones ready for immediate delivery.
              </p>
            </div>

            {/* Carousel Navigation Buttons */}
            {displayMode === "carousel" && phones && phones.length > 0 && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => scrollCarousel("left")} className="rounded-full shadow-xs hover:bg-slate-100">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => scrollCarousel("right")} className="rounded-full shadow-xs hover:bg-slate-100">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
              <p className="text-slate-500 text-sm">Loading available phones...</p>
            </div>
          ) : !phones || phones.length === 0 ? (
            <div className="text-center py-16 px-4 bg-slate-50/60 rounded-3xl border border-dashed border-slate-300">
              <Smartphone className="h-12 w-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-800 mb-1">No Phones Currently Listed</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">All inventory items have been sold out. New devices arrive daily!</p>
            </div>
          ) : displayMode === "carousel" ? (
            <div ref={carouselRef} className="flex gap-4 sm:gap-6 overflow-x-auto pb-6 scrollbar-none snap-x snap-mandatory touch-pan-x">
              {phones.map((phone) => (
                <div key={phone.id} className="min-w-[240px] sm:min-w-[280px] max-w-[280px] snap-start">
                  {renderGridCard(phone)}
                </div>
              ))}
            </div>
          ) : displayMode === "showcase" ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {phones.slice(0, 8).map((phone) => renderShowcaseCard(phone))}
            </div>
          ) : displayMode === "bento" ? (
            renderBentoLayout()
          ) : displayMode === "list_compact" ? (
            renderListMode()
          ) : displayMode === "polaroid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {phones.map((phone, idx) => renderPolaroidCard(phone, idx))}
            </div>
          ) : displayMode === "cards_3d" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {phones.map((phone) => render3DCard(phone))}
            </div>
          ) : displayMode === "minimal_strip" ? (
            <div className="space-y-3 max-w-4xl mx-auto">
              {phones.map((phone) => renderMinimalStrip(phone))}
            </div>
          ) : displayMode === "magazine" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {phones.map((phone) => renderMagazineCard(phone))}
            </div>
          ) : displayMode === "cyber_feed" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {phones.map((phone) => renderCyberCard(phone))}
            </div>
          ) : displayMode === "split_slider" ? (
            renderSplitSlider()
          ) : displayMode === "masonry" ? (
            <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-4 space-y-4">
              {phones.map((phone) => (
                <div key={phone.id} className="break-inside-avoid">
                  {renderGridCard(phone)}
                </div>
              ))}
            </div>
          ) : (
            /* Default: Responsive Grid */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-5">
              {phones.map((phone) => renderGridCard(phone))}
            </div>
          )}
        </div>
      </section>

      {/* Full Resolution Image Modal */}
      <Dialog open={!!selectedPhone} onOpenChange={closeModal}>
        <DialogContent className="max-w-5xl w-full h-[85vh] p-0 overflow-hidden bg-black text-white border-0">
          <DialogHeader className="p-4 bg-slate-950/80 border-b border-slate-800 flex flex-row justify-between items-center">
            <DialogTitle className="text-base sm:text-lg font-bold truncate">
              {selectedPhone?.phone_name} {selectedPhone?.model ? `- ${selectedPhone.model}` : ""}
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={closeModal} className="text-slate-400 hover:text-white">
              <X className="h-5 w-5" />
            </Button>
          </DialogHeader>

          {selectedPhone?.product_photos && selectedPhone.product_photos.length > 0 && (
            <div className="relative flex-1 flex items-center justify-center p-4 bg-black h-[calc(85vh-70px)]">
              <img
                src={selectedPhone.product_photos[currentImageIndex]}
                alt={`${selectedPhone.phone_name} Photo ${currentImageIndex + 1}`}
                className="max-w-full max-h-full object-contain"
              />

              {selectedPhone.product_photos.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/60 text-white hover:bg-black/80 rounded-full h-10 w-10"
                    onClick={prevImage}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/60 text-white hover:bg-black/80 rounded-full h-10 w-10"
                    onClick={nextImage}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>

                  <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-black/80 text-white px-3 py-1 rounded-full text-xs font-semibold border border-white/20">
                    {currentImageIndex + 1} / {selectedPhone.product_photos.length}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FeaturedPhones;
