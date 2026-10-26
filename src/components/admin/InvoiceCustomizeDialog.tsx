/**
 * InvoiceCustomizeDialog - pops up before an invoice is generated and lets the
 * user pick:
 *
 *  1. WHICH photos to embed: none / product photos / purchase documents /
 *     both (sales invoices additionally offer the sale documents).
 *  2. WHICH of the three invoice designs to print. The designs are real layout
 *     variants (see src/lib/invoiceTemplates.ts), not colour themes:
 *       - Heritage  : centred black & gold letterhead bill
 *       - Ledger    : fully ruled grid, Tally-style accounting print
 *       - Receipt   : narrow 74 mm walk-in / thermal bill
 *  3. WHO the invoice is for: normal sale, or a one-time BROKER invoice for a
 *     higher amount. A broker invoice is view-only (HTML/PDF) - it never
 *     touches accounting: selling_price, profit and dashboards are untouched.
 *
 * The dialog emits an InvoiceCustomization the caller feeds into the shared
 * template engine; nothing in the database changes here.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Camera, FileText, Layers, Receipt, User, UserCog, ShieldCheck, Eye, Printer, Send } from "lucide-react";
import {
  DEFAULT_INVOICE_STYLE,
  INVOICE_STYLES,
  type InvoiceCustomization,
  type InvoiceKind,
  type InvoicePhotoChoice,
  type InvoiceStyle,
} from "@/lib/invoiceTemplates";

export type { InvoiceKind, InvoicePhotoChoice, InvoiceStyle, InvoiceCustomization };

interface InvoiceCustomizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: InvoiceKind;
  /** counts drive which photo options are enabled */
  productCount: number;
  purchaseCount: number;
  saleCount?: number;
  /** sale price of the phone (invoice amount the real sale carries) */
  baseAmount: number;
  onGenerate: (c: InvoiceCustomization) => void;
}

/** Mini layout mock shown next to each design so the choice is obvious. */
const StylePreview = ({ style }: { style: InvoiceStyle }) => {
  if (style === "ledger") {
    return (
      <span className="flex h-12 w-14 shrink-0 flex-col border-2 border-gray-800 bg-white">
        <span className="h-2 border-b-2 border-gray-800 bg-gray-100" />
        <span className="grid flex-1 grid-cols-2">
          <span className="border-r border-b border-gray-400" />
          <span className="border-b border-gray-400" />
          <span className="border-r border-gray-400" />
          <span />
        </span>
        <span className="h-2 bg-gray-800" />
      </span>
    );
  }
  if (style === "receipt") {
    return (
      <span className="flex h-12 w-14 shrink-0 justify-center">
        <span className="flex w-7 flex-col items-center gap-1 border border-dashed border-gray-500 bg-white p-1">
          <span className="h-1 w-4 bg-gray-800" />
          <span className="h-px w-full bg-gray-400" />
          <span className="h-1 w-full bg-gray-300" />
          <span className="h-1 w-full bg-gray-300" />
          <span className="mt-auto h-1.5 w-full bg-gray-800" />
        </span>
      </span>
    );
  }
  if (style === "luxury") {
    return (
      <span className="flex h-12 w-14 shrink-0 flex-col gap-0.5 rounded border border-amber-500/40 bg-[#0c0d10] p-1">
        <span className="h-1.5 w-7 rounded-sm bg-amber-400/80" />
        <span className="h-1 w-full rounded-sm bg-gray-600" />
        <span className="mt-0.5 h-1 w-full rounded-sm bg-gray-700" />
        <span className="mt-auto h-2 w-full rounded-sm border border-amber-500/60 bg-[#17181d]" />
      </span>
    );
  }
  return (
    <span className="flex h-12 w-14 shrink-0 flex-col border border-gray-300 bg-white">
      <span className="flex h-3 items-center justify-center border-b-2 border-amber-600">
        <span className="h-1 w-6 bg-gray-800" />
      </span>
      <span className="h-2.5 bg-gray-800" />
      <span className="mt-1 space-y-1 px-1">
        <span className="block h-1 w-full bg-gray-200" />
        <span className="block h-1 w-3/4 bg-gray-200" />
      </span>
      <span className="mt-auto h-2 w-full bg-amber-600/80" />
    </span>
  );
};

export const InvoiceCustomizeDialog = ({
  open,
  onOpenChange,
  kind,
  productCount,
  purchaseCount,
  saleCount = 0,
  baseAmount,
  onGenerate,
}: InvoiceCustomizeDialogProps) => {
  const [photos, setPhotos] = useState<InvoicePhotoChoice>(kind === "sale" ? "product" : "both");
  const [style, setStyle] = useState<InvoiceStyle>(DEFAULT_INVOICE_STYLE);
  const [broker, setBroker] = useState(false);
  const [brokerAmount, setBrokerAmount] = useState("");
  const [brokerName, setBrokerName] = useState("");
  const [includeSapathPatra, setIncludeSapathPatra] = useState(false);

  useEffect(() => {
    if (open) {
      setPhotos(kind === "sale" && saleCount > 0 ? "product" : productCount > 0 || purchaseCount > 0 ? "both" : "none");
      setStyle(DEFAULT_INVOICE_STYLE);
      setBroker(false);
      setBrokerAmount("");
      setBrokerName("");
      setIncludeSapathPatra(false);
    }
  }, [open, kind, productCount, purchaseCount, saleCount]);

  const handleSubmit = (action: "pdf" | "preview" | "whatsapp" = "pdf") => {
    if (broker) {
      const amt = parseFloat(brokerAmount);
      if (!brokerAmount || Number.isNaN(amt) || amt <= 0) {
        toast.error("Enter a valid broker invoice amount");
        return;
      }
      if (kind !== "sale") {
        toast.error("Broker invoices apply to sales only");
        return;
      }
      onGenerate({ photos, style, broker: true, brokerAmount: amt, brokerName: brokerName.trim(), includeSapathPatra, action });
    } else {
      onGenerate({ photos, style, broker: false, brokerAmount: 0, brokerName: "", includeSapathPatra, action });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Customize Invoice
          </DialogTitle>
          <DialogDescription>
            Choose what goes on this {kind === "sale" ? "sales" : "purchase"} invoice, the design, and whether it is a broker copy.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* 1) Photos to embed */}
          <div>
            <Label className="text-sm font-semibold flex items-center gap-2 mb-2">
              <Camera className="h-4 w-4" />
              Include which pictures?
            </Label>
            <RadioGroup value={photos} onValueChange={(v) => setPhotos(v as InvoicePhotoChoice)} className="grid grid-cols-1 gap-2">
              {(
                [
                  { value: "none", label: "No pictures", hint: "Text-only invoice", disabled: false },
                  { value: "product", label: "Product photos", hint: `${productCount} available`, disabled: productCount === 0 },
                  { value: "purchase", label: "Documents", hint: kind === "sale" ? `${saleCount} sale docs` : `${purchaseCount} purchase docs`, disabled: (kind === "sale" ? saleCount : purchaseCount) === 0 },
                  { value: "both", label: "Product + documents", hint: "Everything available", disabled: productCount === 0 && (kind === "sale" ? saleCount : purchaseCount) === 0 },
                ] as Array<{ value: InvoicePhotoChoice; label: string; hint: string; disabled: boolean }>
              ).map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-3 rounded-lg border p-3 ${opt.disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-gray-50"}`}
                >
                  <RadioGroupItem value={opt.value} disabled={opt.disabled} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium">{opt.label}</span>
                    <span className="block text-xs text-gray-500">{opt.hint}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* 2) Invoice design */}
          <div>
            <Label className="text-sm font-semibold flex items-center gap-2 mb-2">
              <Receipt className="h-4 w-4" />
              Invoice design
            </Label>
            <RadioGroup value={style} onValueChange={(v) => setStyle(v as InvoiceStyle)} className="grid grid-cols-1 gap-2">
              {INVOICE_STYLES.map((opt) => (
                <label key={opt.id} className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-gray-50">
                  <RadioGroupItem value={opt.id} />
                  <StylePreview style={opt.id} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium">{opt.label}</span>
                    <span className="block text-xs text-gray-500">{opt.hint}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* 3) Sapath Patra option (purchase only) */}
          {kind === "purchase" && (
            <div className="border rounded-lg p-3 bg-blue-50/50">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSapathPatra}
                  onChange={(e) => setIncludeSapathPatra(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-blue-900 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                    Include Sapath Patra (शपथ पत्र साथ जोड़ें)
                  </span>
                  <span className="block text-xs text-blue-700 mt-0.5">
                    इनवॉइस के साथ 8 धाराओं वाला कानूनी शपथ पत्र (Declaration &amp; Undertaking) संलग्न होकर प्रिंट / शेयर होगा।
                  </span>
                </span>
              </label>
            </div>
          )}

          {/* 4) Broker option (sales only) */}
          {kind === "sale" && (
            <div>
              <Label className="text-sm font-semibold flex items-center gap-2 mb-2">
                <UserCog className="h-4 w-4" />
                Broker invoice (optional)
              </Label>
              <label className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={broker}
                  onChange={(e) => setBroker(e.target.checked)}
                  className="h-4 w-4"
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium">Generate a broker copy</span>
                  <span className="block text-xs text-gray-500">
                    Same invoice at a custom amount - the real sale &amp; accounts stay unchanged.
                  </span>
                </span>
              </label>

              {broker && (
                <div className="mt-3 space-y-3 border rounded-lg p-3 bg-amber-50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="broker_amount" className="text-xs">Invoice amount (₹) *</Label>
                      <Input
                        id="broker_amount"
                        type="number"
                        min="1"
                        placeholder="e.g. 45000"
                        value={brokerAmount}
                        onChange={(e) => setBrokerAmount(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="broker_name" className="text-xs">Broker name</Label>
                      <Input
                        id="broker_name"
                        placeholder="Optional"
                        value={brokerName}
                        onChange={(e) => setBrokerName(e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 flex items-start gap-1">
                    <User className="h-3 w-3 mt-0.5 shrink-0" />
                    Real sale: ₹{baseAmount}. The broker invoice will show ₹{brokerAmount || "0"}
                    {" "}(diff ₹{(() => { const a = parseFloat(brokerAmount); return Number.isFinite(a) ? (a - baseAmount).toLocaleString() : "-"; })()})
                    - nothing is written to your accounts.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSubmit("preview")}
              className="border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              <Eye className="h-4 w-4 mr-1.5" />
              Preview
            </Button>
            <Button
              type="button"
              onClick={() => handleSubmit("pdf")}
              className="bg-gray-900 text-white hover:bg-black"
            >
              <Printer className="h-4 w-4 mr-1.5" />
              Print / PDF
            </Button>
            <Button
              type="button"
              onClick={() => handleSubmit("whatsapp")}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <Send className="h-4 w-4 mr-1.5" />
              WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceCustomizeDialog;
