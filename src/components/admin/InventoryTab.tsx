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
import { buildInvoiceHtml, DEFAULT_PURCHASE_TERMS } from "@/lib/invoiceTemplates";
import { downloadSaleWallpaper } from "@/lib/deviceQr";
import { toast } from "sonner";
import { numberToWords } from "@/utils/numberToWords";
import { printHtml } from "@/lib/printHtml";
import { dispatchWhatsApp } from "@/utils/whatsappDispatcher";
import { formatPurchaseInvoiceText, formatSalesInvoiceText } from "@/lib/whatsappInvoiceFormatter";
import SapathPatraModal from "./SapathPatraModal";
import DealerBatchInvoiceDialog from "./DealerBatchInvoiceDialog";

/** Sentinel for the Radix select - an empty string is not a legal item value. */
const ALL_SHOPS = "all";

const InventoryTab = () => {
  const [selectedPhone, setSelectedPhone] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [processSaleDialogOpen, setProcessSaleDialogOpen] = useState(false);
  const [sapathPhone, setSapathPhone] = useState<any | null>(null);
  const [batchInvoiceId, setBatchInvoiceId] = useState<string | null>(null);
  const [showBatchInvoiceDialog, setShowBatchInvoiceDialog] = useState(false);
  const [currentPhotos, setCurrentPhotos] = useState<string[]>([]);
  const [currentPhotoTitle, setCurrentPhotoTitle] = useState("");
  const [invoiceDialogPhone, setInvoiceDialogPhone] = useState<any>(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [shopDialogOpen, setShopDialogOpen] = useState(false);
  const [shopDialogMode, setShopDialogMode] = useState<"add" | "copy">("add");
  const [shopDialogExistingShopId, setShopDialogExistingShopId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [conditionFilter, setConditionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
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
        phone.sellers?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (phone.variant || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (phone.colour || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCondition = conditionFilter === "all" || phone.condition === conditionFilter;
      const matchesStatus = statusFilter === "all" || 
        (statusFilter === "sold" && phone.is_sold) ||
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
    const documentPhotos = photos.photos === 'none' || photos.photos === 'product'
      ? []
      : (phone.purchase_documents || []);

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

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'excellent': return 'bg-green-100 text-green-800';
      case 'good': return 'bg-blue-100 text-blue-800';
      case 'fair': return 'bg-yellow-100 text-yellow-800';
      case 'poor': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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

      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Phone
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setShopDialogMode("add");
            setShopDialogExistingShopId(null);
            setShopDialogOpen(true);
          }}
        >
          <Building2 className="h-4 w-4 mr-2" />
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
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy Shop Details
          </Button>
        )}
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
            placeholder="Search phones..."
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
            className={`${
              isDealerPhone
                ? "bg-sky-50/70 border-sky-300 shadow-sm"
                : phone.is_sold
                ? "opacity-75 border-green-200"
                : ""
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-1.5">
                    <CardTitle className="text-lg">{phone.phone_name}</CardTitle>
                    {isDealerPhone && (
                      <Badge variant="outline" className="text-[10px] bg-sky-100 text-sky-800 border-sky-300 font-semibold">
                        🏢 B2B Dealer
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{phone.model}</p>
                </div>
                <div className="flex space-x-1">
                  <Badge className={getConditionColor(phone.condition)}>
                    {phone.condition}
                  </Badge>
                  {phone.is_sold && (
                    <Badge className="bg-green-100 text-green-800">
                      SOLD
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-3">
              <div className="text-sm">
                <div><strong>IMEI:</strong> {phone.imei_number}</div>
                <div><strong>Variant:</strong> {phone.variant || '-'}</div>
                <div><strong>Colour:</strong> {phone.colour || '-'}</div>
                <div>
                  <strong>{isDealerPhone ? "Dealer:" : "Seller:"}</strong>{" "}
                  {isDealerPhone ? (
                    <span className="text-sky-700 font-semibold">{phone.dealers?.shop_name || "B2B Supplier"}</span>
                  ) : (
                    phone.sellers?.name || "-"
                  )}
                </div>
                <div><strong>Purchase:</strong> ₹{phone.purchase_price}</div>
                <div><strong>Selling:</strong> ₹{phone.selling_price}</div>
                {phone.is_sold && phone.customers && (
                  <div><strong>Customer:</strong> {phone.customers.name}</div>
                )}
                {phone.rating && (
                  <div><strong>Rating:</strong> {phone.rating}/5</div>
                )}
              </div>

              <div className="flex flex-wrap gap-1">
                {phone.bill_available && (
                  <Badge variant="outline" className="text-xs">Bill</Badge>
                )}
                {phone.box_available && (
                  <Badge variant="outline" className="text-xs">Box</Badge>
                )}
                {phone.charger_available && (
                  <Badge variant="outline" className="text-xs">Charger</Badge>
                )}
              </div>

              <div className="flex justify-between text-xs text-gray-500">
                <span>Product: {phone.product_photos?.length || 0}</span>
                <span>Docs: {phone.purchase_documents?.length || 0}</span>
                <span>Payment: {phone.payment_proof_photos?.length || 0}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(phone)}
                  className="flex-1"
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => viewPhotos(phone, 'product')}
                  disabled={!phone.product_photos?.length}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Photos
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => viewPhotos(phone, 'purchase')}
                  disabled={!phone.purchase_documents?.length}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Docs
                </Button>
                
                <div className="flex flex-wrap gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setInvoiceDialogPhone(phone); setInvoiceDialogOpen(true); }}
                    title="Customize & generate purchase invoice"
                  >
                    <Receipt className="h-4 w-4 mr-1" />
                    Invoice
                  </Button>
                  {phone.batch_purchase_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setBatchInvoiceId(phone.batch_purchase_id);
                        setShowBatchInvoiceDialog(true);
                      }}
                      title="View combined wholesale B2B batch purchase bill (सभी फ़ोन्स का संयुक्त बिल)"
                      className="text-sky-700 hover:text-sky-800 hover:bg-sky-50 border-sky-300 font-semibold"
                    >
                      <Building2 className="h-4 w-4 mr-1 text-sky-600" />
                      B2B Bill
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSapathPhone(phone)}
                    title="Legal Sapath Patra (शपथ पत्र)"
                    className="text-blue-700 hover:text-blue-800 hover:bg-blue-50"
                  >
                    <ShieldCheck className="h-4 w-4 mr-1 text-blue-600" />
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
                    >
                      <QrCode className="h-4 w-4 text-blue-600" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => generateInvoice(phone, 'whatsapp')}
                    title="WhatsApp Purchase Invoice"
                    className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                  >
                    <Share className="h-4 w-4 mr-1" />
                    WhatsApp
                  </Button>
                </div>
                
                {!phone.is_sold && (
                  <>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleProcessSale(phone)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <ShoppingCart className="h-4 w-4 mr-1" />
                      Process Sale
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(phone.id, phone.is_sold)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </>
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
        open={processSaleDialogOpen}
        onOpenChange={setProcessSaleDialogOpen}
      />

      <InvoiceCustomizeDialog
        open={invoiceDialogOpen}
        onOpenChange={setInvoiceDialogOpen}
        kind="purchase"
        productCount={invoiceDialogPhone?.product_photos?.length || 0}
        purchaseCount={invoiceDialogPhone?.purchase_documents?.length || 0}
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