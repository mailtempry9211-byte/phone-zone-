
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HardDrive, RefreshCw } from "lucide-react";
import { useStorageUsage } from "@/hooks/useStorageUsage";

interface StorageUsageCardProps {
  compact?: boolean;
}

const StorageUsageCard = ({ compact = false }: StorageUsageCardProps) => {
  const { formattedSize, fileCount, isLoading, error, refresh } = useStorageUsage();

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200/70 border border-slate-200 rounded-lg text-xs transition-colors shrink-0">
        <HardDrive className="h-3.5 w-3.5 text-slate-600" />
        <span className="font-semibold text-slate-800">{formattedSize}</span>
        <span className="text-[10px] text-slate-500 hidden md:inline">({fileCount} files)</span>
        <button
          type="button"
          onClick={refresh}
          disabled={isLoading}
          className="text-slate-400 hover:text-slate-700 ml-0.5 p-0.5"
          title="Refresh storage"
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center">
          <HardDrive className="h-4 w-4 mr-2" />
          Storage Usage
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : (
          <div className="space-y-2">
            <div className="text-2xl font-bold">{formattedSize}</div>
            <p className="text-xs text-muted-foreground">
              {fileCount} files uploaded
            </p>
            <div className="text-xs text-muted-foreground">
              All website data including photos and documents
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StorageUsageCard;
