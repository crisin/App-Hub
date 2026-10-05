---
title: Writing docs — how the wiki grows
section: How-to
order: 8
summary: One folder, two readers — the frontmatter the help panel needs, link rules, sections, the docs check, and when a change needs a page.
---

# Writing docs: how the wiki grows

`docs/` is read by two readers: you in the repo (or on GitHub), and the **help panel** in the
app, which fetches `/api/docs` and renders exactly these files. There is no build step and no
second copy. A docs commit is live in the panel after a reload.

## When a change needs a page

- **New or changed user-facing behavior**: update the page that explains it, in the same
  commit. The matching page is the one whose frontmatter `routes` lists the UI page.
- **New endpoint**: a row in [reference/api.md](../reference/api.md).
- **New CLI command**: a line in [reference/cli.md](../reference/cli.md).
- **New variable or file location**: [reference/config.md](../reference/config.md).
- **New recurring pitfall**: an entry in [troubleshooting](../reference/troubleshooting.md).
- **A decision with a why**: the concept page it belongs to, or
  [architecture](../concepts/architecture.md) under "Decisions and why".
- **A direction change**: [roadmap](../roadmap.md). The board stays the live plan.
- **An opinion, a reflection, a story**: an essay (below).

Coding agents working the hub's board are told to follow `CLAUDE.md`, which carries this rule,
so expect runs on the `hub` project to touch `docs/` too. Review those edits like code.

## One file, one topic

```markdown
---
title: Work with the board          # shown in the panel's contents
section: How-to                      # Start | How-to | Concepts | Reference | Essays | Roadmap | History
order: 3                             # position within the section
summary: From idea to merged code — lanes, the Claude lane, labels, dependencies.
routes: ['/board', '/project']       # optional: UI paths this page explains
---

# Work with the board

Body in GitHub-flavored markdown.
```

- `title`, `section`, `order`, `summary` are required for everything outside `history/`. A
  file without them still renders, but sorts into **Start** at order 99 and has no summary.
- `routes` makes the panel open this page when the user presses `?` on that UI path. The
  longest matching prefix wins; `/` only matches the dashboard. One page per route is enough;
  several routes per page are fine.
- Sections are fixed in `DOC_SECTIONS` in `packages/hub/src/lib/server/docs.ts`. Unknown
  sections render after the known ones. Add a section there if you need one.
- The folder names mirror the sections (`start/`, `howto/`, `concepts/`, `reference/`,
  `essays/`, `history/`); the panel sorts by frontmatter, not by folder.

## Links and anchors

- Link other pages with **relative paths to the `.md` file**: `../concepts/runner.md`,
  `reviews.md`. The panel follows those in place and keeps a back stack. GitHub resolves the
  same links.
- Anchors are GitHub-style ids from the heading text, lower-cased, punctuation stripped, spaces
  to hyphens: `runner.md#finding-the-agent-clis`. The panel generates the same ids.
- External links (`https://…`) open in a new tab.
- Images are not served by the docs API. Use text, tables and ASCII diagrams; rendered diagrams
  in the panel are on the roadmap.

## Style

- Lead with what the reader wants to do or know. One idea per paragraph.
- Tables for parallel facts, numbered lists for sequences, code blocks for anything typed.
- Name files and commands exactly; the reader will copy them.
- Dates absolute (`2026-10-02`), never "yesterday".
- Keep history out of current pages. Superseded plans go to `history/` with a status line in
  its README, and are not maintained.

## The docs check

```bash
npm run docs:check
```

`scripts/docs-check.mjs` walks `docs/`, requires the frontmatter fields above (outside
`history/`), checks that `section` is known and `routes` is a list, and resolves every relative
link and anchor to an existing file and heading. It exits non-zero on problems, so it can sit
next to the typecheck in a commit's `Verified:` line.

## Essays

`docs/essays/` holds pieces that are opinion rather than documentation: what someone thinks
about the project, where it might go, what it felt like to build a part of it. They carry the
same frontmatter plus `author` and `date`, they are dated and not rewritten later (write a new
one instead), and they live in the **Essays** section of the panel. The first one is
[From the inside](../essays/from-the-inside.md), written by the AI that writes most of the
hub's code.
