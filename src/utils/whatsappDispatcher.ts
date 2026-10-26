import { toast } from "sonner";

export interface SendWhatsAppOptions {
  phone: string;
  message: string;
  pdfBlob?: Blob;
  pdfFileName?: string;
  adminSettings?: any;
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
  pdfFileName = "document.pdf",
  adminSettings,
}: SendWhatsAppOptions): Promise<{ success: boolean; channel: string }> {
  const cleanPhone = formatWhatsAppPhone(phone);
  if (!cleanPhone) {
    toast.error("Valid phone number is required for WhatsApp dispatch");
    return { success: false, channel: "unknown" };
  }

  const channel = adminSettings?.whatsapp_channel || "click_to_chat";

  // Check if Web Share API with files is available (Android / mobile browser / APK)
  if (pdfBlob && typeof navigator !== "undefined" && navigator.canShare) {
    try {
      const file = new File([pdfBlob], pdfFileName, { type: "application/pdf" });
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

  if (channel === "openwa") {
    try {
      const res = await fetch("/api/wa/gateway/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: cleanPhone,
          message,
          session: "sales",
        }),
      });
      if (res.ok) {
        toast.success("Message dispatched via OpenWA Gateway");
        return { success: true, channel: "openwa" };
      }
      toast.warning("OpenWA gateway not responsive, opening Click-to-Chat fallback");
    } catch {
      toast.warning("OpenWA gateway offline, opening Click-to-Chat fallback");
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

