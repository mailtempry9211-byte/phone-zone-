import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Eye, Receipt, Search, Filter, Download, Share, ShieldCheck } from "lucide-react";
import EditPhoneDialog from "./EditPhoneDialog";
import PhotoViewer from "./PhotoViewer";
import InvoiceCustomizeDialog, { type InvoiceCustomization } from "./InvoiceCustomizeDialog";
import SapathPatraModal from "./SapathPatraModal";
import { buildInvoiceHtml, DEFAULT_SALE_TERMS } from "@/lib/invoiceTemplates";
import { toast } from "sonner";
import { numberToWords } from "@/utils/numberToWords";
import { printHtml } from "@/lib/printHtml";
import { dispatchWhatsApp } from "@/utils/whatsappDispatcher";

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
        phone.customers?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
      : (phone.payment_proof_photos || []);

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
        // Generate sales invoice WITHOUT seller details for customer
        const message = `📱 *${adminSettings?.business_name || ''} - ${custom?.broker ? 'Broker' : 'Sale'} Invoice*

📋 *Invoice Details:*
• Invoice No: SALE-${phone.imei_number || 'NONE'}
• Invoice Date: ${new Date().toLocaleDateString()}
• Sale Date: ${phone.sold_date ? new Date(phone.sold_date).toLocaleDateString() : new Date().toLocaleDateString()}

📱 *Phone Details:*
• Brand: ${phone.phone_name}
• Model: ${phone.model}
• Variant: ${phone.variant || '-'}
• Colour: ${phone.colour || '-'}
• IMEI: ${phone.imei_number || 'NONE'}
• Condition: ${phone.condition.charAt(0).toUpperCase() + phone.condition.slice(1)}
• Price: ₹${custom?.broker && custom.brokerAmount > 0 ? custom.brokerAmount : phone.selling_price}

👤 *Customer Information:*
• Name: ${phone.customers?.name || 'N/A'}
• Mobile: ${phone.customers?.phone || 'N/A'}
• Address: ${phone.customers?.address || 'N/A'}
• ID Type: ${phone.customers?.id_proof_type || 'N/A'}
• ID Number: ${phone.customers?.id_number || 'N/A'}

💰 *Amount in Words:* ${numberToWords(custom?.broker && custom.brokerAmount > 0 ? custom.brokerAmount : phone.selling_price)} Rupees Only

🏦 *Bank Details:*
${adminSettings?.bank_name || ''} Bank
Name: ${adminSettings?.account_holder_name || ''}
A/C No: ${adminSettings?.account_number || ''}
IFSC: ${adminSettings?.ifsc_code || ''}

📋 *Terms & Conditions:*
1. All phones has been checked for stolen/locked status from the official government CEIR website (www.ceir.gov.in).
2. If a phone is later found to be lost, stolen, or blacklisted, the seller is solely responsible.
3. Once sold, devices cannot be returned — exchange only, and only if stated on the invoice.
4. This sale is subject to local jurisdiction only.

📞 *Contact Information:*
${adminSettings?.address || ''}
Phone: ${adminSettings?.phone_primary || ''} | ${adminSettings?.phone_secondary || ''}
Email: ${adminSettings?.email || ''}
Instagram: ${adminSettings?.instagram || ''}

Thank you for purchasing with ${adminSettings?.business_name || ''}!`;

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
        <h2 className="text-xl font-bold sm:text-2xl">Sold Phones</h2>
        <div className="text-sm text-gray-600">
          Total Sold: {filteredPhones.length} phones
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search sold phones..."
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
        {filteredPhones.map((phone) => (
          <Card key={phone.id} className="border-green-200">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{phone.phone_name}</CardTitle>
                  <p className="text-sm text-gray-600">{phone.model}</p>
                </div>
                <div className="flex space-x-1">
                  <Badge className={getConditionColor(phone.condition)}>
                    {phone.condition}
                  </Badge>
                  <Badge className="bg-green-100 text-green-800">
                    SOLD
                  </Badge>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-3">
              <div className="text-sm">
                <div><strong>IMEI:</strong> {phone.imei_number}</div>
                <div><strong>Variant:</strong> {phone.variant || '-'}</div>
                <div><strong>Colour:</strong> {phone.colour || '-'}</div>
                <div><strong>Customer:</strong> {phone.customers?.name}</div>
                <div><strong>Purchase:</strong> ₹{phone.purchase_price}</div>
                <div><strong>Sold For:</strong> ₹{phone.selling_price}</div>
                <div><strong>Profit:</strong> ₹{phone.selling_price - phone.purchase_price}</div>
                <div><strong>Sold Date:</strong> {phone.sold_date ? new Date(phone.sold_date).toLocaleDateString() : 'N/A'}</div>
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
                <span>Sales: {phone.payment_proof_photos?.length || 0}</span>
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
                  title="Purchase Documents"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Docs
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => viewPhotos(phone, 'sales')}
                  disabled={!phone.payment_proof_photos?.length}
                  title="Sales Documents"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Sales Doc
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInvoicePhone(phone)}
                  title="Customise & generate sale invoice"
                >
                  <Receipt className="h-4 w-4 mr-1" />
                  Invoice
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSapathPatraPhone(phone)}
                  title="Legal Sapath Patra (शपथ पत्र)"
                  className="text-blue-700 hover:text-blue-800 hover:bg-blue-50"
                >
                  <ShieldCheck className="h-4 w-4 mr-1 text-blue-600" />
                  शपथ पत्र
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateInvoice(phone, 'whatsapp')}
                  title="Share invoice on WhatsApp"
                  className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                >
                  <Share className="h-4 w-4 mr-1" />
                  WhatsApp
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredPhones.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No sold phones found matching your criteria.</p>
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
        saleCount={invoicePhone?.payment_proof_photos?.length || 0}
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