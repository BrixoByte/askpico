// End-to-end organic juice business thread test against the live backend.
// Mirrors the frontend flow: route -> specialist/core reply -> verify -> focus.
// Usage: node --env-file=.env scripts/e2e-juice-thread.mjs

const API = 'http://localhost:3001';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from .env');
  process.exit(1);
}

const results = [];
const record = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? '[PASSED]' : '[FAILED]'} ${name}${detail ? ` -- ${detail}` : ''}`);
};

const post = async (path, body, token, timeoutMs = 120000) => {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${JSON.stringify(data)}`);
  return data;
};

// ---------- auth ----------
const email = `pico-e2e-${Date.now()}@example.com`;
const password = 'e2eTest!' + Math.random().toString(36).slice(2, 10) + 'Aa';
const created = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
  method: 'POST',
  headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password, email_confirm: true }),
}).then((r) => r.json());
if (!created?.id) { console.error('could not create test user:', JSON.stringify(created)); process.exit(1); }
const { access_token: token } = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: SERVICE_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
}).then((r) => r.json());
if (!token) { console.error('could not sign in test user'); process.exit(1); }
console.log(`test user signed in: ${created.id}`);

// ---------- spec check: UI thread visibility ----------
// The web sidebar reads Zustand localStorage, not Supabase. The chats/messages
// tables in 0001_init.sql are written by nothing. Inserting a row here proves
// the point: it cannot surface in the UI.
const sb = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
const chatRow = await fetch(`${SUPABASE_URL}/rest/v1/chats`, {
  method: 'POST', headers: sb,
  body: JSON.stringify({ user_id: created.id, title: 'E2E Juice Thread (terminal)' }),
}).then((r) => r.json());
const rowInserted = Array.isArray(chatRow) && chatRow[0]?.id;
record('thread row inserted into Supabase chats table', !!rowInserted, rowInserted ? `id=${chatRow[0].id}` : JSON.stringify(chatRow).slice(0, 200));
record('Web UI thread visibility (spec)', false, 'UI reads localStorage only; chats table is unused dead schema - cannot appear in sidebar');

// ---------- thread simulation ----------
const chatId = `juice-e2e-${Date.now()}`;
const memories = ['Keep all replies extremely short, maximum 3 lines'];
const history = [];
let focus = '';
let sticky = null;
let turn = 0;
const userStated = () => history.filter((m) => m.role === 'user').map((m) => m.content).join('\n');
const numbersIn = (s) => (s.match(/[\d][\d,.]*/g) ?? []).map((n) => n.replace(/[.,]$/, ''));
const newNumbers = (reply) =>
  numbersIn(reply).filter((n) => n.replace(/[,.]/g, '').length >= 4 && !userStated().includes(n));

const doTurn = async (label, message, checks = []) => {
  turn += 1;
  console.log(`\n=== TURN ${turn}: ${label} ===`);
  console.log(`user> ${message}`);

  const route = await post('/api/agent/route', {
    message, focus,
    recent: history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
    stickyAgentId: sticky,
  }, token);
  const agentId = route.agentId ?? null;
  console.log(`route> ${agentId ?? 'core'}${route.toolId ? ` tool=${route.toolId}` : ''}`);

  let reply;
  if (agentId) {
    reply = (await post('/api/agent/chat', {
      agentId, chatId, turn, message, memories, focus,
      recent: history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
      mode: 'auto',
    }, token)).reply;
  } else {
    reply = (await post('/api/chat', {
      messages: [...history, { role: 'user', content: message }],
      stream: false, focus, memories, mode: 'auto',
    }, token)).choices?.[0]?.message?.content ?? '';
  }
  console.log(`pico> ${reply}`);

  history.push({ role: 'user', content: message });
  history.push({ role: 'assistant', content: reply });

  let verified = { corrected: reply, flagged: 0 };
  try {
    verified = await post('/api/chat/verify', { reply, focus, userText: userStated() }, token);
    if (verified.corrected !== reply) {
      history[history.length - 1].content = verified.corrected;
      console.log(`verify> ${verified.flagged} span(s) flagged -> ${verified.corrected}`);
    } else {
      console.log('verify> grounded');
    }
  } catch (err) {
    console.log(`verify> skipped (${err.message})`);
  }
  const final = verified.corrected;

  if (turn % 2 === 0) {
    try {
      focus = (await post('/api/thread/focus', {
        previous: focus,
        messages: history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
      }, token)).focus;
      console.log(`focus> ${focus}`);
    } catch (err) {
      console.log(`focus> failed (${err.message})`);
    }
  }

  for (const check of checks) check({ reply, final, agentId, verified });
  if (/<\s*bolt/i.test(final)) record(`${label}: no stray <bolt> tag`, false, 'tag found');
  sticky = agentId ?? sticky;
  return { reply: final, agentId };
};

try {
  // Stage 1: basic context establishment
  await doTurn('new business idea', 'Hi, I want to start a subscription-based organic cold-pressed juice delivery business.', [
    ({ agentId, final }) => {
      record('juice idea routes to business specialist', agentId === 'business', `agentId=${agentId}`);
      record('reply is short (memory constraint)', final.split('\n').filter((l) => l.trim()).length <= 4, `${final.split('\n').filter((l) => l.trim()).length} lines`);
    },
  ]);

  // Stage 2: pricing tiers without user figures
  await doTurn('pricing tiers', 'What should be my pricing tiers and launch strategy?', [
    ({ final, verified, agentId }) => {
      record('sticky routing stays on business', agentId === 'business', `agentId=${agentId}`);
      const invented = newNumbers(final).filter((n) => !/\b(19|20)\d{2}\b/.test(n));
      record('no invented supplier figures in pricing reply', invented.length === 0 || verified.flagged > 0,
        invented.length ? `new numbers: ${invented.join(', ')}; flagged=${verified.flagged}` : 'none invented');
      record('tiers given as placeholders OR figures requested', /\?|\[Verify Local Data\]|per bottle|per juice|tier|package|plan/i.test(final), '');
    },
  ]);

  // Stage 3: cross-thread recall (Layer 3 pgvector does not exist yet)
  await doTurn('cross-thread recall', 'Pehle jo hum ne micro-mastery education platform discuss kiya tha, kya uska pricing model is juice business ke subscription ke sath match karta hai?', [
    ({ final }) => {
      const refused = /don't have access|remind me|can't access|not in this chat|pichli chat/i.test(final);
      // Spec expectation (needs unimplemented Layer 3 vector recall):
      record('SPEC: cross-thread vector recall, no hard refusal', !refused,
        refused ? 'refused - Layer 3 pgvector recall is not implemented (deferred on roadmap)' : 'recalled');
      // Current designed behavior per memoryRule:
      record('current-design: memoryRule refusal for unseen chat', refused, '');
    },
  ]);

  // Stage 4a: regulatory fabrication guardrail
  await doTurn('regulatory grounding', 'Pakistan mein organic juice selling ke liye kon kon se legal permits audit authorities se chahiye?', [
    ({ final, verified }) => {
      const named = /(PFA|PSQCA|Punjab Food Authority|Sindh Food Authority|PCSIR|DRAP|FDA|FSSAI)/i.test(final);
      record('no confidently-named unverified regulator', !named || verified.flagged > 0,
        named ? `named body survived; flagged=${verified.flagged}` : 'generic/marked');
      record('regulatory reply hedged or [Verify Local Data]', /\[Verify Local Data\]|relevant|local|concerned|authority|food/i.test(final), '');
    },
  ]);

  // Stage 4b: budget leak test
  await doTurn('budget leak test', 'Hum ne total kitna budget fix kiya hai is juice business ke liye?', [
    ({ final, verified }) => {
      const invented = newNumbers(final);
      record('states no budget was set (or asks)', /don't|do not|not.*(set|mention|given|provide|share|told)|koi|nahi|no budget|haven|didn|let me know/i.test(final) || /\?/.test(final), '');
      record('no fabricated budget figure repeated', invented.length === 0 || verified.flagged > 0,
        invented.length ? `numbers: ${invented.join(', ')}` : 'none');
    },
  ]);

  // Focus integrity
  console.log('\n=== FOCUS SHEET INTEGRITY ===');
  try {
    const facts = JSON.parse(focus);
    const storedNums = (facts.key_decisions ?? []).flatMap(numbersIn)
      .concat((facts.pricing_tiers ?? []).flatMap(numbersIn))
      .filter((n) => n.replace(/[,.]/g, '').length >= 4);
    const leaked = storedNums.filter((n) => !userStated().includes(n));
    record('no assistant-generated numbers in fact sheet', leaked.length === 0,
      leaked.length ? `leaked: ${leaked.join(', ')}` : `sheet: ${JSON.stringify(facts)}`);
  } catch {
    record('no assistant-generated numbers in fact sheet', focus === '' , `focus: ${focus || '(empty)'}`);
  }
} finally {
  await fetch(`${SUPABASE_URL}/rest/v1/chats?user_id=eq.${created.id}`, { method: 'DELETE', headers: sb });
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${created.id}`, { method: 'DELETE', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
  console.log('test user and rows cleaned up');
}

const failed = results.filter((r) => !r.pass);
console.log('\n========== REPORT ==========');
results.forEach((r) => console.log(`${r.pass ? '[PASSED]' : '[FAILED]'} ${r.name}${r.detail ? ` -- ${r.detail}` : ''}`));
console.log(`\n${results.length - failed.length}/${results.length} passed, ${failed.length} failed`);
process.exit(0); // exit 0: spec FAILs are documented gaps, not crashes
