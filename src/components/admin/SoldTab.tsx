import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Eye, Receipt, Search, Filter, Download, Share, ShieldCheck, CheckSquare } from "lucide-react";
import EditPhoneDialog from "./EditPhoneDialog";
import PhotoViewer from "./PhotoViewer";
import InvoiceCustomizeDialog, { type InvoiceCustomization } from "./InvoiceCustomizeDialog";
import SapathPatraModal from "./SapathPatraModal";
import { buildInvoiceHtml, buildCombinedSaleInvoiceHtml, DEFAULT_SALE_TERMS } from "@/lib/invoiceTemplates";
import { toast } from "sonner";
import { numberToWords } from "@/utils/numberToWords";
import { printHtml } from "@/lib/printHtml";
import { dispatchWhatsApp } from "@/utils/whatsappDispatcher";
import { formatSalesInvoiceText } from "@/lib/whatsappInvoiceFormatter";
import { Checkbox } from "@/components/ui/checkbox";

const SoldTab = () => {
  const [selectedPhone, setSelectedPhone] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [invoicePhone, setInvoicePhone] = useState<any | null>(null);
  const [sapathPatraPhone, setSapathPatraPhone] = useState<any | null>(null);
  const [currentPhotos, setCurrentPhotos] = useState<string[]>([]);
  const [currentPhotoTitle, setCurrentPhotoTitle] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [conditionFilter, setConditionFilter] = useState("all");
  const [selectedSoldIds, setSelectedSoldIds] = useState<Set<string>>(new Set());

  const toggleSelectPhone = (id: string) => {
    setSelectedSoldIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  
  const queryClient = useQueryClient();

  const { data: soldPhones, isLoading } = useQuery({
    queryKey: ['sold-phones'],
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
        .eq('is_sold', true)
        .order('sold_date', { ascending: false });
      
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

  const filteredPhones = useMemo(() => {
    if (!soldPhones) return [];
    
    return soldPhones.filter(phone => {
      const matchesSearch = 
        phone.phone_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        phone.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        phone.imei_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ((phone as any).invoice_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        ((phone as any).batch_sale_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (phone.customers?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        ((phone.customers as any)?.phone || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (phone.variant || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (phone.colour || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCondition = conditionFilter === "all" || phone.condition === conditionFilter;
      
      return matchesSearch && matchesCondition;
    });
  }, [soldPhones, searchTerm, conditionFilter]);

  const handleEdit = (phone: any) => {
    setSelectedPhone(phone);
    setEditDialogOpen(true);
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
        title = "Purchase Payment Proof Photos";
        break;
      case 'sales':
        photos = (phone.sale_documents && phone.sale_documents.length > 0)
          ? phone.sale_documents
          : (phone.payment_proof_photos && phone.payment_proof_photos.some((p: string) => p.includes('sale-documents')) ? phone.payment_proof_photos : []);
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

  const generateSalesInvoiceHTML = (phone: any, custom?: InvoiceCustomization): string => {
    if (!adminSettings) {
      toast.error("Admin settings not found");
      return "";
    }

    const photos: InvoiceCustomization = custom ?? { photos: 'product', style: 'heritage', broker: false, brokerAmount: 0, brokerName: '' };

    const productPhotos = photos.photos === 'none' || photos.photos === 'purchase'
      ? []
      : (phone.product_photos?.filter((photo: string) => {
          return photo.includes('product-photos') || !photo.includes('sale-documents');
        }) || []);
    const saleDocPhotos = photos.photos === 'none' || photos.photos === 'product'
      ? []
      : ((phone.sale_documents && phone.sale_documents.length > 0)
          ? phone.sale_documents
          : (phone.payment_proof_photos && phone.payment_proof_photos.some((p: string) => p.includes('sale-documents')) ? phone.payment_proof_photos : []));

    // A broker copy shows the BROKER amount; the real sale keeps phone.selling_price.
    const invoiceAmount = photos.broker && photos.brokerAmount > 0
      ? photos.brokerAmount
      : Number(phone.selling_price || 0);

    return buildInvoiceHtml({
      kind: 'sale',
      style: photos.style,
      settings: adminSettings,
      phone,
      amount: invoiceAmount,
      isBroker: photos.broker,
      brokerName: photos.brokerName,
      photoChoice: photos.photos,
      productPhotos,
      documentPhotos: saleDocPhotos,
      documentLabel: 'Sales Documents',
      terms: (adminSettings.terms_and_conditions_sale || adminSettings.terms_and_conditions || '').split('\n').filter(Boolean),
      fallbackTerms: DEFAULT_SALE_TERMS,
    });
  };

  const generateInvoice = (
    phone: any,
    type: 'html' | 'pdf' | 'preview' | 'whatsapp' = 'html',
    custom?: InvoiceCustomization
  ) => {
    const invoiceHtml = generateSalesInvoiceHTML(phone, custom);
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
        break;
      case 'whatsapp': {
        const message = formatSalesInvoiceText(phone, adminSettings, {
          broker: custom?.broker,
          brokerAmount: custom?.brokerAmount,
          brokerName: custom?.brokerName,
        });

        const customerPhone = phone.customers?.phone || '';
        dispatchWhatsApp({
          phone: customerPhone,
          message,
          invoiceHtml,
          pdfFileName: `Sales_Invoice_${phone.imei_number || 'receipt'}.pdf`,
          adminSettings,
        });
        break;
      }
    }
  };

  const openCombinedSaleInvoice = (batchSaleId?: string, explicitPhones?: any[]) => {
    if (!soldPhones || !adminSettings) return;
    const targetPhones = explicitPhones || soldPhones.filter((p: any) => p.batch_sale_id === batchSaleId);
    if (!targetPhones.length) {
      toast.error("No phones found for combined invoice");
      return;
    }
    const prime = targetPhones[0];
    const customer = prime.customers || {
      name: "Customer",
      phone: "-",
      address: "-",
    };

    const allProductPhotos = Array.from(new Set(targetPhones.flatMap((p: any) => p.product_photos || [])));
    const allSaleDocs = Array.from(new Set(targetPhones.flatMap((p: any) => p.sale_documents || [])));
    const totalAmount = targetPhones.reduce((sum: number, p: any) => sum + Number(p.selling_price || 0), 0);
    const saleTerms = (adminSettings?.terms_and_conditions_sale || adminSettings?.terms_and_conditions || "").split("\n").filter(Boolean);

    const invoiceHtml = buildCombinedSaleInvoiceHtml({
      settings: adminSettings,
      customer,
      phones: targetPhones.map((p: any) => ({
        phone_name: p.phone_name,
        model: p.model,
        imei_number: p.imei_number,
        imei2_number: p.imei2_number,
        variant: p.variant,
        colour: p.colour,
        condition: p.condition,
        selling_price: Number(p.selling_price || 0),
        product_photos: p.product_photos || [],
      })),
      totalAmount,
      invoiceNumber: `SALE-${(batchSaleId || Date.now().toString()).slice(-8).toUpperCase()}`,
      saleDate: prime.sold_date ? new Date(prime.sold_date).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN"),
      paymentMethod: "UPI / Cash",
      terms: saleTerms,
      productPhotos: allProductPhotos,
      saleDocuments: allSaleDocs,
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
        <h2 className="text-xl font-bold sm:text-2xl">Sold Phones</h2>
        <div className="text-sm text-gray-600">
          Total Sold: {filteredPhones.length} phones
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search sold phones, invoice no (SAL-...), IMEI, customer..."
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

        <div className="flex items-center text-sm text-gray-600">
          <Filter className="h-4 w-4 mr-2" />
          {filteredPhones.length} of {soldPhones?.length || 0}
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
                : "bg-white border-emerald-200 text-slate-900 shadow-sm dark:bg-[#0d121f] dark:border-emerald-500/30 dark:text-slate-100"
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start gap-2">
                <div className="flex items-start gap-2.5">
                  <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedSoldIds.has(phone.id)}
                      onCheckedChange={() => toggleSelectPhone(phone.id)}
                      className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                    />
                  </div>
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
                  <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-500/40 font-bold">
                    SOLD
                  </Badge>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-3">
              <div className="text-sm space-y-1 text-slate-700 dark:text-slate-300">
                <div><strong className="text-slate-900 dark:text-slate-100 font-bold">IMEI:</strong> <span className="font-mono">{phone.imei_number}</span></div>
                <div><strong className="text-slate-900 dark:text-slate-100 font-bold">Variant:</strong> {phone.variant || '-'}</div>
                <div><strong className="text-slate-900 dark:text-slate-100 font-bold">Colour:</strong> {phone.colour || '-'}</div>
                <div>
                  <strong className="text-slate-900 dark:text-slate-100 font-bold">Source:</strong>{" "}
                  {isDealerPhone ? (
                    <span className="text-sky-700 dark:text-sky-400 font-bold">🏢 Dealer ({phone.dealers?.shop_name || "B2B"})</span>
                  ) : (
                    <span className="font-semibold text-slate-900 dark:text-slate-200">{phone.sellers?.name || "Direct Seller"}</span>
                  )}
                </div>
                <div><strong className="text-slate-900 dark:text-slate-100 font-bold">Customer:</strong> <span className="font-semibold text-slate-900 dark:text-slate-200">{phone.customers?.name || "Direct Customer"}</span></div>
                <div><strong className="text-slate-900 dark:text-slate-100 font-bold">Purchase:</strong> <span className="font-semibold">₹{phone.purchase_price}</span></div>
                <div><strong className="text-slate-900 dark:text-slate-100 font-bold">Sold For:</strong> <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{phone.selling_price}</span></div>
                <div><strong className="text-slate-900 dark:text-slate-100 font-bold">Profit:</strong> <span className="font-bold text-teal-600 dark:text-teal-400">₹{phone.selling_price - phone.purchase_price}</span></div>
                <div><strong className="text-slate-900 dark:text-slate-100 font-bold">Sold Date:</strong> {phone.sold_date ? new Date(phone.sold_date).toLocaleDateString() : 'N/A'}</div>
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
                <span>Sales: {phone.sale_documents?.length || 0}</span>
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
                  title="Purchase Documents"
                  className="font-semibold border-slate-300 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Docs
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => viewPhotos(phone, 'sales')}
                  disabled={!(phone.sale_documents?.length || (phone.payment_proof_photos && phone.payment_proof_photos.some((p: string) => p.includes('sale-documents'))))}
                  title="Sales Documents"
                  className="font-semibold border-slate-300 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Sales Doc
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => viewPhotos(phone, 'payment')}
                  disabled={!phone.payment_proof_photos?.length}
                  title="Purchase Payment Proof"
                  className="font-semibold border-slate-300 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Payment
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInvoicePhone(phone)}
                  title="Customise & generate sale invoice"
                  className="font-semibold border-slate-300 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Receipt className="h-4 w-4 mr-1" />
                  Invoice
                </Button>

                {phone.batch_sale_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openCombinedSaleInvoice(phone.batch_sale_id)}
                    title="View combined sales invoice for all phones sold in this batch (संयुक्त बिक्री बिल)"
                    className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-white bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-500/40 font-bold"
                  >
                    <Receipt className="h-4 w-4 mr-1 text-emerald-600 dark:text-emerald-400" />
                    Combined Bill
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSapathPatraPhone(phone)}
                  title="Legal Sapath Patra (शपथ पत्र)"
                  className="text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-white bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-500/40 font-bold"
                >
                  <ShieldCheck className="h-4 w-4 mr-1 text-blue-600 dark:text-blue-400" />
                  शपथ पत्र
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateInvoice(phone, 'whatsapp')}
                  title="Share invoice on WhatsApp"
                  className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-white bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-500/40 font-bold"
                >
                  <Share className="h-4 w-4 mr-1" />
                  WhatsApp
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
      </div>

      {filteredPhones.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No sold phones found matching your criteria.</p>
        </div>
      )}

      {/* Floating Bottom Bar for Multi-Phone Combined Invoice */}
      {selectedSoldIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4">
          <span className="text-sm font-semibold text-slate-200">
            {selectedSoldIds.size} phone{selectedSoldIds.size > 1 ? "s" : ""} selected
          </span>
          <Button
            size="sm"
            onClick={() => {
              const chosen = (soldPhones || []).filter((p: any) => selectedSoldIds.has(p.id));
              openCombinedSaleInvoice(undefined, chosen);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8"
          >
            <Receipt className="h-4 w-4 mr-1.5" />
            Generate Combined Invoice
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedSoldIds(new Set())}
            className="text-slate-300 hover:text-white text-xs h-8"
          >
            Clear
          </Button>
        </div>
      )}

      <EditPhoneDialog
        phone={selectedPhone}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />

      <PhotoViewer
        photos={currentPhotos}
        open={photoViewerOpen}
        onOpenChange={setPhotoViewerOpen}
        title={currentPhotoTitle}
      />

      <InvoiceCustomizeDialog
        kind="sale"
        open={!!invoicePhone}
        onOpenChange={(o) => { if (!o) setInvoicePhone(null); }}
        productCount={invoicePhone?.product_photos?.length || 0}
        purchaseCount={invoicePhone?.purchase_documents?.length || 0}
        saleCount={invoicePhone?.sale_documents?.length || (invoicePhone?.payment_proof_photos && invoicePhone?.payment_proof_photos.some((p: string) => p.includes('sale-documents')) ? invoicePhone?.payment_proof_photos?.length : 0)}
        paymentProofCount={invoicePhone?.payment_proof_photos?.length || 0}
        baseAmount={Number(invoicePhone?.selling_price || 0)}
        onGenerate={(custom) => {
          if (!invoicePhone) return;
          generateInvoice(invoicePhone, custom.action || 'pdf', custom);
        }}
      />

      <SapathPatraModal
        phone={sapathPatraPhone}
        open={!!sapathPatraPhone}
        onOpenChange={(o) => { if (!o) setSapathPatraPhone(null); }}
      />
    </div>
  );
};

export default SoldTab;