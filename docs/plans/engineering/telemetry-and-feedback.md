# Telemetry, Break-Point Reports, and Feedback

**Status:** Planning. Covers the beta web app and the Android WebView shell. Scope is set in the [Beta launch plan](../product/beta-launch.md); data handling rules come from [Data protection](../security/data-protection.md).

## 1. Summary

Pico collects three kinds of data so the team can improve the app during beta, without asking testers for manual reports:

1. **Usage behaviour:** which screens and features are used, where users drop off, and how long sessions last.
2. **Device and error reports:** device model, OS, WebView and app version, plus the exact break point of any crash or error and the events in the minutes before it.
3. **Feedback:** an automatic report on every break point, and a manual feedback form (floating button, bottom right of the chat page) with text, an optional screenshot, and automatically attached identity and device details.

All of it lands in the admin dashboard. None of it may block a chat request, the app's first render, or Play review.

## 2. Goals and Non-Goals

**Goals**

- Show, per device and per session, what the user did in the last few minutes before any failure.
- Group failures so one bug appears once with its count, affected users, and device breakdown.
- Let testers report a problem in one tap, with the user name and device filled in automatically.
- Keep the data small, anonymous where possible, and useful.

**Non-goals**

- No advertising ID, IMEI, SSAID, or cross-app tracking.
- No session replay or screen recording.
- No capture of chat text, vault values, or file contents in telemetry.
- No automatic screenshots. Screenshots are added by the user only.

## 3. Principles

- **Allowlist, not denylist.** Each event name and property is listed here before code emits it. Unknown fields are dropped server-side.
- **Content is never logged.** This follows [Data protection](../security/data-protection.md) section 2: logs hold IDs, routing tiers, and status codes only. Breadcrumbs record actions (`mode_changed`), never the text the user typed.
- **Scrub before sending.** The client removes email addresses, phone numbers, bearer tokens, API keys, and URL query strings from every string field. The server runs the same rules again.
- **Vault data is excluded entirely.** Per [Android app](android-app.md) and [Pico vault](../modules/pico-vault.md), vault data never enters analytics, crash reports, or the backend. Elements marked `data-private` are skipped by the screenshot tool and by breadcrumb text.
- **Non-blocking and fail-silent.** Tracking runs off the main path: queued in memory, flushed in the background, dropped if the queue is full. A telemetry failure never shows an error to the user.
- **Consent and disclosure first.** Behaviour and error data are described in the privacy policy and in the onboarding consent screen. Users can turn off usage analytics in Settings. Crash reports stay on because they are needed to keep the app working.

## 4. What Gets Collected

### 4.1 Device and app (sent once per session start)

| Field | Example | Notes |
|---|---|---|
| `install_id` | random UUID | Generated on first launch, stored locally. Not a hardware ID. Changes on reinstall |
| `platform` | `web`, `android` | |
| `app_version` | `1.4.0 (212)` | Web build hash or Android versionName and versionCode |
| `os` / `os_version` | `Android 14`, `Windows 11` | From the UA or the native bridge |
| `device_model` | `Pixel 7` | Android only, through `PicoBridge` |
| `webview_version` | `124.0.6367.113` | Android only. Needed for the older-WebView risk in [Android app](android-app.md) |
| `browser` | `Chrome 124` | Web only |
| `screen` | `390x844` | Width and height only |
| `locale` / `theme` | `ur-PK`, `dark` | |
| `network` | `wifi`, `4g`, `offline` | Coarse type only |
| `user_id` | UUID or empty | Only for signed-in users. Guests stay unlinked. See open decision O1 |

### 4.2 Behaviour events (allowlist)

| Event | Properties | Purpose |
|---|---|---|
| `session_start` / `session_end` | `duration_s` | Session length and daily active users |
| `screen_view` | `screen` (chat, settings, auth, vault, admin-free) | Navigation paths |
| `feature_used` | `feature` (image, web_search, file_upload, memory, mode_change) | Adoption |
| `message_sent` | `mode`, `has_attachment`, `latency_ms`, `status` | Response quality and speed. No content |
| `shield_triggered` / `shield_dismissed` | `app_package_hash` | Android shield usage. App name is hashed |
| `paywall_seen` / `upgrade_clicked` | `plan` | Conversion funnel |
| `permission_prompt` | `permission`, `result` (allowed, denied, dismissed) | Measures the custom permission prompt |
| `feedback_opened` / `feedback_sent` | `type` | Feedback funnel |

### 4.3 Errors and break points

Captured by:

- `window.onerror` and `unhandledrejection` in the web app.
- `ErrorBoundary` (existing component) through `componentDidCatch`.
- Failed `fetch` calls to `/api`, recorded as `http_error` with status and route, never the body.
- Android: `WebViewClient.onRenderProcessGone` and native crashes through the chosen crash SDK (see O2).

Each error record holds:

- `fingerprint`: hash of error name, message with variable parts removed, and the top two stack frames.
- `stack` (trimmed to 4 KB), `route`, `component` when known.
- `breadcrumbs`: up to the last 100 events or 5 minutes, whichever is smaller, copied into the record at the moment of the error.
- `session_id` and `install_id`.

Storing the breadcrumbs inside the error row keeps the break-point timeline available even after the general event data expires.

## 5. Client Design

- **Module:** `apps/web/src/utils/telemetry.ts` (new). Exposes `track(event, props)`, `captureError(error, context)`, and `setIdentity(userId | null)`.
- **Breadcrumb ring buffer:** held in memory, cleared on session end. Only allowlisted events enter it.
- **Queue:** events batch every 10 seconds or 20 items. The queue is persisted in `localStorage` so that a reload or a crash does not lose it. Maximum 500 items. Oldest are dropped first.
- **Transport:** `POST /api/telemetry/batch` with `keepalive: true`, so events still go out on page close. Retries use backoff (5s, 30s, 2min), then give up.
- **Android:** `PicoBridge` supplies device model, OS version, and WebView version. Web fallback reads the user agent.
- **Settings toggle:** "Share usage data" turns off `track` events. Error reports stay on and are described in the privacy policy.

## 6. Server Design

Endpoint: `POST /api/telemetry/batch` in `services/api/src`, following the pattern of `recordRequest` in `server.js`.

- Validate the schema with an allowlist. Reject bodies over 64 KB.
- Rate limit per `install_id` and per IP, following [API security](../security/api-security.md).
- Scrub strings again on the server.
- Attach `user_id` from the session when present. Never trust a `user_id` sent by the client.
- Insert asynchronously. Responses return `202` immediately.

### 6.1 Storage

| Table | Holds | Retention |
|---|---|---|
| `app_sessions` | Device and app fields, start and end time, `user_id` | 180 days |
| `app_events` | Behaviour events with `session_id` and sequence number | 90 days |
| `app_errors` | Fingerprint, stack, route, device, breadcrumbs, counts | 180 days |
| `feedback_reports` | Type, text, `user_id`, device snapshot, `source` (`auto` or `manual`), status | 365 days, or until closed and anonymised |
| `feedback_attachments` | Screenshot in a private Supabase Storage bucket, referenced by path | 30 days after upload, unless attached to an open report |

The existing `telemetry_events` table (used by `aggregator.js` and `watchdog.js`) stays for server-side summaries. The new tables are added to [Database](database.md) when built, as the docs convention requires.

All tables use Row Level Security. Only the admin role reads them. Clients write through the API only.

### 6.2 Aggregation

Extend `services/api/src/workers/aggregator.js` with an hourly job that writes:

- Daily active installs, sessions, and average session length.
- Feature counts per day.
- Error counts per fingerprint per day.

The dashboard reads the aggregates for charts and reads raw rows only for drill-down, so the queries stay fast.

## 7. Break-Point Auto Reports

1. An error is captured. The client sends it in the next batch.
2. The server creates an `app_errors` row. If no open auto-report exists for that fingerprint, it creates one in `feedback_reports` with `source = auto`.
3. Rate limit: at most one auto-report per fingerprint per install every 24 hours. Repeats only increase the count.
4. The user sees nothing. The report carries the device snapshot, breadcrumbs, and route.

Admin dashboard: auto-reports are grouped by fingerprint and show count, first seen, last seen, affected installs, and device breakdown.

## 8. Manual Feedback

### 8.1 Entry point

- A floating button, bottom right, on the chat page. Hidden on auth, marketing, and the vault screen.
- Same component on web and inside the Android WebView.
- Visible on every chat screen, but opening it never interrupts a streaming reply.

### 8.2 Form

| Field | Behaviour |
|---|---|
| Type | Bug, idea, or other. Required |
| Message | Free text, up to 2000 characters. Required |
| Screenshot | Optional. User picks a file or takes a capture. PNG or JPEG, up to 5 MB. EXIF data is stripped |
| Include diagnostics | On by default. Shows exactly what is attached (device, version, last 5 minutes of actions) |
| Name and email | Filled automatically from the session. Not editable in this form |
| Device | Attached automatically from the device snapshot |

Submitting sends one `feedback_reports` row with `source = manual`. The user sees a confirmation and the reference ID.

### 8.3 Screenshot rules

- The capture is user-initiated only. No background or automatic screenshots.
- Elements marked `data-private` (vault, keys, email fields) are masked by the capture tool before saving.
- The UI warns that a screenshot can show personal information.

## 9. Admin Dashboard

Extends the existing Analytics page (`apps/admin/src/pages/Analytics.tsx`) and the admin API (`services/api/src/admin/routes.js`).

- **Overview:** daily active installs, sessions, average session length, retention by install.
- **Features:** feature use over time and the message funnel (sent, streamed, completed).
- **Drop-off:** screen-to-screen paths and where sessions end.
- **Devices:** distribution by platform, device model, OS, WebView version, and app version. Highlights devices on old WebView builds.
- **Errors:** list grouped by fingerprint with count, affected installs, first and last seen, and top devices. Click through to a sample stack.
- **Break point:** for one error, a timeline of the breadcrumbs in the five minutes before it, with device and route.
- **Feedback inbox:** filter by source (auto or manual), type, status, and device. View screenshots. Change status (new, triaged, fixed, wont-fix) and add an internal note.
- **Per-user view:** for a signed-in user, all sessions, errors, and feedback in one place.

## 10. Privacy and Play Compliance

- **Data safety form:** declare the categories in sections 4.1 to 4.3 accurately before the first Play submission. Declare crash logs, diagnostics, and user-submitted feedback (including screenshots) under the matching categories.
- **Existing statement to update:** [Play Store compliance](../product/play-store-compliance.md) says no analytics SDK is planned. This plan adds behaviour analytics, so that line must change. The same change goes into the Persistent identifiers row, because `install_id` is a persistent identifier.
- **Privacy policy:** update `askpico.app/privacy.html` to list these categories, purposes, retention periods, and how to request deletion.
- **Deletion:** a user can request deletion of all telemetry and feedback linked to their `user_id`. A script deletes the rows and storage objects and writes a log entry without content.
- **Review timing:** Play review does not need approval before data collection starts. It does need the data safety form and the privacy policy to match the app's behaviour. Shipping this plan therefore does not add review delay if the disclosures are in place at submission.
- **No cross-app tracking, no ads ID, no sale or sharing of data.**

## 11. Implementation Phases

| Phase | Scope | Exit criteria |
|---|---|---|
| T1 | Client module, error capture, breadcrumb buffer, batch endpoint, `app_errors` table | A forced error in the web app appears in the admin error list with its breadcrumbs |
| T2 | Session and behaviour events, device snapshot, Android `PicoBridge` fields, webview crash hook | Device table and feature funnel populate from a real Android build |
| T3 | Auto reports with grouping and rate limit, admin error and break-point views | A repeated error produces one auto-report with the correct count |
| T4 | Manual feedback button, form, screenshot capture with masking, feedback inbox | A tester sends feedback with a screenshot, and the report shows name, device, and diagnostics without the tester typing them |
| T5 | Settings toggle, privacy policy and data safety updates, deletion script, retention jobs | Policy text matches the collected fields. Retention job removes expired rows in staging |

Recommended order: T1 and T2 before the beta invite, since they cover the crash reports testers need most. T3 and T4 follow in the first beta week. T5 must be complete before the Play submission.

## 12. Open Decisions

- **O1, user linkage:** link telemetry to `user_id` for signed-in users only (recommended, needed for per-user support), or keep everything keyed by `install_id` only.
- **O2, crash SDK:** use Firebase Crashlytics for native Android crashes (recommended, free, Play-friendly), or keep all crash data in the custom pipeline and accept lower native coverage.
- **O3, diagnostics default:** on by default (recommended for beta), or opt-in per report.
- **O4, screenshot capture method:** user picks a file only (simplest, safest), or in-app capture with masking (requires the masking work in T4).
- **O5, retention periods:** the numbers in section 6.1 are proposals. Confirm them with the privacy policy owner.

## 13. Testing

- **Unit tests:** scrubber (emails, phones, tokens, URL queries), allowlist filter, fingerprint stability (same error with different IDs gives the same fingerprint), rate limiter.
- **Integration:** send a batch to the endpoint with an unknown field and confirm it is dropped. Send a body over 64 KB and confirm rejection.
- **Manual:** throw an error from the console, reload, and confirm the error and breadcrumbs appear. Submit manual feedback with and without a screenshot. Turn off "Share usage data" and confirm no behaviour events are sent.
- **Android:** force a WebView renderer crash on a low-memory emulator and confirm the `webview_version` and breadcrumbs arrive after restart.

## 14. Related Documents

- [Beta launch](../product/beta-launch.md)
- [Play Store compliance](../product/play-store-compliance.md)
- [Data protection](../security/data-protection.md)
- [API security](../security/api-security.md)
- [Incident response](../security/incident-response.md)
- [Android app](android-app.md)
- [Database](database.md)
