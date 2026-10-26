import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Copy, X, Building2, Phone, Mail, ChevronDown, Loader2, AlertTriangle } from "lucide-react";

interface Shop {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

interface ShopManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "copy";
  existingShopId?: string | null;
  /** Called after a shop is created, so the caller can refresh its shop list. */
  onSaved?: () => void;
}

const ShopManagementDialog = ({
  open,
  onOpenChange,
  mode,
  existingShopId,
  onSaved,
}: ShopManagementDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState<string>("");

  // Form data
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    logo_url: "",
  });

  // Copy mode state
  const [copyFromShop, setCopyFromShop] = useState<string | null>(null);

  // Load shops on open. The freshly fetched list is used directly: reading the
  // `shops` state inside this effect would only see the previous render's value
  // (stale closure), so "copy from this shop" never prefilled.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const fetchShops = async () => {
      try {
        const { data, error } = await supabase.from('shops').select('*').order('name');
        if (error) throw error;
        if (cancelled) return;
        const list = (data || []) as Shop[];
        setShops(list);
        const source = mode === "copy" ? list.find((s) => s.id === existingShopId) : undefined;
        if (source) {
          setSelectedShop(source.id);
          setCopyFromShop(source.id);
          setFormData({
            name: source.name,
            address: source.address ?? "",
            phone: source.phone ?? "",
            email: source.email ?? "",
            logo_url: source.logo_url || "",
          });
          return;
        }
        setSelectedShop("");
        setCopyFromShop(null);
      } catch (err) {
        console.error('Error fetching shops:', err);
        if (!cancelled) toast.error("Failed to load shops");
      }
    };
    fetchShops();
    return () => { cancelled = true; };
  }, [open, mode, existingShopId]);

  // Auto-fill from selected shop when copy mode
  useEffect(() => {
    if (mode === "copy" && copyFromShop && shops.length > 0) {
      const shop = shops.find(s => s.id === copyFromShop);
      if (shop) {
        setFormData({
          name: shop.name,
          address: shop.address ?? "",
          phone: shop.phone ?? "",
          email: shop.email ?? "",
          logo_url: shop.logo_url || "",
        });
      }
    } else if (!copyFromShop) {
      // Reset form for add mode
      setFormData({
        name: "",
        address: "",
        phone: "",
        email: "",
        logo_url: "",
      });
    }
  }, [copyFromShop, mode, shops]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Shop name is required");
      return;
    }
    if (!formData.phone.trim()) {
      toast.error("Shop phone number is required");
      return;
    }
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('shops').insert({
        name: formData.name.trim(),
        address: formData.address.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || null,
        logo_url: formData.logo_url.trim() || null,
      });

      if (error) throw error;

      toast.success(mode === "copy" ? "Shop copied successfully!" : "Shop added successfully!");
      onSaved?.();
      onOpenChange(false);
      setFormData({ name: "", address: "", phone: "", email: "", logo_url: "" });
      setCopyFromShop(null);
    } catch (error: any) {
      console.error('Error saving shop:', error);
      toast.error(error.message || "Failed to save shop");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyDetails = (shopId: string) => {
    setSelectedShop(shopId);
    setCopyFromShop(shopId);
    const shop = shops.find(s => s.id === shopId);
    if (shop) {
      setFormData({
        name: shop.name,
        address: shop.address ?? "",
        phone: shop.phone ?? "",
        email: shop.email ?? "",
        logo_url: shop.logo_url || "",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "copy" ? "Copy Shop Details" : "Add New Shop"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Copy mode indicator */}
          {mode === "copy" && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5" />
                <p className="text-sm text-blue-800">
                  Select a shop to copy all its details. You can edit any field after copying.
                </p>
              </div>
            </div>
          )}

          {mode === "copy" && shops.length > 0 && (
            <div>
              <Label htmlFor="shop_copy">Copy from existing shop</Label>
              <Select value={selectedShop} onValueChange={handleCopyDetails}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a shop to copy from" />
                </SelectTrigger>
                <SelectContent>
                  {shops.map((shop) => (
                    <SelectItem key={shop.id} value={shop.id}>
                      {shop.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Shop Name */}
          <div>
            <Label htmlFor="shop_name">Shop Name *</Label>
            <Input
              id="shop_name"
              placeholder="e.g., MOBILE WORLD, Mobile World 2.0"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          {/* Address */}
          <div>
            <Label htmlFor="shop_address">Address</Label>
            <Textarea
              id="shop_address"
              placeholder="Enter shop address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={3}
            />
          </div>

          {/* Phone */}
          <div>
            <Label htmlFor="shop_phone">Phone Number *</Label>
            <Input
              id="shop_phone"
              placeholder="e.g., 9876543210"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
            />
          </div>

          {/* Email */}
          <div>
            <Label htmlFor="shop_email">Email</Label>
            <Input
              id="shop_email"
              type="email"
              placeholder="e.g., shop@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          {/* Logo */}
          <div>
            <Label>Shop Logo (optional)</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    setIsUploadingLogo(true);
                    // Upload the bytes and store a URL. A data: URL used to be
                    // saved straight into shops.logo_url: it bloated the row,
                    // was never served by the backend, and could not be
                    // cleaned up when the shop was deleted.
                    const fileExt = (file.name.split('.').pop() || 'png').toLowerCase();
                    const filePath = `logo/shop-${Date.now()}.${fileExt}`;
                    const { error: uploadError } = await supabase.storage
                      .from('phonezone-uploads')
                      .upload(filePath, file);
                    if (uploadError) throw uploadError;
                    const { data } = supabase.storage
                      .from('phonezone-uploads')
                      .getPublicUrl(filePath);
                    setFormData((prev) => ({ ...prev, logo_url: data.publicUrl }));
                    toast.success('Logo uploaded');
                  } catch (err: any) {
                    console.error('Logo upload failed:', err);
                    toast.error(err?.message || 'Could not upload the logo');
                  } finally {
                    setIsUploadingLogo(false);
                  }
                }}
              />
              {isUploadingLogo && (
                <span className="text-xs text-blue-600">
                  <Loader2 className="h-3 w-3 inline mr-1 animate-spin" /> Uploading...
                </span>
              )}
              {!isUploadingLogo && formData.logo_url && (
                <span className="text-xs text-green-600">
                  <Check className="h-3 w-3 inline mr-1" /> Uploaded
                </span>
              )}
            </div>
            {formData.logo_url && (
              <div className="mt-2">
                <img
                  src={formData.logo_url}
                  alt="Logo preview"
                  className="h-16 w-auto object-contain border rounded"
                />
              </div>
            )}
          </div>

          {/* Submit buttons */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isUploadingLogo}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {mode === "copy" ? "Copying..." : "Saving..."}
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  {mode === "copy" ? "Copy Details" : "Add Shop"}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Helper icon for checked checkbox
function Check({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>;
}

export default ShopManagementDialog;
