
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface SellerSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSellerSelect: (seller: any) => void;
}

const SellerSelectDialog = ({ open, onOpenChange, onSellerSelect }: SellerSelectDialogProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: sellers, isLoading } = useQuery({
    queryKey: ['sellers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sellers')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: open
  });

  const filteredSellers = sellers?.filter(seller =>
    seller.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    seller.phone.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleSellerSelect = (seller: any) => {
    onSellerSelect(seller);
    onOpenChange(false);
    setSearchTerm("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Seller</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search sellers by name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => {
              onSellerSelect(null);
              onOpenChange(false);
              setSearchTerm("");
            }}
          >
            <User className="h-4 w-4 mr-2" />
            Add New Seller
          </Button>

          {isLoading ? (
            <div className="text-center py-8">Loading sellers...</div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredSellers.map((seller) => (
                <Card key={seller.id} className="cursor-pointer hover:bg-gray-50" onClick={() => handleSellerSelect(seller)}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">{seller.name}</h3>
                        <p className="text-sm text-gray-600">{seller.phone}</p>
                        <p className="text-xs text-gray-500 mt-1">{seller.address}</p>
                      </div>
                      <div className="text-xs text-gray-500">
                        <div>{seller.id_proof_type}: {seller.id_number}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {filteredSellers.length === 0 && !isLoading && (
                <div className="text-center py-8 text-gray-500">
                  No sellers found matching your search.
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SellerSelectDialog;
