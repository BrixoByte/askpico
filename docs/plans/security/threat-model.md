# Threat Model

**Status:** Planning
**Owner:** Pico engineering
**Parent:** [Security plan](README.md)

## 1. Assets

| Asset | Where it lives | Sensitivity |
|---|---|---|
| Provider API keys (Gemini, OpenRouter, NanoBanana) | Backend environment only | Critical |
| Session cookies and auth tokens | Browser (HttpOnly cookie), backend session store | High |
| Chat history and agent messages | Browser storage, backend database | High |
| Email, name, plan, and referral data | Backend database | High |
| Uploaded files and extracted text | Browser memory, backend during extraction | High |
| Usage counts and quota state | Backend database | Medium |

## 2. Trust Boundaries

1. **Browser to backend.** All requests are untrusted. The backend validates every field and checks the session.
2. **Backend to third-party AI providers.** The backend holds the keys and sends only the content the feature needs.
3. **Artifact preview.** Generated React and HTML code runs in a sandboxed iframe with no access to the parent app's storage or cookies.
4. **Marketing site to app.** The marketing site has no login and no user data. It only links to the app.

## 3. Threats and Controls

| # | Threat | Control | Status |
|---|---|---|---|
| T1 | Client changes plan, model tier, or quota | Plan and quota are read from the database on the server. Client values are ignored | Planned |
| T2 | API keys leak to the browser or repository | Keys live in `services/api/.env`, which is git-ignored. `.env.example` holds names only | In place for the backend |
| T3 | Brute force or abuse of auth and image routes | Rate limiting on every auth route and on image generation | Partly in place (images) |
| T4 | Cross-site request forgery on session routes | `SameSite=Lax` cookies and checked request origins | Planned |
| T5 | Cross-origin access from unknown sites | CORS allows only the known web origins, with no wildcard | Planned |
| T6 | Malicious code in generated artifacts reads user data | Sandboxed iframe with an in-memory storage shim | In place for artifacts |
| T7 | Prompt injection through uploaded documents | Extracted text is treated as data, never as instructions to the backend | Planned |
| T8 | Raw personal data sent to AI providers | Message text is not logged. Pico Vault is post-beta, so raw data goes to providers in beta | Accepted for beta, review before the vault |
| T9 | Error messages reveal upstream details | Upstream response bodies are not returned to the client | In place for the Gemini adapter |

## 4. Out of Scope for Beta

- Hardware-backed key storage for the on-device vault (see [Pico vault](../modules/pico-vault.md)).
- Formal penetration testing. Planned before public launch, not before beta.

## 5. Review Triggers

Update this model when any of these change: auth method, payment provider, storage location, a new AI provider, a new file type for uploads, or a new artifact capability.
