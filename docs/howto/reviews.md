---
title: Review agent branches
section: How-to
order: 4
summary: Read the diff, merge or discard — nothing an agent writes reaches your branch unseen.
routes: ['/reviews']
---

# Review agent branches

Every coding run ends on its own branch (`claude/<item>-<title>`) in its own worktree
(`<repo>/.worktrees/…`). The **Reviews** page lists pending branches per project; open one to
see the commits, the diff stat and the full diff.

- **Merge** checks out the base branch the run started from, merges with `--no-ff` and a
  logbook merge commit (`merge(board): <item title>` + item id, branch, commit count), removes
  the worktree and branch, and moves the item to **done**.
- **Discard** removes worktree and branch and sends the item back to **idea**.

What to look at:

- **Commit messages** — they should follow the [logbook format](../concepts/logbook.md).
  Claude Code is told to; aider writes its own (weak-model) messages.
- **Scope** — did it touch only what the item asked for?
- **Verification** — the `Verified:` line says what the agent actually ran.

Merging happens in the main checkout: if you have uncommitted changes in files the branch
touches, git refuses and the merge reports the error — commit or stash first.

API: `GET /api/branches`, `GET /api/branches/<branch>`, `POST /api/branches/<branch>/merge`,
`DELETE /api/branches/<branch>` (discard). Branch names are URL-encoded.
