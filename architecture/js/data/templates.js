/* Pico Viewer — starter diagram templates and the default Pico architecture source.
   Exports: window.PicoViewer.Templates = { DEFAULT_CODE, TEMPLATES }.
   Depends on: nothing. Loaded before app.js. */
(function () {
  'use strict';
  window.PicoViewer = window.PicoViewer || {};

  // Previous un-annotated default. Used at boot to replace a stale saved copy.
  const LEGACY_DEFAULT = `flowchart LR
    subgraph Clients["Clients"]
        Web["apps/web — React + Vite chat app<br/>(Electron desktop shell)"]
        Mkt["apps/marketing — landing page"]
        Adm["apps/admin"]
        Mob["apps/mobile — Kotlin WebView shell (beta)"]
    end

    subgraph API["Backend — services/api (Express)"]
        SRV["server.js — routes / middleware"]
        ORCH["orchestrator.js — agent + tools"]
        LLMC["llmClient.js — LLM providers"]
        MEM["memory.js — Global Brain"]
    end

    subgraph DB["Supabase"]
        AUTH["Auth — anon guests + signed-in"]
        BRAIN[("user_brain — RLS per user")]
    end

    subgraph Layers["Client-side layers (apps/web)"]
        CTX["contextWindow — last 10 msgs"]
        MEMSTORE["memory-store — 'pico-memory' persisted"]
        FILT["memorySafety — secrets filter"]
    end

    Web --> CTX --> SRV
    SRV --> ORCH --> LLMC
    SRV --> MEM --> BRAIN
    Web --> MEMSTORE --> FILT
    FILT -->|"GET/PUT /api/memory"| SRV
    Web <--> AUTH
    Mob -->|"WebView + JS bridge"| Web
    Mob -.->|"beta: intents + app shield"| SRV
    Adm --> SRV
`;

  const DEFAULT_CODE = `%% title: Pico Architecture
%% description: Clients, Express API, Supabase, and client-side memory layers
%% owner: Pico core
%% updated: 2026-11-09

flowchart LR
    subgraph Clients["Clients"]
        Web["apps/web — React + Vite chat app<br/>(Electron desktop shell)"]
        Mkt["apps/marketing — landing page"]
        Adm["apps/admin"]
        Mob["apps/mobile — Kotlin WebView shell (beta)"]
    end
    %% @node Web role=client desc="React + Vite chat app" file="apps/web"
    %% @node Mkt role=client desc="Landing page" file="apps/marketing"
    %% @node Adm role=client desc="Admin app" file="apps/admin"
    %% @node Mob role=client desc="Kotlin WebView shell (beta)" file="apps/mobile"

    subgraph API["Backend — services/api (Express)"]
        SRV["server.js — routes / middleware"]
        ORCH["orchestrator.js — agent + tools"]
        LLMC["llmClient.js — LLM providers"]
        MEM["memory.js — Global Brain"]
    end
    %% @node SRV role=api desc="Express routes + middleware" file="services/api/src/server.js" %% TODO: confirm path
    %% @node ORCH role=agent desc="Agent loop and tool dispatch" file="services/api/src/orchestrator.js" %% TODO: confirm path
    %% @node LLMC role=llm desc="LLM provider client" file="services/api/src/llmClient.js" %% TODO: confirm path
    %% @node MEM role=memory desc="Global Brain, server side" file="services/api/src/memory.js"

    subgraph DB["Supabase"]
        AUTH["Auth — anon guests + signed-in"]
        BRAIN[("user_brain — RLS per user")]
    end
    %% @node AUTH role=auth desc="Anonymous guests and signed-in users" file="supabase/migrations/0001_init.sql" %% TODO: confirm path
    %% @node BRAIN role=db desc="Per-user memory table with RLS" file="supabase/migrations/0002_user_brain.sql"

    subgraph Layers["Client-side layers (apps/web)"]
        CTX["contextWindow — last 10 msgs"]
        MEMSTORE["memory-store — 'pico-memory' persisted"]
        FILT["memorySafety — secrets filter"]
    end
    %% @node CTX role=client-state desc="Last 10 thread messages" file="apps/web/utils/contextWindow.ts"
    %% @node MEMSTORE role=client-state desc="Persisted local memory store" file="apps/web/store/memory-store.ts"
    %% @node FILT role=safety desc="Filters secrets before sync" file="apps/web/utils/memorySafety.ts"

    Web --> CTX --> SRV
    SRV --> ORCH --> LLMC
    SRV --> MEM --> BRAIN
    Web --> MEMSTORE --> FILT
    FILT -->|"GET/PUT /api/memory"| SRV
    Web <--> AUTH
    Mob -->|"WebView + JS bridge"| Web
    Mob -.->|"beta: intents + app shield"| SRV
    Adm --> SRV
`;

  const TEMPLATES = [
    { id: 'flowchart', name: 'Flowchart', hint: 'Pico architecture (default)', code: DEFAULT_CODE },
    { id: 'sequence', name: 'Sequence', hint: 'Request lifecycle', code: `sequenceDiagram
    autonumber
    participant U as User
    participant W as Web App
    participant A as API
    U->>W: Send message
    W->>A: POST /api/chat
    A-->>W: Stream tokens
    W-->>U: Render reply
` },
    { id: 'class', name: 'Class', hint: 'Object model', code: `classDiagram
    class Renderer {
      +String theme
      +render(code) Promise
    }
    class Editor {
      +String value
      +undo()
    }
    Renderer --> Editor : uses
` },
    { id: 'er', name: 'ER', hint: 'Entity relations', code: `erDiagram
    USER ||--o{ CHAT : starts
    CHAT ||--|{ MESSAGE : contains
    USER {
      string id PK
      string email
    }
    MESSAGE {
      string id PK
      string body
    }
` },
    { id: 'state', name: 'State', hint: 'Chat request states', code: `stateDiagram-v2
    [*] --> Idle
    Idle --> Sending : user submits
    Sending --> Streaming : reply starts
    Streaming --> Idle : done
    Sending --> Idle : error
` },
    { id: 'gantt', name: 'Gantt', hint: 'Release timeline', code: `gantt
    title Release plan
    dateFormat YYYY-MM-DD
    section Beta
    Shell and WebView :done, a1, 2026-01-05, 7d
    Intents :active, a2, after a1, 5d
    section Release
    Store listing :a3, after a2, 4d
` },
    { id: 'mindmap', name: 'Mindmap', hint: 'Idea map', code: `mindmap
  root((Pico))
    Chat
      Memory
    Mobile
      Shield
      Vault
` },
    { id: 'gitgraph', name: 'Git graph', hint: 'Branch history', code: `gitGraph
    commit id: "init"
    branch develop
    checkout develop
    commit id: "feat-a"
    checkout main
    merge develop tag: "v1.0"
` }
  ];

  window.PicoViewer.Templates = { DEFAULT_CODE, LEGACY_DEFAULT, TEMPLATES };
})();
