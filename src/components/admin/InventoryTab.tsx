import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Copy, Download, Edit, Eye, Filter, Plus, QrCode, Receipt, Search, Share, ShoppingCart, Trash2, X, ShieldCheck } from "lucide-react";
import EditPhoneDialog from "./EditPhoneDialog";
import AddPhoneDialog from "./AddPhoneDialog";
import ShopManagementDialog from "./ShopManagementDialog";
import PhotoViewer from "./PhotoViewer";
import ProcessSaleDialog from "./ProcessSaleDialog";
import InvoiceCustomizeDialog, { type InvoiceCustomization } from "./InvoiceCustomizeDialog";
import { buildInvoiceHtml, buildCombinedPurchaseInvoiceHtml, DEFAULT_PURCHASE_TERMS } from "@/lib/invoiceTemplates";
import { downloadSaleWallpaper } from "@/lib/deviceQr";
import { toast } from "sonner";
import { numberToWords } from "@/utils/numberToWords";
import { printHtml } from "@/lib/printHtml";
import { dispatchWhatsApp } from "@/utils/whatsappDispatcher";
import { formatPurchaseInvoiceText, formatSalesInvoiceText } from "@/lib/whatsappInvoiceFormatter";
import SapathPatraModal from "./SapathPatraModal";
import DealerBatchInvoiceDialog from "./DealerBatchInvoiceDialog";
import { Checkbox } from "@/components/ui/checkbox";

/** Sentinel for the Radix select - an empty string is not a legal item value. */
const ALL_SHOPS = "all";

interface InventoryTabProps {
  onNavigateTab?: (tab: string) => void;
}

const InventoryTab = ({ onNavigateTab }: InventoryTabProps = {}) => {
  const [selectedPhone, setSelectedPhone] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [processSaleDialogOpen, setProcessSaleDialogOpen] = useState(false);
  const [sapathPhone, setSapathPhone] = useState<any | null>(null);
  const [batchInvoiceId, setBatchInvoiceId] = useState<string | null>(null);
  const [showBatchInvoiceDialog, setShowBatchInvoiceDialog] = useState(false);
  const [selectedPhoneIds, setSelectedPhoneIds] = useState<Set<string>>(new Set());
  const [selectedBatchPhones, setSelectedBatchPhones] = useState<any[]>([]);

  useEffect(() => {
    const handleOpenDialog = () => {
      setAddDialogOpen(true);
    };
    window.addEventListener("phonezone:open_add_phone_dialog", handleOpenDialog);
    return () => window.removeEventListener("phonezone:open_add_phone_dialog", handleOpenDialog);
  }, []);

  const toggleSelectPhone = (id: string) => {
    setSelectedPhoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const [currentPhotos, setCurrentPhotos] = useState<string[]>([]);
  const [currentPhotoTitle, setCurrentPhotoTitle] = useState("");
  const [invoiceDialogPhone, setInvoiceDialogPhone] = useState<any>(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [shopDialogOpen, setShopDialogOpen] = useState(false);
  const [shopDialogMode, setShopDialogMode] = useState<"add" | "copy">("add");
  const [shopDialogExistingShopId, setShopDialogExistingShopId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [conditionFilter, setConditionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("available");
  const [selectedShop, setSelectedShop] = useState<string | null>(null);
  const [shops, setShops] = useState<Array<{id: string; name: string}>>([]);
  const queryClient = useQueryClient();

  const { data: phones, isLoading } = useQuery({
    queryKey: ['phones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phones')
        .select(`
          *,
          sellers (
            id,
            name,
            phone,
            address,
            id_proof_type,
            id_number
          ),
          customers (
            id,
            name,
            phone,
            address,
            id_proof_type,
            id_number
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const { data: adminSettings } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('*')
        .single();

      if (error) throw error;
      return data;
    }
  });

  // The shops list feeds the filter above the grid. Loaded once, then reloaded
  // whenever a shop is created from the dialog. (A previous version refetched on
  // every `shops` change and set a fresh array each time, which re-rendered in a
  // loop and blanked the list.)
  const loadShops = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('shops').select('*').order('name');
      if (error) throw error;
      setShops(data || []);
    } catch (err) {
      console.error('Error fetching shops:', err);
    }
  }, []);

  useEffect(() => { loadShops(); }, [loadShops]);


  const filteredPhones = useMemo(() => {
    if (!phones) return [];
    
    return phones.filter(phone => {
      const matchesSearch = 
        phone.phone_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        phone.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        phone.imei_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ((phone as any).purchase_invoice_no || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        ((phone as any).invoice_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        ((phone as any).batch_purchase_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (phone.sellers?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        ((phone.sellers as any)?.phone || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (phone.variant || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (phone.colour || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCondition = conditionFilter === "all" || phone.condition === conditionFilter;
      const matchesStatus = statusFilter === "all" || 
        ((statusFilter === "sold" || statusFilter === "sold_purchase") && phone.is_sold) ||
        (statusFilter === "available" && !phone.is_sold);
      
      // Mirrors the backend's COALESCE(shop_id, ?) rule: a phone that has no
      // shop recorded is shown under whichever shop is being viewed.
      const matchesShop = selectedShop ? (phone.shop_id || selectedShop) === selectedShop : true;
      
      return matchesSearch && matchesCondition && matchesStatus && matchesShop;
    });
  }, [phones, searchTerm, conditionFilter, statusFilter, selectedShop]);

  const handleEdit = (phone: any) => {
    setSelectedPhone(phone);
    setEditDialogOpen(true);
  };

  const handleDelete = async (phoneId: string, isSold: boolean) => {
    if (isSold) {
      toast.error("Cannot delete sold phones");
      return;
    }

    if (!confirm("Are you sure you want to delete this phone?")) return;
    
    try {
      const { error } = await supabase
        .from('phones')
        .delete()
        .eq('id', phoneId);

      if (error) throw error;

      toast.success("Phone deleted successfully!");
      queryClient.invalidateQueries({ queryKey: ['phones'] });
    } catch (error) {
      console.error('Error deleting phone:', error);
      toast.error("Failed to delete phone");
    }
  };

  const handleProcessSale = (phone: any) => {
    setSelectedPhone(phone);
    setProcessSaleDialogOpen(true);
  };

  const viewPhotos = (phone: any, type: 'product' | 'purchase' | 'payment' | 'sales') => {
    let photos: string[] = [];
    let title = "";

    switch (type) {
      case 'product':
        photos = phone.product_photos || [];
        title = "Product Photos";
        break;
      case 'purchase':
        photos = phone.purchase_documents || [];
        title = "Purchase Documents";
        break;
      case 'payment':
        photos = phone.payment_proof_photos || [];
        title = "Payment Proof Photos";
        break;
      case 'sales':
        photos = phone.payment_proof_photos || [];
        title = "Sales Documents";
        break;
    }

    if (photos.length === 0) {
      toast.info(`No ${title.toLowerCase()} available`);
      return;
    }

    setCurrentPhotos(photos);
    setCurrentPhotoTitle(title);
    setPhotoViewerOpen(true);
  };

  const generateInvoiceHTML = (phone: any, custom?: InvoiceCustomization): string => {
    if (!adminSettings) {
      toast.error("Admin settings not found");
      return "";
    }

    const photos: InvoiceCustomization = custom ?? { photos: 'both', style: 'heritage', broker: false, brokerAmount: 0, brokerName: '' };

    // Sale documents share the product_photos array, so they are filtered out
    // unless documents were explicitly requested for this invoice.
    const productPhotos = photos.photos === 'none' || photos.photos === 'purchase'
      ? []
      : (phone.product_photos?.filter((photo: string) => {
          return photo.includes('product-photos') || !photo.includes('sale-documents');
        }) || []);
    let documentPhotos = photos.photos === 'none' || photos.photos === 'product'
      ? []
      : (phone.purchase_documents || []);
    let paymentProofPhotos = (photos.photos === 'none' || photos.photos === 'product' || photos.includePaymentProof === false)
      ? []
      : (phone.payment_proof_photos || []);

    // Extra phones inherit seller KYC documents & payment proof from batch siblings if empty
    if (phone.batch_purchase_id && phones && (!documentPhotos.length || !paymentProofPhotos.length)) {
      const sibling = phones.find((p: any) => p.batch_purchase_id === phone.batch_purchase_id && ((p.purchase_documents && p.purchase_documents.length > 0) || (p.payment_proof_photos && p.payment_proof_photos.length > 0)));
      if (sibling) {
        if (!documentPhotos.length && sibling.purchase_documents && sibling.purchase_documents.length > 0 && photos.photos !== 'none' && photos.photos !== 'product') {
          documentPhotos = sibling.purchase_documents;
        }
        if (!paymentProofPhotos.length && sibling.payment_proof_photos && sibling.payment_proof_photos.length > 0 && photos.photos !== 'none' && photos.photos !== 'product') {
          paymentProofPhotos = sibling.payment_proof_photos;
        }
      }
    }

    // In Inventory Tab, invoice is always the Purchase Invoice (from seller).
    // For sales invoices to customers, users go to the Sold tab.
    const invoiceAmount = photos.broker && photos.brokerAmount > 0
      ? photos.brokerAmount
      : Number(phone.purchase_price || 0);

    return buildInvoiceHtml({
      kind: 'purchase',
      style: photos.style,
      settings: adminSettings,
      phone,
      amount: invoiceAmount,
      isBroker: photos.broker,
      brokerName: photos.brokerName,
      includeSapathPatra: !!photos.includeSapathPatra,
      photoChoice: photos.photos,
      productPhotos,
      documentPhotos,
      paymentProofPhotos,
      documentLabel: 'Purchase Documents',
      terms: (adminSettings.terms_and_conditions_purchase || adminSettings.terms_and_conditions || '').split('\n').filter(Boolean),
      fallbackTerms: DEFAULT_PURCHASE_TERMS,
    });
  };

  const generateInvoice = (phone: any, type: 'html' | 'pdf' | 'preview' | 'whatsapp' = 'html', custom?: InvoiceCustomization) => {
    const invoiceHtml = generateInvoiceHTML(phone, custom);
    if (!invoiceHtml) return;

    switch (type) {
      case 'preview': {
        const win = window.open('', '_blank');
        if (win) {
          win.document.write(invoiceHtml);
          win.document.close();
        } else {
          printHtml(invoiceHtml);
        }
        break;
      }
      case 'html':
      case 'pdf':
        printHtml(invoiceHtml);
        if (custom?.broker) {
          toast.success("Broker invoice generated - accounts untouched");
        }
        break;
      case 'whatsapp': {
        if (custom?.broker) {
          toast.info("Broker invoices are view-only - use PDF or Print to share them");
          break;
        }
        const isSalesInvoice = phone.is_sold && phone.customers;
        
        if (isSalesInvoice) {
          const message = formatSalesInvoiceText(phone, adminSettings, {
            broker: custom?.broker,
            brokerAmount: custom?.brokerAmount,
            brokerName: custom?.brokerName,
          });

          dispatchWhatsApp({
            phone: phone.customers?.phone || '',
            message,
            invoiceHtml,
            pdfFileName: `Sales_Invoice_${phone.imei_number}.pdf`,
            adminSettings,
          });
        } else {
          const message = formatPurchaseInvoiceText(phone, adminSettings, {
            includeSapathPatra: custom?.includeSapathPatra,
            sapathLanguage: custom?.sapathLanguage || 'both',
          });

          dispatchWhatsApp({
            phone: phone.sellers?.phone || '',
            message,
            invoiceHtml,
            pdfFileName: `Purchase_Invoice_${phone.imei_number}.pdf`,
            adminSettings,
          });
        }
        break;
      }
    }
  };

  const openCombinedPurchaseInvoice = (batchId: string) => {
    if (!phones || !adminSettings) return;
    const batchPhones = phones.filter((p: any) => p.batch_purchase_id === batchId);
    if (!batchPhones.length) {
      toast.error("Batch phones not found");
      return;
    }
    const prime = batchPhones[0];
    const seller = prime.sellers || {
      name: "Walk-in Seller",
      phone: "-",
      address: "-",
    };

    const allDocPhotos = Array.from(new Set(batchPhones.flatMap((p: any) => p.purchase_documents || [])));
    const allPayPhotos = Array.from(new Set(batchPhones.flatMap((p: any) => p.payment_proof_photos || [])));
    const totalAmount = batchPhones.reduce((sum: number, p: any) => sum + Number(p.purchase_price || 0), 0);
    const purchaseTerms = (adminSettings?.terms_and_conditions_purchase || adminSettings?.terms_and_conditions || "").split("\n").filter(Boolean);

    const invoiceHtml = buildCombinedPurchaseInvoiceHtml({
      settings: adminSettings,
      seller,
      phones: batchPhones.map((p: any) => ({
        phone_name: p.phone_name,
        model: p.model,
        imei_number: p.imei_number,
        variant: p.variant,
        colour: p.colour,
        condition: p.condition,
        purchase_price: Number(p.purchase_price || 0),
        product_photos: p.product_photos || [],
      })),
      totalAmount,
      invoiceNumber: `PUR-${batchId.slice(-8).toUpperCase()}`,
      purchaseDate: prime.purchase_date ? new Date(prime.purchase_date).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN"),
      paymentMethod: prime.payment_method || "Cash",
      terms: purchaseTerms,
      documentPhotos: allDocPhotos,
      paymentProofPhotos: allPayPhotos,
    });

    printHtml(invoiceHtml);
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'excellent': return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-500/40 font-bold';
      case 'good': return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-500/40 font-bold';
      case 'fair': return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-500/40 font-bold';
      case 'poor': return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-500/40 font-bold';
      default: return 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 font-bold';
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold sm:text-2xl">Inventory Management</h2>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Phone
          </Button>
          <div className="text-sm text-gray-600">
            Total: {filteredPhones.length} phones
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Button onClick={() => setAddDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Phone
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setShopDialogMode("add");
            setShopDialogExistingShopId(null);
            setShopDialogOpen(true);
          }}
          className="font-semibold"
        >
          <Building2 className="h-4 w-4 mr-1.5" />
          Add New Shop
        </Button>
        {shops.length > 0 && (
          <Button
            variant="outline"
            onClick={() => {
              setShopDialogMode("copy");
              setShopDialogExistingShopId(selectedShop);
              setShopDialogOpen(true);
            }}
            className="font-semibold"
          >
            <Copy className="h-4 w-4 mr-1.5" />
            Copy Shop Details
          </Button>
        )}

        {/* View Switcher: Available Stock vs Sold Phones Purchase Records */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/90 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
          <Button
            size="sm"
            variant={statusFilter === "available" ? "default" : "ghost"}
            onClick={() => setStatusFilter("available")}
            className={`text-xs h-8 font-bold ${statusFilter === "available" ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" : "text-slate-600 dark:text-slate-300"}`}
          >
            Available Stock ({phones?.filter((p: any) => !p.is_sold).length || 0})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "sold_purchase" ? "default" : "ghost"}
            onClick={() => setStatusFilter("sold_purchase")}
            title="View sold phones purchase history & purchase invoices"
            className={`text-xs h-8 font-bold ${statusFilter === "sold_purchase" ? "bg-amber-600 hover:bg-amber-700 text-white shadow-sm" : "text-slate-600 dark:text-slate-300"}`}
          >
            Sold Phones Purchase Records ({phones?.filter((p: any) => p.is_sold).length || 0})
          </Button>
          {onNavigateTab && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onNavigateTab("sold")}
              title="Navigate to Sold Phones Sales Records"
              className="text-xs h-8 font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-500"
            >
              Sold Phones (Sales) &rarr;
            </Button>
          )}
          <Button
            size="sm"
            variant={statusFilter === "all" ? "default" : "ghost"}
            onClick={() => setStatusFilter("all")}
            className={`text-xs h-8 font-semibold ${statusFilter === "all" ? "bg-slate-700 text-white" : "text-slate-500 dark:text-slate-400"}`}
          >
            All ({phones?.length || 0})
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4" style={{ marginBottom: '12px' }}>
        <Select
          value={selectedShop ?? ALL_SHOPS}
          onValueChange={(value) => setSelectedShop(value === ALL_SHOPS ? null : value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Filter by shop" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SHOPS}>All Shops</SelectItem>
            {shops.map((shop) => (
              <SelectItem key={shop.id} value={shop.id}>
                {shop.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedShop && (
          <Button variant="outline" size="sm" onClick={() => setSelectedShop(null)}>
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search phones, purchase bill no, IMEI, seller..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={conditionFilter} onValueChange={setConditionFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by condition" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Conditions</SelectItem>
            <SelectItem value="excellent">Excellent</SelectItem>
            <SelectItem value="good">Good</SelectItem>
            <SelectItem value="fair">Fair</SelectItem>
            <SelectItem value="poor">Poor</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="sold">Sold</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center text-sm text-gray-600">
          <Filter className="h-4 w-4 mr-2" />
          {filteredPhones.length} of {phones?.length || 0}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 sm:gap-6">
        {filteredPhones.map((phone: any) => {
          const isDealerPhone = !!(phone.is_dealer || phone.dealer_id);
          return (
          <Card
            key={phone.id}
            className={`transition-all rounded-2xl border ${
              isDealerPhone
                ? "bg-sky-50/70 border-sky-300 text-slate-900 shadow-sm dark:bg-[#0c1424] dark:border-sky-500/50 dark:text-slate-100 dark:shadow-[0_0_20px_rgba(14,165,233,0.12)]"
                : phone.is_sold
                ? "bg-slate-50 border-emerald-300 opacity-90 text-slate-900 dark:bg-slate-900/60 dark:border-emerald-500/40 dark:text-slate-100"
                : "bg-white border-slate-200 text-slate-900 shadow-sm dark:bg-[#0d121f] dark:border-slate-800 dark:text-slate-100"
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start gap-2">
                <div className="flex items-start gap-2.5">
                  {!phone.is_sold && (
                    <div className="pt-0.5">
                      <Checkbox
                        id={`select-${phone.id}`}
                        checked={selectedPhoneIds.has(phone.id)}
                        onCheckedChange={() => toggleSelectPhone(phone.id)}
                        className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600 h-4 w-4 rounded"
                        title="Select for batch sale"
                      />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">{phone.phone_name}</CardTitle>
                      {isDealerPhone && (
                        <Badge variant="outline" className="text-[10px] bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/80 dark:text-sky-300 dark:border-sky-500/40 font-bold">
                          🏢 B2B Dealer
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-0.5">{phone.model}</p>
                  </div>
                </div>
                <div className="flex space-x-1 shrink-0">
                  <Badge className={getConditionColor(phone.condition)}>
                    {phone.condition}
                  </Badge>
                  {phone.is_sold && (
                    <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-500/40 font-bold">
                      SOLD
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-3">
              <div className="text-sm space-y-1 text-slate-700 dark:text-slate-300">
                <div><strong className="text-slate-900 dark:text-slate-100 font-bold">IMEI:</strong> <span className="font-mono">{phone.imei_number}</span></div>
                <div><strong className="text-slate-900 dark:text-slate-100 font-bold">Variant:</strong> {phone.variant || '-'}</div>
                <div><strong className="text-slate-900 dark:text-slate-100 font-bold">Colour:</strong> {phone.colour || '-'}</div>
                <div>
                  <strong className="text-slate-900 dark:text-slate-100 font-bold">{isDealerPhone ? "Dealer:" : "Seller:"}</strong>{" "}
                  {isDealerPhone ? (
                    <span className="text-sky-700 dark:text-sky-400 font-bold">{phone.dealers?.shop_name || "B2B Supplier"}</span>
                  ) : (
                    <span className="font-semibold text-slate-900 dark:text-slate-200">{phone.sellers?.name || "-"}</span>
                  )}
                </div>
                <div><strong className="text-slate-900 dark:text-slate-100 font-bold">Purchase:</strong> <span className="font-semibold">₹{phone.purchase_price}</span></div>
                <div><strong className="text-slate-900 dark:text-slate-100 font-bold">Selling:</strong> <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{phone.selling_price}</span></div>
                {phone.is_sold && phone.customers && (
                  <div><strong className="text-slate-900 dark:text-slate-100 font-bold">Customer:</strong> <span className="font-semibold text-slate-900 dark:text-slate-200">{phone.customers.name}</span></div>
                )}
                {phone.rating && (
                  <div><strong className="text-slate-900 dark:text-slate-100 font-bold">Rating:</strong> {phone.rating}/5</div>
                )}
              </div>

              <div className="flex flex-wrap gap-1">
                {phone.bill_available && (
                  <Badge variant="outline" className="text-xs bg-slate-100 border-slate-300 text-slate-800 dark:bg-slate-800/80 dark:border-slate-700 dark:text-slate-300 font-semibold">Bill</Badge>
                )}
                {phone.box_available && (
                  <Badge variant="outline" className="text-xs bg-slate-100 border-slate-300 text-slate-800 dark:bg-slate-800/80 dark:border-slate-700 dark:text-slate-300 font-semibold">Box</Badge>
                )}
                {phone.charger_available && (
                  <Badge variant="outline" className="text-xs bg-slate-100 border-slate-300 text-slate-800 dark:bg-slate-800/80 dark:border-slate-700 dark:text-slate-300 font-semibold">Charger</Badge>
                )}
              </div>

              <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                <span>Product: {phone.product_photos?.length || 0}</span>
                <span>Docs: {phone.purchase_documents?.length || 0}</span>
                <span>Payment: {phone.payment_proof_photos?.length || 0}</span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(phone)}
                  className="flex-1 font-semibold border-slate-300 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => viewPhotos(phone, 'product')}
                  disabled={!phone.product_photos?.length}
                  className="font-semibold border-slate-300 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Photos
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => viewPhotos(phone, 'purchase')}
                  disabled={!phone.purchase_documents?.length}
                  className="font-semibold border-slate-300 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Docs
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => viewPhotos(phone, 'payment')}
                  disabled={!phone.payment_proof_photos?.length}
                  title="Payment Proof"
                  className="font-semibold border-slate-300 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Payment
                </Button>
                
                <div className="flex flex-wrap gap-1 w-full">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setInvoiceDialogPhone(phone); setInvoiceDialogOpen(true); }}
                    title="Customize & generate purchase invoice"
                    className="font-semibold border-slate-300 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <Receipt className="h-4 w-4 mr-1" />
                    Invoice
                  </Button>
                  {phone.batch_purchase_id && (
                    Boolean(phone.is_dealer) ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setBatchInvoiceId(phone.batch_purchase_id);
                          setShowBatchInvoiceDialog(true);
                        }}
                        title="View combined wholesale B2B batch purchase bill (सभी फ़ोन्स का संयुक्त बिल)"
                        className="text-sky-700 dark:text-sky-300 hover:text-sky-800 dark:hover:text-white bg-sky-50 dark:bg-sky-950/60 border-sky-300 dark:border-sky-500/40 font-bold"
                      >
                        <Building2 className="h-4 w-4 mr-1 text-sky-600 dark:text-sky-400" />
                        B2B Bill
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openCombinedPurchaseInvoice(phone.batch_purchase_id)}
                        title="View combined purchase voucher for multiple phones from this seller (संयुक्त खरीद रसीद)"
                        className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-white bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-500/40 font-bold"
                      >
                        <Receipt className="h-4 w-4 mr-1 text-emerald-600 dark:text-emerald-400" />
                        Combined Bill
                      </Button>
                    )
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSapathPhone(phone)}
                    title="Legal Sapath Patra (शपथ पत्र)"
                    className="text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-white bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-500/40 font-bold"
                  >
                    <ShieldCheck className="h-4 w-4 mr-1 text-blue-600 dark:text-blue-400" />
                    शपथ पत्र
                  </Button>
                  {!phone.is_sold && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        downloadSaleWallpaper({
                          phoneId: phone.id,
                          phoneName: phone.phone_name,
                          imei: phone.imei_number,
                          storage: phone.variant,
                          sellingPrice: phone.selling_price,
                        })
                      }
                      title="Download Sale QR Wallpaper (set on phone screen to sell instantly)"
                      className="border-slate-300 dark:border-slate-700 dark:bg-slate-800/80"
                    >
                      <QrCode className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => generateInvoice(phone, 'whatsapp')}
                    title="WhatsApp Purchase Invoice"
                    className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-white bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-500/40 font-bold"
                  >
                    <Share className="h-4 w-4 mr-1" />
                    WhatsApp
                  </Button>
                </div>
                
                {!phone.is_sold && (
                  <div className="flex items-center gap-2 w-full pt-1">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleProcessSale(phone)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex-1 shadow-sm"
                    >
                      <ShoppingCart className="h-4 w-4 mr-1" />
                      Process Sale
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(phone.id, phone.is_sold)}
                      className="font-bold shadow-sm"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
      </div>

      {filteredPhones.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No phones found matching your criteria.</p>
        </div>
      )}

      {selectedPhoneIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900/95 text-white backdrop-blur border border-emerald-500/50 shadow-2xl rounded-2xl px-6 py-3.5 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-slate-950">
              {selectedPhoneIds.size}
            </span>
            <span>Selected for Multi-Phone Sale</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                const batchPhones = (phones || []).filter((p: any) => selectedPhoneIds.has(p.id));
                setSelectedBatchPhones(batchPhones);
                setSelectedPhone(null);
                setProcessSaleDialogOpen(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md"
            >
              <ShoppingCart className="h-4 w-4 mr-1.5" />
              Process Multi-Sale ({selectedPhoneIds.size})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedPhoneIds(new Set());
                setSelectedBatchPhones([]);
              }}
              className="text-slate-300 hover:text-white hover:bg-slate-800"
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      <AddPhoneDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
      />
      <ShopManagementDialog
        open={shopDialogOpen}
        onOpenChange={setShopDialogOpen}
        mode={shopDialogMode}
        existingShopId={shopDialogExistingShopId}
        onSaved={loadShops}
      />

      <EditPhoneDialog
        phone={selectedPhone}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />

      <ProcessSaleDialog
        phone={selectedPhone}
        phones={selectedBatchPhones}
        open={processSaleDialogOpen}
        onOpenChange={(open) => {
          setProcessSaleDialogOpen(open);
          if (!open) {
            setSelectedBatchPhones([]);
          }
        }}
        onSuccess={() => {
          setSelectedPhoneIds(new Set());
          setSelectedBatchPhones([]);
        }}
      />

      <InvoiceCustomizeDialog
        open={invoiceDialogOpen}
        onOpenChange={setInvoiceDialogOpen}
        kind="purchase"
        productCount={invoiceDialogPhone?.product_photos?.length || 0}
        purchaseCount={invoiceDialogPhone?.purchase_documents?.length || 0}
        paymentProofCount={invoiceDialogPhone?.payment_proof_photos?.length || 0}
        saleCount={0}
        baseAmount={Number(invoiceDialogPhone?.purchase_price || 0)}
        onGenerate={(c) => {
          if (!invoiceDialogPhone) return;
          generateInvoice(invoiceDialogPhone, c.action || 'pdf', c);
        }}
      />

      <SapathPatraModal
        phone={sapathPhone}
        open={!!sapathPhone}
        onOpenChange={(o) => { if (!o) setSapathPhone(null); }}
      />

      <DealerBatchInvoiceDialog
        open={showBatchInvoiceDialog}
        onOpenChange={setShowBatchInvoiceDialog}
        batchId={batchInvoiceId}
      />

      <PhotoViewer
        photos={currentPhotos}
        open={photoViewerOpen}
        onOpenChange={setPhotoViewerOpen}
        title={currentPhotoTitle}
      />
    </div>
  );
};

export default InventoryTab;