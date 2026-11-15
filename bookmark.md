# Bookmark Review: "Pico Ai / Repo Mix"

Source: `bookmarks_11_10_26.html` > Bookmarks bar > Pico Ai > Repo Mix (71 GitHub repos).

Scope of this review:
- License checked for every repo by reading the `LICENSE` file from the default branch (raw.githubusercontent.com).
- Purpose taken from each bookmark's description, plus general knowledge of the project.
- Not checked in this pass: stars, last commit date, open issues, security audits, or README-level install details. Verify these before adopting any repo.

## Project context

Pico is **proprietary** (see `LICENSE`). Stack: React + Vite web app, Express API with SQLite, Supabase for auth and sync, Android WebView shell planned.

Rules applied:
- **Permissive (MIT, Apache-2.0, BSD, ISC):** can be used commercially with attribution. Apache-2.0 requires keeping the NOTICE file.
- **Copyleft (GPL, AGPL, MPL):** do not copy or link the code into Pico's closed-source code. Running an unmodified copy as a separate service is generally acceptable. AGPL also applies to modified versions used over a network, so modified AGPL services must publish their source.
- **Source-available (Elastic, modified Apache):** commercial or hosting restrictions apply. Do not embed or host as a service for others.
- **No LICENSE file:** all rights reserved by default. Do not use the code.

Usage categories:
- **Dev tool:** install in the developer environment only. Not shipped in Pico.
- **Embed:** add as a dependency or code in Pico. Keep the bundle light.
- **External service:** deploy separately from the web app and call over HTTP.
- **Reference:** read for ideas only.
- **Skip:** not relevant or too heavy for Pico.

## Summary

- **Embed candidates (permissive, light):** Excalidraw (lazy-load only), reimagine-it CLI, humanizer (as prompt/writing logic).
- **Dev tools (internal, high value):** Playwright, superpowers, agent-skills, ui-ux-pro-max-skill, code-review-graph, Chisle, geo-seo-claude, scroll-craft, Supabase agent-skills.
- **External services (only when a feature needs them):** Coolify (deploy host), Presenton (slides), HyperFrames and Argo (marketing video), Scrapling (Python scraping service), Hindsight (memory, evaluate against the existing Global Brain first).
- **Do not use in Pico:** AGPL/GPL/Elastic projects for embedding, no-license repos, and heavy platforms (Dify, Chatwoot, OpenProject, Metabase, Immich, Paperless-ngx, Invoice Ninja, cal.diy).

## Full repo table

| # | Repo | What it does | License | Verdict | Pico use | Category |
|---|---|---|---|---|---|---|
| 1 | debpalash/VoiceStudio | Local voice cloning, dubbing, transcription | AGPL-3.0 | Copyleft | Voice mode (v2+). Heavy GPU models | Skip for embed. See alternatives |
| 2 | every-app/open-seo | Open-source SEO tool (Semrush alternative) | MIT | Permissive | SEO audit for `apps/marketing` | Dev tool |
| 3 | AppFlowy-IO/AppFlowy | Notion alternative workspace | AGPL-3.0 | Copyleft | Not needed. Pico already has chat, folders, and memory | Skip |
| 4 | OpenWhispr/openwhispr | Voice dictation desktop app (local and cloud) | MIT | Permissive | Reference for voice input design | Reference |
| 5 | opf/openproject | Project management (Jira alternative) | GPL-3.0 | Copyleft | Not needed. Heavy Rails stack | Skip |
| 6 | calcom/cal.diy | Scheduling | MIT | Permissive | Not core. Heavy (Next.js + Postgres) | Skip (external only if booking is needed) |
| 7 | chatwoot/chatwoot | Live chat and support desk | MIT | Permissive | Support chat for marketing site. Heavy (Rails, Redis, Postgres) | External service (or use a hosted tool) |
| 8 | capsoftware/cap | Screen recorder (Loom alternative) | AGPL-3.0 with MIT parts (mixed) | Copyleft, verify per folder | Marketing demo recordings | Skip. See alternatives |
| 9 | obra/superpowers | Agentic skills framework for coding agents | MIT | Permissive | Faster AI-assisted development | Dev tool |
| 10 | zubair-trabzada/geo-seo-claude | GEO-first SEO skill for Claude Code | MIT | Permissive | SEO for marketing site | Dev tool |
| 11 | tirth8205/code-review-graph | Local code graph that cuts AI context size | MIT | Permissive | Reduces AI token use on the Pico repo | Dev tool |
| 12 | tirth8205/Understand-Anything | Turns code into an explorable knowledge graph | MIT | Permissive | Onboarding and architecture review | Dev tool |
| 13 | nextlevelbuilder/ui-ux-pro-max-skill | UI/UX design intelligence skill | MIT | Permissive | Consistent UI work on web and marketing | Dev tool |
| 14 | heygen-com/hyperframes | Write HTML, render video (agent-friendly) | Apache-2.0 | Permissive | Product videos. Needs headless browser and ffmpeg | External service |
| 15 | nateherkai/scroll-craft | Scroll-driven website skill | MIT | Permissive | Marketing page effects | Dev tool |
| 16 | addyosmani/agent-skills | Production engineering skills for AI agents | MIT | Permissive | Dev workflow quality | Dev tool |
| 17 | blader/humanizer | Removes AI-writing patterns from text | MIT | Permissive | Writing quality for marketing copy and Career Agent output | Embed as prompt logic, or dev tool |
| 18 | expo/skills | Expo skills | MIT | Permissive | Not relevant. Pico Android is Kotlin, not Expo | Skip |
| 19 | supabase/agent-skills | Supabase skills for AI agents | MIT | Permissive | Supabase schema and RLS work (`user_brain` table) | Dev tool |
| 20 | microsoft/playwright | Browser automation and E2E testing | Apache-2.0 | Permissive | Automated tests for web app and marketing | Dev tool (high value) |
| 21 | dietrichgebert/ponytail | Lean-coding prompt skill ("best code is no code") | MIT | Permissive | Keeps code minimal | Dev tool |
| 22 | getagentseal/codeburn | Tracks AI coding token cost locally | MIT | Permissive | Dev-side cost tracking | Dev tool |
| 23 | anthropics/knowledge-work-plugins | Plugins for knowledge work (Claude Cowork) | Apache-2.0 | Permissive | Reference for plugin design | Reference |
| 24 | Panniantong/Agent-Reach | CLI giving agents access to social sites | MIT | Permissive (code) | Scrapes Twitter, Reddit, etc. Platform ToS risk | Reference. Not for production |
| 25 | metabase/metabase | BI dashboards | AGPL-3.0 | Copyleft | Admin analytics. Heavy (Java) | Skip. See alternatives |
| 26 | paperless-ngx/paperless-ngx | Document archive with OCR | GPL-3.0 | Copyleft | Pico already has in-browser PDF tools | Skip. See alternatives |
| 27 | invoiceninja/invoiceninja | Invoicing, quotes, time tracking | Elastic License 2.0 | Source-available, not open source | Not needed now | Do not use |
| 28 | codecrafters-io/build-your-own-x | Tutorials for building technologies from scratch | No LICENSE file found | All rights reserved | Learning only | Reference only |
| 29 | public-apis/public-apis | List of free public APIs | MIT | Permissive | Find free APIs for Pico tools | Reference (list) |
| 30 | FreeForDev/FreeForDev | List of free developer tools | No LICENSE file found | All rights reserved | Tool discovery only | Reference (list) |
| 31 | diegoleme/awesome-open-source-alternatives | List of open-source alternatives to paid SaaS | MIT | Permissive | Tool discovery | Reference (list) |
| 32 | mahseema/awesome-ai-tools | List of AI tools | MIT | Permissive | Tool discovery | Reference (list) |
| 33 | immich-app/immich | Self-hosted photo and video backup | AGPL-3.0 | Copyleft | Not needed. Heavy | Skip. See alternatives |
| 34 | coollabsio/coolify | Self-hosted PaaS (Vercel and Heroku alternative) | Apache-2.0 | Permissive | Host `services/api` on your own VPS | External service (deploy host) |
| 35 | excalidraw/excalidraw | Hand-drawn style whiteboard | MIT | Permissive | Diagram or whiteboard tool in Office or Studio agent | Embed (lazy-load, large bundle) |
| 36 | alchaincyf/huashu-motion | Commercial launch-film generation skill | MIT | Permissive | Marketing videos | Dev tool (marketing) |
| 37 | rossark0/rossark-motion-skill | SVG to 60fps animation skill | MIT | Permissive | Marketing animations | Dev tool (marketing) |
| 38 | talsiach/take-one | Launch video and ad generation skill | MIT | Permissive | Marketing videos | Dev tool (marketing) |
| 39 | NiazMorshed2007/reanimate | Reverse-engineers animations frame by frame | MIT | Permissive | Marketing animations | Dev tool (marketing) |
| 40 | shreyaskarnik/argo | Playwright scripts to product demo videos | MIT | Permissive | Demo videos for Pico features | Dev tool (marketing) |
| 41 | vincentsch/explainroo | Explainer videos with local voice and captions | MIT | Permissive | Explainer videos | Dev tool (marketing) |
| 42 | win4r/video-director | Code-rendered video (HTML to MP4) skill | MIT | Permissive | Marketing videos | Dev tool (marketing) |
| 43 | Leonxlnx/earshot | CPU-only "ears" for agents (audio in and out) | MIT | Permissive | Candidate for voice mode (v2+) | Evaluate for voice mode |
| 44 | D4Vinci/Scrapling | Adaptive web scraping framework (Python) | BSD-3-Clause | Permissive | Web lookup tool. Run as a separate Python service | External service |
| 45 | langgenius/dify | LLM app and agent platform | Modified Apache (custom "Open Source License") | Source-available with extra conditions | Heavy multi-container platform. Overlaps with Pico | Skip. Read license before any use |
| 46 | mutonby/openshorts | AI short-video clipper (9:16) | MIT | Permissive | Not core. Needs GPU | External service (only if needed) |
| 47 | presenton/presenton | AI presentation generator | Apache-2.0 | Permissive | Could back a "slides" tool in Office Agent | External service |
| 48 | img2threejs/img2threejs | Image to Three.js model | Apache-2.0 | Permissive | Niche 3D feature | Reference |
| 49 | reticlehq/reticle | Runtime perception for generated web apps | Apache-2.0 | Permissive | Testing artifact previews | Dev tool |
| 50 | JayPokale/Chisle | Cuts AI coding token use (zero deps) | MIT | Permissive | Dev-side token savings | Dev tool |
| 51 | Q00/ouroboros | Agent OS with interview-gated evolution loop | MIT | Permissive | Heavy concept. Reference only | Reference |
| 52 | TauricResearch/TradingAgents | Multi-agent trading framework | Apache-2.0 | Permissive | Not relevant to Pico | Skip |
| 53 | affaan-m/ecc | Agent harness, skills, and memory for coding tools | MIT | Permissive | Large dev harness. Optional | Dev tool (optional) |
| 54 | pingdotgg/t3code | Desktop GUI for coding agents | MIT | Permissive | Dev UI. Optional | Dev tool (optional) |
| 55 | robbietilton/compositor | Photoshop-style editor for Mac | MIT | Permissive | Mac desktop app. Not for Pico | Skip |
| 56 | citrolabs/ego-lite | Browser for AI agents with shared login state | MIT | Permissive | Automated QA sessions | Dev tool |
| 57 | vercel-labs/skills | Open agent skills installer (`npx skills`) | MIT | Permissive | Installs the skills above | Dev tool |
| 58 | stablyai/orca | Run a fleet of coding agents | MIT | Permissive | Dev desktop app | Dev tool (optional) |
| 59 | rehan-remade/universal-modder | Game modding with Claude Code | MIT | Permissive | Not relevant | Skip |
| 60 | Jakeschincariol/arena-skill | Best-of-N tournament skill for AI answers | MIT | Permissive | Dev-side prompt testing | Dev tool |
| 61 | tashfeenahmed/freellmapi | OpenAI-compatible proxy across free LLM tiers | MIT (code) | Permissive code, but README says personal use only | Do not deploy in production. Provider ToS likely forbids resale | Reference / local testing only |
| 62 | altic-dev/FluidVoice | macOS on-device dictation | GPL-3.0 | Copyleft | Mac app only | Skip. See alternatives |
| 63 | ace-step/ACE-Step-1.5 | Local music generation model | MIT (code) | Permissive code. Check model weights license | Heavy GPU. No current feature | Skip |
| 64 | bilawalsidhu/gods-eye-view | Browser 3D globe with live spatial data | MIT | Permissive | Not relevant | Skip |
| 65 | K-Dense-AI/scientific-agent-skills | 177 science skills for agents | MIT | Permissive | Study Agent tools (chemistry, physics, biology) | Reference or dev tool. Port selectively |
| 66 | jingyaogong/minimind | Train a 64M-parameter LLM from scratch | Apache-2.0 | Permissive | Learning only | Reference |
| 67 | omacom/omarchy | Opinionated Arch Linux setup | MIT | Permissive | Not relevant | Skip |
| 68 | google-research/timesfm | Time-series forecasting model | Apache-2.0 | Permissive | Not relevant | Skip |
| 69 | vectorize-io/hindsight | Agent memory system | MIT | Permissive | Compare with Pico's Global Brain before v2 pgvector recall | Reference (evaluate). External service if adopted |
| 70 | Kayforkind/reimagine-it | HTML to standalone redesign CLI | MIT | Permissive | Lightweight tool for Creative or Office Agent | Embed as CLI (optional) |
| 71 | Autom8AI/Open-Higgsfield-AI | Open-source AI image and video studio | No LICENSE file found (bookmark says MIT) | All rights reserved | Do not use until the license is confirmed. Pico already has the Gemini image studio | Do not use |

## Alternatives for skipped or restricted repos

These are candidates from the license check above. Their fit for features has not been tested.

- **VoiceStudio (AGPL-3.0)** replacements:
  - Piper (MIT): fast local TTS
  - OpenVoice (MIT): voice cloning
  - faster-whisper (MIT) or openai/whisper (MIT): transcription
  - Coqui TTS (MPL-2.0): file-level copyleft. Acceptable if unmodified files are used
- **AppFlowy (AGPL-3.0):** AFFiNE (MIT for the community code; enterprise folders use other terms, so verify before use)
- **OpenProject (GPL-3.0):** Taiga (MPL-2.0)
- **Cap (AGPL-3.0 with MIT parts):** Kap (MIT), macOS screen recorder
- **Metabase (AGPL-3.0):** Apache Superset (Apache-2.0)
- **Paperless-ngx (GPL-3.0):** Mayan EDMS (Apache-2.0). Copyright header and "Apache License" text found, verify before use
- **Immich (AGPL-3.0):** LibrePhotos (MIT)
- **FluidVoice (GPL-3.0):** OpenWhispr (MIT), faster-whisper or whisper (MIT)
- **Invoice Ninja (Elastic 2.0):** no permissive replacement confirmed. Crater, checked here, is AGPL-3.0, so it is not a fix. Options: build simple invoices in-house, or use a hosted invoicing service
- **Dify (custom Apache-based license):** no direct replacement needed. Pico's agent layer covers the same use case in a lighter way
- **Repos with no LICENSE file** (Open-Higgsfield-AI, build-your-own-x, FreeForDev): Pico already has an image studio, so no replacement is needed. Use the lists (FreeForDev, awesome lists) only to discover tools

## Search and studio candidates

Added after the feature review. Licenses verified from the repo `LICENSE` files.

- **Live web search: `ItzCrazyKns/Vane`** (formerly Perplexica), MIT
  - AI answer engine with cited sources (similar flow to Google AI Mode), not tied to Google alone.
  - Uses SearXNG for metasearch. Configured engines are queried, not one index.
  - Integration: `POST /api/search` (JSON, optional streaming) from `services/api`. Deploy as a separate Docker service.
  - Caveat: SearXNG is AGPL-3.0. Run it unmodified as a separate service. Modifying it triggers source publication for the network-served version.
  - Category: External service.
- **Studio UI: `generalizingai/OpenStudio`**, MIT (two copyright lines: "Open Generative AI Contributors" and "OpenStudio Contributors")
  - Modules: Image, Video, Video Tools, Cinema Studio, Reels, Lip Sync, Audio, Vibe Motion (animation), Storyboard, Agent, Workflows.
  - Gaps: no web search, no TTS/voice cloning listed in README, generation runs through MuAPI only (add adapters for other providers).
  - Stack: Next.js 15 + React 19, server-side proxy routes keep keys off the browser. Port UI components into Pico's Vite app.
  - Attribution: keep both copyright lines and the MIT text in a `THIRD_PARTY_NOTICES` file. No source publication required.
  - Unverified: `packages/` subfolders (`Open-Poe-AI`, `Open-AI-Design-Agent`, `Vibe-Workflow`) may carry their own licenses. Check before copying.
  - Category: Embed (UI components) plus external service (proxy).
- **Studio alternatives (also MIT):** `egebese/genny` (fal.ai catalog, canvas UI), `lalantony/comfyui-ai-studio` (ComfyUI backend, self-hosted).
- **Do not use:** `nova-image-studio` (AGPL-3.0), `opencauldron` (Sustainable Use), `gateway/media-studio` (non-commercial), `wide-trace/open-higgsfield` (no LICENSE file).

## Recommended next steps

1. Install Playwright and the MIT/Apache dev skills in the developer environment. No change to the Pico runtime.
2. Evaluate Excalidraw as a lazy-loaded component in an agent tool. Check the bundle size first.
3. For voice mode (v2+), compare Piper, OpenVoice, faster-whisper, and earshot against the `docs/plans/modules/voice-mode.md` requirements.
4. Before any service deploy, pick the host with Coolify (Apache-2.0) and check resource needs of each candidate.
5. Evaluate Hindsight against the existing Global Brain (`services/api/src/memory.js`) before adding a memory service.
6. Verify stars, maintenance, and security for every repo you plan to adopt.
