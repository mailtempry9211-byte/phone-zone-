import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Cloud, CloudUpload, LogOut, CheckCircle2, AlertCircle, Loader2, HardDrive } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface LogoutBackupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmLogout: () => Promise<void> | void;
}

export const LogoutBackupDialog: React.FC<LogoutBackupDialogProps> = ({
  open,
  onOpenChange,
  onConfirmLogout,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: driveStatus, refetch } = useQuery({
    queryKey: ["google-drive-status"],
    queryFn: async () => {
      const res = await fetch("/api/google-drive/status", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: open,
  });

  const handleBackupAndLogout = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/google-drive/sync", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to create cloud backup");
      }
      toast.success("Cloud backup synced to Google Drive successfully!");
      await onConfirmLogout();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to backup. Logging out...");
      // Still allow logout if user confirms
      if (confirm("Backup could not be completed. Do you still want to log out?")) {
        await onConfirmLogout();
        onOpenChange(false);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleJustLogout = async () => {
    onOpenChange(false);
    await onConfirmLogout();
  };

  const folderName = driveStatus?.targetDir || "Google Drive";
  const isConnected = driveStatus?.isConnected ?? true;

  return (
    <Dialog open={open} onOpenChange={(val) => !isSyncing && onOpenChange(val)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2.5 text-blue-600 mb-1">
            <div className="p-2 rounded-full bg-blue-50 border border-blue-100">
              <Cloud className="h-6 w-6 text-blue-600" />
            </div>
            <DialogTitle className="text-xl">Logout & Cloud Backup</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-gray-600 pt-1">
            Take a fast backup before logging out to ensure all stock, accounts, repair jobs, and photos are safely stored in Google Drive.
          </DialogDescription>
        </DialogHeader>

        <div className="my-3 p-3.5 bg-slate-50 border rounded-lg space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-gray-700 flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5 text-blue-500" />
              Cloud Sync Destination:
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-700 border border-green-200 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {driveStatus?.folderType === "google_drive" ? "Google Drive Ready" : "Cloud Ready"}
            </span>
          </div>
          <div className="text-xs font-mono bg-white p-2 border rounded text-gray-700 break-all">
            {folderName}
          </div>
          {driveStatus?.lastCloudBackupAt && (
            <p className="text-[11px] text-gray-500">
              Last cloud backup: {new Date(driveStatus.lastCloudBackupAt).toLocaleString()}
            </p>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-2 pt-2">
          <Button
            type="button"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm h-10"
            onClick={handleBackupAndLogout}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Syncing to Google Drive &amp; Logging Out...
              </>
            ) : (
              <>
                <CloudUpload className="h-4 w-4 mr-2" />
                Backup to Google Drive &amp; Logout
              </>
            )}
          </Button>

          <div className="flex items-center gap-2 w-full">
            <Button
              type="button"
              variant="outline"
              className="flex-1 text-gray-700 border-gray-300 hover:bg-gray-100"
              onClick={handleJustLogout}
              disabled={isSyncing}
            >
              <LogOut className="h-4 w-4 mr-1.5 text-gray-500" />
              Just Logout
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="px-4 text-gray-500 hover:text-gray-800"
              onClick={() => onOpenChange(false)}
              disabled={isSyncing}
            >
              Cancel
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

