---
title: kosmos and the hub
section: Concepts
order: 6
summary: Who owns what between the knowledge vault and the hub, how an idea becomes a project and a learning becomes a playbook — and which parts of that loop exist today.
---

# kosmos and the hub

Two systems, one division of labor:

- **kosmos** is where things are thought and kept. It is an Obsidian vault of markdown files:
  inbox, ideas, one page per project, notes. Inside it, `werkstatt/` is a repo of its own —
  the memory shared by all projects: a map of them, playbooks, decisions, conventions, plans.
- **The project repos** are where things are built: code, `docs/adr/`, `docs/learnings.md`,
  and the board in `.apphub/items/`.
- **The hub** shows both as one picture and, later, executes work. It owns no knowledge.

The rule that makes this work is the hub's own first principle, one level up: *markdown in
git is the source, everything else is a view.* The hub reads kosmos and never writes into it.
The decision and its reasons are recorded in kosmos:
`werkstatt/entscheidungen/005-app-hub-wird-zuerst-karte-und-gedaechtnis.md`.

## Who owns what

| Place | Holds | Written by | Read by |
| --- | --- | --- | --- |
| Vault: `eingang/`, `ideen/`, `wissen/`, `quellen/` | everything private | the user (Obsidian, phone, Claude) | the user only |
| Vault: `projekte/` | one page per project: status, next step, repo | the user | the user, the hub |
| `werkstatt/` | project map, playbooks, decisions, conventions, plans | the user and coding agents | coding agents, the user, the hub |
| Project repo | code, ADRs, learnings, the board | coding agents and the user | the hub |
| Hub | nothing of its own — an index that can be deleted | writes board files into the project repo | — |

## The loop

```
   VAULT                         PROJECT REPO                    WERKSTATT

   inbox ──► idea ──► project ──► board / tasks ──► work ──► learning ──► playbook
                      page          ▲                 ▲                      │
                       │ repo:      │                 └── read before a task ┘
                       └────────────┘

   HUB   reads ▲ project pages      ▲ board               ▲ playbooks, decisions
         and draws all of it as one graph: the Map page
```

| Step | What happens | Where | Today |
| --- | --- | --- | --- |
| Capture | one line, unsorted | `eingang/eingang.md` | by hand |
| Sort | the line becomes an idea, a note or a source | vault | by hand |
| Idea becomes project | `status: projekt`, a page in `projekte/` with `repo:` | vault | by hand |
| Repo appears | `apphub new` or `apphub register` | hub | works ([new project](../howto/new-project.md), [existing repo](../howto/register-project.md)) |
| Plan | items on the board, or a `TASKS.md` | project repo | works ([board](../howto/board-workflow.md)) |
| Build | read the playbooks for the task, then work | project repo | Claude Code directly, or the [runner](runner.md); the runner does not know playbooks yet |
| Learn | a learning, or explicitly none | `docs/learnings.md` | a convention in kosmos, not enforced |
| Distill | what holds for a second project becomes a playbook | `werkstatt/` | by hand, monthly |
| See | all of it as one graph | hub, `/map` | works ([read the map](../howto/map.md)) |

The day-to-day version of this table — in German, with "I want to …" recipes — is the page
`werkstatt/konventionen/kosmos-und-app-hub.md` in kosmos. It is on the map as a node; open it
there with **Read**.

## The three joints

Nothing connects the two systems except what stands in files.

- **`repo:` joins projects.** A vault page `projekte/<name>.md` and a hub project are one
  node on the map when they name the same repository — `repo:` in the vault page against
  `repo:` in `.apphub.md` or the git remote. Without a matching repository the slug decides.
- **Frontmatter is the edge list.** `projects`, `topics`, links between pages, `ersetzt durch`
  in a decision's status line, plus `verbindungen` (data flow between two projects) and
  `bausteine` (shared building blocks without a playbook). A fact in a table or in prose is
  not an edge.
- **A section in each project's `CLAUDE.md` sends agents to the werkstatt** before a task and
  asks for a learning after it. The text lives in kosmos
  (`werkstatt/vorlagen/claude-md-abschnitt.md`).

The vault's `naechster_schritt` and the hub's board are deliberately **not** synced: one is
the single next step for the human, the other is every task for the work. The map shows them
side by side on the project node.

## Boundaries

- **Read-only.** No editor, no sync, no inbox in the hub — Obsidian does that. `kosmos.ts`
  has no write path into the vault.
- **Private stays private.** Only `werkstatt/` and `projekte/` are read (`VAULT_FOLDERS` in
  `packages/hub/src/lib/server/kosmos.ts`). The page API serves exactly the pages the map
  scans, nothing else under that folder.
- **Nothing from the vault reaches an agent prompt.** Coding agents see the werkstatt, not the
  vault around it.
- **Machine-local path.** Where kosmos lives differs per machine: `kosmos` in
  `apphub.local.json`, or `APPHUB_KOSMOS_DIR` ([configuration](../reference/config.md)).
  On a machine that has only a clone of the werkstatt repo, point the hub at that — the map
  then shows the werkstatt without the vault's project pages.

## What comes next

In this order ([roadmap](../roadmap.md), pillar 2):

1. Register the other repos, so their `docs/`, ADRs and learnings join the map.
2. Search and help panel over the werkstatt.
3. Board items as nodes on their project.
4. The hub as MCP server: "get playbook", "search learnings".
5. The runner reads the playbooks for a task's topics before it starts and asks for a
   learning when it ends.

Two writes into kosmos are imaginable later, each only on a click: a line into the inbox, and
the project page when a project is created. Both need their own decision in kosmos first.
