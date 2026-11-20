# Pico Documentation

This folder holds the product, module, and engineering plans for Pico. Each document states its status at the top. Start with the [Beta launch plan](plans/product/beta-launch.md) for the current release scope.

## Product

| Document | Purpose |
|---|---|
| [Beta launch](plans/product/beta-launch.md) | Scope, pages, launch scenarios, and exit criteria for the web and Android beta |
| [Feature catalog](plans/product/feature-catalog.md) | Every planned feature by platform, with cost, effort, and agent structure |
| [Launch budget](plans/product/launch-budget.md) | One-time and monthly launch costs, API deposits, and cost control rules |
| [Play Store compliance](plans/product/play-store-compliance.md) | Google Play policy checklist mapped to Pico, Play Billing rules, AI content safety, SDK data safety, and open decisions |
| [Roadmap](plans/product/roadmap.md) | Complex, costly, or legally sensitive features planned for after the beta |

## Modules

| Document | Purpose |
|---|---|
| [Pico character](plans/modules/pico-character.md) | Character state, visual layers, and the multi-agent router |
| [Agent persona](plans/modules/agent-persona.md) | Persona model, emotional states, reactions, and the chibi character's style and animation |
| [Voice mode](plans/modules/voice-mode.md) | Archived — voice removed (text-only beta, round 63); kept for reference |
| [Memory system](plans/modules/memory-system.md) | Three-layer memory: global brain, 10-message thread window, and pgvector long-term recall |
| [Pico vault](plans/modules/pico-vault.md) | Encrypted on-device vault that tokenizes personal data before it reaches the AI |

## Engineering

| Document | Purpose |
|---|---|
| [Agent development](plans/engineering/agent-development.md) | Agent framework, persona assignments, tool build order, and API routing |
| [Android app](plans/engineering/android-app.md) | Kotlin WebView shell, JS bridges, screens, and Play Store release plan |
| [Authentication](plans/engineering/authentication.md) | Accounts, sessions, home page, referrals, and phased rollout |
| [Database](plans/engineering/database.md) | Current storage inventory and the Supabase migration plan |
| [Telemetry and feedback](plans/engineering/telemetry-and-feedback.md) | Usage analytics, device and break-point error reports, auto and manual feedback, and the admin views for them |
| [Testing guide](plans/engineering/testing-guide.md) | Manual test steps and prompts for each agent and tool |
| [Branching strategy](plans/engineering/branching-strategy.md) | Permanent branches, feature and device branches, release and hotfix flow |

## Security

| Document | Purpose |
|---|---|
| [Security plan](plans/security/README.md) | Index of security requirements, principles, and review cadence |
| [Threat model](plans/security/threat-model.md) | Assets, trust boundaries, threats, and controls |
| [Data protection](plans/security/data-protection.md) | Personal data inventory, encryption, retention, and deletion |
| [API security](plans/security/api-security.md) | Auth, sessions, CORS, rate limits, input handling, and secrets |
| [Incident response](plans/security/incident-response.md) | Vulnerability reporting, severity, response steps, and key rotation |

## Conventions

- **Status line:** every document states its status (Planning, Active, Living document, or Icebox items inside the roadmap).
- **Cross-references:** documents link to each other by relative path. Section numbers are stable, so references stay valid when content is added.
- **Moving a feature:** when a feature moves between documents, record the move in the Removed and Archived table of the [Roadmap](plans/product/roadmap.md).
- **New data storage:** any feature that saves data must be added to the [Database](plans/engineering/database.md) document.
- **Language:** documents are written in English. Product names and persona names keep their original spelling.
