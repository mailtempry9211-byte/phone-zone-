import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, Send, Printer, X, ShieldCheck, Smartphone, User, Loader2, Sparkles, MessageCircle } from "lucide-react";
import { dispatchWhatsApp } from "@/utils/whatsappDispatcher";
import { printHtml } from "@/lib/printHtml";
import {
  formatPurchaseInvoiceText,
  formatSalesInvoiceText,
  formatSapathPatraText,
  type SapathTextLanguage,
} from "@/lib/whatsappInvoiceFormatter";

export interface PostTransactionParty {
  name: string;
  phone: string;
  address?: string;
  idProofType?: string;
  idNumber?: string;
  role: "seller" | "customer";
}

export interface PostTransactionPhone {
  phone_name: string;
  model: string;
  imei_number: string;
  amount: number;
  condition?: string;
  variant?: string;
  colour?: string;
}

interface PostTransactionShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "purchase" | "sale";
  phone: PostTransactionPhone | null;
  party: PostTransactionParty | null;
  invoiceHtml?: string;
  adminSettings?: any;
}

export const PostTransactionShareDialog = ({
  open,
  onOpenChange,
  type,
  phone,
  party,
  invoiceHtml,
  adminSettings,
}: PostTransactionShareDialogProps) => {
  const [isSending, setIsSending] = useState(false);
  const [gatewayStatus, setGatewayStatus] = useState<{ connected: boolean; status: string; phone?: string } | null>(null);
  const [includeSapathPatra, setIncludeSapathPatra] = useState<boolean>(true);
  const [sapathLanguage, setSapathLanguage] = useState<SapathTextLanguage>("both");

  const channel = adminSettings?.whatsapp_channel || "openwa";

  useEffect(() => {
    if (open && channel === "openwa") {
      fetch("/api/wa/gateway/session-status/sales")
        .then((r) => r.json())
        .then((data) => {
          if (data && (data.connected || data.status === "ready" || data.status === "authenticated")) {
            setGatewayStatus({
              connected: true,
              status: "ready",
              phone: data.phone || "Linked",
            });
          } else {
            setGatewayStatus({
              connected: false,
              status: data?.status || "offline",
            });
          }
        })
        .catch(() => {
          setGatewayStatus({ connected: false, status: "error" });
        });
    }
  }, [open, channel]);

  if (!phone || !party) return null;

  const isPurchase = type === "purchase";
  const partyLabel = isPurchase ? "Seller / विक्रेता" : "Customer / ग्राहक";
  const docTitle = isPurchase ? "Purchase Invoice & Sapath Patra" : "Sales Invoice";

  const buildSummaryMessage = () => {
    if (isPurchase) {
      const phoneObj = {
        ...phone,
        purchase_price: phone.amount,
        sellers: {
          name: party.name,
          phone: party.phone,
          address: party.address,
          id_proof_type: party.idProofType,
          id_number: party.idNumber,
        },
      };

      return formatPurchaseInvoiceText(phoneObj, adminSettings, {
        includeSapathPatra,
        sapathLanguage,
      });
    }

    const phoneObj = {
      ...phone,
      selling_price: phone.amount,
      customers: {
        name: party.name,
        phone: party.phone,
        address: party.address,
        id_proof_type: party.idProofType,
        id_number: party.idNumber,
      },
    };

    return formatSalesInvoiceText(phoneObj, adminSettings);
  };

  const handleSendWhatsApp = async () => {
    if (!party.phone) {
      toast.error(`No phone number available for ${partyLabel.toLowerCase()}`);
      return;
    }

    setIsSending(true);
    try {
      const message = buildSummaryMessage();
      const filename = isPurchase
        ? `Purchase_Invoice_${phone.imei_number}.pdf`
        : `Sales_Invoice_${phone.imei_number}.pdf`;

      const res = await dispatchWhatsApp({
        phone: party.phone,
        message,
        invoiceHtml,
        pdfFileName: filename,
        adminSettings,
      });

      if (res.success) {
        onOpenChange(false);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to dispatch via WhatsApp");
    } finally {
      setIsSending(false);
    }
  };

  const handlePrint = () => {
    if (invoiceHtml) {
      printHtml(invoiceHtml);
    } else {
      toast.info("Invoice preview available in table actions");
    }
  };

  const isOpenWaReady = channel === "openwa" && gatewayStatus?.connected;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 bg-white shadow-2xl border-gray-100 rounded-xl">
        <DialogHeader className="text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-gray-900">
                {isPurchase ? "Purchase Completed! / खरीदारी दर्ज हुई" : "Sale Completed! / बिक्री दर्ज हुई"}
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500 mt-0.5">
                {isPurchase
                  ? "विक्रेता को इनवॉइस एवं शपथ पत्र तुरंत व्हाट्सएप पर भेजें"
                  : "ग्राहक को इनवॉइस एवं बिल तुरंत व्हाट्सएप पर भेजें"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Transaction Summary Card */}
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50/80 p-3.5 space-y-2 text-xs">
          <div className="flex justify-between items-center pb-2 border-b border-gray-200">
            <span className="font-semibold text-gray-700 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-blue-600" />
              {partyLabel}:
            </span>
            <span className="font-bold text-gray-900 text-right">
              {party.name} <span className="text-gray-500 font-normal">({party.phone})</span>
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-600 flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5 text-purple-600" />
              Phone:
            </span>
            <span className="font-medium text-gray-900">
              {phone.phone_name} {phone.model}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-600">IMEI:</span>
            <span className="font-mono text-gray-800">{phone.imei_number}</span>
          </div>

          <div className="flex justify-between items-center pt-1 border-t border-gray-200">
            <span className="font-semibold text-gray-700">Amount:</span>
            <span className="font-bold text-emerald-700 text-sm">
              ₹{phone.amount.toLocaleString("en-IN")}
            </span>
          </div>

          {isPurchase && (
            <div className="mt-2 pt-2 border-t border-gray-200 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-blue-900">
                <input
                  type="checkbox"
                  checked={includeSapathPatra}
                  onChange={(e) => setIncludeSapathPatra(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0" />
                <span>Include Sapath Patra in WhatsApp Text &amp; PDF</span>
              </label>

              {includeSapathPatra && (
                <div className="flex items-center gap-1.5 pl-5 text-[11px]">
                  <span className="text-gray-600">Language:</span>
                  <div className="inline-flex rounded-md shadow-xs">
                    <button
                      type="button"
                      onClick={() => setSapathLanguage("both")}
                      className={`px-2 py-0.5 text-[11px] rounded-l border ${
                        sapathLanguage === "both"
                          ? "bg-blue-600 text-white border-blue-600 font-bold"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      दोनों (Both)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSapathLanguage("hindi")}
                      className={`px-2 py-0.5 text-[11px] border-t border-b ${
                        sapathLanguage === "hindi"
                          ? "bg-blue-600 text-white border-blue-600 font-bold"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      हिंदी (Hindi)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSapathLanguage("english")}
                      className={`px-2 py-0.5 text-[11px] rounded-r border ${
                        sapathLanguage === "english"
                          ? "bg-blue-600 text-white border-blue-600 font-bold"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      English
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Gateway Channel Indicator */}
        <div className="mt-3 flex items-center justify-between text-xs bg-slate-50 border rounded-md p-2.5">
          <span className="text-gray-600">WhatsApp Delivery:</span>
          {channel === "openwa" ? (
            isOpenWaReady ? (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 flex items-center gap-1 font-semibold">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                OpenWA Gateway (Ready)
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                OpenWA (Click-to-chat Fallback)
              </Badge>
            )
          ) : (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 flex items-center gap-1 font-medium">
              <MessageCircle className="h-3 w-3" />
              Click-to-Chat (wa.me)
            </Badge>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-5 space-y-2">
          <Button
            type="button"
            onClick={handleSendWhatsApp}
            disabled={isSending}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 shadow-md flex items-center justify-center gap-2"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                व्हाट्सएप पर भेजा जा रहा है...
              </>
            ) : channel === "openwa" && isOpenWaReady ? (
              <>
                <Send className="h-4 w-4" />
                Send PDF &amp; Text directly via WhatsApp (OpenWA)
              </>
            ) : (
              <>
                <MessageCircle className="h-4 w-4" />
                Send via WhatsApp (PDF + Text)
              </>
            )}
          </Button>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrint}
              className="border-gray-300 text-gray-700 hover:bg-gray-100 flex items-center justify-center gap-1.5"
            >
              <Printer className="h-4 w-4" />
              Print / View Bill
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-gray-500 hover:bg-gray-100"
            >
              Skip / बाद में
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PostTransactionShareDialog;
