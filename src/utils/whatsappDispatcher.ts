import { toast } from "sonner";

export interface SendWhatsAppOptions {
  phone: string;
  message: string;
  pdfBlob?: Blob;
  pdfBase64?: string;
  invoiceHtml?: string;
  pdfFileName?: string;
  adminSettings?: any;
  waSessionChannel?: "sales" | "repairs";
}

export function formatWhatsAppPhone(phone: string): string {
  const clean = (phone || "").replace(/\D/g, "");
  if (!clean) return "";
  if (clean.length === 10) return "91" + clean;
  if (clean.startsWith("0")) return "91" + clean.substring(1);
  return clean;
}

/**
 * Unified WhatsApp dispatcher respecting admin settings:
 * - 'click_to_chat': standard wa.me direct URL (supports native file share on Android)
 * - 'openwa': backend OpenWA gateway API with click-to-chat fallback
 * - 'chrome_extension': local Chrome extension bridge with click-to-chat fallback
 */
export async function dispatchWhatsApp({
  phone,
  message,
  pdfBlob,
  pdfBase64: initialPdfBase64,
  invoiceHtml,
  pdfFileName = "document.pdf",
  adminSettings,
  waSessionChannel = "sales",
}: SendWhatsAppOptions): Promise<{ success: boolean; channel: string }> {
  const cleanPhone = formatWhatsAppPhone(phone);
  if (!cleanPhone) {
    toast.error("Valid phone number is required for WhatsApp dispatch");
    return { success: false, channel: "unknown" };
  }

  // Fetch latest settings if channel is not defined on adminSettings
  let effectiveChannel = adminSettings?.whatsapp_channel;
  if (!effectiveChannel) {
    try {
      const sRes = await fetch("/api/settings");
      if (sRes.ok) {
        const s = await sRes.json();
        effectiveChannel = s.whatsapp_channel;
      }
    } catch {}
  }
  const channel = effectiveChannel || "click_to_chat";

  // Check if Web Share API with files is available (Android / mobile browser / APK)
  if (channel === "click_to_chat") {
    // If we have invoiceHtml but no pdfBlob, try rendering PDF from backend
    let shareBlob = pdfBlob;
    if (!shareBlob && invoiceHtml) {
      try {
        const rRes = await fetch("/api/invoices/render-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html: invoiceHtml }),
        });
        if (rRes.ok) {
          shareBlob = await rRes.blob();
        }
      } catch {}
    }

    if (shareBlob && typeof navigator !== "undefined" && navigator.canShare) {
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
        if (e.name !== "AbortError") {
          console.warn("Web share failed, falling back to channel", e);
        } else {
          return { success: true, channel: "web_share_aborted" };
        }
      }
    }

    // On Desktop browser in Click-to-chat mode: trigger download of the PDF
    if (shareBlob) {
      try {
        const blobUrl = URL.createObjectURL(shareBlob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = pdfFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        toast.info("Invoice PDF downloaded. Opening WhatsApp chat to send message & attach PDF...");
      } catch {}
    }
  }

  if (channel === "openwa") {
    try {
      let pdfBase64 = initialPdfBase64;
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
          toast.success("Invoice text message and PDF document sent via WhatsApp!");
        } else if (data.type === "pdf") {
          toast.success("Invoice PDF document sent via WhatsApp!");
        } else {
          toast.success("Invoice text sent via WhatsApp!");
        }
        return { success: true, channel: "openwa" };
      }
      toast.warning("OpenWA gateway not responsive, opening Click-to-Chat fallback");
    } catch (err: any) {
      toast.warning("OpenWA gateway unreachable, opening Click-to-Chat fallback");
    }
  } else if (channel === "chrome_extension") {
    try {
      window.postMessage({ type: "PHONEZONE_WHATSAPP_DISPATCH", phone: cleanPhone, message }, "*");
    } catch {}
  }

  // Default: Click to Chat wa.me
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  window.open(waUrl, "_blank");
  toast.success("Opening WhatsApp chat...");
  return { success: true, channel: "click_to_chat" };
}

