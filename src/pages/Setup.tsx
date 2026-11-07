import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Store, Upload, History, ShieldCheck, Star, Cloud, CheckCircle2, RotateCcw, Building2, Smartphone, Users, UserCheck, Wrench, Settings, Layers, Sparkles, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

type SetupMode = 'choose' | 'new' | 'restore';

// Turn any failed response into a human-readable message. A non-JSON body
// (e.g. the Vite proxy returning 500 because the backend is not running)
// used to show only a generic "Setup failed".
const readError = async (res: Response, fallback: string): Promise<string> => {
  const text = await res.text().catch(() => '');
  try {
    const body = JSON.parse(text);
    if (body?.error) return body.error;
  } catch {
    /* not JSON */
  }
  if (res.status >= 500 && !text.trim().startsWith('{')) {
    return `Cannot reach the PhoneZone backend (HTTP ${res.status}). Start it with "npm run dev:all" (or scripts/start.bat) and try again.`;
  }
  return `${fallback} (HTTP ${res.status})`;
};

const Setup = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<SetupMode>('choose');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [cloudStoreInfo, setCloudStoreInfo] = useState<{
    setupCompleted: boolean;
    cloudSetupDetected: boolean;
    businessName: string;
    cloudBusinessName?: string;
  } | null>(null);
  const [isWipingCloud, setIsWipingCloud] = useState(false);
  const [wipeBeforeRestore, setWipeBeforeRestore] = useState(true);
  const [restoreStrategy, setRestoreStrategy] = useState<'replace' | 'merge'>('replace');
  const [selectedEntities, setSelectedEntities] = useState<Record<string, boolean>>({
    settings: true,
    phones: true,
    sellers: true,
    customers: true,
    dealers: true,
    repairs: true,
    returns: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [restoreStatusText, setRestoreStatusText] = useState<string>('');
  const [restoreLogs, setRestoreLogs] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cloud / Google Drive Backups
  const [cloudBackups, setCloudBackups] = useState<any[]>([]);
  const [cloudTargetDir, setCloudTargetDir] = useState<string>('');
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(false);
  const [restoringCloudName, setRestoringCloudName] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'restore') {
      fetch('/api/setup/cloud-backups')
        .then((res) => res.json())
        .then((data) => {
          if (data?.recentBackups) {
            setCloudBackups(data.recentBackups);
            setCloudTargetDir(data.targetDir || data.activeFolder || '');
            setIsCloudConnected(!!data.isConnected);
          }
        })
        .catch(() => {});
    }
  }, [mode]);

  const handleRestoreCloudBackup = async (backupName: string) => {
    if (!confirm(`Restore all business data from "${backupName}"?`)) return;
    setRestoring(true);
    setRestoringCloudName(backupName);
    try {
      const res = await fetch('/api/setup/restore-cloud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupName }),
      });
      if (!res.ok) {
        throw new Error(await readError(res, 'Cloud restore failed'));
      }
      sessionStorage.setItem('phonezone_admin_active', 'true');
      sessionStorage.setItem('phonezone_admin_tab', 'inventory');
      toast.success('Data restored successfully from Google Drive backup! Welcome back.');
      window.location.replace('/?admin=1');
    } catch (err: any) {
      toast.error(err.message || 'Failed to restore cloud backup');
    } finally {
      setRestoring(false);
      setRestoringCloudName(null);
    }
  };

  const [formData, setFormData] = useState({
    businessModule: 'both',
    businessName: '',
    businessTagline: '',
    ownerName: '',
    address: '',
    udyamNumber: '',
    udyamVerified: false,
    googleBusinessVerified: false,
    googleBusinessUrl: '',
    primaryPhone: '',
    secondaryPhone: '',
    email: '',
    instagram: '',
    whatsappNumber: '',
    password: '',
    confirmPassword: '',
    securityQuestion: 'What was the name of your first school?',
    securityAnswer: '',
    bankName: '',
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    logoUrl: '',
    signatureUrl: '',
    termsAndConditions: '',
    termsAndConditionsSale: '',
    termsAndConditionsPurchase: '',
  });

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('mode') === 'new') {
      setMode('new');
    }
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
    try {
      const res = await fetch('/api/setup/status', { credentials: 'include' });
      if (res.ok) {
        const status = await res.json();
        setCloudStoreInfo(status);
        if (status.setupCompleted || status.cloudSetupDetected) {
          // If already authenticated as admin, allow access
          try {
            const authRes = await fetch('/api/auth/me', { credentials: 'include' });
            if (authRes.ok) {
              const me = await authRes.json();
              if (me?.user?.role === 'admin' || me?.roles?.includes('admin')) {
                setIsLocked(false);
                setLoading(false);
                return;
              }
            }
          } catch {}

          // Not authenticated as admin -> Lock setup until owner unlocks with password
          setIsLocked(true);
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      // proceed
    }
    setLoading(false);
  };

  const handleUnlockSetup = async () => {
    if (!unlockPassword.trim()) {
      toast.error('Please enter your Admin Password');
      return;
    }
    setUnlocking(true);
    try {
      const res = await fetch('/api/setup/verify-unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: unlockPassword.trim() }),
      });
      if (!res.ok) {
        throw new Error(await readError(res, 'Incorrect Admin Password'));
      }
      toast.success('Admin identity verified! Setup unlocked.');
      setIsLocked(false);
    } catch (err: any) {
      toast.error(err.message || 'Incorrect Admin Password');
    } finally {
      setUnlocking(false);
    }
  };

  const handleExportCloudBackup = () => {
    toast.info("Generating full safety backup from database...");
    const url = `/api/setup/export-backup?adminPassword=${encodeURIComponent(unlockPassword)}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `PhoneZone_Safety_Backup_${Date.now()}.tar.gz`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("Backup download started!");
  };

  const handleWipeCloudAndStartFresh = async () => {
    if (!confirm(
      "⚠️ PERMANENT WIPE WARNING:\n\nThis will permanently delete all phones, repair jobs, sellers, customers, and photos from Supabase Cloud and local storage to cleanly free up all quota.\n\nAre you sure you want to completely wipe all existing cloud data?"
    )) {
      return;
    }

    setIsWipingCloud(true);
    try {
      const res = await fetch('/api/setup/wipe-cloud', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': unlockPassword,
        },
        credentials: 'include',
        body: JSON.stringify({ adminPassword: unlockPassword }),
      });
      if (!res.ok) {
        throw new Error(await readError(res, 'Failed to wipe cloud data'));
      }
      toast.success("✅ Supabase Cloud & Local storage permanently wiped! All quota is 100% free.");
      setCloudStoreInfo(null);
      setMode('choose');
      setStep(1);
    } catch (err: any) {
      toast.error(err.message || 'Wipe failed');
    } finally {
      setIsWipingCloud(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    const finalVal = name === 'instagram' ? value.replace(/^@+/, '').trim() : value;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : finalVal }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, category: 'logo' | 'signature') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('category', category);
    try {
      const res = await fetch('/api/setup/upload', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      if (!res.ok) {
        throw new Error(await readError(res, 'Upload failed'));
      }
      const data = await res.json();
      setFormData(prev => ({ ...prev, [category === 'logo' ? 'logoUrl' : 'signatureUrl']: data.url }));
      toast.success(`${category === 'logo' ? 'Logo' : 'Signature'} uploaded successfully`);
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    }
  };

  const handleRestore = () => {
    if (!restoreFile) {
      toast.error('Please select a backup file');
      return;
    }

    const chosen = Object.entries(selectedEntities)
      .filter(([_, checked]) => checked)
      .map(([k]) => k);

    if (chosen.length === 0) {
      toast.error('Please select at least one data category to restore');
      return;
    }

    const isAll = chosen.length === Object.keys(selectedEntities).length;
    const entitiesPayload = isAll ? ['all'] : chosen;

    setRestoring(true);
    setUploadProgress(0);
    setRestoreStatusText('Starting upload to PhoneZone server...');
    setRestoreLogs([
      `[${new Date().toLocaleTimeString()}] Backup file selected: ${restoreFile.name} (${(restoreFile.size / (1024 * 1024)).toFixed(2)} MB)`,
      `[${new Date().toLocaleTimeString()}] Strategy: ${restoreStrategy === 'replace' ? 'Clean Replace' : 'Smart Merge'}`,
      `[${new Date().toLocaleTimeString()}] Restoring categories: ${isAll ? 'All Categories' : entitiesPayload.join(', ')}`,
      `[${new Date().toLocaleTimeString()}] Initiating secure HTTP upload...`,
    ]);

    const fd = new FormData();
    fd.append('backup', restoreFile);
    fd.append('strategy', restoreStrategy);
    fd.append('entities', JSON.stringify(entitiesPayload));
    if (restoreStrategy === 'replace' && wipeBeforeRestore) {
      fd.append('wipe_existing', 'true');
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/setup/restore');
    xhr.withCredentials = true;
    if (unlockPassword) {
      xhr.setRequestHeader('x-admin-password', unlockPassword);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        const loadedMB = (event.loaded / (1024 * 1024)).toFixed(2);
        const totalMB = (event.total / (1024 * 1024)).toFixed(2);
        setUploadProgress(percent);
        setRestoreStatusText(`Uploading file: ${percent}% (${loadedMB} MB / ${totalMB} MB)...`);
      }
    };

    xhr.upload.onload = () => {
      setUploadProgress(100);
      setRestoreStatusText('Upload complete! Server is extracting archive & restoring tables...');
      setRestoreLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Upload 100% complete!`,
        `[${new Date().toLocaleTimeString()}] Server extracting archive and restoring SQLite tables...`,
      ]);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const body = JSON.parse(xhr.responseText);
          if (body?.token) {
            localStorage.setItem('pz_token', body.token);
            sessionStorage.setItem('pz_token', body.token);
          }
        } catch {}
        sessionStorage.setItem('phonezone_admin_active', 'true');
        sessionStorage.setItem('phonezone_admin_tab', 'inventory');
        setRestoreStatusText('✅ Restore completed successfully! Redirecting...');
        setRestoreLogs((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] ✅ Database tables & storage restored successfully!`,
          `[${new Date().toLocaleTimeString()}] Background cloud sync queued.`,
          `[${new Date().toLocaleTimeString()}] Welcome to PhoneZone! Redirecting now...`,
        ]);
        toast.success('Data restored successfully! Welcome back.');
        setTimeout(() => {
          window.location.href = '/?admin=1';
        }, 800);
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
        setRestoring(false);
      }
    };

    xhr.onerror = () => {
      const err = 'Network connection lost during upload. Please check your internet connection.';
      setRestoreStatusText(`❌ ${err}`);
      setRestoreLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ❌ ${err}`,
      ]);
      toast.error(err);
      setRestoring(false);
    };

    xhr.send(fd);
  };

  const handleSubmit = async () => {
    if (step === 4) {
      if (!formData.businessName || !formData.primaryPhone || !formData.address || !formData.email || !formData.password) {
        toast.error('Please fill in all required fields');
        return;
      }
      if (formData.password.length < 6) {
        toast.error('Password must be at least 6 characters');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        throw new Error(await readError(res, 'Setup failed'));
      }
      sessionStorage.setItem('phonezone_admin_active', 'true');
      sessionStorage.setItem('phonezone_admin_tab', 'inventory');
      toast.success('Setup complete! Welcome to your new business dashboard.');
      window.location.replace('/?admin=1'); // full reload so App re-reads setup status
    } catch (err: any) {
      toast.error(err instanceof TypeError ? 'Cannot reach the PhoneZone backend. Is it running?' : (err.message || 'Setup failed. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const nextStep = () => {
    if (step === 1) {
      if (!formData.businessName || !formData.ownerName || !formData.address) {
        toast.error('Please fill in all required fields');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!formData.primaryPhone || !formData.email || !formData.address) {
        toast.error('Please fill in all required fields');
        return;
      }
      if (!formData.password || formData.password.length < 6) {
        toast.error('Password must be at least 6 characters');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
      if (!formData.securityAnswer || formData.securityAnswer.trim().length < 2) {
        toast.error('Please enter an answer for your password recovery security question');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    }
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  if (loading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4'></div>
          <p className='text-gray-600'>Checking setup status...</p>
        </div>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 flex items-center justify-center p-4'>
        <Card className='max-w-md w-full bg-slate-900/90 border-slate-800 text-slate-100 shadow-2xl backdrop-blur-md'>
          <CardHeader className='text-center space-y-2'>
            <div className='mx-auto w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center'>
              <ShieldCheck className='w-6 h-6 text-blue-400' />
            </div>
            <CardTitle className='text-xl font-bold tracking-tight text-white'>PhoneZone Setup is Locked</CardTitle>
            <CardDescription className='text-slate-400 text-xs leading-relaxed'>
              This business is already configured. To restore a backup (.zip) or reconfigure this store, enter your Admin Password:
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='space-y-1.5'>
              <Label className='text-xs text-slate-300 font-medium'>Admin Password / Master Password</Label>
              <Input
                type='password'
                placeholder='Enter password...'
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUnlockSetup()}
                className='bg-slate-950/60 border-slate-800 text-slate-100 focus:border-blue-500'
                autoFocus
              />
            </div>
            <Button
              onClick={handleUnlockSetup}
              disabled={unlocking}
              className='w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold'
            >
              {unlocking ? 'Verifying...' : 'Unlock Setup & Restore'}
            </Button>
            <div className='text-center pt-2'>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => navigate('/')}
                className='text-xs text-slate-400 hover:text-slate-200'
              >
                ← Return to Storefront
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalSteps = mode === 'new' ? 4 : 1;

  return (
    <div className='min-h-screen bg-gradient-to-b from-blue-50 to-white py-12 px-4'>
      <div className='max-w-2xl mx-auto'>
        {/* Active Cloud Business Management Card (Download Backup, Continue, or Wipe Cloud) */}
        {cloudStoreInfo && (cloudStoreInfo.cloudSetupDetected || cloudStoreInfo.setupCompleted) && (
          <Card className="mb-6 border-blue-500/30 bg-blue-950/20 text-slate-100 shadow-md">
            <CardHeader className="py-3 px-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Cloud className="w-5 h-5 text-blue-400" />
                    <span className="font-bold text-sm text-blue-300">
                      Active Cloud Store: {cloudStoreInfo.businessName || cloudStoreInfo.cloudBusinessName || "PhoneZone"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Supabase cloud database has active store data. You can continue, download a safety backup, or wipe cloud storage clean.
                  </p>
                </div>
                <div className="flex items-center flex-wrap gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                    onClick={handleExportCloudBackup}
                  >
                    📥 Download Backup
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                    onClick={() => navigate('/')}
                  >
                    ← Continue with Store
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 text-xs"
                    onClick={handleWipeCloudAndStartFresh}
                    disabled={isWipingCloud}
                  >
                    {isWipingCloud ? "Wiping..." : "🗑️ Wipe Cloud Clean"}
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
        )}

        <div className='text-center mb-8'>
          <Store className='h-12 w-12 text-blue-600 mx-auto mb-4' />
          <h1 className='text-3xl font-bold text-gray-900 mb-2'>Welcome to PhoneZone</h1>
          <p className='text-gray-600'>
            {mode === 'choose' && 'Choose how you want to get started.'}
            {mode === 'new' && 'Let us set up your business profile.'}
            {mode === 'restore' && 'Restore your previous business data.'}
          </p>
        </div>

        {mode === 'choose' && (
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            <Card className='cursor-pointer hover:shadow-lg transition-shadow' onClick={() => setMode('new')}>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Store className='h-5 w-5' /> Setup New Business
                </CardTitle>
                <CardDescription>Start fresh and configure your business from scratch</CardDescription>
              </CardHeader>
              <CardContent>
                <p className='text-sm text-gray-600'>Perfect for first-time users. You will enter business details, upload logo/signature, and set up login credentials.</p>
              </CardContent>
            </Card>
            <Card className='cursor-pointer hover:shadow-lg transition-shadow' onClick={() => setMode('restore')}>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <History className='h-5 w-5' /> Restore Previous Data
                </CardTitle>
                <CardDescription>Already used PhoneZone before? Restore from backup</CardDescription>
              </CardHeader>
              <CardContent>
                <p className='text-sm text-gray-600'>If you are switching systems or reinstalling, upload your backup file to restore all your data instantly.</p>
              </CardContent>
            </Card>
          </div>
        )}

        {mode === 'new' && (
          <>
            <div className="flex justify-center mb-8">
              <div className="flex items-center space-x-2">
                {[1, 2, 3, 4].map((s) => (
                  <div key={s} className="flex items-center space-x-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === s ? 'bg-blue-600 text-white' : step > s ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'}`}>{s}</div>
                    {s < 4 && <div className={`w-8 h-0.5 ${step > s ? 'bg-green-600' : 'bg-gray-300'}`}></div>}
                  </div>
                ))}
              </div>
            </div>

            {step === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Business Operations &amp; Modules</CardTitle>
                  <CardDescription>Select which business operations your store runs</CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <div>
                    <Label className="text-xs font-semibold text-gray-700 block mb-2">Store Operation Focus *</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div
                        onClick={() => setFormData(prev => ({ ...prev, businessModule: 'both' }))}
                        className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                          formData.businessModule === 'both'
                            ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-bold text-sm text-gray-900 flex items-center gap-1.5 mb-1">
                          🛍️ + 🔧 Full Store
                        </div>
                        <p className="text-xs text-gray-500">
                          Used phone buying/selling, counter sales, plus full mobile repair workshop &amp; rework.
                        </p>
                      </div>

                      <div
                        onClick={() => setFormData(prev => ({ ...prev, businessModule: 'sales_only' }))}
                        className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                          formData.businessModule === 'sales_only'
                            ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-bold text-sm text-gray-900 flex items-center gap-1.5 mb-1">
                          🛍️ Sales Only
                        </div>
                        <p className="text-xs text-gray-500">
                          Used phone inventory, customer sales invoices, sellers &amp; sales returns only.
                        </p>
                      </div>

                      <div
                        onClick={() => setFormData(prev => ({ ...prev, businessModule: 'repairs_only' }))}
                        className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                          formData.businessModule === 'repairs_only'
                            ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-bold text-sm text-gray-900 flex items-center gap-1.5 mb-1">
                          🔧 Repairs Only
                        </div>
                        <p className="text-xs text-gray-500">
                          Job sheets, technician workbench, warranty rework tracking &amp; repair accounting.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor='businessName'>Business Name *</Label>
                    <Input id='businessName' name='businessName' value={formData.businessName} onChange={handleInputChange} required />
                  </div>
                  <div>
                    <Label htmlFor='businessTagline'>Tagline</Label>
                    <Input id='businessTagline' name='businessTagline' value={formData.businessTagline} onChange={handleInputChange} />
                  </div>
                  <div>
                    <Label htmlFor='ownerName'>Owner Name *</Label>
                    <Input id='ownerName' name='ownerName' value={formData.ownerName} onChange={handleInputChange} />
                  </div>
                  <div>
                    <Label htmlFor='address'>Business Address *</Label>
                    <Textarea id='address' name='address' value={formData.address} onChange={handleInputChange} required />
                  </div>
                  <div className='flex items-center gap-2'>
                    <input type='checkbox' id='udyamVerified' name='udyamVerified' checked={formData.udyamVerified} onChange={handleInputChange} />
                    <Label htmlFor='udyamVerified' className='flex items-center gap-1 cursor-pointer'>
                      <ShieldCheck className='h-4 w-4' /> Udyam Registration is Verified
                    </Label>
                  </div>
                  {formData.udyamVerified && (
                    <div>
                      <Label htmlFor='udyamNumber'>Udyam Registration Number</Label>
                      <Input id='udyamNumber' name='udyamNumber' value={formData.udyamNumber} onChange={handleInputChange} />
                    </div>
                  )}
                  <div className='flex items-center gap-2'>
                    <input type='checkbox' id='googleBusinessVerified' name='googleBusinessVerified' checked={formData.googleBusinessVerified} onChange={handleInputChange} />
                    <Label htmlFor='googleBusinessVerified' className='flex items-center gap-1 cursor-pointer'>
                      <Star className='h-4 w-4' /> Google Business Profile is Verified
                    </Label>
                  </div>
                  {formData.googleBusinessVerified && (
                    <div>
                      <Label htmlFor='googleBusinessUrl'>Google Business Profile Share Link</Label>
                      <Input id='googleBusinessUrl' name='googleBusinessUrl' value={formData.googleBusinessUrl} onChange={handleInputChange} placeholder='https://share.google/...' />
                    </div>
                  )}
                  <div className='flex justify-between'>
                    <Button variant='outline' onClick={() => setMode('choose')}>Back</Button>
                    <Button onClick={nextStep}>Next</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle>Contact Details & Login</CardTitle>
                  <CardDescription>How can customers reach you? This email will be your login ID.</CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <div>
                    <Label htmlFor='primaryPhone'>Primary Phone *</Label>
                    <Input id='primaryPhone' name='primaryPhone' value={formData.primaryPhone} onChange={handleInputChange} required />
                  </div>
                  <div>
                    <Label htmlFor='secondaryPhone'>Secondary Phone</Label>
                    <Input id='secondaryPhone' name='secondaryPhone' value={formData.secondaryPhone} onChange={handleInputChange} />
                  </div>
                  <div>
                    <Label htmlFor='email'>Login ID / Username * (e.g. admin or admin@shop.com)</Label>
                    <Input id='email' name='email' type='text' autoComplete='username' placeholder='admin or admin@shop.com' value={formData.email} onChange={handleInputChange} required />
                    <p className='text-xs text-gray-500 mt-1'>You can use a simple username like 'admin' or an email address</p>
                  </div>
                  <div>
                    <Label htmlFor='address'>Business Address *</Label>
                    <Textarea id='address' name='address' value={formData.address} onChange={handleInputChange} required />
                  </div>
                  <div>
                    <Label htmlFor='instagram'>Instagram Handle</Label>
                    <Input id='instagram' name='instagram' value={formData.instagram} onChange={handleInputChange} />
                    <Label htmlFor='instagram'>Instagram Handle (without @)</Label>
                    <div className='relative mt-1'>
                      <span className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-semibold'>@</span>
                      <Input
                        id='instagram'
                        name='instagram'
                        placeholder='your_store_handle'
                        className='pl-7'
                        value={formData.instagram}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor='whatsappNumber'>WhatsApp Number</Label>
                    <Input id='whatsappNumber' name='whatsappNumber' value={formData.whatsappNumber} onChange={handleInputChange} />
                  </div>
                  <div>
                    <Label htmlFor='password'>Login Password *</Label>
                    <Input id='password' name='password' type='password' value={formData.password} onChange={handleInputChange} required />
                    <p className='text-xs text-gray-500 mt-1'>Use this password to login to your admin panel</p>
                  </div>
                  <div>
                    <Label htmlFor='confirmPassword'>Confirm Password *</Label>
                    <Input id='confirmPassword' name='confirmPassword' type='password' value={formData.confirmPassword} onChange={handleInputChange} required />
                  </div>
                  <div className='p-3.5 bg-blue-50/70 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900/50 space-y-3 mt-2'>
                    <div>
                      <Label htmlFor='securityQuestion' className='text-xs font-bold text-blue-900 dark:text-blue-300'>
                        🔐 Password Recovery Security Question *
                      </Label>
                      <select
                        id='securityQuestion'
                        name='securityQuestion'
                        className='w-full h-9 px-3 py-1.5 border rounded-md text-xs bg-background mt-1 font-medium'
                        value={formData.securityQuestion}
                        onChange={handleInputChange}
                      >
                        <option value="What was the name of your first school?">What was the name of your first school? (पहले स्कूल का नाम)</option>
                        <option value="What is your secret childhood nickname?">What is your secret childhood nickname? (बच बचपन का निकनेम)</option>
                        <option value="What is the birth city of your mother?">What is the birth city of your mother? (माता जी का जन्म शहर)</option>
                        <option value="What was the registration number of your first vehicle?">What was the registration number of your first vehicle? (पहली गाड़ी का नंबर)</option>
                        <option value="What is your favorite childhood food?">What is your favorite childhood food? (पसंदीदा बचपन का खाना)</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor='securityAnswer' className='text-xs font-bold text-blue-900 dark:text-blue-300'>
                        Security Answer *
                      </Label>
                      <Input
                        id='securityAnswer'
                        name='securityAnswer'
                        placeholder='e.g. Lucknow, Model High School (याद रखने योग्य उत्तर)'
                        value={formData.securityAnswer}
                        onChange={handleInputChange}
                        required
                        className='h-9 text-xs mt-1'
                      />
                      <p className='text-[11px] text-blue-700 dark:text-blue-400 mt-1'>
                        Agar aap apna Master Admin password bhool jayenge, toh is sawal ka jawab dekar naya password reset kar sakenge.
                      </p>
                    </div>
                  </div>
                  <div className='flex justify-between'>
                    <Button variant='outline' onClick={prevStep}>Back</Button>
                    <Button onClick={nextStep}>Next</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle>Branding & Documents</CardTitle>
                  <CardDescription>Upload your logo and signature (optional)</CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <div>
                    <Label>Business Logo</Label>
                    <div className='flex items-center gap-2 mt-1'>
                      <Input type='file' accept='image/*' onChange={(e) => handleFileUpload(e, 'logo')} />
                      {formData.logoUrl && <span className='text-xs text-green-600'>Uploaded</span>}
                    </div>
                    <p className='text-xs text-gray-500'>Used on homepage, invoices, and everywhere. You can change it later in Settings.</p>
                  </div>
                  <div>
                    <Label>Owner Signature</Label>
                    <div className='flex items-center gap-2 mt-1'>
                      <Input type='file' accept='image/*' onChange={(e) => handleFileUpload(e, 'signature')} />
                      {formData.signatureUrl && <span className='text-xs text-green-600'>Uploaded</span>}
                    </div>
                    <p className='text-xs text-gray-500'>Will appear on invoices. You can add it later in Settings.</p>
                  </div>
                  <div className='flex justify-between'>
                    <Button variant='outline' onClick={prevStep}>Back</Button>
                    <Button onClick={nextStep}>Next</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 4 && (
              <Card>
                <CardHeader>
                  <CardTitle>Bank Details & Terms</CardTitle>
                  <CardDescription>Add your bank account for invoices and set terms & conditions</CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <div>
                    <Label htmlFor='bankName'>Bank Name</Label>
                    <Input id='bankName' name='bankName' value={formData.bankName} onChange={handleInputChange} />
                  </div>
                  <div>
                    <Label htmlFor='accountHolderName'>Account Holder Name</Label>
                    <Input id='accountHolderName' name='accountHolderName' value={formData.accountHolderName} onChange={handleInputChange} />
                  </div>
                  <div>
                    <Label htmlFor='accountNumber'>Account Number</Label>
                    <Input id='accountNumber' name='accountNumber' value={formData.accountNumber} onChange={handleInputChange} />
                  </div>
                  <div>
                    <Label htmlFor='ifscCode'>IFSC Code</Label>
                    <Input id='ifscCode' name='ifscCode' value={formData.ifscCode} onChange={handleInputChange} />
                  </div>
                  <div>
                    <Label htmlFor='termsAndConditionsSale'>Terms & Conditions for Sales</Label>
                    <Textarea id='termsAndConditionsSale' name='termsAndConditionsSale' value={formData.termsAndConditionsSale} onChange={handleInputChange} rows={3} placeholder='Terms when selling phones...' />
                  </div>
                  <div>
                    <Label htmlFor='termsAndConditionsPurchase'>Terms & Conditions for Purchase</Label>
                    <Textarea id='termsAndConditionsPurchase' name='termsAndConditionsPurchase' value={formData.termsAndConditionsPurchase} onChange={handleInputChange} rows={3} placeholder='Terms when buying phones...' />
                  </div>
                  <div className='flex justify-between'>
                    <Button variant='outline' onClick={prevStep}>Back</Button>
                    <Button onClick={handleSubmit} disabled={submitting}>
                      {submitting ? 'Saving...' : 'Complete Setup'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {mode === 'restore' && (
          <Card>
            <CardHeader>
              <CardTitle>Restore from Backup</CardTitle>
              <CardDescription>Restore from Google Drive cloud storage or upload a backup file (.zip or .tar.gz)</CardDescription>
            </CardHeader>
            <CardContent className='space-y-5'>
              {/* Cloud / Google Drive Backups */}
              {cloudBackups && cloudBackups.length > 0 && (
                <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                      <Cloud className="h-4 w-4 text-blue-600" />
                      Detected Google Drive Cloud Backups ({cloudBackups.length})
                    </div>
                    <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-700/50 font-bold">
                      Cloud Connected
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Found backups in <code className="bg-white/80 dark:bg-slate-900 px-1 py-0.5 rounded text-[10px]">{cloudTargetDir}</code>. 1-click restore:
                  </p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {cloudBackups.map((b: any) => (
                      <div key={b.name} className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-lg border text-xs">
                        <div className="flex flex-col truncate mr-2">
                          <span className="font-mono truncate font-semibold text-slate-800 dark:text-slate-100">{b.name}</span>
                          <span className="text-[10px] text-gray-500">
                            {(b.sizeBytes / (1024 * 1024)).toFixed(2)} MB {b.modifiedAt ? `• ${new Date(b.modifiedAt).toLocaleDateString()}` : ''}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white shrink-0 gap-1"
                          onClick={() => handleRestoreCloudBackup(b.name)}
                          disabled={restoring}
                        >
                          <RotateCcw className="h-3 w-3" />
                          {restoringCloudName === b.name ? 'Restoring...' : 'Restore This'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Divider if cloud backups found */}
              {cloudBackups && cloudBackups.length > 0 && (
                <div className="relative text-center">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-800"></div></div>
                  <span className="relative bg-white dark:bg-[#0c1322] px-3 text-[11px] text-muted-foreground uppercase font-semibold">
                    Or Upload Backup File Manually
                  </span>
                </div>
              )}

              <div>
                <Label htmlFor='restoreFile'>Upload Backup File (.tar.gz / .zip)</Label>
                <Input
                  id='restoreFile'
                  type='file'
                  accept='.zip,.tar.gz'
                  onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                  ref={fileInputRef}
                  className="mt-1"
                />
                <p className='text-xs text-gray-500 mt-1'>Select the backup file downloaded from drive.google.com or exported from Admin Panel</p>
              </div>

              {/* Strategy Choice */}
              <div className="space-y-2 pt-2">
                <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block">
                  1. Restore Strategy
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setRestoreStrategy('replace')}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      restoreStrategy === 'replace'
                        ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/30'
                        : 'border-gray-200 dark:border-slate-800 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-bold text-xs text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                        <Trash2 className="h-3.5 w-3.5 text-blue-600" />
                        Clean Replace (Fresh Start)
                      </div>
                      {restoreStrategy === 'replace' && (
                        <Badge className="text-[9px] px-1.5 py-0 h-4 bg-blue-600">Recommended</Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Deletes old data permanently &amp; restores fresh from backup. Ensures zero duplicate records.
                    </p>
                  </div>

                  <div
                    onClick={() => setRestoreStrategy('merge')}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      restoreStrategy === 'merge'
                        ? 'border-emerald-600 bg-emerald-50/40 dark:bg-emerald-950/30'
                        : 'border-gray-200 dark:border-slate-800 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-bold text-xs text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                        Smart Merge (Keep Current)
                      </div>
                      {restoreStrategy === 'merge' && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-emerald-600 text-emerald-600">Selected</Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Keeps existing records and merges backup entries. Existing data will not be deleted.
                    </p>
                  </div>
                </div>
              </div>

              {/* Wipe Cloud Toggle if replace */}
              {restoreStrategy === 'replace' && (
                <div className="flex items-center space-x-2 bg-blue-50/50 dark:bg-blue-950/30 p-2.5 rounded-lg border border-blue-200 dark:border-blue-900/50">
                  <input
                    type="checkbox"
                    id="wipeBeforeRestore"
                    checked={wipeBeforeRestore}
                    onChange={(e) => setWipeBeforeRestore(e.target.checked)}
                    className="rounded border-slate-700 text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <Label htmlFor="wipeBeforeRestore" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer font-medium">
                    Wipe old cloud records &amp; photos first in Supabase (Recommended: frees storage quota)
                  </Label>
                </div>
              )}

              {/* Granular Entity Selection */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    2. Customize What to Restore
                  </Label>
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
                    className="text-[11px] text-blue-600 hover:underline font-medium"
                  >
                    {Object.values(selectedEntities).every(Boolean) ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { id: 'settings', label: 'Store Settings & Branding', desc: 'Shop details, signature, API keys', icon: Settings, color: 'text-amber-500' },
                    { id: 'phones', label: 'Phones Inventory', desc: 'Stock, sold devices, IMEIs, photos', icon: Smartphone, color: 'text-blue-500' },
                    { id: 'sellers', label: 'Sellers Database', desc: 'Seller profiles, Aadhaar photos', icon: Users, color: 'text-violet-500' },
                    { id: 'customers', label: 'Customers Database', desc: 'Customer directory & contacts', icon: UserCheck, color: 'text-emerald-500' },
                    { id: 'dealers', label: 'B2B Dealers & Batches', desc: 'Dealer batches, wholesale purchases', icon: Building2, color: 'text-cyan-500' },
                    { id: 'repairs', label: 'Workshop Repairs', desc: 'Repair job sheets & repair clients', icon: Wrench, color: 'text-orange-500' },
                    { id: 'returns', label: 'Sales Returns', desc: 'Device returns & refund records', icon: RotateCcw, color: 'text-rose-500' },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isChecked = !!selectedEntities[item.id];
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedEntities(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                        className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                          isChecked
                            ? 'border-blue-500/40 bg-blue-50/30 dark:bg-blue-950/20'
                            : 'border-gray-200 dark:border-slate-800 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => setSelectedEntities(prev => ({ ...prev, [item.id]: e.target.checked }))}
                          className="mt-0.5 rounded text-blue-600 h-3.5 w-3.5"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${item.color}`} />
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-800 dark:text-gray-200 text-[11px]">{item.label}</div>
                          <div className="text-[10px] text-gray-500 truncate">{item.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Real-time Upload Progress & Live Terminal Logs */}
              {restoring && (
                <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/40 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
                      {uploadProgress < 100 ? (
                        <Upload className="h-4 w-4 animate-bounce text-blue-600" />
                      ) : (
                        <RefreshCw className="h-4 w-4 animate-spin text-amber-500" />
                      )}
                      {restoreStatusText}
                    </span>
                    <span className="font-mono font-bold text-xs text-blue-900 dark:text-blue-200">{uploadProgress}%</span>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-300 ${
                        uploadProgress < 100 ? 'bg-blue-600' : 'bg-emerald-500 animate-pulse'
                      }`}
                      style={{ width: `${Math.max(uploadProgress, 4)}%` }}
                    />
                  </div>

                  {/* Real-Time Terminal Logs Output */}
                  <div className="bg-slate-900 text-slate-200 p-3 rounded-lg font-mono text-[11px] max-h-40 overflow-y-auto space-y-1 border border-slate-800 shadow-inner">
                    {restoreLogs.map((log, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 leading-relaxed">
                        <span className="text-slate-500 select-none">&gt;</span>
                        <span className={log.includes('✅') ? 'text-emerald-400 font-bold' : log.includes('❌') ? 'text-rose-400 font-bold' : log.includes('100%') ? 'text-amber-300 font-semibold' : 'text-slate-300'}>
                          {log}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className='flex justify-between pt-3 border-t'>
                <Button variant='outline' onClick={() => setMode('choose')}>Back</Button>
                <Button
                  onClick={handleRestore}
                  disabled={restoring || !restoreFile || Object.values(selectedEntities).every((v) => !v)}
                  className={restoreStrategy === 'replace' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}
                >
                  {restoring && !restoringCloudName ? 'Restoring...' : `Confirm & Restore (${Object.values(selectedEntities).filter(Boolean).length} Selected)`}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Setup;
