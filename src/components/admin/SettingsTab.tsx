
import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isOfflineMode } from "@/lib/data";
import { compressImage } from "@/utils/imageCompression";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Save, Upload, Download, RefreshCw, Settings2, Building2, Phone, Mail, Instagram, Eye, ShieldCheck, ShieldAlert, Star, Landmark, FileText, Smartphone, KeyRound, Plus, Radio, Play, Square, CheckCircle2, Zap, HelpCircle, Check, AlertCircle, SlidersHorizontal, LayoutTemplate, Cloud, Database } from "lucide-react";
import { toast } from "sonner";
import { EvolutionApiGuideModal } from "./EvolutionApiGuideModal";
import JarvisSettingsCard from "./JarvisSettingsCard";

const SettingsTab = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [masterPassword, setMasterPassword] = useState("");
  const [isResettingSetup, setIsResettingSetup] = useState(false);
  const [showEvolutionGuide, setShowEvolutionGuide] = useState(false);
  const [isTestingEvolution, setIsTestingEvolution] = useState(false);
  const [evolutionTestPhone, setEvolutionTestPhone] = useState("");
  const [evolutionCheckStatus, setEvolutionCheckStatus] = useState<any>(null);
  const [headerLayoutMode, setHeaderLayoutMode] = useState<"scroll" | "condensed">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("phonezone_header_layout_mode") as "scroll" | "condensed") || "scroll";
    }
    return "scroll";
  });

  const handleHeaderModeChange = (mode: "scroll" | "condensed") => {
    setHeaderLayoutMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("phonezone_header_layout_mode", mode);
      window.dispatchEvent(new Event("storage"));
      toast.success(mode === "scroll" ? "Header set to Horizontal Scroll" : "Header set to 3-Line Condensed Menu");
    }
  };
  const [isSyncingSupabase, setIsSyncingSupabase] = useState(false);
  const [isSavingSupabaseCreds, setIsSavingSupabaseCreds] = useState(false);
  const queryClient = useQueryClient();

  const { data: supabaseStatus, refetch: refetchSupabaseStatus } = useQuery({
    queryKey: ['supabase-status'],
    queryFn: async () => {
      const res = await fetch('/api/supabase/status');
      return res.ok ? res.json() : null;
    },
    refetchInterval: 30000,
  });

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

  const { data: serverStatus, refetch: refetchServerStatus } = useQuery({
    queryKey: ['openwa-server-status'],
    queryFn: async () => {
      const res = await fetch('/api/wa/gateway/server-status');
      return res.ok ? res.json() : { running: false, port: 2785 };
    },
    refetchInterval: 5000,
  });

  const { data: salesSession } = useQuery({
    queryKey: ['openwa-session-sales'],
    queryFn: async () => {
      const res = await fetch('/api/wa/gateway/session/sales');
      return res.ok ? res.json() : null;
    },
    refetchInterval: 5000,
  });

  const handleChannelChange = async (value: string) => {
    setFormData((prev) => ({ ...prev, whatsapp_channel: value }));
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp_channel: value }),
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
        toast.success(
          value === "baileys" || value === "openwa"
            ? "WhatsApp Channel saved: Native WhatsApp Gateway (Baileys) active!"
            : "WhatsApp Channel saved: Click-to-Chat active!"
        );
      }
    } catch {
      toast.error("Failed to save WhatsApp channel setting");
    }
  };

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
    evolution_api_url: "",
    evolution_api_key: "",
    evolution_instance_name: "phonezone",
    tac_fetch_mode: "ask",
    supabase_url: "https://rkhzhozrslrfsqlpgjav.supabase.co",
    supabase_anon_key: "",
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
        instagram: (settings.instagram || "").replace(/^@+/, ""),
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
        evolution_api_url: (settings as any).evolution_api_url || "",
        evolution_api_key: (settings as any).evolution_api_key || "",
        evolution_instance_name: (settings as any).evolution_instance_name || "phonezone",
        tac_fetch_mode: settings.tac_fetch_mode || "ask",
        supabase_url: (settings as any).supabase_url || (settings as any).supabaseUrl || "https://rkhzhozrslrfsqlpgjav.supabase.co",
        supabase_anon_key: (settings as any).supabase_anon_key || (settings as any).supabaseAnonKey || "",
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
          evolution_api_url: formData.evolution_api_url,
          evolution_api_key: formData.evolution_api_key,
          evolution_instance_name: formData.evolution_instance_name,
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

  const { data: tacEmbedded } = useQuery({
    queryKey: ['tac-embedded-info'],
    queryFn: async () => {
      const res = await fetch('/api/tac/embedded-info', { credentials: 'include' });
      if (!res.ok) return { exists: false, isEmbeddedAvailable: false };
      return res.json();
    },
  });

  const handleResetEmbeddedTac = async () => {
    if (!confirm('This will reload the built-in default tac_full.xlsx database with ~250,000 phone models. Continue?')) {
      return;
    }
    setTacImporting(true);
    try {
      const res = await fetch('/api/tac/reset-embedded', { method: 'POST', credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to reload embedded TAC');
      setTacReport(body);
      toast.success(`Default TAC database restored: ${body.databaseTotal} models ready!`);
      queryClient.invalidateQueries({ queryKey: ['tac-stats'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to reload embedded TAC');
    } finally {
      setTacImporting(false);
    }
  };

  const handleClearTac = async () => {
    if (!confirm('Warning: This will clear all stored TAC codes from the local database. Auto-fill for phone models from IMEI will stop until models are re-imported. Continue?')) {
      return;
    }
    try {
      const res = await fetch('/api/tac/clear', { method: 'POST', credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to clear TAC database');
      toast.success('TAC database cleared');
      setTacReport(null);
      queryClient.invalidateQueries({ queryKey: ['tac-stats'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to clear TAC');
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
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;
    try {
      const file = await compressImage(rawFile, 250);
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

      {/* Header Top-Bar Navigation Style Controller */}
      <Card className="border border-border/80 bg-card shadow-sm mb-6">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="flex items-center text-base sm:text-lg">
              <SlidersHorizontal className="h-5 w-5 mr-2 text-cyan-500" />
              Header Top-Bar Navigation Style
            </CardTitle>
            <Badge variant="outline" className="border-cyan-500/40 text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-2.5 py-1 text-xs w-fit">
              Current: {headerLayoutMode === "scroll" ? "Horizontal Scroll" : "Condensed 3-Line Menu"}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Choose how top action buttons (License, WhatsApp, Scanner, Password, Phone View) are displayed in the header bar.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => handleHeaderModeChange("scroll")}
              className={`p-4 rounded-xl border text-left transition-all relative ${
                headerLayoutMode === "scroll"
                  ? "border-cyan-500 bg-cyan-500/10 ring-2 ring-cyan-500/30"
                  : "border-border hover:border-slate-400 bg-background/50"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-foreground flex items-center gap-2">
                  <LayoutTemplate className="h-4 w-4 text-cyan-500" />
                  Horizontal Scroll (Default)
                </span>
                {headerLayoutMode === "scroll" && <Check className="h-4 w-4 text-cyan-500" />}
              </div>
              <p className="text-xs text-muted-foreground">
                All tool pills are visible side-by-side with smooth horizontal scrolling. Nothing is clipped or hidden.
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleHeaderModeChange("condensed")}
              className={`p-4 rounded-xl border text-left transition-all relative ${
                headerLayoutMode === "condensed"
                  ? "border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/30"
                  : "border-border hover:border-slate-400 bg-background/50"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-amber-500" />
                  Condensed 3-Line Menu
                </span>
                {headerLayoutMode === "condensed" && <Check className="h-4 w-4 text-amber-500" />}
              </div>
              <p className="text-xs text-muted-foreground">
                Collapses all tool pills into a single clean "Quick Tools" dropdown menu. Keeps top bar minimal.
              </p>
            </button>
          </div>
        </CardContent>
      </Card>

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
              <Label htmlFor="phone_primary">Primary Phone (Calling &amp; Default WhatsApp)</Label>
              <Input
                id="phone_primary"
                placeholder="Enter primary phone number"
                value={formData.phone_primary}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    phone_primary: val,
                    whatsapp_number: (!prev.whatsapp_number || prev.whatsapp_number === prev.phone_primary) ? val : prev.whatsapp_number,
                  }));
                }}
              />
            </div>

            <div>
              <Label htmlFor="whatsapp_number">WhatsApp Number (Click-to-Chat &amp; Inquiries)</Label>
              <Input
                id="whatsapp_number"
                placeholder="e.g. 7275862175 (Defaults to Primary Phone if empty)"
                value={formData.whatsapp_number}
                onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
              />
              <p className="text-[11px] text-gray-500 mt-0.5">Used across all "Chat on WhatsApp" and repair booking buttons on your storefront.</p>
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
              <Label htmlFor="instagram">Instagram Handle (without @)</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-semibold">@</span>
                <Input
                  id="instagram"
                  placeholder="phonezone_stp"
                  className="pl-7"
                  value={formData.instagram}
                  onChange={(e) => setFormData({...formData, instagram: e.target.value.replace(/^@+/, '').trim()})}
                />
              </div>
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
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span><strong>{tacStats?.total ?? '–'}</strong> models in local database</span>
              {tacStats?.bySource?.excel ? <span className="text-gray-500">Excel: {tacStats.bySource.excel}</span> : null}
              {tacStats?.bySource?.learned ? <span className="text-gray-500">Learned: {tacStats.bySource.learned}</span> : null}
              {tacStats?.bySource?.api ? <span className="text-gray-500">API: {tacStats.bySource.api}</span> : null}
            </div>
            {tacEmbedded?.isEmbeddedAvailable && (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-700/50">
                Default Built-in: tac_full.xlsx (~254K models)
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-2.5">
            {tacEmbedded?.isEmbeddedAvailable && (
              <Button
                variant="default"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleResetEmbeddedTac}
                disabled={tacImporting}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {tacImporting ? 'Loading Built-in TAC...' : 'Reload Default Built-in TAC'}
              </Button>
            )}
            <Button variant="outline" onClick={() => tacFileInput.current?.click()} disabled={tacImporting}>
              <Upload className="h-4 w-4 mr-2" />
              {tacImporting ? 'Importing... (takes up to a minute)' : 'Upload Custom tac_full.xlsx'}
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
              Download TAC (Excel)
            </Button>
            <Button
              variant="outline"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              onClick={handleClearTac}
              disabled={tacImporting || !tacStats?.total}
            >
              Clear TAC Database
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

      {/* PhoneZone JARVIS AI Copilot & Vision Settings */}
      <JarvisSettingsCard />

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
                value: "baileys",
                label: "⚡ Native Baileys Engine — In-Process (Render Cloud & Noob-Friendly)",
                hint: "Built directly into PhoneZone! No Chrome, no Docker, no external servers. Just scan QR in Marketing tab to send automated PDF bills & receipts 24/7.",
              },
              {
                value: "baileys",
                label: "Native WhatsApp Gateway (Baileys Engine) — Fast & Zero Browser (Recommended)",
                hint: "In-process direct WhatsApp connection. Sends PDFs & receipts automatically across Render Cloud, Windows Desktop EXE, and Termux.",
              },
              {
                value: "click_to_chat",
                label: "Click-to-Chat (wa.me URL) — Manual WhatsApp App",
                hint: "Direct link to WhatsApp. Opens official WhatsApp app on phone/PC with pre-filled message. Zero server setup required.",
              },
              {
                value: "evolution_api",
                label: "Evolution API / External Server — Cloud Gateway",
                hint: "External Evolution API or WPPConnect instance for remote multi-tenant setups.",
              },
            ].map(({ value, label, hint }) => (
              <label
                key={value}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  formData.whatsapp_channel === value
                    ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 dark:border-emerald-500"
                    : "border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50"
                }`}
              >
                <input
                  type="radio"
                  name="whatsapp_channel"
                  value={value}
                  checked={formData.whatsapp_channel === value}
                  onChange={() => handleChannelChange(value)}
                  className="mt-1 h-4 w-4 text-emerald-600 cursor-pointer"
                />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{label}</div>
                  <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{hint}</div>
                </div>
              </label>
            ))}
          </div>

          {/* EVOLUTION API / WPPCONNECT CONFIGURATION PANEL */}
          {formData.whatsapp_channel === "evolution_api" && (
            <div className="p-4 bg-sky-50/80 dark:bg-sky-950/40 border border-sky-300 dark:border-sky-800 rounded-xl space-y-3.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-bold text-xs text-sky-950 dark:text-sky-100 flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Evolution API / WPPConnect Gateway Configuration
                </span>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setShowEvolutionGuide(true)}
                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1 shadow-xs"
                >
                  <HelpCircle className="h-3.5 w-3.5" /> शुरुआती गाइड (Noob Guide)
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Server URL *
                  </Label>
                  <Input
                    placeholder="https://my-evo.onrender.com"
                    value={formData.evolution_api_url}
                    onChange={(e) => setFormData((p) => ({ ...p, evolution_api_url: e.target.value.trim() }))}
                    className="mt-1 h-8 text-xs font-mono bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                  />
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Your Render/VPS Evolution API URL</p>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    API Key *
                  </Label>
                  <Input
                    type="password"
                    placeholder="e.g. PhoneZone2026MasterKey"
                    value={formData.evolution_api_key}
                    onChange={(e) => setFormData((p) => ({ ...p, evolution_api_key: e.target.value.trim() }))}
                    className="mt-1 h-8 text-xs font-mono bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                  />
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Secret Authentication Key</p>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Instance Name
                  </Label>
                  <Input
                    placeholder="phonezone"
                    value={formData.evolution_instance_name}
                    onChange={(e) => setFormData((p) => ({ ...p, evolution_instance_name: e.target.value.trim() }))}
                    className="mt-1 h-8 text-xs font-mono bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                  />
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Instance identifier (default: phonezone)</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-sky-200 dark:border-sky-800">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isTestingEvolution || !formData.evolution_api_url}
                  className="h-7 text-xs border-sky-300 dark:border-sky-700 font-bold"
                  onClick={async () => {
                    setIsTestingEvolution(true);
                    try {
                      // Attempt backend check or direct check
                      const evoUrl = formData.evolution_api_url.replace(/\/+$/, "");
                      const evoKey = formData.evolution_api_key;
                      const evoInstance = formData.evolution_instance_name || "phonezone";

                      let res;
                      try {
                        res = await fetch(`/api/wa/evolution/status`);
                      } catch {
                        res = await fetch(`${evoUrl}/instance/connectionState/${encodeURIComponent(evoInstance)}`, {
                          headers: { apikey: evoKey },
                        });
                      }
                      const data = await res.json().catch(() => ({}));
                      setEvolutionCheckStatus(data);
                      if (data.connected || data.state === "open" || data?.instance?.state === "open") {
                        toast.success("Evolution API is ONLINE and WhatsApp is Connected!");
                      } else {
                        toast.warning(`Server responded: ${data.state || data.message || "Instance not connected yet. Please scan QR code in Evolution API dashboard."}`);
                      }
                    } catch (err: any) {
                      toast.error(`Connection failed: ${err.message || "Network error"}`);
                    } finally {
                      setIsTestingEvolution(false);
                    }
                  }}
                >
                  {isTestingEvolution ? "Checking Status..." : "Test Connection Status"}
                </Button>

                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Enter phone number to test"
                    value={evolutionTestPhone}
                    onChange={(e) => setEvolutionTestPhone(e.target.value)}
                    className="h-7 w-44 text-xs font-mono bg-white dark:bg-slate-900"
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={!evolutionTestPhone || isTestingEvolution}
                    className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    onClick={async () => {
                      setIsTestingEvolution(true);
                      try {
                        const evoUrl = formData.evolution_api_url.replace(/\/+$/, "");
                        const evoKey = formData.evolution_api_key;
                        const evoInstance = formData.evolution_instance_name || "phonezone";
                        const clean = evolutionTestPhone.replace(/\D/g, "");
                        const recipient = clean.length === 10 ? "91" + clean : clean;

                        let success = false;
                        try {
                          const res = await fetch("/api/wa/evolution/test", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ phone: recipient }),
                          });
                          if (res.ok) success = true;
                        } catch {}

                        if (!success) {
                          // Direct test from client
                          const dRes = await fetch(`${evoUrl}/message/sendText/${encodeURIComponent(evoInstance)}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", apikey: evoKey },
                            body: JSON.stringify({
                              number: recipient,
                              text: "Hello! This is a test message from PhoneZone Store Manager via Evolution API. Your 24/7 gateway is connected and active!",
                            }),
                          });
                          if (dRes.ok) success = true;
                          else {
                            const errBody = await dRes.json().catch(() => ({}));
                            throw new Error(errBody.message || `HTTP ${dRes.status}`);
                          }
                        }

                        toast.success(`Test WhatsApp message sent to ${recipient}!`);
                      } catch (err: any) {
                        toast.error(`Failed to send test: ${err.message}`);
                      } finally {
                        setIsTestingEvolution(false);
                      }
                    }}
                  >
                    Send Test WhatsApp
                  </Button>
                </div>
              </div>

              {evolutionCheckStatus && (
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border text-[11px] font-mono text-slate-700 dark:text-slate-300">
                  Status: <strong>{evolutionCheckStatus.connected ? "CONNECTED (ONLINE)" : (evolutionCheckStatus.state || evolutionCheckStatus.message || "Disconnected")}</strong>
                </div>
              )}
            </div>
          )}

          {(formData.whatsapp_channel === "baileys" || formData.whatsapp_channel === "openwa" || !formData.whatsapp_channel) && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-lg text-xs text-emerald-950 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-semibold flex items-center gap-1.5">
                  <Radio className="h-4 w-4 text-emerald-600" />
                  Native WhatsApp Gateway (Baileys Engine): {serverStatus?.connected ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Connected &amp; Ready
                    </span>
                  ) : (
                    <span className="text-amber-700 font-bold flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-amber-500" /> Disconnected
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="h-6 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => {
                      // Navigate to marketing tab
                      const url = new URL(window.location.href);
                      url.searchParams.set("tab", "marketing");
                      window.history.pushState({}, "", url.toString());
                      window.dispatchEvent(new PopStateEvent("popstate"));
                    }}
                  >
                    Open WhatsApp QR &amp; Pairing
                  </Button>
                </div>
              </div>

              {serverStatus?.connected ? (
                <div className="bg-white border border-emerald-200 p-2.5 rounded-md flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-medium text-emerald-900">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <strong>WhatsApp Linked:</strong> +{serverStatus.phone} {serverStatus.name ? `(${serverStatus.name})` : ""}
                  </span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Ready to Dispatch
                  </span>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 p-2 rounded text-amber-800">
                  ⚠️ WhatsApp not linked yet. Open the <strong>Marketing</strong> tab to scan QR code or enter Pairing Code.
                </div>
              )}

              <p className="text-gray-600 text-[11px]">
                Invoices and bills are dispatched automatically as <strong>BOTH Text Receipt and PDF Document</strong> via this WhatsApp connection!
              </p>
            </div>
          )}

          {formData.whatsapp_channel === "click_to_chat" && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
              💡 <strong>Note for Marketing:</strong> With Click-to-Chat selected, bulk marketing requires opening each chat individually. For sending automated promotional messages &amp; bills, Native WhatsApp Gateway (Baileys) is recommended.
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
      {/* Supabase Cloud Sync Card */}
      <Card className="border-emerald-500/40 bg-gradient-to-br from-emerald-950/20 via-slate-900 to-slate-950 text-white shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-emerald-400 flex items-center gap-2 text-base sm:text-lg">
              <Cloud className="h-5 w-5 text-emerald-400" />
              Supabase Cloud Database & Two-Way Sync
            </CardTitle>
            <Badge className={supabaseStatus?.configured ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"}>
              {supabaseStatus?.configured ? "🟢 Cloud Connected" : "🟡 Not Configured"}
            </Badge>
          </div>
          <p className="text-xs text-slate-300">
            Aapka sara local data (phones, repair jobs, sellers, customers, dealer records) Supabase Cloud PostgreSQL me mirror hota hai. Agar aapne backup restore kiya hai ya cloud tables khali hain, toh neeche &quot;Sync All Data to Supabase Now&quot; dabayein.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
              <span className="text-slate-400 block">Phones</span>
              <span className="text-lg font-bold text-white">{supabaseStatus?.counts?.phones ?? "-"}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
              <span className="text-slate-400 block">Repair Jobs</span>
              <span className="text-lg font-bold text-white">{supabaseStatus?.counts?.repair_jobs ?? "-"}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
              <span className="text-slate-400 block">Sellers</span>
              <span className="text-lg font-bold text-white">{supabaseStatus?.counts?.sellers ?? "-"}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
              <span className="text-slate-400 block">Customers</span>
              <span className="text-lg font-bold text-white">{supabaseStatus?.counts?.customers ?? "-"}</span>
            </div>
          </div>

          {/* Supabase URL & Anon Key Direct Configuration */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <Label className="text-[11px] text-slate-300 font-medium">Supabase Project URL</Label>
                <Input
                  placeholder="https://xyz.supabase.co"
                  value={formData.supabase_url}
                  onChange={(e) => setFormData((prev) => ({ ...prev, supabase_url: e.target.value }))}
                  className="bg-slate-900 border-slate-700 text-white text-xs h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-slate-300 font-medium">Supabase Anon Key (eyJ...)</Label>
                <Input
                  type="password"
                  placeholder="eyJhbGciOi..."
                  value={formData.supabase_anon_key}
                  onChange={(e) => setFormData((prev) => ({ ...prev, supabase_anon_key: e.target.value }))}
                  className="bg-slate-900 border-slate-700 text-white text-xs h-8"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs border-slate-700 text-slate-200 hover:bg-slate-800"
                disabled={isSavingSupabaseCreds}
                onClick={async () => {
                  setIsSavingSupabaseCreds(true);
                  try {
                    const res = await fetch("/api/settings", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        supabase_url: formData.supabase_url,
                        supabase_anon_key: formData.supabase_anon_key,
                      }),
                    });
                    if (!res.ok) throw new Error("Failed to save credentials");
                    toast.success("✅ Supabase credentials saved!");
                    refetchSupabaseStatus();
                    queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
                  } catch (err: any) {
                    toast.error(err.message || "Failed to save Supabase credentials");
                  } finally {
                    setIsSavingSupabaseCreds(false);
                  }
                }}
              >
                {isSavingSupabaseCreds ? "Saving..." : "Save Supabase Credentials"}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <span className="text-[11px] text-slate-400 font-mono">
              Project: {supabaseStatus?.url ? supabaseStatus.url.replace(/^https?:\/\//, '').split('.')[0] : "Local/Env"}
            </span>
            <Button
              type="button"
              disabled={isSyncingSupabase}
              onClick={async () => {
                setIsSyncingSupabase(true);
                try {
                  const res = await fetch("/api/supabase/sync-now", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" }
                  });
                  const json = await res.json();
                  if (!res.ok || !json.ok) {
                    throw new Error(json.error || "Sync failed");
                  }
                  toast.success("✅ Supabase Cloud Sync Completed!", {
                    description: `Pushed ${json.totalPushed || 0} records across all tables into Supabase PostgreSQL.`
                  });
                  refetchSupabaseStatus();
                } catch (err: any) {
                  toast.error("Supabase sync failed: " + err.message);
                } finally {
                  setIsSyncingSupabase(false);
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 text-xs gap-1.5 shadow-md"
            >
              {isSyncingSupabase ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Syncing to Supabase...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4" /> ⚡ Sync All Data to Supabase Now
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* New Company Setup & Onboarding Wizard (Master Admin Password Protected) */}
      <Card className="border-red-500/40 bg-gradient-to-br from-red-950/20 via-slate-900 to-slate-950 text-white shadow-lg">
        <CardHeader>
          <CardTitle className="text-red-400 flex items-center gap-2 text-base sm:text-lg">
            <ShieldAlert className="h-5 w-5 text-red-400" />
            New Store / Company Setup Wizard (Master Admin Password Protected)
          </CardTitle>
          <p className="text-xs text-slate-300">
            Agar aapko ek nayi company ya nayi shop configure karni hai ya initial First-Run Setup Wizard ko dobara chalana hai, to apna Master Admin Password enter karke naya setup shuru kar sakte hain.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-red-950/50 border border-red-800/60 rounded-xl space-y-2 text-xs text-red-200">
            <p className="font-semibold text-red-100 flex items-center gap-1.5">
              <span>⚠️ Important Security Protection:</span>
            </p>
            <p>
              Yeh option sirf authorized store owner / master admin ke liye hai. Master Password verify hone ke baad First Setup Wizard khulega jisme aap Store Name, Tagline, Address, Phone Numbers, Udyam Registration, Bank Details aur Branding Logo naye sire se configure ya update kar sakenge.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs font-semibold text-slate-200">
                Enter Master Admin Password
              </Label>
              <Input
                type="password"
                placeholder="Enter master password to unlock new setup"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                className="bg-slate-900/80 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>

            <Button
              variant="destructive"
              disabled={isResettingSetup || !masterPassword.trim()}
              onClick={async () => {
                if (!masterPassword.trim()) {
                  toast.error("Please enter the Master Admin Password to proceed.");
                  return;
                }
                setIsResettingSetup(true);
                try {
                  const res = await fetch("/api/setup/reset", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ masterPassword }),
                    credentials: "include",
                  });
                  const data = await res.json();
                  if (!res.ok) {
                    throw new Error(data.error || "Password verification failed");
                  }
                  toast.success("Master Admin Password verified! Redirecting to Setup Wizard...");
                  setTimeout(() => {
                    window.location.href = "/setup?force=1&mode=new";
                  }, 600);
                } catch (err: any) {
                  toast.error(err.message || "Failed to verify Master Admin Password");
                } finally {
                  setIsResettingSetup(false);
                }
              }}
              className="w-full font-bold shadow-md h-10 gap-1.5"
            >
              {isResettingSetup ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Verifying...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" /> Start New Company Setup
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Evolution API / WPPConnect Noob Guide Modal */}
      <EvolutionApiGuideModal
        open={showEvolutionGuide}
        onOpenChange={setShowEvolutionGuide}
      />
    </div>
  );
};

export default SettingsTab;
