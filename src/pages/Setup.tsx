import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Store, Upload, History, ShieldCheck, Star } from 'lucide-react';
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
  const [submitting, setSubmitting] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
    try {
      const res = await fetch('/api/setup/status', { credentials: 'include' });
      if (res.ok) {
        const status = await res.json();
        if (status.setupCompleted) {
          navigate('/', { replace: true });
          return;
        }
      }
    } catch (e) {
      // proceed
    }
    setLoading(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
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

  const handleRestore = async () => {
    if (!restoreFile) {
      toast.error('Please select a backup file');
      return;
    }
    setRestoring(true);
    try {
      const fd = new FormData();
      fd.append('backup', restoreFile);
      const res = await fetch('/api/setup/restore', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      if (!res.ok) {
        throw new Error(await readError(res, 'Restore failed'));
      }
      toast.success('Data restored successfully! Welcome back.');
      window.location.replace('/'); // full reload so App re-reads setup status
    } catch (err: any) {
      toast.error(err.message || 'Restore failed');
    } finally {
      setRestoring(false);
    }
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
      toast.success('Setup complete! Welcome to your new business dashboard.');
      window.location.replace('/'); // full reload so App re-reads setup status
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

  const totalSteps = mode === 'new' ? 4 : 1;

  return (
    <div className='min-h-screen bg-gradient-to-b from-blue-50 to-white py-12 px-4'>
      <div className='max-w-2xl mx-auto'>
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
              <CardDescription>Upload your PhoneZone backup file (.zip or .tar.gz)</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div>
                <Label htmlFor='restoreFile'>Backup File</Label>
                <Input
                  id='restoreFile'
                  type='file'
                  accept='.zip,.tar.gz'
                  onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                  ref={fileInputRef}
                />
                <p className='text-xs text-gray-500 mt-1'>Select the backup file you exported from Admin Panel</p>
              </div>
              <div className='flex justify-between'>
                <Button variant='outline' onClick={() => setMode('choose')}>Back</Button>
                <Button onClick={handleRestore} disabled={restoring}>
                  {restoring ? 'Restoring...' : 'Restore Data'}
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
