import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, X, Camera, FileText, Receipt, Wifi, WifiOff, Loader2, Globe, Search, AlertTriangle, History, ShieldCheck, PenTool, CheckCircle, ArrowRight, ArrowLeft, User, Eye, Plus, Trash2 } from "lucide-react";
import { compressImage } from "@/utils/imageCompression";
import { useTacLookup } from "@/hooks/useTacLookup";
import AadhaarScanButton from "./AadhaarScanButton";
import ImeiScanButton from "./ImeiScanButton";
import ImeiHistoryDialog from "./ImeiHistoryDialog";
import SignaturePadModal from "./SignaturePadModal";
import SapathPatraModal from "./SapathPatraModal";
import { OFFLINE } from "@/lib/data";
import { getImeiHistory } from "@/lib/data/financialYear";
import PartyPicker from "./PartyPicker";
import { InterconnectedPartyLookup } from "./InterconnectedPartyLookup";
import { fillPersonFields, type AadhaarData } from "@/lib/aadhaarParser";
import VariantColourFields, {
  emptyChoice,
  resolveChoice,
  VARIANT_OPTIONS,
  COLOUR_OPTIONS,
  CUSTOM_VALUE,
  NONE_VALUE,
  type Choice,
} from "./VariantColourFields";

const getChoiceText = (c: Choice) =>
  c.select === CUSTOM_VALUE ? c.custom : c.select === NONE_VALUE ? "" : c.select;
import RepairMatchDialog from "./RepairMatchDialog";
import RepairHistoryPanel from "./RepairHistoryPanel";
import PostTransactionShareDialog, { type PostTransactionPhone, type PostTransactionParty } from "./PostTransactionShareDialog";
import { buildInvoiceHtml, buildCombinedPurchaseInvoiceHtml, DEFAULT_PURCHASE_TERMS } from "@/lib/invoiceTemplates";

interface AddPhoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialImei?: string;
}

const AddPhoneDialog = ({ open, onOpenChange, initialImei }: AddPhoneDialogProps) => {
  const queryClient = useQueryClient();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [savedSignatureFound, setSavedSignatureFound] = useState<string | null>(null);
  const [sapathPreviewOpen, setSapathPreviewOpen] = useState(false);
  const [isUploadingSellerPhoto, setIsUploadingSellerPhoto] = useState(false);
  const [isUploadingProducts, setIsUploadingProducts] = useState(false);
  const [isUploadingDocuments, setIsUploadingDocuments] = useState(false);
  const [isUploadingPaymentProof, setIsUploadingPaymentProof] = useState(false);
  // Cross-year IMEI lookup: warns when this phone already exists in any year.
  const [imeiHit, setImeiHit] = useState<{ count: number; years: string[] } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

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

  useEffect(() => {
    if (open && initialImei) {
      setFormData((prev) => ({ ...prev, imei_number: initialImei }));
    }
  }, [open, initialImei]);

  const [formData, setFormData] = useState({
    // Phone details
    phone_name: "",
    model: "",
    imei_number: "",
    imei2_number: "",
    condition: "",
    purchase_price: "",
    selling_price: "",
    purchase_date: "",
    rating: "",
    bill_available: false,
    box_available: false,
    charger_available: false,
    features: "",
    payment_method: "",
    product_photos: [] as string[], // Photos displayed on homepage
    purchase_documents: [] as string[], // Purchase documents/bills
    payment_proof_photos: [] as string[], // Payment screenshots / receipts
    
    // Seller details - can be existing or new
    seller_id: "", // For existing seller
    seller_name: "",
    seller_phone: "",
    seller_address: "",
    id_proof_type: "",
    id_number: "",
    seller_photo_url: "",
    seller_signature_url: "",
    sapath_patra_language: "both" as "hindi" | "english" | "both",
    // Shop assignment
    shop_id: "shop_1" // Default shop, will be overridden if user selects different
  });
  
  const [useExistingSeller, setUseExistingSeller] = useState(false);
  const [sellerPickerOpen, setSellerPickerOpen] = useState(false);
  const [shops, setShops] = useState<Array<{id: string; name: string}>>([]);
  const [selectedShop, setSelectedShop] = useState<string>("shop_1");
  const [variantChoice, setVariantChoice] = useState<Choice>(emptyChoice());
  const [colourChoice, setColourChoice] = useState<Choice>(emptyChoice());

  // Repair cross-check states
  const [repairCustomerMatch, setRepairCustomerMatch] = useState<any | null>(null);
  const [repairMatchOpen, setRepairMatchOpen] = useState(false);
  const [askedPhones, setAskedPhones] = useState<Set<string>>(new Set());
  const [repairImeiJobs, setRepairImeiJobs] = useState<any[]>([]);
  const [repairHistoryModalOpen, setRepairHistoryModalOpen] = useState(false);
  const [boardAcknowledged, setBoardAcknowledged] = useState(false);

  interface ExtraPhoneItem {
    id: string;
    phone_name: string;
    model: string;
    imei_number: string;
    imei2_number: string;
    condition: string;
    purchase_price: string;
    selling_price: string;
    variant: string;
    colour: string;
    bill_available: boolean;
    box_available: boolean;
    charger_available: boolean;
    product_photos: string[];
  }
  const [extraPhones, setExtraPhones] = useState<ExtraPhoneItem[]>([]);
  const [uploadingExtraIndex, setUploadingExtraIndex] = useState<number | null>(null);

  useEffect(() => {
    const handlePrefill = (e: any) => {
      const d = e.detail;
      if (!d) return;
      onOpenChange(true);
      setFormData((prev) => {
        const calcSellingPrice = d.selling_price
          ? String(d.selling_price)
          : d.purchase_price
            ? String(Math.ceil((Number(d.purchase_price) * 1.20) / 500) * 500)
            : prev.selling_price;

        return {
          ...prev,
          phone_name: d.brand || d.phone_name || prev.phone_name,
          model: d.model || prev.model,
          imei_number: d.imei1 || d.imei_number || prev.imei_number,
          imei2_number: d.imei2 || d.imei2_number || prev.imei2_number,
          purchase_price: d.purchase_price ? String(d.purchase_price) : prev.purchase_price,
          selling_price: calcSellingPrice,
          condition: d.condition || prev.condition || "good",
          purchase_date: d.purchase_date || prev.purchase_date || new Date().toISOString().split("T")[0],
          payment_method: d.payment_method || d.payment_mode || prev.payment_method || "cash",
        seller_name: d.seller_name || prev.seller_name,
        seller_phone: d.seller_phone || prev.seller_phone,
        id_number: d.seller_aadhaar || d.id_number || prev.id_number,
        id_proof_type: (d.seller_aadhaar || d.id_number) ? "aadhaar" : (prev.id_proof_type || "aadhaar"),
        seller_address: d.seller_address || prev.seller_address,
        product_photos: Array.isArray(d.product_photos) && d.product_photos.length > 0 ? d.product_photos : prev.product_photos,
        purchase_documents: Array.isArray(d.purchase_documents) && d.purchase_documents.length > 0 ? d.purchase_documents : prev.purchase_documents,
        payment_proof_photos: Array.isArray(d.payment_proof_photos) && d.payment_proof_photos.length > 0 ? d.payment_proof_photos : prev.payment_proof_photos,
        seller_photo_url: d.seller_photo_url || prev.seller_photo_url,
        seller_signature_url: d.seller_signature_url || prev.seller_signature_url,
      };
    });
      toast.success("AI Pre-fill Form Loaded!", { description: `${d.brand || ""} ${d.model || ""}`.trim() });
    };
    window.addEventListener("phonezone:prefill_purchase_form", handlePrefill);
    return () => window.removeEventListener("phonezone:prefill_purchase_form", handlePrefill);
  }, [onOpenChange]);

  const handleExtraPhonePhotosUpload = async (idx: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const currentPhotos = extraPhones[idx]?.product_photos || [];
    if (currentPhotos.length + files.length > 4) {
      toast.error("Maximum 4 photos allowed per device");
      return;
    }

    setUploadingExtraIndex(idx);
    const uploadedUrls: string[] = [];
    try {
      for (const file of Array.from(files)) {
        const publicUrl = await uploadFile(file, "product-photos");
        uploadedUrls.push(publicUrl);
      }
      setExtraPhones((prev) => {
        const next = [...prev];
        if (next[idx]) {
          next[idx] = {
            ...next[idx],
            product_photos: [...(next[idx].product_photos || []), ...uploadedUrls],
          };
        }
        return next;
      });
      toast.success("Device photos uploaded and compressed!");
    } catch (error) {
      console.error("Error uploading extra phone photos:", error);
      toast.error("Failed to upload device photos");
    } finally {
      setUploadingExtraIndex(null);
    }
  };

  const removeExtraPhonePhoto = (phoneIdx: number, photoIdx: number) => {
    setExtraPhones((prev) => {
      const next = [...prev];
      if (next[phoneIdx]) {
        next[phoneIdx] = {
          ...next[phoneIdx],
          product_photos: (next[phoneIdx].product_photos || []).filter((_, i) => i !== photoIdx),
        };
      }
      return next;
    });
  };

  const lookupExtraImei = async (idx: number, imeiVal: string) => {
    const digits = imeiVal.replace(/\D/g, "");
    if (digits.length >= 8) {
      try {
        let res = await fetch(`/api/tac/${digits}`, { credentials: "include" });
        let data = await res.json().catch(() => ({}));
        if (!data || !data.found) {
          const fetchRes = await fetch("/api/tac/fetch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ imei: digits }),
          });
          if (fetchRes.ok) {
            const fetched = await fetchRes.json().catch(() => ({}));
            if (fetched && fetched.found) {
              data = fetched;
            }
          }
        }

        if (data && data.found) {
          const brand = typeof data.brand === "object" ? (data.brand?.name || data.brand?.title || "") : (data.brand || "");
          const model = typeof data.model === "object" ? (data.model?.name || data.model?.title || "") : (data.model || "");
          const phoneName = data.phoneName || `${brand} ${model}`.trim() || model || brand;
          setExtraPhones((prev) => {
            const next = [...prev];
            if (next[idx]) {
              next[idx] = {
                ...next[idx],
                phone_name: next[idx].phone_name || phoneName,
                model: next[idx].model || model,
              };
            }
            return next;
          });
        }
      } catch (err) {
        console.warn("lookupExtraImei error:", err);
      }
    }
  };

  // Cross-check: seller phone entered -> probe repair customers
  useEffect(() => {
    if (!open) return;
    const cleanPhone = formData.seller_phone.replace(/\D/g, "");
    if (cleanPhone.length === 10 && !askedPhones.has(cleanPhone)) {
      setAskedPhones((prev) => new Set([...prev, cleanPhone]));
      fetch(`/api/repair/customers/by-phone/${cleanPhone}`)
        .then((r) => (r.ok ? r.json() : null))
        .then(async (cust) => {
          if (cust) {
            let hist: any[] = [];
            try {
              const hRes = await fetch(`/api/repair/customers/${cust.id}/history`);
              if (hRes.ok) hist = await hRes.json();
            } catch {}
            setRepairCustomerMatch({ ...cust, historyJobs: hist });
            setRepairMatchOpen(true);
          }
        })
        .catch(() => {});
    }
  }, [formData.seller_phone, open, askedPhones]);

  // Cross-check: IMEI entered -> probe previous repair jobs
  useEffect(() => {
    if (!open) { setRepairImeiJobs([]); setBoardAcknowledged(false); return; }
    const cleanImei = formData.imei_number.trim();
    if (cleanImei.length < 14) { setRepairImeiJobs([]); setBoardAcknowledged(false); return; }
    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`/api/repair/by-imei/${cleanImei}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((jobs) => {
          if (!cancelled && Array.isArray(jobs) && jobs.length > 0) {
            setRepairImeiJobs(jobs);
          } else if (!cancelled) {
            setRepairImeiJobs([]);
          }
        })
        .catch(() => { if (!cancelled) setRepairImeiJobs([]); });
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [formData.imei_number, open]);

  // Debounced cross-year IMEI probe: once a full 14+ digit IMEI is typed, ask the
  // backend whether this phone was ever bought/sold in ANY year. Declared after
  // formData so the effect can read it (declaring before it is a TDZ crash).
  useEffect(() => {
    if (!OFFLINE || !open) { setImeiHit(null); return; }
    const digits = formData.imei_number.replace(/\D/g, "");
    if (digits.length < 14) { setImeiHit(null); return; }
    let cancelled = false;
    const timer = setTimeout(() => {
      getImeiHistory(formData.imei_number)
        .then((h) => { if (!cancelled) setImeiHit(h.found ? { count: h.count, years: h.years } : null); })
        .catch(() => { if (!cancelled) setImeiHit(null); });
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [formData.imei_number, open]);

  // Load shops from backend API every time the dialog opens, so a shop created
  // elsewhere shows up in the picker without restarting the app.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const fetchShops = async () => {
      try {
        const { data, error } = await supabase.from('shops').select('*').order('name');
        if (error) throw error;
        if (cancelled) return;
        const list = (data || []) as Array<{ id: string; name: string }>;
        setShops(list);
        // Keep the current choice if it still exists, otherwise use the first shop.
        setSelectedShop((current) =>
          list.some((s) => s.id === current) ? current : list[0]?.id ?? "shop_1",
        );
      } catch (err) {
        console.error('Error fetching shops:', err);
      }
    };
    fetchShops();
    return () => { cancelled = true; };
  }, [open]);

  // Step 3: offline Aadhaar OCR -> seller fields. fillPersonFields fills only
  // empty fields for the same person (front -> name, back -> address) and
  // replaces them when a different person's card is scanned.
  const applyAadhaarToSeller = (d: AadhaarData) =>
    setFormData((prev) => {
      const merged = fillPersonFields(
        { name: prev.seller_name, phone: prev.seller_phone, address: prev.seller_address, id_number: prev.id_number },
        d,
      );
      return {
        ...prev,
        seller_name: merged.name || "",
        seller_phone: merged.phone || "",
        seller_address: merged.address || "",
        id_proof_type: "aadhaar" as const,
        id_number: merged.id_number,
      };
    });

  // Aadhaar photos the shop already scanned are filed under Purchase Documents
  // automatically - no need to upload the same pictures twice. Re-scanning a
  // side replaces its previous photo instead of piling up duplicates.
  const aadhaarDocPaths = useRef<{ front?: string; back?: string }>({});
  const handleAadhaarPhoto = async (file: File, side: "front" | "back") => {
    const old = aadhaarDocPaths.current[side];
    setIsUploadingDocuments(true);
    try {
      const publicUrl = await uploadFile(file, 'purchase-documents');
      aadhaarDocPaths.current[side] = publicUrl;
      setFormData((prev) => {
        const docs = prev.purchase_documents.filter((p) => p !== old);
        return docs.length >= 5
          ? prev
          : { ...prev, purchase_documents: [...docs, publicUrl] };
      });
      toast.success(`Aadhaar ${side} photo added to Purchase Documents`);
    } catch (error) {
      console.error('Error uploading Aadhaar photo:', error);
      toast.error("Could not add the Aadhaar photo to Purchase Documents");
    } finally {
      setIsUploadingDocuments(false);
    }
  };

  // Step 2: TAC auto-fill - only touch fields the user has not typed into yet.
  // Inventory searching works best with brand in the name ("Motorola") and the
  // full marketing name in the model ("Motorola Moto G85 5G"), so users can
  // find a phone by brand as well as by model name.
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

  const handleProductPhotosUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    if (formData.product_photos.length + e.target.files.length > 4) {
      toast.error("Maximum 4 product photos allowed");
      return;
    }

    setIsUploadingProducts(true);
    const uploadedUrls: string[] = [];

    try {
      for (const file of Array.from(e.target.files)) {
        const publicUrl = await uploadFile(file, 'product-photos');
        uploadedUrls.push(publicUrl);
      }

      setFormData(prev => ({
        ...prev,
        product_photos: [...prev.product_photos, ...uploadedUrls]
      }));

      toast.success("Product photos uploaded and compressed successfully!");
    } catch (error) {
      console.error('Error uploading product photos:', error);
      toast.error("Failed to upload product photos");
    } finally {
      setIsUploadingProducts(false);
    }
  };

  const handlePaymentProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    if (formData.payment_proof_photos.length + e.target.files.length > 5) {
      toast.error("Maximum 5 payment proof photos allowed");
      return;
    }

    setIsUploadingPaymentProof(true);
    const uploadedUrls: string[] = [];

    try {
      for (const file of Array.from(e.target.files)) {
        const publicUrl = await uploadFile(file, 'payment-proof');
        uploadedUrls.push(publicUrl);
      }

      setFormData(prev => ({
        ...prev,
        payment_proof_photos: [...prev.payment_proof_photos, ...uploadedUrls]
      }));

      toast.success("Payment proof photos uploaded and compressed successfully!");
    } catch (error) {
      console.error('Error uploading payment proofs:', error);
      toast.error("Failed to upload payment proof photos");
    } finally {
      setIsUploadingPaymentProof(false);
    }
  };

  const removePaymentProof = (index: number) => {
    setFormData(prev => ({
      ...prev,
      payment_proof_photos: prev.payment_proof_photos.filter((_, i) => i !== index)
    }));
  };

  const handleDocumentsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    if (formData.purchase_documents.length + e.target.files.length > 5) {
      toast.error("Maximum 5 purchase documents allowed");
      return;
    }

    setIsUploadingDocuments(true);
    const uploadedUrls: string[] = [];

    try {
      for (const file of Array.from(e.target.files)) {
        const publicUrl = await uploadFile(file, 'purchase-documents');
        uploadedUrls.push(publicUrl);
      }

      setFormData(prev => ({
        ...prev,
        purchase_documents: [...prev.purchase_documents, ...uploadedUrls]
      }));

      toast.success("Purchase documents uploaded and compressed successfully!");
    } catch (error) {
      console.error('Error uploading purchase documents:', error);
      toast.error("Failed to upload purchase documents");
    } finally {
      setIsUploadingDocuments(false);
    }
  };

  const removeProductPhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      product_photos: prev.product_photos.filter((_, i) => i !== index)
    }));
  };

  const removeDocument = (index: number) => {
    setFormData(prev => ({
      ...prev,
      purchase_documents: prev.purchase_documents.filter((_, i) => i !== index)
    }));
  };

  const handleSellerPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingSellerPhoto(true);
    try {
      const publicUrl = await uploadFile(file, 'seller-photos');
      setFormData(prev => ({ ...prev, seller_photo_url: publicUrl }));
      toast.success("Seller profile photo uploaded successfully!");
    } catch (error) {
      console.error('Error uploading seller photo:', error);
      toast.error("Failed to upload seller photo");
    } finally {
      setIsUploadingSellerPhoto(false);
    }
  };

  const validateStep1 = (): boolean => {
    if (!formData.phone_name.trim()) {
      toast.error("Please enter Phone Name (फोन का नाम भरें)");
      return false;
    }
    if (!formData.model.trim()) {
      toast.error("Please enter Model (मॉडल का नाम भरें)");
      return false;
    }
    const cleanImei = formData.imei_number.replace(/\D/g, "");
    if (cleanImei.length < 14) {
      toast.error("Please enter a valid 15-digit IMEI number (15 अंकों का सही IMEI भरें)");
      return false;
    }
    if (!formData.condition) {
      toast.error("Please select Condition (फोन की कंडीशन चुनें)");
      return false;
    }
    if (!formData.purchase_price || parseFloat(formData.purchase_price) <= 0) {
      toast.error("Please enter a valid Purchase Price (खरीद मूल्य भरें)");
      return false;
    }
    if (!formData.selling_price || parseFloat(formData.selling_price) <= 0) {
      toast.error("Please enter a valid Selling Price (बिक्री मूल्य भरें)");
      return false;
    }
    if (!formData.purchase_date) {
      toast.error("Please select Purchase Date (खरीद की तारीख चुनें)");
      return false;
    }
    if (!formData.payment_method) {
      toast.error("Please select Payment Method (भुगतान का तरीका चुनें)");
      return false;
    }
    const variant = resolveChoice(variantChoice, VARIANT_OPTIONS, "Variant");
    if (variant.error) {
      toast.error(variant.error);
      return false;
    }
    const colour = resolveChoice(colourChoice, COLOUR_OPTIONS, "Colour");
    if (colour.error) {
      toast.error(colour.error);
      return false;
    }
    for (let i = 0; i < extraPhones.length; i++) {
      const ep = extraPhones[i];
      if (!ep.phone_name.trim()) {
        toast.error(`Additional Phone #${i + 2}: Please enter Phone Name`);
        return false;
      }
      const cleanEpImei = ep.imei_number.replace(/\D/g, "");
      if (cleanEpImei.length < 14) {
        toast.error(`Additional Phone #${i + 2}: Please enter a valid 15-digit IMEI`);
        return false;
      }
      if (!ep.purchase_price || parseFloat(ep.purchase_price) <= 0) {
        toast.error(`Additional Phone #${i + 2}: Please enter Purchase Price`);
        return false;
      }
      if (!ep.selling_price || parseFloat(ep.selling_price) <= 0) {
        toast.error(`Additional Phone #${i + 2}: Please enter Selling Price`);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate Step 1 first
    if (!validateStep1()) {
      setStep(1);
      return;
    }
    
    // Validate Step 2 fields
    if (!useExistingSeller && !formData.seller_name.trim()) {
      toast.error("Please enter Seller Name (विक्रेता का नाम भरें)");
      setStep(2);
      return;
    }

    if (!useExistingSeller && !formData.seller_phone.trim()) {
      toast.error("Please enter Seller Phone (विक्रेता का मोबाइल नंबर भरें)");
      setStep(2);
      return;
    }

    if (!useExistingSeller && !formData.id_proof_type) {
      toast.error("Please select ID proof type (पहचान पत्र का प्रकार चुनें)");
      setStep(2);
      return;
    }

    if (!useExistingSeller && !formData.id_number.trim()) {
      toast.error("Please enter ID Number (पहचान पत्र नंबर भरें)");
      setStep(2);
      return;
    }

    const variant = resolveChoice(variantChoice, VARIANT_OPTIONS, "Variant");
    const colour = resolveChoice(colourChoice, COLOUR_OPTIONS, "Colour");

    const hasBoardReplaced = repairImeiJobs.some((j) => j.board_replaced === 1);
    if (hasBoardReplaced && !boardAcknowledged) {
      toast.error("Please tick 'I have seen the repair history' before purchasing this phone (Motherboard was replaced previously).");
      setStep(1);
      return;
    }

    setIsSubmitting(true);

    try {
      // The seller is created only when an existing one was not picked.
      const newSeller = (!useExistingSeller || !formData.seller_id)
        ? {
            name: formData.seller_name,
            phone: formData.seller_phone,
            address: formData.seller_address,
            id_proof_type: formData.id_proof_type as "aadhaar" | "pan" | "driving_license" | "voter_id",
            id_number: formData.id_number,
            seller_photo_url: formData.seller_photo_url || null,
          }
        : null;

      if (OFFLINE) {
        // Offline / EXE mode goes through the BACKEND purchase workflow
        // (POST /api/purchases). Raw table inserts bypassed server validation -
        // a Luhn-invalid or duplicate IMEI was accepted and a failed phone insert
        // left an orphan seller behind. The server now owns all of that.
        const res = await fetch("/api/purchases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            phone_name: formData.phone_name,
            model: formData.model,
            imei_number: formData.imei_number,
            imei2_number: formData.imei2_number || undefined,
            condition: formData.condition,
            purchase_price: parseFloat(formData.purchase_price),
            selling_price: parseFloat(formData.selling_price),
            purchase_date: formData.purchase_date,
            rating: formData.rating ? parseFloat(formData.rating) : null,
            bill_available: formData.bill_available,
            box_available: formData.box_available,
            charger_available: formData.charger_available,
            features: formData.features ? formData.features.split(',').map(f => f.trim()) : [],
            payment_method: formData.payment_method,
            product_photos: formData.product_photos, // Photos for homepage display
            purchase_documents: formData.purchase_documents, // Purchase bills/documents
            payment_proof_photos: formData.payment_proof_photos, // Payment screenshots
            seller_photo_url: formData.seller_photo_url || undefined,
            seller_signature_url: formData.seller_signature_url || undefined,
            sapath_patra_language: formData.sapath_patra_language || "both",
            variant: variant.value || null,
            colour: colour.value || null,
            seller_id: useExistingSeller && formData.seller_id ? formData.seller_id : undefined,
            seller: newSeller || undefined,
            shop_id: selectedShop,
            additional_phones: extraPhones.map((ep) => ({
              phone_name: ep.phone_name,
              model: ep.model,
              imei_number: ep.imei_number,
              imei2_number: ep.imei2_number || undefined,
              condition: ep.condition,
              purchase_price: parseFloat(ep.purchase_price) || 0,
              selling_price: parseFloat(ep.selling_price) || 0,
              variant: ep.variant || null,
              colour: ep.colour || null,
              bill_available: ep.bill_available,
              box_available: ep.box_available,
              charger_available: ep.charger_available,
              product_photos: ep.product_photos || [],
            })),
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((body as { error?: string }).error || "Failed to add phone.");

        if (hasBoardReplaced) {
          fetch("/api/audit/note", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              action: "imei_motherboard_acknowledged",
              entity: "phone",
              entityId: (body as any)?.phone?.id,
              details: {
                imei: formData.imei_number,
                jobs: repairImeiJobs.map((j) => j.job_no),
              },
            }),
          }).catch(() => {});
        }
      } else {
        let sellerId = formData.seller_id;

        // Create new seller if not using existing one
        if (newSeller) {
          const { data: seller, error: sellerError } = await supabase
            .from('sellers')
            .insert({
              name: newSeller.name,
              phone: newSeller.phone,
              address: newSeller.address,
              id_proof_type: newSeller.id_proof_type,
              id_number: newSeller.id_number,
            })
            .select()
            .single();

          if (sellerError) throw sellerError;
          sellerId = seller.id;
        }

        // Then create phone with properly separated photo categories
        const { error: phoneError } = await supabase
          .from('phones')
          .insert({
            phone_name: formData.phone_name,
            model: formData.model,
            imei_number: formData.imei_number,
            condition: formData.condition as "excellent" | "good" | "fair" | "poor",
            purchase_price: parseFloat(formData.purchase_price),
            selling_price: parseFloat(formData.selling_price),
            purchase_date: formData.purchase_date,
            rating: formData.rating ? parseFloat(formData.rating) : null,
            bill_available: formData.bill_available,
            box_available: formData.box_available,
            charger_available: formData.charger_available,
            features: formData.features ? formData.features.split(',').map(f => f.trim()) : [],
            payment_method: formData.payment_method as "cash" | "upi" | "bank_transfer" | "card",
            product_photos: formData.product_photos, // Photos for homepage display
            purchase_documents: formData.purchase_documents, // Purchase bills/documents
            payment_proof_photos: formData.payment_proof_photos, // Payment screenshots for the purchase
            variant: variant.value || null,
            colour: colour.value || null,
            seller_id: sellerId,
            shop_id: selectedShop
          });

        if (phoneError) throw phoneError;
      }

      // Step 2: remember this TAC for next time - only when the local DB did
      // NOT know it (a found row is already stored and must not be clobbered).
      const imeiDigits = formData.imei_number.replace(/\D/g, "");
      if (imeiDigits.length >= 8 && formData.phone_name && formData.model && tacInfo && !tacInfo.found) {
        fetch("/api/tac/learn", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            imei: imeiDigits,
            brand: formData.phone_name.split(/\s+/)[0],
            phoneName: formData.phone_name,
            model: formData.model,
          }),
        }).catch(() => {}); // fire-and-forget: never block the save
      }

      // Build purchase invoice HTML (with Sapath Patra) for instant WhatsApp dispatch / viewing
      const purchaseTerms = (adminSettings?.terms_and_conditions_purchase || adminSettings?.terms_and_conditions || '').split('\n').filter(Boolean);
      let invoiceHtml = "";
      try {
        if (adminSettings) {
          invoiceHtml = buildInvoiceHtml({
            kind: 'purchase',
            style: 'heritage',
            settings: adminSettings,
            phone: {
              phone_name: formData.phone_name,
              model: formData.model,
              variant: variant.value,
              colour: colour.value,
              imei_number: formData.imei_number,
              condition: formData.condition,
              purchase_date: formData.purchase_date || new Date().toISOString(),
              payment_method: formData.payment_method,
              bill_available: formData.bill_available,
              box_available: formData.box_available,
              charger_available: formData.charger_available,
              seller_photo_url: formData.seller_photo_url,
              seller_signature_url: formData.seller_signature_url,
              sapath_patra_language: formData.sapath_patra_language,
              sellers: {
                name: formData.seller_name,
                phone: formData.seller_phone,
                address: formData.seller_address,
                id_proof_type: formData.id_proof_type,
                id_number: formData.id_number,
              }
            },
            amount: parseFloat(formData.purchase_price) || 0,
            isBroker: false,
            brokerName: '',
            includeSapathPatra: true,
            photoChoice: formData.purchase_documents.length > 0 ? 'purchase' : 'none',
            productPhotos: formData.product_photos,
            documentPhotos: formData.purchase_documents,
            documentLabel: 'Purchase Documents',
            terms: purchaseTerms,
            fallbackTerms: DEFAULT_PURCHASE_TERMS,
          });

          if (extraPhones.length > 0) {
            const allPhonesForInvoice = [
              {
                phone_name: formData.phone_name,
                model: formData.model,
                imei_number: formData.imei_number,
                imei2_number: formData.imei2_number,
                variant: variant.value,
                colour: colour.value,
                condition: formData.condition,
                purchase_price: parseFloat(formData.purchase_price) || 0,
              },
              ...extraPhones.map((ep) => ({
                phone_name: ep.phone_name,
                model: ep.model,
                imei_number: ep.imei_number,
                imei2_number: ep.imei2_number,
                variant: ep.variant,
                colour: ep.colour,
                condition: ep.condition,
                purchase_price: parseFloat(ep.purchase_price) || 0,
              })),
            ];
            const combinedTotal = allPhonesForInvoice.reduce((sum, p) => sum + p.purchase_price, 0);
            invoiceHtml = buildCombinedPurchaseInvoiceHtml({
              settings: adminSettings,
              seller: {
                name: formData.seller_name,
                phone: formData.seller_phone,
                address: formData.seller_address,
                id_proof_type: formData.id_proof_type,
                id_number: formData.id_number,
                seller_photo_url: formData.seller_photo_url,
                seller_signature_url: formData.seller_signature_url,
              },
              phones: allPhonesForInvoice,
              totalAmount: combinedTotal,
              purchaseDate: formData.purchase_date || new Date().toLocaleDateString("en-IN"),
              paymentMethod: formData.payment_method || "Cash",
              terms: purchaseTerms,
              documentPhotos: formData.purchase_documents || [],
              paymentProofPhotos: formData.payment_proof_photos || [],
              productPhotos: formData.product_photos || [],
            });
          }
        }
      } catch (e) {
        console.warn("Failed to generate purchase invoice HTML for post-share", e);
      }

      setPostShareData({
        phone: {
          phone_name: extraPhones.length > 0 ? `${formData.phone_name} (+${extraPhones.length} phones)` : formData.phone_name,
          model: extraPhones.length > 0 ? "Multi-Phone Purchase Batch" : formData.model,
          imei_number: formData.imei_number,
          amount: (parseFloat(formData.purchase_price) || 0) + extraPhones.reduce((sum, ep) => sum + (parseFloat(ep.purchase_price) || 0), 0),
          condition: formData.condition,
          variant: variant.value,
          colour: colour.value,
        },
        party: {
          name: formData.seller_name,
          phone: formData.seller_phone,
          address: formData.seller_address,
          idProofType: formData.id_proof_type,
          idNumber: formData.id_number,
          role: "seller",
        },
        invoiceHtml,
      });

      toast.success(extraPhones.length > 0 ? `Purchased ${extraPhones.length + 1} phones successfully!` : "Phone added successfully!");
      onOpenChange(false);
      setPostShareOpen(true);
      
      // Reset form
      setExtraPhones([]);
      setFormData({
        phone_name: "",
        model: "",
        imei_number: "",
        imei2_number: "",
        condition: "",
        purchase_price: "",
        selling_price: "",
        purchase_date: "",
        rating: "",
        bill_available: false,
        box_available: false,
        charger_available: false,
        features: "",
        payment_method: "",
        product_photos: [],
        purchase_documents: [],
        payment_proof_photos: [],
        seller_id: "",
        seller_name: "",
        seller_phone: "",
        seller_address: "",
        id_proof_type: "",
        id_number: "",
        seller_photo_url: "",
        seller_signature_url: "",
        sapath_patra_language: "both",
        shop_id: selectedShop,
      });
      setStep(1);
      setUseExistingSeller(false);
      setVariantChoice(emptyChoice());
      setColourChoice(emptyChoice());

      queryClient.invalidateQueries({ queryKey: ['phones'] });
    } catch (error: any) {
      console.error('Error adding phone:', error);
      toast.error(`Failed to add phone: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewPhoneData = {
    phone_name: formData.phone_name || "Phone",
    model: formData.model || "Model",
    variant: getChoiceText(variantChoice),
    colour: getChoiceText(colourChoice),
    imei_number: formData.imei_number,
    imei2_number: formData.imei2_number,
    condition: formData.condition || "good",
    purchase_price: formData.purchase_price || "0",
    purchase_date: formData.purchase_date || new Date().toISOString(),
    seller_photo_url: formData.seller_photo_url || null,
    seller_signature_url: formData.seller_signature_url || null,
    sapath_patra_language: formData.sapath_patra_language || "both",
    sellers: {
      name: formData.seller_name || "Seller Name",
      phone: formData.seller_phone || "",
      address: formData.seller_address || "",
      id_proof_type: formData.id_proof_type || "Aadhaar",
      id_number: formData.id_number || "",
    },
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-4xl max-h-[92dvh] p-3 sm:p-6 overflow-y-auto bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 border-slate-200 dark:border-slate-800">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Add New Phone (नया फोन खरीद)
              </DialogTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {step === 1 ? "Step 1: Phone Specifications & Documents (फोन का विवरण)" : "Step 2: Seller KYC & Legal Sapath Patra (विक्रेता एवं शपथ पत्र)"}
              </p>
            </div>
            {/* Step badges */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  step === 1
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">1</span>
                <span>Phone Details</span>
              </button>

              <ArrowRight className="h-3 w-3 text-slate-400 dark:text-slate-500" />

              <button
                type="button"
                onClick={() => {
                  if (validateStep1()) setStep(2);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  step === 2
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">2</span>
                <span>Seller &amp; Sapath</span>
              </button>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {/* Step 1: Phone Details Only */}
          {step === 1 && (
            <div>
            <h3 className="text-lg font-semibold mb-4">Phone Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone_name">Phone Name *</Label>
                <Input
                  id="phone_name"
                  placeholder="Enter phone name"
                  value={formData.phone_name}
                  onChange={(e) => setFormData({...formData, phone_name: e.target.value})}
                  required
                />
              </div>

              <div>
                <Label htmlFor="model">Model *</Label>
                <Input
                  id="model"
                  placeholder="Enter model"
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
                {repairImeiJobs.length > 0 && (
                  <div className={`p-3 rounded-lg border mb-2 text-xs ${
                    repairImeiJobs.some((j) => j.board_replaced === 1)
                      ? "bg-red-50 border-red-400 text-red-900"
                      : "bg-amber-50 border-amber-300 text-amber-900"
                  }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
                        <span>
                          This phone was repaired at our shop on{" "}
                          {repairImeiJobs[0]?.received_at
                            ? new Date(repairImeiJobs[0].received_at).toLocaleDateString("en-IN")
                            : "a previous date"}{" "}
                          (Job {repairImeiJobs[0]?.job_no})
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-[11px] bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                        onClick={() => setRepairHistoryModalOpen(true)}
                      >
                        <History className="h-3 w-3 mr-1" />
                        View what was repaired
                      </Button>
                    </div>

                    {repairImeiJobs.some((j) => j.board_replaced === 1) && (
                      <div className="mt-2 pt-2 border-t border-red-200">
                        <div className="text-red-700 font-bold flex items-center gap-1">
                          MOTHERBOARD/BOARD WAS REPLACED - check carefully!
                        </div>
                        <div className="flex items-center space-x-2 mt-1.5">
                          <Checkbox
                            id="chk-ack-board"
                            checked={boardAcknowledged}
                            onCheckedChange={(c) => setBoardAcknowledged(!!c)}
                          />
                          <Label htmlFor="chk-ack-board" className="text-xs font-semibold text-red-900 cursor-pointer">
                            I have seen the repair history and verify this device
                          </Label>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="imei_number">IMEI Number *</Label>
                  <ImeiScanButton
                    disabled={isSubmitting}
                    onResult={(r) => {
                      const imeiPrefix = "";
                      setFormData((prev) => ({
                        ...prev,
                        imei_number: imeiPrefix + (r.imei || prev.imei_number),
                        imei2_number: r.imei2 || prev.imei2_number,
                        phone_name: r.brand || prev.phone_name,
                        model: r.model || prev.model,
                        colour: r.colour || prev.colour,
                      }));
                      if (r.via === "barcode") {
                        tacFetch(r.imei).catch(() => {});
                      }
                      if (r.brand || r.model) {
                        toast.success(`AI Vision Extracted: ${r.brand || ""} ${r.model || ""}`.trim());
                      }
                    }}
                  />
                </div>
                <Input
                  id="imei_number"
                  placeholder="Enter IMEI"
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
                      <><Wifi className="h-3 w-3" /> {tacInfo?.phoneName || `${tacInfo?.brand || ""} ${tacInfo?.model || ""}`.trim()} - filled from {tacInfo?.source} TAC data</>
                    )}
                    {tacStatus === "fetching" && (
                      <><Globe className="h-3 w-3 animate-spin" /> Asking the Hicelltek API (uses 1 free lookup)...</>
                    )}
                    {tacStatus === "miss" && (
                      <><WifiOff className="h-3 w-3" /> TAC not in the local database.{" "}
                        {(tacInfo?.fetchMode as string) === "ask" && tacInfo?.hasKeys ? (
                          <button
                            type="button"
                            className="underline text-blue-600 hover:text-blue-800"
                            onClick={() => tacFetch(formData.imei_number)}
                          >
                            Look it up online?
                          </button>
                        ) : (tacInfo?.fetchMode as string) === "off" ? (
                          <span>(online lookup is disabled in Settings)</span>
                        ) : tacInfo?.hasKeys === false ? (
                          <span>(add an API key in Admin &gt; Settings)</span>
                        ) : null}
                      </>
                    )}
                    {tacStatus === "error" && <>{tacError || "TAC lookup failed."}</>}
                  </p>
                )}
                {imeiHit && (
                  <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-amber-800">
                        Details already present - this IMEI has {imeiHit.count} record{imeiHit.count === 1 ? "" : "s"}
                        {imeiHit.years.length ? ` in financial year ${imeiHit.years.join(", ")}` : ""}.
                      </p>
                      <button
                        type="button"
                        className="underline text-blue-700 hover:text-blue-900 mt-1 inline-flex items-center gap-1"
                        onClick={() => setHistoryOpen(true)}
                      >
                        <History className="h-3 w-3" /> View detailed report
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="imei2_number">IMEI 2 (Optional / Dual SIM)</Label>
                <Input
                  id="imei2_number"
                  placeholder="Enter secondary IMEI"
                  value={formData.imei2_number}
                  onChange={(e) => setFormData({...formData, imei2_number: e.target.value})}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="condition">Condition *</Label>
                <Select value={formData.condition} onValueChange={(value) => setFormData({...formData, condition: value})} required>
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
                <Label htmlFor="purchase_price">Purchase Price *</Label>
                <Input
                  id="purchase_price"
                  type="number"
                  placeholder="Enter purchase price"
                  value={formData.purchase_price}
                  onChange={(e) => setFormData({...formData, purchase_price: e.target.value})}
                  required
                />
              </div>

              <div>
                <Label htmlFor="selling_price">Selling Price *</Label>
                <Input
                  id="selling_price"
                  type="number"
                  placeholder="Enter selling price"
                  value={formData.selling_price}
                  onChange={(e) => setFormData({...formData, selling_price: e.target.value})}
                  required
                />
              </div>

              <div>
                <Label htmlFor="purchase_date">Purchase Date *</Label>
                <Input
                  id="purchase_date"
                  type="date"
                  value={formData.purchase_date}
                  onChange={(e) => setFormData({...formData, purchase_date: e.target.value})}
                  required
                />
              </div>

              <div>
                <Label htmlFor="rating">Rating</Label>
                <Input
                  id="rating"
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  placeholder="4.5"
                  value={formData.rating}
                  onChange={(e) => setFormData({...formData, rating: e.target.value})}
                />
              </div>

              <div>
                <Label htmlFor="payment_method">Payment Method *</Label>
                <Select value={formData.payment_method} onValueChange={(value) => setFormData({...formData, payment_method: value})} required>
                  <SelectTrigger className="mt-1">
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

              <div>
                <Label htmlFor="shop_assignment">Shop Assignment *</Label>
                <Select
                  value={selectedShop}
                  onValueChange={(value) => setSelectedShop(value || "shop_1")}
                  required
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select shop" />
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

              <div className="md:col-span-2">
                <Label htmlFor="features">Features (comma separated)</Label>
                <Input
                  id="features"
                  placeholder="Dual Camera, Fast Charging, Wireless Charging"
                  value={formData.features}
                  onChange={(e) => setFormData({...formData, features: e.target.value})}
                />
              </div>
            </div>

            {/* Product Photos Section - Displays on Homepage */}
            <div className="mt-6">
              <Label className="text-base font-medium flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Product Photos (Max 4) - Display on Homepage
              </Label>
              <div className="mt-2">
                <input
                  type="file"
                  id="product_photos"
                  multiple
                  accept="image/*"
                  onChange={handleProductPhotosUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('product_photos')?.click()}
                  disabled={isUploadingProducts || formData.product_photos.length >= 4}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploadingProducts ? "Compressing & Uploading..." : "Upload Product Photos"}
                </Button>
                <p className="text-sm text-gray-500 mt-1">Images will be automatically compressed to under 300KB for faster loading</p>
              </div>

              {formData.product_photos.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  {formData.product_photos.map((photo, index) => (
                    <div key={index} className="relative">
                      <div className="aspect-[9/16] relative overflow-hidden rounded-lg border">
                        <img
                          src={photo}
                          alt={`Product ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full"
                        onClick={() => removeProductPhoto(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Purchase Documents Section */}
            <div className="mt-6">
              <Label className="text-base font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Purchase Documents (Max 5) - Bills & Purchase Records
              </Label>
              <div className="mt-2">
                <input
                  type="file"
                  id="purchase_documents"
                  multiple
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={handleDocumentsUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('purchase_documents')?.click()}
                  disabled={isUploadingDocuments || formData.purchase_documents.length >= 5}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {isUploadingDocuments ? "Compressing & Uploading..." : "Upload Purchase Documents"}
                </Button>
                <p className="text-sm text-gray-500 mt-1">Images will be automatically compressed to under 300KB for faster loading</p>
              </div>

              {formData.purchase_documents.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-4">
                  {formData.purchase_documents.map((doc, index) => (
                    <div key={index} className="relative">
                      <div className="aspect-[9/16] relative overflow-hidden rounded-lg border">
                        <img
                          src={doc}
                          alt={`Document ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full"
                        onClick={() => removeDocument(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payment Proof Photos Section */}
            <div className="mt-6">
              <Label className="text-base font-medium flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Payment Proof Photos (Max 5) - Payment Receipts & Transfers
              </Label>
              <div className="mt-2">
                <input
                  type="file"
                  id="payment_proof_photos"
                  multiple
                  accept="image/*,.pdf"
                  onChange={handlePaymentProofUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('payment_proof_photos')?.click()}
                  disabled={isUploadingPaymentProof || formData.payment_proof_photos.length >= 5}
                >
                  <Receipt className="h-4 w-4 mr-2" />
                  {isUploadingPaymentProof ? "Compressing & Uploading..." : "Upload Payment Proofs"}
                </Button>
                <p className="text-sm text-gray-500 mt-1">Images will be automatically compressed to under 300KB for faster loading</p>
              </div>

              {formData.payment_proof_photos.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-4">
                  {formData.payment_proof_photos.map((doc, index) => (
                    <div key={index} className="relative">
                      <div className="aspect-[9/16] relative overflow-hidden rounded-lg border">
                        <img
                          src={doc}
                          alt={`Payment proof ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full"
                        onClick={() => removePaymentProof(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Accessories */}
            <div className="mt-6">
              <Label className="text-base font-medium">Accessories Included</Label>
              <div className="flex space-x-6 mt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="bill_available"
                    checked={formData.bill_available}
                    onCheckedChange={(checked) => setFormData({...formData, bill_available: !!checked})}
                  />
                  <Label htmlFor="bill_available">Bill Available</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="box_available"
                    checked={formData.box_available}
                    onCheckedChange={(checked) => setFormData({...formData, box_available: !!checked})}
                  />
                  <Label htmlFor="box_available">Box Available</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="charger_available"
                    checked={formData.charger_available}
                    onCheckedChange={(checked) => setFormData({...formData, charger_available: !!checked})}
                  />
                  <Label htmlFor="charger_available">Charger Available</Label>
                </div>
              </div>
            </div>

            {/* Multi-Phone Intake from Same Seller */}
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 bg-emerald-50 dark:bg-emerald-950/30 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60">
                <div>
                  <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                    <Plus className="h-4 w-4" />
                    Additional Phones from this Seller (एक ही विक्रेता से अतिरिक्त फ़ोन)
                  </h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                    If this seller brought 2 or 3 phones, add them here. Same seller photo, Aadhaar KYC, signature &amp; Shapath Patra will cover all phones in a single combined voucher.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setExtraPhones((prev) => [
                      ...prev,
                      {
                        id: 'extra_' + Date.now(),
                        phone_name: '',
                        model: '',
                        imei_number: '',
                        imei2_number: '',
                        condition: 'good',
                        purchase_price: '',
                        selling_price: '',
                        variant: '',
                        colour: '',
                        bill_available: false,
                        box_available: false,
                        charger_available: false,
                        product_photos: [],
                      },
                    ]);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold border-0 shrink-0 shadow-sm text-xs"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  + Add Another Phone
                </Button>
              </div>

              {extraPhones.length > 0 && (
                <div className="space-y-4">
                  {extraPhones.map((ep, idx) => (
                    <div
                      key={ep.id}
                      className="p-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 space-y-3 relative"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Additional Device #{idx + 2}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setExtraPhones((prev) => prev.filter((_, i) => i !== idx))}
                          className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Remove
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                          <Label className="text-xs font-semibold">IMEI Number *</Label>
                          <Input
                            placeholder="15-digit IMEI"
                            value={ep.imei_number}
                            onChange={(e) => {
                              const val = e.target.value;
                              setExtraPhones((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], imei_number: val };
                                return next;
                              });
                              lookupExtraImei(idx, val);
                            }}
                            className="font-mono text-xs mt-1"
                          />
                        </div>

                        <div>
                          <Label className="text-xs font-semibold">Phone Name *</Label>
                          <Input
                            placeholder="e.g. Vivo V29"
                            value={ep.phone_name}
                            onChange={(e) => {
                              const val = e.target.value;
                              setExtraPhones((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], phone_name: val };
                                return next;
                              });
                            }}
                            className="text-xs mt-1"
                          />
                        </div>

                        <div>
                          <Label className="text-xs font-semibold">Model *</Label>
                          <Input
                            placeholder="e.g. V2250"
                            value={ep.model}
                            onChange={(e) => {
                              const val = e.target.value;
                              setExtraPhones((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], model: val };
                                return next;
                              });
                            }}
                            className="text-xs mt-1"
                          />
                        </div>

                        <div>
                          <Label className="text-xs font-semibold">Condition *</Label>
                          <Select
                            value={ep.condition}
                            onValueChange={(val) => {
                              setExtraPhones((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], condition: val };
                                return next;
                              });
                            }}
                          >
                            <SelectTrigger className="text-xs mt-1 h-9">
                              <SelectValue />
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
                          <Label className="text-xs font-semibold">Purchase Price (₹) *</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={ep.purchase_price}
                            onChange={(e) => {
                              const val = e.target.value;
                              setExtraPhones((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], purchase_price: val };
                                return next;
                              });
                            }}
                            className="text-xs mt-1 font-semibold"
                          />
                        </div>

                        <div>
                          <Label className="text-xs font-semibold">Selling Price (₹) *</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={ep.selling_price}
                            onChange={(e) => {
                              const val = e.target.value;
                              setExtraPhones((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], selling_price: val };
                                return next;
                              });
                            }}
                            className="text-xs mt-1 font-semibold"
                          />
                        </div>

                        <div>
                          <Label className="text-xs font-semibold">Variant (RAM/Storage)</Label>
                          <Input
                            placeholder="e.g. 8/128"
                            value={ep.variant}
                            onChange={(e) => {
                              const val = e.target.value;
                              setExtraPhones((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], variant: val };
                                return next;
                              });
                            }}
                            className="text-xs mt-1"
                          />
                        </div>

                        <div>
                          <Label className="text-xs font-semibold">Colour</Label>
                          <Input
                            placeholder="e.g. Black"
                            value={ep.colour}
                            onChange={(e) => {
                              const val = e.target.value;
                              setExtraPhones((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], colour: val };
                                return next;
                              });
                            }}
                            className="text-xs mt-1"
                          />
                        </div>
                      </div>

                      <div className="flex gap-4 pt-1 text-xs">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <Checkbox
                            checked={ep.bill_available}
                            onCheckedChange={(c) => {
                              setExtraPhones((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], bill_available: !!c };
                                return next;
                              });
                            }}
                          />
                          Bill
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <Checkbox
                            checked={ep.box_available}
                            onCheckedChange={(c) => {
                              setExtraPhones((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], box_available: !!c };
                                return next;
                              });
                            }}
                          />
                          Box
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <Checkbox
                            checked={ep.charger_available}
                            onCheckedChange={(c) => {
                              setExtraPhones((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], charger_available: !!c };
                                return next;
                              });
                            }}
                          />
                          Charger
                        </label>
                      </div>

                      {/* Device Photos Section (Max 4 Photos) */}
                      <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Camera className="h-3.5 w-3.5 text-blue-500" />
                            Device Photos (Max 4 फ़ोटो - Storefront &amp; Stock)
                          </Label>
                          <div>
                            <input
                              type="file"
                              id={`extra_photos_${ep.id}`}
                              multiple
                              accept="image/*"
                              onChange={(e) => {
                                handleExtraPhonePhotosUpload(idx, e.target.files);
                                e.target.value = "";
                              }}
                              className="hidden"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => document.getElementById(`extra_photos_${ep.id}`)?.click()}
                              disabled={uploadingExtraIndex === idx || (ep.product_photos?.length || 0) >= 4}
                              className="h-7 px-2.5 text-xs font-semibold gap-1.5 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                            >
                              <Upload className="h-3.5 w-3.5" />
                              {uploadingExtraIndex === idx ? "Uploading..." : "+ Upload Device Photos"}
                            </Button>
                          </div>
                        </div>

                        {ep.product_photos && ep.product_photos.length > 0 ? (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                            {ep.product_photos.map((photo, pIdx) => (
                              <div key={pIdx} className="relative aspect-[4/3] rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-800 shadow-xs">
                                <img
                                  src={photo}
                                  alt={`Device #${idx + 2} Photo ${pIdx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeExtraPhonePhoto(idx, pIdx)}
                                  className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 shadow-md hover:bg-red-700 transition-colors"
                                  title="Remove photo"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                            No photos uploaded for this device yet. Photos will be automatically compressed to under 300KB.
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Step 1 Actions */}
            <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-3 pt-6 border-t mt-6">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (validateStep1()) setStep(2);
                }}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6"
              >
                Next: Seller KYC &amp; Sapath Patra
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Seller KYC & Legal Sapath Patra */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Phone Summary Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs">
              <div>
                <span className="font-semibold text-blue-950 text-sm">
                  {formData.phone_name} {formData.model}
                  {extraPhones.length > 0 && ` (+${extraPhones.length} more device${extraPhones.length > 1 ? "s" : ""})`}
                </span>
                <div className="text-blue-800 mt-0.5">
                  IMEI: <span className="font-mono font-medium">{formData.imei_number}</span>
                  {getChoiceText(variantChoice) ? ` • ${getChoiceText(variantChoice)}` : ""}
                  {getChoiceText(colourChoice) ? ` • ${getChoiceText(colourChoice)}` : ""}
                  {extraPhones.length > 0 && ` • Total ${extraPhones.length + 1} devices in this intake`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-white dark:bg-slate-900 px-2.5 py-1 rounded border border-blue-200 dark:border-blue-800 font-bold text-blue-900 dark:text-blue-300 text-sm" title="Total Purchase Payout">
                  ₹{(Number(formData.purchase_price || 0) + extraPhones.reduce((s, p) => s + (Number(p.purchase_price) || 0), 0)).toLocaleString()}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep(1)}
                  className="h-7 text-xs text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/50"
                >
                  Edit Phones
                </Button>
              </div>
            </div>

            {/* Seller Information */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 sm:p-4 bg-white dark:bg-slate-900 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  Seller Information (विक्रेता विवरण)
                </h3>
                <AadhaarScanButton
                  onResult={applyAadhaarToSeller}
                  onPhoto={handleAadhaarPhoto}
                  disabled={useExistingSeller}
                />
              </div>

              {/* Existing Seller Toggle */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="use-existing-seller"
                    checked={useExistingSeller}
                    onCheckedChange={(checked) => {
                      setUseExistingSeller(checked as boolean);
                      if (!checked) {
                        setFormData({ ...formData, seller_id: "" });
                      }
                    }}
                  />
                  <Label htmlFor="use-existing-seller" className="cursor-pointer text-sm font-medium text-slate-800 dark:text-slate-200">
                    Select from existing registered sellers (पुराने विक्रेता से चुनें)
                  </Label>
                </div>

                {useExistingSeller && (
                  <div className="mt-3">
                    <button
                      type="button"
                      id="existing_seller"
                      className="w-full flex items-center justify-between gap-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-md px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 mt-1"
                      onClick={() => setSellerPickerOpen(true)}
                    >
                      <span className={formData.seller_id ? "font-medium text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"}>
                        {formData.seller_id
                          ? `${formData.seller_name}${formData.seller_phone ? ` - ${formData.seller_phone}` : ""}`
                          : "Search & select an existing seller..."}
                      </span>
                      <Search className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
                    </button>
                    <PartyPicker
                      role="seller"
                      open={sellerPickerOpen}
                      onOpenChange={setSellerPickerOpen}
                      onSelect={(seller) => {
                        const sig = seller.seller_signature_url || seller.signature_url;
                        if (sig) {
                          setSavedSignatureFound(sig);
                        } else {
                          setSavedSignatureFound(null);
                        }
                        setFormData((prev) => ({
                          ...prev,
                          seller_id: seller.id,
                          seller_name: seller.name,
                          seller_phone: seller.phone || "",
                          seller_address: seller.address || "",
                          seller_photo_url: seller.seller_photo_url || seller.photo_url || prev.seller_photo_url,
                        }));
                      }}
                      onClear={() =>
                        setFormData((prev) => ({
                          ...prev,
                          seller_id: "",
                          seller_name: "",
                          seller_phone: "",
                          seller_address: "",
                        }))
                      }
                    />
                  </div>
                )}
              </div>

              {/* Seller Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="seller_name">Seller Full Name *</Label>
                  <Input
                    id="seller_name"
                    placeholder="e.g. Rahul Kumar"
                    value={formData.seller_name}
                    onChange={(e) => setFormData({ ...formData, seller_name: e.target.value })}
                    required
                    disabled={useExistingSeller}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="seller_phone">Seller Mobile Phone *</Label>
                  <Input
                    id="seller_phone"
                    placeholder="e.g. 9876543210"
                    value={formData.seller_phone}
                    onChange={(e) => setFormData({ ...formData, seller_phone: e.target.value })}
                    required
                    disabled={useExistingSeller}
                    className="mt-1"
                  />
                </div>

                {/* Universal Cross-Entity Interconnection Banner */}
                <div className="sm:col-span-2">
                  <InterconnectedPartyLookup
                    phone={formData.seller_phone}
                    currentRole="seller"
                    onApply={(party) => {
                      setFormData((prev) => ({
                        ...prev,
                        seller_name: party.name,
                        seller_phone: party.phone,
                        seller_address: party.address || prev.seller_address,
                        id_proof_type: (party.id_proof_type as any) || prev.id_proof_type,
                        id_number: party.id_number || prev.id_number,
                        seller_photo_url: party.photo_url || prev.seller_photo_url,
                        seller_id: party.role === "seller" ? party.id : prev.seller_id,
                      }));
                      if (party.signature_url) {
                        setSavedSignatureFound(party.signature_url);
                      }
                    }}
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="seller_address">Seller Full Address *</Label>
                  <Textarea
                    id="seller_address"
                    placeholder="Enter full permanent address with pincode"
                    value={formData.seller_address}
                    onChange={(e) => setFormData({ ...formData, seller_address: e.target.value })}
                    required
                    disabled={useExistingSeller}
                    rows={2}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="id_proof_type">ID Proof Type *</Label>
                  <Select
                    value={formData.id_proof_type}
                    onValueChange={(value) => setFormData({ ...formData, id_proof_type: value })}
                    required
                    disabled={useExistingSeller}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select ID proof" />
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
                    placeholder="Enter 12-digit Aadhaar / ID number"
                    value={formData.id_number}
                    onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
                    required
                    disabled={useExistingSeller}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Seller Photo & Digital Signature Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Seller Profile Photo */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 sm:p-4 bg-white dark:bg-slate-900 shadow-sm space-y-3">
                <Label className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Camera className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  Seller Profile Photo (विक्रेता की फोटो)
                </Label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Live customer photo. Appears <strong>only</strong> on legal Sapath Patra, not on invoice.
                </p>

                {formData.seller_photo_url ? (
                  <div className="flex items-center gap-4 p-2 bg-blue-50/50 dark:bg-blue-950/30 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="w-20 h-24 border border-slate-200 dark:border-slate-700 rounded overflow-hidden bg-white dark:bg-slate-800 shrink-0">
                      <img
                        src={formData.seller_photo_url}
                        alt="Seller Photo"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="space-y-2">
                      <Badge variant="outline" className="bg-white text-emerald-700 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-700/50">
                        <CheckCircle className="h-3 w-3 mr-1" /> Photo Attached
                      </Badge>
                      <div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => setFormData({ ...formData, seller_photo_url: "" })}
                          className="h-7 text-xs"
                        >
                          <X className="h-3 w-3 mr-1" /> Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      id="seller_photo_upload"
                      accept="image/*"
                      capture="user"
                      onChange={handleSellerPhotoUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById("seller_photo_upload")?.click()}
                      disabled={isUploadingSellerPhoto}
                      className="w-full h-16 border-dashed border-2 flex flex-col items-center justify-center gap-1 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:border-blue-400 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                    >
                      <Camera className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <span className="text-xs font-medium">
                        {isUploadingSellerPhoto ? "Uploading Photo..." : "Take / Upload Seller Photo"}
                      </span>
                    </Button>
                  </div>
                )}
              </div>

              {/* Digital Signature */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 sm:p-4 bg-white dark:bg-slate-900 shadow-sm space-y-3">
                <Label className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <PenTool className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  Seller Digital Signature (डिजिटल हस्ताक्षर)
                </Label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Touch/mouse signature. Appears on <strong>both</strong> Purchase Invoice &amp; Sapath Patra.
                </p>

                {/* Saved Signature Prompt if existing seller has signature on record */}
                {savedSignatureFound && !formData.seller_signature_url && (
                  <div className="p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-24 bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-700 rounded p-1 flex items-center justify-center shrink-0 shadow-xs">
                        <img
                          src={savedSignatureFound}
                          alt="Saved Signature"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-purple-900 dark:text-purple-300">Saved Seller Signature Found</p>
                        <p className="text-[11px] text-purple-700 dark:text-purple-400">A signature is already saved on file for this seller. Do you want to use it?</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 px-3 text-xs bg-purple-700 hover:bg-purple-800 text-white font-bold"
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, seller_signature_url: savedSignatureFound }));
                          toast.success("Saved signature applied to this purchase!");
                        }}
                      >
                        Use Saved Signature
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 px-2.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-300 dark:border-slate-700"
                        onClick={() => {
                          setSignatureModalOpen(true);
                        }}
                      >
                        Sign New
                      </Button>
                    </div>
                  </div>
                )}

                {formData.seller_signature_url ? (
                  <div className="p-3 bg-purple-50/40 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800/50 flex items-center justify-between gap-3">
                    <div className="h-16 w-36 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-1 flex items-center justify-center">
                      <img
                        src={formData.seller_signature_url}
                        alt="Seller Signature"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSignatureModalOpen(true)}
                        className="h-7 text-xs border-purple-300 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                      >
                        Change
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setFormData({ ...formData, seller_signature_url: "" })}
                        className="h-7 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSignatureModalOpen(true)}
                    className="w-full h-16 border-dashed border-2 flex flex-col items-center justify-center gap-1 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:border-purple-400 dark:border-purple-800/60 text-purple-900 dark:text-purple-300"
                  >
                    <PenTool className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    <span className="text-xs font-semibold">Click to Take Digital Signature (हस्ताक्षर लें)</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Legal Sapath Patra Controls */}
            <div className="border border-blue-200 dark:border-blue-900/50 rounded-lg p-3 sm:p-4 bg-gradient-to-r from-blue-50/70 to-indigo-50/70 dark:from-blue-950/40 dark:to-indigo-950/40 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                    Legal Sapath Patra — 8 Statutory Clauses (कानूनी शपथ पत्र)
                  </h4>
                  <p className="text-xs text-blue-800 dark:text-blue-300 mt-0.5">
                    Protects shop against IPC 411/412 &amp; BNS. Confirms device ownership, no theft/crime, and no pending finance.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-semibold text-blue-900 dark:text-blue-300 shrink-0">Language:</Label>
                  <Select
                    value={formData.sapath_patra_language}
                    onValueChange={(val: any) => setFormData({ ...formData, sapath_patra_language: val })}
                  >
                    <SelectTrigger className="h-8 w-36 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs border-slate-300 dark:border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="both">Both (द्विभाषी)</SelectItem>
                      <SelectItem value="hindi">Hindi (हिंदी)</SelectItem>
                      <SelectItem value="english">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Step 2 Actions */}
            <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setStep(1)} className="w-full sm:w-auto">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Phone Details
              </Button>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSapathPreviewOpen(true)}
                  className="border-blue-300 text-blue-700 hover:bg-blue-50"
                >
                  <Eye className="h-4 w-4 mr-1.5" />
                  Preview Sapath
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold px-6"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adding Phone...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      Add Phone &amp; Issue Sapath
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </form>
    </DialogContent>

    {/* Digital Signature Pad Modal */}
    <SignaturePadModal
      open={signatureModalOpen}
      onOpenChange={setSignatureModalOpen}
      onSave={(dataUrl) => setFormData((prev) => ({ ...prev, seller_signature_url: dataUrl }))}
      title="Take Seller Signature (विक्रेता के हस्ताक्षर)"
    />

    {/* Live Sapath Patra Preview Modal */}
    <SapathPatraModal
      open={sapathPreviewOpen}
      onOpenChange={setSapathPreviewOpen}
      phone={previewPhoneData}
    />
      <ImeiHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} imei={formData.imei_number} />

      {repairCustomerMatch && (
        <RepairMatchDialog
          open={repairMatchOpen}
          onOpenChange={setRepairMatchOpen}
          customer={repairCustomerMatch}
          historyJobs={repairCustomerMatch.historyJobs || []}
          onAccept={(selected) => {
            setFormData((prev) => ({
              ...prev,
              ...(selected.name ? { seller_name: selected.name } : {}),
              ...(selected.address ? { seller_address: selected.address } : {}),
              ...(selected.id_proof_type ? { id_proof_type: selected.id_proof_type } : {}),
              ...(selected.id_number ? { id_number: selected.id_number } : {}),
            }));
            toast.success("Loaded customer details into seller form.");
          }}
          onSkip={() => {}}
        />
      )}

      {/* IMEI Repair History Full Panel Modal */}
      <Dialog open={repairHistoryModalOpen} onOpenChange={setRepairHistoryModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Repair History for IMEI: {formData.imei_number}</DialogTitle>
          </DialogHeader>
          <RepairHistoryPanel jobs={repairImeiJobs} />
          <div className="flex justify-end pt-2">
            <Button onClick={() => setRepairHistoryModalOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>

    {/* Post-Purchase WhatsApp Share Prompt Modal */}
    <PostTransactionShareDialog
      open={postShareOpen}
      onOpenChange={setPostShareOpen}
      type="purchase"
      phone={postShareData?.phone || null}
      party={postShareData?.party || null}
      invoiceHtml={postShareData?.invoiceHtml || ""}
      adminSettings={adminSettings}
    />
    </>
  );
};

export default AddPhoneDialog;
