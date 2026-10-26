
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
            setUser({ id: me.id, email: me.email } as any);
            setSession({ user: { id: me.id, email: me.email } } as any);
          }
        })
        .catch(() => { /* not logged in yet */ });
      return;
    }

    // Online mode: use Supabase auth state listener.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
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
            setUser({ id: me.id, email: me.email } as any);
            setSession({ user: { id: me.id, email: me.email } } as any);
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
