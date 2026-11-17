# Round 35 — Pico Vault v1 device pass (Task 3)

Device: TECNO CL6, flag-ON staging build. Dummy value used for the test (never printed here). Signed in with the owner's test account for the UI row.

| Check | Result | Evidence |
|---|---|---|
| Save through Vault UI (Settings>Agent>Private details) | PASS — kind `credential`, label `R35e`, value dummy → saved; `localStorage['pico-vault-refs']` gained `credential:ref_0422054a3139`; native `pico_vault.xml` entry count 6→7 | shots/r35_vault_ui.png |
| Survives force-stop + relaunch | PASS — `vaultHas('other:ref_r35test')` → `true` after `am force-stop` + cold start | PROGRESS.md |
| Not visible in web UI | PASS — DOM text has label `R35e` but not the dummy value (`domHas:false`); list shows `••••••` mask | shots/r35_vault_ui.png |
| Vault ref in action arg | PASS — `share_whatsapp` `text='other:ref_r35test'` → resolved natively → confirm dialog (value NOT echoed) → CANCEL → `cancelled` | shots/r35_vault_share_dialog.png |
| Value in logcat | PASS — `grep -c DUMMY-VALUE-123 logcat_r35.txt` → **0** | logcat_r35.txt |
| Storage plaintext | PASS — `pico_vault.xml` all ciphertext (AES256_SIV keys / AES256_GCM values) | run-as cat |

Note: a select-kind quirk was found during testing — setting the kind `<select>` to a value not in `VAULT_KINDS` leaves `vaultKind` stale and save fails with "Value could not be saved". Only reachable by synthetic DOM writes; normal UI can't pick an absent option. Left as-is (edge case).

Result: **PASS 6/6**.
