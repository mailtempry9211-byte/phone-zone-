import React from 'react';
import { ArrowLeft, ArrowRight, RotateCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';

export const DesktopNavControls: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isElectron = typeof window !== 'undefined' && (
    /electron/i.test(navigator.userAgent) ||
    Boolean((window as any).process?.versions?.electron)
  );

  // In standard web browser on root homepage, StorefrontTopBar already provides native Back & Refresh
  if (!isElectron && location.pathname === '/') {
    return null;
  }

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate('/');
    }
  };

  const handleForward = () => {
    window.history.forward();
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="bg-slate-900 text-white text-xs px-3 py-1.5 flex items-center justify-between border-b border-slate-800 shadow-sm sticky top-0 z-50 select-none">
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          title="Back (Alt + Left Arrow)"
          className="h-7 px-2 text-slate-300 hover:text-white hover:bg-slate-800 gap-1 text-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Back</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleForward}
          title="Forward (Alt + Right Arrow)"
          className="h-7 px-2 text-slate-300 hover:text-white hover:bg-slate-800 gap-1 text-xs"
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          title="Refresh App (F5 / Ctrl + R)"
          className="h-7 px-2 text-slate-300 hover:text-white hover:bg-slate-800 gap-1 text-xs"
        >
          <RotateCw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>

        <div className="h-4 w-[1px] bg-slate-700 mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          title="Store Homepage"
          className="h-7 px-2 text-slate-300 hover:text-white hover:bg-slate-800 gap-1 text-xs"
        >
          <Home className="h-3.5 w-3.5" />
          <span>Home</span>
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] text-emerald-400 font-mono inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          PhoneZone Secured
        </span>
      </div>
    </div>
  );
};
