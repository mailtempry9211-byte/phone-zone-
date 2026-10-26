import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Phone, ShoppingCart, RotateCcw, FileText } from "lucide-react";
import { getImeiHistory, type ImeiHistory } from "@/lib/data/financialYear";

/**
 * Full cross-year report for one IMEI - who it was bought from, for how much,
 * whether/when it was sold, to whom, and any returns - without changing year.
 */
interface ImeiHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imei: string;
}

const rupees = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const ImeiHistoryDialog = ({ open, onOpenChange, imei }: ImeiHistoryDialogProps) => {
  const [state, setState] = useState<ImeiHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !imei) return;
    setLoading(true);
    setError(null);
    getImeiHistory(imei)
      .then(setState)
      .catch((e) => setError((e as Error).message || "Could not load the report"))
      .finally(() => setLoading(false));
  }, [open, imei]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" /> IMEI history
          </DialogTitle>
          <DialogDescription className="font-mono break-all">{imei}</DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center gap-2 text-gray-500 py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading history...
          </div>
        )}
        {error && <p className="text-red-600 text-sm py-2">{error}</p>}

        {state && !loading && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-3">
              <div className="rounded-lg border p-3 flex-1 min-w-[130px]">
                <p className="text-xs text-gray-500">Purchased</p>
                <p className="font-semibold">{rupees(state.totals.purchased)}</p>
              </div>
              <div className="rounded-lg border p-3 flex-1 min-w-[130px]">
                <p className="text-xs text-gray-500">Sold</p>
                <p className="font-semibold">{rupees(state.totals.sold)}</p>
              </div>
              <div className="rounded-lg border p-3 flex-1 min-w-[130px]">
                <p className="text-xs text-gray-500">Returned</p>
                <p className="font-semibold">{rupees(state.totals.returned)}</p>
              </div>
            </div>

            {state.years.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500">Found in financial year(s):</span>
                {state.years.map((y) => (
                  <Badge key={y} variant="secondary">{y}</Badge>
                ))}
              </div>
            )}

            <section className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" /> Purchase{state.purchases.length === 1 ? "" : "s"}
              </h4>
              {state.purchases.length === 0 && <p className="text-sm text-gray-500">No purchase on record.</p>}
              {state.purchases.map((p) => (
                <div key={p.id} className="rounded-lg border p-3 text-sm space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{p.phoneName} {p.model}</span>
                    <span className="font-semibold">{rupees(p.amount)}</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Bought on {p.date || "-"}{p.paymentMethod ? ` · ${p.paymentMethod}` : ""}
                    {p.financialYear ? ` · FY ${p.financialYear}` : ""}{p.archived ? " · archived" : ""}
                  </p>
                  {p.seller && (
                    <p className="text-xs">
                      <span className="text-gray-500">Purchased from:</span>{" "}
                      <span className="font-medium">{p.seller.name}</span>
                      {p.seller.phone ? ` · ${p.seller.phone}` : ""}
                      {p.seller.address ? ` · ${p.seller.address}` : ""}
                      {p.seller.id_number ? ` · ${p.seller.id_proof_type || "ID"} ${p.seller.id_number}` : ""}
                    </p>
                  )}
                </div>
              ))}
            </section>

            <section className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Phone className="h-4 w-4" /> Sale{state.sales.length === 1 ? "" : "s"}
              </h4>
              {state.sales.length === 0 && <p className="text-sm text-gray-500">Not sold (or sale not recorded).</p>}
              {state.sales.map((s) => (
                <div key={s.id + (s.soldDate || "")} className="rounded-lg border p-3 text-sm space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{s.soldDate ? `Sold on ${s.soldDate}` : "Sale recorded"}</span>
                    <span className="font-semibold">{rupees(s.amount)}</span>
                  </div>
                  <p className="text-xs text-gray-500">{s.financialYear ? `FY ${s.financialYear}` : ""}{s.returned ? " · returned by customer" : ""}</p>
                  {s.customer && (
                    <p className="text-xs">
                      <span className="text-gray-500">Sold to:</span>{" "}
                      <span className="font-medium">{s.customer.name}</span>
                      {s.customer.phone ? ` · ${s.customer.phone}` : ""}
                      {s.customer.address ? ` · ${s.customer.address}` : ""}
                    </p>
                  )}
                </div>
              ))}
            </section>

            {state.returns.length > 0 && (
              <section className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <RotateCcw className="h-4 w-4" /> Returns
                </h4>
                {state.returns.map((r, i) => (
                  <div key={`${r.id}-${i}`} className="rounded-lg border p-3 text-sm">
                    <span className="font-medium">{r.return_type === "sales_return" ? "Sales return" : "Purchase return"}</span>
                    {" · "}{rupees(r.return_amount)} · {r.return_date || "-"}
                    {r.return_reason ? ` · ${r.return_reason}` : ""}
                    {r.financialYear ? ` · FY ${r.financialYear}` : ""}
                  </div>
                ))}
              </section>
            )}

            {state.invoices.length > 0 && (
              <section className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Invoices
                </h4>
                {state.invoices.map((inv, i) => (
                  <div key={`${inv.id}-${i}`} className="rounded-lg border p-2 text-xs flex items-center justify-between">
                    <span className="font-mono">{inv.invoice_number}</span>
                    <span>{inv.invoice_type} · {rupees(inv.amount)} · {inv.financialYear || "-"}</span>
                  </div>
                ))}
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ImeiHistoryDialog;
