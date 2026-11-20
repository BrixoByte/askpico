import { supabase, getUserPlan } from './supabase.js';
import { chooseMode, grantMode } from './routing.js';

// Resolves the tier a request may use: picks a start tier, applies the user's plan cap,
// then reserves quota in Supabase, downgrading when the user or global daily cap is full.
export const resolveRoutingMode = async ({ userId, requested, message, attachmentCount = 0 }) => {
  const plan = await getUserPlan(userId);
  const startMode = chooseMode({ requested, message, attachmentCount });
  return grantMode({
    rpc: (name, args) => supabase.rpc(name, args),
    userId,
    plan,
    startMode,
  });
};
