import React, { useState } from "react";
import { Wrench, Clock, User, Smartphone, AlertCircle, ChevronRight, CheckCircle2 } from "lucide-react";
import { STAGES } from "./RepairStageTrack";

interface RepairPipelineProps {
  repairs: {
    available: boolean;
    pending: number;
    readyForDelivery: number;
    byStage: Record<string, number>;
    jobs: Array<{
      id: string;
      jobNo: string;
      customerName: string;
      device: string;
      problem: string;
      status: string;
      ageDays: number;
    }>;
  };
  styleMode?: "glass" | "darkteal";
  onSelectJob?: (jobId: string) => void;
  onOpenRepairsTab?: () => void;
  isLight?: boolean;
}

export const RepairPipeline: React.FC<RepairPipelineProps> = ({
  repairs,
  styleMode = "glass",
  onSelectJob,
  onOpenRepairsTab,
  isLight = false,
}) => {
  const [filterStage, setFilterStage] = useState<string>("ALL");

  const containerStyle = isLight
    ? "bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm text-slate-900"
    : styleMode === "glass"
    ? "bg-white/[0.08] backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl"
    : "bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl";

  if (!repairs.available) {
    return (
      <div className={`${containerStyle} text-center py-12`}>
        <Wrench className="h-10 w-10 text-slate-400 mx-auto mb-3" />
        <h3 className={`text-base font-bold ${isLight ? "text-slate-800" : "text-white"}`}>Repairs Workshop Ready</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
          No repair jobs recorded yet. Create your first repair job from the Repairs Department tab.
        </p>
      </div>
    );
  }

  const filteredJobs = repairs.jobs.filter((j) => {
    if (filterStage === "ALL") return true;
    return j.status === filterStage;
  });

  return (
    <div className={containerStyle}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h3 className={`font-extrabold text-lg ${isLight ? "text-slate-900" : "text-white"}`}>
              Repair Operations Pipeline
            </h3>
            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/30">
              {repairs.pending} IN REPAIR
            </span>
            {repairs.readyForDelivery > 0 && (
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 animate-pulse">
                {repairs.readyForDelivery} READY TO DELIVER
              </span>
            )}
          </div>
          <p className={`text-xs mt-0.5 ${isLight ? "text-slate-500" : "text-slate-400"}`}>
            Real-time workshop stage tracking and customer device status
          </p>
        </div>

        {onOpenRepairsTab && (
          <button
            onClick={onOpenRepairsTab}
            className="text-xs text-teal-600 dark:text-teal-400 hover:underline font-semibold flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Open Repairs Board</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Stage Counter Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-6">
        {STAGES.map((st) => {
          const count = repairs.byStage[st.key] || 0;
          const isSelected = filterStage === st.key;

          return (
            <button
              key={st.key}
              onClick={() => setFilterStage(isSelected ? "ALL" : st.key)}
              className={`p-3 rounded-2xl border text-left transition-all ${
                isSelected
                  ? isLight
                    ? "bg-teal-50 border-teal-500 shadow-sm"
                    : "bg-teal-500/20 border-teal-400 shadow-md"
                  : isLight
                  ? "bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-800"
                  : "bg-black/20 border-white/5 hover:border-white/20 text-white"
              }`}
            >
              <span className={`text-[10px] font-mono uppercase block tracking-wider ${
                isLight ? "text-slate-500" : "text-slate-400"
              }`}>
                {st.label}
              </span>
              <span className={`text-xl font-black mt-0.5 block ${isLight ? "text-slate-900" : "text-white"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Jobs Grid */}
      {filteredJobs.length === 0 ? (
        <div className="text-center py-8 rounded-2xl bg-black/20 border border-white/5">
          <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2 opacity-80" />
          <p className="text-xs text-slate-300 font-semibold">No active repair jobs in this view</p>
          <p className="text-[11px] text-slate-500 mt-0.5">All customer devices are either delivered or in another stage.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {filteredJobs.map((job) => (
            <div
              key={job.id}
              onClick={() => onSelectJob?.(job.id)}
              className={`rounded-2xl p-4 transition-all cursor-pointer flex flex-col justify-between border ${
                isLight
                  ? "bg-white hover:bg-slate-50 border-slate-200/90 hover:border-teal-500 shadow-sm"
                  : "bg-black/30 hover:bg-black/50 border-white/10 hover:border-teal-500/40"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-mono text-xs font-black ${isLight ? "text-teal-700" : "text-teal-400"}`}>
                    {job.jobNo}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                      job.status === "ready"
                        ? isLight
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        : job.status === "waiting_parts"
                        ? isLight
                          ? "bg-amber-100 text-amber-900 border-amber-300"
                          : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                        : isLight
                        ? "bg-slate-100 text-slate-800 border-slate-300"
                        : "bg-slate-700 text-slate-300 border-slate-600"
                    }`}
                  >
                    {job.status.replace("_", " ")}
                  </span>
                </div>

                <div className={`font-bold text-sm line-clamp-1 flex items-center gap-1.5 ${
                  isLight ? "text-slate-900" : "text-white"
                }`}>
                  <Smartphone className={`h-3.5 w-3.5 shrink-0 ${isLight ? "text-teal-600" : "text-slate-400"}`} />
                  <span>{job.device}</span>
                </div>

                <p className={`text-xs line-clamp-1 mt-1 font-medium ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                  {job.problem}
                </p>
              </div>

              <div className={`pt-3 mt-3 border-t flex items-center justify-between text-[11px] ${
                isLight ? "border-slate-200 text-slate-600" : "border-white/5 text-slate-400"
              }`}>
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span className={`truncate max-w-[90px] font-semibold ${isLight ? "text-slate-800" : "text-slate-300"}`}>
                    {job.customerName}
                  </span>
                </span>
                <span className="flex items-center gap-1 font-mono font-bold">
                  <Clock className={`h-3 w-3 ${isLight ? "text-amber-600" : "text-amber-400"}`} />
                  <span className={isLight ? "text-amber-700" : "text-amber-300"}>{job.ageDays}d ago</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

