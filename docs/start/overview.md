---
title: What App Hub is
section: Start
order: 1
summary: The idea, the moving parts, and the one rule everything follows.
routes: ['/']
---

# What App Hub is

App Hub takes an app idea to a running project with structure, docs and task tracking in
minutes — and then lets AI coding agents work through that project's board while you review.
It is a personal, local-first developer tool: no cloud, no accounts. It runs on a Windows PC
and a MacBook from the same repo.

## The moving parts

```
          you ──► dashboard / board / CLI
                          │
                          ▼
   ┌──────────── App Hub (SvelteKit server) ────────────┐
   │  scanner ── reads .apphub.md + .apphub/ of repos   │
   │  board   ── items, stages, dependencies, phases    │
   │  runner  ── coding agent per item, in a worktree   │
   │  agents  ── local/remote LLM roles (debate, …)     │
   │  SQLite  ── fast index, rebuilt from the files     │
   └──────────────────────┬─────────────────────────────┘
                          │ reads / writes
        ┌─────────────────┼──────────────────┐
        ▼                 ▼                  ▼
   App-Hub repo      projects/<app>     any registered repo
   (the hub itself)  (scaffolded here)  (lives elsewhere)
```

- **Projects** are git repos marked by a `.apphub.md` file — scaffolded from a template,
  registered from anywhere on disk, or the hub itself (slug `hub`: the hub manages its own
  development).
- **The board** is a six-lane pipeline: `idea → plan → build → claude → review → done`.
  Items in the `claude` lane are picked up by the **runner**, which starts a coding agent
  (Claude Code, or aider with a local model) in an isolated git worktree. Its commits come
  back through the **review lane**, where you merge or discard.
- **Agents** are markdown files in `agents/` — roles like critic, advocate, judge — running on
  Ollama, any OpenAI-compatible server, or Claude. The debate workflow puts an idea through
  critic vs. advocate rounds and a judge's verdict.

## The one rule

**Markdown in the repos is the source of truth; SQLite is only an index.** Project metadata
lives in `.apphub.md`, board items in `.apphub/items/*.md`, agents in `agents/*.md`, docs in
`docs/`. Delete the database and a sync rebuilds it. That is what makes projects portable and
lets two machines share one board through git — see [board files](../concepts/board-files.md).

## Where to go next

- Start something: [create a project](../howto/new-project.md) or
  [register an existing repo](../howto/register-project.md)
- Work through it: [the board workflow](../howto/board-workflow.md)
- Understand the internals: [architecture](../concepts/architecture.md)
