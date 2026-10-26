
import React from "react";
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Setup from "./pages/Setup";
import TrackRepair from "./pages/TrackRepair";
import OAuthConsent from "./pages/OAuthConsent";
import NotFound from "./pages/NotFound";

// Transparently bypass ngrok free browser warning page on all API requests
if (typeof window !== "undefined" && window.fetch) {
  const originalFetch = window.fetch;
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    const headers = new Headers(init?.headers || {});
    if (!headers.has("ngrok-skip-browser-warning")) {
      headers.set("ngrok-skip-browser-warning", "true");
    }
    return originalFetch(input, { ...init, headers });
  };
}

const queryClient = new QueryClient();

const App: React.FC = () => {
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);

  useEffect(() => {
    const checkSetup = async () => {
      try {
        const res = await fetch("/api/setup/status", {
          credentials: "include",
          headers: { "ngrok-skip-browser-warning": "true" },
        });
        if (res.ok) {
          const status = await res.json();
          // If setup completed is explicitly false AND required info is missing, show setup
          setSetupComplete(status.setupCompleted !== false);
        } else {
          // If status returns error (e.g. remote tunnel access), do NOT wipe to setup wizard
          setSetupComplete(true);
        }
      } catch {
        setSetupComplete(true);
      }
    };
    checkSetup();
  }, []);

  if (setupComplete === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {!setupComplete && <Route path="/setup" element={<Setup />} />}
            {!setupComplete && <Route path="*" element={<Navigate to="/setup" replace />} />}
            {setupComplete && <Route path="/" element={<Index />} />}
            <Route path="/track" element={<TrackRepair />} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
