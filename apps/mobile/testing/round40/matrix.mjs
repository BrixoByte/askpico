// Round 40 repro-matrix runner. Usage: node matrix.mjs <case><attempt> e.g. node matrix.mjs A1
// Cases: A cold start | B after reply +5s | C after silence timeout | D background 30s | E same as B (Wi-Fi control)
// Captures console + /api/ network status on its own CDP connection (survives app restarts).
import { appendFileSync, existsSync } from 'node:fs';
import { execSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('.', import.meta.url));
const LOG = DIR + 'DEBUG_LOG.md';
const RESULTS = DIR + 'matrix_results.jsonl';
const ADB = process.env.USERPROFILE + '\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';
const FF = process.env.USERPROFILE + '\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.1-full_build\\bin\\ffmpeg.exe';
const LINE = 'What time is it in Multan right now?';
const arg = (process.argv[2] || '').toUpperCase();
const m = arg.match(/^([A-E])([1-3])$/);
if (!m) { console.log('usage: node matrix.mjs <A-E><1-3>'); process.exit(1); }
const CASE = m[1], ATT = m[2], ID = CASE + ATT;
const EVENTS_FILE = `${DIR}MATRIX_EVENTS_${ID}.txt`;

const adb = (c) => { try { return execSync(`"${ADB}" ${c}`, { timeout: 20000 }).toString(); } catch (e) { return 'ERR:' + e.message.slice(0, 80); } };
// The devtools unix socket is named webview_devtools_remote_<pid> — it changes when the
// process restarts, so re-discover and re-forward after cold starts and background returns.
const reforward = async () => {
  for (let i = 0; i < 15; i++) {
    const out = adb('shell cat /proc/net/unix');
    const mm = out.match(/@?(webview_devtools_remote_\d+|chrome_devtools_remote)/);
    if (mm) {
      adb('forward --remove tcp:9222');
      adb(`forward tcp:9222 localabstract:${mm[1]}`);
      return mm[1];
    }
    await sleep(2000);
  }
  return null;
};
const stamp = () => new Date().toLocaleTimeString('en-GB', { hour12: false }) + '.' + String(Date.now() % 1000).padStart(3, '0');
const iso = () => new Date().toISOString();
const logline = (s) => appendFileSync(LOG, `${iso()} ${s}\n`);
const evlog = (s) => appendFileSync(EVENTS_FILE, `${stamp()} ${s}\n`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── CDP: connect (with retry), capture console + network status ────────
const ownLog = [];
async function cdp() {
  for (let i = 0; i < 15; i++) {
    try {
      const pages = await (await fetch('http://localhost:9222/json/list')).json();
      const page = pages.find((p) => p.type === 'page' && p.url.includes('localhost:5173'));
      if (page) {
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        let id = 0; const pend = new Map(); const reqStart = new Map();
        const send = (me, p = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: me, params: p })); });
        ws.onmessage = (e) => {
          const d = JSON.parse(e.data);
          if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); return; }
          let line = null;
          if (d.method === 'Runtime.consoleAPICalled') {
            const text = d.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
            line = `CONSOLE[${d.params.type}] ${text.slice(0, 220)}`;
          } else if (d.method === 'Runtime.exceptionThrown') {
            line = `EXCEPTION ${String(d.params.exceptionDetails.text ?? '').slice(0, 150)}`;
          } else if (d.method === 'Network.requestWillBeSent' && /\/api\//.test(d.params.request.url)) {
            reqStart.set(d.params.requestId, Date.now());
            line = `REQ ${d.params.request.method} ${new URL(d.params.request.url).pathname}`;
          } else if (d.method === 'Network.responseReceived' && /\/api\//.test(d.params.response.url)) {
            const t = reqStart.get(d.params.requestId);
            line = `RESP ${new URL(d.params.response.url).pathname} status=${d.params.response.status} ttfb_ms=${t ? Date.now() - t : '?'}`;
          }
          if (line) { ownLog.push(`${stamp()} ${line}`); evlog(line); }
        };
        await new Promise((r) => (ws.onopen = r));
        const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value;
        await send('Runtime.enable');
        await send('Network.enable');
        return { ev, close: () => { try { ws.close(); } catch {} } };
      }
    } catch {}
    await sleep(2000);
  }
  return null;
}
const mark = () => ownLog.length;
const since = (m) => ownLog.slice(m).join('\n');

const speak = () => spawn('powershell', ['-NoProfile', '-Command', `Add-Type -AssemblyName System.Speech; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Volume=100; $s.Rate=-1; $s.Speak('${LINE}')`], { shell: false });

async function voiceOn(ev) {
  const lbl = await ev("Array.from(document.querySelectorAll('button')).map(b=>b.getAttribute('aria-label')).find(a=>a&&/voice mode/i.test(a))||'none'");
  if (/turn voice mode on/i.test(lbl)) await ev("document.querySelector(\"button[aria-label='turn voice mode on']\")?.click(),0");
  else if (/start voice mode/i.test(lbl)) await ev("document.querySelector(\"button[aria-label='Start voice mode']\")?.click(),0");
  await sleep(2500);
  return ev("/Listening|Thinking|Speaking|Voice stopped[^\\n]*/.exec(document.body.innerText)?.[0]||'none'");
}

// ── pre-state per case ──────────────────────────────────────────────────
logline(`MATRIX ${ID} begin (case ${CASE} attempt ${ATT})`);
let pre = {};
if (CASE === 'A') {
  adb('shell am force-stop com.askpico.pico');
  await sleep(1500);
  adb('shell am start -n com.askpico.pico/.MainActivity');
  await sleep(9000);
  pre.forward = await reforward();
} else if (CASE === 'D') {
  adb('shell input keyevent KEYCODE_HOME');
  await sleep(30000);
  adb('shell am start -n com.askpico.pico/.MainActivity');
  await sleep(6000);
  pre.forward = await reforward();
}
const c = await cdp();
if (!c) { console.log(JSON.stringify({ id: ID, result: 'FAIL', reason: 'no cdp' })); logline(`MATRIX ${ID} FAIL no-cdp`); process.exit(1); }

// Every case needs voice mode actually listening before the attempt line is spoken.
// Wait for the first startVoiceInput of THIS session so we never speak into a dead window.
if (CASE !== 'B' && CASE !== 'E') {
  pre.state = await voiceOn(c.ev);
}
const waitListening = async (timeoutMs, from) => {
  const mk = from ?? mark();
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (/Invoking PicoBridge\.startVoiceInput/.test(since(mk))) return true;
    await sleep(500);
  }
  return false;
};
if (CASE === 'A' || CASE === 'D') {
  const mk0 = mark();
  pre.state = await voiceOn(c.ev);
  pre.listenedBefore = await waitListening(20000, mk0);
}

if (CASE === 'B' || CASE === 'E') {
  const mkOn = mark();
  pre.state = await voiceOn(c.ev);
  await waitListening(20000, mkOn); // voiceOn may have already started a window
  const mk = mark();
  logline(`MATRIX ${ID} primer speak at ${stamp()}`);
  speak();
  const t0 = Date.now();
  while (Date.now() - t0 < 70000) {
    const seg = since(mk);
    if (/Resuming listening|Voice stopped|error code \d/.test(seg)) {
      pre.primer = { final: /Native final result/.test(seg), resuming: /Resuming listening/.test(seg), chat: (seg.match(/RESP \/api\/chat status=(\d+)/) || [])[1] ?? null, err7: /error code 7/.test(seg) };
      break;
    }
    await sleep(2000);
  }
  if (!pre.primer) pre.primer = { timeout: true };
  const mkGap = mark();
  await sleep(5000); // required 5 s gap after reply/finish
  // After the reply finished, the session re-arms itself; make sure a fresh window is live.
  pre.listenedBefore = await waitListening(25000, mkGap);
} else if (CASE === 'C') {
  const mk = mark();
  const t0 = Date.now();
  while (Date.now() - t0 < 90000) {
    const seg = since(mk);
    const rearms = (seg.match(/re-arming listening/g) || []).length;
    const cap = /Re-arm cap reached/.test(seg);
    pre.rearms = rearms; pre.cap = cap;
    if (rearms >= 1 || cap) break;
    await sleep(2000);
  }
  // Speak into the re-armed window: it starts ~1.5 s after the re-arm log line.
  pre.listenedBefore = await waitListening(10000);
}

// ── attempt: record mic, speak, watch ───────────────────────────────────
const mk = mark();
const mic = spawn(FF, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'dshow', '-i', 'audio=Microphone (High Definition Audio Device)', '-ac', '1', '-ar', '16000', '-t', '70', `${DIR}AUDIO/${ID}_mic.wav`]);
await sleep(1000);
logline(`MATRIX ${ID} attempt speak at ${stamp()}`);
speak();

// Speaker output is borderline for the on-device recognizer: say the line twice,
// ~8 s apart, so at least one repetition lands cleanly inside a listening window.
const t0 = Date.now();
let seg = '';
let spoke2 = false;
while (Date.now() - t0 < 65000) {
  await sleep(2500);
  seg = since(mk);
  if (!spoke2 && Date.now() - t0 > 8000 && !/Native final result/.test(seg)) {
    spoke2 = true;
    logline(`MATRIX ${ID} repeat speak at ${stamp()}`);
    speak();
  }
  // Keep watching after a final result so TTS/reply events are captured; only the
  // session settling back to listening (or the re-arm cap) ends the attempt window.
  if (/Resuming listening|Re-arm cap reached/.test(seg)) break;
}
try { mic.kill('SIGINT'); } catch {}
await sleep(1500);

// ── classify ────────────────────────────────────────────────────────────
const ev = {
  speechStart: /onSpeechStart|Native speech detected/.test(seg),
  partials: (seg.match(/\[VoiceDebug\] partial/g) || []).length,
  finalResult: /Native final result/.test(seg),
  heardText: (seg.match(/Native final result: "([^"]*)"/) || [])[1] ?? null,
  submit: /submit turn/.test(seg),
  chatStatus: [...seg.matchAll(/RESP \/api\/chat status=(\d+)/g)].map((x) => x[1]).filter((s) => s !== '204').at(-1) ?? null,
  enqueueTts: /Enqueue reply sentence for TTS/.test(seg),
  nativeTts: /Speaking reply with native Android TTS/.test(seg),
  ttsStart: /tts start/.test(seg),
  ttsEnd: /tts end/.test(seg),
  resuming: /Resuming listening/.test(seg),
  rearms: (seg.match(/re-arming listening/g) || []).length,
  cap: /Re-arm cap reached|Voice stopped\. Tap to try again/.test(seg),
  err7: /error code 7/.test(seg),
  err8: /error code 8/.test(seg),
  err6: /error code 6/.test(seg),
};
let result = 'FAIL', reason = '';
if (ev.finalResult && ev.submit) {
  if (CASE === 'C' && ev.rearms < 1 && !(pre.rearms >= 1)) { result = 'FAIL'; reason = 'final result but no re-arm seen (case C tests the re-armed window)'; }
  else { result = 'PASS'; reason = `final "${ev.heardText}" chat=${ev.chatStatus} rearm=${ev.rearms} tts=${ev.enqueueTts}/${ev.nativeTts || ev.ttsStart}/${ev.ttsEnd} resume=${ev.resuming}`; }
} else if (ev.rearms >= 1) { reason = `re-armed ${ev.rearms}x but no final result (err7=${ev.err7} cap=${ev.cap})`; }
else if (ev.speechStart || ev.partials > 0) { reason = `speech detected (${ev.partials} partials) but no final result (err7=${ev.err7})`; }
else { reason = `no recognizer activity (err7=${ev.err7} rearm=${ev.rearms} cap=${ev.cap})`; }

const rec = { id: ID, case: CASE, attempt: +ATT, result, reason, ev, pre, ts: iso() };
appendFileSync(RESULTS, JSON.stringify(rec) + '\n');
logline(`MATRIX ${ID} ${result} — ${reason}`);
console.log(JSON.stringify(rec, null, 1));
c.close();
process.exit(0);
