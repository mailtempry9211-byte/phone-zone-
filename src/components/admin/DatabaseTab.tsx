import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Download, Trash2, Database, HardDrive, FileText, FileSpreadsheet, Code, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import JSZip from 'jszip';
import StorageManagementCard from "./StorageManagementCard";

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
  const [storageUsage, setStorageUsage] = useState<number>(0);
  const [totalStorage, setTotalStorage] = useState<number>(1024); // 1GB in MB
  const [exportFormat, setExportFormat] = useState<string>('json');
  const [isLoading, setIsLoading] = useState(true);
  const [backupBusy, setBackupBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [deleteSelectedOpen, setDeleteSelectedOpen] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);

  useEffect(() => {
    fetchData();
    calculateStorageUsage();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [phonesRes, sellersRes, customersRes, messagesRes, adminRes, returnsRes] = await Promise.all([
        supabase.from('phones').select('*').order('created_at', { ascending: false }),
        supabase.from('sellers').select('*').order('created_at', { ascending: false }),
        supabase.from('customers').select('*').order('created_at', { ascending: false }),
        supabase.from('messages').select('*').order('created_at', { ascending: false }),
        supabase.from('admin_settings').select('*'),
        supabase.from('returns').select('*').order('created_at', { ascending: false })
      ]);

      if (phonesRes.error) throw phonesRes.error;
      if (sellersRes.error) throw sellersRes.error;
      if (customersRes.error) throw customersRes.error;
      if (messagesRes.error) throw messagesRes.error;
      if (adminRes.error) throw adminRes.error;
      if (returnsRes.error) throw returnsRes.error;

      setPhones(phonesRes.data || []);
      setSellers(sellersRes.data || []);
      setCustomers(customersRes.data || []);
      setMessages(messagesRes.data || []);
      setAdminSettings(adminRes.data || []);
      setReturns(returnsRes.data || []);
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
      const response = await fetch(url);
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
      const suggestedName = `PhoneZone_Backup_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.zip`;
      const win = window as any;

      // Electron build: use the native Windows "Save As" dialog (via IPC).
      if (win.phonezone?.isElectron) {
        const res = await fetch('/api/backups', { method: 'POST', credentials: 'include' });
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
        toast.success(`Full backup saved (${(data.byteLength / (1024 * 1024)).toFixed(2)} MB):\n${result.path}`);
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
            types: [{ description: 'PhoneZone backup (ZIP)', accept: { 'application/zip': ['.zip'] } }],
          });
        } catch (pickErr: any) {
          if (pickErr?.name === 'AbortError') return; // user cancelled the picker
          saveHandle = null; // picker unsupported/blocked -> default download
        }
      }
      if (saveHandle) toast.info('Choose where you want to save the backup...');

      const res = await fetch('/api/backups', { method: 'POST', credentials: 'include' });
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

      toast.success(`Full backup saved (${(blob.size / (1024 * 1024)).toFixed(2)} MB) - includes all data and images`);
    } catch (error: any) {
      console.error('Backup error:', error);
      toast.error(error.message || 'Failed to create backup');
    } finally {
      setBackupBusy(false);
    }
  };

  const restoreFromBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (event.target) event.target.value = '';
    if (!file) return;

    const lower = file.name.toLowerCase();
    const isArchive = lower.endsWith('.zip') || lower.endsWith('.tar.gz') || lower.endsWith('.tar');

    // Re-upload a bundled image and rewrite a row's URL to the new object URL.
    //
    // The old URL is the OLD computer's file id / bucket path, which does not
    // exist on a fresh install - leaving it in place is what produced broken
    // photos after a JSON restore. Every referenced image is therefore re-saved
    // here and the row is pointed at the new location.
    const relink = async (zip: any, url: string): Promise<string> => {
      const rel = parseStorageRel(url);
      if (!rel) return url;
      const entry = zip?.file('images/' + rel);
      if (!entry) return url;
      try {
        const blob = await entry.async('blob');
        const parts = rel.split('/');
        const name = (parts.pop() || 'img').replace(/[^\w.-]/g, '_').replace(/\.bin$/, '');
        // A file that was PUBLIC before the move (product photo on the homepage)
        // must land in a public folder again, otherwise it becomes private and
        // the shop's own website shows a broken image.
        const wasPublic = /\/public\/files\//.test(url) || /\/object\/public\//.test(url);
        const base = wasPublic ? 'product-photos' : (parts.join('/') || 'product-photos');
        const newRel = `${base}/restored-${Date.now()}-${name}`;
        const { error } = await supabase.storage.from('phonezone-uploads').upload(newRel, blob);
        if (error) return url;
        const { data } = supabase.storage.from('phonezone-uploads').getPublicUrl(newRel);
        return data.publicUrl;
      } catch {
        return url;
      }
    };

    const restoreImageFields = async (zip: any, row: any, fields: string[]) => {
      for (const field of fields) {
        const val = row[field];
        if (Array.isArray(val)) {
          const out: string[] = [];
          for (const u of val) out.push(await relink(zip, u));
          row[field] = out;
        } else if (typeof val === 'string' && val) {
          row[field] = await relink(zip, val);
        }
      }
    };

    const insertRows = async (backupData: any) => {
      await Promise.all([
        supabase.from('phones').delete().neq('id', ''),
        supabase.from('sellers').delete().neq('id', ''),
        supabase.from('customers').delete().neq('id', ''),
        supabase.from('messages').delete().neq('id', ''),
        supabase.from('returns').delete().neq('id', '')
      ]);

      const restorePromises = [];
      if (backupData.phones?.length > 0) restorePromises.push(supabase.from('phones').insert(backupData.phones));
      if (backupData.sellers?.length > 0) restorePromises.push(supabase.from('sellers').insert(backupData.sellers));
      if (backupData.customers?.length > 0) restorePromises.push(supabase.from('customers').insert(backupData.customers));
      if (backupData.messages?.length > 0) restorePromises.push(supabase.from('messages').insert(backupData.messages));
      if (backupData.returns?.length > 0) restorePromises.push(supabase.from('returns').insert(backupData.returns));

      await Promise.all(restorePromises);
      await fetchData();
      await calculateStorageUsage();
    };

    // --- Archive files: JSON-export ZIP or full backup ---
    if (isArchive) {
      // Try to read it as a ZIP so we can detect a JSON+images export.
      let zip: any = null;
      try {
        zip = await JSZip.loadAsync(file);
      } catch {
        zip = null; // not a zip (e.g. .tar.gz) -> full backup handled by backend
      }

      if (zip && zip.file('data.json')) {
        try {
          setRestoreBusy(true);
          const raw = await zip.file('data.json').async('string');
          const backupData = JSON.parse(raw);
          if (!backupData.phones || !backupData.sellers) throw new Error('Invalid backup file format');

          for (const p of backupData.phones || []) await restoreImageFields(zip, p, ['product_photos', 'payment_proof_photos', 'purchase_documents']);
          for (const s of backupData.sellers || []) await restoreImageFields(zip, s, ['seller_photo_url', 'aadhaar_photo_url']);
          for (const c of backupData.customers || []) await restoreImageFields(zip, c, ['customer_photo_url', 'aadhaar_photo_url']);

          await insertRows(backupData);
          toast.success('Backup restored successfully (JSON + images)');
          return;
        } catch (error: any) {
          console.error('JSON-restore error:', error);
          toast.error(error.message || 'Failed to restore JSON backup');
          return;
        } finally {
          setRestoreBusy(false);
        }
      }

      // Full backup (.zip / .tar.gz) -> backend restore.
      try {
        setRestoreBusy(true);
        const fd = new FormData();
        fd.append('backup', file);
        const res = await fetch('/api/backups/restore-upload', {
          method: 'POST',
          credentials: 'include',
          body: fd,
        });
        if (!res.ok) {
          const b = await res.json().catch(() => ({}));
          throw new Error(b.error || 'Restore failed');
        }
        await res.json();
        toast.success('Backup restored successfully');
        await fetchData();
        await calculateStorageUsage();
        return;
      } catch (error: any) {
        console.error('Restore error:', error);
        toast.error(error.message || 'This file is not a valid PhoneZone backup.');
        return;
      } finally {
        setRestoreBusy(false);
      }
    }

    // --- Legacy plain-JSON dump: no longer imported -------------------------
    // Re-importing a bare JSON file deleted every table before inserting (now a
    // soft delete, so the old rows stayed and the insert hit primary-key
    // conflicts), and image URLs were never remapped. Restoring a real backup
    // is the supported path.
    toast.error('To restore data, use Backup & Restore.');
  };

  const exportSelectedData = async () => {
    try {
      const selectedData = {
        phones: phones.filter(p => selectedPhones.includes(p.id)),
        sellers: sellers.filter(s => selectedSellers.includes(s.id)),
        customers: customers.filter(c => selectedCustomers.includes(c.id)),
        messages: messages.filter(m => selectedMessages.includes(m.id)),
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
    }
    
    // Add seller photos
    for (const seller of data.sellers) {
      const relatedPhones = data.phones.filter((p: any) => p.seller_id === seller.id);
      for (const phone of relatedPhones) {
        const phoneFolder = phoneFolders.get(phone.id);
        if (phoneFolder && seller.seller_photo_url) {
          const fileName = generateFileName(phone, 'sellerpic');
          const blob = await downloadImage(seller.seller_photo_url, fileName);
          if (blob) {
            phoneFolder.folder?.file(fileName, blob);
          }
        }
        
        if (phoneFolder && seller.aadhaar_photo_url) {
          const fileName = generateFileName(phone, 'salesdoc');
          const blob = await downloadImage(seller.aadhaar_photo_url, fileName);
          if (blob) {
            phoneFolder.folder?.file(fileName, blob);
          }
        }
      }
    }

    // Generate HTML content
    const htmlContent = generateOfflineHTML(data, phoneFolders);
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
      // Delete selected records through the backend API so soft-deletes
      // (archived_at) are applied instead of hard DELETEs.
      const deleteOps = [
        ...selectedPhones.map(id => fetch(`/api/phones/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" })),
        ...selectedSellers.map(id => fetch(`/api/sellers/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" })),
        ...selectedCustomers.map(id => fetch(`/api/customers/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" })),
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
      toast.success('Selected data deleted successfully');
    } catch (error) {
      console.error('Error deleting selected data:', error);
      toast.error('Failed to delete selected data');
    }
  };

  const deleteAllData = async () => {
    if (!confirm("Are you sure you want to archive ALL data? This cannot be undone. Phones, sellers and customers will be soft-deleted (archived_at). Messages will be marked as read. You can restore from a backup if needed.")) return;

    try {
      // Operate on everything currently loaded in this tab, via the backend
      // soft-delete endpoints. That is the same path the row-level "delete"
      // buttons use, so FK protection + audit logging still apply.
      const ids = {
        phones: selectedPhones.length > 0 ? selectedPhones : phones.map((p) => p.id),
        sellers: selectedSellers.length > 0 ? selectedSellers : sellers.map((s) => s.id),
        customers: selectedCustomers.length > 0 ? selectedCustomers : customers.map((c) => c.id),
      };

      const ops = [
        ...ids.phones.map((id) =>
          fetch(`/api/phones/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" }),
        ),
        ...ids.sellers.map((id) =>
          fetch(`/api/sellers/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" }),
        ),
        ...ids.customers.map((id) =>
          fetch(`/api/customers/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" }),
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
      toast.success('All data archived successfully. Your files are still in storage.');
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

  const generateOfflineHTML = (data: any, phoneFolders: Map<string, any>) => {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PhoneZone - Offline Database</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <header>
            <h1>PhoneZone - Database Export</h1>
            <p>Exported on: ${new Date().toLocaleDateString()}</p>
            <div class="stats">
                <div class="stat">
                    <h3>${data.phones.length}</h3>
                    <p>Phones</p>
                </div>
                <div class="stat">
                    <h3>${data.sellers.length}</h3>
                    <p>Sellers</p>
                </div>
                <div class="stat">
                    <h3>${data.customers.length}</h3>
                    <p>Customers</p>
                </div>
                <div class="stat">
                    <h3>${data.messages.length}</h3>
                    <p>Messages</p>
                </div>
            </div>
        </header>
        
        <main>
            <section class="phones-section">
                <h2>Phones Inventory</h2>
                <div class="phones-grid">
                    ${data.phones.map((phone: any) => {
                      const phoneFolder = phoneFolders.get(phone.id);
                      const folderName = phoneFolder?.folderName || '';
                      const seller = data.sellers.find((s: any) => s.id === phone.seller_id);
                      const customer = data.customers.find((c: any) => c.id === phone.customer_id);
                      
                      return `
                        <div class="phone-card">
                            <div class="phone-header">
                                <h3>${phone.phone_name} - ${phone.model}</h3>
                                <span class="condition-badge ${phone.condition}">${phone.condition}</span>
                            </div>
                            <div class="phone-details">
                                <p><strong>IMEI:</strong> ${phone.imei_number}</p>
                                <p><strong>Purchase Price:</strong> ₹${phone.purchase_price}</p>
                                <p><strong>Selling Price:</strong> ₹${phone.selling_price}</p>
                                <p><strong>Purchase Date:</strong> ${new Date(phone.purchase_date).toLocaleDateString()}</p>
                                <p><strong>Payment Method:</strong> ${phone.payment_method}</p>
                                <p><strong>Status:</strong> ${phone.is_sold ? 'SOLD' : 'AVAILABLE'}</p>
                                ${phone.is_sold && phone.sold_date ? `<p><strong>Sold Date:</strong> ${new Date(phone.sold_date).toLocaleDateString()}</p>` : ''}
                            </div>
                            
                            ${seller ? `
                            <div class="seller-info">
                                <h4>Seller Information</h4>
                                <p><strong>Name:</strong> ${seller.name}</p>
                                <p><strong>Phone:</strong> ${seller.phone}</p>
                                <p><strong>Address:</strong> ${seller.address}</p>
                                <p><strong>ID Type:</strong> ${seller.id_proof_type}</p>
                                <p><strong>ID Number:</strong> ${seller.id_number}</p>
                                ${seller.seller_photo_url ? `<img src="${folderName}/${generateFileName(phone, 'sellerpic')}" alt="Seller" class="seller-photo">` : ''}
                            </div>
                            ` : ''}
                            
                            ${customer ? `
                            <div class="customer-info">
                                <h4>Customer Information</h4>
                                <p><strong>Name:</strong> ${customer.name}</p>
                                <p><strong>Phone:</strong> ${customer.phone}</p>
                                <p><strong>Address:</strong> ${customer.address}</p>
                                <p><strong>ID Type:</strong> ${customer.id_proof_type}</p>
                                <p><strong>ID Number:</strong> ${customer.id_number}</p>
                            </div>
                            ` : ''}
                            
                            ${phone.product_photos && phone.product_photos.length > 0 ? 
                              `<div class="phone-images">
                                 <h4>Product Photos</h4>
                                 <div class="image-grid">
                                   ${phone.product_photos.map((photo: string, index: number) => 
                                     `<img src="${folderName}/${generateFileName(phone, 'product', index)}" alt="Product ${index + 1}" class="phone-image" onclick="openImageModal(this.src)">`
                                   ).join('')}
                                 </div>
                               </div>` : ''
                            }
                            
                            ${phone.purchase_documents && phone.purchase_documents.length > 0 ? 
                              `<div class="documents">
                                 <h4>Purchase Documents</h4>
                                 <div class="image-grid">
                                   ${phone.purchase_documents.map((doc: string, index: number) => 
                                     `<img src="${folderName}/${generateFileName(phone, 'purch_doc', index)}" alt="Document ${index + 1}" class="document-image" onclick="openImageModal(this.src)">`
                                   ).join('')}
                                 </div>
                               </div>` : ''
                            }
                            
                            ${phone.payment_proof_photos && phone.payment_proof_photos.length > 0 ? 
                              `<div class="payment-proofs">
                                 <h4>Payment Proofs</h4>
                                 <div class="image-grid">
                                   ${phone.payment_proof_photos.map((proof: string, index: number) => 
                                     `<img src="${folderName}/${generateFileName(phone, 'payment_proof', index)}" alt="Payment Proof ${index + 1}" class="proof-image" onclick="openImageModal(this.src)">`
                                   ).join('')}
                                 </div>
                               </div>` : ''
                            }
                        </div>
                      `;
                    }).join('')}
                </div>
            </section>
            
            <section class="sellers-section">
                <h2>Sellers Database</h2>
                <div class="sellers-grid">
                    ${data.sellers.map((seller: any) => `
                        <div class="seller-card">
                            <h3>${seller.name}</h3>
                            <p><strong>Phone:</strong> ${seller.phone}</p>
                            <p><strong>Address:</strong> ${seller.address}</p>
                            <p><strong>ID Type:</strong> ${seller.id_proof_type}</p>
                            <p><strong>ID Number:</strong> ${seller.id_number}</p>
                            <p><strong>Registered:</strong> ${new Date(seller.created_at).toLocaleDateString()}</p>
                        </div>
                    `).join('')}
                </div>
            </section>

            <section class="customers-section">
                <h2>Customers Database</h2>
                <div class="customers-grid">
                    ${data.customers.map((customer: any) => `
                        <div class="customer-card">
                            <h3>${customer.name}</h3>
                            <p><strong>Phone:</strong> ${customer.phone}</p>
                            <p><strong>Address:</strong> ${customer.address}</p>
                            <p><strong>ID Type:</strong> ${customer.id_proof_type}</p>
                            <p><strong>ID Number:</strong> ${customer.id_number}</p>
                            <p><strong>Registered:</strong> ${new Date(customer.created_at).toLocaleDateString()}</p>
                        </div>
                    `).join('')}
                </div>
            </section>
            
            <section class="messages-section">
                <h2>Customer Messages</h2>
                <div class="messages-grid">
                    ${data.messages.map((message: any) => `
                        <div class="message-card">
                            <h3>${message.name}</h3>
                            <p><strong>Email:</strong> ${message.email}</p>
                            ${message.phone ? `<p><strong>Phone:</strong> ${message.phone}</p>` : ''}
                            <p><strong>Date:</strong> ${new Date(message.created_at).toLocaleDateString()}</p>
                            <div class="message-content">
                                <p>${message.message}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </section>
        </main>
    </div>
    
    <!-- Image Modal -->
    <div id="imageModal" class="modal" onclick="closeImageModal()">
        <div class="modal-content">
            <span class="close">&times;</span>
            <img id="modalImage" src="" alt="Full Size Image">
        </div>
    </div>
    
    <script>
        function openImageModal(src) {
            document.getElementById('imageModal').style.display = 'block';
            document.getElementById('modalImage').src = src;
        }
        
        function closeImageModal() {
            document.getElementById('imageModal').style.display = 'none';
        }
        
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeImageModal();
            }
        });
    </script>
</body>
</html>`;
  };

  const generateOfflineCSS = () => {
    return `
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    line-height: 1.6;
    color: #333;
    background-color: #f8fafc;
}

.container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 20px;
}

header {
    text-align: center;
    margin-bottom: 40px;
    background: white;
    padding: 30px;
    border-radius: 12px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

header h1 {
    color: #1e40af;
    margin-bottom: 10px;
    font-size: 2.5rem;
}

.stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 20px;
    margin-top: 20px;
}

.stat {
    text-align: center;
    padding: 15px;
    background: #f1f5f9;
    border-radius: 8px;
}

.stat h3 {
    font-size: 2rem;
    color: #1e40af;
    margin-bottom: 5px;
}

section {
    margin-bottom: 40px;
}

section h2 {
    color: #1e40af;
    margin-bottom: 20px;
    font-size: 1.8rem;
    text-align: center;
}

.phones-grid, .sellers-grid, .customers-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
    gap: 30px;
}

.phone-card, .seller-card, .customer-card {
    background: white;
    border-radius: 12px;
    padding: 25px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    transition: transform 0.2s;
}

.phone-card:hover, .seller-card:hover, .customer-card:hover {
    transform: translateY(-2px);
}

.phone-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    padding-bottom: 15px;
    border-bottom: 2px solid #e2e8f0;
}

.phone-header h3 {
    color: #1e40af;
    font-size: 1.2rem;
}

.condition-badge {
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: bold;
    text-transform: uppercase;
}

.condition-badge.excellent {
    background: #d1fae5;
    color: #065f46;
}

.condition-badge.good {
    background: #dbeafe;
    color: #1e40af;
}

.condition-badge.fair {
    background: #fef3c7;
    color: #92400e;
}

.condition-badge.poor {
    background: #fee2e2;
    color: #991b1b;
}

.phone-details {
    margin-bottom: 20px;
}

.phone-details p {
    margin-bottom: 8px;
    padding: 5px 0;
}

.seller-info, .customer-info {
    background: #f8fafc;
    padding: 15px;
    border-radius: 8px;
    margin-bottom: 15px;
}

.seller-info h4, .customer-info h4 {
    color: #1e40af;
    margin-bottom: 10px;
}

.seller-photo {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
    margin-top: 10px;
}

.phone-images, .documents, .payment-proofs {
    margin-top: 20px;
}

.phone-images h4, .documents h4, .payment-proofs h4 {
    color: #1e40af;
    margin-bottom: 10px;
}

.image-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 10px;
}

.phone-image, .document-image, .proof-image {
    width: 100%;
    height: 120px;
    object-fit: cover;
    border-radius: 6px;
    border: 2px solid #e2e8f0;
    cursor: pointer;
    transition: all 0.2s;
}

.phone-image:hover, .document-image:hover, .proof-image:hover {
    border-color: #1e40af;
    transform: scale(1.05);
}

.messages-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 20px;
}

.message-card {
    background: white;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
}

.message-card h3 {
    color: #1e40af;
    margin-bottom: 10px;
}

.message-content {
    margin-top: 15px;
    padding: 15px;
    background: #f8fafc;
    border-radius: 8px;
    border-left: 4px solid #1e40af;
}

/* Modal Styles */
.modal {
    display: none;
    position: fixed;
    z-index: 1000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0,0,0,0.9);
}

.modal-content {
    position: relative;
    margin: auto;
    padding: 0;
    width: 90%;
    max-width: 1200px;
    top: 50%;
    transform: translateY(-50%);
}

.close {
    position: absolute;
    top: 15px;
    right: 35px;
    color: #f1f1f1;
    font-size: 40px;
    font-weight: bold;
    cursor: pointer;
    z-index: 1001;
}

.close:hover {
    color: #bbb;
}

#modalImage {
    width: 100%;
    height: auto;
    border-radius: 8px;
}

@media (max-width: 768px) {
    .container {
        padding: 10px;
    }
    
    .phones-grid, .sellers-grid, .customers-grid {
        grid-template-columns: 1fr;
    }
    
    .messages-grid {
        grid-template-columns: 1fr;
    }
    
    .stats {
        grid-template-columns: repeat(2, 1fr);
    }
    
    header h1 {
        font-size: 2rem;
    }
}
`;
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

      {/* Backup & Restore */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Backup & Restore
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2">
            <Button onClick={createBackup} disabled={backupBusy} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              {backupBusy ? 'Creating backup...' : 'Create Full Backup (ZIP)'}
            </Button>
            <label className="w-full cursor-pointer">
              <Button type="button" variant="outline" className="w-full pointer-events-none" disabled={restoreBusy}>
                <Upload className="h-4 w-4 mr-2" />
                {restoreBusy ? 'Restoring...' : 'Restore Backup (ZIP / TAR.GZ)'}
              </Button>
              <input
                type="file"
                accept=".zip,.tar.gz,.tar,.json"
                onChange={restoreFromBackup}
                className="hidden"
                disabled={restoreBusy}
              />
            </label>
          </div>
          <p className="text-sm text-gray-600">
            <strong>Full backup (recommended):</strong> downloads a single ZIP containing all your business data
            (phones, sellers, customers, returns, accounting/invoices) <em>and</em> every image, so you can reinstall
            or switch PCs and restore everything with one file.
          </p>
        </CardContent>
      </Card>

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
          </div>

          <div className="flex gap-2">
            <Button onClick={exportSelectedData} className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Export Selected Data
            </Button>
          </div>
        </CardContent>
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
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Button lives OUTSIDE AlertDialog - Radix only accepts AlertDialogTrigger as child */}
            <Button 
              variant="outline" 
              className="flex-1"
              disabled={selectedPhones.length === 0 && selectedSellers.length === 0 && selectedCustomers.length === 0 && selectedMessages.length === 0}
              onClick={() => setDeleteSelectedOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected Data
            </Button>
            <AlertDialog open={deleteSelectedOpen} onOpenChange={setDeleteSelectedOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Selected Data</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the selected data. This action cannot be undone.
                    <br />
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
                    Delete Selected
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
              Archive All Data
            </Button>
            <AlertDialog open={deleteAllOpen} onOpenChange={setDeleteAllOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archive All Data</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will soft-delete (archive) every phone, seller and customer currently loaded in this tab.
                    Messages will be marked as read. Files in storage are kept. You can restore from a backup if needed.
                    This action cannot be undone.
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
                    Archive All Data
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DatabaseTab;
