---
title: Roadmap
section: Roadmap
order: 1
summary: Where the hub is going — foundations done, now map and memory (visualization), then the node planner and the agent Baukasten.
---

# Roadmap

The board is the live plan (`.apphub/items/`); this page is the map above it. Order:
**foundations first, then go big on seeing and orchestrating.**

```
 Foundations ──► Visualization ──┐
     (done)                      ├──► Node planner ──► autonomous, parallel delivery
 Runner concurrency ─────────────┘          ▲
 Agent Baukasten (workflows, hooks, MCP) ───┘
```

## 1 · Foundations — done (2026-10-01/02)

- Board as markdown in each repo, SQLite as a rebuildable index; two machines share one board
  through git.
- One source for paths (`config.ts`); production binds `127.0.0.1:5174`; the hub repo can't
  be deleted from the UI.
- Projects anywhere on disk (`apphub register`); `apphub.local.json` per machine.
- Worktrees for polyglot repos: npm-workspace links, shared cargo cache, auto-excluded
  `.worktrees/`.
- Templates that work on Windows: cross-platform `postCreate`, initial commit, LF policy,
  `tauri-app` (Tauri 2 + Svelte 5 + Cargo workspace).
- Git history as logbook; docs as the in-app help panel.

## 2 · Visualization — now: map and memory first

Understanding comes from seeing structure: connections, dependencies, interactions — zoomable
from the colony down to the single cell. The Architecture page renders the hub's own code as a
2D (Cytoscape) and 3D (force graph) network.

**Decided 2026-11-20:** the hub becomes map and memory before the runner grows (kosmos,
`werkstatt/entscheidungen/005-app-hub-wird-zuerst-karte-und-gedaechtnis.md`). yAPPA got much
further outside the hub than on its board; what was missing across six projects was the
overview, not another executor. So this pillar starts with the cross-project map, fed by
*kosmos* — the markdown vault that holds the playbooks, decisions and plans shared by all
projects. The hub reads kosmos and never becomes its source.

Done:

- **Map v0** (`/map`, [how-to](howto/map.md)) — projects, playbooks, decisions, conventions,
  plans, topics and shared building blocks as one 2D/3D graph, with a reader for every page.
  Edges come from frontmatter (`projects`, `topics`, `verbindungen`, `bausteine`) and links.
  kosmos projects and hub projects are joined by repository.

Next, in this order:

- **Register the other repos** once they are tidied up, so each project's `docs/`,
  `docs/learnings.md` and ADRs join the map.
- **Search and help panel over kosmos** — full text over `werkstatt/` and the registered
  projects' docs, topic pages from `topics:`.
- **Board on the map** — items as nodes on their project.
- **Board as a graph** — items as nodes, `blocked_by` / `relates_to` / `parent` as edges,
  colored by stage, sized by priority; critical path highlighted.
- **Navigable 3D networks** — fly through a project: modules, routes, tables, items and the
  agents working on them; semantic zoom (overview → package → file → symbol).
- **Diagrams in docs** — Mermaid (or similar) rendered in the help panel, so concept pages show
  instead of tell.
- **Live overlays** — runner activity and agent runs pulsing on the graph via the SSE bus.

## 3 · Node planner — after visualization

A node-based planning canvas to work off tickets and plans **sequentially and in parallel**:

- Plans are graphs: nodes = items, edges = dependencies; draw and rewire them on a canvas
  (stored as the same board files — `blocked_by` is the edge list).
- Execution in topological order: independent branches run **in parallel worktrees**, chains
  run in sequence; each node shows its live state (queued → running → review → done).
- Plan templates: e.g. "spike → decision (ADR) → implementation → review" as reusable
  subgraphs.
- Needs **runner concurrency** (below) and the board-graph view from pillar 2.

## 4 · Runner concurrency (v2 Phase 2A)

Task queue with `APPHUB_MAX_CONCURRENT`, lifecycle states (claimed → running → completed /
failed / cancelled), SSE multiplexing for parallel output, a multi-task runner panel.
Prerequisite for parallel execution in the node planner.

## 5 · Agent Baukasten

- Workflow definitions as data (like agents: markdown/YAML, composable steps; the debate
  becomes the first built-in).
- Stage hooks: item enters lane X → agent/workflow Y runs.
- Cron scheduler for routine agent work (board digest, log summaries, triage).
- Stream agent output live over the SSE bus.
- Hub as MCP server: board and projects as tools for any MCP-capable agent (replaces the
  curl-notes instructions in the runner prompt).

## 6 · Platform and DX

- Windows autostart: script ready (`scripts/autostart-windows.mjs`), verify on a real logon.
- File watcher: re-index `.apphub.md` / `.apphub/` on change instead of manual Sync.
- Attachments into the repo (`.apphub/attachments/`), so they travel too.
- Review-lane merges inside a temporary worktree instead of checking out the base branch in
  the main checkout.
- Fractional positions to calm board-file diffs on reorder.
- Fix the remaining svelte-check errors; adopt the response helpers in all routes.

## 7 · Projects on the hub

- **yAPPA** (self-hosted gaming voice chat, Tauri + Rust + LiveKit) — `projects/yappa` was the
  first external project through the full pipeline: spike S0 passed on 2026-10-02 (skeleton
  built by Claude Code in a worktree, reviewed, merged). **Since 2026-11-10 yAPPA is built
  outside the hub** in its own repo (`dev/YAPPA`, kosmos decision 003); `projects/yappa` is the
  retired variant and will be archived.
- **lyrics-helper** — register the existing repo so it gets its work items from the hub.

## Later, maybe

- Direct Anthropic API runner mode with own tool layer and cost tracking (v2 Phase 2B) — only
  if the CLI backends stop being enough.
- Self-modification safety gates (feature flag, cooldown, validation pipeline) — dogfooding
  already runs through the review lane, which is the main gate.

Superseded plans and their status are archived in [history](history/README.md).
