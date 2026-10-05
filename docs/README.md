---
title: Documentation map
section: Start
order: 0
summary: Where everything is documented — the same files feed the in-app help panel.
---

# App Hub documentation

These files are the single source for two readers: you in the repo, and the **help panel**
in the hub UI (the `?` button, bottom of the sidebar, or F1) which renders exactly these files.
Every file starts with frontmatter (`title`, `section`, `order`, `summary`, optional
`routes` = the UI pages it explains), so the panel can open the right article per page.

| Section | Read it when you want to … |
| --- | --- |
| **Start** — [overview](start/overview.md), [quickstart](start/quickstart.md), [feature tour](start/features.md) | understand what the hub is, get it running, see what it can do |
| **How-to** — [development setup](howto/dev-setup.md), [new project](howto/new-project.md), [existing repo](howto/register-project.md), [board workflow](howto/board-workflow.md), [reviews](howto/reviews.md), [agents & debate](howto/agents.md), [two machines](howto/two-machines.md), [run it permanently](howto/deploy.md), [writing docs](howto/write-docs.md) | get something done |
| **Concepts** — [architecture](concepts/architecture.md), [board files](concepts/board-files.md), [runner](concepts/runner.md), [logbook](concepts/logbook.md), [trust model](concepts/trust-model.md) | understand why it works the way it does |
| **Reference** — [API](reference/api.md), [CLI](reference/cli.md), [configuration](reference/config.md), [troubleshooting](reference/troubleshooting.md) | look up an endpoint, command, setting or error |
| **Essays** — [From the inside](essays/from-the-inside.md) | read what someone thinks about the project, not how it works |
| **Roadmap** — [roadmap](roadmap.md) | see where this is going |
| **History** — [history/](history/README.md) | read superseded plans (archived, not maintained) |

The repo's top-level `README.md` is the front door: a quickstart and this map. Everything deeper
lives here.

Writing docs: one topic per file, frontmatter on top, relative links to `.md` files
(`../concepts/runner.md`), `npm run docs:check` before committing. The rules and the reasons:
[writing docs](howto/write-docs.md).
