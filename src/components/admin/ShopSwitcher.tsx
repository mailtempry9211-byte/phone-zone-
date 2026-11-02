import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Check, Plus, Store, ChevronDown, MapPin, Phone, ShieldCheck, Lock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import ShopManagementDialog from "./ShopManagementDialog";

interface Shop {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logo_url?: string | null;
  shop_code?: string | null;
}

interface ShopSwitcherProps {
  className?: string;
  isDark?: boolean;
}

export const ShopSwitcher: React.FC<ShopSwitcherProps> = ({ className = "", isDark = true }) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [addShopOpen, setAddShopOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  // 1. Fetch all registered shops
  const { data: shops = [], refetch: refetchShops } = useQuery<Shop[]>({
    queryKey: ["admin-shops-list"],
    queryFn: async () => {
      const res = await fetch("/api/shops", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  // 2. Fetch currently active shop for logged in user
  const { data: activeShop, refetch: refetchActive } = useQuery<{ id: string; name: string; address?: string; phone?: string; isAll?: boolean }>({
    queryKey: ["admin-active-shop"],
    queryFn: async () => {
      const res = await fetch("/api/shops/active", { credentials: "include" });
      if (!res.ok) {
        return { id: "shop_1", name: "MOBILE WORLD" };
      }
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  const handleSwitchShop = async (shopId: string, shopName: string) => {
    setSwitchingId(shopId);
    try {
      const res = await fetch("/api/shops/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ shopId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to switch store");
      }
      toast.success(`Switched active store to "${shopName}"`);
      await refetchActive();
      await queryClient.invalidateQueries();
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to switch store");
    } finally {
      setSwitchingId(null);
    }
  };

  const { user } = useAuth();
  const userData = user as any;
  const isLocked = Boolean(userData?.isShopLocked || (userData?.assignedShopId && userData.assignedShopId !== "all"));

  const displayName = activeShop?.name || "MOBILE WORLD";

  return (
    <>
      {/* Top Header Pill */}
      <button
        onClick={() => {
          if (isLocked) {
            toast.info(`Aapka account "${displayName}" branch ke liye locked hai. Branch switch nahi kar sakte.`);
            return;
          }
          setOpen(true);
        }}
        className={`h-8 px-2.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shrink-0 ${
          isLocked
            ? isDark
              ? "bg-amber-950/30 border-amber-500/40 text-amber-300 hover:bg-amber-950/50"
              : "bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100"
            : isDark
            ? "bg-slate-900 border-sky-500/40 text-sky-300 hover:bg-slate-800"
            : "bg-sky-50 border-sky-200 text-sky-800 hover:bg-sky-100"
        } ${className}`}
        title={isLocked ? `Locked to ${displayName} (ब्रांच लॉक्ड है)` : "Switch Company / Store Branch (दुकान / कंपनी बदलें)"}
      >
        <Store className={`h-3.5 w-3.5 shrink-0 ${isLocked ? "text-amber-500" : "text-sky-500"}`} />
        <span className="truncate max-w-[110px] sm:max-w-[150px]">{displayName}</span>
        {isLocked ? (
          <Lock className="h-3 w-3 text-amber-500 shrink-0 opacity-80" />
        ) : (
          <ChevronDown className="h-3 w-3 opacity-70 shrink-0" />
        )}
      </button>

      {/* Company / Shop Switcher Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-[#0c1322] border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                <Building2 className="h-4 w-4" />
              </div>
              <DialogTitle className="text-lg font-bold">
                Change Company / Shop Branch
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Select the active store/branch to manage its inventory, billing, repairs, and sales books.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 my-3 max-h-[340px] overflow-y-auto pr-1">
            {/* All Branches Consolidated Option */}
            <div
              onClick={() => handleSwitchShop("all", "All Branches (Consolidated)")}
              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                activeShop?.id === "all"
                  ? "bg-sky-50 dark:bg-sky-950/50 border-sky-400 dark:border-sky-500 shadow-sm"
                  : "bg-slate-50/70 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">All Branches (Consolidated)</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">View combined multi-store inventory & reports</p>
                </div>
              </div>
              {activeShop?.id === "all" && (
                <Badge className="bg-sky-500 text-white text-[10px] font-bold px-2 py-0.5">
                  <Check className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              )}
            </div>

            {/* Individual Registered Shops */}
            {shops.map((shop) => {
              const isActive = activeShop?.id === shop.id;
              return (
                <div
                  key={shop.id}
                  onClick={() => handleSwitchShop(shop.id, shop.name)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    isActive
                      ? "bg-sky-50 dark:bg-sky-950/50 border-sky-400 dark:border-sky-500 shadow-sm"
                      : "bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 font-black text-xs uppercase">
                      {shop.name.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{shop.name}</h4>
                        {shop.shop_code && (
                          <Badge variant="outline" className="text-[9px] font-mono font-bold px-1.5 py-0 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700">
                            {shop.shop_code}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {shop.address && (
                          <span className="flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                            {shop.address}
                          </span>
                        )}
                        {shop.phone && (
                          <span className="flex items-center gap-1 shrink-0 font-mono">
                            <Phone className="h-3 w-3 shrink-0 text-slate-400" />
                            {shop.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isActive && (
                    <Badge className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 shrink-0 ml-2">
                      <Check className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Actions */}
          <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setOpen(false);
                  setAddShopOpen(true);
                }}
                className="text-xs font-bold gap-1.5 border-sky-400 dark:border-sky-500/50 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40"
              >
                <Plus className="h-3.5 w-3.5 text-sky-500" />
                Add New Company / Branch
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                className="text-xs font-semibold text-slate-600 dark:text-slate-400"
              >
                Close
              </Button>
            </div>

            {/* Test First-Time Setup Wizard button */}
            <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-amber-300">Test First-Time Setup Wizard</p>
                <p className="text-[10px] text-slate-400">Test exactly what a new client sees on day 1 (Bina data wipe kiye)</p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setOpen(false);
                  window.location.href = "/setup?force=1";
                }}
                className="h-7 px-2.5 bg-amber-500 hover:bg-amber-600 text-black text-xs font-black shrink-0 shadow-sm"
              >
                Launch Setup
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add New Shop Dialog */}
      <ShopManagementDialog
        open={addShopOpen}
        onOpenChange={setAddShopOpen}
        mode="add"
        onSaved={async () => {
          await refetchShops();
          await refetchActive();
          await queryClient.invalidateQueries();
        }}
      />
    </>
  );
};

export default ShopSwitcher;

