# Security Plan

**Status:** Planning
**Owner:** Pico engineering
**Scope:** Security requirements, threat model, data protection, API security, and incident response for the web app, the backend, and the marketing site.

## 1. Purpose

Pico handles personal chats, uploaded files, and account data. This folder defines how that data is protected, what threats the system is designed against, and how security issues are reported and handled.

## 2. Documents

| Document | Purpose |
|---|---|
| [Threat model](threat-model.md) | Assets, trust boundaries, threats, and the controls that address them |
| [Data protection](data-protection.md) | What personal data is stored, how it is protected, retention, and deletion |
| [API security](api-security.md) | Authentication, authorisation, rate limits, CORS, input handling, and secrets |
| [Incident response](incident-response.md) | Vulnerability reporting, triage, response steps, and user notification |

## 3. Principles

- **Secrets stay on the server.** Provider keys and service tokens are never sent to the browser or committed to the repository.
- **Plan and quota checks are server-side.** The client never decides a user's plan, model tier, or quota.
- **Least data.** Collect only what a feature needs, and keep it only as long as required.
- **Fail closed.** When an auth or quota check cannot complete, the request is rejected.

## 4. Ownership and Review

- Security documents are reviewed before each beta release and after any change to auth, payments, storage, or third-party providers.
- Changes that affect data handling must also update the [Database](../engineering/database.md) document and the [Privacy policy](../product/beta-launch.md) requirements.
