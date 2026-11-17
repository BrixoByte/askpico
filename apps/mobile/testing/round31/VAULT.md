# Round 31 — Pico Vault v1 (pico-vault.md, Task 4)

Device: TECNO CL6, staging flag-ON build. Dummy values only — never real secrets.
Driver: `window.PicoBridge.vaultSet/vaultHas/performAction` via CDP.

Dummy values used:
- `note:ref_r31dummy` → `R31_DUMMY_VALUE_7f3a9c`
- `contact:ref_r31call` → `+92000000077` (fake number)

| Check | Result | Evidence |
|---|---|---|
| vaultSet + vaultHas roundtrip | PASS | `{set1:true,set2:true,has1:true,has2:true,hasMissing:false}` |
| Value survives app restart | PASS | `am force-stop` + relaunch → `{has1:true,has2:true}` after WebView reload. |
| Value not readable by web layer | PASS (design) | Bridge exposes only `vaultSet`/`vaultHas` — no getter. `PicoBridge.kt:112-117`. |
| Encrypted at rest | PASS | `run-as … cat shared_prefs/pico_vault.xml` — keys+values are AES-SIV/GCM ciphertext (`AXSHc8A20QKaEPJn…`); no plaintext key or value. |
| Ref resolves on-device inside action | PASS | `performAction('call',{number:'contact:ref_r31call'})` → confirm dialog showed masked **resolved** number "Call •••••••••••77?" (`r31_vault_call.png`). Ref string never reached the dialog. |
| Resolved share text never echoed | PASS | `share_whatsapp` with `text:'note:ref_r31dummy'` → dialog "Share this text on WhatsApp?" — value not shown (by design, `confirmShare` never echoes text). CANCEL → `cancelled`. |
| Unresolvable ref → `invalid` | PASS | `call` with `contact:ref_missing00` → `invalid` (id 9e8b0841). |
| Action returns status only | PASS | `window.__r` received `cancelled`/`invalid` — never values. |
| No secret in logcat | PASS | `adb logcat -d` (5781 lines captured during save+actions): `grep -c "R31_DUMMY\|92000000077\|7f3a9c"` → **0**. Only entries: benign first-run `AndroidKeysetManager: keyset not found, will generate a new one` warnings. |
| No secret in network/API | PASS | Local API logs (`backend-dev.log`, `debug-web.log`, `server.log`) grep for all three tokens → 0 hits. Refs never leave the device: `resolveRefs` runs inside `ActionExecutor` before any intent; `runAgentAction` returns status only. |
| Value not shown in UI/screenshots | PASS | `r31_vault_call.png`, `r31_vault_share.png` show masked/dialog text only. |

Notes:
- `KEY_PATTERN` enforced on both `set` and `resolve` (`contact|note|credential|id|other:ref_[A-Za-z0-9]{1,32}`); covered by `VaultKeyPatternTest` (unit).
- Vault section of Agent Settings stores only `{id,label}` refs in localStorage, never the value (`AgentSettings.tsx:104-115`); UI shows `label ••••••`.
