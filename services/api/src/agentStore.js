import { supabase } from './supabase.js';

const HISTORY_ROW_LIMIT = 10;

export const recentAgentMessages = async (userId, agentId, chatId, limit = HISTORY_ROW_LIMIT) => {
  const { data, error } = await supabase
    .from('agent_messages')
    .select('role, content')
    .eq('user_id', userId)
    .eq('agent_id', agentId)
    .eq('chat_id', chatId)
    .order('id', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`history read failed: ${error.message}`);
  return (data ?? []).reverse();
};

export const saveAgentMessages = async (userId, agentId, chatId, turn, messages) => {
  const rows = messages.map((m) => ({
    user_id: userId,
    agent_id: agentId,
    chat_id: chatId,
    turn,
    role: m.role,
    content: m.content,
  }));
  const { error } = await supabase.from('agent_messages').insert(rows);
  if (error) throw new Error(`history save failed: ${error.message}`);
};

export const truncateAgentMessages = async (userId, chatId, fromTurn) => {
  const { error } = await supabase
    .from('agent_messages')
    .delete()
    .eq('user_id', userId)
    .eq('chat_id', chatId)
    .gte('turn', fromTurn);
  if (error) throw new Error(`history truncate failed: ${error.message}`);
};
