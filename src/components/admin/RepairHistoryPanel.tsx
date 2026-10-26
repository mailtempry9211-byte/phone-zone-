import React from "react";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Wrench, Calendar, CheckCircle2, AlertTriangle } from "lucide-react";

interface RepairJobHistoryItem {
  id: string;
  job_no: string;
  device_brand?: string;
  device_model?: string;
  problem: string;
  board_replaced?: number;
  final_price?: number;
  status: string;
  received_at?: string;
  delivered_at?: string;
  customer_name?: string;
  customer_phone?: string;
  items?: Array<{
    kind: string;
    description: string;
    qty?: number;
    unit_price?: number;
    is_board?: number;
  }>;
}

interface RepairHistoryPanelProps {
  jobs: RepairJobHistoryItem[];
  title?: string;
}

export const RepairHistoryPanel: React.FC<RepairHistoryPanelProps> = ({ jobs, title }) => {
  if (!jobs || jobs.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-gray-500 bg-gray-50 rounded-md border">
        No previous repair records found.
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
      {title && <h4 className="font-semibold text-sm text-gray-700">{title}</h4>}
      {jobs.map((job) => {
        const isBoard = !!job.board_replaced;
        return (
          <div
            key={job.id}
            className={`p-3 rounded-lg border text-sm ${
              isBoard ? "border-red-300 bg-red-50/50" : "border-amber-200 bg-amber-50/40"
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900">{job.job_no}</span>
                <Badge variant={job.status === "delivered" ? "default" : "secondary"} className="text-xs">
                  {job.status}
                </Badge>
                {isBoard && (
                  <Badge variant="destructive" className="text-xs bg-red-600">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    MOTHERBOARD REPLACED
                  </Badge>
                )}
              </div>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {job.received_at ? new Date(job.received_at).toLocaleDateString("en-IN") : "Past"}
              </span>
            </div>

            <div className="text-gray-700 mb-1">
              <b>Device:</b> {job.device_brand || ""} {job.device_model || ""}
            </div>
            <div className="text-gray-700 mb-1">
              <b>Reported Problem:</b> {job.problem}
            </div>

            {job.items && job.items.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-200 text-xs">
                <div className="font-medium text-gray-600 mb-1">Parts & Labour:</div>
                <ul className="list-disc list-inside space-y-0.5 text-gray-600">
                  {job.items.map((it, idx) => (
                    <li key={idx}>
                      {it.description} ({it.kind}){it.is_board ? " - [BOARD]" : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-2 flex justify-between items-center text-xs text-gray-500 pt-1 border-t border-gray-100">
              <span>Customer: {job.customer_name || "-"} ({job.customer_phone || "-"})</span>
              {job.final_price ? <span className="font-semibold text-gray-800">Total: ₹{job.final_price}</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RepairHistoryPanel;

