import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, Search, Smartphone, User, Calendar, ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface CreateReworkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  preselectedJob?: any | null;
}

export const CreateReworkDialog: React.FC<CreateReworkDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
  preselectedJob = null,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any | null>(preselectedJob);
  const [reworkReason, setReworkReason] = useState("");
  const [technician, setTechnician] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // When preselectedJob changes
  React.useEffect(() => {
    if (preselectedJob) {
      setSelectedJob(preselectedJob);
    }
  }, [preselectedJob]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error("Enter customer name, phone, IMEI, or job number to search.");
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/repair/jobs?search=${encodeURIComponent(searchQuery.trim())}`);
      if (res.ok) {
        const data = await res.json();
        // Allow rework on delivered, ready, or any completed jobs
        setSearchResults(Array.isArray(data) ? data : []);
        if (data.length === 0) {
          toast.info("No repair jobs found matching that query.");
        }
      }
    } catch {
      toast.error("Failed to search repair jobs.");
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) {
      toast.error("Please select a delivered repair job to create rework for.");
      return;
    }
    if (!reworkReason.trim()) {
      toast.error("Please enter customer complaint / reason for warranty rework.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/repair/jobs/${selectedJob.id}/rework`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reworkReason.trim(),
          technician: technician.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create rework job.");
      }

      const created = await res.json();
      toast.success(`Rework Ticket ${created.job_no} created successfully!`);
      if (onSuccess) onSuccess();
      onOpenChange(false);
      setSelectedJob(null);
      setReworkReason("");
      setSearchQuery("");
      setSearchResults([]);
    } catch (err: any) {
      toast.error(err.message || "Could not create rework job.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-amber-800">
            <RotateCcw className="h-5 w-5 text-amber-600" />
            Create Rework / Warranty Return Ticket (वारंटी रीवर्क क्लेम)
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            Select a delivered device from past records to log a repeat issue or warranty claim without altering the original delivery invoice.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Step 1: Search and Select Past Delivered Job */}
          {!selectedJob ? (
            <div className="space-y-3">
              <Label className="text-xs font-semibold text-gray-700">
                1. Search Past Delivered Repairs (ग्राहक के नाम, फ़ोन या IMEI से खोजें):
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by customer name, phone, 15-digit IMEI, or job no..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSearch();
                      }
                    }}
                    className="pl-9 text-xs h-9 bg-white"
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleSearch}
                  disabled={searching}
                  className="bg-amber-600 hover:bg-amber-700 text-white h-9 text-xs"
                >
                  {searching ? "Searching..." : "Search"}
                </Button>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="border rounded-lg max-h-56 overflow-y-auto divide-y bg-white">
                  {searchResults.map((job) => (
                    <div
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      className="p-2.5 hover:bg-amber-50/60 cursor-pointer transition-colors flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-semibold text-gray-900 flex items-center gap-2">
                          <Smartphone className="h-3.5 w-3.5 text-gray-500" />
                          <span>{job.device_brand} {job.device_model}</span>
                          <Badge variant="outline" className="text-[10px] bg-slate-50 font-mono">
                            {job.job_no}
                          </Badge>
                        </div>
                        <div className="text-gray-500 text-[11px] flex items-center gap-2">
                          <span>👤 {job.customer_name} ({job.customer_phone})</span>
                          <span>•</span>
                          <span className="font-mono">IMEI: {job.imei || "N/A"}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge
                          className={`text-[10px] ${
                            job.status === "delivered"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {job.status}
                        </Badge>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {job.delivered_at
                            ? `Delivered: ${new Date(job.delivered_at).toLocaleDateString("en-IN")}`
                            : `Logged: ${new Date(job.created_at).toLocaleDateString("en-IN")}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Selected Job Card with option to change */
            <div className="border border-amber-300 rounded-lg p-3 bg-amber-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 uppercase tracking-wide flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Selected Original Repair Job:
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedJob(null)}
                  className="h-6 text-xs text-amber-800 hover:text-amber-900 hover:bg-amber-100/50"
                >
                  Change Job
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-white p-2.5 rounded border border-amber-200">
                <div>
                  <div className="font-semibold text-gray-900">
                    {selectedJob.device_brand} {selectedJob.device_model}
                  </div>
                  <div className="text-gray-500 font-mono text-[11px]">
                    IMEI: {selectedJob.imei || "NO IMEI"}
                  </div>
                  <div className="text-gray-600 text-[11px] mt-1">
                    <strong>Original Issue:</strong> {selectedJob.problem}
                  </div>
                </div>
                <div className="space-y-0.5">
                  <div><strong>Customer:</strong> {selectedJob.customer_name}</div>
                  <div><strong>Phone:</strong> {selectedJob.customer_phone}</div>
                  <div className="text-emerald-700 font-semibold">
                    Original Price: ₹{Number(selectedJob.final_price || selectedJob.estimate || 0).toLocaleString("en-IN")}
                  </div>
                  {selectedJob.delivered_at && (
                    <div className="text-gray-500 text-[11px]">
                      Delivered: {new Date(selectedJob.delivered_at).toLocaleDateString("en-IN")}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Rework Complaint / Return Reason */}
          {selectedJob && (
            <div className="space-y-3 border-t pt-3">
              <div>
                <Label htmlFor="rework-reason" className="text-xs font-semibold text-gray-700">
                  Customer Repeat Complaint / Rework Reason <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="rework-reason"
                  placeholder="e.g. Display screen touch not working properly, battery draining rapidly..."
                  rows={3}
                  value={reworkReason}
                  onChange={(e) => setReworkReason(e.target.value)}
                  required
                  autoFocus
                  className="text-xs mt-1 bg-white"
                />
              </div>

              <div>
                <Label htmlFor="rework-tech" className="text-xs font-semibold text-gray-700">
                  Assign Technician (Optional)
                </Label>
                <Input
                  id="rework-tech"
                  placeholder="Technician name..."
                  value={technician}
                  onChange={(e) => setTechnician(e.target.value)}
                  className="text-xs h-8 mt-1 bg-white"
                />
              </div>

              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800 space-y-1">
                <div className="font-semibold flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-600" /> Rework Policy Note:
                </div>
                <p className="text-[11px] text-blue-700 leading-relaxed">
                  A priority ticket <strong>RW-{selectedJob.job_no}</strong> will be logged under the Rework &amp; Warranty workbench. Labor and initial estimate will start at ₹0 as per warranty terms.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 border-t flex flex-col sm:flex-row items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!selectedJob || !reworkReason.trim() || isSubmitting}
              className="bg-amber-600 hover:bg-amber-700 text-white min-w-[160px] text-xs h-9"
            >
              {isSubmitting ? "Creating Rework..." : "Create Rework Ticket"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateReworkDialog;
