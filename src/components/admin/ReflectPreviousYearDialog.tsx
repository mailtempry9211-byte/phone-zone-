import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useFinancialYear } from "@/hooks/useFinancialYear";
import { carryForwardFinancialYear } from "@/lib/data/financialYear";
import { useQueryClient } from "@tanstack/react-query";

interface PromptDetail {
  fromYear?: string;
  toYear?: string;
  entityName?: string;
  action?: string;
}

export function ReflectPreviousYearDialog() {
  const { enabled, active, isPreviousYear, latestYear, refresh } = useFinancialYear();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<PromptDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<PromptDetail>;
      setDetail(customEvent.detail || {});
      setOpen(true);
    };

    window.addEventListener("phonezone:previous-year-change", handler);
    return () => window.removeEventListener("phonezone:previous-year-change", handler);
  }, []);

  if (!enabled || !isPreviousYear || !latestYear) return null;

  const fromFy = detail?.fromYear || active?.label || "";
  const toFy = detail?.toYear || latestYear || "";

  const handleReflect = async () => {
    if (!fromFy || !toFy) return;
    setLoading(true);
    try {
      const res = await carryForwardFinancialYear({ fromYear: fromFy, toYear: toFy });
      toast.success(
        `Changes reflected to FY ${toFy}! Carried ${res.phonesCarried} phone(s) and ${res.repairsCarried} repair job(s).`
      );
      setOpen(false);
      await refresh();
      await queryClient.invalidateQueries();
    } catch (err: any) {
      toast.error(err.message || "Could not carry forward changes to current year");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-600 font-semibold mb-1">
            <AlertTriangle className="h-5 w-5" />
            <span>Reflect Changes to Current Year?</span>
          </div>
          <DialogTitle className="text-base text-gray-900">
            Changes detected in FY {fromFy}
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600 pt-2">
            You just modified records in a previous financial year (<strong>{fromFy}</strong>).
            Would you like to carry forward and reflect these changes (stock, repair jobs &amp; balances) into the active financial year (<strong>{toFy}</strong>)?
          </DialogDescription>
        </DialogHeader>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 space-y-1 my-2">
          <p className="font-medium flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-amber-700" />
            Busy / Tally Style Carry Forward
          </p>
          <p>
            • Unsold phones will update in {toFy}&apos;s opening stock.<br />
            • Any pending repairs will stay available to technicians in {toFy}.<br />
            • If you choose &quot;Keep in {fromFy} Only&quot;, changes stay isolated in {fromFy}.
          </p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 mt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Keep in {fromFy} Only
          </Button>
          <Button
            type="button"
            className="bg-amber-600 hover:bg-amber-700 text-white w-full sm:w-auto"
            onClick={handleReflect}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-1.5" />}
            Reflect to {toFy}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

