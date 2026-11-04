import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";

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
    (Boolean(navigator.maxTouchPoints) && navigator.maxTouchPoints > 2 && /macintosh/i.test(navigator.userAgent.toLowerCase())) ||
    Capacitor.isNativePlatform());

export function formatWhatsAppPhone(phone: string): string {
  const clean = (phone || "").replace(/\D/g, "");
  if (!clean) return "";
  if (clean.length === 10) return "91" + clean;
  if (clean.startsWith("0")) return "91" + clean.substring(1);
  return clean;
}

/**
 * Client-side HTML to PDF converter (100% standalone, works offline on Android without backend!)
 */
export async function htmlToPdfBlob(html: string): Promise<Blob> {
  const { default: jsPDF } = await import("jspdf");
  const { default: html2canvas } = await import("html2canvas");

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "794px"; // Standard A4 width at 96 DPI
  container.style.backgroundColor = "#ffffff";
  container.style.color = "#000000";
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    await new Promise((r) => setTimeout(r, 200));

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    return pdf.output("blob");
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

/**
 * Unified WhatsApp dispatcher respecting admin settings:
 * - 'click_to_chat': Mobile native file sharing (direct PDF attached without saving) or wa.me URL
 * - 'evolution_api': Evolution API / WPPConnect cloud/local instance (24/7 background delivery)
 * - 'openwa': backend OpenWA gateway API (PC desktop setup)
 */
export async function dispatchWhatsApp({
  phone,
  message: rawMessage = "",
  pdfBlob: initialPdfBlob,
  pdfBase64: initialPdfBase64,
  invoiceHtml: initialInvoiceHtml,
  pdfFileName = "Invoice.pdf",
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

  // 1. Direct Gateway API (Evolution API / WPPConnect OR local OpenWA Gateway)
  if (channel === "openwa" || channel === "evolution_api") {
    try {
      if (!pdfBase64 && pdfBlob) {
        pdfBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(pdfBlob);
        });
      }

      // First attempt backend gateway
      let backendSuccess = false;
      try {
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
            channel: channel === "evolution_api" ? "evolution_api" : (waSessionChannel || "sales"),
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          backendSuccess = true;
          const gatewayLabel = channel === "evolution_api" ? "Evolution API" : "OpenWA Gateway";
          if (data.type === "text_and_pdf") {
            toast.success(`Invoice text message and PDF document sent via ${gatewayLabel}!`);
          } else if (data.type === "pdf") {
            toast.success(`Invoice PDF document sent via ${gatewayLabel}!`);
          } else {
            toast.success(`Invoice message sent via ${gatewayLabel}!`);
          }
          return { success: true, channel };
        }
      } catch (_e) {
        // Backend not reachable (e.g. mobile standalone APK)
      }

      // If backend was not reached and this is Evolution API, send directly from mobile app!
      if (!backendSuccess && channel === "evolution_api") {
        const evoUrl = (adminSettings?.evolution_api_url || "").replace(/\/+$/, "");
        const evoKey = adminSettings?.evolution_api_key || "";
        const evoInstance = adminSettings?.evolution_instance_name || "phonezone";

        if (evoUrl && evoKey) {
          if (message) {
            await fetch(`${evoUrl}/message/sendText/${encodeURIComponent(evoInstance)}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "apikey": evoKey },
              body: JSON.stringify({ number: cleanPhone, text: message }),
            });
          }
          if (pdfBase64) {
            const cleanB64 = String(pdfBase64).replace(/^data:application\/pdf;base64,/, "");
            await fetch(`${evoUrl}/message/sendMedia/${encodeURIComponent(evoInstance)}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "apikey": evoKey },
              body: JSON.stringify({
                number: cleanPhone,
                media: cleanB64,
                mediatype: "document",
                mimetype: "application/pdf",
                fileName: pdfFileName,
                caption: "",
              }),
            });
          }
          toast.success("Dispatched automatically via Evolution API!");
          return { success: true, channel: "evolution_api" };
        }
      }

      const label = channel === "evolution_api" ? "Evolution API Gateway" : "OpenWA Gateway";
      toast.warning(`${label} did not confirm delivery. Opening Click-to-Chat.`);
    } catch (err: any) {
      toast.warning("Gateway unreachable. Opening Click-to-Chat fallback.");
    }
  }

  // 2. Click-to-Chat with Direct Native PDF Attachment
  let shareBlob = pdfBlob;

  // Convert base64 to Blob if Blob was not provided directly
  if (!shareBlob && pdfBase64) {
    try {
      const cleanB64 = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
      const byteChars = atob(cleanB64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      shareBlob = new Blob([byteArray], { type: "application/pdf" });
    } catch {}
  }

  // If we only have invoice HTML and need PDF:
  if (!shareBlob && invoiceHtml && mode !== "text_only") {
    // 1st: try backend Puppeteer
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

    // 2nd: if backend was unavailable (e.g. standalone mobile), render locally!
    if (!shareBlob) {
      try {
        toast.info("Generating Invoice PDF locally...");
        shareBlob = await htmlToPdfBlob(invoiceHtml);
      } catch (err) {
        console.warn("Client-side PDF render failed:", err);
      }
    }
  }

  // 3. Android Native Capacitor Sharing (Directly attaches PDF in WhatsApp sheet)
  if (Capacitor.isNativePlatform() && shareBlob) {
    try {
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const res = reader.result as string;
          resolve(res.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(shareBlob);
      });

      const writeResult = await Filesystem.writeFile({
        path: pdfFileName,
        data: base64Data,
        directory: Directory.Cache,
      });

      await Share.share({
        title: pdfFileName,
        text: message,
        url: writeResult.uri,
        files: [writeResult.uri],
        dialogTitle: "Send Invoice PDF via WhatsApp",
      });

      toast.success("Opening WhatsApp with Invoice PDF attached!");
      return { success: true, channel: "capacitor_native_share" };
    } catch (e: any) {
      if (e.message?.includes("canceled") || e.message?.includes("cancelled")) {
        return { success: true, channel: "share_cancelled" };
      }
      console.warn("Capacitor Share failed, attempting Web Share fallback:", e);
    }
  }

  // 4. Mobile Browser Web Share API fallback
  if (isMobileDevice && shareBlob && typeof navigator !== "undefined" && navigator.canShare) {
    try {
      const file = new File([shareBlob], pdfFileName, { type: "application/pdf" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: pdfFileName,
          text: message,
        });
        toast.success("Opening WhatsApp with Invoice PDF attached!");
        return { success: true, channel: "web_share" };
      }
    } catch (e: any) {
      if (e.name === "AbortError") {
        return { success: true, channel: "web_share_aborted" };
      }
    }
  }

  // 5. Desktop PC fallback: download PDF file automatically (no annoying Windows dialog)
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

  // 6. Open WhatsApp Chat URL
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  window.open(waUrl, "_blank");
  toast.success("Opening WhatsApp chat...");
  return { success: true, channel: "click_to_chat" };
}
