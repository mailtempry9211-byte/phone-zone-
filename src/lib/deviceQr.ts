/**
 * Utility to generate printable Device QR Stickers for Repairs
 * and Quick-Sale Phone Screen Wallpapers with embedded QR codes.
 */
import QRCode from "qrcode";

export interface RepairStickerData {
  jobNo: string;
  customerName?: string;
  deviceModel?: string;
  problem?: string;
  receivedDate?: string;
}

export interface SaleWallpaperData {
  phoneId: string;
  phoneName: string;
  imei: string;
  storage?: string;
  sellingPrice?: number;
  shopName?: string;
}

/**
 * Generate a printable SVG/DataURL sticker for sticking on a repaired device.
 */
export async function generateRepairStickerDataUrl(data: RepairStickerData): Promise<string> {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  // Tracking URL that opens the live status or technician update form
  const trackUrl = `${origin}/track?job=${encodeURIComponent(data.jobNo)}`;

  // Generate QR code as high-res PNG data URL
  const qrDataUrl = await QRCode.toDataURL(trackUrl, {
    width: 250,
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
  });

  return qrDataUrl;
}

/**
 * Open a clean print window for printing a 2x1 inch or thermal device sticker.
 */
export async function printRepairSticker(data: RepairStickerData): Promise<void> {
  const qrUrl = await generateRepairStickerDataUrl(data);
  const printWindow = window.open("", "_blank", "width=400,height=500");
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Sticker - ${data.jobNo}</title>
        <style>
          @page { size: 50mm 35mm; margin: 0; }
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 4px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: #fff;
            color: #000;
            width: 48mm;
            height: 33mm;
            box-sizing: border-box;
          }
          .details {
            flex: 1;
            padding-right: 4px;
            font-size: 8px;
            line-height: 1.25;
          }
          .job-no {
            font-size: 10px;
            font-weight: bold;
            font-family: monospace;
            border-bottom: 1px solid #000;
            padding-bottom: 2px;
            margin-bottom: 3px;
          }
          .qr {
            width: 26mm;
            height: 26mm;
          }
          .qr img {
            width: 100%;
            height: 100%;
            display: block;
          }
          .sub {
            color: #444;
            font-size: 7.5px;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="details">
          <div class="job-no">${data.jobNo}</div>
          <div><b>Device:</b> ${data.deviceModel || "Phone"}</div>
          <div><b>Cust:</b> ${data.customerName || "Customer"}</div>
          <div class="sub"><b>Issue:</b> ${(data.problem || "").slice(0, 30)}</div>
          <div class="sub"><b>Date:</b> ${data.receivedDate || new Date().toLocaleDateString()}</div>
          <div style="margin-top:2px;font-size:6.5px;color:#666;">SCAN TO TRACK / UPDATE</div>
        </div>
        <div class="qr">
          <img src="${qrUrl}" alt="QR" />
        </div>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 800);
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * Generate a mobile wallpaper with QR code for 1-click counter sale.
 * When scanned by staff, it directly opens the sales dialog for this phone.
 */
export async function generateSaleWallpaperBlob(data: SaleWallpaperData): Promise<Blob> {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  // QR payload contains a direct deep-link to trigger process sale
  const saleActionUrl = `${origin}/?action=sell&phone_id=${encodeURIComponent(data.phoneId)}&imei=${encodeURIComponent(data.imei)}`;

  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, saleActionUrl, {
    width: 380,
    margin: 2,
    color: { dark: "#0f172a", light: "#ffffff" },
  });

  // Create a 9:16 mobile wallpaper canvas (1080x1920 or 720x1280)
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 1280;
  const ctx = canvas.getContext("2d")!;

  // 1. Sleek Gradient Dark Wallpaper Background
  const grad = ctx.createLinearGradient(0, 0, 0, 1280);
  grad.addColorStop(0, "#090d16");
  grad.addColorStop(0.5, "#0f172a");
  grad.addColorStop(1, "#020617");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 720, 1280);

  // 2. Header Branding
  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(data.shopName || "PHONEZONE STORE", 360, 180);

  // 3. Device Name
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 44px sans-serif";
  ctx.fillText(data.phoneName, 360, 240);

  // Storage / Specs
  if (data.storage) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "24px sans-serif";
    ctx.fillText(`${data.storage} | Tested & Verified`, 360, 280);
  }

  // 4. White Rounded Card for QR code
  const cardX = 140;
  const cardY = 340;
  const cardW = 440;
  const cardH = 470;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 24);
  ctx.fill();

  // Draw QR in center of card
  ctx.drawImage(qrCanvas, cardX + 30, cardY + 25, 380, 380);

  // QR Label inside card
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 20px monospace";
  ctx.fillText("SCAN TO PROCESS SALE", 360, cardY + 435);

  // 5. Price Highlight
  if (data.sellingPrice) {
    ctx.fillStyle = "#22c55e";
    ctx.font = "bold 46px sans-serif";
    ctx.fillText(`₹${data.sellingPrice.toLocaleString()}`, 360, 890);
  }

  // 6. IMEI
  ctx.fillStyle = "#64748b";
  ctx.font = "20px monospace";
  ctx.fillText(`IMEI: ${data.imei}`, 360, 940);

  // 7. Footer Instructions
  ctx.fillStyle = "#475569";
  ctx.font = "18px sans-serif";
  ctx.fillText("Set this image as lock-screen / wallpaper on the display phone.", 360, 1160);
  ctx.fillText("Any counter staff can scan to sell instantly.", 360, 1190);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), "image/jpeg", 0.95);
  });
}

/**
 * Trigger download of the wallpaper image.
 */
export async function downloadSaleWallpaper(data: SaleWallpaperData): Promise<void> {
  const blob = await generateSaleWallpaperBlob(data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Wallpaper_Sale_${data.phoneName.replace(/\s+/g, "_")}_${data.imei.slice(-6)}.jpg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

