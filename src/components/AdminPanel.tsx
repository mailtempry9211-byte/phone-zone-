
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, LogOut, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import AdminDashboard from "./admin/AdminDashboard";
import PasswordChangeDialog from "./admin/PasswordChangeDialog";
import AuthDialog from "./admin/AuthDialog";
import StorageUsageCard from "./admin/StorageUsageCard";
import FinancialYearSwitcher from "./admin/FinancialYearSwitcher";
import { ReflectPreviousYearDialog } from "./admin/ReflectPreviousYearDialog";
import UniversalScanner from "./admin/UniversalScanner";
import { useAuth } from "@/hooks/useAuth";
import { useFinancialYear } from "@/hooks/useFinancialYear";
import ErrorBoundary from "@/components/ErrorBoundary";
import { createOfflineSupabase } from "@/lib/data/offlineSupabase";
import { supabase } from "@/integrations/supabase/client";
import { isOfflineMode } from "@/lib/data/config";

/** Build the online Supabase client for the AdminPanel login flow. */
function createOnlineSupabase() {
  return supabase;
}

interface AdminPanelProps {
  onBack: () => void;
  initialDepartment?: "sales" | "repairs" | "management" | "all";
}

const AdminPanel = ({ onBack, initialDepartment = "sales" }: AdminPanelProps) => {
  const [email, setEmail] = useState("admin");
  const [password, setPassword] = useState("");
  const [isLoginPending, setIsLoginPending] = useState(false);
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
    } catch (err: any) {
      toast.error(err.message || "Login failed. Is the backend running?");
    } finally {
      setIsLoginPending(false);
    }
  };

  const handleLogout = async () => {
    setPassword("");
    if (user) {
      await signOut();
    }
    toast.success("Logged out successfully");
  };

  // Require Supabase authentication for admin access
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
          <div className="flex items-center mb-6">
            <Button variant="ghost" onClick={onBack} className="p-0 mr-4">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-2xl font-bold">Admin Login</h2>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <Label htmlFor="email">Username or Email</Label>
              <Input
                id="email"
                type="text"
                autoComplete="username"
                placeholder="admin or name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoginPending}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoginPending}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoginPending}>
              {isLoginPending ? "Signing in..." : "Sign in"}
            </Button>
            <p className="text-xs text-gray-500 text-center">
              {isOfflineMode()
                ? "Signing in to the local PhoneZone backend..."
                : "Signing in to PhoneZone via Supabase..."}
            </p>
          </form>
          
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-gray-600 mb-2">Or sign in with Supabase Auth:</p>
            <AuthDialog />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">PhoneZone Admin</h1>
              <p className="text-gray-600 text-sm sm:text-base">Management Panel</p>
              {user && (
                <p className="text-sm text-blue-600 break-all">Signed in as: {user.email}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <FinancialYearSwitcher />
              <UniversalScanner />
              <StorageUsageCard compact />
              <PasswordChangeDialog />
              <Button variant="outline" size="sm" onClick={onBack} className="h-9">
                Back to Store
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout} disabled={!user} className="h-9">
                <LogOut className="h-4 w-4 mr-1.5" />
                Log out
              </Button>
            </div>
          </div>
        </div>
      </div>

      {isPreviousYear && (
        <div className="bg-amber-600 text-white px-4 py-2.5 shadow-sm flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-200" />
            <span>
              <strong>Previous Financial Year Mode ({active?.label}):</strong> You are viewing an older financial year. The current active book is <strong>{latestYear}</strong>.
            </span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="bg-white text-amber-900 hover:bg-amber-50 h-7 text-xs font-semibold"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("phonezone:previous-year-change", {
                  detail: { fromYear: active?.label, toYear: latestYear || undefined },
                })
              );
            }}
          >
            <RefreshCw className="h-3 w-3 mr-1 text-amber-700" /> Reflect / Carry Forward to {latestYear}
          </Button>
        </div>
      )}

      <ReflectPreviousYearDialog />
      
      <ErrorBoundary>
        <AdminDashboard initialDepartment={initialDepartment} />
      </ErrorBoundary>
    </div>
  );
};

export default AdminPanel;
