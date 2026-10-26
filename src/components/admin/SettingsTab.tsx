
import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isOfflineMode } from "@/lib/data/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Upload, Download, RefreshCw, Settings2, Building2, Phone, Mail, Instagram, Eye, ShieldCheck, Star, Landmark, FileText, Smartphone, KeyRound, Plus } from "lucide-react";
import { toast } from "sonner";

const SettingsTab = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
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

  const [formData, setFormData] = useState({
    business_name: "",
    business_tagline: "",
    owner_name: "",
    address: "",
    phone_primary: "",
    phone_secondary: "",
    email: "",
    instagram: "",
    logo_url: "",
    signature_url: "",
    udyam_number: "",
    udyam_verified: false,
    google_business_url: "",
    google_business_verified: false,
    show_google_business: false,
    terms_and_conditions: "",
    terms_and_conditions_sale: "",
    terms_and_conditions_purchase: "",
    bank_name: "",
    account_holder_name: "",
    account_number: "",
    ifsc_code: "",
    whatsapp_number: "",
    whatsapp_channel: "click_to_chat",
    tac_fetch_mode: "ask",
  });

  // Update form data when settings load
  useEffect(() => {
    if (settings) {
      setFormData({
        business_name: settings.business_name || "",
        business_tagline: settings.business_tagline || "",
        owner_name: settings.owner_name || "",
        address: settings.address || "",
        phone_primary: settings.phone_primary || "",
        phone_secondary: settings.phone_secondary || "",
        email: settings.email || "",
        instagram: settings.instagram || "",
        logo_url: settings.logo_url || "",
        signature_url: settings.signature_url || "",
        udyam_number: settings.udyam_number || "",
        udyam_verified: !!settings.udyam_verified,
        google_business_url: settings.google_business_url || "",
        google_business_verified: !!settings.google_business_verified,
        show_google_business: !!settings.show_google_business,
        terms_and_conditions: settings.terms_and_conditions || "",
        terms_and_conditions_sale: settings.terms_and_conditions_sale || "",
        terms_and_conditions_purchase: settings.terms_and_conditions_purchase || "",
        bank_name: settings.bank_name || "",
        account_holder_name: settings.account_holder_name || "",
        account_number: settings.account_number || "",
        ifsc_code: settings.ifsc_code || "",
        whatsapp_number: settings.whatsapp_number || "",
        whatsapp_channel: (settings as any).whatsapp_channel || "click_to_chat",
        tac_fetch_mode: settings.tac_fetch_mode || "ask",
      });
    }
  }, [settings]);

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      // Route through the backend /api/settings endpoint so the save goes
      // through settingsService.saveSettings() which enforces the writable-columns
      // whitelist and validates tac_fetch_mode. A direct .update() would write
      // any column the form happens to include.
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          business_name: formData.business_name,
          business_tagline: formData.business_tagline,
          owner_name: formData.owner_name,
          address: formData.address,
          phone_primary: formData.phone_primary,
          phone_secondary: formData.phone_secondary,
          email: formData.email,
          instagram: formData.instagram,
          logo_url: formData.logo_url,
          signature_url: formData.signature_url,
          udyam_number: formData.udyam_number,
          udyam_verified: formData.udyam_verified ? 1 : 0,
          google_business_url: formData.google_business_url,
          google_business_verified: formData.google_business_verified ? 1 : 0,
          show_google_business: formData.show_google_business ? 1 : 0,
          terms_and_conditions: formData.terms_and_conditions,
          terms_and_conditions_sale: formData.terms_and_conditions_sale,
          terms_and_conditions_purchase: formData.terms_and_conditions_purchase,
          bank_name: formData.bank_name,
          account_holder_name: formData.account_holder_name,
          account_number: formData.account_number,
          ifsc_code: formData.ifsc_code,
          whatsapp_number: formData.whatsapp_number,
          whatsapp_channel: formData.whatsapp_channel || "click_to_chat",
          tac_fetch_mode: formData.tac_fetch_mode || "ask",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to save settings.");

      toast.success("Settings saved successfully!");
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    } catch (error) {
      console.error('Save settings error:', error);
      toast.error("Failed to save settings");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetToDefaults = async () => {
    if (!confirm("Are you sure you want to reset all settings to defaults?")) return;

    try {
      const dbDefaults = {
        business_name: '',
        business_tagline: '',
        owner_name: '',
        address: '',
        phone_primary: '',
        phone_secondary: '',
        email: '',
        instagram: '',
        logo_url: '',
        signature_url: '',
        udyam_number: '',
        udyam_verified: 0,
        google_business_url: '',
        google_business_verified: 0,
        show_google_business: 0,
        terms_and_conditions: '',
        terms_and_conditions_sale: '',
        terms_and_conditions_purchase: '',
        bank_name: '',
        account_holder_name: '',
        account_number: '',
        ifsc_code: '',
        whatsapp_number: '',
        whatsapp_channel: 'click_to_chat',
        tac_fetch_mode: 'ask',
      };

      const formDefaults = {
        ...dbDefaults,
        udyam_verified: false,
        google_business_verified: false,
        show_google_business: false,
      };

      const { error } = await supabase
        .from('admin_settings')
        .update({
          ...dbDefaults,
          updated_at: new Date().toISOString()
        } as any)
        .eq('id', settings?.id);

      if (error) throw error;

      setFormData(formDefaults);
      toast.success("Settings reset to defaults!");
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    } catch (error) {
      console.error('Reset settings error:', error);
      toast.error("Failed to reset settings");
    }
  };

  // ---------------- IMEI / TAC database ----------------
  const tacFileInput = useRef<HTMLInputElement>(null);
  const [tacImporting, setTacImporting] = useState(false);
  const [tacReport, setTacReport] = useState<any>(null);

  const { data: tacStats } = useQuery({
    queryKey: ['tac-stats'],
    queryFn: async () => {
      const res = await fetch('/api/tac/stats', { credentials: 'include' });
      if (!res.ok) throw new Error('Could not load TAC stats');
      return res.json();
    },
  });

  const handleTacImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setTacImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/tac/import', { method: 'POST', body: fd, credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Import failed');
      setTacReport(body);
      toast.success(`Import finished: ${body.databaseTotal} TACs in the database`);
      queryClient.invalidateQueries({ queryKey: ['tac-stats'] });
    } catch (err: any) {
      toast.error(err.message || 'Import failed');
    } finally {
      setTacImporting(false);
    }
  };

  const handleTacExport = async () => {
    try {
      const res = await fetch('/api/tac/export', { credentials: 'include' });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PhoneZone_TAC_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.message || 'Export failed');
    }
  };

  // ---------------- Hicelltek API keys (masked, backend-only) -------------
  const [newKey, setNewKey] = useState({ label: '', key: '' });
  const [keyBusy, setKeyBusy] = useState(false);

  const { data: tacKeys, refetch: refetchKeys } = useQuery({
    queryKey: ['tac-keys'],
    queryFn: async () => {
      const res = await fetch('/api/tac/keys', { credentials: 'include' });
      if (!res.ok) throw new Error('Could not load API keys');
      return res.json();
    },
  });

  const keyRequest = async (method: string, url: string, body?: any) => {
    setKeyBusy(true);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Request failed');
      await refetchKeys();
      return data;
    } catch (err: any) {
      toast.error(err.message || 'Request failed');
      throw err;
    } finally {
      setKeyBusy(false);
    }
  };

  const handleAddKey = async () => {
    if (!newKey.key.trim()) {
      toast.error('Paste the Hicelltek API key first');
      return;
    }
    await keyRequest('POST', '/api/tac/keys', { label: newKey.label, key: newKey.key });
    setNewKey({ label: '', key: '' });
    toast.success('API key saved');
  };

  const moveKey = async (index: number, dir: -1 | 1) => {
    const ids = [...(tacKeys || [])].map((k: any) => k.id);
    const swap = index + dir;
    if (swap < 0 || swap >= ids.length) return;
    [ids[index], ids[swap]] = [ids[swap], ids[index]];
    await keyRequest('POST', '/api/tac/keys/reorder', { ids });
  };

  const exportSettings = () => {
    if (!settings) {
      toast.error("No settings to export");
      return;
    }

    const exportData = {
      exported_at: new Date().toISOString(),
      version: "1.0",
      settings: settings
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `phonezone_settings_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success("Settings exported successfully!");
  };

  const importSettings = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const importData = JSON.parse(text);
        
        if (importData.settings) {
          const importedSettings = importData.settings;
          setFormData({
            business_name: importedSettings.business_name || "",
            business_tagline: importedSettings.business_tagline || "",
            owner_name: importedSettings.owner_name || "",
            address: importedSettings.address || "",
            phone_primary: importedSettings.phone_primary || "",
            phone_secondary: importedSettings.phone_secondary || "",
            email: importedSettings.email || "",
            instagram: importedSettings.instagram || "",
            logo_url: importedSettings.logo_url || "",
            signature_url: importedSettings.signature_url || "",
            udyam_number: importedSettings.udyam_number || "",
            udyam_verified: !!importedSettings.udyam_verified,
            google_business_url: importedSettings.google_business_url || "",
            google_business_verified: !!importedSettings.google_business_verified,
            show_google_business: !!importedSettings.show_google_business,
            terms_and_conditions: importedSettings.terms_and_conditions || "",
            terms_and_conditions_sale: importedSettings.terms_and_conditions_sale || "",
            terms_and_conditions_purchase: importedSettings.terms_and_conditions_purchase || "",
            bank_name: importedSettings.bank_name || "",
            account_holder_name: importedSettings.account_holder_name || "",
            account_number: importedSettings.account_number || "",
            ifsc_code: importedSettings.ifsc_code || "",
            whatsapp_number: importedSettings.whatsapp_number || "",
            whatsapp_channel: importedSettings.whatsapp_channel || "click_to_chat",
            tac_fetch_mode: importedSettings.tac_fetch_mode || "ask",
          });
          toast.success("Settings imported successfully! Click Save to apply.");
        } else {
          toast.error("Invalid settings file format");
        }
      } catch (error) {
        console.error('Import error:', error);
        toast.error("Failed to import settings");
      }
    };
    input.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, category: 'logo' | 'signature') => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Offline/EXE build: use the dedicated file endpoint. It stores the image
      // as a PUBLIC admin asset, so invoices and the homepage can render it
      // without a session. Uploading it through the generic bucket made it
      // private, which broke the logo for anonymous visitors.
      if (isOfflineMode()) {
        const fd = new FormData();
        fd.append('category', category);
        fd.append('file', file);
        const res = await fetch('/api/settings/upload', { method: 'POST', body: fd, credentials: 'include' });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Upload failed');
        setFormData(prev => ({ ...prev, [category === 'logo' ? 'logo_url' : 'signature_url']: body.url }));
        toast.success(`${category === 'logo' ? 'Logo' : 'Signature'} uploaded successfully`);
        return;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${category}-${Date.now()}.${fileExt}`;
      const filePath = `admin/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('phonezone-uploads')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('phonezone-uploads')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, [category === 'logo' ? 'logo_url' : 'signature_url']: data.publicUrl }));
      toast.success(`${category === 'logo' ? 'Logo' : 'Signature'} uploaded successfully`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : "Failed to upload file");
    }
  };

  const testEmailSettings = () => {
    const subject = "PhoneZone Test Email";
    const body = `This is a test email from PhoneZone settings.\n\nBusiness: ${formData.business_name}\nTagline: ${formData.business_tagline}\nAddress: ${formData.address}\nPhone: ${formData.phone_primary}\n\nIf you received this, your email settings are working correctly!`;
    
    window.open(`mailto:${formData.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const previewBusinessCard = () => {
    const cardHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>${formData.business_name} - Business Card</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: Arial, sans-serif;
            background: #f0f0f0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        .business-card {
            width: 400px;
            height: 250px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            color: white;
            position: relative;
            overflow: hidden;
        }
        .business-card::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -50%;
            width: 100%;
            height: 100%;
            background: rgba(255,255,255,0.1);
            border-radius: 50%;
        }
        .content {
            position: relative;
            z-index: 2;
        }
        .business-name {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .tagline {
            font-size: 14px;
            opacity: 0.9;
            margin-bottom: 20px;
        }
        .contact-info {
            font-size: 12px;
            line-height: 1.6;
        }
        .contact-info div {
            margin-bottom: 8px;
        }
        .icon {
            display: inline-block;
            width: 16px;
            margin-right: 8px;
        }
    </style>
</head>
<body>
    <div class="business-card">
        <div class="content">
            <div class="business-name">${formData.business_name}</div>
            <div class="tagline">${formData.business_tagline}</div>
            <div class="contact-info">
                <div><span class="icon">📍</span>${formData.address}</div>
                <div><span class="icon">📞</span>${formData.phone_primary}${formData.phone_secondary ? `, ${formData.phone_secondary}` : ''}</div>
                <div><span class="icon">📧</span>${formData.email}</div>
                ${formData.instagram ? `<div><span class="icon">📱</span>${formData.instagram}</div>` : ''}
            </div>
        </div>
    </div>
</body>
</html>`;

    const blob = new Blob([cardHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (isLoading) return <div>Loading settings...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Business Settings</h2>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={exportSettings}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" onClick={importSettings}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" onClick={resetToDefaults}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Business Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Building2 className="h-5 w-5 mr-2" />
              Business Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="business_name">Business Name</Label>
              <Input
                id="business_name"
                placeholder="Enter business name"
                value={formData.business_name}
                onChange={(e) => setFormData({...formData, business_name: e.target.value})}
              />
            </div>

            <div>
              <Label htmlFor="business_tagline">Business Tagline</Label>
              <Input
                id="business_tagline"
                placeholder="Enter business tagline"
                value={formData.business_tagline}
                onChange={(e) => setFormData({...formData, business_tagline: e.target.value})}
              />
            </div>

            <div>
              <Label htmlFor="address">Business Address</Label>
              <Textarea
                id="address"
                placeholder="Enter complete business address"
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Phone className="h-5 w-5 mr-2" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="phone_primary">Primary Phone</Label>
              <Input
                id="phone_primary"
                placeholder="Enter primary phone number"
                value={formData.phone_primary}
                onChange={(e) => setFormData({...formData, phone_primary: e.target.value})}
              />
            </div>

            <div>
              <Label htmlFor="phone_secondary">Secondary Phone</Label>
              <Input
                id="phone_secondary"
                placeholder="Enter secondary phone number"
                value={formData.phone_secondary}
                onChange={(e) => setFormData({...formData, phone_secondary: e.target.value})}
              />
            </div>

            <div>
              <Label htmlFor="email">Business Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter business email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={testEmailSettings}
              >
                <Mail className="h-4 w-4 mr-2" />
                Test Email
              </Button>
            </div>

            <div>
              <Label htmlFor="instagram">Instagram Handle</Label>
              <Input
                id="instagram"
                placeholder="@phonezonestp"
                value={formData.instagram}
                onChange={(e) => setFormData({...formData, instagram: e.target.value})}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Branding & Assets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings2 className="h-5 w-5 mr-2" />
            Branding & Assets
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Business Logo</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'logo')} />
              {formData.logo_url && <span className="text-xs text-green-600">Uploaded</span>}
            </div>
            {formData.logo_url && (
              <div className="mt-2">
                <img src={formData.logo_url} alt="Logo preview" className="h-16 w-auto object-contain border rounded" />
              </div>
            )}
            <p className="text-sm text-gray-600 mt-1">
              Used on homepage, invoices, and everywhere. You can change it anytime.
            </p>
          </div>

          <div>
            <Label>Owner Signature</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'signature')} />
              {formData.signature_url && <span className="text-xs text-green-600">Uploaded</span>}
            </div>
            {formData.signature_url && (
              <div className="mt-2">
                <img src={formData.signature_url} alt="Signature preview" className="h-16 w-auto object-contain border rounded" />
              </div>
            )}
            <p className="text-sm text-gray-600 mt-1">
              Will appear on invoices. You can add or replace it anytime.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Bank Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Landmark className="h-5 w-5 mr-2" />
            Bank Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="bank_name">Bank Name</Label>
            <Input
              id="bank_name"
              placeholder="Enter bank name"
              value={formData.bank_name}
              onChange={(e) => setFormData({...formData, bank_name: e.target.value})}
            />
          </div>
          <div>
            <Label htmlFor="account_holder_name">Account Holder Name</Label>
            <Input
              id="account_holder_name"
              placeholder="Enter account holder name"
              value={formData.account_holder_name}
              onChange={(e) => setFormData({...formData, account_holder_name: e.target.value})}
            />
          </div>
          <div>
            <Label htmlFor="account_number">Account Number</Label>
            <Input
              id="account_number"
              placeholder="Enter account number"
              value={formData.account_number}
              onChange={(e) => setFormData({...formData, account_number: e.target.value})}
            />
          </div>
          <div>
            <Label htmlFor="ifsc_code">IFSC Code</Label>
            <Input
              id="ifsc_code"
              placeholder="Enter IFSC code"
              value={formData.ifsc_code}
              onChange={(e) => setFormData({...formData, ifsc_code: e.target.value})}
            />
          </div>
          <p className="text-sm text-gray-500">
            These details will appear on invoices. Leave blank if you don't want to show bank details.
          </p>
        </CardContent>
      </Card>

      {/* Terms & Conditions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            Terms & Conditions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="terms_and_conditions_sale">Terms & Conditions for Sales</Label>
            <Textarea
              id="terms_and_conditions_sale"
              placeholder="Enter terms and conditions for sales invoices..."
              value={formData.terms_and_conditions_sale}
              onChange={(e) => setFormData({...formData, terms_and_conditions_sale: e.target.value})}
              rows={4}
            />
            <p className="text-sm text-gray-500 mt-1">
              These terms will appear on sales invoices. Leave blank to use default terms.
            </p>
          </div>
          <div>
            <Label htmlFor="terms_and_conditions_purchase">Terms & Conditions for Purchase</Label>
            <Textarea
              id="terms_and_conditions_purchase"
              placeholder="Enter terms and conditions for purchase invoices..."
              value={formData.terms_and_conditions_purchase}
              onChange={(e) => setFormData({...formData, terms_and_conditions_purchase: e.target.value})}
              rows={4}
            />
            <p className="text-sm text-gray-500 mt-1">
              These terms will appear on purchase invoices. Leave blank to use default terms.
            </p>
          </div>
        </CardContent>
      </Card>
      {/* IMEI / TAC Database */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Smartphone className="h-5 w-5 mr-2" />
            IMEI / TAC Database
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span><strong>{tacStats?.total ?? '–'}</strong> TACs stored</span>
            {tacStats?.bySource?.excel ? <span className="text-gray-500">Excel: {tacStats.bySource.excel}</span> : null}
            {tacStats?.bySource?.learned ? <span className="text-gray-500">Learned: {tacStats.bySource.learned}</span> : null}
            {tacStats?.bySource?.api ? <span className="text-gray-500">API: {tacStats.bySource.api}</span> : null}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => tacFileInput.current?.click()} disabled={tacImporting}>
              <Upload className="h-4 w-4 mr-2" />
              {tacImporting ? 'Importing... (takes up to a minute)' : 'Upload tac_full.xlsx'}
            </Button>
            <input
              ref={tacFileInput}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleTacImport}
            />
            <Button variant="outline" onClick={handleTacExport} disabled={tacImporting}>
              <Download className="h-4 w-4 mr-2" />
              Download TAC database (Excel)
            </Button>
          </div>

          {tacReport && (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="p-2">Sheet</th>
                    <th className="p-2">Rows</th>
                    <th className="p-2">Added</th>
                    <th className="p-2">Duplicates</th>
                    <th className="p-2">Skipped</th>
                  </tr>
                </thead>
                <tbody>
                  {tacReport.sheets?.map((s: any) => (
                    <tr key={s.name} className="border-t">
                      <td className="p-2">{s.name}</td>
                      <td className="p-2">{s.dataRows}</td>
                      <td className="p-2">{s.added + (s.updated || 0)}</td>
                      <td className="p-2">{s.duplicates}</td>
                      <td className="p-2">
                        blank {s.skipped.blank} · zero {s.skipped.zero} · test {s.skipped.testImei} · bad {s.skipped.badLength}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="p-2 text-xs text-gray-500 border-t">
                Database now holds {tacReport.databaseTotal} TACs ({(tacReport.durationMs / 1000).toFixed(1)}s)
              </p>
            </div>
          )}

          <div>
            <Label>When a TAC is not found in the database</Label>
            <div className="flex flex-col gap-2 mt-2">
              {[
                ['ask', 'Ask every time (recommended)'],
                ['auto', 'Always auto-fetch from the Hicelltek API'],
                ['off', 'Disabled - never call the API'],
              ].map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="tac_fetch_mode"
                    value={value}
                    checked={formData.tac_fetch_mode === value}
                    onChange={() => setFormData({ ...formData, tac_fetch_mode: value })}
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              The offline database is always checked first. An online fetch costs 1 of your 100 monthly lookups and only
              happens when you allow it here. Save the Settings page to keep this choice.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp Central Channel Control (Fix 4) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-emerald-700">
            <Smartphone className="h-5 w-5 mr-2" />
            WhatsApp Central Control (व्हाट्सएप चैनल एवं सेटिंग्स)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Select the primary delivery channel for sending purchase invoices, sales bills, Sapath Patra, and marketing messages.
          </p>

          <div className="flex flex-col gap-3">
            {[
              {
                value: "click_to_chat",
                label: "Click-to-Chat (wa.me URL) — Recommended for Mobile / APK / Desktop",
                hint: "Direct link to WhatsApp. Works immediately on mobile phones, tablets and PCs with zero server setup. Supports native PDF file sharing on Android.",
              },
              {
                value: "openwa",
                label: "OpenWA Gateway API — Automated Background Dispatch",
                hint: "Sends messages directly in background via the local OpenWA WhatsApp server configured in Marketing tab without manual interaction.",
              },
              {
                value: "chrome_extension",
                label: "PhoneZone Chrome Extension — Local PC Web WhatsApp",
                hint: "Uses the PhoneZone Chrome Extension on this computer to inject and queue messages in WhatsApp Web. Requires running locally on main PC.",
              },
            ].map(({ value, label, hint }) => (
              <label
                key={value}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  formData.whatsapp_channel === value
                    ? "border-emerald-600 bg-emerald-50/50"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  name="whatsapp_channel"
                  value={value}
                  checked={formData.whatsapp_channel === value}
                  onChange={() => setFormData({ ...formData, whatsapp_channel: value })}
                  className="mt-1 h-4 w-4 text-emerald-600"
                />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-900">{label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{hint}</div>
                </div>
              </label>
            ))}
          </div>

          {formData.whatsapp_channel === "click_to_chat" && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
              💡 <strong>Note for Marketing:</strong> With Click-to-Chat selected, bulk marketing requires opening each chat individually. For sending mass promotional messages, Chrome Extension or OpenWA is recommended.
            </div>
          )}

          {formData.whatsapp_channel === "chrome_extension" && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-800">
              ℹ️ <strong>Local PC Requirement:</strong> Chrome Extension feature only operates when hosting and accessing PhoneZone locally from your main desktop PC where the extension is installed.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hicelltek API keys (Step 2/6) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <KeyRound className="h-5 w-5 mr-2" />
            Hicelltek API Keys
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">
            Keys are stored in the local database and only ever used by this computer's backend - they are never sent
            to the browser. The free plan allows 100 lookups per key per month; keys rotate automatically when one
            runs out.
          </p>

          {(tacKeys || []).length === 0 ? (
            <p className="text-sm text-gray-500">No API key yet. Online lookup is disabled until you add one.</p>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="p-2">#</th>
                    <th className="p-2">Label</th>
                    <th className="p-2">Key</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">This month</th>
                    <th className="p-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(tacKeys || []).map((k: any, i: number) => (
                    <tr key={k.id} className="border-t">
                      <td className="p-2 text-gray-500">{i + 1}</td>
                      <td className="p-2">{k.label || <span className="text-gray-400">-</span>}</td>
                      <td className="p-2 font-mono">{k.maskedKey}</td>
                      <td className="p-2">
                        <span
                          className={
                            k.status === 'Active'
                              ? 'text-green-600'
                              : k.status === 'Invalid' || k.status === 'Disabled'
                                ? 'text-red-500'
                                : 'text-amber-600'
                          }
                        >
                          {k.status}
                        </span>
                      </td>
                      <td className="p-2">
                        {k.callsThisMonth} / {k.monthlyLimit}
                      </td>
                      <td className="p-2 text-right whitespace-nowrap">
                        <button
                          type="button"
                          className="px-1 text-gray-500 hover:text-black disabled:opacity-30"
                          title="Move up"
                          disabled={keyBusy || i === 0}
                          onClick={() => moveKey(i, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="px-1 text-gray-500 hover:text-black disabled:opacity-30"
                          title="Move down"
                          disabled={keyBusy || i === (tacKeys || []).length - 1}
                          onClick={() => moveKey(i, 1)}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="px-2 text-blue-600 hover:underline disabled:opacity-30"
                          disabled={keyBusy}
                          onClick={() => keyRequest('PATCH', `/api/tac/keys/${k.id}`, { is_enabled: !k.isEnabled })}
                        >
                          {k.isEnabled ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          className="px-2 text-red-600 hover:underline disabled:opacity-30"
                          disabled={keyBusy}
                          onClick={() => keyRequest('DELETE', `/api/tac/keys/${k.id}`)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-40">
              <Label htmlFor="key_label">Label (optional)</Label>
              <Input
                id="key_label"
                placeholder="e.g. Shop key 1"
                value={newKey.label}
                onChange={(e) => setNewKey({ ...newKey, label: e.target.value })}
              />
            </div>
            <div className="min-w-64 flex-1">
              <Label htmlFor="key_value">API key</Label>
              <Input
                id="key_value"
                type="password"
                placeholder="Paste the Hicelltek API key"
                value={newKey.key}
                onChange={(e) => setNewKey({ ...newKey, key: e.target.value })}
              />
            </div>
            <Button variant="outline" onClick={handleAddKey} disabled={keyBusy || !newKey.key.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Add key
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview & Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            <Button onClick={previewBusinessCard} variant="outline">
              <Eye className="h-4 w-4 mr-2" />
              Preview Business Card
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={isSubmitting}
          className="min-w-32"
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>

      {/* Current Settings Preview */}
      {settings && (
        <Card>
          <CardHeader>
            <CardTitle>Current Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-semibold">Business:</span> {settings.business_name}
              </div>
              <div>
                <span className="font-semibold">Tagline:</span> {settings.business_tagline}
              </div>
              <div>
                <span className="font-semibold">Primary Phone:</span> {settings.phone_primary}
              </div>
              <div>
                <span className="font-semibold">Secondary Phone:</span> {settings.phone_secondary}
              </div>
              <div>
                <span className="font-semibold">Email:</span> {settings.email}
              </div>
              <div>
                <span className="font-semibold">Instagram:</span> {settings.instagram}
              </div>
              <div className="md:col-span-2">
                <span className="font-semibold">Address:</span> {settings.address}
              </div>
              <div className="md:col-span-2">
                <span className="font-semibold">Last Updated:</span> {new Date(settings.updated_at).toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SettingsTab;
