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
} from "lucide-react";
import { toast } from "sonner";
import SignaturePadModal from "./SignaturePadModal";
import DealerBatchPurchaseDialog from "./DealerBatchPurchaseDialog";

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
  const { data: dealers = [], isLoading } = useQuery({
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
        <Card className="border-sky-100 bg-sky-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-sky-800 uppercase tracking-wider">
              Total Registered Dealers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sky-900">{totalDealers}</div>
            <p className="text-[11px] text-sky-700">Active commercial partners</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-100 bg-emerald-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
              Phones Supplied (B2B)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-900">{totalPhonesSupplied} Units</div>
            <p className="text-[11px] text-emerald-700">Acquired from dealer batches</p>
          </CardContent>
        </Card>

        <Card className="border-indigo-100 bg-indigo-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-indigo-800 uppercase tracking-wider">
              Total B2B Purchase Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-900">₹{totalPaidToDealers.toLocaleString("en-IN")}</div>
            <p className="text-[11px] text-indigo-700">Disbursed to dealers</p>
          </CardContent>
        </Card>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search by shop name, proprietor, phone, GST..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 bg-white"
        />
      </div>

      {/* Dealers Table */}
      <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="w-12 text-center text-xs">#</TableHead>
              <TableHead className="text-xs">Shop / Firm</TableHead>
              <TableHead className="text-xs">Proprietor &amp; Phone</TableHead>
              <TableHead className="text-xs">GST / Tax ID</TableHead>
              <TableHead className="text-center text-xs">Phones Supplied</TableHead>
              <TableHead className="text-right text-xs">Total Amount</TableHead>
              <TableHead className="text-center text-xs">Permanent Sign</TableHead>
              <TableHead className="text-right text-xs">Actions</TableHead>
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
                <TableRow key={dealer.id} className="hover:bg-slate-50/80">
                  <TableCell className="text-center font-semibold text-gray-500 text-xs">
                    {idx + 1}
                  </TableCell>
                  <TableCell>
                    <div className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                      <Store className="h-4 w-4 text-sky-600 shrink-0" />
                      {dealer.shop_name}
                    </div>
                    <div className="text-[11px] text-gray-500 line-clamp-1">{dealer.address || "Sitapur"}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-gray-800 text-xs">{dealer.proprietor_name}</div>
                    <div className="flex items-center gap-1 text-[11px] text-gray-500 font-mono">
                      <Phone className="h-3 w-3 text-emerald-600" />
                      {dealer.phone}
                    </div>
                  </TableCell>
                  <TableCell>
                    {dealer.gst_number ? (
                      <Badge variant="outline" className="font-mono text-[10px] bg-slate-50 text-slate-700">
                        {dealer.gst_number}
                      </Badge>
                    ) : (
                      <span className="text-gray-400 text-xs">Unregistered</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100 text-xs px-2 py-0.5">
                      {dealer.phones_supplied || 0} phones
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold text-gray-900 text-xs">
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
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <History className="h-5 w-5 text-sky-600" />
              Purchase History: {selectedDealer?.shop_name} ({selectedDealer?.proprietor_name})
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="text-xs text-gray-500">
              Total Phones Supplied: <strong>{dealerDetails?.phones?.length || 0}</strong> • Batches:{" "}
              <strong>{dealerDetails?.batches?.length || 0}</strong>
            </div>

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
                            <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">Sold</Badge>
                          ) : (
                            <Badge variant="outline" className="text-blue-700 bg-blue-50 text-[10px]">In Stock</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-gray-400 text-xs">
                        No purchase transactions recorded with this dealer yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistoryDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DealersTab;
