import React from "react";
import { ContactInfo } from "@/lib/data/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  Star,
  Instagram,
  MessageSquare,
  Phone,
  Search,
  ExternalLink,
  Lock,
} from "lucide-react";

interface StorefrontTopBarProps {
  contact: ContactInfo | null;
  whatsappNumber?: string;
  phonePrimary?: string;
  onOpenAdmin: () => void;
  onNavigateTrack: () => void;
}

export const StorefrontTopBar: React.FC<StorefrontTopBarProps> = ({
  contact,
  whatsappNumber,
  phonePrimary,
  onOpenAdmin,
  onNavigateTrack,
}) => {
  const udyamNumber = contact?.udyam_number || "";
  const showUdyam = Boolean(contact?.show_udyam && udyamNumber);
  const googleBusinessUrl = contact?.google_business_url || "";

  const rawInstagram = contact?.instagram || "";
  const instagramHandle = rawInstagram.replace(/^@+/, "").trim();

  const rawWa = whatsappNumber || contact?.whatsapp_number || phonePrimary || contact?.phone_primary || "";
  const cleanWa = rawWa.replace(/\D/g, "");
  const targetWa = cleanWa ? (cleanWa.length === 10 ? `91${cleanWa}` : cleanWa) : "";

  const rawPhone = phonePrimary || contact?.phone_primary || "";
  const cleanPhone = rawPhone.replace(/\D/g, "");

  return (
    <div className="w-full bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white text-[11px] sm:text-xs py-2 px-3 sm:px-6 border-b border-slate-800/80 shadow-xs sticky top-0 z-50 backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2 text-center md:text-left">
        {/* Left: Govt Udyam & Business Verification */}
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 sm:gap-4">
          {showUdyam && (
            <>
              <span className="inline-flex items-center gap-1.5 font-bold text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>Govt. Reg. Udyam: <strong className="text-white">{udyamNumber}</strong></span>
              </span>
              <span className="hidden sm:inline text-slate-600">•</span>
            </>
          )}

          {googleBusinessUrl && (
            <a
              href={googleBusinessUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-amber-300 hover:text-amber-200 hover:underline font-semibold transition-colors"
            >
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span>4.9★ Google Business</span>
              <ExternalLink className="h-2.5 w-2.5 opacity-70" />
            </a>
          )}
        </div>

        {/* Right: Instagram, WhatsApp, Phone & Admin Staff */}
        <div className="flex flex-wrap items-center justify-center md:justify-end gap-2.5 sm:gap-4">
          {instagramHandle && (
            <a
              href={`https://instagram.com/${instagramHandle}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-pink-300 hover:text-pink-200 font-bold hover:underline transition-colors px-2 py-0.5 rounded-full bg-pink-500/15 border border-pink-500/30"
            >
              <Instagram className="h-3 w-3 text-pink-400" />
              <span>@{instagramHandle}</span>
            </a>
          )}

          {targetWa && (
            <a
              href={`https://wa.me/${targetWa}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-emerald-300 hover:text-emerald-200 font-bold hover:underline transition-colors px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30"
            >
              <MessageSquare className="h-3 w-3 text-emerald-400" />
              <span className="hidden sm:inline">WhatsApp:</span>
              <span>+91 {rawWa}</span>
            </a>
          )}

          {rawPhone && (
            <a
              href={`tel:${cleanPhone}`}
              className="inline-flex items-center gap-1 text-blue-300 hover:text-blue-200 font-semibold hover:underline transition-colors hidden lg:inline-flex"
            >
              <Phone className="h-3 w-3 text-blue-400" />
              <span>Hotline: {rawPhone}</span>
            </a>
          )}

          <button
            onClick={onNavigateTrack}
            className="inline-flex items-center gap-1 text-slate-300 hover:text-white transition-colors font-medium hover:underline text-[11px]"
          >
            <Search className="h-3 w-3 text-cyan-400" />
            <span>Track Repair</span>
          </button>

          <button
            onClick={onOpenAdmin}
            className="inline-flex items-center gap-1 text-slate-400 hover:text-white transition-colors text-[11px] font-medium ml-1"
          >
            <Lock className="h-3 w-3 text-slate-500 hover:text-slate-300" />
            <span>Admin</span>
          </button>
        </div>
      </div>
    </div>
  );
};

