import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Database, HardDrive, Network, RefreshCw, AlertTriangle, ShieldCheck, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface QuotaSection {
  usedBytes: number;
  limitBytes: number;
  usedMb: number;
  limitMb: number;
  percentage: number;
  status: "healthy" | "warning" | "critical";
  fileCount?: number;
}

interface QuotaResponse {
  database: QuotaSection;
  storage: QuotaSection;
  bandwidth: QuotaSection;
  warnings: string[];
  lastChecked: string;
}

export const CloudQuotaMonitorCard: React.FC = () => {
  const [testingSupabase, setTestingSupabase] = React.useState(false);
  const [supabaseTestStatus, setSupabaseTestStatus] = React.useState<any>(null);

  const handleTestSupabase = async () => {
    setTestingSupabase(true);
    setSupabaseTestStatus(null);
    try {
      const res = await fetch("/api/system/test-supabase", { credentials: "include" });
      const data = await res.json();
      setSupabaseTestStatus(data);
    } catch (err: any) {
      setSupabaseTestStatus({ ok: false, error: err.message || "Failed to reach backend test endpoint" });
    } finally {
      setTestingSupabase(false);
    }
  };

  const { data, isLoading, refetch, isFetching } = useQuery<QuotaResponse>({
    queryKey: ["quota-metrics"],
    queryFn: async () => {
      const res = await fetch("/api/system/quota", { credentials: "include" });
      if (!res.ok) throw new Error("Could not load quota metrics");
      return res.json();
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const getStatusColor = (percentage: number) => {
    if (percentage >= 90) return "bg-rose-500 text-rose-500";
    if (percentage >= 75) return "bg-amber-500 text-amber-500";
    return "bg-emerald-500 text-emerald-500";
  };

  const getProgressColorClass = (percentage: number) => {
    if (percentage >= 90) return "[&>div]:bg-rose-500";
    if (percentage >= 75) return "[&>div]:bg-amber-500";
    return "[&>div]:bg-emerald-500";
  };

  const db = data?.database || { usedMb: 0, limitMb: 500, percentage: 0, status: "healthy" };
  const storage = data?.storage || { usedMb: 0, limitMb: 1000, percentage: 0, fileCount: 0, status: "healthy" };
  const bandwidth = data?.bandwidth || { usedMb: 0, limitMb: 2000, percentage: 0, status: "healthy" };

  return (
    <Card className="border border-border/80 bg-card text-card-foreground shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <HardDrive className="h-5 w-5 text-cyan-500" />
              Cloud & Database Free-Tier Live Monitor
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Real-time monitoring of Supabase/Render free limits (500 MB Database, 1 GB Storage, 2 GB Bandwidth).
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="default"
              size="sm"
              onClick={handleTestSupabase}
              disabled={testingSupabase}
              className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-sm"
            >
              <Database className={`h-3.5 w-3.5 ${testingSupabase ? "animate-spin" : ""}`} />
              {testingSupabase ? "Testing Supabase..." : "Test Supabase (कनेक्शन टेस्ट)"}
            </Button>
            <Badge variant="outline" className="border-cyan-500/40 text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-2.5 py-1 text-xs">
              Live Auto-Sync
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-8 gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-1">
        {/* Supabase Test Result Banner */}
        {supabaseTestStatus && (
          <div className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
            supabaseTestStatus.ok
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-200"
          }`}>
            <span className="text-base mt-0.5">{supabaseTestStatus.ok ? "✅" : "⚠️"}</span>
            <div className="space-y-1">
              <p className="font-bold">{supabaseTestStatus.message || supabaseTestStatus.error}</p>
              {supabaseTestStatus.hint && (
                <p className="opacity-90 underline font-medium">{supabaseTestStatus.hint}</p>
              )}
            </div>
          </div>
        )}
        {/* Warning Banner if Quota High */}
        {(db.percentage >= 80 || storage.percentage >= 80) && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 flex items-start gap-3 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <strong className="font-semibold">Free-Tier Quota Alert!</strong>
              <p>
                Your database or file storage is nearing the free limit. Run the 2-Year Auto-Purge below to clean up old sold devices and logs, or upgrade your Supabase plan.
              </p>
            </div>
          </div>
        )}

        {/* 3 Metric Bars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Database Usage */}
          <div className="rounded-xl border border-border/70 bg-background/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Database className="h-4 w-4 text-primary" />
                Database Size
              </div>
              <Badge variant="secondary" className="font-mono text-xs">
                {isLoading ? "..." : `${db.percentage}%`}
              </Badge>
            </div>

            <Progress value={db.percentage} className={`h-2.5 bg-muted ${getProgressColorClass(db.percentage)}`} />

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span>{isLoading ? "..." : `${db.usedMb} MB used`}</span>
              <span className="font-mono">Limit: {db.limitMb} MB</span>
            </div>
          </div>

          {/* Storage (Files/Photos) Usage */}
          <div className="rounded-xl border border-border/70 bg-background/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <HardDrive className="h-4 w-4 text-indigo-500" />
                Media & Photo Storage
              </div>
              <Badge variant="secondary" className="font-mono text-xs">
                {isLoading ? "..." : `${storage.percentage}%`}
              </Badge>
            </div>

            <Progress value={storage.percentage} className={`h-2.5 bg-muted ${getProgressColorClass(storage.percentage)}`} />

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span>{isLoading ? "..." : `${storage.usedMb} MB (${storage.fileCount || 0} files)`}</span>
              <span className="font-mono">Limit: 1,000 MB (1 GB)</span>
            </div>
          </div>

          {/* Monthly Bandwidth / Transfer */}
          <div className="rounded-xl border border-border/70 bg-background/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Network className="h-4 w-4 text-emerald-500" />
                Monthly Bandwidth (Egress)
              </div>
              <Badge variant="secondary" className="font-mono text-xs">
                {isLoading ? "..." : `${bandwidth.percentage}%`}
              </Badge>
            </div>

            <Progress value={bandwidth.percentage} className={`h-2.5 bg-muted ${getProgressColorClass(bandwidth.percentage)}`} />

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span>{isLoading ? "..." : `${bandwidth.usedMb} MB transfer`}</span>
              <span className="font-mono">Limit: {bandwidth.limitMb} MB (2 GB)</span>
            </div>
          </div>
        </div>

        {/* Info Footer */}
        <div className="rounded-lg border border-border/50 bg-muted/20 px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-muted-foreground gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>Updates dynamically with every phone purchase, photo upload, and invoice creation.</span>
          </div>
          {data?.lastChecked && (
            <span className="font-mono text-[11px] text-muted-foreground/80">
              Checked: {new Date(data.lastChecked).toLocaleTimeString()}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
