# Pico diagram rules for AI agents

These rules apply to every `.mmd` file in this folder. Read them before editing a diagram.

## File format
- Use Mermaid `flowchart LR` (or `TD` for stacked layers). Do not change the diagram type of an existing file.
- Start every file with a metadata header:
  - `%% title: ...`
  - `%% description: ...` (one line)
  - `%% owner: ...`
  - `%% updated: YYYY-MM-DD`
- Keep each file under 150 lines. Split large diagrams into a new file instead.

## Node annotations
- Give every node a `%% @node <ID> role=<role> desc="<one line>" file="<real path>"` line directly below its subgraph or edge block.
- `role` is one of: `client`, `api`, `agent`, `llm`, `voice`, `memory`, `auth`, `db`, `client-state`, `safety`, `tool`, `artifact`, `async`.
- `file` must be a real path in the repo. If you are not sure, write the best guess and add `%% TODO: confirm` at the end of the line.

## Facts
- Use only facts from the repo README, existing diagrams, or code you have read in this session.
- Never invent endpoints, table names, or service names. Mark unknowns with `%% TODO: confirm`.
- Keep node labels short. Put detail in `desc=`.

## Editing
- Make minimal changes. Do not rename existing node IDs; other diagrams and links depend on them.
- Keep the existing layers (Clients, Backend, Supabase, Client-side layers) in `pico-architecture.mmd`.
- Do not add styling (`classDef`, `style`, colours). Styling is applied by the viewer at render time.
- After editing, check that the Mermaid code renders in the viewer with no error.
