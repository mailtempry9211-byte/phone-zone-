import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";
import { toast } from "sonner";

interface ReturnHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  entityType: 'seller' | 'customer';
  entityName: string;
}

const ReturnHistoryDialog = ({ open, onOpenChange, entityId, entityType, entityName }: ReturnHistoryDialogProps) => {
  
  const { data: returns, isLoading } = useQuery({
    queryKey: ['return-history', entityId, entityType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('returns')
        .select(`
          *,
          phones (phone_name, model, imei_number),
          customers (name),
          sellers (name)
        `)
        .eq(entityType === 'seller' ? 'seller_id' : 'customer_id', entityId)
        .order('return_date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: open && !!entityId
  });

  const generateReturnReport = () => {
    if (!returns || returns.length === 0) {
      toast.error("No return data to export");
      return;
    }

    const totalReturns = returns.length;
    const salesReturns = returns.filter(r => r.return_type === 'sales_return').length;
    const purchaseReturns = returns.filter(r => r.return_type === 'purchase_return').length;
    const totalAmount = returns.reduce((sum, r) => sum + Number(r.return_amount), 0);

    const reportHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>Return History - ${entityName}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .entity-info { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        th { background-color: #f5f5f5; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .summary-item { text-align: center; padding: 15px; background: #e8f4fd; border-radius: 8px; }
        .sales-return { color: #dc2626; }
        .purchase-return { color: #16a34a; }
    </style>
</head>
<body>
    <div class="header">
        <h1>PhoneZone</h1>
        <h2>Return History Report</h2>
        <p>Generated on: ${new Date().toLocaleDateString()}</p>
    </div>
    
    <div class="entity-info">
        <h3>${entityType === 'seller' ? 'Seller' : 'Customer'} Information</h3>
        <p><strong>Name:</strong> ${entityName}</p>
        <p><strong>Report Type:</strong> ${entityType === 'seller' ? 'Seller Returns' : 'Customer Returns'}</p>
    </div>

    <div class="summary">
        <div class="summary-item">
            <h3>${totalReturns}</h3>
            <p>Total Returns</p>
        </div>
        <div class="summary-item">
            <h3>${salesReturns}</h3>
            <p>Sales Returns</p>
        </div>
        <div class="summary-item">
            <h3>${purchaseReturns}</h3>
            <p>Purchase Returns</p>
        </div>
        <div class="summary-item">
            <h3>₹${totalAmount.toLocaleString()}</h3>
            <p>Total Return Amount</p>
        </div>
    </div>

    <h3>Return Details</h3>
    <table>
        <tr>
            <th>Return Date</th>
            <th>Phone</th>
            <th>IMEI</th>
            <th>Return Type</th>
            <th>Amount</th>
            <th>Reason</th>
            <th>Notes</th>
        </tr>
        ${returns.map(returnItem => `
            <tr>
                <td>${new Date(returnItem.return_date).toLocaleDateString()}</td>
                <td>${returnItem.phones?.phone_name} ${returnItem.phones?.model}</td>
                <td>${returnItem.phones?.imei_number}</td>
                <td class="${returnItem.return_type.replace('_', '-')}">${returnItem.return_type.replace('_', ' ').toUpperCase()}</td>
                <td>₹${Number(returnItem.return_amount).toLocaleString()}</td>
                <td>${returnItem.return_reason}</td>
                <td>${returnItem.notes || 'N/A'}</td>
            </tr>
        `).join('')}
    </table>
</body>
</html>`;

    const blob = new Blob([reportHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `return_history_${entityType}_${entityName}_${Date.now()}.html`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success("Return history report generated!");
  };

  if (isLoading) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Return History - {entityName}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={generateReturnReport}
              disabled={!returns || returns.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </DialogTitle>
        </DialogHeader>

        {!returns || returns.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No return history found for this {entityType}.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{returns.length}</div>
                <div className="text-sm text-blue-700">Total Returns</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {returns.filter(r => r.return_type === 'sales_return').length}
                </div>
                <div className="text-sm text-red-700">Sales Returns</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {returns.filter(r => r.return_type === 'purchase_return').length}
                </div>
                <div className="text-sm text-green-700">Purchase Returns</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  ₹{returns.reduce((sum, r) => sum + Number(r.return_amount), 0).toLocaleString()}
                </div>
                <div className="text-sm text-purple-700">Total Return Amount</div>
              </div>
            </div>

            {/* Returns Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Return Date</TableHead>
                    <TableHead>Phone Details</TableHead>
                    <TableHead>Return Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Processed By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returns.map((returnItem) => (
                    <TableRow key={returnItem.id}>
                      <TableCell>
                        {new Date(returnItem.return_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">
                            {returnItem.phones?.phone_name} {returnItem.phones?.model}
                          </div>
                          <div className="text-sm text-gray-500">
                            IMEI: {returnItem.phones?.imei_number}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={returnItem.return_type === 'sales_return' ? 'destructive' : 'default'}
                        >
                          {returnItem.return_type === 'sales_return' ? 'Sales Return' : 'Purchase Return'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        ₹{Number(returnItem.return_amount).toLocaleString()}
                      </TableCell>
                      <TableCell>{returnItem.return_reason}</TableCell>
                      <TableCell>{returnItem.notes || 'N/A'}</TableCell>
                      <TableCell>{returnItem.processed_by}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ReturnHistoryDialog;