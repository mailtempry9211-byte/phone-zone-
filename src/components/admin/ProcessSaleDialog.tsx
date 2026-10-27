import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Upload, X, Plus, User, CalendarIcon, Search, Wrench } from "lucide-react";
import { compressImage } from "@/utils/imageCompression";
import AadhaarScanButton from "./AadhaarScanButton";
import PartyPicker from "./PartyPicker";
import RepairMatchDialog from "./RepairMatchDialog";
import { fillPersonFields, type AadhaarData } from "@/lib/aadhaarParser";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import PostTransactionShareDialog, { type PostTransactionPhone, type PostTransactionParty } from "./PostTransactionShareDialog";
import { buildInvoiceHtml, DEFAULT_SALE_TERMS } from "@/lib/invoiceTemplates";

interface ProcessSaleDialogProps {
  phone: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ProcessSaleDialog = ({ phone, open, onOpenChange }: ProcessSaleDialogProps) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [partyPickerOpen, setPartyPickerOpen] = useState(false);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [sellingPrice, setSellingPrice] = useState("");
  const [saleDate, setSaleDate] = useState<Date>();
  const [saleDocuments, setSaleDocuments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    address: "",
    id_proof_type: "" as "aadhaar" | "pan" | "driving_license" | "voter_id" | "",
    id_number: ""
  });

  // Repair cross-check states
  const [repairMatchOpen, setRepairMatchOpen] = useState(false);
  const [repairCustomerMatch, setRepairCustomerMatch] = useState<any | null>(null);
  const [askedPhones, setAskedPhones] = useState<Set<string>>(new Set());
  const [repairImeiJobs, setRepairImeiJobs] = useState<any[]>([]);

  const [adminSettings, setAdminSettings] = useState<any>(null);
  const [postShareOpen, setPostShareOpen] = useState(false);
  const [postShareData, setPostShareData] = useState<{
    phone: PostTransactionPhone;
    party: PostTransactionParty;
    invoiceHtml: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setAdminSettings(d))
      .catch(() => {});
  }, []);

  // Cross-check: customer phone -> repair customers
  useEffect(() => {
    if (!open) return;
    const clean = newCustomer.phone.replace(/\D/g, "");
    if (clean.length === 10 && !askedPhones.has(clean)) {
      setAskedPhones((prev) => new Set([...prev, clean]));
      fetch(`/api/repair/customers/by-phone/${clean}`)
        .then((r) => (r.ok ? r.json() : null))
        .then(async (cust) => {
          if (cust) {
            let hist: any[] = [];
            try {
              const h = await fetch(`/api/repair/customers/${cust.id}/history`);
              if (h.ok) hist = await h.json();
            } catch {}
            setRepairCustomerMatch({ ...cust, historyJobs: hist });
            setRepairMatchOpen(true);
          }
        })
        .catch(() => {});
    }
  }, [newCustomer.phone, open, askedPhones]);

  // Cross-check: selling phone's IMEI -> repair jobs
  useEffect(() => {
    if (!open || !phone?.imei_number) { setRepairImeiJobs([]); return; }
    fetch(`/api/repair/by-imei/${String(phone.imei_number).trim()}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((jobs) => {
        if (Array.isArray(jobs) && jobs.length > 0) {
          setRepairImeiJobs(jobs);
        } else {
          setRepairImeiJobs([]);
        }
      })
      .catch(() => setRepairImeiJobs([]));
  }, [phone?.imei_number, open]);

  const queryClient = useQueryClient();

  // Step 3: offline Aadhaar OCR -> new customer fields. fillPersonFields fills
  // only empty fields for the same person (front -> name, back -> address) and
  // replaces them when a different person's card is scanned.
  const applyAadhaarToCustomer = (d: AadhaarData) =>
    setNewCustomer((prev) => ({ ...fillPersonFields(prev, d), id_proof_type: "aadhaar" as const }));

  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('customers').select('*').order('name');
      if (error) throw error;
      return data;
    }
  });

  useEffect(() => {
    if (phone && open) {
      setSellingPrice(phone.selling_price?.toString() || "");
      setSaleDate(new Date());
      setSaleDocuments([]);
      setSelectedCustomerId("");
      setShowNewCustomerForm(false);
      setNewCustomer({
        name: "",
        phone: "",
        address: "",
        id_proof_type: "",
        id_number: ""
      });
    }
  }, [phone, open]);

  const uploadFile = async (file: File): Promise<string> => {
    const compressedFile = await compressImage(file, 300);
    const fileExt = compressedFile.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `sale-documents/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('phonezone-uploads')
      .upload(filePath, compressedFile);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('phonezone-uploads')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = files.map(file => uploadFile(file));
      const urls = await Promise.all(uploadPromises);
      setSaleDocuments(prev => [...prev, ...urls]);
      toast.success(`${files.length} document(s) uploaded successfully`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error("Failed to upload documents");
    } finally {
      setUploading(false);
    }
  };

  const removeDocument = (index: number) => {
    setSaleDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const createCustomer = async () => {
    try {
      // Ensure id_proof_type is not empty
      if (!newCustomer.id_proof_type) {
        throw new Error("ID proof type is required");
      }

      const customerData = {
        ...newCustomer,
        id_proof_type: newCustomer.id_proof_type as "aadhaar" | "pan" | "driving_license" | "voter_id"
      };

      const { data, error } = await supabase
        .from('customers')
        .insert([customerData])
        .select()
        .single();

      if (error) throw error;
      
      toast.success("Customer created successfully!");
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setSelectedCustomerId(data.id);
      setShowNewCustomerForm(false);
      return data.id;
    } catch (error) {
      console.error('Error creating customer:', error);
      toast.error("Failed to create customer");
      throw error;
    }
  };

  const handleProcessSale = async () => {
    if (!sellingPrice) {
      toast.error("Please enter selling price");
      return;
    }
    
    if (!saleDate) {
      toast.error("Please select sale date");
      return;
    }

    let customerId = selectedCustomerId;

    // Create new customer if needed
    if (showNewCustomerForm) {
      if (!newCustomer.name || !newCustomer.phone || !newCustomer.id_proof_type || !newCustomer.id_number) {
        toast.error("Please fill all customer details");
        return;
      }
      try {
        customerId = await createCustomer();
      } catch (error) {
        return;
      }
    } else if (!customerId) {
      toast.error("Please select a customer");
      return;
    }

    setLoading(true);
    try {
      // Route through the backend /api/sales endpoint so the sale is atomic:
      // phone marked sold + customer attached + sale invoice created, all in one
      // transaction. The direct supabase.update() path bypassed invoice creation
      // and audit logging.
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          phone_id: phone.id,
          customer_id: customerId,
          sale_price: parseFloat(sellingPrice),
          sold_date: saleDate.toISOString(),
          invoice_html: null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to process sale.");

      let customerObj: {
        name: string;
        phone: string;
        address?: string;
        id_proof_type?: string;
        id_number?: string;
      } = { name: "Customer", phone: "", address: "", id_proof_type: "", id_number: "" };

      if (showNewCustomerForm) {
        customerObj = {
          name: newCustomer.name,
          phone: newCustomer.phone,
          address: newCustomer.address,
          id_proof_type: newCustomer.id_proof_type,
          id_number: newCustomer.id_number,
        };
      } else {
        const found = customers?.find((c: any) => c.id === customerId);
        if (found) {
          customerObj = {
            name: found.name || "",
            phone: found.phone || "",
            address: found.address || "",
            id_proof_type: found.id_proof_type || "",
            id_number: found.id_number || "",
          };
        }
      }

      let invoiceHtml = "";
      try {
        if (adminSettings) {
          invoiceHtml = buildInvoiceHtml({
            kind: 'sale',
            style: 'heritage',
            settings: adminSettings,
            phone: {
              ...phone,
              selling_price: parseFloat(sellingPrice),
              sold_date: saleDate.toISOString(),
              customers: {
                name: customerObj.name,
                phone: customerObj.phone,
                address: customerObj.address,
                id_proof_type: customerObj.id_proof_type,
                id_number: customerObj.id_number,
              },
            },
            amount: parseFloat(sellingPrice),
            isBroker: false,
            brokerName: '',
            includeSapathPatra: false,
            photoChoice: saleDocuments.length > 0 ? 'purchase' : 'none',
            productPhotos: phone.product_photos || [],
            documentPhotos: saleDocuments,
            documentLabel: 'Sale Documents',
            terms: (adminSettings.terms_and_conditions_sale || adminSettings.terms_and_conditions || '').split('\n').filter(Boolean),
            fallbackTerms: DEFAULT_SALE_TERMS,
          });
        }
      } catch (e) {
        console.warn("Failed to generate sale invoice HTML for post-share", e);
      }

      setPostShareData({
        phone: {
          phone_name: phone.phone_name,
          model: phone.model,
          imei_number: phone.imei_number,
          amount: parseFloat(sellingPrice),
          condition: phone.condition,
        },
        party: {
          name: customerObj.name,
          phone: customerObj.phone,
          address: customerObj.address,
          idProofType: customerObj.id_proof_type,
          idNumber: customerObj.id_number,
          role: "customer",
        },
        invoiceHtml,
      });

      toast.success("Sale processed successfully!");
      queryClient.invalidateQueries({ queryKey: ['phones'] });
      queryClient.invalidateQueries({ queryKey: ['sold-phones'] });
      onOpenChange(false);
      setPostShareOpen(true);
    } catch (error) {
      console.error('Error processing sale:', error);
      toast.error(error instanceof Error ? error.message : "Failed to process sale");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Process Sale - {phone?.phone_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Phone Details */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Phone Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><strong>Model:</strong> {phone?.model}</div>
              <div><strong>IMEI:</strong> {phone?.imei_number}</div>
              <div><strong>Condition:</strong> {phone?.condition}</div>
              <div><strong>Purchase Price:</strong> ₹{phone?.purchase_price}</div>
              {repairImeiJobs.length > 0 && (
                <div className="col-span-2 mt-1">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                    <Wrench className="w-3.5 h-3.5 text-amber-700" />
                    Repaired previously at our shop ({repairImeiJobs[0]?.job_no} on {new Date(repairImeiJobs[0]?.received_at || Date.now()).toLocaleDateString("en-IN")})
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Selling Price */}
          <div>
            <Label htmlFor="selling_price">Selling Price *</Label>
            <Input
              id="selling_price"
              type="number"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              placeholder="Enter selling price"
              required
            />
          </div>

          {/* Sale Date */}
          <div>
            <Label>Sale Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !saleDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {saleDate ? format(saleDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={saleDate}
                  onSelect={setSaleDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Customer Selection */}
          <div>
            <Label>Customer *</Label>
            <div className="flex gap-2 mb-2">
              <Button
                type="button"
                variant={!showNewCustomerForm ? "default" : "outline"}
                size="sm"
                onClick={() => setShowNewCustomerForm(false)}
              >
                <User className="h-4 w-4 mr-1" />
                Select Existing
              </Button>
              <Button
                type="button"
                variant={showNewCustomerForm ? "default" : "outline"}
                size="sm"
                onClick={() => setShowNewCustomerForm(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add New Customer
              </Button>
            </div>

            {!showNewCustomerForm ? (
              <>
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-2 border rounded-md px-3 py-2 text-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-ring"
                  onClick={() => setPartyPickerOpen(true)}
                >
                  <span className={selectedCustomerId ? "" : "text-gray-400"}>
                    {selectedCustomerId
                      ? customers?.find((c) => c.id === selectedCustomerId)?.name || "Customer selected"
                      : "Search & select a customer..."}
                  </span>
                  <Search className="h-4 w-4 text-gray-400 shrink-0" />
                </button>
                <PartyPicker
                  role="customer"
                  open={partyPickerOpen}
                  onOpenChange={setPartyPickerOpen}
                  onSelect={(party) => setSelectedCustomerId(party.id)}
                  onClear={() => setSelectedCustomerId("")}
                />
              </>
            ) : (
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-gray-500">Scan Aadhaar to fill the customer details.</p>
                  <AadhaarScanButton onResult={applyAadhaarToCustomer} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="customer_name">Name *</Label>
                    <Input
                      id="customer_name"
                      value={newCustomer.name}
                      onChange={(e) => setNewCustomer(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Customer name"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="customer_phone">Phone *</Label>
                    <Input
                      id="customer_phone"
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="Phone number"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="customer_address">Address</Label>
                  <Textarea
                    id="customer_address"
                    value={newCustomer.address}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Customer address"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="id_proof_type">ID Proof Type *</Label>
                    <Select 
                      value={newCustomer.id_proof_type} 
                      onValueChange={(value) => setNewCustomer(prev => ({ ...prev, id_proof_type: value as any }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select ID type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aadhaar">Aadhaar Card</SelectItem>
                        <SelectItem value="pan">PAN Card</SelectItem>
                        <SelectItem value="driving_license">Driving License</SelectItem>
                        <SelectItem value="voter_id">Voter ID</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="id_number">ID Number *</Label>
                    <Input
                      id="id_number"
                      value={newCustomer.id_number}
                      onChange={(e) => setNewCustomer(prev => ({ ...prev, id_number: e.target.value }))}
                      placeholder="ID number"
                      required
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sale Documents Upload */}
          <div>
            <Label>Sale Documents</Label>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
                <Button type="button" disabled={uploading}>
                  <Upload className="h-4 w-4 mr-1" />
                  {uploading ? "Uploading..." : "Upload"}
                </Button>
              </div>

              {saleDocuments.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                  {saleDocuments.map((url, index) => (
                    <div key={index} className="relative">
                      <img
                        src={url}
                        alt={`Sale document ${index + 1}`}
                        className="w-full h-24 object-cover rounded border"
                      />
                      <button
                        type="button"
                        onClick={() => removeDocument(index)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleProcessSale}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? "Processing..." : "Process Sale"}
            </Button>
          </div>
        </div>
      </DialogContent>

      {repairCustomerMatch && (
        <RepairMatchDialog
          open={repairMatchOpen}
          onOpenChange={setRepairMatchOpen}
          customer={repairCustomerMatch}
          historyJobs={repairCustomerMatch.historyJobs || []}
          onAccept={(selected) => {
            setShowNewCustomerForm(true);
            setSelectedCustomerId("");
            setNewCustomer((prev) => ({
              ...prev,
              ...(selected.name ? { name: selected.name } : {}),
              ...(selected.address ? { address: selected.address } : {}),
              ...(selected.id_proof_type ? { id_proof_type: selected.id_proof_type as any } : {}),
              ...(selected.id_number ? { id_number: selected.id_number } : {}),
            }));
            toast.success("Loaded customer details from repair record.");
          }}
          onSkip={() => {}}
        />
      )}
    </Dialog>

    {/* Post-Sale WhatsApp Share Prompt Modal */}
    <PostTransactionShareDialog
      open={postShareOpen}
      onOpenChange={setPostShareOpen}
      type="sale"
      phone={postShareData?.phone || null}
      party={postShareData?.party || null}
      invoiceHtml={postShareData?.invoiceHtml || ""}
      adminSettings={adminSettings}
    />
    </>
  );
};

export default ProcessSaleDialog;