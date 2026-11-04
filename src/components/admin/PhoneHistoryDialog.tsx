import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto bg-slate-900 text-slate-100 border border-slate-800 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-100 text-base font-bold">
            <Phone className="h-5 w-5 text-sky-400" />
            Phone History - {entityName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-slate-400">Loading phone history...</p>
            </div>
          ) : !phones || phones.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-400">No phone records found for this {entityType}.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div className="bg-blue-950/40 border border-blue-900/60 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-400">{phones.length}</div>
                  <div className="text-xs font-semibold text-slate-300">Total Phones</div>
                </div>
                <div className="bg-emerald-950/40 border border-emerald-900/60 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-emerald-400">
                    {phones.filter(p => p.is_sold).length}
                  </div>
                  <div className="text-xs font-semibold text-slate-300">Sold</div>
                </div>
                <div className="bg-amber-950/40 border border-amber-900/60 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-amber-400">
                    {phones.filter(p => !p.is_sold).length}
                  </div>
                  <div className="text-xs font-semibold text-slate-300">In Stock</div>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-lg shadow overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-900 border-b border-slate-800">
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="text-slate-300 font-bold text-xs">Phone</TableHead>
                      <TableHead className="text-slate-300 font-bold text-xs">Model</TableHead>
                      <TableHead className="text-slate-300 font-bold text-xs">IMEI</TableHead>
                      <TableHead className="text-slate-300 font-bold text-xs">Condition</TableHead>
                      <TableHead className="text-slate-300 font-bold text-xs">Purchase Price</TableHead>
                      <TableHead className="text-slate-300 font-bold text-xs">Sale Price</TableHead>
                      <TableHead className="text-slate-300 font-bold text-xs">Status</TableHead>
                      <TableHead className="text-slate-300 font-bold text-xs">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {phones.map((phone) => (
                      <TableRow key={phone.id} className="border-b border-slate-800/80 hover:bg-slate-900/60">
                        <TableCell className="font-semibold text-slate-100">{phone.phone_name}</TableCell>
                        <TableCell className="text-slate-300">{phone.model}</TableCell>
                        <TableCell className="font-mono text-xs text-sky-400">{phone.imei_number || "N/A"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-slate-700 text-slate-300 bg-slate-900">
                            {phone.condition ? phone.condition.charAt(0).toUpperCase() + phone.condition.slice(1) : "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold text-slate-200">₹{phone.purchase_price?.toLocaleString() || "N/A"}</TableCell>
                        <TableCell className="font-semibold text-emerald-400">{phone.is_sold ? `₹${phone.selling_price?.toLocaleString()}` : "—"}</TableCell>
                        <TableCell>
                          <Badge className={phone.is_sold ? "bg-emerald-900/80 text-emerald-300 border border-emerald-700/60" : "bg-sky-900/80 text-sky-300 border border-sky-700/60"}>
                            {phone.is_sold ? "Sold" : "In Stock"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-400 text-xs">
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
