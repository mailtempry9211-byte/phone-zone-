import React from "react";
import { Sparkles, Calendar, TrendingUp } from "lucide-react";
import { formatINR } from "../dashboardFormat";
import { DashboardOverviewData } from "../useDashboardData";

interface GreetingProps {
  userName?: string;
  data: DashboardOverviewData;
  isDarkTeal?: boolean;
  isLight?: boolean;
}

export const Greeting: React.FC<GreetingProps> = ({
  userName = "Owner",
  data,
  isDarkTeal = false,
  isLight = false,
}) => {
  // IST Time-aware greeting
  const getGreetingTime = () => {
    try {
      const istHours = Number(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Kolkata",
          hour: "numeric",
          hour12: false,
        }).format(new Date())
      );
      if (istHours < 12) return "Good morning";
      if (istHours < 17) return "Good afternoon";
      return "Good evening";
    } catch {
      return "Welcome back";
    }
  };

  const todayStr = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date());

  // Moorly natural language summary sentence
  const buildSummarySentence = () => {
    const parts: string[] = [];
    const { today, repairs } = data;

    if (today.phonesSold > 0) {
      parts.push(`sold ${today.phonesSold} phone${today.phonesSold > 1 ? "s" : ""} for ${formatINR(today.salesAmount)}`);
    }

    if (today.phonesBought > 0) {
      parts.push(`acquired ${today.phonesBought} device${today.phonesBought > 1 ? "s" : ""}`);
    }

    if (repairs.available && repairs.readyForDelivery > 0) {
      parts.push(`${repairs.readyForDelivery} repair${repairs.readyForDelivery > 1 ? "s are" : " is"} ready for delivery`);
    } else if (repairs.available && repairs.pending > 0) {
      parts.push(`${repairs.pending} repair${repairs.pending > 1 ? "s" : ""} currently in queue`);
    }

    if (parts.length === 0) {
      return `Store is ready for today's transactions. ${data.stock.count} phones currently available in stock.`;
    }

    return `Today you ${parts.join(" and ")}.`;
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <h1 className={`text-2xl sm:text-3xl font-black tracking-tight ${isLight ? "text-slate-900" : "text-white"}`}>
            {getGreetingTime()}, <span className={isLight ? "text-teal-700" : isDarkTeal ? "text-teal-400" : "text-amber-300"}>{userName}</span>
          </h1>
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border ${
            isLight ? "bg-slate-200 border-slate-300 text-slate-800" : "bg-white/10 border-white/10 text-slate-300"
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {data.financialYear ? `FY ${data.financialYear}` : "Active"}
          </span>
        </div>

        <p className={`text-sm font-medium max-w-2xl leading-relaxed flex items-center gap-2 ${
          isLight ? "text-slate-600" : "text-slate-300/90"
        }`}>
          <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0" />
          <span>{buildSummarySentence()}</span>
        </p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className={`px-3.5 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-mono backdrop-blur-md ${
          isLight ? "bg-white border-slate-300 text-slate-700 shadow-sm" : "bg-black/20 border-white/10 text-slate-300"
        }`}>
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <span>{todayStr} (IST)</span>
        </div>
      </div>
    </div>
  );
};

