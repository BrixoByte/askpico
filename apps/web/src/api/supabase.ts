import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;

// Guest users get an anonymous Supabase session, created ONLY when the user taps
// "Continue as guest". Their data is kept for 7 days of inactivity, then removed.
export const createGuestSession = async (): Promise<Session | null> => {
  if (!supabase) return null;
  const { data: current } = await supabase.auth.getSession();
  if (current.session) return current.session;
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.error('guest sign-in failed', error.message);
    return null;
  }
  return anon.session;
};

export const isSignedInSession = async (): Promise<boolean> => {
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  return !!data.session && !data.session.user.is_anonymous;
};

// Never creates a session. Signed-out users send no Authorization header.
export const getAccessToken = async (): Promise<string | null> => {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
};
