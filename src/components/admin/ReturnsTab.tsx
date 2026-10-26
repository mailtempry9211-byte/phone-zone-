import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Search, ArrowLeftRight, FileText, Undo2, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/utils/numberToWords";
import { printHtml } from "@/lib/printHtml";

const ReturnsTab = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [returnTypeFilter, setReturnTypeFilter] = useState("all");
  const [showProcessReturnDialog, setShowProcessReturnDialog] = useState(false);
  const [selectedPhone, setSelectedPhone] = useState<any>(null);
  const [returnForm, setReturnForm] = useState({
    return_type: "",
    return_amount: "",
    return_reason: "",
    notes: ""
  });

  const queryClient = useQueryClient();

  // Fetch all returns
  const { data: returns, isLoading: returnsLoading } = useQuery({
    queryKey: ['returns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('returns')
        .select(`
          *,
          phones (
            phone_name,
            model,
            variant,
            colour,
            imei_number,
            purchase_price,
            selling_price
          ),
          customers (
            name,
            phone
          ),
          sellers (
            name,
            phone
          )
        `)
        .order('return_date', { ascending: false });

      if (error) throw error;
      return data;
    }
  });

  // Fetch phones that can be returned (sold phones for sales return, unsold phones for purchase return)
  const { data: returnablePhones } = useQuery({
    queryKey: ['returnable-phones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phones')
        .select(`
          *,
          customers (name, phone),
          sellers (name, phone)
        `)
        .or('is_sold.eq.true,is_sold.eq.false')
        .is('return_status', null);

      if (error) throw error;
      return data;
    }
  });

  // Process return mutation
  const processReturnMutation = useMutation({
    mutationFn: async (returnData: {
      phone_id: string;
      return_type: string;
      return_amount: number;
      return_reason: string;
      notes?: string;
      customer_id?: string;
      seller_id?: string;
    }) => {
      const { data, error } = await supabase.rpc('process_phone_return', {
        p_phone_id: returnData.phone_id,
        p_return_type: returnData.return_type,
        p_return_amount: returnData.return_amount,
        p_return_reason: returnData.return_reason,
        p_notes: returnData.notes || '',
        p_customer_id: returnData.customer_id,
        p_seller_id: returnData.seller_id
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Return processed successfully");
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['phones'] });
      queryClient.invalidateQueries({ queryKey: ['returnable-phones'] });
      setShowProcessReturnDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(`Error processing return: ${error.message}`);
    }
  });

  // Create the stored procedure if it doesn't exist
  const { data: adminSettings } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('*')
        .single();

      if (error) throw error;
      return data;
    }
  });

  const filteredReturns = useMemo(() => {
    if (!returns) return [];
    
    return returns.filter(returnItem => {
      const matchesSearch = !searchTerm || 
        returnItem.phones?.phone_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        returnItem.phones?.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        returnItem.return_reason?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = returnTypeFilter === "all" || returnItem.return_type === returnTypeFilter;
      
      return matchesSearch && matchesType;
    });
  }, [returns, searchTerm, returnTypeFilter]);

  const resetForm = () => {
    setReturnForm({
      return_type: "",
      return_amount: "",
      return_reason: "",
      notes: ""
    });
    setSelectedPhone(null);
  };

  const openProcessReturn = (phone: any, type: 'sales_return' | 'purchase_return') => {
    setSelectedPhone(phone);
    setReturnForm({
      return_type: type,
      return_amount: type === 'sales_return' ? phone.selling_price : phone.purchase_price,
      return_reason: "",
      notes: ""
    });
    setShowProcessReturnDialog(true);
  };

  const handleProcessReturn = () => {
    if (!selectedPhone || !returnForm.return_type || !returnForm.return_amount || !returnForm.return_reason) {
      toast.error("Please fill all required fields");
      return;
    }

    processReturnMutation.mutate({
      phone_id: selectedPhone.id,
      return_type: returnForm.return_type,
      return_amount: parseFloat(returnForm.return_amount),
      return_reason: returnForm.return_reason,
      notes: returnForm.notes,
      customer_id: selectedPhone.customer_id,
      seller_id: selectedPhone.seller_id
    });
  };

  const generateReturnInvoice = (returnItem: any, type: 'html' | 'pdf' = 'html') => {
    const invoiceHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${returnItem.return_type === 'sales_return' ? 'Sales' : 'Purchase'} Return Invoice</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
          .company-name { font-size: 28px; font-weight: bold; color: #333; }
          .tagline { font-size: 14px; color: #666; margin-top: 5px; }
          .invoice-title { font-size: 24px; font-weight: bold; color: #e74c3c; margin-top: 20px; }
          .content { display: flex; justify-content: space-between; margin-bottom: 30px; }
          .left-column, .right-column { width: 48%; }
          .info-section { margin-bottom: 20px; }
          .info-section h3 { color: #333; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
          .phone-details { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .amount-section { background: #e8f5e9; padding: 15px; border-radius: 5px; text-align: center; }
          .amount { font-size: 20px; font-weight: bold; color: #2e7d32; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${adminSettings?.business_name || ''}</div>
          <div class="tagline">${adminSettings?.business_tagline || ''}</div>              <div style="font-size: 12px; color: #555; margin-top: 4px;"><strong>Udyam Reg. No:</strong> ${adminSettings?.udyam_number || ""}</div>
          <div class="invoice-title">${returnItem.return_type === 'sales_return' ? 'SALES' : 'PURCHASE'} RETURN INVOICE</div>
        </div>
        
        <div class="content">
          <div class="left-column">
            <div class="info-section">
              <h3>Return Details</h3>
              <p><strong>Return ID:</strong> ${returnItem.id}</p>
              <p><strong>Return Date:</strong> ${format(new Date(returnItem.return_date), 'dd/MM/yyyy hh:mm a')}</p>
              <p><strong>Return Type:</strong> ${returnItem.return_type === 'sales_return' ? 'Sales Return' : 'Purchase Return'}</p>
              <p><strong>Processed By:</strong> ${returnItem.processed_by || 'Admin'}</p>
            </div>
            
            ${returnItem.return_type === 'sales_return' && returnItem.customers ? `
            <div class="info-section">
              <h3>Customer Information</h3>
              <p><strong>Name:</strong> ${returnItem.customers.name}</p>
              <p><strong>Phone:</strong> ${returnItem.customers.phone}</p>
            </div>
            ` : ''}
            
            ${returnItem.return_type === 'purchase_return' && returnItem.sellers ? `
            <div class="info-section">
              <h3>Seller Information</h3>
              <p><strong>Name:</strong> ${returnItem.sellers.name}</p>
              <p><strong>Phone:</strong> ${returnItem.sellers.phone}</p>
            </div>
            ` : ''}
          </div>
          
          <div class="right-column">
            <div class="info-section">
              <h3>Business Information</h3>
              <p><strong>Address:</strong> ${adminSettings?.address || ''}</p>
              <p><strong>Phone:</strong> ${adminSettings?.phone_primary || ''}</p>
              <p><strong>Email:</strong> ${adminSettings?.email || ''}</p>
              <p><strong>Instagram:</strong> ${adminSettings?.instagram || ''}</p>
            </div>
          </div>
        </div>
        
        <div class="phone-details">
          <h3>Phone Details</h3>
          <p><strong>Phone:</strong> ${returnItem.phones?.phone_name} ${returnItem.phones?.model}</p>
          <p><strong>Variant:</strong> ${returnItem.phones?.variant || '-'}</p>
          <p><strong>Colour:</strong> ${returnItem.phones?.colour || '-'}</p>
          <p><strong>IMEI:</strong> ${returnItem.phones?.imei_number}</p>
          <p><strong>Original Purchase Price:</strong> ₹${returnItem.phones?.purchase_price?.toLocaleString()}</p>
          <p><strong>Original Selling Price:</strong> ₹${returnItem.phones?.selling_price?.toLocaleString()}</p>
        </div>
        
        <div class="info-section">
          <h3>Return Reason</h3>
          <p>${returnItem.return_reason}</p>
          ${returnItem.notes ? `<p><strong>Notes:</strong> ${returnItem.notes}</p>` : ''}
        </div>
        
        <div class="amount-section">
          <div class="amount">Return Amount: ₹${returnItem.return_amount?.toLocaleString()}</div>
          <p style="margin-top: 10px; font-size: 14px;">
            Amount in words: ${formatCurrency(returnItem.return_amount)}
          </p>
        </div>
        
        <div class="footer">
          <p>Thank you for your business!</p>
          <p style="font-size: 12px;">This is a computer-generated invoice.</p>
        </div>
      </body>
      </html>
    `;

    if (type === 'pdf' || type === 'html') {
      printHtml(invoiceHTML);
    }
  };

  const getReturnTypeBadge = (type: string) => {
    return type === 'sales_return' ? (
      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
        <Undo2 className="w-3 h-3 mr-1" />
        Sales Return
      </Badge>
    ) : (
      <Badge variant="secondary" className="bg-orange-100 text-orange-800">
        <RotateCcw className="w-3 h-3 mr-1" />
        Purchase Return
      </Badge>
    );
  };

  if (returnsLoading) {
    return <div className="flex justify-center p-8">Loading returns...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Returns Management</h2>
          <p className="text-gray-600">Process and track phone returns</p>
        </div>
        
        <div className="flex gap-2">
          <Select onValueChange={(phone_id: string) => {
            const phone = returnablePhones?.find(p => p.id === phone_id);
            if (phone) {
              openProcessReturn(phone, phone.is_sold ? 'sales_return' : 'purchase_return');
            }
          }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Process Return" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="header-sold" disabled>
                <div className="font-semibold text-blue-600">Sold Phones (Sales Return)</div>
              </SelectItem>
              {returnablePhones?.filter(p => p.is_sold).map((phone) => (
                <SelectItem key={`sold-${phone.id}`} value={phone.id}>
                  {phone.phone_name} {phone.model} - ₹{phone.selling_price}
                </SelectItem>
              ))}
              <SelectItem value="header-inventory" disabled>
                <div className="font-semibold text-orange-600">Inventory (Purchase Return)</div>
              </SelectItem>
              {returnablePhones?.filter(p => !p.is_sold).map((phone) => (
                <SelectItem key={`inventory-${phone.id}`} value={phone.id}>
                  {phone.phone_name} {phone.model} - ₹{phone.purchase_price}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search returns..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={returnTypeFilter} onValueChange={setReturnTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Return Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="sales_return">Sales Returns</SelectItem>
            <SelectItem value="purchase_return">Purchase Returns</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Returns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredReturns.map((returnItem) => (
          <Card key={returnItem.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-lg">
                    {returnItem.phones?.phone_name} {returnItem.phones?.model}
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    IMEI: {returnItem.phones?.imei_number}
                  </p>
                </div>
                {getReturnTypeBadge(returnItem.return_type)}
              </div>
            </CardHeader>
            
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Return Date:</span>
                <span className="font-medium">
                  {format(new Date(returnItem.return_date), 'dd/MM/yyyy')}
                </span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Return Amount:</span>
                <span className="font-medium text-green-600">
                  ₹{returnItem.return_amount?.toLocaleString()}
                </span>
              </div>
              
              <div className="text-sm">
                <span className="text-gray-600">Reason:</span>
                <p className="mt-1 text-gray-800">{returnItem.return_reason}</p>
              </div>
              
              {returnItem.return_type === 'sales_return' && returnItem.customers && (
                <div className="text-sm">
                  <span className="text-gray-600">Customer:</span>
                  <p className="font-medium">{returnItem.customers.name}</p>
                </div>
              )}
              
              {returnItem.return_type === 'purchase_return' && returnItem.sellers && (
                <div className="text-sm">
                  <span className="text-gray-600">Seller:</span>
                  <p className="font-medium">{returnItem.sellers.name}</p>
                </div>
              )}
              
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateReturnInvoice(returnItem, 'html')}
                  className="flex-1"
                >
                  <FileText className="w-4 h-4 mr-1" />
                  Invoice
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateReturnInvoice(returnItem, 'pdf')}
                  className="flex-1"
                >
                  PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredReturns.length === 0 && (
        <div className="text-center py-12">
          <ArrowLeftRight className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No returns found</h3>
          <p className="text-gray-600">No returns match your current filters.</p>
        </div>
      )}

      {/* Process Return Dialog */}
      <Dialog open={showProcessReturnDialog} onOpenChange={setShowProcessReturnDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Process {returnForm.return_type === 'sales_return' ? 'Sales' : 'Purchase'} Return
            </DialogTitle>
          </DialogHeader>
          
          {selectedPhone && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-3 rounded">
                <p className="font-medium">{selectedPhone.phone_name} {selectedPhone.model}</p>
                <p className="text-sm text-gray-600">IMEI: {selectedPhone.imei_number}</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="return_amount">Return Amount (₹)</Label>
                <Input
                  id="return_amount"
                  type="number"
                  value={returnForm.return_amount}
                  onChange={(e) => setReturnForm(prev => ({ ...prev, return_amount: e.target.value }))}
                  placeholder="Enter return amount"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="return_reason">Return Reason *</Label>
                <Textarea
                  id="return_reason"
                  value={returnForm.return_reason}
                  onChange={(e) => setReturnForm(prev => ({ ...prev, return_reason: e.target.value }))}
                  placeholder="Enter reason for return"
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  value={returnForm.notes}
                  onChange={(e) => setReturnForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Any additional notes"
                  rows={2}
                />
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowProcessReturnDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleProcessReturn}
                  disabled={processReturnMutation.isPending}
                >
                  {processReturnMutation.isPending ? "Processing..." : "Process Return"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReturnsTab;