import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Smartphone, Building2, Printer, Share2, CheckCircle2, ShieldCheck, FileText, AlertCircle, ScanLine, Sparkles, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { printHtml } from "@/lib/printHtml";
import { dispatchWhatsApp } from "@/utils/whatsappDispatcher";
import { Checkbox } from "@/components/ui/checkbox";
import ImeiScanButton from "./ImeiScanButton";

interface BatchPhoneItem {
  id: string;
  brand: string;
  model: string;
  variant: string;
  colour: string;
  imei: string;
  imei2?: string;
  condition: string;
  purchase_price: number;
  selling_price?: number;
  payment_method: string;
  bill_available: boolean;
  box_available: boolean;
  charger_available: boolean;
  features?: string;
  tacInfo?: any;
}

interface DealerBatchPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealerId?: string | null;
  onSuccess?: () => void;
}

export const DealerBatchPurchaseDialog: React.FC<DealerBatchPurchaseDialogProps> = ({
  open,
  onOpenChange,
  dealerId,
  onSuccess,
}) => {
  const queryClient = useQueryClient();

  const [selectedDealerId, setSelectedDealerId] = useState<string>("");
  const [purchaseDate, setPurchaseDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState<string>("UPI");
  const [notes, setNotes] = useState<string>("");

  const [phoneRows, setPhoneRows] = useState<BatchPhoneItem[]>([
    {
      id: "row_1",
      brand: "Apple",
      model: "",
      variant: "",
      colour: "",
      imei: "",
      imei2: "",
      condition: "good",
      purchase_price: 0,
      selling_price: 0,
      payment_method: "UPI",
      bill_available: true,
      box_available: true,
      charger_available: true,
      features: "All Original",
    },
  ]);

  const [scanningRowIndex, setScanningRowIndex] = useState<number | null>(null);
  const [createdBatch, setCreatedBatch] = useState<any | null>(null);

  // Fetch all dealers for dropdown
  const { data: dealers = [] } = useQuery({
    queryKey: ["dealers-list"],
    queryFn: async () => {
      const res = await fetch("/api/dealers");
      return res.ok ? res.json() : [];
    },
    enabled: open,
  });

  const { data: adminSettings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      return res.ok ? res.json() : null;
    },
  });

  useEffect(() => {
    if (dealerId) {
      setSelectedDealerId(dealerId);
    } else if (dealers.length > 0 && !selectedDealerId) {
      setSelectedDealerId(dealers[0].id);
    }
  }, [dealerId, dealers]);

  const activeDealer = dealers.find((d: any) => d.id === selectedDealerId);

  const addRow = () => {
    setPhoneRows((prev) => [
      ...prev,
      {
        id: `row_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        brand: prev.length > 0 ? prev[prev.length - 1].brand : "Apple",
        model: "",
        variant: "",
        colour: "",
        imei: "",
        imei2: "",
        condition: "good",
        purchase_price: 0,
        selling_price: 0,
        payment_method: defaultPaymentMethod,
        bill_available: true,
        box_available: true,
        charger_available: true,
        features: "All Original",
      },
    ]);
  };

  const removeRow = (index: number) => {
    if (phoneRows.length === 1) {
      toast.error("Batch must have at least one phone.");
      return;
    }
    setPhoneRows((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: keyof BatchPhoneItem, value: any) => {
    setPhoneRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleImeiChange = async (index: number, newImei: string) => {
    const clean = newImei.replace(/\D/g, "").slice(0, 15);
    updateRow(index, "imei", clean);

    if (clean.length >= 8) {
      try {
        const res = await fetch(`/api/tac/${clean}`, { credentials: "include" });
        if (res.ok) {
          const tacData = await res.json();
          if (tacData.found) {
            setPhoneRows((prev) => {
              const updated = [...prev];
              const r = { ...updated[index] };
              if (tacData.brand && (!r.brand || r.brand === "Apple")) r.brand = tacData.brand;
              if (tacData.model && !r.model) r.model = tacData.model;
              else if (tacData.phoneName && !r.model) r.model = tacData.phoneName;
              if (tacData.variant && !r.variant) r.variant = tacData.variant;
              if (tacData.colour && !r.colour) r.colour = tacData.colour;
              r.tacInfo = tacData;
              updated[index] = r;
              return updated;
            });
            toast.success(`TAC Found for Row #${index + 1}: ${tacData.brand} ${tacData.phoneName || tacData.model}`);
          } else {
            setPhoneRows((prev) => {
              const updated = [...prev];
              updated[index] = { ...updated[index], tacInfo: { found: false, hasKeys: tacData.hasKeys } };
              return updated;
            });
          }
        }
      } catch {}
    } else {
      setPhoneRows((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], tacInfo: undefined };
        return updated;
      });
    }
  };

  const fetchOnlineTac = async (index: number, imei: string) => {
    try {
      toast.info(`Fetching TAC online for Row #${index + 1}...`);
      const res = await fetch("/api/tac/fetch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ value: imei, force: true }),
      });
      const data = await res.json();
      if (data.found) {
        setPhoneRows((prev) => {
          const updated = [...prev];
          const r = { ...updated[index] };
          if (data.brand) r.brand = data.brand;
          if (data.model) r.model = data.model;
          else if (data.phoneName) r.model = data.phoneName;
          if (data.variant) r.variant = data.variant;
          if (data.colour) r.colour = data.colour;
          r.tacInfo = data;
          updated[index] = r;
          return updated;
        });
        toast.success(`Hicelltek API Found: ${data.brand || ""} ${data.phoneName || data.model || ""}`);
      } else {
        toast.error(data.error?.message || "Not found on online TAC database.");
      }
    } catch {
      toast.error("Failed to query online TAC API.");
    }
  };

  const totalBatchAmount = phoneRows.reduce((sum, p) => sum + (Number(p.purchase_price) || 0), 0);

  const purchaseMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDealerId) throw new Error("Please select a dealer.");
      if (phoneRows.length === 0) throw new Error("At least one phone is required.");

      for (let i = 0; i < phoneRows.length; i++) {
        const p = phoneRows[i];
        if (!p.brand.trim()) throw new Error(`Row #${i + 1}: Brand is required.`);
        if (!p.model.trim()) throw new Error(`Row #${i + 1}: Model is required.`);
        if (!p.imei.trim()) throw new Error(`Row #${i + 1}: 15-digit IMEI is required.`);
        if (p.imei.replace(/\D/g, "").length !== 15) {
          throw new Error(`Row #${i + 1}: IMEI must be exactly 15 digits.`);
        }
        if (!Number(p.purchase_price) || Number(p.purchase_price) <= 0) {
          throw new Error(`Row #${i + 1}: Valid purchase price is required.`);
        }
      }

      const res = await fetch("/api/dealers/batch-purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealer_id: selectedDealerId,
          purchase_date: purchaseDate,
          payment_method: defaultPaymentMethod,
          notes,
          phones: phoneRows,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Batch purchase failed.");
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Batch Purchase Completed! ${data.totalPhones} phones added to inventory.`);
      setCreatedBatch(data);
      queryClient.invalidateQueries({ queryKey: ["phones"] });
      queryClient.invalidateQueries({ queryKey: ["dealers"] });
      queryClient.invalidateQueries({ queryKey: ["admin_stats"] });
      if (onSuccess) onSuccess();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to process batch purchase");
    },
  });

  const generateBatchInvoiceHtml = (batchData: any) => {
    const dealer = batchData.dealer || activeDealer;
    const shop = adminSettings || {};
    const dateFormatted = new Date(batchData.purchaseDate || purchaseDate).toLocaleDateString("en-IN");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>B2B Batch Purchase Invoice - ${batchData.invoiceNumber}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; background: #fff; padding: 14px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 10px; }
    .brand-title { font-size: 22px; font-weight: 800; color: #0f172a; text-transform: uppercase; }
    .brand-meta { font-size: 11px; color: #475569; margin-top: 3px; line-height: 1.4; }
    .inv-title-box { text-align: right; }
    .inv-badge { font-size: 11px; font-weight: 700; color: #0284c7; text-transform: uppercase; letter-spacing: 1px; }
    .inv-no { font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 2px; }
    .inv-date { font-size: 11px; color: #64748b; margin-top: 2px; }
    .party-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 14px; }
    .party-card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 12px; background: #f8fafc; font-size: 11px; line-height: 1.5; }
    .party-card h4 { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 11px; }
    th { background: #0f172a; color: #fff; padding: 8px 10px; text-align: left; font-size: 10.5px; text-transform: uppercase; }
    th.right, td.right { text-align: right; }
    td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fafc; }
    .total-card { margin-top: 14px; display: flex; justify-content: flex-end; }
    .total-box { width: 280px; border: 1.5px solid #0f172a; border-radius: 6px; overflow: hidden; }
    .total-row { display: flex; justify-content: space-between; padding: 6px 12px; font-size: 11.5px; border-bottom: 1px solid #e2e8f0; }
    .total-row.grand { background: #0f172a; color: #fff; font-size: 13px; font-weight: 800; border-bottom: none; }
    .b2b-notice { margin-top: 14px; border: 1px dashed #0284c7; background: #f0f9ff; padding: 8px 12px; border-radius: 6px; font-size: 10px; color: #0369a1; }
    .sign-row { display: flex; justify-content: space-between; margin-top: 30px; }
    .sign-box { text-align: center; width: 200px; }
    .sign-line { border-bottom: 1.5px solid #0f172a; height: 45px; margin-bottom: 4px; display: flex; align-items: center; justify-content: center; }
    .sign-line img { max-height: 40px; }
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
      <div class="inv-badge">B2B Commercial Bulk Purchase</div>
      <div class="inv-no">${batchData.invoiceNumber}</div>
      <div class="inv-date">Dated: ${dateFormatted}</div>
    </div>
  </div>

  <div class="party-grid">
    <div class="party-card">
      <h4>Purchased By (Buyer)</h4>
      <strong>${shop.business_name || "PHONEZONE"}</strong><br>
      Address: ${shop.address || "Sitapur, UP"}<br>
      Phone: ${shop.phone_primary || "N/A"}<br>
      Email: ${shop.email || "N/A"}
    </div>
    <div class="party-card">
      <h4>Supplier / Dealer (Seller)</h4>
      <strong>${dealer.shop_name}</strong> (Prop: ${dealer.proprietor_name})<br>
      Phone: ${dealer.phone} ${dealer.alternate_phone ? ` / ${dealer.alternate_phone}` : ""}<br>
      Address: ${dealer.address || "N/A"}<br>
      GST / PAN: ${dealer.gst_number || dealer.pan_number || "Commercial Dealer"}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:30px">#</th>
        <th>Phone Description</th>
        <th style="width:140px">IMEI 1</th>
        <th style="width:80px">Condition</th>
        <th style="width:80px">Payment</th>
        <th class="right" style="width:100px">Amount (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${phoneRows.map((p, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>
            <strong>${p.brand} ${p.model}</strong>
            ${p.variant ? ` | ${p.variant}` : ""}
            ${p.colour ? ` | ${p.colour}` : ""}
          </td>
          <td><code>${p.imei}</code></td>
          <td><span style="text-transform:capitalize;">${p.condition}</span></td>
          <td>${p.payment_method}</td>
          <td class="right">₹${Number(p.purchase_price).toLocaleString("en-IN")}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  <div class="total-card">
    <div class="total-box">
      <div class="total-row">
        <span>Total Phones:</span>
        <strong>${phoneRows.length} Units</strong>
      </div>
      <div class="total-row grand">
        <span>Total Purchase Amount:</span>
        <span>₹${totalBatchAmount.toLocaleString("en-IN")}</span>
      </div>
    </div>
  </div>

  <div class="b2b-notice">
    <strong>B2B Trade Declaration:</strong> This transaction is an inter-business commercial bulk trade. Devices are verified and accepted with commercial supplier warranty and original trade documentation.
  </div>

  <div class="sign-row">
    <div class="sign-box">
      <div class="sign-line">
        ${dealer.signature_url ? `<img src="${dealer.signature_url}" alt="Dealer Signature" />` : `<span style="font-size:10px;color:#94a3b8;">Dealer Signature on file</span>`}
      </div>
      <div style="font-weight:700;font-size:11px;">${dealer.proprietor_name}</div>
      <div style="font-size:9px;color:#64748b;">(Authorized Dealer Signatory)</div>
    </div>
    <div class="sign-box">
      <div class="sign-line">
        ${shop.signature_url ? `<img src="${shop.signature_url}" alt="Shop Signature" />` : `<span style="font-size:11px;font-weight:700;color:#0284c7;">${shop.business_name || "PHONEZONE"}</span>`}
      </div>
      <div style="font-weight:700;font-size:11px;">For ${shop.business_name || "PHONEZONE"}</div>
      <div style="font-size:9px;color:#64748b;">(Authorized Signatory)</div>
    </div>
  </div>
</body>
</html>`;
  };

  const handlePrintBatchInvoice = () => {
    if (!createdBatch) return;
    const html = generateBatchInvoiceHtml(createdBatch);
    printHtml(html);
  };

  const handleShareBatchWhatsApp = () => {
    if (!createdBatch) return;
    const dealer = createdBatch.dealer || activeDealer;
    if (!dealer?.phone) {
      toast.error("Dealer phone number not found.");
      return;
    }
    const cleanPhone = String(dealer.phone).replace(/\D/g, "");
    const html = generateBatchInvoiceHtml(createdBatch);

    const message = `📱 *${adminSettings?.business_name || "PHONEZONE"} - B2B Bulk Purchase Bill*

📋 *Batch Invoice No:* ${createdBatch.invoiceNumber}
📅 *Date:* ${createdBatch.purchaseDate}
🏢 *Dealer:* ${dealer.shop_name} (${dealer.proprietor_name})

📦 *Phones Purchased (${createdBatch.totalPhones} Units):*
${phoneRows.map((p, i) => `${i + 1}. ${p.brand} ${p.model} (${p.imei}) - ₹${Number(p.purchase_price).toLocaleString("en-IN")}`).join("\n")}

💰 *Total Batch Amount:* ₹${Number(createdBatch.totalAmount).toLocaleString("en-IN")}
💳 *Payment Mode:* ${createdBatch.paymentMethod}

✅ Thank you for your business partnership!`;

    dispatchWhatsApp({
      phone: cleanPhone,
      message,
      invoiceHtml: html,
      pdfFileName: `Batch_Invoice_${createdBatch.invoiceNumber}.pdf`,
      adminSettings,
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="border-b pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-sky-700">
                <Building2 className="h-6 w-6" />
                B2B Bulk Phone Purchase (डीलर से मल्टीपल फोन्स खरीद)
              </DialogTitle>
              <p className="text-xs text-gray-500 mt-0.5">
                Add multiple pre-owned or stock phones in a single batch transaction from a registered dealer.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-300 text-xs py-1 px-2.5 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-sky-600" />
                Sapath Patra: B2B Commercial Exempt
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {createdBatch ? (
          /* Post-Creation Success View */
          <div className="py-6 flex flex-col items-center justify-center space-y-4 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Batch Purchase Recorded Successfully!</h3>
              <p className="text-sm text-gray-600">
                Batch Invoice <strong>{createdBatch.invoiceNumber}</strong> with {createdBatch.totalPhones} phones has been entered into inventory.
              </p>
            </div>

            <Card className="w-full max-w-md bg-slate-50 border-slate-200">
              <CardContent className="p-4 text-left space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Dealer:</span>
                  <span className="font-semibold text-gray-900">{createdBatch.dealer?.shop_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Proprietor:</span>
                  <span className="font-semibold text-gray-900">{createdBatch.dealer?.proprietor_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Phones:</span>
                  <span className="font-semibold text-gray-900">{createdBatch.totalPhones} units</span>
                </div>
                <div className="flex justify-between border-t pt-1.5">
                  <span className="text-gray-500 font-bold">Total Amount:</span>
                  <span className="font-bold text-emerald-600 text-sm">₹{Number(createdBatch.totalAmount).toLocaleString("en-IN")}</span>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button onClick={handlePrintBatchInvoice} className="bg-slate-900 hover:bg-slate-800 text-white gap-1.5">
                <Printer className="h-4 w-4" /> Print / Save PDF Invoice
              </Button>
              <Button onClick={handleShareBatchWhatsApp} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
                <Share2 className="h-4 w-4" /> Share on Dealer WhatsApp
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setCreatedBatch(null);
                  onOpenChange(false);
                }}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          /* Batch Entry Form */
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 py-2">
            {/* Dealer & Batch Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Select Registered Dealer *</Label>
                <Select value={selectedDealerId} onValueChange={setSelectedDealerId}>
                  <SelectTrigger className="mt-1 h-9 bg-white">
                    <SelectValue placeholder="Choose a Dealer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {dealers.map((d: any) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.shop_name} ({d.proprietor_name}) - {d.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeDealer && (
                  <p className="text-[11px] text-gray-500 mt-1">
                    GST: {activeDealer.gst_number || "N/A"} • Phone: {activeDealer.phone}
                  </p>
                )}
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Purchase Date</Label>
                <Input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="mt-1 h-9 bg-white"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Payment Mode</Label>
                <Select value={defaultPaymentMethod} onValueChange={setDefaultPaymentMethod}>
                  <SelectTrigger className="mt-1 h-9 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer (NEFT/RTGS)</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                    <SelectItem value="Credit / Khata">Credit (खता / Udhar)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Multi-phone Cards List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                  <Smartphone className="h-4 w-4 text-sky-600" /> Phones In This Batch ({phoneRows.length})
                </h4>
                <Button size="sm" variant="outline" onClick={addRow} className="h-8 gap-1 text-xs border-sky-300 text-sky-700 hover:bg-sky-50 font-medium">
                  <Plus className="h-3.5 w-3.5" /> Add Phone (+ Row)
                </Button>
              </div>

              <div className="space-y-2.5">
                {phoneRows.map((row, index) => (
                  <div
                    key={row.id}
                    className="border rounded-lg p-3 bg-white hover:border-sky-300 transition-all space-y-2 shadow-sm"
                  >
                    {/* Top Row: IMEI + Scanner, Brand, Model, Specs, Condition, Price */}
                    <div className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-center">
                      {/* Index badge */}
                      <div className="col-span-2 sm:col-span-1 text-center font-bold text-xs text-sky-800 bg-sky-50 py-1 rounded">
                        #{index + 1}
                      </div>

                      {/* 15-digit IMEI with Scanner */}
                      <div className="col-span-2 sm:col-span-3">
                        <div className="flex items-center gap-1">
                          <Input
                            placeholder="15-digit IMEI *"
                            maxLength={15}
                            value={row.imei}
                            onChange={(e) => handleImeiChange(index, e.target.value)}
                            className={`h-8 text-xs font-mono font-semibold ${
                              row.imei.length === 15 ? "border-emerald-500 bg-emerald-50/30 text-emerald-900" : ""
                            }`}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 text-xs border-sky-300 text-sky-700 hover:bg-sky-50 shrink-0"
                            title="Scan IMEI Barcode or read with OCR"
                            onClick={() => setScanningRowIndex(index)}
                          >
                            <ScanLine className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {row.tacInfo?.found && (
                          <div className="text-[10px] text-emerald-700 flex items-center gap-1 mt-0.5 font-medium truncate">
                            <span>✓ TAC Auto-filled: {row.tacInfo.brand} {row.tacInfo.phoneName || row.tacInfo.model}</span>
                          </div>
                        )}
                        {row.tacInfo && !row.tacInfo.found && row.imei.length >= 8 && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-amber-600">TAC not in DB</span>
                            <button
                              type="button"
                              onClick={() => fetchOnlineTac(index, row.imei)}
                              className="text-[10px] text-sky-700 hover:text-sky-900 font-semibold underline flex items-center gap-0.5"
                              title="Fetch specs online from Hicelltek API"
                            >
                              <Sparkles className="h-2.5 w-2.5 text-amber-500" /> Fetch Online
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Brand */}
                      <div className="col-span-1 sm:col-span-2">
                        <Input
                          placeholder="Brand (e.g. Apple)"
                          value={row.brand}
                          onChange={(e) => updateRow(index, "brand", e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>

                      {/* Model */}
                      <div className="col-span-1 sm:col-span-2">
                        <Input
                          placeholder="Model (e.g. iPhone 13) *"
                          value={row.model}
                          onChange={(e) => updateRow(index, "model", e.target.value)}
                          className="h-8 text-xs font-medium"
                        />
                      </div>

                      {/* Variant & Colour */}
                      <div className="col-span-2 sm:col-span-2 grid grid-cols-2 gap-1">
                        <Input
                          placeholder="Variant"
                          value={row.variant}
                          onChange={(e) => updateRow(index, "variant", e.target.value)}
                          className="h-8 text-xs"
                        />
                        <Input
                          placeholder="Colour"
                          value={row.colour}
                          onChange={(e) => updateRow(index, "colour", e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>

                      {/* Condition */}
                      <div className="col-span-1 sm:col-span-1">
                        <Select
                          value={row.condition}
                          onValueChange={(val) => updateRow(index, "condition", val)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="excellent">Excellent</SelectItem>
                            <SelectItem value="good">Good</SelectItem>
                            <SelectItem value="fair">Fair</SelectItem>
                            <SelectItem value="needs_repair">Needs Repair</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Purchase Price & Delete */}
                      <div className="col-span-1 sm:col-span-1 flex items-center gap-1">
                        <Input
                          type="number"
                          placeholder="₹ Price *"
                          value={row.purchase_price || ""}
                          onChange={(e) => updateRow(index, "purchase_price", Number(e.target.value))}
                          className="h-8 text-xs font-bold text-gray-900"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeRow(index)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Sub-bar: Accessories Checkboxes (Bill, Box, Charger) + Features field */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t text-xs bg-slate-50/70 p-2 rounded">
                      {/* Bill / Box / Charger Checkboxes */}
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-gray-700 text-[11px] uppercase tracking-wide">Included:</span>
                        <label className="flex items-center gap-1.5 cursor-pointer text-gray-700 select-none">
                          <Checkbox
                            checked={row.bill_available}
                            onCheckedChange={(c) => updateRow(index, "bill_available", !!c)}
                          />
                          <span>Bill</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-gray-700 select-none">
                          <Checkbox
                            checked={row.box_available}
                            onCheckedChange={(c) => updateRow(index, "box_available", !!c)}
                          />
                          <span>Box</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-gray-700 select-none">
                          <Checkbox
                            checked={row.charger_available}
                            onCheckedChange={(c) => updateRow(index, "charger_available", !!c)}
                          />
                          <span>Charger</span>
                        </label>
                      </div>

                      {/* Features input with quick-add chips */}
                      <div className="flex items-center gap-1.5 flex-1 max-w-lg min-w-[260px]">
                        <span className="font-semibold text-gray-700 text-[11px] uppercase tracking-wide shrink-0">Features:</span>
                        <Input
                          placeholder="e.g. All Original, Battery 88%, TrueTone (Shows on Homepage)"
                          value={row.features || ""}
                          onChange={(e) => updateRow(index, "features", e.target.value)}
                          className="h-7 text-xs bg-white font-medium"
                        />
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const current = row.features ? row.features.split(",").map(f => f.trim()) : [];
                              if (!current.includes("All Original")) {
                                updateRow(index, "features", [...current, "All Original"].join(", "));
                              }
                            }}
                            className="text-[10px] bg-emerald-100 text-emerald-800 hover:bg-emerald-200 px-1.5 py-0.5 rounded font-medium transition-colors"
                            title="Add 'All Original' tag for homepage"
                          >
                            + All Original
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const current = row.features ? row.features.split(",").map(f => f.trim()) : [];
                              if (!current.includes("100% Genuine")) {
                                updateRow(index, "features", [...current, "100% Genuine"].join(", "));
                              }
                            }}
                            className="text-[10px] bg-sky-100 text-sky-800 hover:bg-sky-200 px-1.5 py-0.5 rounded font-medium transition-colors"
                          >
                            + Genuine
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Batch Totals & Footer Info */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-sky-50/50 rounded-lg border border-sky-100">
              <div className="text-xs text-gray-600">
                <span>Total Items: <strong>{phoneRows.length} phones</strong></span> • 
                <span className="ml-2">All phones will be marked as <Badge className="bg-sky-100 text-sky-800 border-sky-200 text-[10px] ml-1">🏢 B2B Dealer Stock</Badge></span>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-500 mr-2">Total Batch Amount:</span>
                <span className="text-lg font-bold text-sky-900">
                  ₹{totalBatchAmount.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>
        )}

        {!createdBatch && (
          <DialogFooter className="border-t pt-3 flex flex-col sm:flex-row items-center justify-between gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={addRow} className="gap-1 border-dashed">
                <Plus className="h-4 w-4" /> Add Row
              </Button>
              <Button
                onClick={() => purchaseMutation.mutate()}
                disabled={purchaseMutation.isPending || !selectedDealerId}
                className="bg-sky-600 hover:bg-sky-700 text-white min-w-[200px]"
              >
                {purchaseMutation.isPending ? "Processing Batch..." : `Submit Batch (${phoneRows.length} Phones)`}
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>

    {/* IMEI Scanner & OCR Modal for Batch Phone Row */}
    {scanningRowIndex !== null && (
      <Dialog
        open={scanningRowIndex !== null}
        onOpenChange={(o) => {
          if (!o) setScanningRowIndex(null);
        }}
      >
        <DialogContent className="max-w-md z-[100]">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-sky-800">
              <ScanLine className="h-4 w-4 text-sky-600" />
              Scan IMEI for Batch Row #{scanningRowIndex + 1}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 flex flex-col items-center justify-center min-h-[160px] gap-3">
            <ImeiScanButton
              onResult={(res) => {
                const targetIdx = scanningRowIndex;
                setScanningRowIndex(null);
                if (targetIdx !== null) {
                  handleImeiChange(targetIdx, res.imei);
                  toast.success(`IMEI Scanned: ${res.imei}`);
                }
              }}
            />
            <p className="text-xs text-muted-foreground text-center max-w-xs">
              Barcode scan karein ya box/sticker ki photo le kar OCR se IMEI extract karein. TAC database specs auto-fill kar dega.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    )}
    </>
  );
};

export default DealerBatchPurchaseDialog;

