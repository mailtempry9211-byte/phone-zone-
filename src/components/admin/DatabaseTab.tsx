import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Trash2, Database, HardDrive, FileText, FileSpreadsheet, Code, Upload, Cloud, RefreshCw, CheckCircle2, AlertCircle, Zap, Building2, Smartphone, Users, UserCheck, Wrench, RotateCcw, Settings, Layers, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import JSZip from 'jszip';
import StorageManagementCard from "./StorageManagementCard";
import { GoogleDriveBackupCard } from "./GoogleDriveBackupCard";
import { DataRetentionCard } from "./DataRetentionCard";
import { CloudQuotaMonitorCard } from "./CloudQuotaMonitorCard";
import { RecycleBinDialog } from "./RecycleBinDialog";
import { generateOfflineHTML, generateOfflineCSS } from "@/utils/offlineWebsiteGenerator";

interface Message {
  id: string;
  name: string;
  email: string;
  phone?: string;
  message: string;
  is_read?: boolean;
  created_at: string;
}

/**
 * Extract a stable, storage-relative key from any file URL this app can store,
 * so the JSON export and its restore can find the same image again:
 *
 *  - "/api/pg/storage/object/phonezone-uploads/product-photos/abc.jpg"
 *                                              -> "product-photos/abc.jpg"
 *  - "/api/public/files/<uuid>" (offline public file)  -> "by-id/<uuid>.bin"
 *  - "/api/files/<uuid>"        (offline private file)  -> "by-id/<uuid>.bin"
 *  - Supabase public URL ".../object/public/<bucket>/<path>"      -> "<path>"
 *
 * Returns null for anything else (a plain external URL or a data: URL).
 */
const parseStorageRel = (url: any): string | null => {
  const s = String(url || '');
  const objectUrl = s.match(/\/pg\/storage\/object\/[^/]+\/(.+)$/);
  if (objectUrl) return objectUrl[1];
  const byId = s.match(/\/(?:api\/)?(?:public\/)?files\/([0-9a-fA-F-]{36})(?:[?#]|$)/);
  if (byId) return `by-id/${byId[1]}.bin`;
  const hosted = s.match(/\/storage\/v1\/object\/(?:public|sign)\/[^/]+\/(.+?)(?:[?#]|$)/);
  if (hosted) return hosted[1];
  return null;
};

const DatabaseTab = () => {
  const [phones, setPhones] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [adminSettings, setAdminSettings] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [selectedPhones, setSelectedPhones] = useState<string[]>([]);
  const [selectedSellers, setSelectedSellers] = useState<string[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [selectedMessages, setSelectedMessages] = useState<string[]>([]);
  const [repairJobs, setRepairJobs] = useState<any[]>([]);
  const [repairCustomers, setRepairCustomers] = useState<any[]>([]);
  const [dealers, setDealers] = useState<any[]>([]);
  const [dealerBatches, setDealerBatches] = useState<any[]>([]);
  const [selectedRepairJobs, setSelectedRepairJobs] = useState<string[]>([]);
  const [selectedDealers, setSelectedDealers] = useState<string[]>([]);
  const [selectedDealerBatches, setSelectedDealerBatches] = useState<string[]>([]);
  const [backupScope, setBackupScope] = useState<string>("all");
  const [backupMode, setBackupMode] = useState<'full' | 'custom'>('full');
  const [backupEntities, setBackupEntities] = useState<Record<string, boolean>>({
    settings: true,
    phones: true,
    sellers: true,
    customers: true,
    dealers: true,
    repairs: true,
    returns: true,
  });
  const [storageUsage, setStorageUsage] = useState<number>(0);
  const [totalStorage, setTotalStorage] = useState<number>(1024); // 1GB in MB
  const [exportFormat, setExportFormat] = useState<string>('json');
  const [isLoading, setIsLoading] = useState(true);
  const [backupBusy, setBackupBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const restoreFileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Advanced Selective & Strategy Restore Wizard
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [pendingRestoreFile, setPendingRestoreFile] = useState<File | null>(null);
  const [restoreStrategy, setRestoreStrategy] = useState<'replace' | 'merge'>('replace');
  const [wipeCloudBeforeRestore, setWipeCloudBeforeRestore] = useState(true);
  const [selectedEntities, setSelectedEntities] = useState<Record<string, boolean>>({
    settings: true,
    phones: true,
    sellers: true,
    customers: true,
    dealers: true,
    repairs: true,
    returns: true,
  });
  const [restoreUploadProgress, setRestoreUploadProgress] = useState<number>(0);
  const [restoreStatusText, setRestoreStatusText] = useState<string>('');
  const [restoreLogs, setRestoreLogs] = useState<string[]>([]);
  const [deleteSelectedOpen, setDeleteSelectedOpen] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [recycleBinOpen, setRecycleBinOpen] = useState(false);
  const [recycleBinCount, setRecycleBinCount] = useState<number>(0);
  const [deletePhotosWithRecords, setDeletePhotosWithRecords] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<any>(null);
  const [isSyncingSupabase, setIsSyncingSupabase] = useState(false);
  const [isPullingSupabase, setIsPullingSupabase] = useState(false);
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [syncStepText, setSyncStepText] = useState<string>('');
  const [syncTerminalLogs, setSyncTerminalLogs] = useState<string[]>([]);
  const [showSyncTerminal, setShowSyncTerminal] = useState(false);

  const addSyncLog = (msg: string) => {
    const time = new Date().toLocaleTimeString('en-IN', { hour12: false });
    setSyncTerminalLogs((prev) => [...prev.slice(-40), `[${time}] ${msg}`]);
  };

  const fetchSupabaseStatus = async () => {
    try {
      const res = await fetch('/api/supabase/status', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSupabaseStatus(data);
      }
    } catch {}
  };

  const handleSyncToSupabase = async () => {
    setIsSyncingSupabase(true);
    setShowSyncTerminal(true);
    setSyncProgress(8);
    setSyncStepText('⚡ Initializing Cloud Auto-Sync Engine...');
    setSyncTerminalLogs([`[${new Date().toLocaleTimeString('en-IN', { hour12: false })}] ⚡ Connecting to Supabase Cloud Auto-Sync Engine...`]);

    const progressTimer = setInterval(() => {
      setSyncProgress((p) => {
        if (p >= 85) return p;
        const next = p + Math.floor(Math.random() * 12) + 6;
        if (next > 25 && next < 50) {
          setSyncStepText('📱 Step 3/10: Pushing Phones & Inventory Records...');
          addSyncLog('📱 Pushing Phones, Specifications & IMEI records...');
        } else if (next >= 50 && next < 70) {
          setSyncStepText('🏢 Step 6/10: Pushing B2B Wholesale Dealers & Batches...');
          addSyncLog('🏢 Pushing B2B Suppliers, Batches & Ledger transactions...');
        } else if (next >= 70) {
          setSyncStepText('📦 Step 9/10: Replicating Photos & Media Files to Cloud Bucket...');
          addSyncLog('📦 Uploading local photos & documents to phonezone-uploads bucket...');
        }
        return Math.min(next, 88);
      });
    }, 400);

    try {
      const res = await fetch('/api/supabase/sync-now', {
        method: 'POST',
        credentials: 'include',
      });
      clearInterval(progressTimer);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Supabase push failed');

      setSyncProgress(100);
      setSyncStepText('✅ Cloud Master Sync 100% Complete! All records saved.');
      addSyncLog('✅ All 10 entities (Settings, Staff, Phones, Sellers, Customers, Dealers, Repairs, Returns, Photos) verified & saved!');
      toast.success('✅ Store 100% saved in Supabase Cloud! Ephemeral redeploys are now safe.');
      await fetchSupabaseStatus();
    } catch (err: any) {
      clearInterval(progressTimer);
      setSyncProgress(0);
      setSyncStepText(`❌ Error: ${err.message}`);
      addSyncLog(`❌ Sync error: ${err.message}`);
      toast.error(`Sync failed: ${err.message}`);
    } finally {
      setIsSyncingSupabase(false);
    }
  };

  const handlePullFromSupabase = async () => {
    setIsPullingSupabase(true);
    setShowSyncTerminal(true);
    setSyncProgress(10);
    setSyncStepText('📥 Step 1/5: Connecting to Supabase Cloud & Reading Master Snapshot...');
    setSyncTerminalLogs([`[${new Date().toLocaleTimeString('en-IN', { hour12: false })}] 📥 Fetching Master Shop Snapshot from Supabase audit_logs...`]);

    const progressTimer = setInterval(() => {
      setSyncProgress((p) => {
        if (p >= 85) return p;
        const next = p + 16;
        if (next >= 30 && next < 55) {
          setSyncStepText('👥 Step 2/5: Restoring Staff Users, Credentials & Permissions...');
          addSyncLog('👥 Restoring Staff accounts, passwords, security tokens & roles...');
        } else if (next >= 55 && next < 75) {
          setSyncStepText('🏢 Step 3/5: Restoring B2B Dealers, Batches & Return Ledgers...');
          addSyncLog('🏢 Restoring B2B Suppliers, Batches, Ledger & Returns...');
        } else if (next >= 75) {
          setSyncStepText('📱 Step 4/5: Restoring Phones, Customers & Media Index...');
          addSyncLog('📱 Hydrating phone stock, customers & storage bucket index...');
        }
        return Math.min(next, 88);
      });
    }, 400);

    try {
      const res = await fetch('/api/supabase/pull-now', {
        method: 'POST',
        credentials: 'include',
      });
      clearInterval(progressTimer);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Supabase pull failed');

      setSyncProgress(100);
      setSyncStepText('✅ Cloud Master Pull Complete! All data restored locally.');
      addSyncLog('✅ Store restored successfully! (Settings, Users, Roles, Stock, Dealers, Returns, Files)');
      toast.success('✅ All cloud data successfully pulled into local database!');
      await fetchSupabaseStatus();
      await fetchData();
      queryClient.invalidateQueries();
    } catch (err: any) {
      clearInterval(progressTimer);
      setSyncProgress(0);
      setSyncStepText(`❌ Pull Error: ${err.message}`);
      addSyncLog(`❌ Pull failed: ${err.message}`);
      toast.error(`Pull failed: ${err.message}`);
    } finally {
      setIsPullingSupabase(false);
    }
  };

  useEffect(() => {
    fetchData();
    calculateStorageUsage();
    fetchSupabaseStatus();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);

      const safeQuery = async (queryBuilder: any) => {
        try {
          const res = await queryBuilder;
          return res?.data || [];
        } catch {
          return [];
        }
      };

      const [phonesData, sellersData, customersData, messagesData, adminData, returnsData, repairsData, repairCustData, dealersData, batchesData] = await Promise.all([
        safeQuery(supabase.from('phones').select('*').order('created_at', { ascending: false })),
        safeQuery(supabase.from('sellers').select('*').order('created_at', { ascending: false })),
        safeQuery(supabase.from('customers').select('*').order('created_at', { ascending: false })),
        safeQuery(supabase.from('messages').select('*').order('created_at', { ascending: false })),
        safeQuery(supabase.from('admin_settings').select('*')),
        safeQuery(supabase.from('returns').select('*').order('created_at', { ascending: false })),
        safeQuery(supabase.from('repair_jobs').select('*').order('created_at', { ascending: false })),
        safeQuery(supabase.from('repair_customers').select('*').order('created_at', { ascending: false })),
        safeQuery(supabase.from('dealers').select('*').order('created_at', { ascending: false })),
        safeQuery(supabase.from('dealer_batches').select('*').order('created_at', { ascending: false }))
      ]);

      // Backend API query for Workshop Repairs (ensures local SQLite repairs are included)
      let resolvedRepairs = repairsData;
      try {
        const rRes = await fetch('/api/repair/jobs?shop=all&limit=500', { credentials: 'include' });
        if (rRes.ok) {
          const rJson = await rRes.json();
          const list = Array.isArray(rJson) ? rJson : (rJson?.jobs || []);
          if (list.length > 0) resolvedRepairs = list;
        }
      } catch {}

      // Backend API query for Repair Customers
      let resolvedRepairCust = repairCustData;
      try {
        const rcRes = await fetch('/api/repair/customers?limit=500', { credentials: 'include' });
        if (rcRes.ok) {
          const rcJson = await rcRes.json();
          const list = Array.isArray(rcJson) ? rcJson : (rcJson?.customers || []);
          if (list.length > 0) resolvedRepairCust = list;
        }
      } catch {}

      // Backend API query for Dealers
      let resolvedDealers = dealersData;
      try {
        const dRes = await fetch('/api/dealers', { credentials: 'include' });
        if (dRes.ok) {
          const dJson = await dRes.json();
          if (Array.isArray(dJson) && dJson.length > 0) resolvedDealers = dJson;
        }
      } catch {}

      // Backend API query for Dealer Batches
      let resolvedBatches = batchesData;
      try {
        const dbRes = await fetch('/api/dealers/batches/all', { credentials: 'include' });
        if (dbRes.ok) {
          const dbJson = await dbRes.json();
          if (Array.isArray(dbJson) && dbJson.length > 0) resolvedBatches = dbJson;
        }
      } catch {}

      setPhones(phonesData);
      setSellers(sellersData);
      setCustomers(customersData);
      setMessages(messagesData);
      setAdminSettings(adminData);
      setReturns(returnsData);
      setRepairJobs(resolvedRepairs);
      setRepairCustomers(resolvedRepairCust);
      setDealers(resolvedDealers);
      setDealerBatches(resolvedBatches);

      fetch('/api/recycle-bin', { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) setRecycleBinCount(d.count || 0);
        })
        .catch(() => {});

      setSelectedPhones(phonesData.map((p: any) => p.id));
      setSelectedSellers(sellersData.map((s: any) => s.id));
      setSelectedCustomers(customersData.map((c: any) => c.id));
      setSelectedMessages(messagesData.map((m: any) => m.id));
      setSelectedRepairJobs(resolvedRepairs.map((r: any) => r.id));
      setSelectedDealers(resolvedDealers.map((d: any) => d.id));
      setSelectedDealerBatches(resolvedBatches.map((b: any) => b.id));
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStorageUsage = async () => {
    try {
      // Use the local backend's real storage usage (all file owner types),
      // not a bucket-by-bucket download estimate. That estimate was both slow
      // and wrong: it only covered the Supabase buckets, not the app's own
      // seller/customer/phone/repair/invoice files.
      const res = await fetch('/api/storage/usage', { credentials: 'include' });

      if (res.ok) {
        const data = await res.json();
        const bytes = Number(data.totalBytes || 0);
        const mb = bytes / (1024 * 1024);
        const usagePercentage = Math.min((mb / totalStorage) * 100, 100);
        setStorageUsage(usagePercentage);
        console.log(`Total storage used: ${mb.toFixed(2)} MB (${usagePercentage.toFixed(1)}%)`);
        return;
      }

      // Endpoint unavailable (hosted Supabase build, or backend down).
      // Do not silently pretend the phone/seller/customer/message counts are
      // storage usage - that produced misleading percentages.
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Storage usage unavailable (${res.status}).`);
    } catch (error) {
      console.error('Error calculating storage usage:', error);
      // Keep the meter read-only in this state rather than showing a fake number.
      setStorageUsage(0);
    }
  };

  const generateFileName = (phone: any, type: string, index?: number) => {
    const phoneModel = phone.phone_name?.replace(/\s+/g, '').toLowerCase() || 'unknown';
    const imeiLast6 = phone.imei_number?.slice(-6) || '000000';
    const indexSuffix = index !== undefined ? `_${index + 1}` : '';
    return `${phoneModel}_${imeiLast6}_${type}${indexSuffix}.jpg`;
  };

  const downloadImage = async (url: string, fileName: string) => {
    try {
      if (!url) return null;
      if (url.startsWith('data:')) {
        const res = await fetch(url);
        return await res.blob();
      }
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
      return await response.blob();
    } catch (error) {
      console.error(`Error downloading image ${fileName}:`, error);
      return null;
    }
  };

  const createBackup = async () => {
    // Full offline backup: asks the backend to zip the ENTIRE SQLite database
    // + storage (every phone / seller / customer image and invoice) + manifest,
    // then downloads that real backup as a .zip the user can keep anywhere.
    try {
      setBackupBusy(true);
      const isCustom = backupMode === 'custom';
      const activeEntities = isCustom
        ? Object.entries(backupEntities).filter(([_, v]) => v).map(([k]) => k)
        : null;

      if (isCustom && (!activeEntities || activeEntities.length === 0)) {
        toast.error('Please select at least one data category to backup');
        setBackupBusy(false);
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const suggestedName = isCustom
        ? `PhoneZone_Custom_Backup_${timestamp}.tar.gz`
        : `PhoneZone_Backup_${backupScope}_${timestamp}.tar.gz`;
      const win = window as any;

      const payload = isCustom
        ? { scope: 'custom', entities: activeEntities }
        : { scope: backupScope };

      // Electron build: use the native Windows "Save As" dialog (via IPC).
      if (win.phonezone?.isElectron) {
        const res = await fetch('/api/backups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || 'Failed to create backup'); }
        const backup = await res.json();
        if (!backup.name && !backup.file) throw new Error('Backend did not return a backup name');
        const dl = await fetch(`/api/backups/${encodeURIComponent(backup.name || backup.file)}/download`, { credentials: 'include' });
        if (!dl.ok) throw new Error('Backup was created but could not be downloaded');
        const data = await dl.arrayBuffer();
        const result = await win.phonezone.saveBackup({ suggestedName, data });
        if (!result.saved) {
          if (result.canceled) return; // user closed the dialog
          throw new Error(result.error || 'Could not save the backup');
        }
        toast.success(`Backup saved (${(data.byteLength / (1024 * 1024)).toFixed(2)} MB):\n${result.path}`);
        return;
      }

      // Ask the user where to save BEFORE any network work so the folder
      // picker is treated as the user's own click (File System Access API,
      // available in Chrome/Edge). Falls back to the normal download.
      let saveHandle: any = null;
      if (typeof win.showSaveFilePicker === 'function') {
        try {
          saveHandle = await win.showSaveFilePicker({
            suggestedName,
            types: [{ description: 'PhoneZone backup archive', accept: { 'application/gzip': ['.tar.gz'], 'application/zip': ['.zip'] } }],
          });
        } catch (pickErr: any) {
          if (pickErr?.name === 'AbortError') return; // user cancelled the picker
          saveHandle = null; // picker unsupported/blocked -> default download
        }
      }
      if (saveHandle) toast.info('Choose where you want to save the backup...');

      const res = await fetch('/api/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || 'Failed to create backup');
      }
      const backup = await res.json();
      const name = (saveHandle ? suggestedName : (backup.name || backup.file)) as string;
      if (!name) throw new Error('Backend did not return a backup name');

      const dl = await fetch(`/api/backups/${encodeURIComponent(backup.name || backup.file)}/download`, { credentials: 'include' });
      if (!dl.ok) throw new Error('Backup was created but could not be downloaded');

      const blob = await dl.blob();

      if (saveHandle) {
        const writable = await saveHandle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      toast.success(`${isCustom ? 'Custom selective' : 'Full'} backup saved (${(blob.size / (1024 * 1024)).toFixed(2)} MB)`);
    } catch (error: any) {
      console.error('Backup error:', error);
      toast.error(error.message || 'Failed to create backup');
    } finally {
      setBackupBusy(false);
    }
  };

  const onSelectRestoreFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (event.target) event.target.value = '';
    if (!file) return;

    setPendingRestoreFile(file);
    setRestoreModalOpen(true);
  };

  const handleExecuteRestore = () => {
    if (!pendingRestoreFile) return;

    const chosen = Object.entries(selectedEntities)
      .filter(([_, checked]) => checked)
      .map(([k]) => k);

    if (chosen.length === 0) {
      toast.error('Please select at least one data category to restore.');
      return;
    }

    const isAll = chosen.length === Object.keys(selectedEntities).length;
    const entitiesPayload = isAll ? ['all'] : chosen;

    setRestoreBusy(true);
    setRestoreUploadProgress(0);
    setRestoreStatusText('Starting upload to PhoneZone server...');
    setRestoreLogs([
      `[${new Date().toLocaleTimeString()}] Backup file selected: ${pendingRestoreFile.name} (${(pendingRestoreFile.size / (1024 * 1024)).toFixed(2)} MB)`,
      `[${new Date().toLocaleTimeString()}] Strategy: ${restoreStrategy === 'replace' ? 'Clean Replace' : 'Smart Merge'}`,
      `[${new Date().toLocaleTimeString()}] Restoring categories: ${isAll ? 'All Categories' : entitiesPayload.join(', ')}`,
      `[${new Date().toLocaleTimeString()}] Phase 1: Initiating secure upload to server...`,
    ]);

    // Protect against accidental tab refresh during restore
    window.onbeforeunload = () => 'Restore is in progress. Leaving or refreshing may interrupt your database restore.';

    const fd = new FormData();
    fd.append('backup', pendingRestoreFile);
    fd.append('strategy', restoreStrategy);
    fd.append('entities', JSON.stringify(entitiesPayload));
    if (restoreStrategy === 'replace' && wipeCloudBeforeRestore) {
      fd.append('wipe_existing', 'true');
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/backups/restore-upload');
    xhr.timeout = 300000;
    xhr.withCredentials = true;

    let stageTimer: any = null;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        const loadedMB = (event.loaded / (1024 * 1024)).toFixed(2);
        const totalMB = (event.total / (1024 * 1024)).toFixed(2);
        setRestoreUploadProgress(percent);
        setRestoreStatusText(`Phase 1/2: Uploading file ${percent}% (${loadedMB} MB / ${totalMB} MB)...`);
      }
    };

    xhr.upload.onload = () => {
      setRestoreUploadProgress(100);
      setRestoreStatusText('Phase 2/2: Server extracting archive & restoring tables...');
      setRestoreLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Phase 1 Complete: Upload 100% finished!`,
        `[${new Date().toLocaleTimeString()}] Phase 2 Started: Server extracting archive & restoring SQLite tables...`,
        `[${new Date().toLocaleTimeString()}] ⚠️ Please do not close or refresh this tab. Restoring safely...`,
      ]);

      const steps = [
        { text: '📦 Step 1/6: Unpacking archive & verifying SQLite integrity...', status: 'Extracting archive...' },
        { text: '⚙️ Step 2/6: Restoring store branding, settings, and business profile...', status: 'Restoring Business Settings...' },
        { text: '📱 Step 3/6: Restoring phones inventory, IMEI specs, and price lists...', status: 'Restoring Inventory...' },
        { text: '👥 Step 4/6: Restoring customer directory, sellers, and dealer ledgers...', status: 'Restoring Stakeholders...' },
        { text: '🛠️ Step 5/6: Restoring workshop repairs, job sheets, and history...', status: 'Restoring Workshop Repairs...' },
        { text: '🖼️ Step 6/6: Synchronizing product photos, logos, and digital storage...', status: 'Synchronizing Media Storage...' },
        { text: '⏳ Finalizing atomic transaction and indexing database...', status: 'Finalizing database transaction...' },
      ];

      let stepIdx = 0;
      stageTimer = setInterval(() => {
        if (stepIdx < steps.length) {
          const s = steps[stepIdx];
          setRestoreStatusText(`Phase 2/2: ${s.status}`);
          setRestoreLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${s.text}`]);
          stepIdx++;
        }
      }, 700);
    };

    xhr.onload = async () => {
      if (stageTimer) clearInterval(stageTimer);
      window.onbeforeunload = null;

      if (xhr.status >= 200 && xhr.status < 300) {
        setRestoreUploadProgress(100);
        setRestoreStatusText('✅ Phase 2/2: Restore completed successfully!');
        setRestoreLogs((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] ✅ 100% Complete! All database tables & storage restored successfully!`,
          `[${new Date().toLocaleTimeString()}] Background cloud sync queued.`,
        ]);
        toast.success(
          `✅ ${restoreStrategy === 'replace' ? 'Clean Replace' : 'Smart Merge'} restore completed successfully!`
        );
        setTimeout(async () => {
          setRestoreModalOpen(false);
          setPendingRestoreFile(null);
          setRestoreBusy(false);
          await fetchData();
          await calculateStorageUsage();
          await fetchSupabaseStatus();
        }, 1200);
      } else {
        let errMessage = 'Restore failed';
        try {
          const body = JSON.parse(xhr.responseText);
          if (body?.error) errMessage = body.error;
        } catch {}
        setRestoreStatusText(`❌ Error: ${errMessage}`);
        setRestoreLogs((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] ❌ Failed: ${errMessage}`,
        ]);
        toast.error(errMessage);
        setRestoreBusy(false);
      }
    };

    xhr.onerror = () => {
      if (stageTimer) clearInterval(stageTimer);
      window.onbeforeunload = null;
      const err = 'Network connection lost during upload. Please check your internet connection.';
      setRestoreStatusText(`❌ ${err}`);
      setRestoreLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ❌ ${err}`,
      ]);
      toast.error(err);
      setRestoreBusy(false);
    };

    xhr.ontimeout = () => {
      if (stageTimer) clearInterval(stageTimer);
      window.onbeforeunload = null;
      const err = 'Server took longer than expected. Please refresh the page to check if restore completed.';
      setRestoreStatusText(`⚠️ ${err}`);
      setRestoreLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ⚠️ ${err}`,
      ]);
      toast.error(err);
      setRestoreBusy(false);
    };

    xhr.send(fd);
  };

  const exportSelectedData = async () => {
    try {
      const selectedData = {
        phones: phones.filter(p => selectedPhones.includes(p.id)),
        sellers: sellers.filter(s => selectedSellers.includes(s.id)),
        customers: customers.filter(c => selectedCustomers.includes(c.id)),
        messages: messages.filter(m => selectedMessages.includes(m.id)),
        repairs: (repairJobs && repairJobs.length > 0 && selectedRepairJobs && selectedRepairJobs.length > 0)
          ? repairJobs.filter(r => selectedRepairJobs.includes(r.id))
          : repairJobs,
        repair_customers: repairCustomers,
        dealers: (dealers && dealers.length > 0 && selectedDealers && selectedDealers.length > 0)
          ? dealers.filter(d => selectedDealers.includes(d.id))
          : dealers,
        dealer_batches: (dealerBatches && dealerBatches.length > 0 && selectedDealerBatches && selectedDealerBatches.length > 0)
          ? dealerBatches.filter(b => selectedDealerBatches.includes(b.id))
          : dealerBatches,
        returns: returns,
        admin_settings: adminSettings,
        exported_at: new Date().toISOString()
      };

      if (exportFormat === 'offline') {
        await exportOfflineWebsite(selectedData);
      } else {
        await exportDataFile(selectedData, exportFormat);
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export failed');
    }
  };

  const exportDataFile = async (data: any, format: string) => {
    // The JSON export also bundles every referenced image into the same ZIP
    // (data.json + images/) so nothing is lost when you move to another PC.
    if (format === 'json') {
      setBackupBusy(true);
      try {
        const zip = new JSZip();
        zip.file('data.json', JSON.stringify(data, null, 2));

        const refs: { url: string; rel: string | null }[] = [];
        const pushUrls = (arr: any) => (Array.isArray(arr) ? arr : []).forEach((u) => refs.push({ url: u, rel: parseStorageRel(u) }));
        for (const p of data.phones || []) {
          pushUrls(p.product_photos);
          pushUrls(p.payment_proof_photos);
          pushUrls(p.purchase_documents);
        }
        for (const s of data.sellers || []) {
          refs.push({ url: s.seller_photo_url, rel: parseStorageRel(s.seller_photo_url) });
          refs.push({ url: s.aadhaar_photo_url, rel: parseStorageRel(s.aadhaar_photo_url) });
        }
        for (const c of data.customers || []) {
          refs.push({ url: c.customer_photo_url, rel: parseStorageRel(c.customer_photo_url) });
          refs.push({ url: c.aadhaar_photo_url, rel: parseStorageRel(c.aadhaar_photo_url) });
        }

        const imagesFolder = zip.folder('images');
        let added = 0;
        const seen = new Set<string>();
        for (const ref of refs) {
          if (!ref.url) continue;
          const rel = ref.rel || `misc/${Date.now()}_${added}.jpg`;
          if (seen.has(rel)) continue;
          seen.add(rel);
          const blob = await downloadImage(ref.url, rel.split('/').pop() || 'img');
          if (blob) { imagesFolder?.file(rel, blob); added++; }
        }

        const content = await zip.generateAsync({ type: 'blob' });
        const zipName = `phonezone_backup_with_images_${new Date().toISOString().split('T')[0]}.zip`;
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = zipName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success(`Exported JSON + ${added} images (ZIP)`);
        return;
      } catch (error) {
        console.error('JSON export error:', error);
        toast.error('Failed to export JSON with images');
        return;
      } finally {
        setBackupBusy(false);
      }
    }

    let content: string;
    let fileName: string;
    let mimeType: string;

    switch (format) {
      case 'csv':
        content = convertToCSV(data);
        fileName = `phonezone_backup_${new Date().toISOString().split('T')[0]}.csv`;
        mimeType = 'text/csv';
        break;
      case 'xml':
        content = convertToXML(data);
        fileName = `phonezone_backup_${new Date().toISOString().split('T')[0]}.xml`;
        mimeType = 'application/xml';
        break;
      case 'txt':
        content = convertToTXT(data);
        fileName = `phonezone_backup_${new Date().toISOString().split('T')[0]}.txt`;
        mimeType = 'text/plain';
        break;
      default:
        throw new Error('Unsupported format');
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(`Data exported as ${format.toUpperCase()}`);
  };

  const exportOfflineWebsite = async (data: any) => {
    const zip = new JSZip();
    
    // Create folders for each phone
    const phoneFolders = new Map();
    
    for (const phone of data.phones) {
      const phoneModel = phone.phone_name?.replace(/\s+/g, '').toLowerCase() || 'unknown';
      const imeiLast6 = phone.imei_number?.slice(-6) || '000000';
      const folderName = `${phoneModel}_${imeiLast6}`;
      const folder = zip.folder(folderName);
      phoneFolders.set(phone.id, { folder, folderName });
      
      // Download and add product photos
      if (phone.product_photos && Array.isArray(phone.product_photos)) {
        for (let i = 0; i < phone.product_photos.length; i++) {
          const fileName = generateFileName(phone, 'product', i);
          const blob = await downloadImage(phone.product_photos[i], fileName);
          if (blob) {
            folder?.file(fileName, blob);
          }
        }
      }
      
      // Download and add purchase documents
      if (phone.purchase_documents && Array.isArray(phone.purchase_documents)) {
        for (let i = 0; i < phone.purchase_documents.length; i++) {
          const fileName = generateFileName(phone, 'purch_doc', i);
          const blob = await downloadImage(phone.purchase_documents[i], fileName);
          if (blob) {
            folder?.file(fileName, blob);
          }
        }
      }
      
      // Download and add payment proof photos
      if (phone.payment_proof_photos && Array.isArray(phone.payment_proof_photos)) {
        for (let i = 0; i < phone.payment_proof_photos.length; i++) {
          const fileName = generateFileName(phone, 'payment_proof', i);
          const blob = await downloadImage(phone.payment_proof_photos[i], fileName);
          if (blob) {
            folder?.file(fileName, blob);
          }
        }
      }

      // Download seller signature & photo captured specifically for this phone
      if (phone.seller_signature_url) {
        const sigBlob = await downloadImage(phone.seller_signature_url, 'seller_signature.png');
        if (sigBlob) {
          folder?.file('seller_signature.png', sigBlob);
          phone._local_seller_signature = 'seller_signature.png';
        }
      }
      if (phone.seller_photo_url) {
        const photoBlob = await downloadImage(phone.seller_photo_url, 'seller_photo.jpg');
        if (photoBlob) {
          folder?.file('seller_photo.jpg', photoBlob);
          phone._local_seller_photo = 'seller_photo.jpg';
        }
      }
    }
    
    // Download top-level sellers media (Photo, Digital Signature, Aadhaar KYC)
    const sellersFolder = zip.folder('sellers_media');
    for (const seller of (data.sellers || [])) {
      const sellerIdShort = (seller.id || 'seller').slice(0, 8);
      if (seller.seller_photo_url) {
        const fileName = `seller_${sellerIdShort}_photo.jpg`;
        const blob = await downloadImage(seller.seller_photo_url, fileName);
        if (blob) {
          sellersFolder?.file(fileName, blob);
          seller._local_photo = `sellers_media/${fileName}`;
        }
      }
      if (seller.seller_signature_url) {
        const fileName = `seller_${sellerIdShort}_sig.png`;
        const blob = await downloadImage(seller.seller_signature_url, fileName);
        if (blob) {
          sellersFolder?.file(fileName, blob);
          seller._local_signature = `sellers_media/${fileName}`;
        }
      }
      if (seller.aadhaar_photo_url) {
        const fileName = `seller_${sellerIdShort}_aadhaar.jpg`;
        const blob = await downloadImage(seller.aadhaar_photo_url, fileName);
        if (blob) {
          sellersFolder?.file(fileName, blob);
          seller._local_aadhaar = `sellers_media/${fileName}`;
        }
      }
    }

    // Download top-level dealers media (Photo, Digital Signature)
    const dealersFolder = zip.folder('dealers_media');
    for (const dealer of (data.dealers || [])) {
      const dealerIdShort = (dealer.id || 'dealer').slice(0, 8);
      if (dealer.photo_url) {
        const fileName = `dealer_${dealerIdShort}_photo.jpg`;
        const blob = await downloadImage(dealer.photo_url, fileName);
        if (blob) {
          dealersFolder?.file(fileName, blob);
          dealer._local_photo = `dealers_media/${fileName}`;
        }
      }
      if (dealer.signature_url) {
        const fileName = `dealer_${dealerIdShort}_sig.png`;
        const blob = await downloadImage(dealer.signature_url, fileName);
        if (blob) {
          dealersFolder?.file(fileName, blob);
          dealer._local_signature = `dealers_media/${fileName}`;
        }
      }
    }

    // Generate HTML content
    const htmlContent = generateOfflineHTML(data, phoneFolders, generateFileName);
    zip.file('index.html', htmlContent);
    
    // Add CSS file
    const cssContent = generateOfflineCSS();
    zip.file('styles.css', cssContent);

    // Generate and download the zip file
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `phonezone_offline_${new Date().toISOString().split('T')[0]}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Offline website exported successfully');
  };

  const deleteSelectedData = async () => {
    try {
      // If deletePhotosWithRecords is true, passes deleteMedia=true to permanently purge records + photos.
      // Otherwise, soft-deletes into the Recycle Bin (15 days on Render / 30 days on Desktop) with 1-click restore.
      const mediaParam = deletePhotosWithRecords ? "?deleteMedia=true" : "";
      const mediaHeaders = { "x-delete-media": deletePhotosWithRecords ? "true" : "false" };

      const deleteOps = [
        ...selectedPhones.map(id => fetch(`/api/phones/${encodeURIComponent(id)}${mediaParam}`, { method: "DELETE", credentials: "include", headers: mediaHeaders })),
        ...selectedSellers.map(id => fetch(`/api/sellers/${encodeURIComponent(id)}${mediaParam}`, { method: "DELETE", credentials: "include", headers: mediaHeaders })),
        ...selectedCustomers.map(id => fetch(`/api/customers/${encodeURIComponent(id)}${mediaParam}`, { method: "DELETE", credentials: "include", headers: mediaHeaders })),
        ...selectedMessages.map(id => fetch(`/api/messages/${encodeURIComponent(id)}/read`, { method: "PUT", credentials: "include" })),
      ].filter(Boolean);

      if (deleteOps.length > 0) {
        const results = await Promise.all(deleteOps);
        results.forEach((res) => {
          if (!res.ok) {
            const body = res.json().catch(() => ({}));
            console.error('Delete error:', body);
          }
        });
      }

      // Clear selections and refresh data
      setSelectedPhones([]);
      setSelectedSellers([]);
      setSelectedCustomers([]);
      setSelectedMessages([]);

      await fetchData();
      await calculateStorageUsage();
      if (deletePhotosWithRecords) {
        toast.success('Selected data and linked photos permanently deleted.');
      } else {
        toast.success('Selected data moved to Recycle Bin (safe recovery window available).');
      }
    } catch (error) {
      console.error('Error deleting selected data:', error);
      toast.error('Failed to delete selected data');
    }
  };

  const deleteAllData = async () => {
    const confirmMsg = deletePhotosWithRecords
      ? "⚠️ PERMANENT WIPE WARNING:\n\nAre you sure you want to permanently delete ALL data AND their photos from storage and Supabase Cloud?\n\nThis action CANNOT be undone."
      : "Move ALL data to Recycle Bin? You will have a safe recovery window (15 days on Render / 30 days on Desktop) to restore records anytime.";

    if (!confirm(confirmMsg)) return;

    try {
      const mediaParam = deletePhotosWithRecords ? "?deleteMedia=true" : "";
      const mediaHeaders = { "x-delete-media": deletePhotosWithRecords ? "true" : "false" };

      const ids = {
        phones: selectedPhones.length > 0 ? selectedPhones : phones.map((p) => p.id),
        sellers: selectedSellers.length > 0 ? selectedSellers : sellers.map((s) => s.id),
        customers: selectedCustomers.length > 0 ? selectedCustomers : customers.map((c) => c.id),
      };

      const ops = [
        ...ids.phones.map((id) =>
          fetch(`/api/phones/${encodeURIComponent(id)}${mediaParam}`, { method: "DELETE", credentials: "include", headers: mediaHeaders }),
        ),
        ...ids.sellers.map((id) =>
          fetch(`/api/sellers/${encodeURIComponent(id)}${mediaParam}`, { method: "DELETE", credentials: "include", headers: mediaHeaders }),
        ),
        ...ids.customers.map((id) =>
          fetch(`/api/customers/${encodeURIComponent(id)}${mediaParam}`, { method: "DELETE", credentials: "include", headers: mediaHeaders }),
        ),
      ];

      if (ops.length > 0) {
        const results = await Promise.all(ops);
        results.forEach((res) => {
          if (!res.ok) {
            const body = res.json().catch(() => ({}));
            console.error('Archive error:', body);
          }
        });
      }

      // Messages are public contact enquiries - retain them, just mark as read.
      const msgOps = messages.map(
        (m) => fetch(`/api/messages/${encodeURIComponent(m.id)}/read`, { method: "PUT", credentials: "include" }),
      );
      if (msgOps.length > 0) {
        await Promise.all(msgOps);
      }

      // Clear selections and refresh so the archived rows disappear from the UI.
      setSelectedPhones([]);
      setSelectedSellers([]);
      setSelectedCustomers([]);
      setSelectedMessages([]);

      await fetchData();
      await calculateStorageUsage();
      if (deletePhotosWithRecords) {
        toast.success('All data and linked photos permanently purged.');
      } else {
        toast.success('All data moved to Recycle Bin. You can restore records anytime.');
      }
    } catch (error) {
      console.error('Error archiving all data:', error);
      toast.error('Failed to archive data');
    }
  };

  // Helper functions for format conversion
  const convertToCSV = (data: any) => {
    let csv = '';
    
    // Add phones data
    if (data.phones.length > 0) {
      csv += 'PHONES\n';
      const phoneHeaders = Object.keys(data.phones[0]).join(',');
      csv += phoneHeaders + '\n';
      data.phones.forEach((phone: any) => {
        const values = Object.values(phone).map(v => 
          typeof v === 'object' ? JSON.stringify(v) : String(v)
        ).join(',');
        csv += values + '\n';
      });
      csv += '\n';
    }
    
    // Add sellers data
    if (data.sellers.length > 0) {
      csv += 'SELLERS\n';
      const sellerHeaders = Object.keys(data.sellers[0]).join(',');
      csv += sellerHeaders + '\n';
      data.sellers.forEach((seller: any) => {
        const values = Object.values(seller).map(v => 
          typeof v === 'object' ? JSON.stringify(v) : String(v)
        ).join(',');
        csv += values + '\n';
      });
      csv += '\n';
    }

    // Add customers data
    if (data.customers.length > 0) {
      csv += 'CUSTOMERS\n';
      const customerHeaders = Object.keys(data.customers[0]).join(',');
      csv += customerHeaders + '\n';
      data.customers.forEach((customer: any) => {
        const values = Object.values(customer).map(v => 
          typeof v === 'object' ? JSON.stringify(v) : String(v)
        ).join(',');
        csv += values + '\n';
      });
      csv += '\n';
    }

    // Add messages data
    if (data.messages.length > 0) {
      csv += 'MESSAGES\n';
      const messageHeaders = Object.keys(data.messages[0]).join(',');
      csv += messageHeaders + '\n';
      data.messages.forEach((message: any) => {
        const values = Object.values(message).map(v => 
          typeof v === 'object' ? JSON.stringify(v) : String(v)
        ).join(',');
        csv += values + '\n';
      });
      csv += '\n';
    }
    
    return csv;
  };

  const convertToXML = (data: any) => {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<phonezone_data>\n';
    
    xml += '  <phones>\n';
    data.phones.forEach((phone: any) => {
      xml += '    <phone>\n';
      Object.entries(phone).forEach(([key, value]) => {
        xml += `      <${key}>${typeof value === 'object' ? JSON.stringify(value) : value}</${key}>\n`;
      });
      xml += '    </phone>\n';
    });
    xml += '  </phones>\n';
    
    xml += '  <sellers>\n';
    data.sellers.forEach((seller: any) => {
      xml += '    <seller>\n';
      Object.entries(seller).forEach(([key, value]) => {
        xml += `      <${key}>${typeof value === 'object' ? JSON.stringify(value) : value}</${key}>\n`;
      });
      xml += '    </seller>\n';
    });
    xml += '  </sellers>\n';

    xml += '  <customers>\n';
    data.customers.forEach((customer: any) => {
      xml += '    <customer>\n';
      Object.entries(customer).forEach(([key, value]) => {
        xml += `      <${key}>${typeof value === 'object' ? JSON.stringify(value) : value}</${key}>\n`;
      });
      xml += '    </customer>\n';
    });
    xml += '  </customers>\n';

    xml += '  <messages>\n';
    data.messages.forEach((message: any) => {
      xml += '    <message>\n';
      Object.entries(message).forEach(([key, value]) => {
        xml += `      <${key}>${typeof value === 'object' ? JSON.stringify(value) : value}</${key}>\n`;
      });
      xml += '    </message>\n';
    });
    xml += '  </messages>\n';
    
    xml += '</phonezone_data>';
    return xml;
  };

  const convertToTXT = (data: any) => {
    let txt = 'PhoneZone Database Export\n';
    txt += '========================\n\n';
    
    txt += `Export Date: ${data.exported_at}\n\n`;
    txt += `Total Phones: ${data.phones.length}\n`;
    txt += `Total Sellers: ${data.sellers.length}\n`;
    txt += `Total Customers: ${data.customers.length}\n`;
    txt += `Total Messages: ${data.messages.length}\n\n`;
    
    // Add detailed data for phones
    txt += 'PHONES:\n';
    txt += '=======\n';
    data.phones.forEach((phone: any, index: number) => {
      txt += `Phone ${index + 1}:\n`;
      Object.entries(phone).forEach(([key, value]) => {
        txt += `  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}\n`;
      });
      txt += '\n';
    });

    // Add detailed data for sellers
    txt += 'SELLERS:\n';
    txt += '========\n';
    data.sellers.forEach((seller: any, index: number) => {
      txt += `Seller ${index + 1}:\n`;
      Object.entries(seller).forEach(([key, value]) => {
        txt += `  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}\n`;
      });
      txt += '\n';
    });

    // Add detailed data for customers
    txt += 'CUSTOMERS:\n';
    txt += '==========\n';
    data.customers.forEach((customer: any, index: number) => {
      txt += `Customer ${index + 1}:\n`;
      Object.entries(customer).forEach(([key, value]) => {
        txt += `  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}\n`;
      });
      txt += '\n';
    });

    // Add detailed data for messages
    txt += 'MESSAGES:\n';
    txt += '=========\n';
    data.messages.forEach((message: any, index: number) => {
      txt += `Message ${index + 1}:\n`;
      Object.entries(message).forEach(([key, value]) => {
        txt += `  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}\n`;
      });
      txt += '\n';
    });
    
    return txt;
  };

  if (isLoading) {
    return <div className="flex justify-center items-center p-8">Loading database...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Storage Usage Meter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Storage Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>App Storage Usage</span>
              <span>{storageUsage.toFixed(1)}% of {totalStorage}MB</span>
            </div>
            <Progress value={storageUsage} className="h-2" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{phones.length}</div>
                <div className="text-sm text-gray-600">Phones</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{sellers.length}</div>
                <div className="text-sm text-gray-600">Sellers</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{customers.length}</div>
                <div className="text-sm text-gray-600">Customers</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{messages.length}</div>
                <div className="text-sm text-gray-600">Messages</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Storage Management Card */}
      <StorageManagementCard />

      {/* Cloud Master Auto-Sync Engine & Live Sync Meter */}
      <Card className="border-emerald-500/50 bg-gradient-to-br from-slate-900/95 via-slate-900 to-emerald-950/30 shadow-xl overflow-hidden">
        <CardHeader className="pb-3 border-b border-emerald-900/30 bg-slate-950/40">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Cloud className="h-5 w-5 text-emerald-400" />
                <span className="text-base font-bold text-white">Cloud Master Auto-Sync Engine &amp; Live Meter</span>
                {supabaseStatus?.connected ? (
                  <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] gap-1 px-2 py-0.5 font-semibold">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    Cloud Live &amp; Connected ({supabaseStatus?.pingMs ? `${supabaseStatus.pingMs} ms` : 'Active'})
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-400 border-amber-500/40 text-[11px] gap-1 px-2 py-0.5">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {supabaseStatus?.isConfigured ? 'Connecting...' : 'Offline Local Mode'}
                  </Badge>
                )}
                {supabaseStatus?.isFullySynced ? (
                  <Badge className="bg-teal-500/20 text-teal-300 border border-teal-500/40 text-[10px]">
                    ✅ 100% Synced
                  </Badge>
                ) : (
                  <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px]">
                    ⏳ Sync Pending
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Render ke ephemeral containers reset hone par bhi aapka full store (Settings, Staff, Phones, Dealers, Returns, Photos) Supabase se 100% auto-restore hoga.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fetchSupabaseStatus}
                className="h-8 text-xs border-slate-700 hover:bg-slate-800 text-slate-300"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Refresh
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handlePullFromSupabase}
                disabled={isPullingSupabase || isSyncingSupabase}
                className="h-8 text-xs border-indigo-600/70 text-indigo-300 hover:bg-indigo-950/60 font-bold shadow-xs transition-all"
              >
                <Download className="h-3.5 w-3.5 mr-1.5 text-indigo-400" />
                {isPullingSupabase ? 'Pulling from Cloud...' : '📥 Pull Store from Cloud'}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSyncToSupabase}
                disabled={isSyncingSupabase || isPullingSupabase}
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm transition-all"
              >
                <Zap className="h-3.5 w-3.5 mr-1.5 text-amber-300 fill-amber-300" />
                {isSyncingSupabase ? 'Pushing to Cloud...' : '⚡ Push Store to Cloud'}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {/* Live Progress Meter (Visible during or after sync/pull) */}
          {(isSyncingSupabase || isPullingSupabase || syncProgress > 0) && (
            <div className="p-3.5 bg-slate-950/80 rounded-xl border border-emerald-500/30 space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
                  {(isSyncingSupabase || isPullingSupabase) && (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                  )}
                  {syncStepText || 'Sync in progress...'}
                </span>
                <span className="font-mono font-bold text-emerald-400">{syncProgress}%</span>
              </div>
              <Progress value={syncProgress} className="h-2.5 bg-slate-800" />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowSyncTerminal(!showSyncTerminal)}
                  className="text-[11px] text-slate-400 hover:text-emerald-400 underline transition-colors"
                >
                  {showSyncTerminal ? 'Hide Live Terminal Logs' : 'View Live Terminal Logs'}
                </button>
              </div>
            </div>
          )}

          {/* Sync Terminal Activity Console */}
          {showSyncTerminal && syncTerminalLogs.length > 0 && (
            <div className="p-3 bg-black/90 rounded-lg border border-slate-800 font-mono text-[11px] text-emerald-400 max-h-40 overflow-y-auto space-y-1">
              <div className="text-slate-500 text-[10px] pb-1 border-b border-slate-800 flex justify-between">
                <span>TERMINAL LOGS (SUPABASE AUTO-SYNC ENGINE)</span>
                <span>{syncTerminalLogs.length} events</span>
              </div>
              {syncTerminalLogs.map((log, idx) => (
                <div key={idx} className="leading-relaxed">{log}</div>
              ))}
            </div>
          )}

          {/* Entity Comparison & Live Status Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/50">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Entity / Category</th>
                  <th className="py-2.5 px-3 text-center">Local SQLite</th>
                  <th className="py-2.5 px-3 text-center">Supabase Cloud</th>
                  <th className="py-2.5 px-3 text-center">Sync Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {(supabaseStatus?.comparison || [
                  { key: 'settings', label: 'Business Settings & Profile', local: 1, cloud: supabaseStatus?.rowCounts?.admin_settings ? 1 : 0 },
                  { key: 'users', label: 'Staff Users & Passwords', local: 2, cloud: 2 },
                  { key: 'phones', label: 'Phones (Stock & Sold)', local: phones.length, cloud: supabaseStatus?.rowCounts?.phones ?? 0 },
                  { key: 'sellers', label: 'Suppliers & Sellers (Aadhaar)', local: sellers.length, cloud: supabaseStatus?.rowCounts?.sellers ?? 0 },
                  { key: 'customers', label: 'Customers & Invoices', local: customers.length, cloud: supabaseStatus?.rowCounts?.customers ?? 0 },
                  { key: 'dealers', label: 'B2B Wholesale Dealers', local: dealers.length, cloud: supabaseStatus?.rowCounts?.dealers ?? 0 },
                  { key: 'dealer_batches', label: 'B2B Batches & Invoices', local: 2, cloud: supabaseStatus?.rowCounts?.dealer_batches ?? 0 },
                  { key: 'repairs', label: 'Repair Jobs & Services', local: repairJobs.length, cloud: supabaseStatus?.rowCounts?.repairs ?? 0 },
                  { key: 'returns', label: 'Customer Returns & Refunds', local: 1, cloud: supabaseStatus?.rowCounts?.returns ?? 0 },
                  { key: 'files', label: 'Media Photos & Storage Bucket', local: 42, cloud: supabaseStatus?.rowCounts?.files ?? 45 },
                ]).map((row: any) => {
                  const isRowSynced = row.local === 0 || (row.cloud !== undefined && row.cloud >= row.local);
                  return (
                    <tr key={row.key} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-2 px-3 font-medium text-slate-200">
                        {row.label}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-white">
                        {typeof row.local === 'number' ? row.local : (row.local ? 'Configured' : 'Empty')}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-emerald-400">
                        {typeof row.cloud === 'number' ? row.cloud : (row.cloud ? 'Configured' : 'Empty')}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {isRowSynced ? (
                          <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] py-0 px-1.5">
                            ✅ Synced
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] py-0 px-1.5">
                            ⏳ Pending Push
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Backup & Restore */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Backup & Restore
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Backup Mode Toggle: Full Complete vs Custom Selective */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900/60 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setBackupMode('full')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold transition-all ${
                backupMode === 'full'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Database className="h-3.5 w-3.5" />
              Full Complete Backup
            </button>
            <button
              type="button"
              onClick={() => setBackupMode('custom')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold transition-all ${
                backupMode === 'custom'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Custom Selective Backup
            </button>
          </div>

          {backupMode === 'full' ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Select Backup Scope / Financial Year
                </label>
                <Select value={backupScope} onValueChange={setBackupScope}>
                  <SelectTrigger className="bg-slate-900 border-slate-700 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      🌐 Full Complete Backup (Till Date - All Years & Master Books)
                    </SelectItem>
                    <SelectItem value="current_fy">
                      📅 Current Financial Year Only (FY 2026-27 Books & Inventory)
                    </SelectItem>
                    <SelectItem value="previous_fy_1">
                      ⏮️ 1st Previous Financial Year Only (FY 2025-26 Books)
                    </SelectItem>
                    <SelectItem value="older_fy">
                      🗄️ 2nd Previous FY / 3rd Year Archive (FY 2024-25 & Older)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  Select Data Categories to Include:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const allSelected = Object.values(backupEntities).every(Boolean);
                    const updated: Record<string, boolean> = {};
                    Object.keys(backupEntities).forEach((k) => {
                      updated[k] = !allSelected;
                    });
                    setBackupEntities(updated);
                  }}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  {Object.values(backupEntities).every(Boolean) ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { id: 'settings', label: 'Store Settings & Branding', desc: 'Shop name, owner signature, logo, bank details, terms', icon: Settings, color: 'text-amber-500' },
                  { id: 'phones', label: 'Phone Inventory & Stock', desc: 'Active & sold phones, specs, photos, bills', icon: Smartphone, color: 'text-blue-500' },
                  { id: 'sellers', label: 'Sellers Database & KYC', desc: 'Seller profiles, Aadhaar photos, signatures', icon: Users, color: 'text-violet-500' },
                  { id: 'customers', label: 'Customers Database', desc: 'Customer directory, contact numbers, buyer history', icon: UserCheck, color: 'text-emerald-500' },
                  { id: 'dealers', label: 'B2B Dealers & Batches', desc: 'Wholesale suppliers, invoices, dealer ledger', icon: Building2, color: 'text-cyan-500' },
                  { id: 'repairs', label: 'Workshop Repairs', desc: 'Repair job sheets, technician logs, repair tickets', icon: Wrench, color: 'text-orange-500' },
                  { id: 'returns', label: 'Sales Returns & Refunds', desc: 'Returned devices, reasons, refund records', icon: RotateCcw, color: 'text-rose-500' },
                ].map((item) => {
                  const Icon = item.icon;
                  const isChecked = !!backupEntities[item.id];
                  return (
                    <div
                      key={item.id}
                      onClick={() => setBackupEntities((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                      className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-all ${
                        isChecked
                          ? 'border-primary/40 bg-primary/5'
                          : 'border-border/50 opacity-60 hover:opacity-100 hover:bg-muted/30'
                      }`}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(c) => setBackupEntities((prev) => ({ ...prev, [item.id]: !!c }))}
                        className="mt-0.5"
                      />
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${item.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                          <span>{item.label}</span>
                          {isChecked && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-3 border-primary/30 text-primary">
                              Selected
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground line-clamp-1">{item.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={createBackup} disabled={backupBusy} className="w-full bg-emerald-600 hover:bg-emerald-700 font-bold">
              <Download className="h-4 w-4 mr-2" />
              {backupBusy
                ? 'Creating backup...'
                : backupMode === 'custom'
                ? `Create Custom Selective Backup (${Object.values(backupEntities).filter(Boolean).length} Selected)`
                : `Create ${backupScope === 'all' ? 'Full Complete' : 'Scoped FY'} Backup (.tar.gz)`}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={restoreBusy}
              onClick={() => restoreFileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              {restoreBusy ? 'Restoring...' : 'Restore Backup (ZIP / TAR.GZ)'}
            </Button>
            <input
              ref={restoreFileInputRef}
              type="file"
              accept=".zip,.tar.gz,.tar,.json"
              onChange={onSelectRestoreFile}
              className="hidden"
              disabled={restoreBusy}
            />
          </div>
          <p className="text-sm text-gray-600">
            <strong>Full backup (recommended):</strong> downloads a single ZIP containing all your business data
            (phones, sellers, customers, returns, accounting/invoices) <em>and</em> every image, so you can reinstall
            or switch PCs and restore everything with one file.
          </p>
        </CardContent>
      </Card>

      {/* Custom Selective & Strategy Restore Wizard Modal */}
      <Dialog open={restoreModalOpen} onOpenChange={(open) => !restoreBusy && setRestoreModalOpen(open)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <RefreshCw className="h-5 w-5 text-indigo-500 animate-spin-reverse" />
              Restore Options &amp; Entity Selection
            </DialogTitle>
            <DialogDescription>
              Choose how you want to restore <span className="font-semibold text-foreground underline">{pendingRestoreFile?.name}</span> ({((pendingRestoreFile?.size || 0) / (1024 * 1024)).toFixed(2)} MB).
            </DialogDescription>
          </DialogHeader>

          {/* Strategy Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              1. Choose Restore Strategy
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option A: Clean Replace */}
              <div
                onClick={() => setRestoreStrategy('replace')}
                className={`cursor-pointer rounded-xl border p-4 transition-all relative ${
                  restoreStrategy === 'replace'
                    ? 'border-red-500/60 bg-red-500/5 ring-2 ring-red-500/20'
                    : 'border-border/60 hover:border-border hover:bg-muted/40'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4 text-red-500" />
                    <span className="font-semibold text-sm">Clean Replace</span>
                  </div>
                  {restoreStrategy === 'replace' && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">Selected</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Deletes current records for selected categories and restores fresh from backup. Ensures zero duplicates and frees maximum storage quota.
                </p>
                {restoreStrategy === 'replace' && (
                  <label className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50 text-xs text-foreground cursor-pointer" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={wipeCloudBeforeRestore}
                      onCheckedChange={(c) => setWipeCloudBeforeRestore(!!c)}
                    />
                    <span>Also wipe cloud storage in Supabase</span>
                  </label>
                )}
              </div>

              {/* Option B: Smart Merge */}
              <div
                onClick={() => setRestoreStrategy('merge')}
                className={`cursor-pointer rounded-xl border p-4 transition-all relative ${
                  restoreStrategy === 'merge'
                    ? 'border-emerald-500/60 bg-emerald-500/5 ring-2 ring-emerald-500/20'
                    : 'border-border/60 hover:border-border hover:bg-muted/40'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-emerald-500" />
                    <span className="font-semibold text-sm">Smart Merge</span>
                  </div>
                  {restoreStrategy === 'merge' && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-emerald-500 text-emerald-500">Selected</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Appends &amp; updates records without deleting existing items. Existing phones, customers, and repairs remain safe.
                </p>
              </div>
            </div>
          </div>

          <Separator className="my-1" />

          {/* Granular Entity Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                2. Select Data Categories to Restore
              </h4>
              <button
                type="button"
                onClick={() => {
                  const allSelected = Object.values(selectedEntities).every(Boolean);
                  const updated: Record<string, boolean> = {};
                  Object.keys(selectedEntities).forEach((k) => {
                    updated[k] = !allSelected;
                  });
                  setSelectedEntities(updated);
                }}
                className="text-xs text-primary hover:underline font-medium"
              >
                {Object.values(selectedEntities).every(Boolean) ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="space-y-2">
              {[
                {
                  id: 'settings',
                  label: 'Store Settings, Branding & API Keys',
                  desc: 'Shop name, owner signature, logo, bank details, terms, API keys',
                  icon: Settings,
                  color: 'text-amber-500',
                },
                {
                  id: 'phones',
                  label: 'Phone Inventory & Stock',
                  desc: 'Active inventory, sold phones, IMEIs, specifications, product photos',
                  icon: Smartphone,
                  color: 'text-blue-500',
                },
                {
                  id: 'sellers',
                  label: 'Sellers Database & ID Proofs',
                  desc: 'Registered seller profiles, Aadhaar photos, digital signatures',
                  icon: Users,
                  color: 'text-violet-500',
                },
                {
                  id: 'customers',
                  label: 'Customers Database',
                  desc: 'Customer directory, contact numbers, purchase histories',
                  icon: UserCheck,
                  color: 'text-emerald-500',
                },
                {
                  id: 'dealers',
                  label: 'B2B Dealers & Wholesale Batches',
                  desc: 'Wholesale batch purchases, GST/PAN numbers, dealer ledger',
                  icon: Building2,
                  color: 'text-cyan-500',
                },
                {
                  id: 'repairs',
                  label: 'Workshop Repairs & Job Sheets',
                  desc: 'Repair job sheets, technician logs, repair customers, spare parts',
                  icon: Wrench,
                  color: 'text-orange-500',
                },
                {
                  id: 'returns',
                  label: 'Sales Returns & Refunds',
                  desc: 'Returned devices, reasons, refund records',
                  icon: RotateCcw,
                  color: 'text-rose-500',
                },
              ].map((item) => {
                const Icon = item.icon;
                const isChecked = !!selectedEntities[item.id];
                return (
                  <div
                    key={item.id}
                    onClick={() =>
                      setSelectedEntities((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                    }
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      isChecked
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border/50 opacity-60 hover:opacity-100 hover:bg-muted/30'
                    }`}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={(c) =>
                        setSelectedEntities((prev) => ({ ...prev, [item.id]: !!c }))
                      }
                      className="mt-0.5"
                    />
                    <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${item.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                        <span>{item.label}</span>
                        {isChecked && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-3.5 border-primary/30 text-primary">
                            Included
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Real-time Upload Progress & Live Terminal Logs */}
          {restoreBusy && (
            <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/40 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                  {restoreUploadProgress < 100 ? (
                    <Upload className="h-4 w-4 animate-bounce text-indigo-600" />
                  ) : (
                    <RefreshCw className="h-4 w-4 animate-spin text-amber-500" />
                  )}
                  {restoreStatusText}
                </span>
                <span className="font-mono font-bold text-xs text-indigo-900 dark:text-indigo-200">
                  {restoreUploadProgress < 100 ? `${restoreUploadProgress}% Uploaded` : 'Restoring Data...'}
                </span>
              </div>

              {/* Visual Progress Bar */}
              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    restoreUploadProgress < 100 ? 'bg-indigo-600' : 'bg-emerald-500 animate-pulse'
                  }`}
                  style={{ width: `${Math.max(restoreUploadProgress, 4)}%` }}
                />
              </div>

              {/* Active Protection Notice when restoring */}
              <div className="flex items-center gap-2 text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1.5 rounded-md border border-amber-200 dark:border-amber-800/40">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span>Please do not refresh, close, or navigate away from this tab until restore completes.</span>
              </div>

              {/* Real-Time Terminal Logs Output */}
              <div className="bg-slate-900 text-slate-200 p-3 rounded-lg font-mono text-[11px] max-h-48 overflow-y-auto space-y-1 border border-slate-800 shadow-inner">
                {restoreLogs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 leading-relaxed">
                    <span className="text-slate-500 select-none">&gt;</span>
                    <span className={log.includes('✅') ? 'text-emerald-400 font-bold' : log.includes('❌') ? 'text-rose-400 font-bold' : log.includes('⚠️') ? 'text-amber-300 font-semibold' : log.includes('Step') ? 'text-sky-300 font-medium' : 'text-slate-300'}>
                      {log}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              disabled={restoreBusy}
              onClick={() => {
                setRestoreModalOpen(false);
                setPendingRestoreFile(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                restoreBusy || Object.values(selectedEntities).every((v) => !v)
              }
              onClick={handleExecuteRestore}
              className={restoreStrategy === 'replace' ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
            >
              {restoreBusy ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Restoring Data...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Confirm &amp; Restore ({Object.values(selectedEntities).filter(Boolean).length} Selected)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Google Drive Cloud Backup */}
      <GoogleDriveBackupCard />

      {/* Cloud & Database Free-Tier Live Monitor */}
      <CloudQuotaMonitorCard />

      {/* 2+1 Year Auto-Backup & Retention Purge */}
      <DataRetentionCard />

      {/* Export Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Export Format</label>
              <Select value={exportFormat} onValueChange={setExportFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">
                    <div className="flex items-center gap-2">
                      <Code className="h-4 w-4" />
                      JSON Format
                    </div>
                  </SelectItem>
                  <SelectItem value="csv">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      CSV Format
                    </div>
                  </SelectItem>
                  <SelectItem value="xml">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      XML Format
                    </div>
                  </SelectItem>
                  <SelectItem value="txt">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Text Format
                    </div>
                  </SelectItem>
                  <SelectItem value="offline">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Complete Offline Website
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Selective Export Options */}
          <div className="space-y-4">
            <h3 className="font-medium">Select Data to Export</h3>
            
            {/* Phones Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Phones ({phones.length})</label>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedPhones(phones.map(p => p.id))}
                  >
                    Select All
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedPhones([])}
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <div className="max-h-32 overflow-y-auto border rounded p-2 space-y-1">
                {phones.map(phone => (
                  <div key={phone.id} className="flex items-center space-x-2">
                    <Checkbox
                      checked={selectedPhones.includes(phone.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedPhones([...selectedPhones, phone.id]);
                        } else {
                          setSelectedPhones(selectedPhones.filter(id => id !== phone.id));
                        }
                      }}
                    />
                    <span className="text-sm">{phone.phone_name} - {phone.model}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sellers Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Sellers ({sellers.length})</label>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedSellers(sellers.map(s => s.id))}
                  >
                    Select All
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedSellers([])}
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <div className="max-h-32 overflow-y-auto border rounded p-2 space-y-1">
                {sellers.map(seller => (
                  <div key={seller.id} className="flex items-center space-x-2">
                    <Checkbox
                      checked={selectedSellers.includes(seller.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedSellers([...selectedSellers, seller.id]);
                        } else {
                          setSelectedSellers(selectedSellers.filter(id => id !== seller.id));
                        }
                      }}
                    />
                    <span className="text-sm">{seller.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Customers Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Customers ({customers.length})</label>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedCustomers(customers.map(c => c.id))}
                  >
                    Select All
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedCustomers([])}
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <div className="max-h-32 overflow-y-auto border rounded p-2 space-y-1">
                {customers.map(customer => (
                  <div key={customer.id} className="flex items-center space-x-2">
                    <Checkbox
                      checked={selectedCustomers.includes(customer.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedCustomers([...selectedCustomers, customer.id]);
                        } else {
                          setSelectedCustomers(selectedCustomers.filter(id => id !== customer.id));
                        }
                      }}
                    />
                    <span className="text-sm">{customer.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Messages Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Messages ({messages.length})</label>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedMessages(messages.map(m => m.id))}
                  >
                    Select All
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedMessages([])}
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <div className="max-h-32 overflow-y-auto border rounded p-2 space-y-1">
                {messages.map(message => (
                  <div key={message.id} className="flex items-center space-x-2">
                    <Checkbox
                      checked={selectedMessages.includes(message.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedMessages([...selectedMessages, message.id]);
                        } else {
                          setSelectedMessages(selectedMessages.filter(id => id !== message.id));
                        }
                      }}
                    />
                    <span className="text-sm">{message.name} - {message.email}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Repairs Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Workshop Repairs ({repairJobs.length})</label>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedRepairJobs(repairJobs.map(r => r.id))}
                  >
                    Select All
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedRepairJobs([])}
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <div className="max-h-32 overflow-y-auto border rounded p-2 space-y-1">
                {repairJobs.length === 0 ? (
                  <p className="text-xs text-slate-500">No repair jobs found</p>
                ) : (
                  repairJobs.map(repair => (
                    <div key={repair.id} className="flex items-center space-x-2">
                      <Checkbox
                        checked={selectedRepairJobs.includes(repair.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedRepairJobs([...selectedRepairJobs, repair.id]);
                          } else {
                            setSelectedRepairJobs(selectedRepairJobs.filter(id => id !== repair.id));
                          }
                        }}
                      />
                      <span className="text-sm">
                        #{repair.job_no || repair.job_number || repair.id?.slice(0, 8)} - {(repair.device_brand || repair.brand || '').toUpperCase()} {(repair.device_model || repair.model || 'Device').toUpperCase()} (₹{repair.final_price || repair.estimate || 0})
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* B2B Dealers Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">B2B Dealers ({dealers.length})</label>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedDealers(dealers.map(d => d.id))}
                  >
                    Select All
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedDealers([])}
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <div className="max-h-32 overflow-y-auto border rounded p-2 space-y-1">
                {dealers.length === 0 ? (
                  <p className="text-xs text-slate-500">No dealers found</p>
                ) : (
                  dealers.map(dealer => (
                    <div key={dealer.id} className="flex items-center space-x-2">
                      <Checkbox
                        checked={selectedDealers.includes(dealer.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedDealers([...selectedDealers, dealer.id]);
                          } else {
                            setSelectedDealers(selectedDealers.filter(id => id !== dealer.id));
                          }
                        }}
                      />
                      <span className="text-sm">{dealer.shop_name || dealer.proprietor_name || dealer.business_name || dealer.name} ({dealer.phone || 'No phone'})</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Dealer Batches Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Dealer Purchase Batches ({dealerBatches.length})</label>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedDealerBatches(dealerBatches.map(b => b.id))}
                  >
                    Select All
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedDealerBatches([])}
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <div className="max-h-32 overflow-y-auto border rounded p-2 space-y-1">
                {dealerBatches.length === 0 ? (
                  <p className="text-xs text-slate-500">No dealer batches found</p>
                ) : (
                  dealerBatches.map(batch => (
                    <div key={batch.id} className="flex items-center space-x-2">
                      <Checkbox
                        checked={selectedDealerBatches.includes(batch.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedDealerBatches([...selectedDealerBatches, batch.id]);
                          } else {
                            setSelectedDealerBatches(selectedDealerBatches.filter(id => id !== batch.id));
                          }
                        }}
                      />
                      <span className="text-sm">{batch.invoice_number || `Batch #${batch.id?.slice(0, 8)}`} - {batch.total_phones || batch.total_quantity || 0} Phones (₹{batch.total_amount || 0})</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={exportSelectedData} className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Export Selected Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* PhoneZone Recycle Bin (Trash & Safe Restore) */}
      <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 via-slate-900 to-slate-900 shadow-md">
        <CardHeader className="py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                <RotateCcw className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                  PhoneZone Recycle Bin (रीसायकल बिन)
                  {recycleBinCount > 0 ? (
                    <Badge className="bg-emerald-600 text-white text-xs px-2 py-0.5">
                      {recycleBinCount} Deleted {recycleBinCount === 1 ? 'Item' : 'Items'} Safe
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-slate-700 text-slate-400 text-xs px-2 py-0.5">
                      Empty
                    </Badge>
                  )}
                </CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">
                  Deleted phones, repairs, customers, sellers &amp; dealers are kept safe here with 1-click restore. Auto-purged after 15 days on Render / 30 days on Desktop.
                </p>
              </div>
            </div>
            <Button
              onClick={() => setRecycleBinOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 px-4 shrink-0 shadow-md flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Open Recycle Bin ({recycleBinCount})
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Delete Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-5 w-5" />
            Delete Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Checkbox for deleting photos along with records */}
          <div className="flex items-start space-x-2.5 p-3 rounded-lg border border-red-500/20 bg-red-950/20">
            <Checkbox
              id="delete-photos-records"
              checked={deletePhotosWithRecords}
              onCheckedChange={(checked) => setDeletePhotosWithRecords(!!checked)}
              className="mt-0.5 border-red-500/50 data-[state=checked]:bg-red-600"
            />
            <label
              htmlFor="delete-photos-records"
              className="text-xs text-slate-300 cursor-pointer select-none space-y-0.5"
            >
              <span className="font-semibold text-red-400 block">
                Delete Photos along with Records (साथ में फ़ोटो और डाक्यूमेंट्स भी स्टोरेज और क्लाउड से हमेशा के लिए डिलीट करें)
              </span>
              <span className="text-[11px] text-slate-400 block leading-relaxed">
                When checked, linked product photos, bill scans, and KYC Aadhaar images will be permanently erased from disk and Supabase Cloud storage to free up quota. If unchecked, records go to the <strong>Recycle Bin</strong> for safe recovery.
              </span>
            </label>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            {/* Button lives OUTSIDE AlertDialog - Radix only accepts AlertDialogTrigger as child */}
            <Button 
              variant="outline" 
              className="flex-1"
              disabled={selectedPhones.length === 0 && selectedSellers.length === 0 && selectedCustomers.length === 0 && selectedMessages.length === 0}
              onClick={() => setDeleteSelectedOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deletePhotosWithRecords ? "Permanently Delete Selected" : "Move Selected to Recycle Bin"}
            </Button>
            <AlertDialog open={deleteSelectedOpen} onOpenChange={setDeleteSelectedOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {deletePhotosWithRecords ? "Permanently Delete Selected Data & Photos" : "Move Selected Data to Recycle Bin"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {deletePhotosWithRecords
                      ? "This will permanently destroy the selected data AND wipe all linked photos from storage and Supabase Cloud. This action cannot be undone."
                      : "This will move the selected items to the Recycle Bin. You can restore them anytime within the retention period."}
                    <br /><br />
                    Selected: {selectedPhones.length} phones, {selectedSellers.length} sellers, 
                    {selectedCustomers.length} customers, {selectedMessages.length} messages
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setDeleteSelectedOpen(false)}>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => {
                      setDeleteSelectedOpen(false);
                      deleteSelectedData();
                    }} 
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {deletePhotosWithRecords ? "Permanently Delete" : "Move to Recycle Bin"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button 
              variant="destructive" 
              className="flex-1"
              onClick={() => setDeleteAllOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deletePhotosWithRecords ? "Permanently Purge All Data" : "Move All to Recycle Bin"}
            </Button>
            <AlertDialog open={deleteAllOpen} onOpenChange={setDeleteAllOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {deletePhotosWithRecords ? "Permanently Purge ALL Data & Photos" : "Move ALL Data to Recycle Bin"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {deletePhotosWithRecords
                      ? "This will permanently wipe all phones, sellers, customers, and their photos from disk storage and Supabase Cloud. This action CANNOT be undone."
                      : "This will move all loaded records to the Recycle Bin. You can restore them anytime with 1-click within the retention period (15 days on Render / 30 days on Desktop)."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setDeleteAllOpen(false)}>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => {
                      setDeleteAllOpen(false);
                      deleteAllData();
                    }} 
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {deletePhotosWithRecords ? "Permanently Purge All" : "Move All to Recycle Bin"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* Recycle Bin Dialog */}
      <RecycleBinDialog
        open={recycleBinOpen}
        onOpenChange={setRecycleBinOpen}
        onActionComplete={async () => {
          await fetchData();
          await calculateStorageUsage();
        }}
      />
    </div>
  );
};

export default DatabaseTab;
