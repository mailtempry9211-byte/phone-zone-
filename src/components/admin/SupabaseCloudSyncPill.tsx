import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Cloud, RefreshCw, CheckCircle2, AlertCircle, Database, ArrowUpRight } from "lucide-react";

interface SupabaseStatus {
  connected: boolean;
  isConfigured: boolean;
  url?: string;
  error?: string;
  reason?: string;
  rowCounts?: {
    phones: number;
    sellers: number;
    customers: number;
  };
}

export const SupabaseCloudSyncPill: React.FC<{ className?: string; isDark?: boolean }> = ({
  className = "",
  isDark = true,
}) => {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: status, isFetching } = useQuery<SupabaseStatus>({
    queryKey: ["supabase-status"],
    queryFn: async () => {
      const res = await fetch("/api/supabase/status", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch Supabase status");
      return res.json();
    },
    refetchInterval: open ? 5000 : 30000,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/supabase/sync-now", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Sync failed");
      return data;
    },
    onSuccess: (data) => {
      toast.success("All data pushed to Supabase Cloud!", {
        description: `Synced: ${data.synced?.phones || 0} phones, ${data.synced?.sellers || 0} sellers, ${data.synced?.customers || 0} customers.`,
      });
      queryClient.invalidateQueries({ queryKey: ["supabase-status"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to sync to Supabase");
    },
  });

  const isConnected = !!status?.connected;
  const isConfigured = !!status?.isConfigured;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`h-7 px-2 text-xs font-bold border rounded-md transition-all flex items-center gap-1.5 shadow-sm shrink-0 ${
          isConnected
            ? isDark
              ? "bg-slate-900 border-emerald-500/40 text-emerald-300 hover:bg-slate-800"
              : "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
            : isConfigured
              ? isDark
                ? "bg-slate-900 border-amber-500/40 text-amber-300 hover:bg-slate-800"
                : "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
              : isDark
                ? "bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800"
                : "bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200"
        } ${className}`}
        title="Supabase Cloud Database Status & 1-Click Sync"
      >
        <Cloud className={`h-3.5 w-3.5 ${isConnected ? "text-emerald-400" : "text-amber-400"}`} />
        <span className="hidden sm:inline">
          {isConnected ? "Cloud DB: Connected" : isConfigured ? "Cloud DB: Sync Needed" : "Local SQLite"}
        </span>
        <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[96vw] max-w-md p-5 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg text-slate-900 dark:text-slate-100">
              <Database className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Supabase Cloud Database Sync
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Permanent cloud persistence ensuring all phones, invoices, and customers survive Render deploys.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Status Card */}
            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Connection Status:</span>
                <Badge
                  variant="outline"
                  className={
                    isConnected
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-700/50"
                      : "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-700/50"
                  }
                >
                  {isConnected ? (
                    <><CheckCircle2 className="h-3 w-3 mr-1" /> Live Connected</>
                  ) : (
                    <><AlertCircle className="h-3 w-3 mr-1" /> Not Synced</>
                  )}
                </Badge>
              </div>

              {status?.url && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono break-all flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800">
                  <span>URL: {status.url}</span>
                </div>
              )}
            </div>

            {/* Live Cloud Table Row Counts */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 bg-white dark:bg-slate-900 space-y-2">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                <span>Supabase Cloud Row Counts:</span>
                {isFetching && <RefreshCw className="h-3 w-3 animate-spin text-slate-400" />}
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="text-lg font-black text-blue-600 dark:text-blue-400">
                    {status?.rowCounts?.phones ?? 0}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">Phones</div>
                </div>
                <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="text-lg font-black text-purple-600 dark:text-purple-400">
                    {status?.rowCounts?.sellers ?? 0}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">Sellers</div>
                </div>
                <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                    {status?.rowCounts?.customers ?? 0}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">Customers</div>
                </div>
              </div>
            </div>

            {/* Sync Action Button */}
            <Button
              type="button"
              disabled={syncMutation.isPending}
              onClick={() => syncMutation.mutate()}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 shadow-sm"
            >
              {syncMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Pushing Local Database to Supabase...
                </>
              ) : (
                <>
                  <Cloud className="h-4 w-4 mr-2" />
                  ⚡ Sync All Data to Supabase Now
                </>
              )}
            </Button>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
              Restored backup data or new stock will be immediately pushed to Supabase tables.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SupabaseCloudSyncPill;
