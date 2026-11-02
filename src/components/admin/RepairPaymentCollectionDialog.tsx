import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { IndianRupee, CheckCircle2, CreditCard, Banknote, Smartphone } from "lucide-react";
import { toast } from "sonner";

interface RepairPaymentCollectionDialogProps {
  job: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (updatedJob: any) => void;
  isDelivering?: boolean;
}

export const RepairPaymentCollectionDialog: React.FC<RepairPaymentCollectionDialogProps> = ({
  job,
  open,
  onOpenChange,
  onSuccess,
  isDelivering = false,
}) => {
  const [amount, setAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [note, setNote] = useState<string>("");
  const [markDelivered, setMarkDelivered] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (job && open) {
      const finalPrice = Number(job.final_price || job.estimate || 0);
      const paid = Number(job.advance_paid || 0);
      const balance = Math.max(0, finalPrice - paid);
      setAmount(balance > 0 ? String(balance) : "0");
      setPaymentMethod("cash");
      setNote(isDelivering ? "Payment collected at delivery" : "Payment received");
      setMarkDelivered(job.status !== "delivered");
    }
  }, [job, open, isDelivering]);

  if (!job) return null;

  const totalAmount = Number(job.final_price || job.estimate || 0);
  const advancePaid = Number(job.advance_paid || 0);
  const currentBalance = Math.max(0, totalAmount - advancePaid);
  const numAmount = parseFloat(amount) || 0;
  const remainingAfterPayment = Math.max(0, currentBalance - numAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount < 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    setIsSubmitting(true);
    try {
      let updatedJob = job;

      // 1. Record payment if amount > 0
      if (numAmount > 0) {
        const payRes = await fetch(`/api/repair/jobs/${job.id}/payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            amount: numAmount,
            payment_method: paymentMethod,
            note: note.trim() || undefined,
          }),
        });

        if (!payRes.ok) {
          const err = await payRes.json().catch(() => ({}));
          throw new Error(err.error || "Failed to record payment");
        }
        updatedJob = await payRes.json();
      }

      // 2. If mark delivered is checked and not already delivered
      if (markDelivered && job.status !== "delivered") {
        const statusRes = await fetch(`/api/repair/jobs/${job.id}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            status: "delivered",
            note: `Delivered to customer. Paid: ₹${numAmount} (${paymentMethod.toUpperCase()}). Balance: ₹${remainingAfterPayment}`,
            payment_status: remainingAfterPayment <= 0 ? "paid" : "partial",
          }),
        });

        if (!statusRes.ok) {
          const err = await statusRes.json().catch(() => ({}));
          throw new Error(err.error || "Failed to mark as delivered");
        }
        updatedJob = await statusRes.json();
      }

      toast.success(
        numAmount > 0
          ? `Recorded payment of ₹${numAmount.toLocaleString("en-IN")}${markDelivered ? " & Marked Delivered" : ""}!`
          : "Job updated successfully!"
      );
      onSuccess(updatedJob);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to process payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-white p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <IndianRupee className="h-5 w-5 text-emerald-400" />
            {isDelivering || markDelivered ? "Delivery & Payment Collection" : "Collect Repair Payment"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Job & Customer Summary Card */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-mono font-bold text-indigo-600 dark:text-cyan-400">{job.job_no}</span>
              <span className="text-slate-600 dark:text-slate-400 font-semibold">{job.device_brand} {job.device_model}</span>
            </div>
            <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
              <span>Customer: <strong>{job.customer_name || "Walk-in"}</strong></span>
              <span className="font-mono">{job.customer_phone || "-"}</span>
            </div>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center font-semibold">
              <span className="text-slate-800 dark:text-slate-200">Total Bill: ₹{totalAmount.toLocaleString("en-IN")}</span>
              <span className="text-slate-500 dark:text-slate-400">Advance: ₹{advancePaid.toLocaleString("en-IN")}</span>
              <span className="text-amber-600 dark:text-amber-400 font-bold">Balance: ₹{currentBalance.toLocaleString("en-IN")}</span>
            </div>
          </div>

          {/* Amount to Collect Input */}
          <div className="space-y-1.5">
            <Label htmlFor="pay_amount" className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Amount Customer is Paying Now (₹) *
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-bold">₹</span>
              <Input
                id="pay_amount"
                type="number"
                step="any"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-8 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold text-base shadow-xs"
                required
              />
            </div>
            {remainingAfterPayment > 0 && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                Remaining customer balance: ₹{remainingAfterPayment.toLocaleString("en-IN")}
              </p>
            )}
            {remainingAfterPayment <= 0 && currentBalance > 0 && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Fully paid! Balance will become ₹0.
              </p>
            )}
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-1.5">
            <Label htmlFor="pay_method" className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Payment Mode
            </Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger id="pay_method" className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white shadow-xs">
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white">
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="upi">UPI / QR (GPay / PhonePe / Paytm)</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer / IMPS</SelectItem>
                <SelectItem value="card">Debit / Credit Card</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Note Input */}
          <div className="space-y-1.5">
            <Label htmlFor="pay_note" className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Note (Optional)
            </Label>
            <Input
              id="pay_note"
              type="text"
              placeholder="e.g. UPI Ref # or Received by counter"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs shadow-xs"
            />
          </div>

          {/* Checkbox: Mark as Delivered */}
          {job.status !== "delivered" && (
            <div className="flex items-center space-x-2 pt-1">
              <Checkbox
                id="mark_del"
                checked={markDelivered}
                onCheckedChange={(c) => setMarkDelivered(!!c)}
                className="border-slate-600 data-[state=checked]:bg-emerald-600"
              />
              <Label htmlFor="mark_del" className="text-xs font-semibold text-slate-200 cursor-pointer">
                Mark device as Delivered (Closed) & Handover to Customer
              </Label>
            </div>
          )}

          <DialogFooter className="pt-2 flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
            >
              {isSubmitting
                ? "Processing..."
                : markDelivered
                ? "Collect Payment & Deliver"
                : "Record Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
