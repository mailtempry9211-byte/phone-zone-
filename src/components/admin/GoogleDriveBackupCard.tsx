import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Cloud, CloudUpload, CheckCircle2, HardDrive, RefreshCw, ExternalLink, Loader2, FolderOpen, RotateCcw } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const GoogleDriveBackupCard: React.FC = () => {
  const queryClient = useQueryClient();
  const [customPath, setCustomPath] = useState("");
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: driveStatus, isLoading, refetch } = useQuery({
    queryKey: ["google-drive-status"],
    queryFn: async () => {
      const res = await fetch("/api/google-drive/status", { credentials: "include" });
      if (!res.ok) throw new Error("Could not load Google Drive status");
      const data = await res.json();
      if (data.configuredFolder) {
        setCustomPath(data.configuredFolder);
      }
      return data;
    },
  });

  const handleSaveConfig = async (overrideLogout?: boolean) => {
    setIsSavingConfig(true);
    try {
      const res = await fetch("/api/google-drive/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          googleDriveFolder: customPath,
          backupOnLogout: overrideLogout !== undefined ? overrideLogout : driveStatus?.backupOnLogout,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Failed to update configuration");
      }
      toast.success("Google Drive backup settings saved!");
      queryClient.invalidateQueries({ queryKey: ["google-drive-status"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/google-drive/sync", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to sync to Google Drive");
      }
      toast.success(
        `Cloud backup synced to Google Drive successfully! (${(data.sizeBytes / (1024 * 1024)).toFixed(2)} MB)`
      );
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to sync to Google Drive");
    } finally {
      setIsSyncing(false);
    }
  };

  const [isRestoring, setIsRestoring] = useState<string | null>(null);

  const handleRestoreFromCloud = async (backupName: string) => {
    if (!confirm(`Warning: This will restore your database and all records from "${backupName}". Your current database will be automatically snapshotted before the restore. Continue?`)) {
      return;
    }
    setIsRestoring(backupName);
    try {
      const res = await fetch("/api/google-drive/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ backupName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to restore backup");
      }
      toast.success("Database restored successfully from Google Drive backup! Reloading page...");
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      toast.error(err.message || "Failed to restore cloud backup");
    } finally {
      setIsRestoring(null);
    }
  };

  const isConnected = driveStatus?.isConnected ?? false;
  const targetDir = driveStatus?.targetDir || "Google Drive Folder";

  return (
    <Card className="border-blue-100 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg text-blue-900">
            <Cloud className="h-5 w-5 text-blue-600" />
            Google Drive &amp; Cloud Backup
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={
                isConnected
                  ? "bg-green-50 text-green-700 border-green-200 gap-1 font-medium"
                  : "bg-amber-50 text-amber-700 border-amber-200 gap-1 font-medium"
              }
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {driveStatus?.folderType === "google_drive" ? "Google Drive Connected" : "Cloud Ready"}
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-8 w-8 p-0">
              <RefreshCw className="h-4 w-4 text-gray-500" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 text-sm">
        <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-900">
              <HardDrive className="h-4 w-4 text-blue-600" />
              Active Google Drive Folder:
            </div>
            <p className="text-xs font-mono text-gray-800 break-all">{targetDir}</p>
            {driveStatus?.lastCloudBackupAt && (
              <p className="text-[11px] text-gray-500">
                Last synced: {new Date(driveStatus.lastCloudBackupAt).toLocaleString()}
              </p>
            )}
          </div>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white shrink-0 shadow-sm h-9"
            onClick={handleManualSync}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <CloudUpload className="h-4 w-4 mr-1.5" />
                Sync to Google Drive Now
              </>
            )}
          </Button>
        </div>

        {/* Custom Folder Setting */}
        <div className="space-y-2 pt-1">
          <Label className="text-xs font-semibold text-gray-700">
            Custom Google Drive or Cloud Path (Optional)
          </Label>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder={driveStatus?.detectedFolder || "e.g. G:\\My Drive or C:\\Users\\...\\Google Drive"}
              value={customPath}
              onChange={(e) => setCustomPath(e.target.value)}
              className="text-xs font-mono h-9"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSaveConfig()}
              disabled={isSavingConfig}
              className="h-9 shrink-0"
            >
              {isSavingConfig ? "Saving..." : "Save Path"}
            </Button>
          </div>
          <p className="text-[11px] text-gray-500">
            Leave blank to use the auto-detected Google Drive folder. Every backup includes the full database, customer records, and all compressed photos.
          </p>
        </div>

        {/* Auto Backup on Logout Toggle */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="space-y-0.5">
            <Label className="text-xs font-medium text-gray-900">
              Backup Prompt on Logout
            </Label>
            <p className="text-[11px] text-gray-500">
              Shows a 1-click cloud sync dialog whenever you or staff log out
            </p>
          </div>
          <Switch
            checked={driveStatus?.backupOnLogout ?? true}
            onCheckedChange={(checked) => handleSaveConfig(checked)}
            disabled={isSavingConfig}
          />
        </div>

        {/* Recent Backups */}
        {driveStatus?.recentBackups && driveStatus.recentBackups.length > 0 && (
          <div className="pt-2 border-t space-y-1.5">
            <p className="text-xs font-semibold text-gray-700">Recent Cloud Backups in Google Drive:</p>
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {driveStatus.recentBackups.map((b: any) => (
                <div
                  key={b.name}
                  className="flex items-center justify-between text-xs p-2 bg-gray-50 dark:bg-slate-900/60 rounded border text-gray-700 dark:text-gray-200"
                >
                  <div className="flex flex-col truncate mr-2">
                    <span className="font-mono truncate font-medium">{b.name}</span>
                    <span className="text-[10px] text-gray-400">
                      {(b.sizeBytes / (1024 * 1024)).toFixed(2)} MB • {b.modifiedAt ? new Date(b.modifiedAt).toLocaleDateString() : ""}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 text-[11px] px-2 text-blue-700 dark:text-blue-400 hover:text-blue-800 hover:bg-blue-50 border-blue-200 shrink-0 gap-1"
                    onClick={() => handleRestoreFromCloud(b.name)}
                    disabled={!!isRestoring}
                  >
                    {isRestoring === b.name ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Restoring...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="h-3 w-3" />
                        Restore
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

