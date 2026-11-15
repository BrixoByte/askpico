import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;

// Guest users get an anonymous Supabase session without sign-up.
// Their data is kept for 7 days of inactivity, then removed by the server.
const verifiedTokens = new Map<string, Promise<boolean>>();

const isServerValid = (token: string): Promise<boolean> => {
  let check = verifiedTokens.get(token);
  if (!check) {
    check = supabase!.auth.getUser(token).then(({ error }) => !error);
    verifiedTokens.set(token, check);
  }
  return check;
};

export const ensureSession = async (): Promise<Session | null> => {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    if (await isServerValid(data.session.access_token)) return data.session;
    verifiedTokens.clear();
    await supabase.auth.signOut({ scope: 'local' });
  }
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

export const getAccessToken = async (): Promise<string | null> => {
  const session = await ensureSession();
  return session?.access_token ?? null;
};
