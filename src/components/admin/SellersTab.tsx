import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, Search, Phone, MessageSquare, FileText, History, Smartphone, ShieldCheck, Camera, Eye } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { compressImage } from "@/utils/imageCompression";
import ReturnHistoryDialog from "./ReturnHistoryDialog";
import PhoneHistoryDialog from "./PhoneHistoryDialog";
import AadhaarScanButton from "./AadhaarScanButton";
import SapathPatraModal from "./SapathPatraModal";
import { fillPersonFields, type AadhaarData } from "@/lib/aadhaarParser";

type IdProofType = Database["public"]["Enums"]["id_proof_type"];

const SellersTab = () => {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showReturnHistory, setShowReturnHistory] = useState(false);
  const [showPhoneHistory, setShowPhoneHistory] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<any>(null);
  const [sapathPatraPhone, setSapathPatraPhone] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();

  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [previewPhotoTitle, setPreviewPhotoTitle] = useState("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = React.useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
    id_proof_type: "" as IdProofType,
    id_number: "",
    seller_photo_url: ""
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    try {
      const compressed = await compressImage(file, 300);
      const fileExt = compressed.name.split(".").pop() || "jpg";
      const filePath = `seller-photos/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const { error: uploadErr } = await supabase.storage.from("phonezone-uploads").upload(filePath, compressed);
      if (uploadErr) throw uploadErr;
      const { data } = supabase.storage.from("phonezone-uploads").getPublicUrl(filePath);
      setFormData((prev) => ({ ...prev, seller_photo_url: data.publicUrl }));
      toast.success("Seller photo uploaded successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload photo");
    } finally {
      setIsUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  // Step 3: offline Aadhaar OCR fills name/address/number, never overwrites
  // what the user already typed.
  const applyAadhaar = (d: AadhaarData) =>
    setFormData((prev) => ({ ...fillPersonFields(prev, d), id_proof_type: "aadhaar" as IdProofType }));

  const { data: sellers, isLoading } = useQuery({
    queryKey: ['sellers', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('sellers')
        .select(`
          *,
          phones (
            id, phone_name, model, purchase_price, selling_price, is_sold,
            imei_number, imei2_number, variant, colour, condition,
            seller_photo_url, seller_signature_url, sapath_patra_language, purchase_date
          )
        `)
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,id_number.ilike.%${searchTerm}%`);
      }

      const { data, error } = await (query as any);
      if (error) throw error;
      return (data || []) as any[];
    }
  });

  const resetForm = () => {
    setFormData({
      name: "",
      phone: "",
      address: "",
      id_proof_type: "" as IdProofType,
      id_number: "",
      seller_photo_url: ""
    });
  };

  const handleAdd = () => {
    resetForm();
    setShowAddDialog(true);
  };

  const handleEdit = (seller: any) => {
    setSelectedSeller(seller);
    const existingPhoto = (seller as any).seller_photo_url || (seller as any).photo_url || (seller.phones as any[])?.find((p: any) => p?.seller_photo_url)?.seller_photo_url || "";
    setFormData({
      name: seller.name,
      phone: seller.phone,
      address: seller.address,
      id_proof_type: seller.id_proof_type as IdProofType,
      id_number: seller.id_number,
      seller_photo_url: existingPhoto
    });
    setShowEditDialog(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.phone || !formData.id_proof_type || !formData.id_number) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      if (selectedSeller) {
        // Update existing seller
        const { error } = await supabase
          .from('sellers')
          .update({
            name: formData.name,
            phone: formData.phone,
            address: formData.address,
            id_proof_type: formData.id_proof_type,
            id_number: formData.id_number,
            seller_photo_url: formData.seller_photo_url || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedSeller.id);

        if (error) throw error;
        toast.success("Seller updated successfully!");
        setShowEditDialog(false);
      } else {
        // Add new seller
        const { error } = await supabase
          .from('sellers')
          .insert({
            name: formData.name,
            phone: formData.phone,
            address: formData.address,
            id_proof_type: formData.id_proof_type,
            id_number: formData.id_number,
            seller_photo_url: formData.seller_photo_url || null
          });

        if (error) throw error;
        toast.success("Seller added successfully!");
        setShowAddDialog(false);
      }

      resetForm();
      setSelectedSeller(null);
      queryClient.invalidateQueries({ queryKey: ['sellers'] });
    } catch (error) {
      console.error('Seller operation error:', error);
      toast.error("Failed to save seller");
    }
  };

  const handleDelete = async (sellerId: string) => {
    if (!confirm("Are you sure you want to delete this seller? This will also delete all associated phones.")) return;

    try {
      // Route through the backend so the soft-delete (archived_at) + cascade
      // protection + audit log are applied. A direct .delete() on the shim
      // issues a hard DELETE which SQLite may block on foreign keys.
      const res = await fetch(`/api/sellers/${sellerId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to delete seller.");

      toast.success("Seller deleted successfully");
      queryClient.invalidateQueries({ queryKey: ['sellers'] });
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error instanceof Error ? error.message : "Failed to delete seller");
    }
  };

  const generateSellerReport = (seller: any) => {
    const totalPhones = seller.phones?.length || 0;
    const soldPhones = seller.phones?.filter((p: any) => p.is_sold).length || 0;
    const totalPurchased = seller.phones?.reduce((sum: number, phone: any) => sum + Number(phone.purchase_price), 0) || 0;
    const totalRevenue = seller.phones?.filter((p: any) => p.is_sold).reduce((sum: number, phone: any) => sum + Number(phone.selling_price), 0) || 0;
    const profit = totalRevenue - seller.phones?.filter((p: any) => p.is_sold).reduce((sum: number, phone: any) => sum + Number(phone.purchase_price), 0);

    const reportHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>Seller Report - ${seller.name}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .seller-info { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        th { background-color: #f5f5f5; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .summary-item { text-align: center; padding: 15px; background: #e8f4fd; border-radius: 8px; }
        .profit { color: #16a34a; font-weight: bold; }
        .loss { color: #dc2626; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <h1>PhoneZone</h1>
        <h2>Seller Performance Report</h2>
        <p>Generated on: ${new Date().toLocaleDateString()}</p>
    </div>
    
    <div class="seller-info">
        <h3>Seller Information</h3>
        <p><strong>Name:</strong> ${seller.name}</p>
        <p><strong>Phone:</strong> ${seller.phone}</p>
        <p><strong>Address:</strong> ${seller.address}</p>
        <p><strong>ID Type:</strong> ${seller.id_proof_type}</p>
        <p><strong>ID Number:</strong> ${seller.id_number}</p>
        <p><strong>Partner Since:</strong> ${new Date(seller.created_at).toLocaleDateString()}</p>
    </div>

    <div class="summary">
        <div class="summary-item">
            <h3>${totalPhones}</h3>
            <p>Total Phones Supplied</p>
        </div>
        <div class="summary-item">
            <h3>${soldPhones}</h3>
            <p>Phones Sold</p>
        </div>
        <div class="summary-item">
            <h3>₹${totalPurchased.toLocaleString()}</h3>
            <p>Total Amount Paid</p>
        </div>
        <div class="summary-item">
            <h3>₹${totalRevenue.toLocaleString()}</h3>
            <p>Revenue Generated</p>
        </div>
        <div class="summary-item">
            <h3 class="${profit >= 0 ? 'profit' : 'loss'}">₹${profit.toLocaleString()}</h3>
            <p>Our Profit from Seller</p>
        </div>
        <div class="summary-item">
            <h3>${totalPhones > 0 ? Math.round((soldPhones / totalPhones) * 100) : 0}%</h3>
            <p>Sale Success Rate</p>
        </div>
    </div>

    <h3>Phone Inventory from Seller</h3>
    <table>
        <tr>
            <th>Phone Name</th>
            <th>Model</th>
            <th>Purchase Price</th>
            <th>Selling Price</th>
            <th>Status</th>
            <th>Profit/Loss</th>
        </tr>
        ${seller.phones?.map((phone: any) => `
            <tr>
                <td>${phone.phone_name}</td>
                <td>${phone.model}</td>
                <td>₹${phone.purchase_price}</td>
                <td>₹${phone.selling_price}</td>
                <td>${phone.is_sold ? 'Sold' : 'Available'}</td>
                <td class="${phone.is_sold && (phone.selling_price - phone.purchase_price) >= 0 ? 'profit' : 'loss'}">
                    ${phone.is_sold ? '₹' + (phone.selling_price - phone.purchase_price).toLocaleString() : 'N/A'}
                </td>
            </tr>
        `).join('') || '<tr><td colspan="6">No phones from this seller</td></tr>'}
    </table>
</body>
</html>`;

    const blob = new Blob([reportHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `seller_report_${seller.name}_${Date.now()}.html`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success("Seller report generated!");
  };

  const contactSeller = (phone: string) => {
    window.open(`tel:${phone}`, '_blank');
  };

  const whatsappSeller = (phone: string, name: string) => {
    const message = `Hello ${name}, this is PhoneZone. We have some updates regarding your phones.`;
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  if (isLoading) return <div>Loading sellers...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Seller Management</h2>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add Seller
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search sellers by name, phone, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Seller Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-500/30 p-4 rounded-xl shadow-xs">
          <div className="text-2xl font-black text-blue-700 dark:text-blue-300">{sellers?.length || 0}</div>
          <div className="text-sm font-semibold text-blue-800 dark:text-blue-400">Total Sellers</div>
        </div>
        <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 p-4 rounded-xl shadow-xs">
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
            {sellers?.filter(s => s.phones?.length > 0).length || 0}
          </div>
          <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-400">Active Sellers</div>
        </div>
        <div className="bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-500/30 p-4 rounded-xl shadow-xs">
          <div className="text-2xl font-black text-purple-700 dark:text-purple-300">
            {sellers?.reduce((sum, s) => sum + (s.phones?.length || 0), 0) || 0}
          </div>
          <div className="text-sm font-semibold text-purple-800 dark:text-purple-400">Total Phones Supplied</div>
        </div>
        <div className="bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/30 p-4 rounded-xl shadow-xs">
          <div className="text-2xl font-black text-amber-700 dark:text-amber-300">
            ₹{sellers?.reduce((sum, s) => sum + (s.phones?.reduce((ps: number, p: any) => ps + Number(p.purchase_price), 0) || 0), 0).toLocaleString() || 0}
          </div>
          <div className="text-sm font-semibold text-amber-800 dark:text-amber-400">Total Amount Paid</div>
        </div>
      </div>

      {/* Sellers Table */}
      {!sellers || sellers.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No sellers found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>ID Type</TableHead>
                <TableHead>Phones Supplied</TableHead>
                <TableHead>Phones Sold</TableHead>
                <TableHead>Total Paid</TableHead>
                <TableHead>Success Rate</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sellers.map((seller) => {
                const totalPhones = seller.phones?.length || 0;
                const soldPhones = seller.phones?.filter((p: any) => p.is_sold).length || 0;
                const successRate = totalPhones > 0 ? Math.round((soldPhones / totalPhones) * 100) : 0;
                const totalPaid = seller.phones?.reduce((sum: number, phone: any) => sum + Number(phone.purchase_price), 0) || 0;
                const sellerPhoto = (seller as any).seller_photo_url || (seller as any).photo_url || (seller.phones as any[])?.find((p: any) => p?.seller_photo_url)?.seller_photo_url;

                return (
                  <TableRow key={seller.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {sellerPhoto ? (
                          <img
                            src={sellerPhoto}
                            alt={seller.name}
                            className="h-10 w-10 rounded-full object-cover border border-gray-200 shrink-0 cursor-pointer hover:scale-105 hover:border-blue-400 transition-all shadow-xs"
                            onClick={() => {
                              setPreviewPhotoUrl(sellerPhoto);
                              setPreviewPhotoTitle(`${seller.name} - Seller Photo`);
                            }}
                            title="Click to view full-size photo"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
                            {seller.name?.charAt(0)?.toUpperCase() || "S"}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-gray-900">{seller.name}</div>
                          <div className="text-xs text-gray-500 truncate max-w-[180px]">{seller.address || "Address not specified"}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{seller.phone}</TableCell>
                    <TableCell>{seller.id_proof_type}</TableCell>
                    <TableCell>{totalPhones}</TableCell>
                    <TableCell>{soldPhones}</TableCell>
                    <TableCell>₹{totalPaid.toLocaleString()}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-sm ${
                        successRate >= 70 ? 'bg-green-100 text-green-800' :
                        successRate >= 40 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {successRate}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => contactSeller(seller.phone)}
                          title="Call Seller"
                        >
                          <Phone className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => whatsappSeller(seller.phone, seller.name)}
                          title="WhatsApp Seller"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => generateSellerReport(seller)}
                          title="Generate Report"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedSeller(seller);
                          setShowPhoneHistory(true);
                        }}
                        title="View Phone Supply History"
                      >
                        <Smartphone className="h-4 w-4" />
                      </Button>
                      {seller.phones && seller.phones.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const recentPhone = seller.phones[0];
                            setSapathPatraPhone({ ...(recentPhone as any), sellers: seller });
                          }}
                          title="View Legal Sapath Patra (शपथ पत्र)"
                          className="text-blue-700 hover:text-blue-800 hover:bg-blue-50 font-medium"
                        >
                          <ShieldCheck className="h-4 w-4 mr-1 text-blue-600" />
                          शपथ पत्र
                        </Button>
                      )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(seller)}
                          title="Edit Seller"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(seller.id)}
                          title="Delete Seller"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Seller Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Seller</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-gray-500">Scan the seller's Aadhaar to fill the details automatically.</p>
              <AadhaarScanButton onResult={applyAadhaar} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Seller Name *</Label>
                <Input
                  id="name"
                  placeholder="Enter seller name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>

              <div>
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  placeholder="Enter phone number"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  required
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  placeholder="Enter seller address"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                />
              </div>

              <div>
                <Label htmlFor="id_proof_type">ID Proof Type *</Label>
                <Select value={formData.id_proof_type} onValueChange={(value) => setFormData({...formData, id_proof_type: value as IdProofType})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select ID proof" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aadhaar">Aadhaar</SelectItem>
                    <SelectItem value="pan">PAN</SelectItem>
                    <SelectItem value="driving_license">Driving License</SelectItem>
                    <SelectItem value="voter_id">Voter ID</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="id_number">ID Number *</Label>
                <Input
                  id="id_number"
                  placeholder="Enter ID number"
                  value={formData.id_number}
                  onChange={(e) => setFormData({...formData, id_number: e.target.value})}
                  required
                />
              </div>

              <div className="md:col-span-2">
                <Label>Seller Photo</Label>
                <div className="flex items-center gap-3 mt-1.5">
                  {formData.seller_photo_url && (
                    <div className="relative group">
                      <img
                        src={formData.seller_photo_url}
                        alt="Preview"
                        className="h-14 w-14 rounded-lg object-cover border border-slate-300 shadow-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, seller_photo_url: "" })}
                        className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full h-4 w-4 flex items-center justify-center text-xs font-bold shadow-xs hover:bg-red-700"
                        title="Remove photo"
                      >
                        ×
                      </button>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    ref={photoInputRef}
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isUploadingPhoto}
                    onClick={() => photoInputRef.current?.click()}
                  >
                    <Camera className="h-4 w-4 mr-1.5" />
                    {isUploadingPhoto ? "Uploading..." : formData.seller_photo_url ? "Change Photo" : "Upload Photo"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-4">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit}>
                Add Seller
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Seller Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Seller</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-gray-500">Re-scan the Aadhaar to update empty fields.</p>
              <AadhaarScanButton onResult={applyAadhaar} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_name">Seller Name *</Label>
                <Input
                  id="edit_name"
                  placeholder="Enter seller name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>

              <div>
                <Label htmlFor="edit_phone">Phone Number *</Label>
                <Input
                  id="edit_phone"
                  placeholder="Enter phone number"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  required
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="edit_address">Address</Label>
                <Textarea
                  id="edit_address"
                  placeholder="Enter seller address"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                />
              </div>

              <div>
                <Label htmlFor="edit_id_proof_type">ID Proof Type *</Label>
                <Select value={formData.id_proof_type} onValueChange={(value) => setFormData({...formData, id_proof_type: value as IdProofType})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select ID proof" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aadhaar">Aadhaar</SelectItem>
                    <SelectItem value="pan">PAN</SelectItem>
                    <SelectItem value="driving_license">Driving License</SelectItem>
                    <SelectItem value="voter_id">Voter ID</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="edit_id_number">ID Number *</Label>
                <Input
                  id="edit_id_number"
                  placeholder="Enter ID number"
                  value={formData.id_number}
                  onChange={(e) => setFormData({...formData, id_number: e.target.value})}
                  required
                />
              </div>

              <div className="md:col-span-2">
                <Label>Seller Photo</Label>
                <div className="flex items-center gap-3 mt-1.5">
                  {formData.seller_photo_url && (
                    <div className="relative group">
                      <img
                        src={formData.seller_photo_url}
                        alt="Preview"
                        className="h-14 w-14 rounded-lg object-cover border border-slate-300 shadow-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, seller_photo_url: "" })}
                        className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full h-4 w-4 flex items-center justify-center text-xs font-bold shadow-xs hover:bg-red-700"
                        title="Remove photo"
                      >
                        ×
                      </button>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    ref={photoInputRef}
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isUploadingPhoto}
                    onClick={() => photoInputRef.current?.click()}
                  >
                    <Camera className="h-4 w-4 mr-1.5" />
                    {isUploadingPhoto ? "Uploading..." : formData.seller_photo_url ? "Change Photo" : "Upload Photo"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-4">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit}>
                Update Seller
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Return History Dialog */}
      <ReturnHistoryDialog
        open={showReturnHistory}
        onOpenChange={setShowReturnHistory}
        entityId={selectedSeller?.id || ""}
        entityType="seller"
        entityName={selectedSeller?.name || ""}
      />
      {/* Phone History Dialog */}
      <PhoneHistoryDialog
        open={showPhoneHistory}
        onOpenChange={setShowPhoneHistory}
        entityId={selectedSeller?.id || ""}
        entityType="seller"
        entityName={selectedSeller?.name || ""}
      />

      {/* Sapath Patra Modal */}
      <SapathPatraModal
        phone={sapathPatraPhone}
        open={!!sapathPatraPhone}
        onOpenChange={(o) => { if (!o) setSapathPatraPhone(null); }}
      />

      {/* Seller Full-Size Photo Preview Dialog */}
      <Dialog open={!!previewPhotoUrl} onOpenChange={() => setPreviewPhotoUrl(null)}>
        <DialogContent className="max-w-md p-4 bg-slate-900 text-white border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-100">
              {previewPhotoTitle || "Seller Photo"}
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
          <div className="flex justify-between items-center pt-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
              onClick={() => {
                if (!previewPhotoUrl) return;
                const a = document.createElement("a");
                a.href = previewPhotoUrl;
                a.download = `${(previewPhotoTitle || "seller").replace(/[^a-zA-Z0-9]/g, "_")}.jpg`;
                a.click();
              }}
            >
              Download Photo
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setPreviewPhotoUrl(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SellersTab;
