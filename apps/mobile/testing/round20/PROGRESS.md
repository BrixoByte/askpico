# Round 20 PROGRESS (Easy list completion). No email, no device test, no LLM calls, no commits.

## Task 1: chat.askpico.app references - DONE (with listed exceptions)
- apps/mobile/app/src/main/AndroidManifest.xml: removed `android:host="chat.askpico.app"` intent filter line. Evidence: `grep -c "chat.askpico" AndroidManifest.xml` -> 0. go.askpico.app and askpico.app filters kept.
- Merged release manifest checked (processReleaseMainManifest, BUILD SUCCESSFUL): no chat./localhost/5173/10.0.2.2; usesCleartextTraffic="false".
- docs/plans/engineering/android-app.md: WebView, app-loads-URL line and intent-filter line now go.askpico.app. grep -> no chat.askpico hits.
- docs/plans/product/beta-launch.md: table row "Chat" -> go.askpico.app; marketing CTA line; session-sharing line. Two lines still say `chat.askpico.app` deliberately, to explain that the host has no DNS (lines 42, 319).
- apps/web/src/utils/authRoutes.ts: chatOrigin() kept because AuthPage uses it for the auth->app sign-in hand-off; now returns the app origin (go.askpico.app) on production hosts (askpico.app / *.askpico.app), local origin otherwise. APP_ORIGIN = import.meta.env.VITE_APP_ORIGIN || 'https://go.askpico.app'. Reset redirect = import.meta.env.VITE_RESET_REDIRECT_URL || `${APP_ORIGIN}/` (one env-driven constant, go.askpico.app default). authUrl() now returns '/auth' (no chat. branch).
- authRoutes.test.ts rewritten for these rules: 4/4 pass.

## Task 2: tool phrase misses - DONE
- apps/web/src/utils/toolPhrases.ts:
  - unit_converter: + 'feet to cm', 'cm to feet', 'inches to cm', 'cm to inches', 'feet ko meter', 'کلو کو پاؤنڈ', 'کلو سے پاؤنڈ'
  - regex_tester: + 'test my regex', 'regex check karo'
  - stock_search: + 'pexels photos', 'stock photos of', 'اسٹاک فوٹو'
- apps/web/src/utils/toolPhrases.test.ts: KNOWN_HELD_OUT_MISSES and it.fails removed. Held-out now plain it.each.
  - 9 positive tests added (3 per tool, EN / Roman Urdu / Urdu script).
  - 14 new negative tests (unit/regex/stock trigger-words in ordinary sentences). Requirement was 10.
- Results: 76-phrase example table 76/76; held-out 38/38 (was 35/38); negatives 46 + 14 = 60.
- Longest-phrase-wins, tie = null, allowlist: existing tests still pass.

## Task 3: stray files - DONE for nul; zips and .wrangler left for the owner
- apps/mobile/nul deleted (was 0 bytes). Evidence: `test -e apps/mobile/nul` -> not present.
- Not deleted (owner decides): docs.zip (254,003 bytes, 2026-11-16 12:44), services.zip (107,985 bytes, 2026-11-16 12:54), .wrangler/ (2.0K, dir 2026-11-15). None are ignored by .gitignore yet; see COMMIT_NOTES.md.
- `.env` tracked check: `git ls-files | grep -E "\.env$"` -> 0 lines. .env files on disk (apps/admin, apps/web, services/api) are ignored (apps/web/.gitignore covers .env; check-ignore confirmed). Tracked: only *.env.example.

## Task 4: release grep - PARTIAL (config clean, code literals guarded)
- build.gradle.kts release block: no localhost/5173/10.0.2.2/chat (debug-only lines 25-28 and 39-40 are comments/debug). Release WEB_URL default = https://go.askpico.app.
- app/src/main Kotlin: remaining literals are runtime-guarded:
  - MainActivity.kt:213 -> inside shouldInterceptRequest, returns early unless BuildConfig.BUNDLED_WEB (false in release).
  - MainActivity.kt:334 -> `if (BuildConfig.DEBUG) add("http://localhost:5173")`.
  - MainActivity.kt:680 and PicoDownloader.kt:312 -> `if (BuildConfig.DEBUG && host == "localhost"...)`.
  - The strings still exist in the release DEX (not removed); they cannot be reached in release. Owner decision whether to strip them.
- Merged release manifest: clean (see Task 1).

## Task 5: commit notes - DONE (no commit)
- testing/round20/COMMIT_NOTES.md written with groups, do-not-commit list, message, tag beta-rc1.

## Task 6: tests (command output)
- tsc --noEmit: exit 0
- web npm test: 9 files, 292 passed
- web yarn test: 292 passed
- web yarn build: built in 13.18s, exit 0
- API npm test: 244 tests, 242 pass, 0 fail, 2 todo (known over-route cases)

## Marketing site (apps/marketing) - NOT CHANGED
- ~30 links to https://chat.askpico.app in apps/marketing/*.html and script.js (dev map). Not in the owner's list and a separate static deployment. These are dead links for real visitors. Owner decision; a sed replacement to https://go.askpico.app is a one-line change if approved.
- services/api/test/security.test.js:73-74 uses chat.askpico.app as a CORS parsing fixture. Harmless; left unchanged.
