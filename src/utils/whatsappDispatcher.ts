import { toast } from "sonner";

export interface SendWhatsAppOptions {
  phone: string;
  message?: string;
  pdfBlob?: Blob;
  pdfBase64?: string;
  invoiceHtml?: string;
  pdfFileName?: string;
  adminSettings?: any;
  waSessionChannel?: "sales" | "repairs";
  mode?: "both" | "text_only" | "pdf_only";
}

const isMobileDevice =
  typeof navigator !== "undefined" &&
  (/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent.toLowerCase()) ||
    (Boolean(navigator.maxTouchPoints) && navigator.maxTouchPoints > 2 && /macintosh/i.test(navigator.userAgent.toLowerCase())));

export function formatWhatsAppPhone(phone: string): string {
  const clean = (phone || "").replace(/\D/g, "");
  if (!clean) return "";
  if (clean.length === 10) return "91" + clean;
  if (clean.startsWith("0")) return "91" + clean.substring(1);
  return clean;
}

/**
 * Unified WhatsApp dispatcher respecting admin settings:
 * - 'openwa': backend OpenWA gateway API (no dialog, direct delivery of text + PDF)
 * - 'click_to_chat': standard wa.me direct URL
 * - 'chrome_extension': local Chrome extension bridge
 */
export async function dispatchWhatsApp({
  phone,
  message: rawMessage = "",
  pdfBlob: initialPdfBlob,
  pdfBase64: initialPdfBase64,
  invoiceHtml: initialInvoiceHtml,
  pdfFileName = "document.pdf",
  adminSettings,
  waSessionChannel = "sales",
  mode = "both",
}: SendWhatsAppOptions): Promise<{ success: boolean; channel: string }> {
  const cleanPhone = formatWhatsAppPhone(phone);
  if (!cleanPhone) {
    toast.error("Valid phone number is required for WhatsApp dispatch");
    return { success: false, channel: "unknown" };
  }

  // Filter payload based on dispatch mode (both, text_only, pdf_only)
  let message = mode === "pdf_only" ? "" : rawMessage;
  let invoiceHtml = mode === "text_only" ? undefined : initialInvoiceHtml;
  let pdfBlob = mode === "text_only" ? undefined : initialPdfBlob;
  let pdfBase64 = mode === "text_only" ? undefined : initialPdfBase64;

  // Fetch latest settings if channel is not defined on adminSettings
  let effectiveChannel = adminSettings?.whatsapp_channel;
  if (!effectiveChannel) {
    try {
      const sRes = await fetch("/api/settings", { credentials: "include" });
      if (sRes.ok) {
        const s = await sRes.json();
        effectiveChannel = s.whatsapp_channel;
      }
    } catch {}
  }
  const channel = effectiveChannel || "openwa";

  // 1. Primary: Direct OpenWA Gateway API (sends text and real PDF without opening OS popups)
  if (channel === "openwa") {
    try {
      if (!pdfBase64 && pdfBlob) {
        pdfBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(pdfBlob);
        });
      }

      const res = await fetch("/api/wa/gateway/send-invoice-pdf", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: cleanPhone,
          message,
          pdfBase64,
          invoiceHtml,
          filename: pdfFileName,
          channel: waSessionChannel || "sales",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        if (data.type === "text_and_pdf") {
          toast.success("Invoice text message and PDF document sent via WhatsApp Gateway!");
        } else if (data.type === "pdf") {
          toast.success("Invoice PDF document sent via WhatsApp Gateway!");
        } else {
          toast.success("Invoice message sent via WhatsApp Gateway!");
        }
        return { success: true, channel: "openwa" };
      }
      
      const errReason = data.error || "OpenWA Gateway did not confirm delivery.";
      toast.warning(`${errReason} Opening Click-to-Chat fallback.`);
    } catch (err: any) {
      toast.warning("OpenWA Gateway unreachable. Opening Click-to-Chat fallback.");
    }
  }

  // 2. Click-to-Chat Fallback (Only mobile uses Web Share API; Windows/PC NEVER triggers OS Share dialog)
  let shareBlob = pdfBlob;
  if (!shareBlob && invoiceHtml && mode !== "text_only") {
    try {
      const rRes = await fetch("/api/invoices/render-pdf", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: invoiceHtml }),
      });
      if (rRes.ok) {
        shareBlob = await rRes.blob();
      }
    } catch {}
  }

  // Web Share API with files is strictly for Mobile (Android / APK / iOS), NEVER desktop Windows
  if (isMobileDevice && shareBlob && typeof navigator !== "undefined" && navigator.canShare) {
    try {
      const file = new File([shareBlob], pdfFileName, { type: "application/pdf" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: pdfFileName,
          text: message,
        });
        toast.success("Shared via device WhatsApp");
        return { success: true, channel: "web_share" };
      }
    } catch (e: any) {
      if (e.name === "AbortError") {
        return { success: true, channel: "web_share_aborted" };
      }
    }
  }

  // On Windows / PC desktop: download PDF directly (no Windows share dialog popup)
  if (shareBlob && !isMobileDevice) {
    try {
      const blobUrl = URL.createObjectURL(shareBlob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = pdfFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      toast.info("Invoice PDF downloaded.");
    } catch {}
  }

  // Open WhatsApp chat URL
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  window.open(waUrl, "_blank");
  toast.success("Opening WhatsApp chat...");
  return { success: true, channel: "click_to_chat" };
}

