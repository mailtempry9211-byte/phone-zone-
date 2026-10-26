import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Share2, Globe, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { dispatchWhatsApp } from "@/utils/whatsappDispatcher";
import {
  buildSapathPatraHtml,
  type SapathPatraData,
  type SapathLanguage,
} from "@/lib/sapathPatraTemplates";

export interface SapathPatraModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data?: SapathPatraData | null;
  phone?: any;
}

export const SapathPatraModal: React.FC<SapathPatraModalProps> = ({
  open,
  onOpenChange,
  data,
  phone,
}) => {
  const [language, setLanguage] = useState<SapathLanguage>("both");

  const { data: adminSettings } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('admin_settings').select('*').single();
      return data;
    },
  });

  const effectiveData: SapathPatraData | null = data || (phone ? {
    shopName: adminSettings?.business_name || "PhoneZone",
    shopAddress: adminSettings?.address || "",
    shopPhone: adminSettings?.phone_primary || "",
    shopLogoUrl: adminSettings?.logo_url || "",
    shopSignatureUrl: adminSettings?.signature_url || "",
    refNo: `PUR-${phone.imei_number || "NONE"}`,
    date: phone.purchase_date ? new Date(phone.purchase_date).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN"),
    amount: phone.purchase_price || 0,
    sellerName: phone.sellers?.name || phone.seller_name || "N/A",
    sellerPhone: phone.sellers?.phone || phone.seller_phone || "",
    sellerAddress: phone.sellers?.address || phone.seller_address || "",
    idProofType: phone.sellers?.id_proof_type || phone.id_proof_type || "Aadhaar",
    idNumber: phone.sellers?.id_number || phone.id_number || "N/A",
    sellerPhotoUrl: phone.seller_photo_url || null,
    sellerSignatureUrl: phone.seller_signature_url || null,
    brand: phone.phone_name || "",
    model: phone.model || "",
    variant: phone.variant || "",
    colour: phone.colour || "",
    imei1: phone.imei_number || "",
    imei2: phone.imei2_number || "",
    condition: phone.condition || "good",
    language: (phone.sapath_patra_language as any) || "both",
  } : null);

  if (!effectiveData) return null;

  const currentData: SapathPatraData = {
    ...effectiveData,
    language,
  };

  const htmlContent = buildSapathPatraHtml(currentData);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow popups to print Sapath Patra");
      return;
    }
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  const handleWhatsApp = () => {
    const cleanPhone = (effectiveData.sellerPhone || "").replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      toast.error("Valid seller phone number is required for WhatsApp");
      return;
    }

    const message = `🙏 *${effectiveData.shopName || "PhoneZone"} - खरीद शपथ पत्र (Declaration & Undertaking)*

📋 *संदर्भ सं:* ${effectiveData.refNo}
📅 *दिनांक:* ${effectiveData.date}

📱 *डिवाइस विवरण:*
• मॉडल: ${effectiveData.brand} ${effectiveData.model} ${effectiveData.variant || ""}
• IMEI: ${effectiveData.imei1}
• क्रय राशि: ₹${Number(effectiveData.amount).toLocaleString("en-IN")}/-

👤 *विक्रेता:*
• नाम: ${effectiveData.sellerName}
• मोबाइल: ${effectiveData.sellerPhone}

✅ आपके द्वारा दिया गया कानूनी शपथ पत्र एवं खरीद रसीद सुरक्षित दर्ज कर ली गई है। धन्यवाद!`;

    dispatchWhatsApp({
      phone: cleanPhone,
      message,
      adminSettings,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-4 sm:p-6">
        <DialogHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b gap-3">
          <div>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              विक्रेता शपथ पत्र (Declaration & Undertaking)
            </DialogTitle>
            <p className="text-xs text-gray-500 mt-0.5">
              Ref: {data.refNo} • {data.sellerName} • {data.brand} {data.model}
            </p>
          </div>

          {/* Language Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border">
            <span className="text-xs font-semibold px-1.5 text-gray-500 flex items-center gap-1">
              <Globe className="h-3.5 w-3.5" /> भाषा:
            </span>
            <Button
              type="button"
              size="sm"
              variant={language === "hindi" ? "default" : "ghost"}
              className={`h-7 px-2.5 text-xs ${language === "hindi" ? "bg-blue-600 text-white" : ""}`}
              onClick={() => setLanguage("hindi")}
            >
              हिन्दी
            </Button>
            <Button
              type="button"
              size="sm"
              variant={language === "english" ? "default" : "ghost"}
              className={`h-7 px-2.5 text-xs ${language === "english" ? "bg-blue-600 text-white" : ""}`}
              onClick={() => setLanguage("english")}
            >
              English
            </Button>
            <Button
              type="button"
              size="sm"
              variant={language === "both" ? "default" : "ghost"}
              className={`h-7 px-2.5 text-xs ${language === "both" ? "bg-blue-600 text-white" : ""}`}
              onClick={() => setLanguage("both")}
            >
              दोनों (Both)
            </Button>
          </div>
        </DialogHeader>

        {/* Live Preview Frame */}
        <div className="flex-1 overflow-y-auto my-3 border rounded-lg bg-gray-100 p-2 sm:p-4 shadow-inner">
          <div
            className="bg-white shadow-lg mx-auto rounded overflow-hidden max-w-[780px]"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t">
          <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium">
            <CheckCircle2 className="h-4 w-4" />
            कानूनी सुरक्षा: धारा 411/412 भा.दं.सं. एवं बी.एन.एस. सुरक्षा अनुरूप
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleWhatsApp}
              className="border-green-500 text-green-700 hover:bg-green-50"
            >
              <Share2 className="h-4 w-4 mr-1.5 text-green-600" />
              Send to Seller (WhatsApp)
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Printer className="h-4 w-4 mr-1.5" />
              Print / Save PDF (प्रिंट करें)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SapathPatraModal;
