import React from "react";
import { ContactInfo } from "@/lib/data/types";
import {
  MapPin,
  Phone,
  Mail,
  Instagram,
  Star,
  ExternalLink,
  Store,
} from "lucide-react";
import ContactForm from "@/components/ContactForm";

interface StorefrontBusinessHubProps {
  contact: ContactInfo | null;
  theme?: string;
  whatsappNumber?: string;
  phonePrimary?: string;
}

export const StorefrontBusinessHub: React.FC<StorefrontBusinessHubProps> = ({
  contact,
  theme = "modern",
  phonePrimary,
}) => {
  const businessName = contact?.business_name || "PhoneZone";
  const tagline = contact?.business_tagline || "PREMIUM MOBILES & EXPERT REPAIRS";
  const address = contact?.address || "";
  const email = contact?.email || "";
  const udyamNumber = contact?.udyam_number || "";
  const showUdyam = Boolean(contact?.show_udyam && udyamNumber);
  const googleBusinessUrl = contact?.google_business_url || "";

  const rawInstagram = contact?.instagram || "";
  const instagramHandle = rawInstagram.replace(/^@+/, "").trim();

  const phone1 = phonePrimary || contact?.phone_primary || "";
  const phone2 = contact?.phone_secondary || "";
  const displayPhone = phone1 && phone2 ? `${phone1}, ${phone2}` : (phone1 || phone2);

  const isDarkTheme = !["apple_minimal", "brutalist", "glassmorphism"].includes(theme);
  const isLuxury = theme === "luxury";
  const isNeon = theme === "neon";
  const isSplitSlider = theme === "split_slider";
  const isFluidCarousel = theme === "fluid_carousel";
  const isBrutalist = theme === "brutalist";
  const isGlass = theme === "glassmorphism";

  const containerBg = isLuxury
    ? "bg-[#0b0c10] text-amber-100 border-t border-amber-500/20"
    : isNeon
    ? "bg-[#070b14] text-slate-100 border-t border-cyan-500/20"
    : isSplitSlider
    ? "bg-[#080d1a] text-slate-100 border-t border-teal-500/20"
    : isFluidCarousel
    ? "bg-[#0a0718] text-slate-100 border-t border-violet-500/20"
    : isBrutalist
    ? "bg-[#fffbeb] text-black border-t-4 border-black"
    : isGlass
    ? "bg-gradient-to-b from-[#f8fafc] to-[#e2e8f0] text-slate-900 border-t border-indigo-200/80"
    : isDarkTheme
    ? "bg-[#080d19] text-slate-100 border-t border-slate-800"
    : "bg-white text-slate-900 border-t border-slate-200";

  const sectionBg = isLuxury
    ? "bg-[#0f1015]"
    : isNeon
    ? "bg-[#0a0f1d]"
    : isSplitSlider
    ? "bg-[#0c1424]"
    : isFluidCarousel
    ? "bg-[#0e0a22]"
    : isBrutalist
    ? "bg-[#fef08a]/40"
    : isGlass
    ? "bg-white/40 backdrop-blur-md"
    : isDarkTheme
    ? "bg-[#0b1220]"
    : "bg-gray-50";

  const headingColor = isLuxury
    ? "text-amber-300"
    : isNeon
    ? "text-cyan-300"
    : isSplitSlider
    ? "text-teal-300"
    : isFluidCarousel
    ? "text-violet-300"
    : isBrutalist
    ? "text-black font-black uppercase"
    : isDarkTheme
    ? "text-white"
    : "text-slate-900";

  const iconColor = isLuxury
    ? "text-amber-400"
    : isNeon
    ? "text-cyan-400"
    : isSplitSlider
    ? "text-teal-400"
    : isFluidCarousel
    ? "text-violet-400"
    : isBrutalist
    ? "text-black"
    : isGlass
    ? "text-indigo-600"
    : isDarkTheme
    ? "text-blue-400"
    : "text-blue-600";

  const textMuted = isDarkTheme ? "text-slate-300" : "text-gray-700";
  const itemTitleColor = isDarkTheme ? "text-white" : "text-gray-900";

  return (
    <div className={`w-full transition-colors duration-300 ${containerBg}`}>
      {/* Visit Our Store & Get In Touch Section */}
      <section className={`py-16 px-4 transition-colors duration-300 ${sectionBg}`}>
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Left Column: Visit Our Store */}
            <div className="space-y-6">
              <h2 className={`text-2xl md:text-3xl font-extrabold tracking-tight mb-8 ${headingColor}`}>
                Visit Our Store
              </h2>

              <div className="space-y-6">
                {/* Address */}
                {address && (
                  <div className="flex items-start space-x-4">
                    <MapPin className={`h-6 w-6 mt-1 shrink-0 ${iconColor}`} />
                    <div>
                      <h3 className={`font-bold mb-1 ${itemTitleColor}`}>Address</h3>
                      <p className={`whitespace-pre-line text-sm leading-relaxed ${textMuted}`}>
                        {address}
                      </p>
                    </div>
                  </div>
                )}

                {/* Phone */}
                {displayPhone && (
                  <div className="flex items-start space-x-4">
                    <Phone className={`h-6 w-6 mt-1 shrink-0 ${iconColor}`} />
                    <div>
                      <h3 className={`font-bold mb-1 ${itemTitleColor}`}>Phone</h3>
                      <p className={`text-sm ${textMuted}`}>
                        {displayPhone}
                      </p>
                    </div>
                  </div>
                )}

                {/* Email */}
                {email && (
                  <div className="flex items-start space-x-4">
                    <Mail className={`h-6 w-6 mt-1 shrink-0 ${iconColor}`} />
                    <div>
                      <h3 className={`font-bold mb-1 ${itemTitleColor}`}>Email</h3>
                      <p className={`text-sm ${textMuted}`}>
                        {email}
                      </p>
                    </div>
                  </div>
                )}

                {/* Instagram */}
                {instagramHandle && (
                  <div className="flex items-start space-x-4">
                    <Instagram className={`h-6 w-6 mt-1 shrink-0 ${iconColor}`} />
                    <div>
                      <h3 className={`font-bold mb-1 ${itemTitleColor}`}>Instagram</h3>
                      <p className={`text-sm ${textMuted}`}>
                        @{instagramHandle}
                      </p>
                    </div>
                  </div>
                )}

                {/* Google Business Review Link */}
                {googleBusinessUrl && (
                  <div className="flex items-start space-x-4">
                    <Star className="h-6 w-6 text-amber-400 fill-amber-400 mt-1 shrink-0" />
                    <div>
                      <h3 className={`font-bold mb-1 ${itemTitleColor}`}>Google Business Profile</h3>
                      <a
                        href={googleBusinessUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1.5 text-sm font-semibold hover:underline ${
                          isDarkTheme ? "text-cyan-400" : "text-blue-600"
                        }`}
                      >
                        <span>Verified 4.9★ Store • View on Google Maps</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                )}

                {/* Hours */}
                <div className="pt-2">
                  <h3 className={`font-bold mb-3 text-base ${itemTitleColor}`}>Store Hours</h3>
                  <div className={`space-y-1.5 text-sm ${textMuted}`}>
                    <p>Monday - Saturday: 10:00 AM - 8:00 PM</p>
                    <p>Sunday: 11:00 AM - 6:00 PM</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Get In Touch (ContactForm) */}
            <div>
              <h2 className={`text-2xl md:text-3xl font-extrabold tracking-tight mb-8 ${headingColor}`}>
                Get In Touch
              </h2>
              <ContactForm theme={theme} formOnly={true} />
            </div>
          </div>
        </div>
      </section>

      {/* High-Contrast Storefront Footer */}
      <footer className="bg-slate-950 text-white py-12 px-4 border-t border-slate-800">
        <div className="container mx-auto text-center max-w-5xl">
          {/* Logo & Branding */}
          <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-4 mb-4">
            {contact?.logo_url ? (
              <img src={contact.logo_url} alt="Logo" className="h-10 w-auto object-contain" />
            ) : (
              <div className="h-10 w-auto flex items-center justify-center">
                <Store className="h-8 w-8 text-blue-400" />
              </div>
            )}
            <div>
              <h3 className="text-xl font-extrabold text-white tracking-wide">{businessName}</h3>
              <p className="text-xs uppercase tracking-widest text-slate-300 font-bold">{tagline}</p>
            </div>
          </div>

          {/* Subtitle */}
          <p className="text-slate-300 text-xs sm:text-sm max-w-2xl mx-auto mb-4 font-medium">
            Your trusted destination for premium smartphones, expert repairs, and authentic customer service.
          </p>

          {/* Meta Strip: Address • Phone • Instagram */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-300 font-medium mb-5">
            {address && <span>{address}</span>}
            {address && displayPhone && <span className="hidden sm:inline text-slate-600">•</span>}
            {displayPhone && <span>{displayPhone}</span>}
            {instagramHandle && (
              <>
                {(address || displayPhone) && <span className="hidden sm:inline text-slate-600">•</span>}
                <span>@{instagramHandle}</span>
              </>
            )}
          </div>

          {/* Govt. Udyam Registration Pill Badge */}
          {showUdyam && (
            <div className="mt-2 flex justify-center">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-xs sm:text-sm font-bold shadow-sm">
                <span aria-hidden="true">✓</span>
                Govt. Registered • Udyam Reg. No: {udyamNumber}
              </span>
            </div>
          )}

          {/* Copyright */}
          <div className="text-xs text-slate-400 mt-6 pt-4 border-t border-slate-900">
            <p>&copy; {new Date().getFullYear()} {businessName}. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
export default StorefrontBusinessHub;
