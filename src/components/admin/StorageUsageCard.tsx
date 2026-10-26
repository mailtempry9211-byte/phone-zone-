
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HardDrive, RefreshCw } from "lucide-react";
import { useStorageUsage } from "@/hooks/useStorageUsage";

const StorageUsageCard = () => {
  const { formattedSize, fileCount, isLoading, error, refresh } = useStorageUsage();

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
