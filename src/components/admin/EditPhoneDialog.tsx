import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Upload, X, Eye, Camera, FileText, Receipt, Wifi, WifiOff, Loader2, Globe } from "lucide-react";
import PhotoViewer from "./PhotoViewer";
import ImeiScanButton from "./ImeiScanButton";
import { compressImage } from "@/utils/imageCompression";
import { useTacLookup } from "@/hooks/useTacLookup";
import VariantColourFields, {
  emptyChoice,
  choiceFromStored,
  resolveChoice,
  VARIANT_OPTIONS,
  COLOUR_OPTIONS,
  type Choice,
} from "./VariantColourFields";

interface EditPhoneDialogProps {
  phone: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EditPhoneDialog = ({ phone, open, onOpenChange }: EditPhoneDialogProps) => {
  const [formData, setFormData] = useState({
    phone_name: "",
    model: "",
    imei_number: "",
    condition: "" as "excellent" | "good" | "fair" | "poor" | "",
    purchase_price: "",
    selling_price: "",
    purchase_date: "",
    rating: "",
    bill_available: false,
    box_available: false,
    charger_available: false,
    features: "",
    payment_method: "" as "cash" | "upi" | "bank_transfer" | "card" | ""
  });
  const [variantChoice, setVariantChoice] = useState<Choice>(emptyChoice());
  const [colourChoice, setColourChoice] = useState<Choice>(emptyChoice());
  const [productPhotos, setProductPhotos] = useState<string[]>([]);
  const [purchaseDocuments, setPurchaseDocuments] = useState<string[]>([]);
  const [paymentProofPhotos, setPaymentProofPhotos] = useState<string[]>([]);
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [currentPhotos, setCurrentPhotos] = useState<string[]>([]);
  const [currentPhotoTitle, setCurrentPhotoTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  
  const queryClient = useQueryClient();

  // Step 2: TAC auto-fill (only fills fields the user left empty).
  // Brand -> phone name, marketing name -> model so inventory search hits both.
  const { status: tacStatus, info: tacInfo, error: tacError, fetchOnline: tacFetch } = useTacLookup(
    formData.imei_number,
    ({ brand, phoneName }) => {
      setFormData((prev) => ({
        ...prev,
        phone_name: prev.phone_name || brand || phoneName,
        model: prev.model || phoneName,
      }));
    },
  );

  const { data: sellers } = useQuery({
    queryKey: ['sellers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sellers').select('*');
      if (error) throw error;
      return data;
    }
  });

  useEffect(() => {
    if (phone) {
      setFormData({
        phone_name: phone.phone_name || "",
        model: phone.model || "",
        imei_number: phone.imei_number || "",
        condition: phone.condition || "",
        purchase_price: phone.purchase_price?.toString() || "",
        selling_price: phone.selling_price?.toString() || "",
        purchase_date: phone.purchase_date || "",
        rating: phone.rating?.toString() || "",
        bill_available: phone.bill_available || false,
        box_available: phone.box_available || false,
        charger_available: phone.charger_available || false,
        features: phone.features?.join(", ") || "",
        payment_method: phone.payment_method || ""
      });
      setVariantChoice(choiceFromStored(phone.variant, VARIANT_OPTIONS));
      setColourChoice(choiceFromStored(phone.colour, COLOUR_OPTIONS));
      setProductPhotos(phone.product_photos || []);
      setPurchaseDocuments(phone.purchase_documents || []);
      setPaymentProofPhotos(phone.payment_proof_photos || []);
    }
  }, [phone]);

  const uploadFile = async (file: File, folder: string): Promise<string> => {
    // Compress image before uploading
    const compressedFile = await compressImage(file, 300);
    console.log(`Original size: ${(file.size / 1024).toFixed(2)} KB, Compressed size: ${(compressedFile.size / 1024).toFixed(2)} KB`);
    
    const fileExt = compressedFile.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('phonezone-uploads')
      .upload(filePath, compressedFile);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('phonezone-uploads')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const handleFileUpload = async (files: FileList | null, type: 'product' | 'purchase' | 'payment') => {
    if (!files || files.length === 0) return;

    // Check limits
    if (type === 'product' && productPhotos.length + files.length > 4) {
      toast.error("Maximum 4 product photos allowed");
      return;
    }
    if (type === 'purchase' && purchaseDocuments.length + files.length > 5) {
      toast.error("Maximum 5 purchase documents allowed");
      return;
    }
    if (type === 'payment' && paymentProofPhotos.length + files.length > 5) {
      toast.error("Maximum 5 payment proof photos allowed");
      return;
    }

    setUploading(true);
    try {
      const uploadPromises = Array.from(files).map(file => {
        if (type === 'product') {
          return uploadFile(file, 'product-photos');
        } else if (type === 'purchase') {
          return uploadFile(file, 'purchase-documents');
        } else {
          return uploadFile(file, 'payment-proof');
        }
      });

      const uploadedUrls = await Promise.all(uploadPromises);

      if (type === 'product') {
        setProductPhotos(prev => [...prev, ...uploadedUrls]);
      } else if (type === 'purchase') {
        setPurchaseDocuments(prev => [...prev, ...uploadedUrls]);
      } else {
        setPaymentProofPhotos(prev => [...prev, ...uploadedUrls]);
      }

      toast.success("Files uploaded and compressed successfully!");
    } catch (error) {
      console.error('Upload error:', error);
      toast.error("Failed to upload files");
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (index: number, type: 'product' | 'purchase' | 'payment') => {
    if (type === 'product') {
      setProductPhotos(prev => prev.filter((_, i) => i !== index));
    } else if (type === 'purchase') {
      setPurchaseDocuments(prev => prev.filter((_, i) => i !== index));
    } else {
      setPaymentProofPhotos(prev => prev.filter((_, i) => i !== index));
    }
  };

  const viewPhotos = (photos: string[], title: string) => {
    setCurrentPhotos(photos);
    setCurrentPhotoTitle(title);
    setPhotoViewerOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const variant = resolveChoice(variantChoice, VARIANT_OPTIONS, "Variant");
    if (variant.error) {
      toast.error(variant.error);
      return;
    }

    const colour = resolveChoice(colourChoice, COLOUR_OPTIONS, "Colour");
    if (colour.error) {
      toast.error(colour.error);
      return;
    }

    try {
      const updateData = {
        phone_name: formData.phone_name,
        model: formData.model,
        variant: variant.value || null,
        colour: colour.value || null,
        imei_number: formData.imei_number,
        condition: formData.condition as "excellent" | "good" | "fair" | "poor",
        purchase_price: parseFloat(formData.purchase_price) || 0,
        selling_price: parseFloat(formData.selling_price) || 0,
        purchase_date: formData.purchase_date,
        rating: formData.rating ? parseFloat(formData.rating) : null,
        bill_available: formData.bill_available,
        box_available: formData.box_available,
        charger_available: formData.charger_available,
        features: formData.features ? formData.features.split(',').map(f => f.trim()).filter(f => f) : [],
        product_photos: productPhotos,
        purchase_documents: purchaseDocuments,
        payment_proof_photos: paymentProofPhotos,
        payment_method: formData.payment_method as "cash" | "upi" | "bank_transfer" | "card",
        updated_at: new Date().toISOString()
      };

      console.log('Updating phone with data:', updateData);

      // Route through the backend /api/phones/:id endpoint so the update goes
      // through the inventory service (IMEI validation, audit logging, financial
      // year scoping) instead of a raw DB update.
      const res = await fetch(`/api/phones/${phone.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updateData),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to update phone.");

      toast.success("Phone updated successfully!");
      queryClient.invalidateQueries({ queryKey: ['phones'] });
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating phone:', error);
      toast.error("Failed to update phone. Please check all fields and try again.");
    }
  };

  const PhotoUploadSection = ({ 
    title, 
    type, 
    photos, 
    maxFiles,
    icon: Icon,
    description
  }: { 
    title: string; 
    type: 'product' | 'purchase' | 'payment'; 
    photos: string[]; 
    maxFiles: number;
    icon: any;
    description: string;
  }) => (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {title} (Max {maxFiles})
      </Label>
      <p className="text-sm text-gray-500">{description}</p>
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
        <div className="text-center">
          <Upload className="mx-auto h-12 w-12 text-gray-400" />
          <div className="mt-2">
            <label htmlFor={`${type}-upload`} className="cursor-pointer">
              <span className="mt-2 block text-sm font-medium text-gray-900">
                Upload {title}
              </span>
              <input
                id={`${type}-upload`}
                name={`${type}-upload`}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files, type)}
                disabled={uploading || photos.length >= maxFiles}
              />
            </label>
          </div>
        </div>
      </div>
      
      {photos.length > 0 && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Uploaded Files ({photos.length})</span>
            {photos.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => viewPhotos(photos, title)}
              >
                <Eye className="h-4 w-4 mr-1" />
                View All
              </Button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((photo, index) => (
              <div key={index} className="relative">
                <div className="aspect-[9/16] relative overflow-hidden rounded border">
                  <img
                    src={photo}
                    alt={`${title} ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removePhoto(index, type)}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Phone</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Basic Information */}
              <div>
                <Label htmlFor="phone_name">Phone Name</Label>
                <Input
                  id="phone_name"
                  value={formData.phone_name}
                  onChange={(e) => setFormData({...formData, phone_name: e.target.value})}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  value={formData.model}
                  onChange={(e) => setFormData({...formData, model: e.target.value})}
                  required
                />
              </div>

              <VariantColourFields
                variant={variantChoice}
                colour={colourChoice}
                onVariantChange={setVariantChoice}
                onColourChange={setColourChoice}
              />
              
              <div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="imei_number">IMEI Number</Label>
                  <ImeiScanButton
                    onResult={(r) => setFormData((prev) => ({ ...prev, imei_number: r.imei }))}
                  />
                </div>
                <Input
                  id="imei_number"
                  className="mt-1"
                  value={formData.imei_number}
                  onChange={(e) => setFormData({...formData, imei_number: e.target.value})}
                  required
                />
                {tacStatus !== "idle" && (
                  <p
                    className={`text-xs mt-1 flex items-center gap-1 ${
                      tacStatus === "found"
                        ? "text-green-600"
                        : tacStatus === "error"
                          ? "text-red-500"
                          : "text-gray-500"
                    }`}
                    role="status"
                  >
                    {tacStatus === "checking" && (
                      <><Loader2 className="h-3 w-3 animate-spin" /> Checking TAC database...</>
                    )}
                    {tacStatus === "found" && (
                      <><Wifi className="h-3 w-3" /> {tacInfo?.brand} {tacInfo?.phoneName}</>
                    )}
                    {tacStatus === "fetching" && (
                      <><Globe className="h-3 w-3 animate-spin" /> Asking the Hicelltek API...</>
                    )}
                    {tacStatus === "miss" && (
                      <><WifiOff className="h-3 w-3" /> TAC not in the local database.{" "}
                        {tacInfo?.fetchMode === "ask" && tacInfo?.hasKeys ? (
                          <button
                            type="button"
                            className="underline text-blue-600 hover:text-blue-800"
                            onClick={() => tacFetch(formData.imei_number)}
                          >
                            Look it up online?
                          </button>
                        ) : null}
                      </>
                    )}
                    {tacStatus === "error" && <>{tacError || "TAC lookup failed."}</>}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="condition">Condition</Label>
                <Select value={formData.condition} onValueChange={(value: "excellent" | "good" | "fair" | "poor") => setFormData({...formData, condition: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excellent">Excellent</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="poor">Poor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="purchase_price">Purchase Price (₹)</Label>
                <Input
                  id="purchase_price"
                  type="number"
                  step="0.01"
                  value={formData.purchase_price}
                  onChange={(e) => setFormData({...formData, purchase_price: e.target.value})}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="selling_price">Selling Price (₹)</Label>
                <Input
                  id="selling_price"
                  type="number"
                  step="0.01"
                  value={formData.selling_price}
                  onChange={(e) => setFormData({...formData, selling_price: e.target.value})}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="purchase_date">Purchase Date</Label>
                <Input
                  id="purchase_date"
                  type="date"
                  value={formData.purchase_date}
                  onChange={(e) => setFormData({...formData, purchase_date: e.target.value})}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="rating">Rating (0-5)</Label>
                <Input
                  id="rating"
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  value={formData.rating}
                  onChange={(e) => setFormData({...formData, rating: e.target.value})}
                />
              </div>
              
              <div>
                <Label htmlFor="payment_method">Payment Method</Label>
                <Select value={formData.payment_method} onValueChange={(value: "cash" | "upi" | "bank_transfer" | "card") => setFormData({...formData, payment_method: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Features */}
            <div>
              <Label htmlFor="features">Features (comma separated)</Label>
              <Textarea
                id="features"
                value={formData.features}
                onChange={(e) => setFormData({...formData, features: e.target.value})}
                placeholder="e.g., Dual Camera, Fast Charging, Wireless Charging"
              />
            </div>

            {/* Accessories */}
            <div className="space-y-3">
              <Label>Available Accessories</Label>
              <div className="flex space-x-6">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="bill_available"
                    checked={formData.bill_available}
                    onCheckedChange={(checked) => setFormData({...formData, bill_available: checked as boolean})}
                  />
                  <Label htmlFor="bill_available">Bill Available</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="box_available"
                    checked={formData.box_available}
                    onCheckedChange={(checked) => setFormData({...formData, box_available: checked as boolean})}
                  />
                  <Label htmlFor="box_available">Box Available</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="charger_available"
                    checked={formData.charger_available}
                    onCheckedChange={(checked) => setFormData({...formData, charger_available: checked as boolean})}
                  />
                  <Label htmlFor="charger_available">Charger Available</Label>
                </div>
              </div>
            </div>

            {/* Photo Upload Sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <PhotoUploadSection
                title="Product Photos"
                type="product"
                photos={productPhotos}
                maxFiles={4}
                icon={Camera}
                description="Photos displayed on homepage - automatically compressed"
              />

              <PhotoUploadSection
                title="Purchase Documents"
                type="purchase"
                photos={purchaseDocuments}
                maxFiles={5}
                icon={FileText}
                description="Bills, receipts, purchase records - automatically compressed"
              />

              <PhotoUploadSection
                title="Payment Proof Photos"
                type="payment"
                photos={paymentProofPhotos}
                maxFiles={5}
                icon={Receipt}
                description="Payment screenshots, receipts - automatically compressed"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={uploading}>
                {uploading ? "Compressing & Uploading..." : "Update Phone"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <PhotoViewer
        photos={currentPhotos}
        open={photoViewerOpen}
        onOpenChange={setPhotoViewerOpen}
        title={currentPhotoTitle}
      />
    </>
  );
};

export default EditPhoneDialog;
