import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, UserCheck, Loader2, Phone, MapPin, User, Building2, Wrench } from "lucide-react";

export interface ContactItem {
  id: string;
  name: string;
  phone: string;
  address?: string | null;
  id_proof_type?: string | null;
  id_number?: string | null;
  source: "customer" | "seller" | "repair_customer" | "dealer";
  source_label: string;
}

interface RepairContactPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (contact: ContactItem) => void;
}

export const RepairContactPickerDialog: React.FC<RepairContactPickerDialogProps> = ({
  open,
  onOpenChange,
  onSelect,
}) => {
  const [query, setQuery] = useState("");
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      searchContacts(query);
    }
  }, [open]);

  const searchContacts = async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/repair/contacts/search?q=${encodeURIComponent(q)}&limit=25`);
      if (res.ok) {
        const data = await res.json();
        setContacts(Array.isArray(data) ? data : []);
      }
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    searchContacts(val);
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case "customer":
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-[10px]">Store Customer</Badge>;
      case "seller":
        return <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">Registered Seller</Badge>;
      case "dealer":
        return <Badge className="bg-purple-100 text-purple-800 border-purple-300 text-[10px]">B2B Dealer</Badge>;
      default:
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">Repair Customer</Badge>;
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "dealer":
        return <Building2 className="w-4 h-4 text-purple-600" />;
      case "repair_customer":
        return <Wrench className="w-4 h-4 text-emerald-600" />;
      default:
        return <User className="w-4 h-4 text-blue-600" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-4">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-blue-600" />
            <DialogTitle className="text-base font-bold text-gray-900">
              Select Contact (Customer / Seller / Dealer)
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-gray-500">
            Search previous repair customers, phone sales buyers, sellers, or wholesale dealers to auto-fill details.
          </DialogDescription>
        </DialogHeader>

        {/* Search Input */}
        <div className="relative my-2">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by contact name or 10-digit mobile number..."
            value={query}
            onChange={handleSearchChange}
            className="pl-9 text-xs"
            autoFocus
          />
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[200px] max-h-[380px]">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-xs text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin mr-1.5 text-blue-500" /> Searching contacts...
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-500">
              No contacts found matching &quot;{query}&quot;. You can enter details manually.
            </div>
          ) : (
            contacts.map((c) => (
              <div
                key={`${c.source}-${c.id}`}
                onClick={() => {
                  onSelect(c);
                  onOpenChange(false);
                }}
                className="p-2.5 rounded-lg border bg-white hover:bg-blue-50/50 hover:border-blue-300 transition-all cursor-pointer flex items-center justify-between gap-2"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="p-1.5 rounded-full bg-slate-100 shrink-0 mt-0.5">
                    {getSourceIcon(c.source)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-xs text-gray-900 truncate">{c.name}</span>
                      {getSourceBadge(c.source)}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-600 mt-0.5">
                      <Phone className="w-3 h-3 text-gray-400 shrink-0" />
                      <span className="font-mono">{c.phone}</span>
                      {c.address && (
                        <>
                          <span className="text-gray-300">•</span>
                          <span className="truncate max-w-[160px] text-gray-500">{c.address}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <Button size="sm" variant="outline" className="h-7 text-xs px-2.5 text-blue-700 hover:bg-blue-600 hover:text-white shrink-0">
                  Use
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RepairContactPickerDialog;

