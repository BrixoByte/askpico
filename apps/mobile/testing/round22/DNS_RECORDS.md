# DNS records for Resend — mail.askpico.app

Domain to register in Resend: **`mail.askpico.app`** (sending only; region: pick closest to recipients, e.g. US East).
Sender address: `Pico <no-reply@mail.askpico.app>`
Return-Path: leave Resend default → records land under `send.mail.askpico.app`.

> The DKIM/SPF/MX **values are generated per-domain by Resend** and cannot be known until the domain is created in the Resend dashboard (Domains → mail.askpico.app → Records tab). Copy them exactly — do not hand-type. This file gives the expected shape plus the one record that is fully known (DMARC).

## Existing askpico.app records — DO NOT TOUCH

| Name | Type | Value | Note |
|---|---|---|---|
| askpico.app | MX | eforward1–5.registrar-servers.com | Namecheap email forwarding |
| askpico.app | TXT | `v=spf1 include:spf.efwd.registrar-servers.com ~all` | Apex SPF — only ONE SPF per name; Resend's SPF uses `send.mail`, so no conflict |
| (none) | TXT | `_dmarc.askpico.app` absent | Safe to add below |
| mail.askpico.app / send.mail.askpico.app | — | no records | Free for Resend |

## Records to add in Cloudflare (zone: askpico.app)

All records **DNS only** (grey cloud — proxy MUST be off; proxied records fail verification).

### From Resend → Domains → mail.askpico.app → Records (copy exact values)

| # | Type | Name (Cloudflare) | Value | Proxy |
|---|---|---|---|---|
| 1 | TXT | `resend._domainkey.mail` | `p=<Resend-generated DKIM key>` | n/a (TXT) |
| 2 | TXT | `send.mail` | `v=spf1 include:amazonses.com ~all` (exact value from Resend) | n/a |
| 3 | MX | `send.mail` | `10 feedback-smtp.<region>.amazonses.com` (exact value + priority from Resend) | n/a |
| 4 | CNAME | *(only if Resend shows a CNAME instead of MX/TXT — copy as shown)* | | **DNS only** |

In Cloudflare, enter the name exactly as shown in the Resend table; Cloudflare appends the zone automatically — e.g. if Resend shows `resend._domainkey.mail.askpico.app`, enter `resend._domainkey.mail`.

### DMARC (add once, known value — recommended p=none to start)

| Type | Name | Value | Proxy |
|---|---|---|---|
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:postmaster@askpico.app; fo=1` | n/a |

`p=none` = monitor only, safe. Tighten to `quarantine`/`reject` later once SPF/DKIM confirmed passing.

## How to add

**Option A — one-click (easiest):** `_domainconnect.askpico.app` is published, so on `https://resend.com/domains/<id>` click **Auto configure** while logged into Cloudflare. Review the records it creates, ensure all are DNS-only, then Verify.

**Option B — manual:** Cloudflare dashboard → askpico.app → DNS → Records → Add record, one row per table above.

**Option C — agent with credentials:** provide `CLOUDFLARE_API_TOKEN` (Zone.DNS edit, zone askpico.app) + `RESEND_API_KEY` as env vars in your own shell; agent will add records via API after your confirmation. Until then nothing is written.

## Verify

After records exist, check propagation (replace values as they appear):

```
nslookup -type=TXT resend._domainkey.mail.askpico.app 8.8.8.8
nslookup -type=TXT send.mail.askpico.app 8.8.8.8
nslookup -type=MX  send.mail.askpico.app 8.8.8.8
nslookup -type=TXT _dmarc.askpico.app 8.8.8.8
```

Then click **Verify** in Resend (or Restart verification). Expect verified within ~15 min, up to 72 h.

## Live state — checked 2026-11-16 (dig @8.8.8.8)

Resend issued `send.mail` as a **CNAME to `send.forge.rmta.net`** (their newer setup; the MX/TXT live under that CNAME target, not as direct `amazonses.com` values).

| Record | Live value | Status |
|---|---|---|
| TXT `send.mail` (via CNAME) | `v=spf1 ip4:52.3.252.119 ip4:44.222.39.36 ip4:199.249.231.0/24 ~all` | OK — SPF will pass |
| MX `send.mail` (via CNAME) | `10 feedback.forge.rmta.net` | OK |
| TXT `resend._domainkey.mail` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDfe2hYBS0wnHuXOpfDuj3lciZqTj+H7l8gwb8rBfu6CGahqodGP095f3Eyi8a7aMjBQ72/J68Ei7sx3eK06WMXHGJHhRQze/q+UjxjMSNZkNysn2EaMLJL836lK7TcDnVsYmG1u4vRhtYCkXwbA/NYrATx38qcnV47OGzcQEwl/QIDAQAB` | OK — DKIM will pass |
| TXT `_dmarc` | **NXDOMAIN — missing** | **ACTION REQUIRED** |

**Missing:** the DMARC record below was never added. Without it Gmail shows `dmarc=none`-style results. Add:

```
Type: TXT   Name: _dmarc   Value: v=DMARC1; p=none; rua=mailto:postmaster@askpico.app; fo=1
```

**Gmail "Show original" checklist:** open any auth email → ⋮ → Show original → `Authentication-Results` should read `spf=pass`, `dkim=pass`, `dmarc=pass`. Until `_dmarc` exists, expect `dmarc` missing/none.
