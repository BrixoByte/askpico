# Launch Budget

**Status:** Planning
**Owner:** Pico product team
**Related:** [Beta launch](beta-launch.md) · [Feature catalog](feature-catalog.md)

## 1. Purpose

This document lists the initial budget needed to develop, launch, and run the Pico beta. It separates one-time launch costs from recurring monthly costs so the cash requirement is clear before spending starts. Amounts are in USD with PKR at **1 USD = PKR 276.58**. No paid tools are needed beyond the items listed; the $50 monthly budget is pure API cost.

## 2. One-time costs

| Item | USD | PKR | Notes |
|---|---|---|---|
| Domain: `askpico.app` | $12 / year | ~3,319 / year | Product domain. Renews annually |
| Domain: `brixobyte` (company) | $14 / year | ~3,872 / year | Company domain for business identity and email |
| Google Play Console | $26 | ~7,191 | One-time developer account fee |
| **Total one-time** | **$52** | **~14,382** | Domains counted as first-year cost |

## 3. Monthly recurring costs

| Item | USD | PKR | Notes |
|---|---|---|---|
| Devin subscription | $21 / month | ~5,808 / month | Development tooling |
| AI provider budget | $50 / month | ~13,829 / month | Pure API spend cap for beta (Groq + OpenRouter). Enforced by per-tier daily caps in the beta plan |
| **Total monthly** | **$71** | **~19,637** | No paid tools beyond these |

## 4. Free-tier services (no cost in beta)

| Service | Free limit | Watch for |
|---|---|---|
| Supabase (auth + database) | Free tier | 500 MB database, egress limits |
| Resend (magic-link email) | 100/day, 3,000/month | Rate-limit the auth flow so abuse cannot burn the quota |
| Groq (Quick tier) | Free tier | Rate limits per model |
| Web hosting (marketing + app) | Free tier host | Bandwidth and build minutes |
| Android Studio | Free | — |

## 5. API deposits

| Item | USD | PKR | Notes |
|---|---|---|---|
| OpenRouter starting deposit | $20 | ~5,532 | Prepaid credit for Smart and Deep tiers |
| Groq paid buffer | $10 | ~2,766 | Held aside if the free tier limits are hit |
| **Total deposits** | **$30** | **~8,298** | One-time top-up, drawn down by usage. Counts toward the $50 monthly API cap |

## 6. Budget summary

| Phase | USD | PKR |
|---|---|---|
| Month 1 (one-time + deposits + first month) | $52 + $30 + $71 = **$153** | **~42,299** |
| Every month after | **$71** | **~19,637** |
| Annual domain renewals (from month 13) | $26 / year | ~7,191 / year |

## 7. Cost control rules

- The $50/month AI budget is a hard ceiling. The per-tier caps in the [Beta launch](beta-launch.md) section 4.2 keep daily spend near $1.66.
- Weekly check: cost per tier and total spend against the $50 cap. If a tier drifts high, tighten its global cap.
- Every new service joins this document with its free limit and paid price before adoption.
- The deposits are spent only against real usage; they are not recurring fees.

## 8. Open items

- Decide the renewal month for both domains so they do not lapse.
- Confirm the web hosting choice and its free-tier ceiling.
- If Play Console verification needs extra documents or fees, record them here.
