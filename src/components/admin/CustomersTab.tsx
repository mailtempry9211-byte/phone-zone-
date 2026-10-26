import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, Search, Phone, MessageSquare, FileText, History, Smartphone } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import ReturnHistoryDialog from "./ReturnHistoryDialog";
import PhoneHistoryDialog from "./PhoneHistoryDialog";
import AadhaarScanButton from "./AadhaarScanButton";
import { fillPersonFields, type AadhaarData } from "@/lib/aadhaarParser";

type IdProofType = Database["public"]["Enums"]["id_proof_type"];

const CustomersTab = () => {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showReturnHistory, setShowReturnHistory] = useState(false);
  const [showPhoneHistory, setShowPhoneHistory] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
    id_proof_type: "" as IdProofType,
    id_number: ""
  });

  // Step 3: offline Aadhaar OCR fills name/address/number, never overwrites
  // what the user already typed.
  const applyAadhaar = (d: AadhaarData) =>
    setFormData((prev) => ({ ...fillPersonFields(prev, d), id_proof_type: "aadhaar" as IdProofType }));

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('customers')
        .select(`
          *,
          phones (id, phone_name, model, selling_price, sold_date)
        `)
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,id_number.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const resetForm = () => {
    setFormData({
      name: "",
      phone: "",
      address: "",
      id_proof_type: "" as IdProofType,
      id_number: ""
    });
  };

  const handleAdd = () => {
    resetForm();
    setShowAddDialog(true);
  };

  const handleEdit = (customer: any) => {
    setSelectedCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      id_proof_type: customer.id_proof_type as IdProofType,
      id_number: customer.id_number
    });
    setShowEditDialog(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.phone || !formData.id_proof_type || !formData.id_number) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      if (selectedCustomer) {
        // Update existing customer
        const { error } = await supabase
          .from('customers')
          .update({
            name: formData.name,
            phone: formData.phone,
            address: formData.address,
            id_proof_type: formData.id_proof_type,
            id_number: formData.id_number,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedCustomer.id);

        if (error) throw error;
        toast.success("Customer updated successfully!");
        setShowEditDialog(false);
      } else {
        // Add new customer
        const { error } = await supabase
          .from('customers')
          .insert({
            name: formData.name,
            phone: formData.phone,
            address: formData.address,
            id_proof_type: formData.id_proof_type,
            id_number: formData.id_number
          });

        if (error) throw error;
        toast.success("Customer added successfully!");
        setShowAddDialog(false);
      }

      resetForm();
      setSelectedCustomer(null);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    } catch (error) {
      console.error('Customer operation error:', error);
      toast.error("Failed to save customer");
    }
  };

  const handleDelete = async (customerId: string) => {
    if (!confirm("Are you sure you want to delete this customer?")) return;

    try {
      // Route through the backend so the soft-delete (archived_at) + audit log
      // are applied. A direct .delete() on the shim issues a hard DELETE.
      const res = await fetch(`/api/customers/${customerId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to delete customer.");

      toast.success("Customer deleted successfully");
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error instanceof Error ? error.message : "Failed to delete customer");
    }
  };

  const generateCustomerReport = (customer: any) => {
    const totalPurchases = customer.phones?.length || 0;
    const totalSpent = customer.phones?.reduce((sum: number, phone: any) => sum + Number(phone.selling_price), 0) || 0;

    const reportHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>Customer Report - ${customer.name}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .customer-info { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        th { background-color: #f5f5f5; }
        .summary { display: flex; justify-content: space-around; margin: 20px 0; }
        .summary-item { text-align: center; padding: 15px; background: #e8f4fd; border-radius: 8px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>PhoneZone</h1>
        <h2>Customer Report</h2>
        <p>Generated on: ${new Date().toLocaleDateString()}</p>
    </div>
    
    <div class="customer-info">
        <h3>Customer Information</h3>
        <p><strong>Name:</strong> ${customer.name}</p>
        <p><strong>Phone:</strong> ${customer.phone}</p>
        <p><strong>Address:</strong> ${customer.address}</p>
        <p><strong>ID Type:</strong> ${customer.id_proof_type}</p>
        <p><strong>ID Number:</strong> ${customer.id_number}</p>
        <p><strong>Customer Since:</strong> ${new Date(customer.created_at).toLocaleDateString()}</p>
    </div>

    <div class="summary">
        <div class="summary-item">
            <h3>${totalPurchases}</h3>
            <p>Total Purchases</p>
        </div>
        <div class="summary-item">
            <h3>₹${totalSpent.toLocaleString()}</h3>
            <p>Total Amount Spent</p>
        </div>
    </div>

    <h3>Purchase History</h3>
    <table>
        <tr>
            <th>Phone</th>
            <th>Model</th>
            <th>Price Paid</th>
            <th>Purchase Date</th>
        </tr>
        ${customer.phones?.map((phone: any) => `
            <tr>
                <td>${phone.phone_name}</td>
                <td>${phone.model}</td>
                <td>₹${phone.selling_price}</td>
                <td>${new Date(phone.sold_date).toLocaleDateString()}</td>
            </tr>
        `).join('') || '<tr><td colspan="4">No purchases yet</td></tr>'}
    </table>
</body>
</html>`;

    const blob = new Blob([reportHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `customer_report_${customer.name}_${Date.now()}.html`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success("Customer report generated!");
  };

  const contactCustomer = (phone: string) => {
    window.open(`tel:${phone}`, '_blank');
  };

  const whatsappCustomer = (phone: string, name: string) => {
    const message = `Hello ${name}, this is PhoneZone. Thank you for choosing us!`;
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  if (isLoading) return <div>Loading customers...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Customer Management</h2>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search customers by name, phone, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Customer Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{customers?.length || 0}</div>
          <div className="text-sm text-blue-700">Total Customers</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-600">
            {customers?.filter(c => c.phones?.length > 0).length || 0}
          </div>
          <div className="text-sm text-green-700">Active Customers</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-purple-600">
            ₹{customers?.reduce((sum, c) => sum + (c.phones?.reduce((s: number, p: any) => s + Number(p.selling_price), 0) || 0), 0).toLocaleString() || 0}
          </div>
          <div className="text-sm text-purple-700">Total Revenue</div>
        </div>
      </div>

      {/* Customers Table */}
      {!customers || customers.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No customers found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>ID Type</TableHead>
                <TableHead>Purchases</TableHead>
                <TableHead>Total Spent</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell>{customer.phone}</TableCell>
                  <TableCell>{customer.id_proof_type}</TableCell>
                  <TableCell>{customer.phones?.length || 0}</TableCell>
                  <TableCell>
                    ₹{customer.phones?.reduce((sum: number, phone: any) => sum + Number(phone.selling_price), 0).toLocaleString() || 0}
                  </TableCell>
                  <TableCell>{new Date(customer.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => contactCustomer(customer.phone)}
                        title="Call Customer"
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => whatsappCustomer(customer.phone, customer.name)}
                        title="WhatsApp Customer"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateCustomerReport(customer)}
                        title="Generate Report"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setShowReturnHistory(true);
                        }}
                        title="View Return History"
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setShowPhoneHistory(true);
                        }}
                        title="View Phone Purchase History"
                      >
                        <Smartphone className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(customer)}
                        title="Edit Customer"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(customer.id)}
                        title="Delete Customer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Customer Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-gray-500">Scan the customer's Aadhaar to fill the details automatically.</p>
              <AadhaarScanButton onResult={applyAadhaar} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Customer Name *</Label>
                <Input
                  id="name"
                  placeholder="Enter customer name"
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
                  placeholder="Enter customer address"
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
            </div>

            <div className="flex justify-end space-x-4">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit}>
                Add Customer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-gray-500">Re-scan the Aadhaar to update empty fields.</p>
              <AadhaarScanButton onResult={applyAadhaar} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_name">Customer Name *</Label>
                <Input
                  id="edit_name"
                  placeholder="Enter customer name"
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
                  placeholder="Enter customer address"
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
            </div>

            <div className="flex justify-end space-x-4">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit}>
                Update Customer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Return History Dialog */}
      <ReturnHistoryDialog
        open={showReturnHistory}
        onOpenChange={setShowReturnHistory}
        entityId={selectedCustomer?.id || ""}
        entityType="customer"
        entityName={selectedCustomer?.name || ""}
      />
      {/* Phone History Dialog */}
      <PhoneHistoryDialog
        open={showPhoneHistory}
        onOpenChange={setShowPhoneHistory}
        entityId={selectedCustomer?.id || ""}
        entityType="customer"
        entityName={selectedCustomer?.name || ""}
      />
    </div>
  );
};

export default CustomersTab;
