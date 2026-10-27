import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Wrench,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  Clock,
  Printer,
  ChevronRight,
  RefreshCw,
  QrCode,
  RotateCcw,
  Users,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  Calendar,
  Receipt,
  FileText,
  Eye,
  Phone,
  MessageSquare,
  Smartphone,
} from "lucide-react";
import AddRepairDialog from "./AddRepairDialog";
import RepairDetailDialog from "./RepairDetailDialog";
import RepairInvoiceModal, { type RepairDocType } from "./RepairInvoiceModal";
import CreateReworkDialog from "./CreateReworkDialog";
import RepairCustomerOverviewDialog from "./RepairCustomerOverviewDialog";
import { printRepairSticker } from "@/lib/deviceQr";
import { toast } from "sonner";

export const RepairsTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<"jobs" | "rework" | "customers" | "accounting">("jobs");
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [docModalJob, setDocModalJob] = useState<any | null>(null);
  const [docModalType, setDocModalType] = useState<RepairDocType>("invoice");
  const [docModalOpen, setDocModalOpen] = useState(false);

  // Customers state
  const [repairCustomers, setRepairCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  // Accounting state
  const [accountingData, setAccountingData] = useState<any | null>(null);
  const [loadingAccounting, setLoadingAccounting] = useState(false);

  // Rework dialog state
  const [reworkDialogOpen, setReworkDialogOpen] = useState(false);
  const [reworkPreselectedJob, setReworkPreselectedJob] = useState<any | null>(null);

  // Customer Overview state
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [customerOverviewOpen, setCustomerOverviewOpen] = useState(false);
  const [customerHistory, setCustomerHistory] = useState<any[]>([]);
  const [loadingCustomerHistory, setLoadingCustomerHistory] = useState(false);

  const handleOpenCustomerOverview = async (cust: any) => {
    setSelectedCustomer(cust);
    setCustomerOverviewOpen(true);
    setLoadingCustomerHistory(true);
    try {
      const res = await fetch(`/api/repair/customers/${cust.id}/history`);
      if (res.ok) {
        const hist = await res.json();
        setCustomerHistory(Array.isArray(hist) ? hist : []);
      }
    } catch {
      toast.error("Failed to load customer repair history");
    } finally {
      setLoadingCustomerHistory(false);
    }
  };

  const handleCreateReworkForJob = (job: any) => {
    setReworkPreselectedJob(job);
    setReworkDialogOpen(true);
  };

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());

      const res = await fetch(`/api/repair/jobs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setJobs(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch repair jobs", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRepairCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const params = new URLSearchParams();
      if (customerSearch.trim()) params.append("search", customerSearch.trim());
      const res = await fetch(`/api/repair/customers?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRepairCustomers(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch repair customers", err);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const fetchAccounting = async () => {
    setLoadingAccounting(true);
    try {
      const res = await fetch("/api/repair/accounting");
      if (res.ok) {
        const data = await res.json();
        setAccountingData(data);
      }
    } catch (err) {
      console.error("Failed to fetch repair accounting", err);
    } finally {
      setLoadingAccounting(false);
    }
  };

  // Initial fetch for all badges
  useEffect(() => {
    fetchJobs();
    fetchRepairCustomers();
    fetchAccounting();
  }, []);

  useEffect(() => {
    if (activeSubTab === "jobs" || activeSubTab === "rework") {
      const timer = setTimeout(() => {
        fetchJobs();
      }, 200);
      return () => clearTimeout(timer);
    } else if (activeSubTab === "customers") {
      fetchRepairCustomers();
    } else if (activeSubTab === "accounting") {
      fetchAccounting();
    }
  }, [statusFilter, searchQuery, activeSubTab, customerSearch]);

  const handleOpenDetail = async (jobId: string) => {
    try {
      const res = await fetch(`/api/repair/jobs/${jobId}`);
      if (res.ok) {
        const fullJob = await res.json();
        setSelectedJob(fullJob);
        setDetailOpen(true);
      }
    } catch (err) {
      console.error("Error fetching job details", err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "received":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Received</Badge>;
      case "diagnosing":
        return <Badge variant="secondary" className="bg-purple-100 text-purple-800">Diagnosing</Badge>;
      case "waiting_parts":
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800">Waiting Parts</Badge>;
      case "in_progress":
        return <Badge variant="secondary" className="bg-indigo-100 text-indigo-800">In Progress</Badge>;
      case "ready":
        return <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">Ready</Badge>;
      case "delivered":
        return <Badge variant="default" className="bg-green-600 text-white">Delivered</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filterChips = [
    { id: "all", label: "All Repairs" },
    { id: "received", label: "Received" },
    { id: "in_progress", label: "In Progress" },
    { id: "waiting_parts", label: "Waiting Parts" },
    { id: "ready", label: "Ready" },
    { id: "delivered", label: "Delivered" },
  ];

  const reworkJobs = jobs.filter((j) => j.is_rework === 1 || j.job_no?.startsWith("RW-"));

  return (
    <div className="space-y-4">
      {/* Sub-Department Header & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-600 text-white rounded-lg">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Mobile Repair Department</h2>
            <p className="text-xs text-gray-500">Workshop, technician logs, rework warranty & separate accounting</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-sm"
            onClick={() => setAddDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            New Repair Job
          </Button>
        </div>
      </div>

      {/* Sub-tab Pill Navigation */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeSubTab === "jobs" ? "default" : "outline"}
          size="sm"
          className={activeSubTab === "jobs" ? "bg-slate-900" : ""}
          onClick={() => setActiveSubTab("jobs")}
        >
          <Wrench className="h-4 w-4 mr-1.5" />
          Workbench ({jobs.length})
        </Button>
        <Button
          variant={activeSubTab === "rework" ? "default" : "outline"}
          size="sm"
          className={activeSubTab === "rework" ? "bg-amber-600 hover:bg-amber-700 text-white" : "text-amber-700 border-amber-300 hover:bg-amber-50"}
          onClick={() => setActiveSubTab("rework")}
        >
          <RotateCcw className="h-4 w-4 mr-1.5" />
          Rework &amp; Warranty ({reworkJobs.length})
        </Button>
        <Button
          variant={activeSubTab === "customers" ? "default" : "outline"}
          size="sm"
          className={activeSubTab === "customers" ? "bg-slate-900" : ""}
          onClick={() => setActiveSubTab("customers")}
        >
          <Users className="h-4 w-4 mr-1.5" />
          Repair Customers ({repairCustomers.length})
        </Button>
        <Button
          variant={activeSubTab === "accounting" ? "default" : "outline"}
          size="sm"
          className={activeSubTab === "accounting" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "text-emerald-700 border-emerald-300 hover:bg-emerald-50"}
          onClick={() => setActiveSubTab("accounting")}
        >
          <TrendingUp className="h-4 w-4 mr-1.5" />
          Repair Accounting
        </Button>
      </div>

      {/* SUB-TAB 1: Active Jobs Workbench */}
      {activeSubTab === "jobs" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3 pt-4">
              {/* Search & Filter bar */}
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by job no, IMEI, customer name or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 text-sm"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchJobs}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>

              {/* Status filter chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {filterChips.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setStatusFilter(chip.id)}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                      statusFilter === chip.id
                        ? "bg-indigo-600 text-white border-indigo-600 font-medium"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Repairs Table Card */}
          <Card>
            <CardContent className="p-0">
              {loading && jobs.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                  Loading repair jobs...
                </div>
              ) : jobs.length === 0 ? (
                <div className="p-12 text-center text-sm text-gray-500">
                  <Wrench className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                  <div className="font-semibold text-gray-700">No repair jobs found</div>
                  <p className="text-xs text-gray-400 mt-1">
                    {searchQuery || statusFilter !== "all"
                      ? "Try adjusting your search or status filter"
                      : "Click 'New Repair Job' above to log your first repair"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-gray-50 border-b text-xs text-gray-600 uppercase">
                      <tr>
                        <th className="p-3">Job No</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Device &amp; IMEI</th>
                        <th className="p-3">Problem</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Estimate / Final</th>
                        <th className="p-3">Received</th>
                        <th className="p-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {jobs.map((job) => (
                        <tr
                          key={job.id}
                          className="hover:bg-gray-50/80 transition-colors cursor-pointer"
                          onClick={() => handleOpenDetail(job.id)}
                        >
                          <td className="p-3 font-semibold text-indigo-700 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {job.job_no}
                              {job.is_rework === 1 && (
                                <Badge className="bg-amber-600 text-[10px] px-1 py-0">REWORK</Badge>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="font-medium text-gray-900">{job.customer_name}</div>
                            <div className="text-xs text-gray-500">{job.customer_phone}</div>
                          </td>
                          <td className="p-3">
                            <div className="font-medium text-gray-800">
                              {job.device_brand} {job.device_model}
                            </div>
                            <div className="font-mono text-xs text-gray-500">{job.imei || "NO IMEI"}</div>
                            {job.board_replaced === 1 && (
                              <span className="inline-flex items-center text-[11px] text-red-600 font-bold">
                                <AlertTriangle className="w-3 h-3 mr-0.5" />
                                Motherboard Replaced
                              </span>
                            )}
                          </td>
                          <td className="p-3 max-w-xs truncate text-gray-700 text-xs">
                            {job.problem}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {getStatusBadge(job.status)}
                          </td>
                          <td className="p-3 text-right whitespace-nowrap font-medium text-gray-900">
                            {job.final_price ? `₹${job.final_price}` : job.estimate ? `₹${job.estimate}` : "-"}
                          </td>
                          <td className="p-3 text-xs text-gray-500 whitespace-nowrap">
                            {job.received_at ? new Date(job.received_at).toLocaleDateString("en-IN") : "-"}
                          </td>
                          <td className="p-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              {job.status === "delivered" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7 px-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                                  title="Return for Rework / Repeat Warranty Claim"
                                  onClick={() => handleCreateReworkForJob(job)}
                                >
                                  <RotateCcw className="h-3.5 w-3.5 mr-1 text-amber-600" />
                                  Rework
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs h-7 px-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                title="Repair Invoice & Multi-Style Print / WA"
                                onClick={() => {
                                  setDocModalJob(job);
                                  setDocModalType("invoice");
                                  setDocModalOpen(true);
                                }}
                              >
                                <Receipt className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                                Invoice
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs h-7 px-2"
                                title="Print Device QR Sticker"
                                onClick={() =>
                                  printRepairSticker({
                                    jobNo: job.job_no,
                                    customerName: job.customer_name,
                                    deviceModel: `${job.device_brand || ''} ${job.device_model || ''}`.trim(),
                                    problem: job.problem,
                                    receivedDate: job.received_at,
                                  })
                                }
                              >
                                <QrCode className="h-3.5 w-3.5 mr-1 text-gray-600" />
                                Sticker
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs h-7 px-2.5 text-indigo-700 hover:text-indigo-800"
                                onClick={() => handleOpenDetail(job.id)}
                              >
                                Open
                                <ChevronRight className="h-3 w-3 ml-0.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* SUB-TAB 2: Rework & Warranty Tab */}
      {activeSubTab === "rework" && (
        <div className="space-y-4">
          <Card className="border-amber-200 bg-amber-50/40">
            <CardHeader className="pb-3 flex flex-row items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="text-base text-amber-900 flex items-center gap-2">
                  <RotateCcw className="h-5 w-5 text-amber-700" />
                  Rework &amp; Repeat Warranty Claims
                </CardTitle>
                <p className="text-xs text-amber-800 mt-1">
                  Track devices brought back by customers for warranty rework or repeat complaints without altering original delivery records.
                </p>
              </div>
              <Button
                size="sm"
                className="bg-amber-700 hover:bg-amber-800 text-white font-medium shadow-sm"
                onClick={() => {
                  setReworkPreselectedJob(null);
                  setReworkDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add Rework / Claim Warranty
              </Button>
            </CardHeader>
          </Card>

          <Card>
            <CardContent className="p-0">
              {reworkJobs.length === 0 ? (
                <div className="p-12 text-center text-sm text-gray-500">
                  <RotateCcw className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                  <div className="font-semibold text-gray-700">No rework or warranty claims active</div>
                  <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                    Search any past delivered device or customer to open a warranty rework ticket with unique tracking code.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 border-amber-300 text-amber-800 hover:bg-amber-50"
                    onClick={() => {
                      setReworkPreselectedJob(null);
                      setReworkDialogOpen(true);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    + Add Rework / Claim Warranty
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-gray-50 border-b text-xs text-gray-600 uppercase">
                      <tr>
                        <th className="p-3">Rework Job</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Device &amp; IMEI</th>
                        <th className="p-3">Customer Complaint</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Logged Date</th>
                        <th className="p-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {reworkJobs.map((job) => (
                        <tr
                          key={job.id}
                          className="hover:bg-amber-50/30 transition-colors cursor-pointer"
                          onClick={() => handleOpenDetail(job.id)}
                        >
                          <td className="p-3 font-semibold text-amber-800 whitespace-nowrap">
                            <Badge className="bg-amber-600 text-white mr-1.5">REWORK</Badge>
                            {job.job_no}
                          </td>
                          <td className="p-3">
                            <div className="font-medium text-gray-900">{job.customer_name}</div>
                            <div className="text-xs text-gray-500">{job.customer_phone}</div>
                          </td>
                          <td className="p-3">
                            <div className="font-medium text-gray-800">
                              {job.device_brand} {job.device_model}
                            </div>
                            <div className="font-mono text-xs text-gray-500">{job.imei || "NO IMEI"}</div>
                          </td>
                          <td className="p-3 text-xs text-gray-800 max-w-sm">
                            {job.problem}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {getStatusBadge(job.status)}
                          </td>
                          <td className="p-3 text-xs text-gray-500 whitespace-nowrap">
                            {new Date(job.created_at).toLocaleDateString("en-IN")}
                          </td>
                          <td className="p-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 px-2.5 text-amber-800 hover:bg-amber-50"
                              onClick={() => handleOpenDetail(job.id)}
                            >
                              Manage Rework
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* SUB-TAB 3: Repair Customers */}
      {activeSubTab === "customers" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search repair customers by name or phone..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="pl-9 text-sm"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={fetchRepairCustomers} disabled={loadingCustomers}>
                  <RefreshCw className={`h-4 w-4 mr-1 ${loadingCustomers ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {repairCustomers.length === 0 ? (
                <div className="p-12 text-center text-sm text-gray-500">
                  <Users className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                  <div className="font-semibold text-gray-700">No repair customers found</div>
                  <p className="text-xs text-gray-400 mt-1">
                    Customers who bring devices for repair appear here automatically with full ledger and device histories.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-gray-50 border-b text-xs text-gray-600 uppercase">
                      <tr>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Contact</th>
                        <th className="p-3">Address</th>
                        <th className="p-3 text-center">Repairs</th>
                        <th className="p-3 text-right">Total Spent</th>
                        <th className="p-3 text-center">Ledger / Balance</th>
                        <th className="p-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {repairCustomers.map((cust) => {
                        const totalSpent = Number(cust.total_spent || 0);
                        const balanceDue = Number(cust.total_balance_due || 0);
                        const totalRepairs = Number(cust.total_repairs || 0);
                        const activeCount = Number(cust.active_repairs || 0);

                        return (
                          <tr
                            key={cust.id}
                            className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                            onClick={() => handleOpenCustomerOverview(cust)}
                          >
                            <td className="p-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                  {(cust.name || "C").charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                                    {cust.name}
                                  </div>
                                  <div className="text-[11px] text-gray-400">
                                    Joined {cust.created_at ? new Date(cust.created_at).toLocaleDateString("en-IN") : "-"}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="p-3" onClick={(e) => e.stopPropagation()}>
                              <div className="font-mono text-xs text-gray-800 font-medium">
                                <a href={`tel:${cust.phone}`} className="hover:text-blue-600 hover:underline">
                                  {cust.phone}
                                </a>
                              </div>
                              {cust.alternate_phone && (
                                <div className="text-[11px] text-gray-400 font-mono">
                                  Alt: {cust.alternate_phone}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-xs text-gray-600 max-w-xs truncate">
                              {cust.address || "-"}
                            </td>
                            <td className="p-3 text-center whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                <Badge variant="outline" className="text-xs bg-slate-50 font-medium">
                                  {totalRepairs} {totalRepairs === 1 ? "Job" : "Jobs"}
                                </Badge>
                                {activeCount > 0 && (
                                  <Badge className="text-[10px] bg-amber-500 hover:bg-amber-600 text-white font-medium py-0 px-1">
                                    {activeCount} In Workshop
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                              ₹{totalSpent.toLocaleString()}
                            </td>
                            <td className="p-3 text-center whitespace-nowrap">
                              {balanceDue > 0 ? (
                                <Badge className="bg-red-50 text-red-700 border-red-300 font-semibold px-2 py-0.5">
                                  Due: ₹{balanceDue.toLocaleString()}
                                </Badge>
                              ) : (
                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 font-medium px-2 py-0.5">
                                  Nil (₹0)
                                </Badge>
                              )}
                            </td>
                            <td className="p-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7 px-2.5 text-blue-700 border-blue-200 hover:bg-blue-50"
                                  onClick={() => handleOpenCustomerOverview(cust)}
                                >
                                  <Eye className="h-3.5 w-3.5 mr-1 text-blue-600" />
                                  Overview &amp; Ledger
                                </Button>
                                {cust.phone && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-emerald-600 hover:bg-emerald-50"
                                    title="WhatsApp Chat"
                                    onClick={() => {
                                      const clean = cust.phone.replace(/\D/g, "");
                                      const full = clean.length === 10 ? `91${clean}` : clean;
                                      window.open(`https://wa.me/${full}`, "_blank");
                                    }}
                                  >
                                    <MessageSquare className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* SUB-TAB 4: Repair Accounting */}
      {activeSubTab === "accounting" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-gray-500 uppercase">
                  Repair Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">
                  ₹{Number(accountingData?.total_revenue || 0).toLocaleString()}
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">From delivered repairs</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-gray-500 uppercase">
                  Parts Expenses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-rose-600">
                  ₹{Number(accountingData?.total_parts_cost || 0).toLocaleString()}
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">Screens, batteries &amp; hardware</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-gray-500 uppercase">
                  Net Repair Profit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-indigo-600">
                  ₹{Number(accountingData?.net_profit || 0).toLocaleString()}
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">Service charges after parts cost</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-gray-500 uppercase">
                  Delivered vs Pending
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  {accountingData?.delivered_jobs || 0} <span className="text-sm font-normal text-gray-400">/ {accountingData?.total_jobs || 0}</span>
                </div>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  {accountingData?.pending_jobs || 0} repairs currently in workshop
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Delivered Repairs Accounting Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Delivered Repairs &amp; Margin Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {(!accountingData?.recent_delivered || accountingData.recent_delivered.length === 0) ? (
                <p className="p-8 text-center text-sm text-gray-500">No delivered repairs logged yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-gray-50 border-b text-xs text-gray-600 uppercase">
                      <tr>
                        <th className="p-3">Job No</th>
                        <th className="p-3">Device</th>
                        <th className="p-3 text-right">Parts Cost</th>
                        <th className="p-3 text-right">Labor / Service</th>
                        <th className="p-3 text-right">Final Collected</th>
                        <th className="p-3 text-right">Net Profit</th>
                        <th className="p-3">Delivered Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {accountingData.recent_delivered.map((item: any) => {
                        const collected = Number(item.final_price || 0);
                        const parts = Number(item.parts_cost || 0);
                        const margin = collected - parts;
                        return (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="p-3 font-semibold text-indigo-700">{item.job_no}</td>
                            <td className="p-3 text-gray-800">{item.device_brand} {item.device_model}</td>
                            <td className="p-3 text-right text-rose-600 font-medium">₹{parts.toLocaleString()}</td>
                            <td className="p-3 text-right text-gray-600">₹{Number(item.labour_cost || 0).toLocaleString()}</td>
                            <td className="p-3 text-right font-bold text-gray-900">₹{collected.toLocaleString()}</td>
                            <td className="p-3 text-right font-bold text-emerald-600">₹{margin.toLocaleString()}</td>
                            <td className="p-3 text-xs text-gray-500">
                              {item.delivered_at ? new Date(item.delivered_at).toLocaleDateString("en-IN") : "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dialogs */}
      <AddRepairDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={fetchJobs}
      />

      <RepairDetailDialog
        job={selectedJob}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onRefresh={fetchJobs}
      />

      {/* Repair Document & Invoice Center Dialog (from Table Actions) */}
      <RepairInvoiceModal
        open={docModalOpen}
        onOpenChange={setDocModalOpen}
        job={docModalJob}
        defaultDocType={docModalType}
        onSuccess={fetchJobs}
      />

      {/* Rework & Warranty Claim Dialog */}
      <CreateReworkDialog
        open={reworkDialogOpen}
        onOpenChange={(open) => {
          setReworkDialogOpen(open);
          if (!open) setReworkPreselectedJob(null);
        }}
        preselectedJob={reworkPreselectedJob}
        onSuccess={() => {
          fetchJobs();
          fetchRepairCustomers();
        }}
      />

      {/* Customer Repair Overview & Ledger Dialog */}
      <RepairCustomerOverviewDialog
        open={customerOverviewOpen}
        onOpenChange={setCustomerOverviewOpen}
        customer={selectedCustomer}
        history={customerHistory}
        isLoading={loadingCustomerHistory}
        onOpenJobDetail={(jobId) => handleOpenDetail(jobId)}
        onOpenJobDoc={(job, type) => {
          setDocModalJob(job);
          setDocModalType(type === "jobsheet" ? "jobsheet" : "invoice");
          setDocModalOpen(true);
        }}
        onRequestRework={(job) => {
          setCustomerOverviewOpen(false);
          handleCreateReworkForJob(job);
        }}
        onRefresh={() => {
          if (selectedCustomer) {
            handleOpenCustomerOverview(selectedCustomer);
          }
          fetchJobs();
          fetchRepairCustomers();
        }}
      />
    </div>
  );
};

export default RepairsTab;
