---
title: Board files
section: Concepts
order: 2
summary: The file format of board items and phases, and the sync rules between files and index.
---

# Board files

Each project repo carries its board:

```
<repo>/
├── .apphub.md              project metadata (name, status, tags, context)
└── .apphub/
    ├── items/<item-id>.md  one file per board item
    └── phases.md           the project's phases (milestones)
```

Items of scopes without an own repo (templates, removed projects) live in the hub repo's
`.apphub/items/`.

## Item file

```markdown
---
id: item-48a7a792
title: Fix state_referenced_locally warnings
project: hub
stage: build            # idea | plan | build | claude | review | done
priority: medium        # low | medium | high | critical
type: task              # task | idea | bug | plan | note
labels: [bugfix, ui]    # "aider" and "debate" steer automation
position: 0             # order within the stage
parent: null            # parent item id (sub-tasks)
phase: phase-696c3c16   # phase id from phases.md
blocked_by: []          # item ids that must be done first
relates_to: []          # loose links
created: '2026-08-28T23:41:05.157Z'
updated: '2026-08-29T00:00:57.056Z'
---

The description — plain markdown, as long as it needs to be.

## Notes

<!-- apphub:notes -->
- 2026-08-28T23:41:05.159Z · info · Claimed by claude-runner (priority: medium)
```

Notes (runner progress, debate verdicts, errors) are one line each after the
`<!-- apphub:notes -->` marker; line breaks inside a note are folded into spaces.

Editing by hand is fine — bump `updated` (or the hub may consider its own copy newer), save,
then Sync. Creating a file by hand works too: `id` and `title` are required, everything else
has defaults.

## Sync rules

| Situation | Result |
| --- | --- |
| change in the UI / API | index and file written in the same call |
| file newer than index (or equal) | file → index |
| index newer than file | file rewritten from the index |
| file gone, item had been persisted before | item removed from the index |
| item never persisted (no file yet) | file written — never deleted |
| repo has no `.apphub/items/` yet | whole index exported (first sync = migration) |

Sync runs at server start and on `POST /api/sync` (dashboard **Sync**, `apphub sync`).

## What is not in the files

`assigned_to` (who is running an item right now), branch reviews, the activity log,
attachments and dev users are machine-local runtime state — SQLite only. A crashed run's
claim is reset at the next server start.

## Why per-item files

One file per item keeps git diffs and merge conflicts local to one item, lets coding agents
read (and propose) work items as plain files, and makes the board a graph of explicit edges
(`blocked_by`, `relates_to`, `parent`) that can be rendered and executed — the basis for the
planned node planner on the [roadmap](../roadmap.md).
