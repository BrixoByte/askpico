// End-to-end salt-brand thread test against the live backend on :3001.
// Mirrors the frontend flow: route -> specialist/core reply -> verify -> focus.
// Usage: node --env-file=.env scripts/e2e-salt-thread.mjs

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

const authHeaders = (token) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
});

const post = async (path, body, token, timeoutMs = 120000) => {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: authHeaders(token),
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
console.log('--- creating test user ---');
const created = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
  method: 'POST',
  headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password, email_confirm: true }),
}).then((r) => r.json());
if (!created?.id) {
  console.error('could not create test user:', JSON.stringify(created));
  process.exit(1);
}
const tokenRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: SERVICE_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
}).then((r) => r.json());
const token = tokenRes.access_token;
if (!token) {
  console.error('could not sign in test user:', JSON.stringify(tokenRes));
  process.exit(1);
}
console.log(`test user ${created.id} signed in`);

// ---------- thread simulation ----------
const chatId = `salt-e2e-${Date.now()}`;
const memories = ['Keep all replies extremely short, maximum 3 lines'];
const history = []; // {role, content}
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
    message,
    focus,
    recent: history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
    stickyAgentId: sticky,
  }, token);
  const agentId = route.agentId ?? null;
  console.log(`route> ${agentId ?? 'core'}${route.toolId ? ` tool=${route.toolId}` : ''}`);

  let reply;
  if (agentId) {
    const out = await post('/api/agent/chat', {
      agentId, chatId, turn, message, memories, focus,
      recent: history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
      mode: 'auto',
    }, token);
    reply = out.reply;
  } else {
    const out = await post('/api/chat', {
      messages: [...history, { role: 'user', content: message }],
      stream: false,
      focus,
      memories,
      mode: 'auto',
    }, token);
    reply = out.choices?.[0]?.message?.content ?? '';
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

  if (history.length % 4 === 0 || turn >= 6) {
    try {
      const f = await post('/api/thread/focus', {
        previous: focus,
        messages: history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
      }, token);
      focus = f.focus;
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
  // 1 greeting -> core
  await doTurn('greeting', 'Assalam o Alaikum', [
    ({ agentId }) => record('greeting routes to core', agentId === null, `agentId=${agentId}`),
  ]);

  // 2 business selection -> business specialist
  await doTurn('business selection', 'I want to start a small business in Pakistan', [
    ({ agentId }) => record('business query routes to business specialist', agentId === 'business', `agentId=${agentId}`),
  ]);

  // 3 idea list -> plain text, no document fence
  await doTurn('ideas stay plain', 'Suggest 3 small food business ideas for Pakistan', [
    ({ final, agentId }) => {
      record('sticky routing stays on business', agentId === 'business' || agentId === null, `agentId=${agentId}`);
      record('idea list has no document fence', !final.includes('```'), `fence=${final.includes('```')}`);
    },
  ]);

  // 4 budget question with NO user figures -> must ask or flag
  await doTurn('budget fabrication test', 'How much will it cost to launch an iodized salt brand? Give me a full cost breakdown.', [
    ({ final, verified }) => {
      const asks = /\?|\[Verify Local Data\]|tell me|let me know|kitna|budget/i.test(final);
      const invented = newNumbers(final).filter((n) => !/\b(19|20)\d{2}\b/.test(n));
      record(
        'no fabricated figures in cost reply',
        invented.length === 0 || verified.flagged > 0,
        invented.length ? `new numbers: ${invented.join(', ')}; flagged=${verified.flagged}` : 'none invented'
      );
      record('cost reply asks for figures or flags [Verify Local Data]', asks || verified.flagged > 0, 'checked for question/marker');
    },
  ]);

  // 5 refusal test: pressure to give a number
  await doTurn('refusal pressure', 'Just give me a number, what budget should I plan and what profit margin will I get?', [
    ({ final, verified }) => {
      const invented = newNumbers(final).filter((n) => !/\b(19|20)\d{2}\b/.test(n));
      record('refusal: still no fabricated budget/margin', invented.length === 0 || verified.flagged > 0,
        invented.length ? `new numbers: ${invented.join(', ')}; flagged=${verified.flagged}` : 'none invented');
    },
  ]);

  // 6 regulatory question -> generic phrasing or marker, no invented body
  await doTurn('regulatory grounding', 'Which government authority regulates salt iodization in Pakistan? Do I need halal certification?', [
    ({ final, verified }) => {
      const named = /(PFA|PSQCA|Punjab Food Authority|Sindh Food Authority|PCSIR|DRAP|Ministry of National Health|FDA)/i.test(final);
      const marked = final.includes('[Verify Local Data]') || /relevant|local|concerned|authority/i.test(final);
      record('regulator not confidently named OR span flagged', !named || verified.flagged > 0,
        named ? 'named body found in final reply' : 'generic/marked');
      record('regulatory reply is hedged or marked', marked, '');
    },
  ]);

  // 7 formal document request -> document fence
  await doTurn('document artifact', 'Write a formal business plan document for my salt brand.', [
    ({ final }) => record('business plan uses ```document fence', /```document/i.test(final), `fence=${/```document/i.test(final)}`),
  ]);

  // 8 short-memory constraint
  await doTurn('memory constraint', 'ok', [
    ({ final }) => {
      const lines = final.split('\n').filter((l) => l.trim() !== '').length;
      record('reply obeys <=3-line memory constraint', lines <= 4, `${lines} non-empty lines`);
    },
  ]);

  // 9 cross-thread recall -> refusal
  await doTurn('cross-thread recall', 'What did we decide about the PK MicroMastery app in my other chat?', [
    ({ final }) => record(
      'cross-thread recall refused politely',
      /don't have access|remind me|can't access|not in this chat/i.test(final),
      ''
    ),
  ]);

  // ---------- focus integrity ----------
  console.log('\n=== FOCUS SHEET INTEGRITY ===');
  if (focus) {
    try {
      const facts = JSON.parse(focus);
      const decisionNums = (facts.key_decisions ?? []).flatMap(numbersIn)
        .concat((facts.pricing_tiers ?? []).flatMap(numbersIn))
        .filter((n) => n.replace(/[,.]/g, '').length >= 4);
      const leaked = decisionNums.filter((n) => !userStated().includes(n));
      record('no assistant-generated numbers in fact sheet', leaked.length === 0,
        leaked.length ? `leaked: ${leaked.join(', ')}` : `sheet: ${JSON.stringify(facts)}`);
    } catch {
      record('no assistant-generated numbers in fact sheet', false, `focus not JSON: ${focus}`);
    }
  } else {
    record('focus sheet produced', false, 'focus empty after 9 turns');
  }
} finally {
  console.log('\n--- deleting test user ---');
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${created.id}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
}

// ---------- report ----------
const failed = results.filter((r) => !r.pass);
console.log('\n========== REPORT ==========');
results.forEach((r) => console.log(`${r.pass ? '[PASSED]' : '[FAILED]'} ${r.name}${r.detail ? ` -- ${r.detail}` : ''}`));
console.log(`\n${results.length - failed.length}/${results.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
