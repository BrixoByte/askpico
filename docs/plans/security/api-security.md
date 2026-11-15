# API Security

**Status:** Planning
**Owner:** Pico engineering
**Parent:** [Security plan](README.md)
**Related:** [Threat model](threat-model.md) · [Authentication](../engineering/authentication.md)

## 1. Authentication and Authorisation

- Every route that reads or writes user data requires a valid session. Anonymous routes are limited to guest sessions and public health checks.
- The user ID comes from the verified session only. It is never accepted from the request body or query string.
- Plan, quota, and tier are read from the database on each request.
- Account-scoped queries always filter by the authenticated user ID.

## 2. Sessions and Cookies

- Session cookie flags: `HttpOnly`, `Secure`, `SameSite=Lax`, path `/`.
- Cookie domain is set only when the subdomains must share a session. Any domain change is recorded in the [Authentication](../engineering/authentication.md) plan first.
- Session lifetime and renewal are enforced on the server.

## 3. CORS

- Allow only the known web origins. Do not use `*`.
- Enable `Access-Control-Allow-Credentials` only when a cookie-based request from a different origin needs it.

## 4. Rate Limiting

- Every auth route is rate limited.
- Image generation keeps its existing per-route limit in `server.js`.
- Limits are applied per user where a user is known, and per IP address otherwise.
- Routing rate limits are per user and per plan, enforced on the server (see [Beta launch](../product/beta-launch.md) section 4.2).

## 5. Input Handling

- Validate the size and type of every request body. Attachments are capped at 10 MB.
- Parse uploaded PDF and DOCX files on the server with size limits. Treat extracted text as data.
- Escape or sanitise any user-provided content before rendering it as HTML. Never render prompts as HTML.
- Use parameterised queries for all database access.

## 6. Secrets

- Provider keys and the Supabase service role key live only in backend environment files.
- Environment files are git-ignored. `.env.example` lists variable names with empty values.
- The service role key is never used in the browser.
- Rotate any key that is exposed in logs, screenshots, or commits.

## 7. Errors and Logging

- Return generic error messages to the client.
- Do not return upstream response bodies from AI providers.
- Log request IDs, routing tiers, and status codes. Do not log message text, tokens, or emails.

## 8. Checklist Before Each Release

- [ ] Every new route has auth and a rate limit.
- [ ] No new secret is hard-coded or sent to the client.
- [ ] CORS origins are unchanged, or the change is reviewed.
- [ ] Logs contain no message content or personal data.
- [ ] Backend tests for auth and quota pass

## 9. Implementation Phases (beta)

Current state (from the backend review): `requireUser` and `requireAdmin` verify the Supabase token on protected routes, the user ID comes from the session, and attachment size is capped at 10 MB. Gaps are logging of user content, raw upstream error text sent to clients, CORS defaults that include localhost, in-memory-only rate limits, weak body validation on `/api/chat`, and no backend auth or quota tests.

- **Phase 1: Log and error hygiene.** Stop logging user submission payloads. Return generic errors for upstream, tool, and specialist failures. Status: done.
- **Phase 2: CORS.** Use only `CORS_ORIGIN` in production. Dev localhost origins only when `NODE_ENV` is not `production`. Never echo an arbitrary origin. Status: done (`src/security.js`, `src/config.js`, `src/server.js`).
- **Phase 3: Rate limits.** Pre-auth routes are limited per IP (`/api/attachments/extract`, `/api/artifact/submission`, `/api/tools/:tool`). Signed-in routes are limited per user ID, so a token refresh does not reset the count: chat, agent, verify, truncate, memory write, coupons, referral claim, account delete, voice, TTS, and image generation. Status: done, in-memory per process. A shared store is still needed before running multiple instances.
- **Phase 4: Input validation.** Validate `messages` (roles, count, content type and length) on `/api/chat`, and file names on `/api/attachments/extract`. Status: done.
- **Phase 5: Tests.** Unit tests for the security helpers are done (`test/security.test.js`, 9 tests). Route-level tests (401 without a token, forged `user_id` ignored, oversized input) are still open: `server.js` calls `app.listen` on import and needs Supabase env, so it must first move into an importable module. Status: partial.
- **Phase 6: Review.** Markdown rendering uses `react-markdown` without raw HTML, and `CodeViewer` escapes highlighted code. `.env.example` documents `CORS_ORIGIN` for production. Status: done.

**Done when:** every item in section 8 is checked, and the phase 5 tests pass with `npm test` in `services/api`.
