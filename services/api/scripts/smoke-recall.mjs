// Smoke: one recall-cue question through the live backend.
// Until migration 0005 is applied, expect the memoryRule refusal (fail-open).
const API = 'http://localhost:3001';
const { SUPABASE_URL: URL, SUPABASE_SERVICE_ROLE_KEY: KEY } = process.env;

const email = `pico-smoke-${Date.now()}@example.com`;
const password = 'smoke!' + Math.random().toString(36).slice(2) + 'Aa';
const u = await fetch(`${URL}/auth/v1/admin/users`, {
  method: 'POST',
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password, email_confirm: true }),
}).then((r) => r.json());
const { access_token: token } = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
}).then((r) => r.json());

try {
  const res = await fetch(`${API}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Pehli chat mein hum ne PK MicroMastery ka pricing kya decide kiya tha?' }],
      chatId: 'smoke-recall',
      stream: false,
      mode: 'quick',
    }),
    signal: AbortSignal.timeout(120000),
  });
  const data = await res.json();
  console.log(`status ${res.status}`);
  console.log(`reply> ${data?.choices?.[0]?.message?.content ?? JSON.stringify(data)}`);
} finally {
  await fetch(`${URL}/auth/v1/admin/users/${u.id}`, {
    method: 'DELETE',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
}
