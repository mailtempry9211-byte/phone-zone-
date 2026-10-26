import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";

interface PhoneHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  entityType: "seller" | "customer";
  entityName: string;
}

const PhoneHistoryDialog = ({ open, onOpenChange, entityId, entityType, entityName }: PhoneHistoryDialogProps) => {
  const { data: phones, isLoading } = useQuery({
    queryKey: ["phone-history", entityId, entityType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("phones")
        .select(`
          *,
          sellers (name, phone),
          customers (name, phone)
        `)
        .eq(entityType === "seller" ? "seller_id" : "customer_id", entityId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: open && !!entityId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Phone History - {entityName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading phone history...</p>
            </div>
          ) : !phones || phones.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No phone records found for this {entityType}.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{phones.length}</div>
                  <div className="text-sm text-gray-600">Total Phones</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {phones.filter(p => p.is_sold).length}
                  </div>
                  <div className="text-sm text-gray-600">Sold</div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">
                    {phones.filter(p => !p.is_sold).length}
                  </div>
                  <div className="text-sm text-gray-600">In Stock</div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Phone</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>IMEI</TableHead>
                      <TableHead>Condition</TableHead>
                      <TableHead>Purchase Price</TableHead>
                      <TableHead>Sale Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {phones.map((phone) => (
                      <TableRow key={phone.id}>
                        <TableCell className="font-medium">{phone.phone_name}</TableCell>
                        <TableCell>{phone.model}</TableCell>
                        <TableCell className="font-mono text-xs">{phone.imei_number || "N/A"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {phone.condition ? phone.condition.charAt(0).toUpperCase() + phone.condition.slice(1) : "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell>₹{phone.purchase_price?.toLocaleString() || "N/A"}</TableCell>
                        <TableCell>{phone.is_sold ? `₹${phone.selling_price?.toLocaleString()}` : "N/A"}</TableCell>
                        <TableCell>
                          <Badge variant={phone.is_sold ? "default" : "secondary"}>
                            {phone.is_sold ? "Sold" : "In Stock"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {phone.purchase_date ? new Date(phone.purchase_date).toLocaleDateString() : "N/A"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PhoneHistoryDialog;

