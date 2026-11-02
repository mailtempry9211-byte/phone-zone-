
import { useState, useEffect, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { isOfflineMode } from '@/lib/data/config';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  changePassword: (newPassword: string, currentPassword?: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const formatUser = (me: any) => {
  if (!me) return null;
  const roles = Array.isArray(me.roles)
    ? me.roles
    : me.role
    ? [me.role]
    : me.user_metadata?.roles || me.app_metadata?.roles || [];
  const primaryRole = roles[0] || me.role || "staff";
  const assignedShop = me.assignedShopId || me.shop_id || (roles.includes("admin") ? "all" : "shop_1");
  const isShopLocked = me.isShopLocked !== undefined ? Boolean(me.isShopLocked) : (assignedShop !== "all");
  const activeShop = me.shopId || (isShopLocked ? assignedShop : "all");
  return {
    ...me,
    id: me.id,
    email: me.email,
    displayName: me.displayName || me.display_name || me.user_metadata?.display_name || me.email?.split("@")[0] || "User",
    shopId: activeShop,
    assignedShopId: assignedShop,
    isShopLocked,
    roles,
    role: primaryRole,
    user_metadata: {
      ...(me.user_metadata || {}),
      displayName: me.displayName || me.display_name,
      shopId: activeShop,
      assignedShopId: assignedShop,
      isShopLocked,
      roles,
      role: primaryRole,
    },
    app_metadata: {
      ...(me.app_metadata || {}),
      roles,
      role: primaryRole,
    },
  };
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (isOfflineMode()) {
      // Offline mode: restore session from backend cookie on mount.
      fetch("/api/auth/me", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((me) => {
          if (me) {
            const formatted = formatUser(me);
            setUser(formatted as any);
            setSession({ user: formatted } as any);
          }
        })
        .catch(() => { /* not logged in yet */ });
      return;
    }

    // Online mode: use Supabase auth state listener.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ? (formatUser(session.user) as any) : null);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ? (formatUser(session.user) as any) : null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (isOfflineMode()) {
      // Offline: call the local backend directly.
      // Accepts plain username ("admin") OR email — backend stores whatever
      // the setup wizard saved, so we pass it as-is (trimmed).
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email: email.trim(), password }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          return { error: { message: body.error || "Incorrect username or password." } };
        }
        // Backend sets the session cookie. Re-fetch /me to hydrate React state.
        const meRes = await fetch("/api/auth/me", { credentials: "include" });
        if (meRes.ok) {
          const me = await meRes.json().catch(() => null);
          if (me) {
            const formatted = formatUser(me);
            setUser(formatted as any);
            setSession({ user: formatted } as any);
          }
        }
        return { error: null };
      } catch (err: any) {
        return { error: { message: err.message || "Could not reach the server." } };
      }
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl }
    });
    return { error };
  };

  const signOut = async () => {
    if (isOfflineMode()) {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
      setUser(null);
      setSession(null);
      return;
    }
    await supabase.auth.signOut();
  };

  const changePassword = async (newPassword: string, currentPassword?: string) => {
    if (!session) {
      return { error: { message: "No active session found. Please log in first." } };
    }

    // Route through the backend /auth/change-password endpoint in BOTH modes.
    // Supabase's updateUser() silently ignores currentPassword on the online
    // plan, so calling it there would let anyone change their password without
    // knowing the old one. The backend endpoint always verifies currentPassword.
    //
    // isOfflineMode() (not the raw window flag) is the source of truth: the raw
    // global is only injected by the desktop shell, so in a local dev run this
    // used to fall through to Supabase and fail with "current password is not
    // correct" even though the right password was typed.
    if (isOfflineMode()) {
      try {
        const res = await fetch("/api/auth/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) return { error: { message: body.error || "Failed to change password." } };
        return { error: null };
      } catch (err: any) {
        return { error: { message: err.message || "Could not reach the backend." } };
      }
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword } as any);
    return { error };
  };

  return (
    <AuthContext.Provider value={{ user, session, signIn, signUp, signOut, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
