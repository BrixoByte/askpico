# P4_DIFF — dev-only laptop TTS

## New files
- `apps/web/src/voice/devLaptopTts.ts` — env-injectable `devLaptopTtsUrl()`: non-null only when `import.meta.env.DEV && VITE_DEV_LAPTOP_TTS === 'true'`.
- `apps/web/src/voice/devLaptopTts.test.ts` — 5 tests incl. release-build can never enable.

## tts.ts changes
```diff
+import { devLaptopTtsUrl } from './devLaptopTts';
```
```diff
-        const token = await getAccessToken().catch(() => null);
-        const response = await fetch(TTS_ENDPOINT, {
+        const laptopUrl = devLaptopTtsUrl();
+        const token = laptopUrl ? null : await getAccessToken().catch(() => null);
+        const response = await fetch(laptopUrl ?? TTS_ENDPOINT, {
           ...
-          body: JSON.stringify({ text, lang }),
+          // The laptop service speaks the server-side schema: it wants `voice`, not `lang`.
+          body: JSON.stringify(laptopUrl ? { text, voice: 'en-US-AriaNeural' } : { text, lang }),
```
Files touched: `apps/web/src/voice/tts.ts`, `devLaptopTts.ts`, `devLaptopTts.test.ts`. No Kotlin, no migrations.
