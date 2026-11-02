import React from "react";
import { AlertTriangle, Info, Bell, ChevronRight, Clock, MessageSquare, Wrench, Package } from "lucide-react";

interface AlertsPanelProps {
  alerts: Array<{
    type: string;
    severity: "warning" | "info" | "critical";
    text: string;
    count: number;
    link: string;
  }>;
  styleMode?: "glass" | "darkteal";
  onNavigateTab?: (tab: string) => void;
  isLight?: boolean;
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({ alerts, styleMode = "glass", onNavigateTab, isLight = false }) => {
  const containerStyle = isLight
    ? "bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm text-slate-900"
    : styleMode === "glass"
    ? "bg-white/[0.08] backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl"
    : "bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl";

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "stock":
        return <Package className="h-4 w-4 text-amber-400" />;
      case "aging":
        return <Clock className="h-4 w-4 text-rose-400" />;
      case "repair_ready":
        return <Wrench className="h-4 w-4 text-emerald-400" />;
      case "message":
        return <MessageSquare className="h-4 w-4 text-cyan-400" />;
      default:
        return <Bell className="h-4 w-4 text-amber-400" />;
    }
  };

  return (
    <div className={containerStyle}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className={`h-4 w-4 ${isLight ? "text-amber-600" : "text-amber-400"}`} />
          <h3 className={`font-extrabold text-base ${isLight ? "text-slate-900" : "text-white"}`}>
            Actionable Operational Alerts
          </h3>
        </div>
        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${
          isLight ? "bg-amber-100 text-amber-900 border-amber-300" : "bg-amber-500/20 text-amber-300 border-amber-500/30"
        }`}>
          {alerts.length} Pending
        </span>
      </div>

      {alerts.length === 0 ? (
        <div className={`text-center py-6 text-xs font-medium ${isLight ? "text-slate-600" : "text-slate-400"}`}>
          All systems optimal. No alerts require immediate shop attention.
        </div>
      ) : (
        <div className="space-y-2.5">
          {alerts.map((al, idx) => (
            <div
              key={idx}
              onClick={() => onNavigateTab?.(al.link)}
              className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                isLight
                  ? "bg-amber-50/90 hover:bg-amber-100/90 border-amber-200 text-slate-900 shadow-xs"
                  : "bg-black/20 hover:bg-black/40 border-white/5 hover:border-white/20 text-slate-200"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`p-2 rounded-xl shrink-0 ${
                  isLight ? "bg-amber-100 text-amber-800 border border-amber-300/50" : "bg-white/5"
                }`}>
                  {getAlertIcon(al.type)}
                </span>
                <div>
                  <p className={`text-xs font-bold leading-snug ${isLight ? "text-slate-900" : "text-slate-200"}`}>
                    {al.text}
                  </p>
                </div>
              </div>

              <ChevronRight className={`h-4 w-4 shrink-0 ml-2 ${isLight ? "text-slate-600" : "text-slate-500"}`} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

