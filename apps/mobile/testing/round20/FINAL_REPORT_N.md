# Round 20 - Final report (N): Easy list completion

Scope: no email, no device test, no LLM calls, no commits, no feature work. Emails used overall: **3 of 4** (unchanged this round).

## Per task
| # | Task | Status | Evidence |
|---|---|---|---|
| 1 | Remove chat.askpico.app references | **PARTIAL** | Manifest filter removed (grep 0). Docs updated. authRoutes uses go.askpico.app with env constants. Marketing site (~30 links) NOT changed (out of owner's list). |
| 2 | Three tool phrase misses | **DONE** | Phrases added; 76/76 example table, 38/38 held-out, 0 `it.fails`. 3 positives + 14 new negatives (req. 10). |
| 3 | Stray files, .env | **PARTIAL** | nul deleted (verified). .env untracked (`git ls-files` grep: 0). docs.zip, services.zip, .wrangler left for owner. |
| 4 | Release grep | **PARTIAL** | Release gradle block and merged release manifest clean. Kotlin literals (localhost, 5173, 10.0.2.2) remain but guarded by BuildConfig.DEBUG / BUNDLED_WEB=false. |
| 5 | Commit notes | **DONE** | `testing/round20/COMMIT_NOTES.md`. No commit, no tag. |
| 6 | Tests | **DONE** | See counts below. |

## Task 1 detail
- `apps/mobile/app/src/main/AndroidManifest.xml`: removed `android:host="chat.askpico.app"`. `grep -c chat.askpico` -> 0. Release merged manifest (`processReleaseMainManifest`, BUILD SUCCESSFUL) has no chat/localhost/5173/10.0.2.2 and `usesCleartextTraffic="false"`. No Gradle place needed the host (ALLOWED_HOST_SUFFIX is askpico.app).
- Docs: `engineering/android-app.md` (3 lines) and `product/beta-launch.md` (table row, marketing line, session-sharing line) now use go.askpico.app. Two lines still say `chat.askpico.app` on purpose to explain it has no DNS (beta-launch.md 42, 319).
- `apps/web/src/utils/authRoutes.ts`: `chatOrigin()` kept (AuthPage uses it for the auth->app hand-off), now returns the app origin on production hosts. `APP_ORIGIN` from `VITE_APP_ORIGIN` (default https://go.askpico.app). Reset redirect from `VITE_RESET_REDIRECT_URL` (default `${APP_ORIGIN}/`). `authUrl()` is `/auth`. Test rewritten, 4/4 pass.
- Final grep (excl. node_modules, dist, .git, build, testing) -> remaining hits:
  - `apps/marketing/*.html` + `script.js` (~30): separate static site, not in the owner's list. **Dead links for real visitors.** Owner decision.
  - `apps/marketing/index.pico-backup.html` (6): backup file; delete or keep, owner decides.
  - `apps/web/src/utils/authRoutes.ts` (1): comment explaining the no-DNS host.
  - `docs/plans/product/beta-launch.md` (2): deliberate explanation.
  - `services/api/test/security.test.js` (2): CORS parsing fixture string; harmless.
  - `services/api/.env*`: commented CORS_ORIGIN lines; `.env` is git-ignored.

## Task 2 detail
- `apps/web/src/utils/toolPhrases.ts`:
  - unit_converter: `feet to cm`, `cm to feet`, `inches to cm`, `cm to inches`, `feet ko meter`, `کلو کو پاؤنڈ`, `کلو سے پاؤنڈ`
  - regex_tester: `test my regex`, `regex check karo`
  - stock_search: `pexels photos`, `stock photos of`, `اسٹاک فوٹو`
- `toolPhrases.test.ts`: `KNOWN_HELD_OUT_MISSES` and `it.fails` removed. 9 positive tests (3 per tool, EN / Roman Urdu / Urdu). 14 negative tests around these tools (requirement 10). Longest-phrase-wins, tie = null, allowlist tests unchanged and passing.
- Numbers: **76-phrase table 76/76. Held-out 38/38** (was 35/38).

## Task 3 detail
- `apps/mobile/nul` deleted (0 bytes).
- Left for the owner:
  - `docs.zip`: 254,003 bytes, 2026-11-16 12:44, untracked, not ignored.
  - `services.zip`: 107,985 bytes, 2026-11-16 12:54, untracked, not ignored.
  - `.wrangler/`: 2.0K, Wrangler local state, untracked, not ignored.
  - Recommendation: add `.wrangler/` and `*.zip` to `.gitignore`, or delete the zips if unneeded. Owner decides.
- `.env`: `git ls-files | grep -E "\.env$"` -> nothing. Only `*.env.example` tracked. Real `.env` files (apps/admin, apps/web, services/api) are ignored.

## Task 4 detail
- Release sources: `build.gradle.kts` release block has no localhost/5173/10.0.2.2/chat. Debug-only lines are comments or debug defaults.
- Kotlin (still in source and in the release DEX, not reachable in release):
  - `MainActivity.kt:213`: staging-only interception, returns early unless `BuildConfig.BUNDLED_WEB` (false in release).
  - `MainActivity.kt:334`: `if (BuildConfig.DEBUG) add("http://localhost:5173")`.
  - `MainActivity.kt:680`, `PicoDownloader.kt:312`: `if (BuildConfig.DEBUG && host == "localhost"...)`.
- Status is PARTIAL because the literal strings remain. Owner decides whether to strip them.

## Task 6 counts (command output)
- `tsc --noEmit`: exit 0
- web `npm test`: 9 files, **292 passed**
- web `yarn test`: **292 passed**
- web `yarn build`: built in 13.18s, exit 0
- API `npm test`: 244 tests, **242 pass, 0 fail, 2 todo** (known routing over-routes, owner declared correct)

## Fixed and verified
- Manifest chat host removed; release manifest clean.
- Tool phrase misses (3 tools) fixed; 76/76 and 38/38 with command output.
- nul deleted; .env untracked.
- authRoutes env-driven, go.askpico.app default.
- Commit notes written; nothing committed.

## Found but not fixed
1. Marketing site links to `https://chat.askpico.app` (~30 links). Dead for visitors. Severity: **high** for the public site. Fix: sed to https://go.askpico.app (needs owner OK).
2. Kotlin debug literals in release DEX. Severity: low (runtime-guarded). Fix: move to debug source set (owner OK).
3. Reset link still lands on root (default template; free-plan template not editable). Severity: **high** (blocks password reset). Fix: custom SMTP (owner) or root-route token handling (code, owner OK).
4. Production build is older than the local start-flow and mic fixes. Severity: high until redeploy.

## Not verified
- Reset form end-to-end (blocked by item 3 above).
- Expired session path, offline screen, font 2.0 48dp re-check on device (no device test this round, by instruction).

## Owner must do
1. Decide on `docs.zip`, `services.zip`, `.wrangler/`: delete, or add to `.gitignore`.
2. Decide on the marketing site `chat.askpico.app` links (or approve the sed).
3. **Redeploy the frontend** to go.askpico.app (start-flow, mic, 48dp, authRoutes changes).
4. **Supabase**: Redirect URLs include `https://go.askpico.app/`; check whether the free-plan email template can be edited. If not, configure custom SMTP (Resend, Brevo, SendGrid) before beta.
5. **Commit and tag**: review `git status`, use the message in `testing/round20/COMMIT_NOTES.md`, create `beta-rc1` only after redeploy and reset verification.
6. Delete fake test users (pico.r4.test, pico.r9.test, and picomobileqa20261116 if it is not a real inbox).
7. assetlinks.json with the release SHA-256 fingerprint (needed for app links).
