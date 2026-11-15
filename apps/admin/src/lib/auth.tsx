import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from './supabase';
import { adminFetch } from './api';

interface AuthState {
  loading: boolean;
  isAdmin: boolean;
  email: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  loading: true,
  isAdmin: false,
  email: null,
  signOut: async () => undefined,
});

export const useAuth = () => useContext(AuthContext);

// Admin access is always verified server-side via /api/admin/check — a
// forged client cannot elevate itself because the API re-reads profiles.role.
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<Omit<AuthState, 'signOut'>>({
    loading: true,
    isAdmin: false,
    email: null,
  });

  useEffect(() => {
    const sb = supabase;
    if (!sb) {
      setState({ loading: false, isAdmin: false, email: null });
      return;
    }
    let mounted = true;
    const verify = async () => {
      try {
        const { data } = await sb.auth.getSession();
        if (!data.session) {
          if (mounted) setState({ loading: false, isAdmin: false, email: null });
          return;
        }
        const check = await adminFetch<{ admin: boolean; email: string | null }>('/check');
        if (mounted) {
          setState({
            loading: false,
            isAdmin: check.admin === true,
            email: check.email ?? data.session.user.email ?? null,
          });
        }
      } catch {
        if (mounted) setState({ loading: false, isAdmin: false, email: null });
      }
    };
    void verify();
    const { data: listener } = sb.auth.onAuthStateChange(() => void verify());
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase?.auth.signOut();
    setState({ loading: false, isAdmin: false, email: null });
  };

  return <AuthContext.Provider value={{ ...state, signOut }}>{children}</AuthContext.Provider>;
};
