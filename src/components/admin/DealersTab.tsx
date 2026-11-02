import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Building2,
  Plus,
  Search,
  Phone,
  MessageSquare,
  Edit,
  Trash2,
  Smartphone,
  FileText,
  History,
  ShieldCheck,
  CheckCircle2,
  Store,
  Camera,
  X,
  Receipt,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/utils/imageCompression";
import { dispatchWhatsApp } from "@/utils/whatsappDispatcher";
import SignaturePadModal from "./SignaturePadModal";
import DealerBatchPurchaseDialog from "./DealerBatchPurchaseDialog";
import DealerBatchInvoiceDialog from "./DealerBatchInvoiceDialog";

export const DealersTab: React.FC = () => {
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedDealer, setSelectedDealer] = useState<any | null>(null);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showBatchPurchaseDialog, setShowBatchPurchaseDialog] = useState(false);
  const [batchPurchaseDealerId, setBatchPurchaseDealerId] = useState<string | null>(null);
  const [showBatchInvoiceModal, setShowBatchInvoiceModal] = useState(false);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [historySubTab, setHistorySubTab] = useState<"batches" | "phones">("batches");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = React.useRef<HTMLInputElement>(null);

  // Photo full-size preview
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [previewPhotoTitle, setPreviewPhotoTitle] = useState<string>("");

  // B2B Dealer Ledger state
  const [showLedgerDialog, setShowLedgerDialog] = useState(false);
  const [ledgerDealer, setLedgerDealer] = useState<any | null>(null);
  const [ledgerData, setLedgerData] = useState<{ balance: number; entries: any[] }>({ balance: 0, entries: [] });
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [savingLedger, setSavingLedger] = useState(false);
  const [ledgerForm, setLedgerForm] = useState({
    type: "credit" as "credit" | "debit",
    amount: "",
    payment_mode: "UPI",
    description: "",
  });

  const [formData, setFormData] = useState({
    shop_name: "",
    proprietor_name: "",
    phone: "",
    alternate_phone: "",
    email: "",
    address: "",
    city: "Sitapur",
    state: "Uttar Pradesh",
    pincode: "261001",
    gst_number: "",
    pan_number: "",
    photo_url: "",
    signature_url: "",
    notes: "",
  });

  // Fetch dealers
  const { data: dealers = [], isLoading, refetch: refetchDealers } = useQuery({
    queryKey: ["dealers", searchTerm],
    queryFn: async () => {
      const q = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : "";
      const res = await fetch(`/api/dealers${q}`);
      return res.ok ? res.json() : [];
    },
  });

  // Fetch single dealer history
  const { data: dealerDetails } = useQuery({
    queryKey: ["dealer-details", selectedDealer?.id],
    queryFn: async () => {
      if (!selectedDealer?.id) return null;
      const res = await fetch(`/api/dealers/${selectedDealer.id}`);
      return res.ok ? res.json() : null;
    },
    enabled: !!selectedDealer?.id && showHistoryDialog,
  });

  const resetForm = () => {
    setFormData({
      shop_name: "",
      proprietor_name: "",
      phone: "",
      alternate_phone: "",
      email: "",
      address: "",
      city: "Sitapur",
      state: "Uttar Pradesh",
      pincode: "261001",
      gst_number: "",
      pan_number: "",
      photo_url: "",
      signature_url: "",
      notes: "",
    });
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowAddDialog(true);
  };

  const handleOpenEdit = (dealer: any) => {
    setSelectedDealer(dealer);
    setFormData({
      shop_name: dealer.shop_name || "",
      proprietor_name: dealer.proprietor_name || "",
      phone: dealer.phone || "",
      alternate_phone: dealer.alternate_phone || "",
      email: dealer.email || "",
      address: dealer.address || "",
      city: dealer.city || "Sitapur",
      state: dealer.state || "Uttar Pradesh",
      pincode: dealer.pincode || "261001",
      gst_number: dealer.gst_number || "",
      pan_number: dealer.pan_number || "",
      photo_url: dealer.photo_url || "",
      signature_url: dealer.signature_url || "",
      notes: dealer.notes || "",
    });
    setShowEditDialog(true);
  };

  const handleOpenHistory = (dealer: any) => {
    setSelectedDealer(dealer);
    setShowHistoryDialog(true);
  };

  const handleStartBatchPurchase = (dealerId?: string) => {
    setBatchPurchaseDealerId(dealerId || null);
    setShowBatchPurchaseDialog(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    try {
      const compressed = await compressImage(file, 300);
      const fileExt = compressed.name.split(".").pop() || "jpg";
      const filePath = `dealer-photos/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const { data: uploadRes, error: uploadErr } = await supabase.storage.from("phonezone-uploads").upload(filePath, compressed);
      if (uploadErr) throw uploadErr;
      const { data } = supabase.storage.from("phonezone-uploads").getPublicUrl(filePath);
      const publicUrl = (uploadRes as any)?.id ? `/api/public/files/${(uploadRes as any).id}` : data.publicUrl;
      setFormData((prev) => ({ ...prev, photo_url: publicUrl }));
      toast.success("Dealer photo uploaded successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload dealer photo");
    } finally {
      setIsUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const handleOpenLedger = async (dealer: any) => {
    setLedgerDealer(dealer);
    setShowLedgerDialog(true);
    setLoadingLedger(true);
    try {
      const res = await fetch(`/api/dealers/${dealer.id}/ledger`);
      if (res.ok) {
        const d = await res.json();
        setLedgerData({ balance: d.balance || 0, entries: d.entries || [] });
      }
    } catch {
      toast.error("Failed to load dealer ledger");
    } finally {
      setLoadingLedger(false);
    }
  };

  const handleSaveLedgerEntry = async () => {
    if (!ledgerDealer) return;
    const numAmount = Number(ledgerForm.amount);
    if (!numAmount || numAmount <= 0) {
      toast.error("Please enter a valid transaction amount");
      return;
    }
    setSavingLedger(true);
    try {
      const res = await fetch(`/api/dealers/${ledgerDealer.id}/ledger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: ledgerForm.type,
          amount: numAmount,
          payment_mode: ledgerForm.payment_mode,
          description: ledgerForm.description,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to record ledger entry");
      }
      toast.success("Ledger entry recorded successfully!");
      setLedgerForm({ type: "credit", amount: "", payment_mode: "UPI", description: "" });
      
      const ledgerRes = await fetch(`/api/dealers/${ledgerDealer.id}/ledger`);
      let newBalance = 0;
      if (ledgerRes.ok) {
        const updated = await ledgerRes.json();
        newBalance = updated.balance || 0;
        setLedgerData({ balance: newBalance, entries: updated.entries || [] });
      }
      queryClient.invalidateQueries({ queryKey: ["dealers"] });

      if (window.confirm(`Do you want to send this ledger update to ${ledgerDealer.shop_name} (${ledgerDealer.phone}) on WhatsApp?`)) {
        const msg = `Namaste ${ledgerDealer.proprietor_name || ledgerDealer.shop_name} ji,\n\nPayment / Ledger Update recorded at PhoneZone:\nAmount: ₹${numAmount.toLocaleString("en-IN")} (${ledgerForm.type === "credit" ? "Payment Received / Disbursed" : "Debit / Goods"})\nMode: ${ledgerForm.payment_mode}\nDescription: ${ledgerForm.description || "B2B Settlement"}\nCurrent Balance: ₹${newBalance.toLocaleString("en-IN")}\n\nThank you,\nPhoneZone ERP`;
        dispatchWhatsApp({ phone: ledgerDealer.phone, message: msg });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to record transaction");
    } finally {
      setSavingLedger(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (isEdit: boolean) => {
      if (!formData.shop_name.trim()) throw new Error("Shop / Firm Name is required.");
      if (!formData.proprietor_name.trim()) throw new Error("Proprietor Name is required.");
      if (!formData.phone.trim()) throw new Error("Phone Number is required.");

      const url = isEdit ? `/api/dealers/${selectedDealer.id}` : "/api/dealers";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save dealer");
      return data;
    },
    onSuccess: () => {
      toast.success(showEditDialog ? "Dealer details updated." : "New Dealer registered successfully.");
      setShowAddDialog(false);
      setShowEditDialog(false);
      queryClient.invalidateQueries({ queryKey: ["dealers"] });
      refetchDealers();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save dealer");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/dealers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove dealer");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Dealer removed.");
      queryClient.invalidateQueries({ queryKey: ["dealers"] });
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  const totalDealers = dealers.length;
  const totalPhonesSupplied = dealers.reduce((acc: number, d: any) => acc + (Number(d.phones_supplied) || 0), 0);
  const totalPaidToDealers = dealers.reduce((acc: number, d: any) => acc + (Number(d.total_amount_paid) || 0), 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Banner & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Building2 className="h-7 w-7 text-sky-600" />
            Dealer Management (B2B Phone Suppliers)
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage wholesale partners, shopkeepers &amp; bulk suppliers with permanent signatures and B2B multi-purchase.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => handleStartBatchPurchase()}
            className="bg-sky-600 hover:bg-sky-700 text-white gap-1.5 shadow-sm"
          >
            <Smartphone className="h-4 w-4" /> Bulk Purchase Phones
          </Button>
          <Button onClick={handleOpenAdd} className="bg-slate-900 hover:bg-slate-800 text-white gap-1.5 shadow-sm">
            <Plus className="h-4 w-4" /> Add Dealer
          </Button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-sky-200 bg-sky-50/50 dark:bg-sky-950/30 dark:border-sky-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-sky-800 dark:text-sky-300 uppercase tracking-wider">
              Total Registered Dealers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-sky-950 dark:text-sky-100">{totalDealers}</div>
            <p className="text-[11px] font-medium text-sky-700 dark:text-sky-400">Active commercial partners</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/30 dark:border-emerald-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
              Phones Supplied (B2B)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-950 dark:text-emerald-100">{totalPhonesSupplied} Units</div>
            <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Acquired from dealer batches</p>
          </CardContent>
        </Card>

        <Card className="border-indigo-200 bg-indigo-50/50 dark:bg-indigo-950/30 dark:border-indigo-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider">
              Total B2B Purchase Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-indigo-950 dark:text-indigo-100">₹{totalPaidToDealers.toLocaleString("en-IN")}</div>
            <p className="text-[11px] font-medium text-indigo-700 dark:text-indigo-400">Disbursed to dealers</p>
          </CardContent>
        </Card>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by shop name, proprietor, phone, GST..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100"
        />
      </div>

      {/* Dealers Table */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-slate-800/80">
            <TableRow className="border-b border-slate-200 dark:border-slate-800">
              <TableHead className="w-12 text-center text-xs font-bold text-slate-700 dark:text-slate-300">#</TableHead>
              <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300">Shop / Firm</TableHead>
              <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300">Proprietor &amp; Phone</TableHead>
              <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300">GST / Tax ID</TableHead>
              <TableHead className="text-center text-xs font-bold text-slate-700 dark:text-slate-300">Phones Supplied</TableHead>
              <TableHead className="text-right text-xs font-bold text-slate-700 dark:text-slate-300">Total Amount</TableHead>
              <TableHead className="text-center text-xs font-bold text-slate-700 dark:text-slate-300">Permanent Sign</TableHead>
              <TableHead className="text-right text-xs font-bold text-slate-700 dark:text-slate-300">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-400 text-xs">
                  Loading registered dealers...
                </TableCell>
              </TableRow>
            ) : dealers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-gray-400 text-xs">
                  No dealers found. Click <strong>+ Add Dealer</strong> to register your first B2B supplier.
                </TableCell>
              </TableRow>
            ) : (
              dealers.map((dealer: any, idx: number) => (
                <TableRow key={dealer.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800/60">
                  <TableCell className="text-center font-semibold text-slate-500 dark:text-slate-400 text-xs">
                    {idx + 1}
                  </TableCell>
                  <TableCell>
                    <div
                      className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2 cursor-pointer hover:opacity-85 transition-opacity"
                      onClick={() => {
                        if (dealer.photo_url) {
                          setPreviewPhotoUrl(dealer.photo_url);
                          setPreviewPhotoTitle(dealer.shop_name);
                        }
                      }}
                      title={dealer.photo_url ? "Click to view full-size photo" : undefined}
                    >
                      {dealer.photo_url ? (
                        <img
                          src={dealer.photo_url}
                          alt={dealer.shop_name}
                          className="w-7 h-7 rounded-full object-cover border border-sky-300 dark:border-sky-500/40 shrink-0 hover:scale-105 transition-transform"
                          onError={(e) => {
                            const img = e.currentTarget as HTMLImageElement;
                            img.onerror = null;
                            img.src =
                              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%230284c7' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7'/%3E%3Cpath d='M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8'/%3E%3Cpath d='M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4'/%3E%3Cpath d='M2 7h20'/%3E%3C/svg%3E";
                          }}
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 flex items-center justify-center shrink-0">
                          <Store className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                        </div>
                      )}
                      <span>{dealer.shop_name}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">{dealer.address || "Sitapur"}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs">{dealer.proprietor_name}</div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      <Phone className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      {dealer.phone}
                    </div>
                  </TableCell>
                  <TableCell>
                    {dealer.gst_number ? (
                      <Badge variant="outline" className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700">
                        {dealer.gst_number}
                      </Badge>
                    ) : (
                      <span className="text-slate-400 text-xs">Unregistered</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className="bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 dark:border-sky-500/40 hover:bg-sky-100 text-xs px-2 py-0.5 font-bold">
                      {dealer.phones_supplied || 0} phones
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold text-slate-900 dark:text-slate-100 text-xs">
                    ₹{Number(dealer.total_amount_paid || 0).toLocaleString("en-IN")}
                  </TableCell>
                  <TableCell className="text-center">
                    {dealer.signature_url ? (
                      <div className="inline-block p-1 bg-slate-50 rounded border border-slate-200">
                        <img src={dealer.signature_url} alt="Sign" className="h-6 max-w-[60px] object-contain" />
                      </div>
                    ) : (
                      <span className="text-[10px] text-amber-600">Not recorded</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenLedger(dealer)}
                        className="h-8 px-2 text-xs text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50 font-bold"
                        title="View / Record B2B Ledger"
                      >
                        <Receipt className="h-3.5 w-3.5 mr-1 text-emerald-600 dark:text-emerald-400" /> Ledger
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleStartBatchPurchase(dealer.id)}
                        className="h-8 px-2 text-xs text-sky-700 hover:text-sky-900 hover:bg-sky-50"
                        title="Bulk Purchase from this Dealer"
                      >
                        <Smartphone className="h-3.5 w-3.5 mr-1" /> Buy
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenHistory(dealer)}
                        className="h-8 w-8 p-0 text-gray-500 hover:text-gray-900"
                        title="View Purchase History"
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenEdit(dealer)}
                        className="h-8 w-8 p-0 text-gray-500 hover:text-gray-900"
                        title="Edit Dealer"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Remove dealer "${dealer.shop_name}"?`)) {
                            deleteMutation.mutate(dealer.id);
                          }
                        }}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        title="Delete Dealer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add / Edit Dealer Dialog */}
      <Dialog
        open={showAddDialog || showEditDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddDialog(false);
            setShowEditDialog(false);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Building2 className="h-5 w-5 text-sky-600" />
              {showEditDialog ? "Edit Dealer Details" : "Register New B2B Dealer"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Shop / Firm Name *</Label>
                <Input
                  placeholder="e.g. Mohd Zubair Telecom"
                  value={formData.shop_name}
                  onChange={(e) => setFormData({ ...formData, shop_name: e.target.value })}
                  className="mt-1 h-9"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Proprietor / Owner Name *</Label>
                <Input
                  placeholder="e.g. Mohd Zubair"
                  value={formData.proprietor_name}
                  onChange={(e) => setFormData({ ...formData, proprietor_name: e.target.value })}
                  className="mt-1 h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Primary Phone *</Label>
                <Input
                  placeholder="10-digit mobile"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="mt-1 h-9 font-mono"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Alternate Phone / WhatsApp</Label>
                <Input
                  placeholder="Optional alternate"
                  value={formData.alternate_phone}
                  onChange={(e) => setFormData({ ...formData, alternate_phone: e.target.value })}
                  className="mt-1 h-9 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">GST Number (Optional)</Label>
                <Input
                  placeholder="e.g. 09ABCDE1234F1Z5"
                  value={formData.gst_number}
                  onChange={(e) => setFormData({ ...formData, gst_number: e.target.value.toUpperCase() })}
                  className="mt-1 h-9 font-mono"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">PAN / ID Number (Optional)</Label>
                <Input
                  placeholder="e.g. ABCDE1234F"
                  value={formData.pan_number}
                  onChange={(e) => setFormData({ ...formData, pan_number: e.target.value.toUpperCase() })}
                  className="mt-1 h-9 font-mono"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Address / Location</Label>
              <Textarea
                placeholder="Shop address, market, landmark"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
                className="mt-1 text-xs"
              />
            </div>

            {/* Dealer Profile Photo Section (Optional) */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-50 dark:bg-slate-800/60 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs font-semibold text-gray-800 dark:text-slate-100">Dealer Profile Photo (डीलर की फोटो)</Label>
                    <Badge variant="outline" className="text-[10px] text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700">Optional / वैकल्पिक</Badge>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    Upload or capture dealer photo. If attached, it will automatically show on statutory Sapath Patra &amp; legal bills.
                  </p>
                </div>
                <div>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isUploadingPhoto}
                    onClick={() => photoInputRef.current?.click()}
                    className="h-8 text-xs gap-1 border-sky-300 text-sky-700 hover:bg-sky-50"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    {isUploadingPhoto ? "Uploading..." : formData.photo_url ? "Change Photo" : "Upload / Camera"}
                  </Button>
                </div>
              </div>

              {formData.photo_url ? (
                <div className="p-2 bg-white rounded border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={formData.photo_url}
                      alt="Dealer"
                      className="w-12 h-12 rounded-full object-cover border-2 border-sky-400 shadow-sm"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%230284c7' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7'/%3E%3Cpath d='M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8'/%3E%3Cpath d='M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4'/%3E%3Cpath d='M2 7h20'/%3E%3C/svg%3E";
                      }}
                    />
                    <div>
                      <div className="text-xs font-semibold text-gray-800">Photo Attached</div>
                      <div className="text-[10px] text-emerald-600 font-medium">Will appear on Sapath Patra &amp; B2B bills</div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setFormData((prev) => ({ ...prev, photo_url: "" }))}
                    className="h-7 text-xs text-red-600 hover:bg-red-50 gap-1"
                  >
                    <X className="h-3.5 w-3.5" />
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="text-[11px] text-gray-400 italic">No photo attached (strictly optional).</div>
              )}
            </div>

            {/* Permanent Signature Section */}
            <div className="border rounded-lg p-3 bg-slate-50 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-semibold text-gray-800">Permanent Dealer Signature (स्थायी हस्ताक्षर)</Label>
                  <p className="text-[11px] text-gray-500">
                    Sign once here. It will automatically be used for all future batch invoices and statutory receipts.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSignatureModal(true)}
                  className="h-8 text-xs gap-1 border-sky-300 text-sky-700 hover:bg-sky-50"
                >
                  <Edit className="h-3.5 w-3.5" />
                  {formData.signature_url ? "Re-draw Signature" : "Capture Signature"}
                </Button>
              </div>

              {formData.signature_url ? (
                <div className="p-2 bg-white rounded border border-slate-200 flex items-center justify-between">
                  <img src={formData.signature_url} alt="Signature" className="h-12 max-w-[200px] object-contain" />
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]">
                    Signature Stored
                  </Badge>
                </div>
              ) : (
                <div className="text-[11px] text-gray-400 italic">No signature saved yet. Click button above to draw or scan.</div>
              )}
            </div>
          </div>

          <DialogFooter className="border-t pt-3">
            <Button
              variant="ghost"
              onClick={() => {
                setShowAddDialog(false);
                setShowEditDialog(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate(showEditDialog)}
              disabled={saveMutation.isPending}
              className="bg-sky-600 hover:bg-sky-700 text-white"
            >
              {saveMutation.isPending ? "Saving..." : showEditDialog ? "Update Dealer" : "Save Dealer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Signature Capture Modal */}
      <SignaturePadModal
        open={showSignatureModal}
        onOpenChange={setShowSignatureModal}
        onSave={(url) => setFormData((prev) => ({ ...prev, signature_url: url }))}
        title="Capture Dealer Signature (डीलर हस्ताक्षर)"
      />

      {/* Batch Purchase Dialog */}
      <DealerBatchPurchaseDialog
        open={showBatchPurchaseDialog}
        onOpenChange={setShowBatchPurchaseDialog}
        dealerId={batchPurchaseDealerId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["dealers"] });
        }}
      />

      {/* Dealer Purchase History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-sky-600" />
                Purchase History: {selectedDealer?.shop_name} ({selectedDealer?.proprietor_name})
              </div>
              {selectedDealer?.photo_url && (
                <img
                  src={selectedDealer.photo_url}
                  alt="Dealer"
                  className="w-8 h-8 rounded-full object-cover border border-sky-300 mr-6"
                />
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2">
              <div className="text-xs text-gray-500">
                Total Phones Supplied: <strong>{dealerDetails?.phones?.length || 0}</strong> • Wholesale Batches:{" "}
                <strong>{dealerDetails?.batches?.length || 0}</strong>
              </div>

              {/* Subtabs for Batches vs All Devices */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md text-xs">
                <Button
                  size="sm"
                  variant={historySubTab === "batches" ? "default" : "ghost"}
                  onClick={() => setHistorySubTab("batches")}
                  className={`h-7 text-xs px-2.5 ${historySubTab === "batches" ? "bg-sky-600 text-white shadow-sm" : "text-gray-600"}`}
                >
                  <Receipt className="h-3.5 w-3.5 mr-1" />
                  Wholesale Batches ({dealerDetails?.batches?.length || 0})
                </Button>
                <Button
                  size="sm"
                  variant={historySubTab === "phones" ? "default" : "ghost"}
                  onClick={() => setHistorySubTab("phones")}
                  className={`h-7 text-xs px-2.5 ${historySubTab === "phones" ? "bg-sky-600 text-white shadow-sm" : "text-gray-600"}`}
                >
                  <Smartphone className="h-3.5 w-3.5 mr-1" />
                  All Devices ({dealerDetails?.phones?.length || 0})
                </Button>
              </div>
            </div>

            {historySubTab === "batches" ? (
              /* Batches Table with Batch Invoice Generation */
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-xs">Purchase Date</TableHead>
                      <TableHead className="text-xs">Invoice Number</TableHead>
                      <TableHead className="text-center text-xs">Phones In Batch</TableHead>
                      <TableHead className="text-xs">Payment Mode</TableHead>
                      <TableHead className="text-right text-xs">Total Amount</TableHead>
                      <TableHead className="text-center text-xs">B2B Batch Invoice</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dealerDetails?.batches && dealerDetails.batches.length > 0 ? (
                      dealerDetails.batches.map((batch: any) => (
                        <TableRow key={batch.id} className="text-xs hover:bg-slate-50/80">
                          <TableCell className="font-medium">{batch.purchase_date}</TableCell>
                          <TableCell className="font-mono font-bold text-sky-800">{batch.invoice_number}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="bg-sky-50 text-sky-700 font-semibold text-[11px]">
                              {batch.total_phones} Units
                            </Badge>
                          </TableCell>
                          <TableCell className="capitalize">{batch.payment_method || "Cash"}</TableCell>
                          <TableCell className="text-right font-bold text-gray-900">
                            ₹{Number(batch.total_amount).toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setActiveBatchId(batch.id);
                                setShowBatchInvoiceModal(true);
                              }}
                              className="h-7 text-xs gap-1 border-sky-300 text-sky-700 hover:bg-sky-50 font-semibold"
                              title="View &amp; Print combined B2B Batch Invoice"
                            >
                              <FileText className="h-3.5 w-3.5 text-sky-600" />
                              View Batch Bill
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-gray-400 text-xs">
                          No wholesale batch transactions recorded yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            ) : (
              /* Individual Phones Table */
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Model &amp; Variant</TableHead>
                      <TableHead className="text-xs">IMEI</TableHead>
                      <TableHead className="text-xs">Condition</TableHead>
                      <TableHead className="text-right text-xs">Cost</TableHead>
                      <TableHead className="text-center text-xs">Status</TableHead>
                      <TableHead className="text-center text-xs">Batch Invoice</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dealerDetails?.phones && dealerDetails.phones.length > 0 ? (
                      dealerDetails.phones.map((p: any) => (
                        <TableRow key={p.id} className="text-xs">
                          <TableCell>{p.purchase_date}</TableCell>
                          <TableCell className="font-semibold">{p.phone_name} {p.model} {p.variant || ""}</TableCell>
                          <TableCell className="font-mono text-[11px]">{p.imei_number}</TableCell>
                          <TableCell className="capitalize">{p.condition}</TableCell>
                          <TableCell className="text-right font-bold">₹{Number(p.purchase_price).toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-center">
                            {p.is_sold ? (
                              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-700/50 text-[10px]">Sold</Badge>
                            ) : (
                              <Badge variant="outline" className="text-blue-700 bg-blue-50 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-700/50 text-[10px]">In Stock</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {p.batch_purchase_id ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setActiveBatchId(p.batch_purchase_id);
                                  setShowBatchInvoiceModal(true);
                                }}
                                className="h-6 text-[11px] px-2 text-sky-700 hover:bg-sky-50"
                                title="Open B2B Batch Invoice"
                              >
                                <FileText className="h-3 w-3 mr-1" />
                                Batch Bill
                              </Button>
                            ) : (
                              <span className="text-gray-400 text-[11px]">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-6 text-gray-400 text-xs">
                          No purchase transactions recorded with this dealer yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistoryDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reusable B2B Batch Purchase Invoice Dialog */}
      <DealerBatchInvoiceDialog
        open={showBatchInvoiceModal}
        onOpenChange={setShowBatchInvoiceModal}
        batchId={activeBatchId}
      />

      {/* Dealer Full-Size Photo Preview Dialog */}
      <Dialog open={!!previewPhotoUrl} onOpenChange={() => setPreviewPhotoUrl(null)}>
        <DialogContent className="max-w-md p-4 bg-slate-900 text-white border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-100 flex items-center justify-between">
              <span>{previewPhotoTitle || "Dealer Photo"}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-3">
            {previewPhotoUrl && (
              <img
                src={previewPhotoUrl}
                alt={previewPhotoTitle}
                className="max-h-[65vh] max-w-full rounded-xl object-contain border border-slate-700 shadow-xl"
              />
            )}
          </div>
          <DialogFooter className="flex justify-between items-center sm:justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
              onClick={() => {
                if (!previewPhotoUrl) return;
                const a = document.createElement("a");
                a.href = previewPhotoUrl;
                a.download = `${(previewPhotoTitle || "dealer").replace(/[^a-zA-Z0-9]/g, "_")}_photo.jpg`;
                a.click();
              }}
            >
              Download Photo
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setPreviewPhotoUrl(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* B2B Dealer Ledger & WhatsApp Statement Modal */}
      <Dialog open={showLedgerDialog} onOpenChange={setShowLedgerDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <span>B2B Dealer Ledger: {ledgerDealer?.shop_name}</span>
              </div>
              <Badge variant="outline" className="text-xs font-mono">
                {ledgerDealer?.phone}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {/* Ledger Balance & Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-2">
            <Card className="border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">Proprietor</div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{ledgerDealer?.proprietor_name}</div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">GST: {ledgerDealer?.gst_number || "Unregistered"}</div>
            </Card>

            <Card className={`p-3 border ${
              ledgerData.balance > 0
                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300"
                : ledgerData.balance < 0
                ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300"
                : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
            }`}>
              <div className="text-xs font-semibold uppercase tracking-wider">Current Running Balance</div>
              <div className="text-2xl font-black mt-1">
                ₹{Math.abs(ledgerData.balance).toLocaleString("en-IN")}
              </div>
              <div className="text-[11px] font-bold mt-0.5">
                {ledgerData.balance > 0
                  ? "✓ Advance / Dealer owes us"
                  : ledgerData.balance < 0
                  ? "⚠ Payable to Dealer"
                  : "✓ Settled / All Clear"}
              </div>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3 flex flex-col justify-center">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs font-bold border-emerald-500 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:border-emerald-500/40"
                onClick={() => {
                  if (!ledgerDealer) return;
                  const statement = `PhoneZone B2B Ledger Statement\nDealer: ${ledgerDealer.shop_name}\nProprietor: ${ledgerDealer.proprietor_name}\nTotal Recorded Transactions: ${ledgerData.entries.length}\nCurrent Running Balance: ₹${ledgerData.balance.toLocaleString("en-IN")}\n\nGenerated on: ${new Date().toLocaleDateString("en-IN")}`;
                  dispatchWhatsApp({ phone: ledgerDealer.phone, message: statement });
                }}
              >
                <MessageSquare className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                Send Statement on WhatsApp
              </Button>
            </Card>
          </div>

          {/* Record New Transaction Form */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-white dark:bg-slate-900/90 shadow-xs my-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
              Record New Payment / Adjustment
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div>
                <Label className="text-[11px]">Type</Label>
                <Select
                  value={ledgerForm.type}
                  onValueChange={(v: "credit" | "debit") => setLedgerForm({ ...ledgerForm, type: v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">Payment Made (Credit)</SelectItem>
                    <SelectItem value="debit">Goods / Charge (Debit)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px]">Amount (₹) *</Label>
                <Input
                  type="number"
                  placeholder="e.g. 5000"
                  value={ledgerForm.amount}
                  onChange={(e) => setLedgerForm({ ...ledgerForm, amount: e.target.value })}
                  className="h-8 text-xs font-bold"
                />
              </div>

              <div>
                <Label className="text-[11px]">Mode</Label>
                <Select
                  value={ledgerForm.payment_mode}
                  onValueChange={(v) => setLedgerForm({ ...ledgerForm, payment_mode: v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UPI">UPI / GPay / PhonePe</SelectItem>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer / IMPS</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px]">Description / Note</Label>
                <div className="flex gap-1.5">
                  <Input
                    placeholder="e.g. Part payment for batch"
                    value={ledgerForm.description}
                    onChange={(e) => setLedgerForm({ ...ledgerForm, description: e.target.value })}
                    className="h-8 text-xs"
                  />
                  <Button
                    size="sm"
                    className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold shrink-0"
                    onClick={handleSaveLedgerEntry}
                    disabled={savingLedger}
                  >
                    {savingLedger ? "Saving..." : "Record"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Ledger History Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden mt-2">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-800/80">
                <TableRow>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-right text-xs">Amount</TableHead>
                  <TableHead className="text-xs">Mode</TableHead>
                  <TableHead className="text-xs">Description</TableHead>
                  <TableHead className="text-right text-xs">Running Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingLedger ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-xs text-slate-400">
                      Loading ledger entries...
                    </TableCell>
                  </TableRow>
                ) : ledgerData.entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-xs text-slate-400">
                      No ledger transactions recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  ledgerData.entries.map((entry) => (
                    <TableRow key={entry.id} className="text-xs">
                      <TableCell className="text-slate-500 font-mono">
                        {entry.created_at ? new Date(entry.created_at).toLocaleDateString("en-IN") : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            entry.type === "credit"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-500/40"
                              : "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-500/40"
                          }
                        >
                          {entry.type === "credit" ? "Credit / Payment" : "Debit / Supply"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-900 dark:text-slate-100">
                        ₹{Number(entry.amount || 0).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400 font-medium">
                        {entry.payment_mode || "cash"}
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400 truncate max-w-xs">
                        {entry.description || "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                        ₹{Number(entry.balance_after || 0).toLocaleString("en-IN")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="mt-3">
            <Button variant="outline" onClick={() => setShowLedgerDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DealersTab;
