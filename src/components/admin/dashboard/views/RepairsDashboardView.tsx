import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Wrench,
  Clock,
  User,
  Smartphone,
  Phone,
  CheckCircle2,
  AlertTriangle,
  Search,
  Plus,
  ArrowRight,
  Send,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "../dashboardFormat";
import { DashboardOverviewData } from "../useDashboardData";

interface RepairsDashboardViewProps {
  data: DashboardOverviewData;
  styleMode?: "glass" | "darkteal";
  isLight?: boolean;
  onNavigateTab: (tab: string) => void;
  onQuickAction: (action: string) => void;
}

export const RepairsDashboardView: React.FC<RepairsDashboardViewProps> = ({
  data,
  styleMode = "glass",
  isLight = false,
  onNavigateTab,
  onQuickAction,
}) => {
  const [selectedStage, setSelectedStage] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch full live repair jobs list from backend
  const { data: allJobs = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["repair-jobs-full"],
    queryFn: async () => {
      const res = await fetch("/api/repair/jobs?limit=50", { credentials: "include" });
      if (!res.ok) {
        return (data.repairs.jobs || []).map((j) => ({
          id: j.id,
          job_no: j.jobNo,
          customer_name: j.customerName,
          device_model: j.device,
          problem: j.problem,
          status: j.status,
          age_days: j.ageDays,
        }));
      }
      return res.json();
    },
    staleTime: 15 * 1000,
  });

  // Normalize jobs with reliable fallback to data.repairs.jobs
  const jobsList = React.useMemo(() => {
    if (Array.isArray(allJobs) && allJobs.length > 0) {
      return allJobs;
    }
    return (data?.repairs?.jobs || []).map((j: any) => ({
      id: j.id || j.jobNo,
      job_no: j.jobNo,
      customer_name: j.customerName,
      customer_phone: j.customerPhone || "",
      device_brand: (j.device || "").split(" ")[0] || "Device",
      device_model: j.device || "Mobile Device",
      problem: j.problem || "Repair service requested",
      status: j.status || "received",
      technician: j.technician || "Workshop Staff",
      estimate: j.estimate || 0,
      advance_paid: j.advancePaid || 0,
      final_price: j.finalPrice || j.estimate || 0,
      age_days: j.ageDays || 0,
      created_at: new Date().toISOString(),
    }));
  }, [allJobs, data?.repairs?.jobs]);

  const stagesList = [
    { key: "ALL", label: "All Jobs" },
    { key: "received", label: "Received" },
    { key: "diagnosing", label: "Diagnosing" },
    { key: "waiting_parts", label: "Waiting Parts" },
    { key: "in_progress", label: "In Progress" },
    { key: "ready", label: "Ready for Delivery" },
    { key: "delivered", label: "Delivered" },
  ];

  const filteredJobs = jobsList.filter((job: any) => {
    const matchesStage = selectedStage === "ALL" || (job.status || "").toLowerCase() === selectedStage.toLowerCase();
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      (job.job_no && job.job_no.toLowerCase().includes(query)) ||
      (job.customer_name && job.customer_name.toLowerCase().includes(query)) ||
      (job.customer_phone && String(job.customer_phone).includes(query)) ||
      (job.device_model && job.device_model.toLowerCase().includes(query)) ||
      (job.device_brand && job.device_brand.toLowerCase().includes(query)) ||
      (job.problem && job.problem.toLowerCase().includes(query));
    return matchesStage && matchesSearch;
  });

  const sendWhatsAppUpdate = (job: any) => {
    const phone = (job.customer_phone || "").replace(/\D/g, "");
    if (!phone) {
      alert("Customer phone number not available for this job.");
      return;
    }
    const target = phone.length === 10 ? `91${phone}` : phone;
    const statusText =
      job.status === "ready"
        ? "your device is READY for pickup! Please collect it from our store."
        : job.status === "waiting_parts"
        ? "we are currently waiting for original spare parts. We will update you as soon as they arrive."
        : `your device is currently in ${job.status.replace("_", " ")} stage.`;

    const msg = `Hello ${job.customer_name || "Customer"}, update regarding Job #${job.job_no} (${job.device_model || "Phone"}): ${statusText} - PhoneZone Store`;
    window.open(`https://wa.me/${target}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const waitingPartsCount = allJobs.filter((j) => j.status === "waiting_parts").length;
  const readyCount = allJobs.filter((j) => j.status === "ready").length;
  const inProgressCount = allJobs.filter((j) => j.status === "in_progress" || j.status === "diagnosing" || j.status === "received").length;

  return (
    <div className="space-y-6">
      {/* 1. View Header with Action Buttons */}
      <div className={`p-6 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm ${
        isLight
          ? "bg-white border-slate-200/90 text-slate-900"
          : "bg-slate-900/80 border-slate-800 text-white"
      }`}>
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <h2 className={`text-xl font-extrabold ${isLight ? "text-slate-900" : "text-white"}`}>
                Repair Operations Command Center
              </h2>
              <p className={`text-xs font-medium ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                Real-time tracking of active workshop queue, parts waiting, and customer collections
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            size="sm"
            onClick={() => onQuickAction("new_repair")}
            className="bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Book New Repair
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigateTab("repairs")}
            className={`text-xs font-bold rounded-xl border ${
              isLight
                ? "bg-slate-50 border-slate-300 text-slate-800 hover:bg-slate-100"
                : "bg-slate-800 border-slate-700 text-slate-200 hover:text-white"
            }`}
          >
            Open Full Repairs Board
            <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </div>
      </div>

      {/* 2. Top Metric KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active In-Queue */}
        <div className={`p-5 rounded-2xl border ${
          isLight ? "bg-white border-slate-200 shadow-sm" : "bg-slate-900/80 border-slate-800"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-bold uppercase tracking-wider ${isLight ? "text-slate-600" : "text-slate-400"}`}>
              Active Workshop Jobs
            </span>
            <span className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <Wrench className="h-4 w-4" />
            </span>
          </div>
          <div className={`text-3xl font-black ${isLight ? "text-slate-900" : "text-white"}`}>
            {data.repairs.pending}
          </div>
          <p className={`text-xs mt-1 font-semibold ${isLight ? "text-slate-600" : "text-slate-400"}`}>
            {inProgressCount} currently under diagnostics & repair
          </p>
        </div>

        {/* Ready For Pickup */}
        <div className={`p-5 rounded-2xl border ${
          readyCount > 0
            ? isLight
              ? "bg-emerald-50/80 border-emerald-300 shadow-sm"
              : "bg-emerald-950/40 border-emerald-800 shadow-lg"
            : isLight
            ? "bg-white border-slate-200 shadow-sm"
            : "bg-slate-900/80 border-slate-800"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-bold uppercase tracking-wider ${
              readyCount > 0 ? "text-emerald-800 dark:text-emerald-300" : isLight ? "text-slate-600" : "text-slate-400"
            }`}>
              Ready For Customer Pickup
            </span>
            <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
          <div className={`text-3xl font-black ${readyCount > 0 ? "text-emerald-700 dark:text-emerald-400" : isLight ? "text-slate-900" : "text-white"}`}>
            {readyCount}
          </div>
          <p className={`text-xs mt-1 font-semibold ${readyCount > 0 ? "text-emerald-800 dark:text-emerald-300" : isLight ? "text-slate-600" : "text-slate-400"}`}>
            {readyCount > 0 ? "Tested & ready for delivery" : "0 phones waiting for pickup"}
          </p>
        </div>

        {/* Waiting For Parts */}
        <div className={`p-5 rounded-2xl border ${
          waitingPartsCount > 0
            ? isLight
              ? "bg-amber-50/80 border-amber-300 shadow-sm"
              : "bg-amber-950/40 border-amber-800 shadow-lg"
            : isLight
            ? "bg-white border-slate-200 shadow-sm"
            : "bg-slate-900/80 border-slate-800"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-bold uppercase tracking-wider ${
              waitingPartsCount > 0 ? "text-amber-800 dark:text-amber-300" : isLight ? "text-slate-600" : "text-slate-400"
            }`}>
              Waiting Spare Parts
            </span>
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Clock className="h-4 w-4" />
            </span>
          </div>
          <div className={`text-3xl font-black ${waitingPartsCount > 0 ? "text-amber-700 dark:text-amber-400" : isLight ? "text-slate-900" : "text-white"}`}>
            {waitingPartsCount}
          </div>
          <p className={`text-xs mt-1 font-semibold ${waitingPartsCount > 0 ? "text-amber-800 dark:text-amber-300" : isLight ? "text-slate-600" : "text-slate-400"}`}>
            Screen/battery/IC delivery pending
          </p>
        </div>

        {/* Outstanding Dues */}
        <div className={`p-5 rounded-2xl border ${
          isLight ? "bg-white border-slate-200 shadow-sm" : "bg-slate-900/80 border-slate-800"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-bold uppercase tracking-wider ${isLight ? "text-slate-600" : "text-slate-400"}`}>
              Repair Balance Due
            </span>
            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <ShieldCheck className="h-4 w-4" />
            </span>
          </div>
          <div className={`text-3xl font-black ${isLight ? "text-slate-900" : "text-white"}`}>
            {formatINR(data.repairs.balanceDue || 0)}
          </div>
          <p className={`text-xs mt-1 font-semibold ${isLight ? "text-slate-600" : "text-slate-400"}`}>
            To collect at time of delivery
          </p>
        </div>
      </div>

      {/* 3. Stage Filter Buttons & Search Input */}
      <div className={`p-4 rounded-3xl border flex flex-col md:flex-row items-center justify-between gap-4 ${
        isLight ? "bg-white border-slate-200/90 shadow-sm" : "bg-slate-900/80 border-slate-800"
      }`}>
        {/* Stage Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          {stagesList.map((st) => {
            const count = st.key === "ALL" ? allJobs.length : allJobs.filter((j) => j.status === st.key).length;
            const isSelected = selectedStage === st.key;
            return (
              <button
                key={st.key}
                onClick={() => setSelectedStage(st.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 border ${
                  isSelected
                    ? "bg-teal-600 text-white border-teal-700 shadow-xs"
                    : isLight
                    ? "bg-slate-50 text-slate-700 hover:text-slate-900 border-slate-200 hover:bg-slate-100"
                    : "bg-slate-800 text-slate-300 hover:text-white border-slate-700"
                }`}
              >
                <span>{st.label}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  isSelected ? "bg-white/20 text-white" : isLight ? "bg-slate-200 text-slate-800" : "bg-slate-700 text-slate-300"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72 shrink-0">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${isLight ? "text-slate-400" : "text-slate-500"}`} />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search job, device, customer..."
            className={`pl-9 text-xs rounded-xl h-9 border ${
              isLight
                ? "bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400"
                : "bg-slate-950 border-slate-800 text-white placeholder:text-slate-500"
            }`}
          />
        </div>
      </div>

      {/* 4. Filtered Repair Jobs Grid */}
      {filteredJobs.length === 0 ? (
        <div className={`text-center py-16 rounded-3xl border ${
          isLight ? "bg-white border-slate-200 text-slate-600" : "bg-slate-900/60 border-slate-800 text-slate-400"
        }`}>
          <Wrench className="h-10 w-10 text-slate-400 mx-auto mb-2 opacity-80" />
          <h4 className={`text-sm font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
            No repair jobs match this filter
          </h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Try switching stage filter or clearing the search query.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredJobs.map((job) => {
            const finalPrice = job.final_price !== undefined ? Number(job.final_price) : Number(job.estimate || 0);
            const advance = Number(job.advance_paid || 0);
            const balance = Math.max(0, finalPrice - advance);

            return (
              <div
                key={job.id}
                className={`p-5 rounded-3xl border flex flex-col justify-between space-y-4 shadow-sm transition-all hover:shadow-md ${
                  isLight
                    ? "bg-white border-slate-200/90 hover:border-teal-500"
                    : "bg-slate-900/80 border-slate-800 hover:border-teal-500/50"
                }`}
              >
                <div className="space-y-3">
                  {/* Top Bar: Job No & Status */}
                  <div className="flex items-center justify-between">
                    <span className={`font-mono text-xs font-black ${isLight ? "text-teal-700" : "text-teal-400"}`}>
                      {job.job_no}
                    </span>
                    <Badge className={`text-[10px] font-bold uppercase ${
                      job.status === "ready"
                        ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                        : job.status === "waiting_parts"
                        ? "bg-amber-100 text-amber-900 border border-amber-300"
                        : "bg-slate-100 text-slate-800 border border-slate-300"
                    }`}>
                      {job.status ? job.status.replace("_", " ") : "Active"}
                    </Badge>
                  </div>

                  {/* Device Info */}
                  <div>
                    <h3 className={`font-extrabold text-base line-clamp-1 flex items-center gap-1.5 ${
                      isLight ? "text-slate-900" : "text-white"
                    }`}>
                      <Smartphone className={`h-4 w-4 shrink-0 ${isLight ? "text-teal-600" : "text-teal-400"}`} />
                      <span>{job.device_brand ? `${job.device_brand} ` : ""}{job.device_model || "Smartphone"}</span>
                    </h3>
                    <p className={`text-xs mt-1 font-semibold ${isLight ? "text-rose-600" : "text-rose-400"}`}>
                      Problem: {job.problem || "Diagnostic Check"}
                    </p>
                  </div>

                  {/* Customer & Technician */}
                  <div className={`p-3 rounded-xl space-y-1 text-xs border ${
                    isLight ? "bg-slate-50 border-slate-200/80 text-slate-700" : "bg-slate-950/60 border-slate-800/80 text-slate-300"
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-medium">
                        <User className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                        <strong className={isLight ? "text-slate-900" : "text-white"}>{job.customer_name || "Customer"}</strong>
                      </span>
                      {job.customer_phone && (
                        <span className="font-mono text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {job.customer_phone}
                        </span>
                      )}
                    </div>
                    {job.technician && (
                      <div className="text-[11px] text-slate-500 flex items-center justify-between pt-0.5">
                        <span>Technician:</span>
                        <span className={`font-bold ${isLight ? "text-slate-800" : "text-slate-200"}`}>{job.technician}</span>
                      </div>
                    )}
                  </div>

                  {/* Pricing Breakdown */}
                  <div className="flex items-baseline justify-between pt-1">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Final / Estimate</span>
                      <span className={`text-base font-black ${isLight ? "text-slate-900" : "text-white"}`}>
                        {formatINR(finalPrice)}
                      </span>
                    </div>
                    {balance > 0 && (
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-amber-600 block">Balance Due</span>
                        <span className="text-sm font-black text-amber-600">
                          {formatINR(balance)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-2 flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => sendWhatsAppUpdate(job)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1"
                  >
                    <Send className="h-3 w-3" />
                    WhatsApp Update
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigateTab("repairs")}
                    className={`text-xs font-bold rounded-xl border ${
                      isLight ? "bg-slate-50 border-slate-300 text-slate-800 hover:bg-slate-100" : "bg-slate-800 border-slate-700 text-slate-200"
                    }`}
                  >
                    View
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default RepairsDashboardView;
