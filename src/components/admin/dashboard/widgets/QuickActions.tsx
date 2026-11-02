import React from "react";
import { Plus, ShoppingCart, Wrench, Smartphone, UserPlus, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuickActionsProps {
  onNewSale?: () => void;
  onNewRepair?: () => void;
  onAddPhone?: () => void;
  onAddCustomer?: () => void;
  onScanImei?: () => void;
  hasRepairs?: boolean;
  styleMode?: "glass" | "darkteal";
  isLight?: boolean;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  onNewSale,
  onNewRepair,
  onAddPhone,
  onAddCustomer,
  onScanImei,
  hasRepairs = true,
  styleMode = "glass",
  isLight = false,
}) => {
  const actions = [
    {
      label: "New Sale",
      icon: <ShoppingCart className="h-4 w-4 text-emerald-400" />,
      onClick: onNewSale,
      primary: true,
    },
    ...(hasRepairs
      ? [
          {
            label: "New Repair",
            icon: <Wrench className="h-4 w-4 text-teal-400" />,
            onClick: onNewRepair,
            primary: false,
          },
        ]
      : []),
    {
      label: "Buy / Add Phone",
      icon: <Smartphone className="h-4 w-4 text-blue-400" />,
      onClick: onAddPhone,
      primary: false,
    },
    {
      label: "Add Customer",
      icon: <UserPlus className="h-4 w-4 text-purple-400" />,
      onClick: onAddCustomer,
      primary: false,
    },
    {
      label: "Scan IMEI",
      icon: <QrCode className="h-4 w-4 text-amber-400" />,
      onClick: onScanImei,
      primary: false,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {actions.map((act) => (
        <Button
          key={act.label}
          size="sm"
          onClick={act.onClick}
          className={`h-9 px-3.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
            act.primary
              ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30"
              : isLight
              ? "bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 shadow-xs"
              : styleMode === "glass"
              ? "bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-sm"
              : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
          }`}
        >
          {act.icon}
          <span>{act.label}</span>
        </Button>
      ))}
    </div>
  );
};

