import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Wrench, UserCheck, History } from "lucide-react";
import RepairHistoryPanel from "./RepairHistoryPanel";

interface RepairCustomerData {
  id: string;
  name: string;
  phone: string;
  address?: string;
  id_proof_type?: string;
  id_number?: string;
  photo_file_id?: string;
  aadhaar_photo_file_id?: string;
}

interface RepairMatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: RepairCustomerData;
  onAccept: (selectedDetails: Partial<RepairCustomerData>) => void;
  onSkip: () => void;
  historyJobs?: any[];
}

export const RepairMatchDialog: React.FC<RepairMatchDialogProps> = ({
  open,
  onOpenChange,
  customer,
  onAccept,
  onSkip,
  historyJobs = [],
}) => {
  const [fetchName, setFetchName] = useState(true);
  const [fetchAddress, setFetchAddress] = useState(true);
  const [fetchIdProof, setFetchIdProof] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  const handleApply = () => {
    const selected: Partial<RepairCustomerData> = {};
    if (fetchName) selected.name = customer.name;
    if (fetchAddress && customer.address) selected.address = customer.address;
    if (fetchIdProof) {
      if (customer.id_proof_type) selected.id_proof_type = customer.id_proof_type;
      if (customer.id_number) selected.id_number = customer.id_number;
      if (customer.photo_file_id) selected.photo_file_id = customer.photo_file_id;
      if (customer.aadhaar_photo_file_id) selected.aadhaar_photo_file_id = customer.aadhaar_photo_file_id;
    }
    onAccept(selected);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-600 mb-1">
            <Wrench className="h-5 w-5" />
            <DialogTitle>Existing Repair Customer Found</DialogTitle>
          </div>
          <DialogDescription>
            This mobile number <b>{customer.phone}</b> belongs to repair customer:{" "}
            <span className="font-semibold text-gray-900">{customer.name}</span>.
          </DialogDescription>
        </DialogHeader>

        {showHistory ? (
          <div className="py-2">
            <RepairHistoryPanel jobs={historyJobs} title={`Repair History for ${customer.name}`} />
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={() => setShowHistory(false)}
            >
              Back to Import Options
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <p className="text-xs text-gray-500">
              Select which details to copy into this form. (Original repair records will not be altered).
            </p>

            <div className="space-y-3 bg-gray-50 p-3 rounded-lg border">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="chk-name"
                  checked={fetchName}
                  onCheckedChange={(c) => setFetchName(!!c)}
                />
                <Label htmlFor="chk-name" className="text-sm font-medium cursor-pointer">
                  Customer Name: <b>{customer.name}</b>
                </Label>
              </div>

              {customer.address && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="chk-addr"
                    checked={fetchAddress}
                    onCheckedChange={(c) => setFetchAddress(!!c)}
                  />
                  <Label htmlFor="chk-addr" className="text-sm font-medium cursor-pointer">
                    Address: <span className="text-gray-600">{customer.address}</span>
                  </Label>
                </div>
              )}

              {customer.id_number && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="chk-id"
                    checked={fetchIdProof}
                    onCheckedChange={(c) => setFetchIdProof(!!c)}
                  />
                  <Label htmlFor="chk-id" className="text-sm font-medium cursor-pointer">
                    ID Proof: <span className="text-gray-600">[{customer.id_proof_type?.toUpperCase() || "ID"}] {customer.id_number}</span>
                  </Label>
                </div>
              )}
            </div>

            {historyJobs && historyJobs.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1"
                onClick={() => setShowHistory(true)}
              >
                <History className="w-4 h-4" />
                View Customer Repair History ({historyJobs.length} records)
              </Button>
            )}
          </div>
        )}

        <DialogFooter className="flex sm:justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onSkip();
              onOpenChange(false);
            }}
          >
            Skip
          </Button>
          <Button
            type="button"
            className="bg-amber-600 hover:bg-amber-700 text-white"
            onClick={handleApply}
          >
            <UserCheck className="w-4 h-4 mr-1.5" />
            Fetch Selected Details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RepairMatchDialog;

