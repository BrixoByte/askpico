# Round 35 — Intent actions device pass (Task 2)

Device: TECNO CL6, flag-ON staging build. Bridge rows fired via `PicoBridge.performAction` with `PicoAction.onResult` captured.

| Row | Result | Evidence |
|---|---|---|
| open allowlisted app | PASS — `open_app` com.android.chrome / com.whatsapp → `done`, target foreground | r35_ca1/ca2 |
| non-allowlisted app → invalid | PASS — `com.google.android.gm` → `invalid`; `com.whatsapp.evil` → `invalid` | __r35 results (logcat_r35 session) |
| open_url https accepted | PASS — example.com, wikipedia.org opened in Chrome | r35_ca3/ca4 |
| javascript: rejected | PASS — `open_url javascript:alert(1)` → `invalid`; chat path rejected too | r35_ca10 |
| file: rejected | PASS — `open_url file:///etc/passwd` → `invalid` | __r35 results |
| timer denial message | PASS (code) — Clock app on this device accepts `SET_TIMER` (both timers set); denial text `"The Clock app on this phone does not allow this"` verified by unit test `statusText('set_timer','denied')` | r35_ca5/ca6 + agentIntents.test.ts |
| call confirmation, masked number | PASS — dialog `Call ••••••••••••67?`, CANCEL → `cancelled` → "Cancelled." | r35_ca7_call_confirm.png |
| denied permission path | PASS — CALL_PHONE currently `granted=false`; CALL → runtime prompt → "Don't allow" → `denied` | r35_ia_call_perm.png |
| app not installed | PASS — `pm disable-user com.zhiliaoapp.musically` → `open_app` → `unsupported`; re-enabled immediately | __r35 results |

PASS 9/9. CALL_PHONE was denied on the device → denied path tested per prompt; manifest untouched.
