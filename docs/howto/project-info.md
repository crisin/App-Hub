---
title: Edit project info and connect a repository
section: How-to
order: 3
summary: Name, description, agent context, status, tags and the GitHub link — where they live and three ways to change them.
routes: ['/project']
---

# Edit project info and connect a repository

A project's info lives in its `.apphub.md` (frontmatter), in the project's own repo. The hub
indexes it; changing it anywhere below writes that file.

| Field | What it is for |
| --- | --- |
| `name`, `description` | shown on the dashboard and the project page |
| `context` | a few lines for coding agents — **added to every runner prompt** of this project |
| `status` | `idea` · `active` · `paused` · `completed` · `archived` |
| `tags` | free labels for filtering |
| `repo` | browsable URL of the repository (GitHub, GitLab, …) |

## Three ways to change it

- **Project page** — click the description, the context or the repository line, edit, Save
  (⌘/Ctrl+Enter in text areas, Enter in the repo field, Esc cancels).
- **CLI** —
  `npm run cli -- status <slug> --set active`,
  `npm run cli -- status <slug> --repo https://github.com/owner/repo`;
  `npm run cli -- status <slug>` shows everything.
- **API** — `PATCH /api/projects/<slug>` with any of the fields above. Other keys (`slug`,
  `path`, …) are rejected with 400.
- Or edit `.apphub.md` by hand, then **Sync**.

Commit the changed `.apphub.md` in the project's repo, like any other file.

## The repository link

You usually don't set `repo` at all: the hub reads the git remote `origin` of the project's
checkout on every sync. Because both machines clone the same remote, both show the same link
without anything machine-specific in the repo.

- An explicit `repo:` in `.apphub.md` wins over the remote (useful for a mirror, or a repo
  without `origin`).
- SSH remotes become https links (`git@github.com:owner/repo.git` →
  `https://github.com/owner/repo`); user names and tokens in a remote URL are always dropped.
- Clearing the field (empty value) goes back to the remote.

### Connect a new GitHub repo

1. Create the repo on GitHub — empty, without README/license, so the first push doesn't
   conflict (web UI, or `gh repo create owner/name --public`).
2. In the project's folder:

   ```bash
   git remote add origin https://github.com/owner/name.git
   git push -u origin main
   ```

3. Press **Sync** on the dashboard (or `npm run cli -- sync`) — the project page now shows the
   link.

The hub never pushes by itself: review-lane merges land in your local base branch, and you
push when you decide to (see [reviews](reviews.md)). Before the first push of a repo that goes
public, scan its history for secrets — once pushed, they are out.

Related: [register an existing repo](register-project.md) ·
[work with the board](board-workflow.md) · [two machines](two-machines.md)
