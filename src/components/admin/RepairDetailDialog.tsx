import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Wrench,
  Printer,
  FileText,
  MessageSquare,
  Plus,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  RotateCcw,
  Send,
  Receipt,
  Sparkles,
} from "lucide-react";
import { buildJobSheetHtml, buildRepairInvoiceHtml } from "@/lib/repairTemplates";
import { printHtml } from "@/lib/printHtml";
import RepairShareModal, { type RepairShareMode } from "./RepairShareModal";
import RepairInvoiceModal, { type RepairDocType } from "./RepairInvoiceModal";

interface RepairDetailDialogProps {
  job: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
}

const STATUS_OPTIONS = [
  { value: "received", label: "Received", color: "bg-blue-100 text-blue-800" },
  { value: "diagnosing", label: "Diagnosing", color: "bg-purple-100 text-purple-800" },
  { value: "waiting_parts", label: "Waiting for Parts", color: "bg-amber-100 text-amber-800" },
  { value: "in_progress", label: "In Progress", color: "bg-indigo-100 text-indigo-800" },
  { value: "ready", label: "Ready for Delivery", color: "bg-emerald-100 text-emerald-800" },
  { value: "delivered", label: "Delivered", color: "bg-green-100 text-green-800" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-800" },
];

export const RepairDetailDialog: React.FC<RepairDetailDialogProps> = ({
  job,
  open,
  onOpenChange,
  onRefresh,
}) => {
  const { toast } = useToast();
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusNote, setStatusNote] = useState("");

  // Add Item state
  const [itemKind, setItemKind] = useState<"part" | "labour">("part");
  const [itemDesc, setItemDesc] = useState("");
  const [itemQty, setItemQty] = useState("1");
  const [itemPrice, setItemPrice] = useState("");
  const [isBoard, setIsBoard] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [reworkOpen, setReworkOpen] = useState(false);
  const [reworkReason, setReworkReason] = useState("");
  const [isSubmittingRework, setIsSubmittingRework] = useState(false);

  // WhatsApp Lifecycle Share Dialog & Multi-Design Document Center
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareMode, setShareMode] = useState<RepairShareMode>("ready");
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [docModalType, setDocModalType] = useState<RepairDocType>("invoice");
  const [pendingStatusPrompt, setPendingStatusPrompt] = useState<"ready" | "delivered" | null>(null);

  // Warranty inline edit
  const [isEditingWarranty, setIsEditingWarranty] = useState(false);
  const [editWarrantyDays, setEditWarrantyDays] = useState("30");
  const [savingWarranty, setSavingWarranty] = useState(false);

  if (!job) return null;

  const handleUpdateWarranty = async (newDays: number) => {
    setSavingWarranty(true);
    try {
      const res = await fetch(`/api/repair/jobs/${job.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warranty_days: newDays }),
      });
      if (!res.ok) throw new Error("Failed to update warranty");
      toast({
        title: "Warranty Updated",
        description: newDays > 0 ? `Service Warranty set to ${newDays} days.` : "Service Warranty turned OFF.",
      });
      setIsEditingWarranty(false);
      onRefresh();
    } catch (err: any) {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingWarranty(false);
    }
  };

  const handleCreateRework = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reworkReason.trim()) {
      toast({ title: "Rework reason required", description: "Please enter customer complaint or issue", variant: "destructive" });
      return;
    }
    setIsSubmittingRework(true);
    try {
      const res = await fetch(`/api/repair/jobs/${job.id}/rework`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reworkReason.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create rework job");
      }
      const newJob = await res.json();
      toast({ title: "Sent to Rework Workbench", description: `Rework Job created: ${newJob.job_no}` });
      setReworkOpen(false);
      setReworkReason("");
      onRefresh();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Rework failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmittingRework(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/repair/jobs/${job.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, note: statusNote.trim() || undefined }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      toast({ title: "Status Updated", description: `Job marked as ${newStatus}` });
      setStatusNote("");
      onRefresh();

      // Trigger automatic prompt & dialog for WhatsApp message on ready or delivered
      if (newStatus === "ready") {
        setPendingStatusPrompt("ready");
        setDocModalType("ready");
        setDocModalOpen(true);
      } else if (newStatus === "delivered") {
        setPendingStatusPrompt("delivered");
        setDocModalType("delivered");
        setDocModalOpen(true);
      }
    } catch (err: any) {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemDesc.trim()) {
      toast({ title: "Item description required", variant: "destructive" });
      return;
    }
    setAddingItem(true);
    try {
      const res = await fetch(`/api/repair/jobs/${job.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              kind: itemKind,
              description: itemDesc.trim(),
              qty: Number(itemQty) || 1,
              unit_price: Number(itemPrice) || 0,
              is_board: isBoard ? 1 : 0,
            },
          ],
        }),
      });
      if (!res.ok) throw new Error("Failed to add item");
      toast({ title: "Item Added", description: `${itemDesc} recorded.` });
      setItemDesc("");
      setItemPrice("");
      setIsBoard(false);
      onRefresh();
    } catch (err: any) {
      toast({ title: "Add item failed", description: err.message, variant: "destructive" });
    } finally {
      setAddingItem(false);
    }
  };

  const openPrintWindow = (html: string, _title: string) => {
    printHtml(html);
  };

  const handlePrintJobSheet = async () => {
    try {
      const settingsRes = await fetch("/api/settings");
      const settings = settingsRes.ok ? await settingsRes.json() : {};
      const html = buildJobSheetHtml({ job, settings });
      openPrintWindow(html, `Job Sheet - ${job.job_no}`);
    } catch {
      const html = buildJobSheetHtml({ job });
      openPrintWindow(html, `Job Sheet - ${job.job_no}`);
    }
  };

  const handlePrintInvoice = async () => {
    try {
      const settingsRes = await fetch("/api/settings");
      const settings = settingsRes.ok ? await settingsRes.json() : {};
      const html = buildRepairInvoiceHtml({ job, settings });
      openPrintWindow(html, `Repair Invoice - ${job.job_no}`);
    } catch {
      const html = buildRepairInvoiceHtml({ job });
      openPrintWindow(html, `Repair Invoice - ${job.job_no}`);
    }
  };

  const handleWhatsApp = async () => {
    const phone = (job.customer_phone || "").replace(/\D/g, "");
    if (!phone) {
      toast({ title: "No customer phone found", variant: "destructive" });
      return;
    }
    const target = phone.length === 10 ? `91${phone}` : phone;
    const msg = `Hello ${job.customer_name || "Customer"}, your device (${job.device_brand || ""} ${job.device_model || ""}) repair job ${job.job_no} status is currently: ${job.status.toUpperCase()}. Thank you!`;

    try {
      const res = await fetch("/api/wa/gateway/send-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: target, message: msg, channel: "repairs" }),
      });
      if (res.ok) {
        toast({ title: "WhatsApp Sent!", description: `Status update sent directly to ${target} via WhatsApp API.` });
        return;
      }
    } catch {
      // fallback to wa.me
    }
    window.open(`https://wa.me/${target}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-blue-600" />
              <DialogTitle className="text-xl font-bold">{job.job_no}</DialogTitle>
              <Badge className="text-xs uppercase">{job.status}</Badge>
              {job.board_replaced === 1 && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Motherboard Replaced
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                className="border-blue-300 text-blue-700 hover:bg-blue-50"
                onClick={() => {
                  setDocModalType("jobsheet");
                  setDocModalOpen(true);
                }}
              >
                <FileText className="w-4 h-4 mr-1 text-blue-600" />
                Job Sheet
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                onClick={() => {
                  setDocModalType("invoice");
                  setDocModalOpen(true);
                }}
              >
                <Receipt className="w-4 h-4 mr-1 text-emerald-600" />
                Invoice
              </Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => {
                  setDocModalType(job.status === "delivered" ? "delivered" : job.status === "ready" ? "ready" : "invoice");
                  setDocModalOpen(true);
                }}
              >
                <MessageSquare className="w-4 h-4 mr-1" />
                WhatsApp
              </Button>
              {job.status === "delivered" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-amber-700 border-amber-300 hover:bg-amber-50"
                  onClick={() => { setReworkOpen(true); setReworkReason(""); }}
                >
                  <RotateCcw className="w-4 h-4 mr-1.5" />
                  Return for Rework
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Content sections */}
        <div className="space-y-4 pt-2">
          {/* Section 1: Customer & Device summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 p-3 rounded-lg border text-sm">
            <div>
              <div className="font-semibold text-gray-700 mb-1">Customer</div>
              <div><b>Name:</b> {job.customer_name || "-"}</div>
              <div><b>Phone:</b> {job.customer_phone || "-"}</div>
              <div><b>Address:</b> {job.customer_address || "-"}</div>
            </div>
            <div>
              <div className="font-semibold text-gray-700 mb-1">Device & Issue</div>
              <div><b>Device:</b> {job.device_brand} {job.device_model}</div>
              <div><b>IMEI:</b> <span className="font-mono">{job.imei}</span></div>
              <div><b>Problem:</b> {job.problem}</div>
              {job.passcode_note && <div><b>Passcode:</b> {job.passcode_note}</div>}
              <div><b>Accessories:</b> {job.accessories_received || "None"}</div>
            </div>

            {/* Service Warranty Controls (Internal Tracking Only) */}
            <div className="sm:col-span-2 pt-2 border-t mt-1 flex flex-wrap items-center justify-between gap-2 bg-white p-2.5 rounded border">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700 text-xs">Internal Warranty (Shop Only):</span>
                {(() => {
                  const wDays = Number(job.warranty_days || 0);
                  if (wDays <= 0) {
                    return (
                      <Badge variant="outline" className="text-gray-500 border-gray-300 font-medium text-xs">
                        ❌ OFF (No Warranty)
                      </Badge>
                    );
                  }
                  const baseDate = new Date(job.delivered_at || job.updated_at || job.created_at);
                  const diffDays = Math.floor((Date.now() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
                  const daysRemaining = Math.max(0, wDays - diffDays);
                  return daysRemaining > 0 ? (
                    <Badge className="bg-blue-600 text-white font-semibold hover:bg-blue-700 text-xs shadow-xs">
                      🛡️ {daysRemaining} Days Active (of {wDays}d)
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-gray-500 border-gray-300 font-medium text-xs">
                      ⏱️ Expired ({wDays}d passed)
                    </Badge>
                  );
                })()}
              </div>

              {!isEditingWarranty ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                  onClick={() => {
                    setEditWarrantyDays(String(Number(job.warranty_days) > 0 ? job.warranty_days : 30));
                    setIsEditingWarranty(true);
                  }}
                >
                  Edit / Toggle Warranty
                </Button>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  {Number(job.warranty_days) > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-rose-300 text-rose-700 hover:bg-rose-50"
                      disabled={savingWarranty}
                      onClick={() => handleUpdateWarranty(0)}
                    >
                      Turn OFF
                    </Button>
                  )}

                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min="1"
                      className="w-20 h-7 text-xs bg-white"
                      placeholder="Days"
                      value={editWarrantyDays}
                      onChange={(e) => setEditWarrantyDays(e.target.value)}
                    />
                    <span className="text-xs text-gray-500">Days</span>
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={savingWarranty}
                      onClick={() => {
                        const days = Math.max(1, parseInt(editWarrantyDays, 10) || 30);
                        handleUpdateWarranty(days);
                      }}
                    >
                      Save ({editWarrantyDays || 30}d)
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => setIsEditingWarranty(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Move Status */}
          <div className="border rounded-lg p-3 bg-white space-y-2">
            <div className="font-semibold text-xs text-gray-600 uppercase tracking-wide">
              Update Repair Status
            </div>

            {/* Status Update Immediate Action Banner */}
            {pendingStatusPrompt && (
              <div className="bg-emerald-50 border border-emerald-300 p-3 rounded-lg flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-semibold text-emerald-900 text-xs">
                      {pendingStatusPrompt === "ready"
                        ? "📱 Device marked READY! Send pickup notification to customer?"
                        : "🎉 Device marked DELIVERED! Send Thank-You & 5-Star Review link?"}
                    </div>
                    <div className="text-[11px] text-emerald-700">
                      {pendingStatusPrompt === "ready"
                        ? "Send invoice PDF, total balance due, and store address directly to customer WhatsApp."
                        : "Ask for 5-star customer review, feedback, and provide service warranty confirmation."}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs font-semibold shadow-sm"
                    onClick={() => {
                      setDocModalType(pendingStatusPrompt);
                      setDocModalOpen(true);
                      setPendingStatusPrompt(null);
                    }}
                  >
                    <Send className="w-3.5 h-3.5 mr-1" />
                    Open WhatsApp Sender
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-gray-500 hover:text-gray-700"
                    onClick={() => setPendingStatusPrompt(null)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  size="sm"
                  variant={job.status === opt.value ? "default" : "outline"}
                  className={job.status === opt.value ? "bg-blue-600 text-white font-medium" : "text-xs"}
                  disabled={updatingStatus}
                  onClick={() => handleStatusChange(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Input
                placeholder="Optional status update note..."
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                className="text-xs h-8"
              />
            </div>
          </div>

          {/* Section 3: Parts & Labour items */}
          <div className="border rounded-lg p-3 bg-white space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <span className="font-semibold text-sm text-gray-800">Parts & Labour Breakdown</span>
              <span className="font-semibold text-sm text-emerald-700">
                Total: ₹{job.final_price || job.parts_cost + job.labour_cost || 0}
              </span>
            </div>

            {job.items && job.items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="p-2 border">Kind</th>
                      <th className="p-2 border">Description</th>
                      <th className="p-2 border text-center">Qty</th>
                      <th className="p-2 border text-right">Unit Price</th>
                      <th className="p-2 border text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {job.items.map((it: any) => (
                      <tr key={it.id} className="border-b">
                        <td className="p-2 border capitalize font-medium">{it.kind}</td>
                        <td className="p-2 border">
                          {it.description}
                          {it.is_board === 1 && (
                            <span className="ml-1 text-red-600 font-bold">[MOTHERBOARD]</span>
                          )}
                        </td>
                        <td className="p-2 border text-center">{it.qty}</td>
                        <td className="p-2 border text-right">₹{it.unit_price}</td>
                        <td className="p-2 border text-right font-medium">₹{it.unit_price * it.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-xs text-gray-500 italic py-1">No parts or labour logged yet.</div>
            )}

            {/* Add Item mini-form */}
            <form onSubmit={handleAddItem} className="pt-2 border-t space-y-2">
              <div className="text-xs font-semibold text-gray-700">Add Part / Labour Item</div>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
                <div>
                  <select
                    className="w-full h-8 border rounded px-1.5 bg-white text-xs"
                    value={itemKind}
                    onChange={(e: any) => setItemKind(e.target.value)}
                  >
                    <option value="part">Part</option>
                    <option value="labour">Labour</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <Input
                    placeholder="Description (e.g. Display Assembly)"
                    className="h-8 text-xs"
                    value={itemDesc}
                    onChange={(e) => setItemDesc(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Input
                    type="number"
                    placeholder="Price (₹)"
                    className="h-8 text-xs"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Button
                    type="submit"
                    size="sm"
                    className="w-full h-8 text-xs bg-blue-600 hover:bg-blue-700"
                    disabled={addingItem}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add
                  </Button>
                </div>
              </div>

              {itemKind === "part" && (
                <div className="flex items-center space-x-2 pt-1">
                  <Checkbox
                    id="chk-board"
                    checked={isBoard}
                    onCheckedChange={(c) => setIsBoard(!!c)}
                  />
                  <Label htmlFor="chk-board" className="text-xs text-red-600 font-semibold cursor-pointer">
                    This part is a Motherboard / Logic Board Replacement
                  </Label>
                </div>
              )}
            </form>
          </div>

          {/* Section 4: Status History Timeline */}
          {job.status_log && job.status_log.length > 0 && (
            <div className="border rounded-lg p-3 bg-gray-50 space-y-2 text-xs">
              <div className="font-semibold text-gray-700 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Status Timeline
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {job.status_log.map((log: any) => (
                  <div key={log.id} className="flex items-center justify-between bg-white p-1.5 rounded border">
                    <div>
                      <span className="font-semibold uppercase text-blue-700 mr-2">{log.status}</span>
                      <span className="text-gray-600">{log.note || ""}</span>
                    </div>
                    <span className="text-gray-400 text-[11px]">
                      {new Date(log.at).toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Rework Modal */}
          {reworkOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white rounded-lg p-5 max-w-md w-full shadow-2xl border space-y-3">
                <div className="flex items-center gap-2 text-amber-700 font-bold text-base">
                  <RotateCcw className="h-5 w-5" />
                  Return Device for Warranty Rework
                </div>
                <p className="text-xs text-gray-600">
                  Customer has brought back <strong>{job.device_brand} {job.device_model}</strong> ({job.job_no}) under warranty. Enter the repeat issue or customer complaint to create a priority Rework Job.
                </p>
                <form onSubmit={handleCreateRework} className="space-y-3 pt-1">
                  <div>
                    <Label htmlFor="rework_reason" className="text-xs font-semibold">
                      Customer Complaint / Reason for Return *
                    </Label>
                    <Input
                      id="rework_reason"
                      placeholder="e.g. Touch screen flickering or ghost touch after 2 days"
                      value={reworkReason}
                      onChange={(e) => setReworkReason(e.target.value)}
                      required
                      autoFocus
                      className="text-xs mt-1"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setReworkOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" disabled={isSubmittingRework} className="bg-amber-600 hover:bg-amber-700 text-white">
                      {isSubmittingRework ? "Creating Rework..." : "Confirm Rework Job"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Lifecycle WhatsApp Share Dialog */}
          <RepairShareModal
            open={shareModalOpen}
            onOpenChange={setShareModalOpen}
            job={job}
            mode={shareMode}
            onSuccess={() => onRefresh()}
          />
        </div>
      </DialogContent>

      {/* Repair Document & Invoice Center Dialog (Job Sheet / Invoice / Ready / Delivered) */}
      <RepairInvoiceModal
        open={docModalOpen}
        onOpenChange={setDocModalOpen}
        job={job}
        defaultDocType={docModalType}
        onSuccess={() => onRefresh()}
      />
    </Dialog>
  );
};

export default RepairDetailDialog;
