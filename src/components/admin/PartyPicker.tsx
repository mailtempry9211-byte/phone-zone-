/**
 * PartyPicker (Step 7) - one searchable picker for the people a bill is about.
 *
 * The same dialog serves customers AND sellers ("cross-picker"): search by
 * name, phone or ID number, pick a row, or clear the selection. ProcessSaleDialog
 * and AddPhoneDialog both use it instead of a plain dropdown, which stays
 * unusable once a shop has hundreds of parties.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, User, Phone, BadgeCheck, X } from "lucide-react";

export interface Party {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  id_proof_type?: string;
  id_number?: string;
}

interface PartyPickerProps {
  role: "customer" | "seller";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (party: Party) => void;
  /** Show a "clear" action (used when a party is already selected). */
  onClear?: () => void;
}

const PartyPicker = ({ role, open, onOpenChange, onSelect, onClear }: PartyPickerProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const term = searchTerm.trim();

  const { data: parties, isLoading } = useQuery({
    queryKey: [`party-picker-${role}`, term],
    queryFn: async () => {
      let query = supabase
        .from(role === "customer" ? "customers" : "sellers")
        .select("*")
        .order("name", { ascending: true })
        .limit(100);
      if (term) {
        query = query.or(
          `name.ilike.%${term}%,phone.ilike.%${term}%,id_number.ilike.%${term}%`,
        );
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Party[];
    },
    enabled: open,
  });

  const handleSelect = (party: Party) => {
    onSelect(party);
    onOpenChange(false);
    setSearchTerm("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setSearchTerm("");
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Select {role === "customer" ? "Customer" : "Seller"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              autoFocus
              placeholder="Search by name, phone or ID number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {onClear && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                onClear();
                onOpenChange(false);
                setSearchTerm("");
              }}
            >
              <X className="h-4 w-4 mr-2" />
              Clear selection
            </Button>
          )}

          {isLoading ? (
            <p className="text-sm text-gray-500 text-center py-6">Loading...</p>
          ) : !parties?.length ? (
            <p className="text-sm text-gray-500 text-center py-6">
              No {role}s found{term ? ` for "${term}"` : ""}.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {parties.map((party) => (
                <li key={party.id}>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                    onClick={() => handleSelect(party)}
                  >
                    <span className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-gray-500" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium truncate">{party.name}</span>
                      <span className="block text-xs text-gray-500 flex items-center gap-1">
                        {party.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {party.phone}
                          </span>
                        )}
                        {party.id_number && (
                          <span className="inline-flex items-center gap-1 ml-2">
                            <BadgeCheck className="h-3 w-3" />
                            {party.id_proof_type}: {party.id_number}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PartyPicker;
