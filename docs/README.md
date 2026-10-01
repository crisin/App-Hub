---
title: Documentation map
section: Start
order: 0
summary: Where everything is documented — the same files feed the in-app help panel.
---

# App Hub documentation

These files are the single source for two readers: you in the repo, and the **help panel**
in the hub UI (the `?` button, bottom of the sidebar) which renders exactly these files.
Every file starts with frontmatter (`title`, `section`, `order`, `summary`, optional
`routes` = the UI pages it explains), so the panel can open the right article per page.

| Section | Read it when you want to … |
| --- | --- |
| **Start** — [overview](start/overview.md) | understand what the hub is and how the parts fit |
| **How-to** — [new project](howto/new-project.md), [existing repo](howto/register-project.md), [board workflow](howto/board-workflow.md), [reviews](howto/reviews.md), [agents & debate](howto/agents.md), [two machines](howto/two-machines.md) | get something done |
| **Concepts** — [architecture](concepts/architecture.md), [board files](concepts/board-files.md), [runner](concepts/runner.md), [logbook](concepts/logbook.md) | understand why it works the way it does |
| **Reference** — [API](reference/api.md), [CLI](reference/cli.md), [configuration](reference/config.md) | look up an endpoint, command or setting |
| **Roadmap** — [roadmap](roadmap.md) | see where this is going |
| **History** — [history/](history/README.md) | read superseded plans (archived, not maintained) |

Writing docs: keep one topic per file, put the frontmatter on top, link with relative
paths (`../concepts/runner.md`) — the help panel follows those links in place.
