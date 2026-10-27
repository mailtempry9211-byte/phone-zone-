import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Layers,
  FileText,
  Receipt,
  Printer,
  Eye,
  Send,
  MessageSquare,
  Sparkles,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { dispatchWhatsApp } from "@/utils/whatsappDispatcher";
import { printHtml } from "@/lib/printHtml";
import {
  buildJobSheetHtml,
  buildRepairInvoiceHtml,
  formatJobSheetWhatsAppText,
  formatRepairInvoiceWhatsAppText,
  formatRepairReadyWhatsAppText,
  formatRepairDeliveredWhatsAppText,
  type RepairDocStyle,
} from "@/lib/repairTemplates";

export type RepairDocType = "jobsheet" | "invoice" | "ready" | "delivered";

interface RepairInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: any;
  defaultDocType?: RepairDocType;
  onSuccess?: () => void;
}

export const RepairInvoiceModal: React.FC<RepairInvoiceModalProps> = ({
  open,
  onOpenChange,
  job,
  defaultDocType = "invoice",
  onSuccess,
}) => {
  const [docType, setDocType] = useState<RepairDocType>(defaultDocType);
  const [style, setStyle] = useState<RepairDocStyle>("heritage");
  const [settings, setSettings] = useState<any>(null);
  const [customText, setCustomText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [deliveryChannel, setDeliveryChannel] = useState<string>("click_to_chat");

  useEffect(() => {
    if (open) {
      setDocType(defaultDocType);
      fetch("/api/settings")
        .then((r) => r.json())
        .then((d) => {
          setSettings(d);
          setDeliveryChannel(d.whatsapp_channel || "click_to_chat");
        })
        .catch(() => {});
    }
  }, [open, defaultDocType]);

  useEffect(() => {
    if (!job) return;
    if (docType === "jobsheet") {
      setCustomText(formatJobSheetWhatsAppText({ job, settings }));
    } else if (docType === "ready") {
      setCustomText(formatRepairReadyWhatsAppText({ job, settings }));
    } else if (docType === "delivered") {
      setCustomText(formatRepairDeliveredWhatsAppText({ job, settings }));
    } else {
      setCustomText(formatRepairInvoiceWhatsAppText({ job, settings }));
    }
  }, [job, docType, settings]);

  if (!job) return null;

  const phone = (job.customer_phone || "").replace(/\D/g, "");

  const generateCurrentHtml = () => {
    if (docType === "jobsheet") {
      return buildJobSheetHtml({ job, settings, style });
    }
    return buildRepairInvoiceHtml({ job, settings, style });
  };

  const handlePreview = () => {
    const html = generateCurrentHtml();
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
    } else {
      printHtml(html);
    }
  };

  const handlePrint = () => {
    const html = generateCurrentHtml();
    printHtml(html);
  };

  const handleDispatch = async (mode: "both" | "text_only" | "pdf_only") => {
    if (!phone) {
      toast.error("Customer mobile number not found");
      return;
    }
    setIsSending(true);
    try {
      const html = generateCurrentHtml();
      const pdfFileName =
        docType === "jobsheet"
          ? `Job_Sheet_${job.job_no}.pdf`
          : `Repair_Invoice_${job.job_no}.pdf`;

      await dispatchWhatsApp({
        phone,
        message: customText,
        invoiceHtml: html,
        pdfFileName,
        adminSettings: settings,
        waSessionChannel: "repairs",
        mode,
      });

      const label =
        mode === "text_only"
          ? "Text message"
          : mode === "pdf_only"
          ? "PDF document"
          : "PDF + Text";
      toast.success(`${label} dispatched successfully via WhatsApp!`);
      if (onSuccess) onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to dispatch WhatsApp");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-indigo-600" />
              <DialogTitle className="text-lg font-bold text-gray-900">
                Repair Document & Invoice Center
              </DialogTitle>
            </div>
            <Badge variant="outline" className="text-xs bg-slate-50 font-mono">
              Job: {job.job_no}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-gray-500">
            Choose document format, design style, and preview or dispatch directly to customer WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1 text-sm">
          {/* Customer / Device Summary Card */}
          <div className="flex flex-wrap items-center justify-between p-3 rounded-lg bg-slate-50 border gap-2">
            <div>
              <div className="font-semibold text-gray-900">
                {job.customer_name || "Customer"}
              </div>
              <div className="text-xs text-gray-500">
                📱 +91 {phone || "-"} | {job.device_brand} {job.device_model}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold text-gray-700">
                Status: <span className="uppercase text-blue-600">{job.status}</span>
              </div>
              <div className="text-[11px] text-gray-500">
                Amount: ₹{job.final_price || job.estimate || 0}
              </div>
            </div>
          </div>

          {/* 1) Select Document Type */}
          <div>
            <Label className="text-xs font-semibold text-gray-800 block mb-1.5">
              1. Select Document Type
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setDocType("jobsheet")}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  docType === "jobsheet"
                    ? "border-blue-600 bg-blue-50/70 shadow-sm"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-gray-900">
                  <FileText className="h-3.5 w-3.5 text-blue-600" />
                  Job Sheet
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">Workshop + QR</div>
              </button>

              <button
                type="button"
                onClick={() => setDocType("invoice")}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  docType === "invoice"
                    ? "border-emerald-600 bg-emerald-50/70 shadow-sm"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-gray-900">
                  <Receipt className="h-3.5 w-3.5 text-emerald-600" />
                  Repair Invoice
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">Itemized Tax Bill</div>
              </button>

              <button
                type="button"
                onClick={() => setDocType("ready")}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  docType === "ready"
                    ? "border-amber-600 bg-amber-50/70 shadow-sm"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-gray-900">
                  <CheckCircle2 className="h-3.5 w-3.5 text-amber-600" />
                  Ready Pickup
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">Device Ready Alert</div>
              </button>

              <button
                type="button"
                onClick={() => setDocType("delivered")}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  docType === "delivered"
                    ? "border-purple-600 bg-purple-50/70 shadow-sm"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-gray-900">
                  <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                  Delivered Feedback
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">5-Star Review Ask</div>
              </button>
            </div>
          </div>

          {/* 2) Layout Design Styles (for Job Sheet & Invoice) */}
          {(docType === "jobsheet" || docType === "invoice") && (
            <div>
              <Label className="text-xs font-semibold text-gray-800 block mb-1.5">
                2. Choose Print / PDF Design Style
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  {
                    id: "heritage",
                    name: "Executive Heritage",
                    desc: "Classic Letterhead with Gold",
                    iconColor: "text-amber-600",
                  },
                  {
                    id: "luxury",
                    name: "Dark Luxury",
                    desc: "Deep Dark Slate & Gold",
                    iconColor: "text-amber-400",
                  },
                  {
                    id: "ledger",
                    name: "Tally Ledger",
                    desc: "Ruled Accounting Grid",
                    iconColor: "text-blue-600",
                  },
                  {
                    id: "receipt",
                    name: "Thermal Slip",
                    desc: "Compact Walk-in Receipt",
                    iconColor: "text-gray-600",
                  },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setStyle(st.id as RepairDocStyle)}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      style === st.id
                        ? "border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <div className="font-semibold text-xs text-gray-900">{st.name}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{st.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3) WhatsApp Text Preview */}
          <div>
            <Label className="text-xs font-semibold text-gray-800 flex items-center justify-between mb-1">
              <span>WhatsApp Message Text (Sent with or without PDF)</span>
              <span className="text-[11px] text-gray-500 font-normal">
                via {deliveryChannel === "openwa" ? "OpenWA Gateway (Auto)" : "wa.me Click-to-Chat"}
              </span>
            </Label>
            <Textarea
              rows={6}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              className="font-mono text-xs bg-slate-50"
              placeholder="WhatsApp message..."
            />
          </div>
        </div>

        {/* Action Buttons: Preview, Print, WhatsApp PDF, WhatsApp Text */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            Close
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            {(docType === "jobsheet" || docType === "invoice") && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePreview}
                  disabled={isSending}
                  className="border-blue-300 text-blue-700 hover:bg-blue-50"
                >
                  <Eye className="h-4 w-4 mr-1.5" />
                  Preview
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={handlePrint}
                  disabled={isSending}
                  className="bg-gray-900 text-white hover:bg-black"
                >
                  <Printer className="h-4 w-4 mr-1.5" />
                  Print / Save PDF
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleDispatch("pdf_only")}
                  disabled={isSending}
                  className="bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs h-8"
                  title="WhatsApp par sirf PDF document bhejein"
                >
                  <FileText className="h-3.5 w-3.5 mr-1" />
                  Send PDF Only
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleDispatch("both")}
                  disabled={isSending}
                  className="bg-green-700 hover:bg-green-800 text-white font-bold text-xs h-8 shadow-sm"
                  title="WhatsApp par PDF aur text summary dono bhejein"
                >
                  {isSending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5 mr-1" />
                  )}
                  Send Both (PDF + Text)
                </Button>
              </>
            )}

            <Button
              type="button"
              size="sm"
              onClick={() => handleDispatch("text_only")}
              disabled={isSending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-8"
              title="WhatsApp par sirf Text message bhejein"
            >
              <MessageSquare className="h-3.5 w-3.5 mr-1" />
              Send Text Only
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RepairInvoiceModal;

