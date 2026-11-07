
import React, { Suspense, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import ErrorBoundary from "@/components/ErrorBoundary";


// Lazy-load secondary routes to keep the initial load ultra-fast on mobile phones
const Setup = React.lazy(() => import("./pages/Setup"));
const TrackRepair = React.lazy(() => import("./pages/TrackRepair"));
const OAuthConsent = React.lazy(() => import("./pages/OAuthConsent"));
const MobileEmulator = React.lazy(() => import("./pages/MobileEmulator"));
const NotFound = React.lazy(() => import("./pages/NotFound"));

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
        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.get("force") === "1" || searchParams.get("reconfigure") === "1") {
          setSetupComplete(false);
          return;
        }
        const res = await fetch("/api/setup/status", {
          credentials: "include",
          headers: { "ngrok-skip-browser-warning": "true" },
        });
        if (res.ok) {
          const status = await res.json();
          setSetupComplete(status.setupCompleted !== false);
        } else {
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
          <ErrorBoundary label="PhoneZone Application">
            <Suspense fallback={
              <div className="min-h-screen flex items-center justify-center bg-slate-950 text-cyan-400">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400"></div>
              </div>
            }>
              <Routes>
                {setupComplete === false ? (
                  <>
                    <Route path="/setup" element={<Setup />} />
                    <Route path="*" element={<Navigate to="/setup" replace />} />
                  </>
                ) : (
                  <>
                    <Route path="/" element={<Index />} />
                    <Route path="/setup" element={<Setup />} />
                    <Route path="/mobile-preview" element={<MobileEmulator />} />
                    <Route path="/preview" element={<MobileEmulator />} />
                    <Route path="/emulator" element={<MobileEmulator />} />
                    <Route path="/track" element={<TrackRepair />} />
                    <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
                    <Route path="*" element={<NotFound />} />
                  </>
                )}
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
