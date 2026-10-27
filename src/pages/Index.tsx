import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Phone, Mail, Star, Smartphone, Wrench, ShieldCheck, Clock, Instagram, Settings, ExternalLink, Store } from 'lucide-react';
import ContactForm from '@/components/ContactForm';
import FeaturedPhones from '@/components/FeaturedPhones';
import RepairServices from '@/components/RepairServices';
import AdminPanel from '@/components/AdminPanel';
import { data } from '@/lib/data';
import { ContactInfo } from '@/lib/data/types';

const Index: React.FC = () => {
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminDept, setAdminDept] = useState<"sales" | "repairs">("sales");
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContact = async () => {
      try {
        const info = await data.getContactInfo();
        setContact(info);
      } catch (e) {
        console.error('Failed to fetch contact info', e);
      } finally {
        setLoading(false);
      }
    };
    fetchContact();
  }, []);

  if (showAdmin) {
    return <AdminPanel onBack={() => setShowAdmin(false)} initialDepartment={adminDept} />;
  }

  const businessName = contact?.business_name || '';
  const tagline = contact?.business_tagline || '';
  const phone = contact?.phone_primary || '';
  const instagram = contact?.instagram || '';
  const address = contact?.address || '';
  const email = contact?.email || '';

  if (loading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4'></div>
          <p className='text-gray-600'>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gradient-to-b from-blue-50 to-white'>
      {/* Top Trust Bar */}
      <div className='bg-gradient-to-r from-green-600 via-emerald-600 to-blue-600 text-white text-xs sm:text-sm'>
        <div className='container mx-auto px-4 py-2 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-center'>
          {contact?.show_udyam && contact?.udyam_number && (
            <span className='flex items-center gap-1.5 font-medium'>
              <ShieldCheck className='h-4 w-4' />
              Govt. of India Registered • Udyam Reg. No: {contact.udyam_number}
            </span>
          )}
          {contact?.google_business_url &&
            (contact?.show_google_business || contact?.google_business_verified) && (
            <a
              href={contact.google_business_url}
              target='_blank'
              rel='noopener noreferrer'
              className='flex items-center gap-1.5 font-medium underline-offset-2 hover:underline'
            >
              <Star className='h-4 w-4 fill-yellow-300 text-yellow-300' />
              Visit our Verified Google Business Profile
              <ExternalLink className='h-3.5 w-3.5' />
            </a>
          )}
        </div>
      </div>

      {/* Header */}
      <header className='bg-white shadow-sm border-b'>
        <div className='container mx-auto px-4 py-4'>
          <div className='flex flex-col lg:flex-row items-center justify-between gap-4'>
            <div className='flex items-center space-x-4'>
              {contact?.logo_url ? (
                <img src={contact.logo_url} alt='Logo' className='h-16 w-auto md:h-20' />
              ) : (
                <div className='h-16 w-auto flex items-center justify-center'>
                  <Store className='h-10 w-10 text-blue-600' />
                </div>
              )}
              <div className='text-center lg:text-left'>
                <h1 className='text-2xl md:text-3xl font-bold text-gray-900'>{businessName}</h1>
                <p className='text-sm md:text-base text-gray-600'>{tagline}</p>
              </div>
            </div>
            <div className='flex flex-col lg:flex-row items-center space-y-2 lg:space-y-0 lg:space-x-6'>
              <div className='flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4'>
                <div className='flex items-center space-x-2 text-sm text-gray-600'>
                  <Phone className='h-4 w-4' />
                  <span>{phone}</span>
                </div>
                <div className='flex items-center space-x-2 text-sm text-gray-600'>
                  <Instagram className='h-4 w-4' />
                  <span>{instagram ? '@' + instagram : ''}</span>
                </div>
              </div>
              <div className='flex flex-wrap items-center gap-2'>
                <Button
                  size='sm'
                  variant='outline'
                  className='text-indigo-700 border-indigo-200 hover:bg-indigo-50 font-semibold flex items-center gap-1.5'
                  onClick={() => { setAdminDept("repairs"); setShowAdmin(true); }}
                >
                  <Wrench className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Repair Workshop</span>
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  className='text-blue-700 border-blue-200 hover:bg-blue-50 font-semibold flex items-center gap-1.5'
                  onClick={() => { setAdminDept("sales"); setShowAdmin(true); }}
                >
                  <Store className="h-3.5 w-3.5 text-blue-600" />
                  <span>Sales Counter</span>
                </Button>
                <Button size='sm' asChild variant='default' className='bg-blue-600 hover:bg-blue-700'>
                  <a href="/track" className="flex items-center gap-1.5">
                    <Wrench className="h-3.5 w-3.5" />
                    <span>Track Repair</span>
                  </a>
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => setShowAdmin(true)}
                  className='text-gray-500 hover:text-gray-900 flex items-center gap-1.5'
                >
                  <Settings className='h-4 w-4' />
                  <span className='hidden sm:inline'>Admin</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className='py-12 md:py-20 px-4'>
        <div className='container mx-auto text-center'>
          <div className='flex justify-center mb-6'>
            {contact?.logo_url ? (
              <img src={contact.logo_url} alt='Logo' className='h-24 w-auto md:h-32' />
            ) : (
              <Store className='h-24 w-auto md:h-32 text-blue-600' />
            )}
          </div>
          <h1 className='text-3xl md:text-5xl font-bold text-gray-900 mb-6'>
            Welcome to <span className='text-blue-600'>{businessName}</span>
          </h1>
          <p className='text-lg md:text-xl text-gray-600 mb-8 max-w-2xl mx-auto'>
            {tagline || 'Your trusted destination for premium quality used smartphones, expert repairs, and unbeatable deals.'}
          </p>
          <div className='flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4'>
            <Button size='lg' className='bg-blue-600 hover:bg-blue-700'>
              <Smartphone className='mr-2 h-5 w-5' />
              Browse Phones
            </Button>
            <Button size='lg' variant='outline'>
              <Wrench className='mr-2 h-5 w-5' />
              Repair Services
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className='py-16 px-4 bg-gray-50'>
        <div className='container mx-auto'>
          <h2 className='text-2xl md:text-3xl font-bold text-center mb-12'>Why Choose {businessName}?</h2>
          <div className='grid md:grid-cols-3 gap-8'>
            <Card className='text-center'>
              <CardHeader>
                <ShieldCheck className='h-12 w-12 text-blue-600 mx-auto mb-4' />
                <CardTitle>Quality Assured</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Every device is thoroughly tested and verified for authenticity and performance before sale.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className='text-center'>
              <CardHeader>
                <Clock className='h-12 w-12 text-blue-600 mx-auto mb-4' />
                <CardTitle>Quick Service</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Fast repair services and quick phone transactions to get you back up and running in no time.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className='text-center'>
              <CardHeader>
                <Star className='h-12 w-12 text-blue-600 mx-auto mb-4' />
                <CardTitle>Best Prices</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Competitive pricing on all devices and services with transparent, no-hidden-fee policies.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Featured Phones */}
      <FeaturedPhones />

      {/* Repair Services */}
      <RepairServices 
        whatsappNumber={contact?.whatsapp_number || contact?.phone_primary} 
        phonePrimary={contact?.phone_primary} 
      />

      {/* Contact Section */}
      <ContactForm />

      {/* Footer */}
      <footer className='bg-gray-900 text-white py-12 px-4'>
        <div className='container mx-auto text-center'>
          <div className='flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-4 mb-6'>
            {contact?.logo_url ? (
              <img src={contact.logo_url} alt='Logo' className='h-12 w-auto' />
            ) : (
              <div className='h-12 w-auto flex items-center justify-center'>
                <Store className='h-8 w-8 text-blue-400' />
              </div>
            )}
            <div>
              <h3 className='text-xl font-bold'>{businessName}</h3>
              <p className='text-gray-400'>{tagline}</p>
            </div>
          </div>
          <p className='text-gray-400 mb-4'>
            {tagline || 'Your trusted partner for quality smartphones and expert repair services.'}
          </p>
          <div className='flex flex-col sm:flex-row justify-center space-y-2 sm:space-y-0 sm:space-x-6 text-sm'>
            <span>{email}</span>
            <span className='hidden sm:inline'>•</span>
            <span>{phone}</span>
            <span className='hidden sm:inline'>•</span>
            <span>{address}</span>
          </div>
          <div className='mt-4 flex justify-center'>
            {contact?.show_udyam && contact?.udyam_number && (
              <span className='inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-900/40 border border-green-600/50 text-green-300 text-xs sm:text-sm font-medium'>
                <span aria-hidden>✅</span>
                Govt. of India Registered • Udyam Reg. No: {contact.udyam_number}
              </span>
            )}
          </div>
          <div className='mt-8 pt-8 border-t border-gray-800'>
            <p className='text-gray-400'>&copy; {new Date().getFullYear()} {businessName || 'PhoneZone'}. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;