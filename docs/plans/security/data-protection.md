# Data Protection

**Status:** Planning
**Owner:** Pico engineering
**Parent:** [Security plan](README.md)
**Related:** [Database](../engineering/database.md) · [Authentication](../engineering/authentication.md) · [Beta launch](../product/beta-launch.md)

## 1. Personal Data Inventory

| Data | Stored in | Purpose | Retention |
|---|---|---|---|
| Email | Backend database (`profiles`) | Sign-in and account recovery | Until account deletion |
| Name | Backend database (`profiles`) | Display name | Until account deletion |
| Plan and subscription status | Backend database (`subscriptions`) | Feature and quota access | Until account deletion |
| Referral code and reward records | Backend database | Referral program | Until account deletion |
| Usage counts (tokens) | Backend database | Quota enforcement | Until account deletion |
| Chats, folders, and settings | Browser local storage, then cloud sync (post-beta) | Core product | Until the user deletes them or clears the browser |
| Agent chat history | Backend database (`agent_messages`) | Agent context | Until the user deletes the chat or the account |
| Generated images | Browser IndexedDB | Image studio output | Until the user deletes them |

## 2. Principles

- **Collect only what a feature needs.** New fields need a reason written in the relevant module plan.
- **Do not log message content.** Logs contain request IDs, routing tiers, and status codes only.
- **Do not send user data to the marketing site.** It has no login and no analytics that identify users.
- **Keep secrets out of the database.** Passwords are not stored by Pico. Sign-in uses Google or magic links.

## 3. Encryption

- **In transit:** HTTPS everywhere, including the API and all subdomains.
- **At rest:** database encryption is provided by the hosting platform. Backups follow the same policy.
- **On device:** the Pico Vault uses AES-GCM with a PBKDF2-derived key. This is post-beta (see [Pico vault](../modules/pico-vault.md)).

## 4. Deletion

- Account deletion removes the user, sessions, referral records linked to the user, agent history, and profile data. The user is logged out.
- Deletion must complete end to end, as required by scenario S16 in the [Beta launch](../product/beta-launch.md) plan and by Google Play.
- Database backups are kept for 7 days. Deleted data is removed from backups when that period ends. The privacy policy states this period.

## 5. Privacy Policy Requirements

The published privacy policy must list every stored field in section 1, state the retention rule for each, name the third-party AI providers that receive message content, and explain how to request deletion.

## 6. Third-Party AI Providers

User messages are sent to the providers below. Each provider's DPA or services agreement governs its processing.

| Provider | Role in Pico | Agreement | Retention and training | Notes |
|---|---|---|---|---|
| **Groq** | AI model inference | Groq Services Agreement, with the DPA at `console.groq.com/docs/legal/customer-data-processing-addendum` | Groq does not use Inputs or Outputs for training unless the customer instructs it. Groq stores them only as needed to provide the service. Zero data retention (ZDR) can be enabled in the Console | Beta Services are not covered by the DPA. Groq's terms are for developers and businesses, and the account holder must be 18 or older |
| **OpenRouter** | AI model routing | OpenRouter Data Processing Agreement (last updated August 26, 2026) | Inputs and Outputs are deleted after generation unless prompt or chat logging is enabled. ZDR-only routing can be enabled so requests go only to ZDR-eligible model providers | Requests are passed on to the underlying model providers, which have their own terms. Deletion on request within 30 business days. Breach notice within 72 hours. Sub-processors are listed by OpenRouter |

Rules for providers:

- Enable ZDR on Groq and ZDR-only routing on OpenRouter before beta. Record the setting in the provider dashboard.
- Keep a copy of each DPA version accepted, with its date.
- A new provider needs a DPA review and a row in this table before it receives user data.
- The privacy policy names each provider and links to its DPA.
- Account deletion also asks providers to delete any data they hold. Provider deletion timelines are longer than the 7-day backup period, so the privacy policy must state both.

## 7. Open Items

- Confirm Groq ZDR and OpenRouter ZDR-only routing are enabled on the accounts used by Pico.
- Confirm which underlying model providers OpenRouter routes to, and that each has an acceptable zero-retention policy.
- Confirm Pico's consumer use is allowed under the Groq terms, since they state the services are not for consumer use.
- Avoid Groq Beta Services for user traffic, because the DPA does not cover them.
