import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Send,
  MessageSquare,
  FileText,
  Printer,
  CheckCircle2,
  Sparkles,
  Loader2,
  Wrench,
  ShieldCheck,
  Smartphone,
  Star,
} from "lucide-react";
import { dispatchWhatsApp } from "@/utils/whatsappDispatcher";
import {
  buildJobSheetHtml,
  buildRepairInvoiceHtml,
  formatJobSheetWhatsAppText,
  formatRepairReadyWhatsAppText,
  formatRepairDeliveredWhatsAppText,
  formatRepairInvoiceWhatsAppText,
} from "@/lib/repairTemplates";

export type RepairShareMode = "jobsheet" | "ready" | "delivered" | "invoice" | "custom";

interface RepairShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: any;
  mode: RepairShareMode;
  onSuccess?: () => void;
}

export const RepairShareModal: React.FC<RepairShareModalProps> = ({
  open,
  onOpenChange,
  job,
  mode,
  onSuccess,
}) => {
  const [message, setMessage] = useState("");
  const [settings, setSettings] = useState<any>(null);
  const [isSending, setIsSending] = useState(false);
  const [deliveryChannel, setDeliveryChannel] = useState<string>("click_to_chat");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setSettings(d);
        setDeliveryChannel(d.whatsapp_channel || "click_to_chat");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!job) return;

    if (mode === "jobsheet") {
      setMessage(formatJobSheetWhatsAppText({ job, settings }));
    } else if (mode === "ready") {
      setMessage(formatRepairReadyWhatsAppText({ job, settings }));
    } else if (mode === "delivered") {
      setMessage(formatRepairDeliveredWhatsAppText({ job, settings }));
    } else if (mode === "invoice") {
      setMessage(formatRepairInvoiceWhatsAppText({ job, settings }));
    } else {
      const device = `${job.device_brand || ""} ${job.device_model || ""}`.trim();
      setMessage(
        `Hello ${job.customer_name || "Customer"}, your device (${device}, Job: ${job.job_no}) repair status is: ${job.status?.toUpperCase()}. Thank you! - PHONEZONE`
      );
    }
  }, [job, mode, settings]);

  if (!job) return null;

  const phone = (job.customer_phone || "").replace(/\D/g, "");

  const getTitleAndIcon = () => {
    switch (mode) {
      case "jobsheet":
        return {
          title: "Send Job Sheet to Customer",
          desc: "Device received! Send formal Job Sheet PDF & receipt to customer WhatsApp.",
          icon: <FileText className="h-5 w-5 text-blue-600" />,
          badge: "New Job Sheet",
        };
      case "ready":
        return {
          title: "Device Ready - Send WhatsApp Alert",
          desc: "Repair finished! Notify customer that their device is ready for pickup.",
          icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
          badge: "Ready for Pickup",
        };
      case "delivered":
        return {
          title: "Device Delivered - Send Feedback & Warranty",
          desc: "Handover complete! Send service warranty certificate and feedback request.",
          icon: <Star className="h-5 w-5 text-amber-500" />,
          badge: "Delivered & Warranty",
        };
      case "invoice":
        return {
          title: "Send Repair Tax Invoice",
          desc: "Send detailed repair invoice PDF and tax summary to customer.",
          icon: <Printer className="h-5 w-5 text-indigo-600" />,
          badge: "Tax Invoice PDF",
        };
      default:
        return {
          title: "Send WhatsApp Status Update",
          desc: "Dispatch custom repair status notification to customer.",
          icon: <MessageSquare className="h-5 w-5 text-emerald-600" />,
          badge: "Status Update",
        };
    }
  };

  const { title, desc, icon, badge } = getTitleAndIcon();

  const handleSend = async () => {
    if (!phone) {
      toast.error("Customer mobile number is missing!");
      return;
    }
    setIsSending(true);

    try {
      let invoiceHtml: string | undefined = undefined;
      let pdfFileName: string = `Repair_${job.job_no}.pdf`;

      if (mode === "jobsheet") {
        invoiceHtml = buildJobSheetHtml({ job, settings });
        pdfFileName = `JobSheet_${job.job_no}.pdf`;
      } else if (mode === "invoice") {
        invoiceHtml = buildRepairInvoiceHtml({ job, settings });
        pdfFileName = `Repair_Invoice_${job.job_no}.pdf`;
      }

      await dispatchWhatsApp({
        phone,
        message,
        invoiceHtml,
        pdfFileName,
        adminSettings: settings,
        waSessionChannel: "repairs",
      });

      if (onSuccess) onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to dispatch message");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {icon}
            <DialogTitle className="text-base font-bold text-slate-900">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-gray-500">{desc}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          {/* Recipient Details & Channel info */}
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border">
            <div>
              <div className="font-semibold text-slate-900">
                {job.customer_name || "Customer"}
              </div>
              <div className="text-gray-500 font-mono text-[11px]">
                📱 +91 {phone} | Job: {job.job_no}
              </div>
            </div>
            <div className="text-right">
              <Badge variant="outline" className="text-[10px] bg-white border-blue-200 text-blue-700">
                {badge}
              </Badge>
              <div className="text-[10px] text-gray-400 mt-0.5">
                via {deliveryChannel === "openwa" ? "OpenWA Gateway" : "wa.me Click-to-Chat"}
              </div>
            </div>
          </div>

          {/* Editable WhatsApp Text Preview */}
          <div>
            <label className="font-semibold text-gray-700 block mb-1">
              WhatsApp Message Preview (Editable)
            </label>
            <Textarea
              rows={8}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="text-xs font-mono bg-white"
              placeholder="Message to customer..."
            />
          </div>

          {(mode === "jobsheet" || mode === "invoice") && (
            <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span>
                {deliveryChannel === "openwa"
                  ? "OpenWA ke through formal PDF document + formatted text message dono ek sath direct bhejega."
                  : "Click-to-chat me WhatsApp chat open karega aur Desktop par PDF download karega."}
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            Skip / Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleSend}
            disabled={isSending}
          >
            {isSending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Sending...
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5 mr-1.5" /> Send to Customer WhatsApp
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RepairShareModal;

