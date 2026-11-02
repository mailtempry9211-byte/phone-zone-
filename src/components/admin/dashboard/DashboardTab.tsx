import React, { useState } from "react";
import { AlertTriangle, RefreshCw, Sparkles, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardData } from "./useDashboardData";
import { DashboardShell } from "./DashboardShell";
import { useAuth } from "@/hooks/useAuth";

interface DashboardTabProps {
  onNavigateTab: (tab: string) => void;
  onQuickAction: (action: string) => void;
  shopId?: string;
  financialYear?: string;
  themeMode?: "dark" | "light";
  onToggleThemeMode?: () => void;
  isAdmin?: boolean;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  onNavigateTab,
  onQuickAction,
  shopId = "",
  financialYear = "",
  themeMode = "dark",
  onToggleThemeMode,
  isAdmin = true,
}) => {
  const { user } = useAuth();

  const { data, isLoading, isError, error, refetch } = useDashboardData({
    range: "week",
    fy: financialYear,
    shop: shopId,
  });

  if (isLoading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-teal-500/30 border-t-teal-400 animate-spin" />
        <div className="space-y-1">
          <p className="font-bold text-white text-base">Loading Storefront Analytics</p>
          <p className="text-xs text-slate-400">Computing real-time stock, repairs, and financial metrics...</p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center">
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-3xl p-8 max-w-md space-y-4">
          <AlertTriangle className="h-10 w-10 text-rose-400 mx-auto" />
          <div className="space-y-1">
            <h3 className="font-bold text-white text-lg">Unable to Load Dashboard</h3>
            <p className="text-xs text-slate-400">
              {error?.message || "Could not retrieve real-time data from local server."}
            </p>
          </div>
          <Button
            onClick={() => refetch()}
            className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-2" />
            Retry Connection
          </Button>
        </div>
      </div>
    );
  }

  const userName = user?.email?.split("@")[0] || "Owner";

  return (
    <DashboardShell
      data={data}
      isLoading={isLoading}
      isAdmin={isAdmin}
      userName={userName}
      themeMode={themeMode}
      onToggleThemeMode={onToggleThemeMode}
      onRefresh={() => refetch()}
      onNavigateTab={onNavigateTab}
      onQuickAction={onQuickAction}
    />
  );
};

export default DashboardTab;

