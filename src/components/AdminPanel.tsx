
import React, { useState, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { LogoutBackupDialog } from "./admin/LogoutBackupDialog";
import { ForgotPasswordDialog } from "./admin/ForgotPasswordDialog";
import AuthDialog from "./admin/AuthDialog";
import { ReflectPreviousYearDialog } from "./admin/ReflectPreviousYearDialog";
import { useAuth } from "@/hooks/useAuth";
import { useFinancialYear } from "@/hooks/useFinancialYear";
import ErrorBoundary from "@/components/ErrorBoundary";
import { createOfflineSupabase } from "@/lib/data/offlineSupabase";
import { supabase } from "@/integrations/supabase/client";
import { isOfflineMode } from "@/lib/data";

// Lazy-load AdminDashboard so unauthenticated users or public visitors never download it
const AdminDashboard = React.lazy(() => import("./admin/AdminDashboard"));

/** Build the online Supabase client for the AdminPanel login flow. */
function createOnlineSupabase() {
  return supabase;
}

interface AdminPanelProps {
  onBack: () => void;
  initialDepartment?: "sales" | "repairs" | "management" | "all";
}

const AdminPanel = ({ onBack, initialDepartment = "sales" }: AdminPanelProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoginPending, setIsLoginPending] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [forgotDialogOpen, setForgotDialogOpen] = useState(false);
  const { user, signIn, signOut } = useAuth();
  const { isPreviousYear, active, latestYear } = useFinancialYear();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = (email || "").trim();
    if (!address) {
      toast.error("Enter your username or email");
      return;
    }
    if (!password) {
      toast.error("Enter your password");
      return;
    }
    setIsLoginPending(true);
    try {
      const { error } = await signIn(address, password);
      if (error) {
        toast.error(error.message || "Invalid username or password");
        return;
      }
      toast.success("Logged in successfully");
      setPassword("");
      if (typeof window !== "undefined") {
        sessionStorage.setItem("phonezone_admin_active", "true");
        const url = new URL(window.location.href);
        url.searchParams.set("admin", "1");
        window.history.replaceState({}, "", url.toString());
      }
    } catch (err: any) {
      toast.error(err.message || "Login failed. Is the backend running?");
    } finally {
      setIsLoginPending(false);
    }
  };

  const handleLogout = async () => {
    setPassword("");
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("phonezone_admin_active");
      sessionStorage.removeItem("phonezone_admin_tab");
      const url = new URL(window.location.href);
      url.searchParams.delete("admin");
      url.searchParams.delete("tab");
      window.history.replaceState({}, "", url.toString());
    }
    if (user) {
      await signOut();
    }
    toast.success("Logged out successfully");
    onBack();
  };

  // Require Supabase authentication for admin access
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 text-slate-100 p-8 rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center mb-6">
            <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-400 hover:text-white p-1.5 mr-3 rounded-lg">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">Admin Login</h2>
              <p className="text-xs text-slate-400">PhoneZone Management Console</p>
            </div>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <Label htmlFor="email" className="text-xs font-bold text-slate-200">Username or Email</Label>
              <Input
                id="email"
                type="text"
                autoComplete="username"
                placeholder="admin or name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoginPending}
                required
                className="mt-1 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="password" className="text-xs font-bold text-slate-200">Password</Label>
                <button
                  type="button"
                  onClick={() => setForgotDialogOpen(true)}
                  className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer"
                >
                  Forgot Password? (पासवर्ड भूल गए?)
                </button>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoginPending}
                required
                className="mt-1 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
            <Button type="submit" className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold h-10 shadow-lg shadow-cyan-600/20" disabled={isLoginPending}>
              {isLoginPending ? "Signing in..." : "Sign in"}
            </Button>
            <p className="text-xs text-slate-400 text-center font-medium">
              {isOfflineMode()
                ? "Signing in to local PhoneZone secure database"
                : "Signing in to PhoneZone via Supabase Auth"}
            </p>
          </form>
          
          <div className="mt-4 pt-4 border-t border-slate-800">
            <p className="text-xs text-slate-400 mb-2">Or sign in with Supabase Auth:</p>
            <AuthDialog />
          </div>

          <ForgotPasswordDialog
            open={forgotDialogOpen}
            onOpenChange={setForgotDialogOpen}
            initialEmail={email}
            onPasswordResetSuccess={(resetEmail) => {
              setEmail(resetEmail);
              setPassword("");
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {isPreviousYear && (
        <div className="bg-amber-600 text-white px-4 py-2 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-200" />
            <span>
              <strong>Previous Financial Year Mode ({active?.label}):</strong> Older financial year active. Current active book is <strong>{latestYear}</strong>.
            </span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="bg-white text-amber-900 hover:bg-amber-50 h-6 text-xs font-semibold px-2 py-0"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("phonezone:previous-year-change", {
                  detail: { fromYear: active?.label, toYear: latestYear || undefined },
                })
              );
            }}
          >
            <RefreshCw className="h-3 w-3 mr-1 text-amber-700" /> Reflect to {latestYear}
          </Button>
        </div>
      )}

      <ReflectPreviousYearDialog />
      <LogoutBackupDialog
        open={logoutDialogOpen}
        onOpenChange={setLogoutDialogOpen}
        onConfirmLogout={handleLogout}
      />
      
      <ErrorBoundary>
        <Suspense
          fallback={
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-cyan-400 font-mono">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400 mb-3" />
              <p className="text-xs">Loading Management Console...</p>
            </div>
          }
        >
          <AdminDashboard
            initialDepartment={initialDepartment}
            onBack={onBack}
            user={user}
            onOpenLogout={() => setLogoutDialogOpen(true)}
          />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
};

export default AdminPanel;
