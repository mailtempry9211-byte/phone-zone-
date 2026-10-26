import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CalendarRange, Check, Lock, Loader2, Plus, ArrowRight, RefreshCw, CheckCircle2 } from "lucide-react";
import { useFinancialYear } from "@/hooks/useFinancialYear";
import {
  activateFinancialYear,
  createFinancialYear,
  getNextFinancialYearLabel,
  carryForwardFinancialYear,
} from "@/lib/data/financialYear";

/**
 * Financial year switcher (Busy / Tally style).
 *
 * - Shows the year whose book is currently open.
 * - Switching to another year, or starting a new one, asks for the admin
 *   password (verified again on the backend).
 * - Switching only changes which book is shown; no data is moved or deleted.
 */
const FinancialYearSwitcher = () => {
  const { enabled, active, years, isPreviousYear, latestYear, refresh } = useFinancialYear();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [autoCarryForward, setAutoCarryForward] = useState(true);
  const [carrying, setCarrying] = useState(false);

  useEffect(() => {
    if (!newOpen) return;
    getNextFinancialYearLabel()
      .then((r) => setNewLabel(r.label))
      .catch(() => setNewLabel(""));
  }, [newOpen]);

  if (!enabled) return null;

  /** A year change re-scopes every list, so refetch the whole admin UI. */
  const reloadEverything = async () => {
    await refresh();
    await queryClient.invalidateQueries();
  };

  const handleSwitch = async (id: string) => {
    if (!password) {
      toast.error("Enter your admin password to change the year");
      return;
    }
    setBusyId(id);
    try {
      const state = await activateFinancialYear(id, password);
      toast.success(`Financial year ${state.active?.label} opened`);
      setPassword("");
      setOpen(false);
      await reloadEverything();
    } catch (e) {
      toast.error((e as Error).message || "Could not change the year");
    } finally {
      setBusyId(null);
    }
  };

  const handleCreate = async () => {
    if (!newPassword) {
      toast.error("Enter your admin password to start a new year");
      return;
    }
    setCreating(true);
    try {
      const state = await createFinancialYear({ label: newLabel, password: newPassword });
      toast.success(`New financial year ${state.active?.label} started`);
      if (autoCarryForward && active?.label) {
        try {
          const res = await carryForwardFinancialYear({ fromYear: active.label, toYear: newLabel });
          toast.success(`Carried forward ${res.phonesCarried} unsold phone(s) and ${res.repairsCarried} repair(s) into FY ${newLabel}`);
        } catch (_cfErr: any) {
          console.warn("Auto carry forward skipped:", _cfErr);
        }
      }
      setNewPassword("");
      setNewOpen(false);
      setOpen(false);
      await reloadEverything();
    } catch (e) {
      toast.error((e as Error).message || "Could not start the new year");
    } finally {
      setCreating(false);
    }
  };

  const handleManualCarryForward = async () => {
    if (!active?.label || !latestYear) return;
    setCarrying(true);
    try {
      const res = await carryForwardFinancialYear({ fromYear: active.label, toYear: latestYear });
      toast.success(`Reflected changes to FY ${latestYear}! Carried ${res.phonesCarried} phone(s) and ${res.repairsCarried} repair(s).`);
      await reloadEverything();
    } catch (e: any) {
      toast.error(e.message || "Failed to carry forward changes");
    } finally {
      setCarrying(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} title="Change financial year">
        <CalendarRange className="h-4 w-4 mr-2" />
        FY {active?.label || "-"}
      </Button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setPassword(""); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarRange className="h-5 w-5" /> Financial year
            </DialogTitle>
            <DialogDescription>
              Changing the year only changes which book is open. Nothing is deleted and nothing is
              carried forward from the old year - only customers and sellers stay available.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              {years.map((y) => (
                <div
                  key={y.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 ${y.isActive ? "border-green-500 bg-green-50" : ""}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{y.label}</span>
                      {y.isActive && (
                        <Badge className="bg-green-600 hover:bg-green-600">
                          <Check className="h-3 w-3 mr-1" /> Open
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {y.availablePhones ?? 0} in stock &middot; {y.soldPhones ?? 0} sold &middot; ₹
                      {(y.revenue ?? 0).toLocaleString()} revenue &middot; {y.startDate} → {y.endDate}
                    </p>
                  </div>
                  {!y.isActive && (
                    <Button size="sm" variant="outline" disabled={busyId === y.id} onClick={() => handleSwitch(y.id)}>
                      {busyId === y.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                      <span className="ml-1">Open</span>
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {isPreviousYear && latestYear && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-amber-900">
                    <span className="font-semibold">Operating in FY {active?.label}:</span>
                    <p className="text-[11px] text-amber-700">You can reflect unsold stock &amp; repairs into FY {latestYear}.</p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 text-xs bg-amber-600 text-white hover:bg-amber-700 shrink-0"
                    onClick={handleManualCarryForward}
                    disabled={carrying}
                  >
                    {carrying ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                    Reflect to {latestYear}
                  </Button>
                </div>
              </div>
            )}

            {!newOpen ? (
              <Button variant="secondary" className="w-full" onClick={() => setNewOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Start a new financial year
              </Button>
            ) : (
              <div className="rounded-lg border p-3 space-y-3 bg-amber-50">
                <p className="text-sm font-medium">Start a new year (fresh book)</p>
                <div>
                  <Label htmlFor="new_fy_label" className="text-xs">Financial year label</Label>
                  <Input
                    id="new_fy_label"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="e.g. 2027-28"
                  />
                </div>
                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="carry_forward_stock"
                    checked={autoCarryForward}
                    onChange={(e) => setAutoCarryForward(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                  <Label htmlFor="carry_forward_stock" className="text-xs cursor-pointer">
                    Carry forward closing unsold stock &amp; pending repairs (Tally / Busy style)
                  </Label>
                </div>
                <div>
                  <Label htmlFor="new_fy_pass" className="text-xs">Admin password *</Label>
                  <Input
                    id="new_fy_pass"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Confirm with your password"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setNewOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreate} disabled={creating}>
                    {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create &amp; open
                  </Button>
                </div>
              </div>
            )}

            <div className="rounded-lg border p-3 space-y-2">
              <Label htmlFor="fy_pass" className="text-xs flex items-center gap-1">
                <Lock className="h-3 w-3" /> Admin password (required to switch year)
              </Label>
              <Input
                id="fy_pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FinancialYearSwitcher;
