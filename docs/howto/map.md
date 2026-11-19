---
title: Read the map
section: How-to
order: 9
summary: kosmos as one graph — projects, playbooks, decisions, topics and shared building blocks, in 2D and 3D, with a reader for every page.
routes: ['/map']
---

# Read the map

The **Map** page draws *kosmos* as one network: every project, the knowledge that concerns it,
and what connects the two. kosmos is a folder of markdown files (an Obsidian vault) that lives
outside the hub; its `werkstatt/` folder holds the cross-project memory for coding agents —
playbooks, decisions, conventions, plans.

The hub **only reads**. kosmos stays the source; nothing on this page writes into it. Who owns
what between the two, and how work flows through both: [kosmos and the hub](../concepts/kosmos.md).

## Point the hub at kosmos

The path differs per machine, so it is machine-local:

```bash
npm run cli -- kosmos D:/Projekte/dev/kosmos    # set
npm run cli -- kosmos                           # show path and what the map finds
npm run cli -- kosmos --unset                   # forget it
```

Or open `/map` and enter the folder there. It is stored as `kosmos` in `apphub.local.json`;
`APPHUB_KOSMOS_DIR` overrides it. Give the vault folder, or — on a machine that only has it —
a clone of the `werkstatt` repo.

## What is on the map

| Node | Comes from |
| --- | --- |
| **Project** | `projekte/<name>.md` in the vault, every slug named in a `projects:` list, and every project the hub knows |
| **Playbook, decision, convention, plan, overview** | a page in `werkstatt/` — its `type` in the frontmatter decides |
| **Building block** | an entry under `bausteine:` in a page's frontmatter: something built more than once that has no playbook yet |
| **Topic** | a `topics:` entry that at least two pages share |

| Edge | Comes from |
| --- | --- |
| **Concerns** | `projects: [vizzy, yappa]` on a page; a building block's `projects` |
| **Concerns all** | the same, for pages that name (nearly) every project — hidden until you switch it on |
| **Topic** | `topics: [...]` |
| **Link** | a markdown link or `[[wikilink]]` between two pages |
| **Supersedes** | `ersetzt durch 004` in a decision's `Status:` line |
| **Data flow** | an entry under `verbindungen:` (`von`, `nach`, `was`) |

A kosmos project and a hub project become **one node** when their repositories match
(`repo:` in the vault page against `.apphub.md` or the git remote), else when the slugs match.
The node then shows both sides: status and next step from kosmos, board numbers from the hub.

## Use it

- **Click a node** to see what it is and what it connects to; the rest of the graph dims.
- **Read** opens the page in a drawer. Links between kosmos pages stay in the drawer and move
  the selection on the map with you.
- **2D / 3D** switches between the flat graph and the one you fly through.
- The **gear** opens layout, size and filters. Hide topics or overviews when the middle gets
  crowded; switch on *Concerns all* to see which rules apply everywhere.

## What it leaves out

Only `werkstatt/` and `projekte/` are read. The rest of the vault — inbox, ideas, notes,
sources — stays private, and nothing from the vault goes into an agent prompt. Board items and
the `docs/` of each project are not on the map yet; that is next on the
[roadmap](../roadmap.md).

## Make something show up

The map shows what the files say. To add an edge, add the data:

```yaml
---
title: Spotify
type: playbook
topics: [spotify, auth]
projects: [vizzy, lyrics-helper, bitster]
summary: One sentence the detail panel shows.
---
```

A page without `type` in its frontmatter is not drawn. A fact that only stands in a table or
in prose is not an edge.
