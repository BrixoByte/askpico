# Supabase email templates — Pico via Resend SMTP

Prereq: custom SMTP enabled (see FINAL_REPORT_P.md / PROGRESS.md Step 4) and domain `mail.askpico.app` verified in Resend.

Supabase dashboard → **Authentication → Emails → Templates**.

Site URL (Authentication → URL Configuration): `https://go.askpico.app`
Redirect URLs must include: `https://go.askpico.app/**`

Verify-link format used below (matches the app's `/verify` route):

- Confirm signup: `{{ .SiteURL }}/verify?token_hash={{ .TokenHash }}&type=signup`
- Reset password: `{{ .SiteURL }}/verify?token_hash={{ .TokenHash }}&type=recovery`

---

## 1. Confirm signup

**Subject:** `Confirm your Pico account`

**Body (HTML):**

```html
<!doctype html>
<html><body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
    <h1 style="margin:0 0 8px;font-size:20px;color:#111827;">Welcome to Pico</h1>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#4b5563;">
      Confirm your email address to finish setting up your account.
    </p>
    <a href="{{ .SiteURL }}/verify?token_hash={{ .TokenHash }}&type=signup"
       style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;">
      Confirm email
    </a>
    <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#9ca3af;">
      If you didn't create a Pico account, you can ignore this email.
      Button not working? Paste this link into your browser:<br>
      {{ .SiteURL }}/verify?token_hash={{ .TokenHash }}&type=signup
    </p>
  </div>
</body></html>
```

**Plain-text fallback:**

```
Welcome to Pico

Confirm your email address to finish setting up your account:
{{ .SiteURL }}/verify?token_hash={{ .TokenHash }}&type=signup

If you didn't create a Pico account, ignore this email.
```

---

## 2. Reset password

**Subject:** `Reset your Pico password`

**Body (HTML):**

```html
<!doctype html>
<html><body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
    <h1 style="margin:0 0 8px;font-size:20px;color:#111827;">Reset your password</h1>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#4b5563;">
      We received a request to reset the password for your Pico account.
      This link expires soon — if you didn't request it, ignore this email.
    </p>
    <a href="{{ .SiteURL }}/verify?token_hash={{ .TokenHash }}&type=recovery"
       style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;">
      Reset password
    </a>
    <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#9ca3af;">
      Button not working? Paste this link into your browser:<br>
      {{ .SiteURL }}/verify?token_hash={{ .TokenHash }}&type=recovery
    </p>
  </div>
</body></html>
```

**Plain-text fallback:**

```
Reset your Pico password

We received a request to reset the password for your Pico account.
This link expires soon — if you didn't request it, ignore this email.

{{ .SiteURL }}/verify?token_hash={{ .TokenHash }}&type=recovery
```

---

## Notes

- `{{ .TokenHash }}` is the PKCE-safe token hash; the app's `/verify` route exchanges it (see round19 `VerifyPage.tsx` / `verifyLink.ts`). Do not use `{{ .ConfirmationURL }}`/`{{ .Token }}` — those produce Supabase-hosted links that bypass the app's verify route.
- Supabase free plan historically did not allow editing auth email templates — if the Templates editor is locked/greyed out, that is a plan limitation, not a misconfiguration. In that case the fallback is a root-route recovery handler in the web app (code change — NOT implemented under feature freeze; ask owner first).
- Magic-link / OTP templates are not needed — Pico uses password + token-hash verify.
