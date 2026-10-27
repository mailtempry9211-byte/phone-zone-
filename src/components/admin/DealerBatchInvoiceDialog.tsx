import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Printer,
  Share2,
  Building2,
  ShieldCheck,
  FileText,
  Smartphone,
  CreditCard,
  Calendar,
  CheckCircle2,
  Receipt,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { dispatchWhatsApp } from "@/utils/whatsappDispatcher";

export interface DealerBatchInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId?: string | null;
  initialBatchData?: any;
}

export const DealerBatchInvoiceDialog: React.FC<DealerBatchInvoiceDialogProps> = ({
  open,
  onOpenChange,
  batchId,
  initialBatchData,
}) => {
  const [waMode, setWaMode] = useState<"both" | "text_only" | "pdf_only">("both");

  const { data: adminSettings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("admin_settings").select("*").single();
      return data;
    },
  });

  const { data: fetchedBatch, isLoading } = useQuery({
    queryKey: ["dealer_batch", batchId],
    queryFn: async () => {
      if (!batchId) return null;
      const res = await fetch(`/api/dealers/batches/${batchId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Could not load batch invoice details");
      return res.json();
    },
    enabled: open && !!batchId && !initialBatchData,
  });

  const batch = initialBatchData || fetchedBatch;

  if (!open) return null;

  const shop: any = adminSettings || {};
  const dealer = batch?.dealer || {};
  const phones: any[] = batch?.phones || [];
  const totalAmount = Number(batch?.totalAmount || batch?.total_amount || 0);
  const totalPhones = phones.length || batch?.totalPhones || batch?.total_phones || 0;
  const purchaseDate = batch?.purchaseDate || batch?.purchase_date || new Date().toISOString().split("T")[0];
  const invoiceNumber = batch?.invoiceNumber || batch?.invoice_number || "PUR-B2B";
  const paymentMethod = batch?.paymentMethod || batch?.payment_method || "Cash";

  const generateA4Html = () => {
    const dateFormatted = new Date(purchaseDate).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>B2B Batch Purchase Bill - ${invoiceNumber}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; background: #fff; padding: 16px; line-height: 1.4; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid #0f172a; padding-bottom: 12px; }
    .brand-title { font-size: 24px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
    .brand-meta { font-size: 11px; color: #475569; margin-top: 4px; line-height: 1.5; }
    .inv-title-box { text-align: right; }
    .inv-badge { font-size: 11px; font-weight: 700; color: #0284c7; text-transform: uppercase; letter-spacing: 1px; }
    .inv-no { font-size: 19px; font-weight: 800; color: #0f172a; margin-top: 2px; }
    .inv-date { font-size: 11px; color: #64748b; margin-top: 2px; }
    
    .party-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 14px; }
    .party-card { border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 12px 14px; background: #f8fafc; font-size: 11px; line-height: 1.5; position: relative; }
    .party-card h4 { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px; }
    .dealer-photo { position: absolute; top: 12px; right: 12px; width: 52px; height: 52px; border-radius: 6px; object-fit: cover; border: 1px solid #94a3b8; }

    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 11px; }
    th { background: #0f172a; color: #fff; padding: 8px 10px; text-align: left; font-size: 10.5px; text-transform: uppercase; font-weight: 700; }
    th.right, td.right { text-align: right; }
    td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fafc; }
    
    .total-card { margin-top: 14px; display: flex; justify-content: flex-end; }
    .total-box { width: 300px; border: 1.5px solid #0f172a; border-radius: 6px; overflow: hidden; }
    .total-row { display: flex; justify-content: space-between; padding: 6px 12px; font-size: 11.5px; border-bottom: 1px solid #e2e8f0; }
    .total-row.grand { background: #0f172a; color: #fff; font-size: 13.5px; font-weight: 800; border-bottom: none; }
    
    .b2b-notice { margin-top: 14px; border: 1px dashed #0284c7; background: #f0f9ff; padding: 10px 14px; border-radius: 6px; font-size: 10px; color: #0369a1; }
    .sign-row { display: flex; justify-content: space-between; margin-top: 32px; padding: 0 10px; }
    .sign-box { text-align: center; width: 220px; }
    .sign-line { border-bottom: 1.5px solid #0f172a; height: 50px; margin-bottom: 6px; display: flex; align-items: center; justify-content: center; }
    .sign-line img { max-height: 44px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand-title">${shop.business_name || "PHONEZONE"}</div>
      <div class="brand-meta">
        ${shop.address || "Sitapur, Uttar Pradesh"}<br>
        Phone: ${shop.phone_primary || "N/A"} | GST: ${shop.gst_number || "N/A"}<br>
        Udyam Reg. No: ${shop.udyam_registration || "N/A"}
      </div>
    </div>
    <div class="inv-title-box">
      <div class="inv-badge">B2B Commercial Bulk Purchase Bill</div>
      <div class="inv-no">${invoiceNumber}</div>
      <div class="inv-date">Dated: ${dateFormatted}</div>
    </div>
  </div>

  <div class="party-grid">
    <div class="party-card">
      <h4>Purchased By (Buyer / Store)</h4>
      <strong style="font-size:12px;">${shop.business_name || "PHONEZONE"}</strong><br>
      Address: ${shop.address || "Sitapur, UP"}<br>
      Phone: ${shop.phone_primary || "N/A"}<br>
      Email: ${shop.email || "N/A"}
    </div>
    <div class="party-card">
      ${dealer.photo_url ? `<img src="${dealer.photo_url}" alt="Dealer Photo" class="dealer-photo" />` : ""}
      <h4>Wholesale Supplier / Dealer (Seller)</h4>
      <strong style="font-size:12px;">${dealer.shop_name || "Wholesale Partner"}</strong><br>
      Proprietor: <strong>${dealer.proprietor_name || "Authorized Partner"}</strong><br>
      Phone: ${dealer.phone || "N/A"} ${dealer.alternate_phone ? ` / ${dealer.alternate_phone}` : ""}<br>
      Address: ${dealer.address || "Sitapur, UP"}<br>
      GST / PAN: <strong>${dealer.gst_number || dealer.pan_number || "Commercial Dealer"}</strong>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:30px">#</th>
        <th>Device & Model Details</th>
        <th style="width:140px">IMEI / Serial</th>
        <th style="width:85px">Condition</th>
        <th style="width:120px">Kit / Included</th>
        <th class="right" style="width:110px">Amount (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${phones.map((p, idx) => {
        const feats = Array.isArray(p.features) ? p.features.join(", ") : (p.features || "");
        const accessories = [
          p.bill_available ? "Bill" : null,
          p.box_available ? "Box" : null,
          p.charger_available ? "Charger" : null,
        ].filter(Boolean).join(" + ") || "Device Only";

        return `
        <tr>
          <td>${idx + 1}</td>
          <td>
            <strong>${p.brand || p.phone_name} ${p.model}</strong>
            ${p.variant ? ` | ${p.variant}` : ""}
            ${p.colour ? ` | ${p.colour}` : ""}
            ${feats ? `<div style="font-size:9.5px;color:#0284c7;margin-top:2px;">✨ ${feats}</div>` : ""}
          </td>
          <td><code style="font-family:monospace;font-size:10.5px;">${p.imei_number || p.imei}</code></td>
          <td><span style="text-transform:capitalize;font-weight:600;">${p.condition || "Good"}</span></td>
          <td style="font-size:10px;color:#475569;">${accessories}</td>
          <td class="right" style="font-weight:700;">₹${Number(p.purchase_price || 0).toLocaleString("en-IN")}</td>
        </tr>`;
      }).join("")}
    </tbody>
  </table>

  <div class="total-card">
    <div class="total-box">
      <div class="total-row">
        <span>Total Phones In Batch:</span>
        <strong>${totalPhones} Units</strong>
      </div>
      <div class="total-row">
        <span>Payment Method:</span>
        <strong style="text-transform:uppercase;">${paymentMethod}</strong>
      </div>
      <div class="total-row grand">
        <span>Total Batch Amount:</span>
        <span>₹${totalAmount.toLocaleString("en-IN")}</span>
      </div>
    </div>
  </div>

  <div class="b2b-notice">
    <strong>B2B Trade Undertaking:</strong> This transaction is an official inter-business wholesale purchase between registered trade entities. The seller confirms lawful commercial title to all listed devices with genuine electronic serials and physical accessories.
  </div>

  <div class="sign-row">
    <div class="sign-box">
      <div class="sign-line">
        ${dealer.signature_url ? `<img src="${dealer.signature_url}" alt="Dealer Signature" />` : `<span style="font-size:10px;color:#94a3b8;">Dealer Signature on file</span>`}
      </div>
      <div style="font-weight:700;font-size:11px;">${dealer.proprietor_name || "Authorized Partner"}</div>
      <div style="font-size:9px;color:#64748b;">(Authorized Dealer Signatory)</div>
    </div>
    <div class="sign-box">
      <div class="sign-line">
        ${shop.signature_url ? `<img src="${shop.signature_url}" alt="Shop Signature" />` : `<span style="font-size:11px;font-weight:700;color:#0284c7;">${shop.business_name || "PHONEZONE"}</span>`}
      </div>
      <div style="font-weight:700;font-size:11px;">For ${shop.business_name || "PHONEZONE"}</div>
      <div style="font-size:9px;color:#64748b;">(Authorized Buyer Signatory)</div>
    </div>
  </div>
</body>
</html>`;
  };

  const generateThermalHtml = () => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>B2B Thermal Bill - ${invoiceNumber}</title>
  <style>
    @page { size: 80mm auto; margin: 2mm; }
    body { font-family: monospace; font-size: 11px; margin: 0; padding: 4px; color: #000; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .line { border-bottom: 1px dashed #000; margin: 5px 0; }
    .flex { display: flex; justify-content: space-between; }
    table { width: 100%; font-size: 10px; border-collapse: collapse; margin-top: 4px; }
    th { text-align: left; border-bottom: 1px solid #000; padding: 2px 0; font-size: 9.5px; }
    td { padding: 3px 0; }
  </style>
</head>
<body>
  <div class="center bold" style="font-size:14px;">${shop.business_name || "PHONEZONE"}</div>
  <div class="center" style="font-size:10px;">${shop.address || "Sitapur, UP"}</div>
  <div class="center" style="font-size:10px;">Phone: ${shop.phone_primary || ""}</div>
  <div class="line"></div>
  <div class="center bold">B2B BATCH PURCHASE BILL</div>
  <div class="flex"><span>Inv: ${invoiceNumber}</span><span>Date: ${purchaseDate}</span></div>
  <div class="flex"><span>Dealer: ${dealer.shop_name || "Wholesale"}</span><span>Prop: ${dealer.proprietor_name || ""}</span></div>
  <div class="line"></div>
  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th>IMEI</th>
        <th style="text-align:right;">Amt</th>
      </tr>
    </thead>
    <tbody>
      ${phones.map((p, i) => `
        <tr>
          <td>${i + 1}. ${p.brand || p.phone_name} ${p.model}</td>
          <td>${(p.imei_number || p.imei || "").slice(-6)}</td>
          <td style="text-align:right;">₹${Number(p.purchase_price || 0).toLocaleString("en-IN")}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>
  <div class="line"></div>
  <div class="flex bold" style="font-size:12px;">
    <span>TOTAL (${totalPhones} pcs):</span>
    <span>₹${totalAmount.toLocaleString("en-IN")}</span>
  </div>
  <div class="flex" style="font-size:10px;margin-top:2px;">
    <span>Payment: ${paymentMethod}</span>
    <span>Status: Paid</span>
  </div>
  <div class="line"></div>
  <div class="center" style="font-size:9px;margin-top:4px;">
    *** Commercial Wholesale Inward ***<br>
    Verified & Received by ${shop.business_name || "PHONEZONE"}
  </div>
</body>
</html>`;
  };

  const handlePrint = (mode: "a4" | "thermal" = "a4") => {
    const html = mode === "thermal" ? generateThermalHtml() : generateA4Html();
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Please allow popups to print invoice.");
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
    }, 300);
  };

  const handleWhatsApp = (mode: "both" | "text_only" | "pdf_only" = waMode) => {
    if (!dealer.phone) {
      toast.error("Dealer phone number is not available for WhatsApp.");
      return;
    }
    const cleanPhone = String(dealer.phone).replace(/\D/g, "");
    const html = generateA4Html();

    const itemsText = phones
      .map(
        (p, i) =>
          `${i + 1}. *${p.brand || p.phone_name} ${p.model}* ${p.variant || ""} (IMEI: ${p.imei_number || p.imei}) - ₹${Number(p.purchase_price || 0).toLocaleString("en-IN")}`
      )
      .join("\n");

    const message = `📱 *${shop.business_name || "PHONEZONE"} - B2B Bulk Purchase Invoice*

📋 *Batch Invoice No:* ${invoiceNumber}
📅 *Purchase Date:* ${purchaseDate}
🏢 *Dealer:* ${dealer.shop_name} (${dealer.proprietor_name})
📍 *Location:* ${dealer.address || dealer.city || "Sitapur"}

📦 *Purchased Phones (${totalPhones} Units):*
${itemsText}

💰 *Total Batch Amount:* ₹${totalAmount.toLocaleString("en-IN")}
💳 *Payment Mode:* ${paymentMethod}
🛡️ *Declaration:* B2B Commercial Purchase Verified

✅ Thank you for your continued trade partnership!`;

    dispatchWhatsApp({
      phone: cleanPhone,
      message,
      invoiceHtml: html,
      pdfFileName: `B2B_Batch_Invoice_${invoiceNumber}.pdf`,
      adminSettings: shop,
      mode,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="border-b pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-sky-800">
                <Building2 className="h-6 w-6 text-sky-600" />
                B2B Bulk Purchase Invoice (संयुक्त डीलर बिल)
              </DialogTitle>
              <p className="text-xs text-gray-500 mt-0.5">
                Invoice <strong>{invoiceNumber}</strong> • Date: <strong>{purchaseDate}</strong> • Dealer:{" "}
                <strong>{dealer.shop_name}</strong>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-300 text-xs py-1 px-2.5">
                <ShieldCheck className="h-3.5 w-3.5 mr-1 text-sky-600" />
                B2B Commercial Tax Invoice
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 text-center text-gray-500 text-sm">Loading batch purchase invoice...</div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
            {/* Dealer & Buyer Header Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 border rounded-lg text-xs space-y-1">
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Wholesale Supplier (विक्रेता)</div>
                <div className="flex items-start gap-3">
                  {dealer.photo_url ? (
                    <img
                      src={dealer.photo_url}
                      alt="Dealer Photo"
                      className="w-12 h-12 rounded-full object-cover border-2 border-sky-300 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-sky-100 flex items-center justify-center text-sky-700 font-bold flex-shrink-0">
                      {dealer.shop_name?.charAt(0) || "D"}
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-sm text-gray-900">{dealer.shop_name}</div>
                    <div className="text-gray-600">Proprietor: {dealer.proprietor_name}</div>
                    <div className="text-gray-600">Phone: {dealer.phone}</div>
                    <div className="text-gray-500 font-mono text-[11px]">
                      GST/PAN: {dealer.gst_number || dealer.pan_number || "Commercial Dealer"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-sky-50/50 border border-sky-200 rounded-lg text-xs space-y-1">
                <div className="text-[11px] font-bold text-sky-700 uppercase tracking-wide">Buyer / Store (खरीदार)</div>
                <div className="font-bold text-sm text-gray-900">{shop.business_name || "PHONEZONE"}</div>
                <div className="text-gray-600">{shop.address || "Sitapur, Uttar Pradesh"}</div>
                <div className="text-gray-600">Phone: {shop.phone_primary || "N/A"}</div>
                <div className="text-gray-500 font-mono text-[11px]">GST: {shop.gst_number || shop.gst_in || "N/A"}</div>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg text-center">
              <div>
                <div className="text-[11px] text-gray-500">Total Phones</div>
                <div className="text-lg font-bold text-gray-900">{totalPhones} Units</div>
              </div>
              <div>
                <div className="text-[11px] text-gray-500">Payment Mode</div>
                <div className="text-lg font-bold text-sky-700 uppercase">{paymentMethod}</div>
              </div>
              <div>
                <div className="text-[11px] text-gray-500">Total Batch Amount</div>
                <div className="text-lg font-bold text-emerald-700">₹{totalAmount.toLocaleString("en-IN")}</div>
              </div>
            </div>

            {/* Devices Table */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-slate-100 px-3 py-2 text-xs font-bold text-gray-700 border-b flex items-center justify-between">
                <span>Phones In This Batch ({phones.length})</span>
                <span className="text-[11px] text-gray-500 font-normal">All items covered under single batch invoice</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="py-2 px-3 text-left w-10">#</th>
                      <th className="py-2 px-3 text-left">Device Details</th>
                      <th className="py-2 px-3 text-left font-mono">15-digit IMEI</th>
                      <th className="py-2 px-3 text-left">Condition</th>
                      <th className="py-2 px-3 text-left">Accessories</th>
                      <th className="py-2 px-3 text-right">Cost (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {phones.map((p, idx) => {
                      const feats = Array.isArray(p.features) ? p.features.join(", ") : (p.features || "");
                      const accessories = [
                        p.bill_available ? "Bill" : null,
                        p.box_available ? "Box" : null,
                        p.charger_available ? "Charger" : null,
                      ].filter(Boolean).join(" + ") || "Device Only";

                      return (
                        <tr key={p.id || idx} className="hover:bg-slate-50/60">
                          <td className="py-2 px-3 font-semibold text-gray-500">{idx + 1}</td>
                          <td className="py-2 px-3">
                            <div className="font-semibold text-gray-900">
                              {p.brand || p.phone_name} {p.model}
                            </div>
                            <div className="text-[11px] text-gray-500">
                              {p.variant || ""} {p.colour ? `• ${p.colour}` : ""}
                            </div>
                            {feats && <div className="text-[10px] text-sky-600 mt-0.5">✨ {feats}</div>}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px]">{p.imei_number || p.imei}</td>
                          <td className="py-2 px-3 capitalize">
                            <Badge variant="outline" className="text-[10px] py-0">
                              {p.condition || "good"}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-gray-600">{accessories}</td>
                          <td className="py-2 px-3 text-right font-bold text-gray-900">
                            ₹{Number(p.purchase_price || 0).toLocaleString("en-IN")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Signatures Preview */}
            <div className="grid grid-cols-2 gap-4 p-3 border rounded-lg bg-slate-50/50">
              <div className="text-center">
                <div className="text-[11px] text-gray-500 mb-1">Dealer Authorized Signature</div>
                <div className="h-14 border border-dashed rounded bg-white flex items-center justify-center p-1">
                  {dealer.signature_url ? (
                    <img src={dealer.signature_url} alt="Dealer Signature" className="max-h-12 object-contain" />
                  ) : (
                    <span className="text-[11px] text-gray-400 italic">Signature on file</span>
                  )}
                </div>
                <div className="text-xs font-semibold mt-1">{dealer.proprietor_name}</div>
              </div>
              <div className="text-center">
                <div className="text-[11px] text-gray-500 mb-1">Buyer Store Seal &amp; Sign</div>
                <div className="h-14 border border-dashed rounded bg-white flex items-center justify-center p-1">
                  {shop.signature_url ? (
                    <img src={shop.signature_url} alt="Shop Signature" className="max-h-12 object-contain" />
                  ) : (
                    <span className="text-xs font-bold text-sky-700">{shop.business_name || "PHONEZONE"}</span>
                  )}
                </div>
                <div className="text-xs font-semibold mt-1">For {shop.business_name || "PHONEZONE"}</div>
              </div>
            </div>

            {/* WhatsApp Dispatch Mode Selector */}
            <div className="p-3 bg-emerald-50/70 border border-emerald-300 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <Share2 className="h-4 w-4 text-emerald-600" />
                  WhatsApp Delivery Options (व्हाट्सएप भेजने का तरीका चुनें)
                </div>
                <div className="text-[11px] text-emerald-700">
                  Target Dealer Phone: <strong>{dealer.phone || "No phone"}</strong>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant={waMode === "both" ? "default" : "outline"}
                  onClick={() => {
                    setWaMode("both");
                    handleWhatsApp("both");
                  }}
                  className={`h-8 text-xs ${
                    waMode === "both" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "border-emerald-300 text-emerald-800"
                  }`}
                >
                  📱 Both (Text + PDF)
                </Button>
                <Button
                  size="sm"
                  variant={waMode === "text_only" ? "default" : "outline"}
                  onClick={() => {
                    setWaMode("text_only");
                    handleWhatsApp("text_only");
                  }}
                  className={`h-8 text-xs ${
                    waMode === "text_only" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "border-emerald-300 text-emerald-800"
                  }`}
                >
                  💬 Text Only
                </Button>
                <Button
                  size="sm"
                  variant={waMode === "pdf_only" ? "default" : "outline"}
                  onClick={() => {
                    setWaMode("pdf_only");
                    handleWhatsApp("pdf_only");
                  }}
                  className={`h-8 text-xs ${
                    waMode === "pdf_only" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "border-emerald-300 text-emerald-800"
                  }`}
                >
                  📄 PDF Only
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="border-t pt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handlePrint("a4")} className="gap-1.5 text-xs">
              <Printer className="h-4 w-4" />
              Print A4 Invoice
            </Button>
            <Button variant="outline" size="sm" onClick={() => handlePrint("thermal")} className="gap-1.5 text-xs">
              <Receipt className="h-4 w-4" />
              Thermal Bill (80mm)
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DealerBatchInvoiceDialog;
