import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in services/api/.env');
}

export const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const getUserPlan = async (userId) => {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('plan, expires_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`plan read failed: ${error.message}`);
  if (!data || (data.expires_at && new Date(data.expires_at) < new Date())) return 'free';
  return data.plan;
};

export const getUserBrain = async (userId) => {
  const { data, error } = await supabase
    .from('user_brain')
    .select('items')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`memory read failed: ${error.message}`);
  return Array.isArray(data?.items) ? data.items : [];
};

export const saveUserBrain = async (userId, items) => {
  const { error } = await supabase
    .from('user_brain')
    .upsert({ user_id: userId, items, updated_at: new Date().toISOString() });
  if (error) throw new Error(`memory save failed: ${error.message}`);
};

export const getUserTheme = async (userId) => {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('theme')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`preferences read failed: ${error.message}`);
  return data?.theme ?? null;
};

export const saveUserTheme = async (userId, theme) => {
  const { error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: userId, theme, updated_at: new Date().toISOString() });
  if (error) throw new Error(`preferences save failed: ${error.message}`);
};

export const getUserFromToken = async (token) => {
  if (typeof token !== 'string' || token.length === 0) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
};
