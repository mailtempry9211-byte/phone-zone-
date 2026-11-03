import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, ArrowRight, UserCheck, ShieldCheck, History } from "lucide-react";
import { toast } from "sonner";

export interface MatchedParty {
  role: "seller" | "customer" | "dealer" | "repair_customer";
  id: string;
  name: string;
  phone: string;
  address?: string;
  id_proof_type?: string;
  id_number?: string;
  photo_url?: string;
  signature_url?: string;
  summary: string;
  txCount: number;
  txTotal: number;
}

interface InterconnectedPartyLookupProps {
  phone: string;
  currentRole?: "seller" | "customer" | "repair";
  onApply: (party: {
    id: string;
    name: string;
    phone: string;
    address?: string;
    id_proof_type?: string;
    id_number?: string;
    photo_url?: string;
    signature_url?: string;
    role: string;
  }) => void;
}

export const InterconnectedPartyLookup: React.FC<InterconnectedPartyLookupProps> = ({
  phone,
  currentRole,
  onApply,
}) => {
  const [lookupData, setLookupData] = useState<{
    found: boolean;
    primary: MatchedParty | null;
    matches: MatchedParty[];
  } | null>(null);
  const [applied, setApplied] = useState(false);

  const cleanPhone = (phone || "").replace(/\D/g, "").slice(-10);

  useEffect(() => {
    if (cleanPhone.length !== 10) {
      setLookupData(null);
      setApplied(false);
      return;
    }

    let isSubscribed = true;
    fetch(`/api/people/lookup?phone=${cleanPhone}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isSubscribed) return;
        if (data && data.found && data.matches?.length > 0) {
          setLookupData(data);
        } else {
          setLookupData(null);
        }
      })
      .catch(() => {
        if (isSubscribed) setLookupData(null);
      });

    return () => {
      isSubscribed = false;
    };
  }, [cleanPhone]);

  if (!lookupData || !lookupData.found || !lookupData.primary) {
    return null;
  }

  const primary = lookupData.primary;

  const handleApply = (targetParty: MatchedParty) => {
    onApply({
      id: targetParty.id,
      name: targetParty.name,
      phone: targetParty.phone,
      address: targetParty.address,
      id_proof_type: targetParty.id_proof_type,
      id_number: targetParty.id_number,
      photo_url: targetParty.photo_url,
      signature_url: targetParty.signature_url,
      role: targetParty.role,
    });
    setApplied(true);
    toast.success(`Loaded details for ${targetParty.name}`);
  };

  return (
    <div className="my-3 p-3.5 rounded-xl border border-cyan-500/40 bg-gradient-to-r from-blue-950/30 via-slate-900/60 to-cyan-950/30 backdrop-blur-sm text-slate-100 shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/40">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xs text-white tracking-tight">
                Interconnected Contact: {primary.name}
              </span>
              <span className="text-[10px] font-mono text-cyan-300">({cleanPhone})</span>
            </div>
            <p className="text-[11px] text-slate-300">
              Found existing records across shop database. Click Auto-Fill to populate details.
            </p>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={() => handleApply(primary)}
          className={`h-8 px-3 text-xs font-bold shrink-0 transition-all ${
            applied
              ? "bg-emerald-600 text-white"
              : "bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm shadow-cyan-600/30"
          }`}
        >
          {applied ? (
            <>
              <Check className="h-3.5 w-3.5 mr-1" /> Details Applied
            </>
          ) : (
            <>
              <UserCheck className="h-3.5 w-3.5 mr-1" /> Auto-Fill Details
            </>
          )}
        </Button>
      </div>

      {/* Cross-Entity Activity Badges */}
      <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mr-1 flex items-center gap-1">
          <History className="h-3 w-3 text-cyan-400" /> Records:
        </span>
        {lookupData.matches.map((m, idx) => (
          <Badge
            key={idx}
            variant="outline"
            className={`text-[10px] px-2 py-0.5 font-medium border cursor-pointer hover:opacity-90 transition-opacity ${
              m.role === "seller"
                ? "bg-purple-950/80 border-purple-500/40 text-purple-200"
                : m.role === "customer"
                ? "bg-emerald-950/80 border-emerald-500/40 text-emerald-200"
                : m.role === "dealer"
                ? "bg-amber-950/80 border-amber-500/40 text-amber-200"
                : "bg-blue-950/80 border-blue-500/40 text-blue-200"
            }`}
            onClick={() => handleApply(m)}
            title="Click to auto-fill from this specific record"
          >
            {m.role === "seller"
              ? "📦 Seller"
              : m.role === "customer"
              ? "🛒 Customer"
              : m.role === "dealer"
              ? "🏢 Dealer"
              : "🔧 Repair"}
            : {m.summary}
          </Badge>
        ))}
      </div>
    </div>
  );
};

export default InterconnectedPartyLookup;
