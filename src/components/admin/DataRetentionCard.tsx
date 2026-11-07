import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShieldAlert, Trash2, Database, RefreshCw, Loader2, CheckCircle2, ShieldCheck } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const DataRetentionCard: React.FC = () => {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  const { data: previewData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["retention-preview"],
    queryFn: async () => {
      const res = await fetch("/api/retention/preview", { credentials: "include" });
      if (!res.ok) throw new Error("Could not load retention preview");
      return res.json();
    },
  });

  const handlePurge = async () => {
    setIsPurging(true);
    try {
      const res = await fetch("/api/retention/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Purge execution failed");
      }

      const result = await res.json();
      toast.success(
        `Purge Completed! Full backup saved (${result.backup?.name || "backup.zip"}). Deleted ${result.purged?.total || 0} old records.`,
        { duration: 6000 }
      );
      setConfirmOpen(false);
      refetch();
      queryClient.invalidateQueries();
    } catch (err: any) {
      toast.error(err.message || "Failed to execute purge");
    } finally {
      setIsPurging(false);
    }
  };

  const counts = previewData?.counts || { soldPhones: 0, repairJobs: 0, auditLogs: 0, messages: 0, total: 0 };
  const cutoffLabel = previewData?.cutoffYear || "3+ Years Old";

  return (
    <>
      <Card className="border border-border/80 bg-card text-card-foreground shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Database className="h-5 w-5 text-amber-500" />
                2 Financial Years Active Data & 3rd Year Auto-Purge
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Maintains 2 Active Financial Years 100% Live. Automatically creates a verified full backup snapshot and purges data entering the 3rd year or older.
              </p>
            </div>
            <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-1 font-mono text-xs w-fit">
              Policy: 2 Years Live + 3rd Year Backup & Purge
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-1">
          {/* Status & Safety Badges */}
          <div className="rounded-lg border border-border/60 bg-muted/40 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>
                <strong>Zero Risk Guarantee:</strong> An automatic verified full database snapshot (.zip) is taken <em>before</em> any deletion.
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span>Unsold stock (in-stock phones) and active repair devices are strictly protected and never purged.</span>
            </div>
          </div>

          {/* Counts Overview Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border/60 bg-background p-3 text-center">
              <div className="text-2xl font-bold font-mono text-foreground">
                {isLoading ? "..." : counts.soldPhones}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Old Sold Phones</div>
            </div>

            <div className="rounded-lg border border-border/60 bg-background p-3 text-center">
              <div className="text-2xl font-bold font-mono text-foreground">
                {isLoading ? "..." : counts.repairJobs}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Old Closed Repairs</div>
            </div>

            <div className="rounded-lg border border-border/60 bg-background p-3 text-center">
              <div className="text-2xl font-bold font-mono text-foreground">
                {isLoading ? "..." : counts.auditLogs}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Expired Audit Logs</div>
            </div>

            <div className="rounded-lg border border-border/60 bg-background p-3 text-center">
              <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
                {isLoading ? "..." : counts.total}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Total Eligible to Purge</div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="text-xs text-muted-foreground">
              Threshold: Data from <strong>{cutoffLabel}</strong>
              {counts.total === 0 && (
                <span className="ml-2 text-emerald-600 dark:text-emerald-400 font-medium">
                  • All records are current &amp; safe (0 old data)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                className="gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
                Check Status
              </Button>

              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmOpen(true)}
                disabled={isLoading || isPurging || counts.total === 0}
                className="gap-1.5"
              >
                {isPurging ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Backing Up & Purging...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    Execute 2+1 Year Purge
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Confirm 2+1 Year Data Purge
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2 text-sm text-foreground/90">
              <p>
                You are about to purge <strong>{counts.total}</strong> records older than 3 Financial Years ({cutoffLabel}).
              </p>
              <div className="rounded bg-muted p-2.5 text-xs space-y-1 font-mono">
                <div>• Sold Phones: {counts.soldPhones}</div>
                <div>• Closed Repairs: {counts.repairJobs}</div>
                <div>• Logs & Messages: {counts.auditLogs + counts.messages}</div>
              </div>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                ✓ A verified full backup snapshot will be saved to your backups folder and synced to cloud before deletion starts.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPurging}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handlePurge();
              }}
              disabled={isPurging}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {isPurging ? "Creating Backup & Purging..." : "Confirm & Run Purge"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
