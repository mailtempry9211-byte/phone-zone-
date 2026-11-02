import React from "react";
import { FileText, ArrowDownLeft, ArrowUpRight, RotateCcw, Wrench } from "lucide-react";
import { formatINR, formatRelativeTime } from "../dashboardFormat";

interface RecentInvoicesProps {
  invoices: Array<{
    id: string;
    number: string;
    type: string;
    party: string;
    amount: number;
    status: string;
    date: string;
  }>;
  styleMode?: "glass" | "darkteal";
  onSelectInvoice?: (id: string) => void;
  isLight?: boolean;
}

export const RecentInvoices: React.FC<RecentInvoicesProps> = ({
  invoices,
  styleMode = "glass",
  onSelectInvoice,
  isLight = false,
}) => {
  const containerStyle = isLight
    ? "bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm text-slate-900"
    : styleMode === "glass"
    ? "bg-white/[0.08] backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl"
    : "bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl";

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "sale":
        return {
          icon: <ArrowUpRight className={`h-3 w-3 ${isLight ? "text-emerald-700" : "text-emerald-400"}`} />,
          label: "Sale",
          className: isLight
            ? "bg-emerald-100 text-emerald-900 border-emerald-300"
            : "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
        };
      case "purchase":
        return {
          icon: <ArrowDownLeft className={`h-3 w-3 ${isLight ? "text-blue-700" : "text-blue-400"}`} />,
          label: "Purchase",
          className: isLight
            ? "bg-blue-100 text-blue-900 border-blue-300"
            : "bg-blue-500/10 text-blue-300 border-blue-500/20",
        };
      case "return":
        return {
          icon: <RotateCcw className={`h-3 w-3 ${isLight ? "text-rose-700" : "text-rose-400"}`} />,
          label: "Return",
          className: isLight
            ? "bg-rose-100 text-rose-900 border-rose-300"
            : "bg-rose-500/10 text-rose-300 border-rose-500/20",
        };
      case "repair":
        return {
          icon: <Wrench className={`h-3 w-3 ${isLight ? "text-amber-700" : "text-amber-400"}`} />,
          label: "Repair",
          className: isLight
            ? "bg-amber-100 text-amber-900 border-amber-300"
            : "bg-amber-500/10 text-amber-300 border-amber-500/20",
        };
      default:
        return {
          icon: <FileText className={`h-3 w-3 ${isLight ? "text-slate-600" : "text-slate-400"}`} />,
          label: type,
          className: isLight
            ? "bg-slate-100 text-slate-800 border-slate-300"
            : "bg-slate-500/10 text-slate-300 border-slate-500/20",
        };
    }
  };

  return (
    <div className={containerStyle}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className={`font-extrabold text-base ${isLight ? "text-slate-900" : "text-white"}`}>Recent Invoices</h3>
          <p className={`text-xs ${isLight ? "text-slate-600 font-medium" : "text-slate-400"}`}>Latest recorded shop transactions</p>
        </div>
        <FileText className={`h-4 w-4 ${isLight ? "text-slate-500" : "text-slate-400"}`} />
      </div>

      {invoices.length === 0 ? (
        <div className={`text-center py-8 text-xs ${isLight ? "text-slate-600 font-medium" : "text-slate-400"}`}>
          No invoices recorded for this period.
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => {
            const badge = getTypeBadge(inv.type);
            return (
              <div
                key={inv.id}
                onClick={() => onSelectInvoice?.(inv.id)}
                className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                  isLight
                    ? "bg-white hover:bg-slate-50 border-slate-200/90 shadow-xs"
                    : "bg-black/20 hover:bg-black/40 border-white/5 hover:border-white/20"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`p-2 rounded-xl border ${badge.className}`}>
                    {badge.icon}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-xs font-bold ${isLight ? "text-slate-900" : "text-white"}`}>{inv.number}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className={`text-xs line-clamp-1 font-medium ${isLight ? "text-slate-600" : "text-slate-400"}`}>{inv.party}</p>
                  </div>
                </div>

                <div className="text-right">
                  <div className={`font-mono font-black text-sm ${isLight ? "text-slate-900" : "text-white"}`}>
                    {formatINR(inv.amount)}
                  </div>
                  <div className={`text-[10px] font-mono font-medium ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                    {formatRelativeTime(inv.date)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

