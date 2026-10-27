import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Users,
  Phone,
  MessageSquare,
  Wrench,
  Smartphone,
  AlertTriangle,
  CheckCircle2,
  Receipt,
  FileText,
  RotateCcw,
  IndianRupee,
  Clock,
  ShieldCheck,
  Send,
  Loader2,
  DollarSign
} from "lucide-react";
import { toast } from "sonner";

interface RepairCustomerOverviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: any | null;
  history: any[];
  isLoading: boolean;
  onOpenJobDetail: (jobId: string) => void;
  onOpenJobDoc: (job: any, type: "jobsheet" | "invoice") => void;
  onRequestRework: (job: any) => void;
  onRefresh: () => void;
}

export const RepairCustomerOverviewDialog: React.FC<RepairCustomerOverviewDialogProps> = ({
  open,
  onOpenChange,
  customer,
  history,
  isLoading,
  onOpenJobDetail,
  onOpenJobDoc,
  onRequestRework,
  onRefresh,
}) => {
  const [paymentModalJob, setPaymentModalJob] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState<string>("");
  const [payMethod, setPayMethod] = useState<string>("cash");
  const [payNote, setPayNote] = useState<string>("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);

  if (!customer) return null;

  // Calculate customer lifetime ledger
  const totalRepairs = history.length;
  const totalBilled = history.reduce((sum, j) => sum + (Number(j.total_price) || 0), 0);
  const totalPaid = history.reduce((sum, j) => sum + (Number(j.paid_amount) || 0), 0);
  const totalBalanceDue = history.reduce((sum, j) => sum + (Number(j.balance_due) || 0), 0);
  const activeInWorkshop = history.filter((j) =>
    ["received", "diagnosing", "waiting_parts", "in_progress", "ready"].includes(j.status)
  ).length;

  const handleOpenPayment = (job: any) => {
    setPaymentModalJob(job);
    setPayAmount(String(job.balance_due || 0));
    setPayMethod("cash");
    setPayNote("Balance settlement");
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalJob) return;
    const amount = Number(payAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid payment amount greater than ₹0.");
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const res = await fetch(`/api/repair/jobs/${paymentModalJob.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          payment_method: payMethod,
          note: payNote.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to record payment.");
      }

      toast.success(`Payment of ₹${amount.toLocaleString("en-IN")} recorded successfully!`);
      setPaymentModalJob(null);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Could not record payment.");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "received":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-[10px]">Received</Badge>;
      case "diagnosing":
        return <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-[10px]">Diagnosing</Badge>;
      case "waiting_parts":
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-[10px]">Waiting Parts</Badge>;
      case "in_progress":
        return <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 text-[10px]">In Progress</Badge>;
      case "ready":
        return <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 text-[10px]">Ready</Badge>;
      case "delivered":
        return <Badge className="bg-green-600 text-white text-[10px]">Delivered</Badge>;
      case "cancelled":
        return <Badge variant="destructive" className="text-[10px]">Cancelled</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="border-b pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg shrink-0">
                  {customer.name?.charAt(0)?.toUpperCase() || "C"}
                </div>
                <div>
                  <DialogTitle className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                    {customer.name}
                    {customer.id_proof_type && (
                      <Badge variant="outline" className="text-[10px] bg-slate-50 font-normal">
                        {customer.id_proof_type.toUpperCase()}: {customer.id_number || "Verified"}
                      </Badge>
                    )}
                  </DialogTitle>
                  <div className="text-xs text-gray-500 flex flex-wrap items-center gap-2 mt-0.5">
                    <span className="font-mono text-gray-700 font-semibold">📱 +91 {customer.phone}</span>
                    {customer.alternate_phone && (
                      <span className="font-mono text-gray-500">| Alt: {customer.alternate_phone}</span>
                    )}
                    <span>•</span>
                    <span>📍 {customer.address || "Address not specified"}</span>
                  </div>
                </div>
              </div>

              {/* Direct Quick Contact Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => {
                    if (customer.phone) {
                      window.open(`https://wa.me/91${customer.phone.replace(/\D/g, "")}`, "_blank");
                    }
                  }}
                >
                  <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                  onClick={() => {
                    if (customer.phone) window.open(`tel:${customer.phone}`, "_self");
                  }}
                >
                  <Phone className="h-3.5 w-3.5" /> Call
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Customer Lifetime Accounting Ledger Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2">
            <Card className="bg-slate-50/80 border-slate-200">
              <CardContent className="p-3">
                <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                  Total Devices Repaired
                </div>
                <div className="text-xl font-bold text-gray-900 mt-1 flex items-center gap-1.5">
                  <Smartphone className="h-5 w-5 text-indigo-600" />
                  {totalRepairs} {totalRepairs === 1 ? "Job" : "Jobs"}
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  {activeInWorkshop > 0 ? `${activeInWorkshop} active in workshop` : "All jobs completed"}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-50/80 border-slate-200">
              <CardContent className="p-3">
                <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                  Total Repair Billed
                </div>
                <div className="text-xl font-bold text-gray-900 mt-1">
                  ₹{totalBilled.toLocaleString("en-IN")}
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  Estimated &amp; finalized charges
                </div>
              </CardContent>
            </Card>

            <Card className="bg-emerald-50/60 border-emerald-200">
              <CardContent className="p-3">
                <div className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wide">
                  Total Amount Received
                </div>
                <div className="text-xl font-bold text-emerald-700 mt-1">
                  ₹{totalPaid.toLocaleString("en-IN")}
                </div>
                <div className="text-[10px] text-emerald-600 mt-0.5">
                  Advances &amp; settlements paid
                </div>
              </CardContent>
            </Card>

            <Card className={totalBalanceDue > 0 ? "bg-rose-50/70 border-rose-200" : "bg-emerald-50/50 border-emerald-200"}>
              <CardContent className="p-3">
                <div className={`text-[11px] font-semibold uppercase tracking-wide ${totalBalanceDue > 0 ? "text-rose-800" : "text-emerald-800"}`}>
                  Outstanding Balance Due
                </div>
                <div className={`text-xl font-bold mt-1 ${totalBalanceDue > 0 ? "text-rose-600" : "text-emerald-700"}`}>
                  {totalBalanceDue > 0 ? `₹${totalBalanceDue.toLocaleString("en-IN")}` : "₹0 (Nil Balance)"}
                </div>
                <div className="text-[10px] mt-0.5">
                  {totalBalanceDue > 0 ? (
                    <span className="text-rose-600 font-semibold">⚠️ Pending Payment Due</span>
                  ) : (
                    <span className="text-emerald-600 font-medium">✓ All accounts clear</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* All Devices & Repairs History */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                <Wrench className="h-4 w-4 text-indigo-600" />
                Device Repair History ({history.length})
              </h3>
              <span className="text-xs text-gray-500">
                Click any job for full technician log, invoice, or status
              </span>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-xs text-gray-500">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-600 mb-2" />
                Loading repair history...
              </div>
            ) : history.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500 border rounded-lg bg-gray-50">
                No past repair records found for this customer.
              </div>
            ) : (
              <div className="space-y-2.5">
                {history.map((job) => {
                  const balance = Number(job.balance_due || 0);
                  const isPaid = job.is_fully_paid || balance <= 0;

                  return (
                    <div
                      key={job.id}
                      className="border rounded-lg p-3.5 bg-white hover:border-indigo-300 transition-all shadow-sm space-y-2.5"
                    >
                      {/* Top Bar: Job No, Status, Device, Date */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-gray-900 font-mono">
                            {job.job_no}
                          </span>
                          {job.is_rework === 1 && (
                            <Badge className="bg-amber-600 text-white text-[10px]">REWORK</Badge>
                          )}
                          {getStatusBadge(job.status)}
                          <span className="text-xs font-semibold text-gray-800 flex items-center gap-1">
                            <Smartphone className="h-3.5 w-3.5 text-gray-500" />
                            {job.device_brand} {job.device_model}
                          </span>
                          <span className="text-xs font-mono text-gray-500">
                            (IMEI: {job.imei || "NO IMEI"})
                          </span>
                        </div>

                        <div className="text-xs text-gray-500 flex items-center gap-2">
                          <span>
                            Logged: {new Date(job.created_at).toLocaleDateString("en-IN")}
                          </span>
                          {job.delivered_at && (
                            <span className="text-emerald-700 font-medium">
                              • Delivered: {new Date(job.delivered_at).toLocaleDateString("en-IN")}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Middle Details: Problem & Commercials */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
                        <div className="sm:col-span-7 space-y-1">
                          <div className="text-gray-700">
                            <strong>Problem / Fault:</strong> {job.problem}
                          </div>
                          {job.rework_notes && (
                            <div className="text-amber-800 bg-amber-50 p-1 rounded text-[11px]">
                              <strong>Rework Complaint:</strong> {job.rework_notes}
                            </div>
                          )}
                          {job.technician && (
                            <div className="text-gray-500 text-[11px]">
                              Tech: {job.technician}
                            </div>
                          )}
                        </div>

                        {/* Commercial Breakdown & Ledger for this job */}
                        <div className="sm:col-span-5 bg-slate-50 p-2.5 rounded border space-y-1 text-right">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Repair Cost:</span>
                            <span className="font-bold text-gray-900">
                              ₹{Number(job.total_price).toLocaleString("en-IN")}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Amount Paid:</span>
                            <span className="font-semibold text-emerald-700">
                              ₹{Number(job.paid_amount).toLocaleString("en-IN")}
                            </span>
                          </div>
                          <div className="flex justify-between border-t pt-1">
                            <span className="font-semibold text-gray-700">Balance:</span>
                            <span className={`font-bold ${balance > 0 ? "text-rose-600" : "text-emerald-700"}`}>
                              {balance > 0 ? `₹${balance.toLocaleString("en-IN")} (Due)` : "₹0 (Nil Balance)"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Bar for this Job */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* If balance is pending, show Collect Payment button! */}
                          {balance > 0 && (
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold gap-1"
                              onClick={() => handleOpenPayment(job)}
                            >
                              <DollarSign className="h-3 w-3" /> Collect Balance (₹{balance.toLocaleString("en-IN")})
                            </Button>
                          )}
                          {isPaid && (
                            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300">
                              ✓ Paid in Full (Nil Due)
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1 border-slate-300 hover:bg-slate-50"
                            onClick={() => {
                              onOpenChange(false);
                              onOpenJobDetail(job.id);
                            }}
                          >
                            <FileText className="h-3 w-3" /> Job Details
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                            onClick={() => {
                              onOpenChange(false);
                              onOpenJobDoc(job, job.status === "delivered" ? "invoice" : "jobsheet");
                            }}
                          >
                            <Receipt className="h-3 w-3" /> Job Sheet / Invoice
                          </Button>

                          {job.status === "delivered" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1 border-amber-300 text-amber-800 hover:bg-amber-50"
                              onClick={() => {
                                onOpenChange(false);
                                onRequestRework(job);
                              }}
                              title="Claim warranty rework on this delivered job"
                            >
                              <RotateCcw className="h-3 w-3" /> Rework Claim
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-3 flex justify-end">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-xs">
              Close Overview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Collect Balance / Record Payment Mini-Dialog */}
      {paymentModalJob && (
        <Dialog open={!!paymentModalJob} onOpenChange={(o) => { if (!o) setPaymentModalJob(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-600" />
                Collect Payment &amp; Settle Balance
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                Record customer payment against Job #{paymentModalJob.job_no} ({paymentModalJob.device_brand} {paymentModalJob.device_model}).
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmitPayment} className="space-y-3 py-2 text-xs">
              <div className="bg-slate-50 p-3 rounded border space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Repair Charge:</span>
                  <span className="font-bold text-gray-900">₹{Number(paymentModalJob.total_price).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Already Paid:</span>
                  <span className="text-emerald-700 font-semibold">₹{Number(paymentModalJob.paid_amount).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between border-t pt-1">
                  <span className="font-semibold text-rose-700">Remaining Balance:</span>
                  <span className="font-bold text-rose-600">₹{Number(paymentModalJob.balance_due).toLocaleString("en-IN")}</span>
                </div>
              </div>

              <div>
                <Label htmlFor="pay-amt" className="text-xs font-semibold text-gray-700">
                  Payment Amount to Collect (₹) *
                </Label>
                <Input
                  id="pay-amt"
                  type="number"
                  min="1"
                  max={paymentModalJob.balance_due || undefined}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="mt-1 h-9 font-bold text-base text-gray-900"
                  required
                  autoFocus
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Default is full balance ₹{paymentModalJob.balance_due}. Change if customer is paying partial.
                </p>
              </div>

              <div>
                <Label htmlFor="pay-method" className="text-xs font-semibold text-gray-700">
                  Payment Mode
                </Label>
                <select
                  id="pay-method"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full mt-1 h-9 text-xs border rounded-md px-2 bg-white"
                >
                  <option value="cash">Cash (नकद)</option>
                  <option value="upi">UPI / GPay / PhonePe / Paytm</option>
                  <option value="card">Debit / Credit Card</option>
                  <option value="bank">Bank Transfer / IMPS</option>
                </select>
              </div>

              <div>
                <Label htmlFor="pay-note" className="text-xs font-semibold text-gray-700">
                  Note / Remarks (Optional)
                </Label>
                <Input
                  id="pay-note"
                  placeholder="e.g. Paid at pickup counter"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  className="mt-1 h-8 text-xs"
                />
              </div>

              <DialogFooter className="pt-2 border-t flex flex-col sm:flex-row items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPaymentModalJob(null)}
                  disabled={isSubmittingPayment}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingPayment || !payAmount}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[140px] text-xs h-9 font-bold"
                >
                  {isSubmittingPayment ? "Recording..." : `Confirm ₹${Number(payAmount || 0).toLocaleString("en-IN")} Payment`}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default RepairCustomerOverviewDialog;

