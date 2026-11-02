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

  return (
    <div className="w-full bg-white text-slate-900 border-t border-slate-200">
      {/* Visit Our Store & Get In Touch Section */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Left Column: Visit Our Store */}
            <div className="space-y-6">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8">
                Visit Our Store
              </h2>

              <div className="space-y-6">
                {/* Address */}
                {address && (
                  <div className="flex items-start space-x-4">
                    <MapPin className="h-6 w-6 text-blue-600 mt-1 shrink-0" />
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Address</h3>
                      <p className="text-gray-600 whitespace-pre-line text-sm leading-relaxed">
                        {address}
                      </p>
                    </div>
                  </div>
                )}

                {/* Phone */}
                {displayPhone && (
                  <div className="flex items-start space-x-4">
                    <Phone className="h-6 w-6 text-blue-600 mt-1 shrink-0" />
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Phone</h3>
                      <p className="text-gray-600 text-sm">
                        {displayPhone}
                      </p>
                    </div>
                  </div>
                )}

                {/* Email */}
                {email && (
                  <div className="flex items-start space-x-4">
                    <Mail className="h-6 w-6 text-blue-600 mt-1 shrink-0" />
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Email</h3>
                      <p className="text-gray-600 text-sm">
                        {email}
                      </p>
                    </div>
                  </div>
                )}

                {/* Instagram */}
                {instagramHandle && (
                  <div className="flex items-start space-x-4">
                    <Instagram className="h-6 w-6 text-blue-600 mt-1 shrink-0" />
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Instagram</h3>
                      <p className="text-gray-600 text-sm">
                        @{instagramHandle}
                      </p>
                    </div>
                  </div>
                )}

                {/* Google Business Profile */}
                {googleBusinessUrl && (
                  <div className="flex items-start space-x-4">
                    <Star className="h-6 w-6 text-blue-600 mt-1 shrink-0" />
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Google Business Profile</h3>
                      <p className="text-gray-600 text-sm mb-2">
                        See reviews and our verified profile on Google
                      </p>
                      <a
                        href={googleBusinessUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        Visit Google Business Profile
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Store Hours */}
              <div className="mt-8 pt-4 border-t border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-3 text-base">Store Hours</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>Monday - Saturday: 10:00 AM - 8:00 PM</p>
                  <p>Sunday: 11:00 AM - 6:00 PM</p>
                </div>
              </div>
            </div>

            {/* Right Column: Get In Touch (ContactForm) */}
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8">
                Get In Touch
              </h2>
              <ContactForm theme="modern" formOnly={true} />
            </div>
          </div>
        </div>
      </section>

      {/* Exact Dark Storefront Footer from Screenshot */}
      <footer className="bg-gray-900 text-white py-12 px-4">
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
              <h3 className="text-xl font-bold text-white tracking-wide">{businessName}</h3>
              <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold">{tagline}</p>
            </div>
          </div>

          {/* Subtitle */}
          <p className="text-gray-400 text-xs sm:text-sm max-w-2xl mx-auto mb-4">
            Your trusted destination for premium smartphones, expert repairs, and authentic customer service.
          </p>

          {/* Meta Strip: Address • Phone • Instagram */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-gray-400 mb-5">
            {address && <span>{address}</span>}
            {address && displayPhone && <span className="hidden sm:inline">•</span>}
            {displayPhone && <span>{displayPhone}</span>}
            {instagramHandle && (
              <>
                {(address || displayPhone) && <span className="hidden sm:inline">•</span>}
                <span>@{instagramHandle}</span>
              </>
            )}
          </div>

          {/* Govt. Udyam Registration Pill Badge */}
          {showUdyam && (
            <div className="mt-2 flex justify-center">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-900/40 border border-green-600/50 text-green-300 text-xs sm:text-sm font-medium">
                <span aria-hidden="true">✓</span>
                Govt. Registered • Udyam Reg. No: {udyamNumber}
              </span>
            </div>
          )}

          {/* Copyright */}
          <div className="mt-8 pt-6 border-t border-gray-800 text-xs text-gray-500">
            <p>&copy; {new Date().getFullYear()} {businessName}. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
