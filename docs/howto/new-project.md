---
title: Create a project from a template
section: How-to
order: 1
summary: Scaffold a new repo under projects/ — ready for board tasks from the first minute.
routes: ['/templates']
---

# Create a project from a template

**Dashboard:** `+ New Project` → name → template → Create.
**CLI:** `npm run cli -- new "My App" --template tauri-app` (without `--template` it lists them).

## What happens

1. The template folder is copied to `projects/<slug>/` (minus `node_modules`, `target`,
   `dist`, `.git`).
2. `__APP_NAME__` / `__APP_SLUG__` placeholders in text files are filled in (package names,
   window titles, bundle ids).
3. The hub writes `.apphub.md` (metadata), appends its section to the template's
   `CLAUDE.md` (or writes one), adds `.gitattributes` (LF everywhere) and a fallback
   `.gitignore`, creates `docs/`.
4. `git init`, then the template's `postCreate` command(s) run — e.g. `node setup.mjs`.
   A failing hook does **not** abort: you get a warning and keep the scaffold.
5. An initial commit `chore: scaffold <name> from the <template> template` — the repo has a
   `HEAD`, so the runner can branch worktrees from it right away.

## Templates

| Template | Stack | postCreate |
| --- | --- | --- |
| `tauri-app` | Tauri 2 shell, Svelte 5 UI, Cargo workspace with Tauri-free `crates/` | `node setup.mjs` (toolchain check, npm install, icons, cargo fetch) |
| `sveltekit-web` | SvelteKit + TypeScript | `npm install` |
| `nextjs-fullstack` | Next.js App Router | `npm install` |
| `expo-app` | Expo + React Native | `npm install` |
| `kmp-app` | Kotlin Multiplatform + Compose | `./setup.sh` (macOS only — warns elsewhere) |

## After creating

- Fill in `context:` in `.apphub.md` — a few lines on layers, modules and commands. It goes
  into **every** coding-agent prompt for this project.
- Commit, then put work on the board: [board workflow](board-workflow.md).

## Adding a template

A folder in `templates/` with a `template.json`:

```json
{
  "name": "My Stack",
  "description": "One line for the picker",
  "tags": ["web"],
  "postCreate": ["npm install", "node setup.mjs"]
}
```

Keep `postCreate` cross-platform — Node scripts, not bash or PowerShell. Optional `source`
points at a git URL instead of the local folder (cloned with degit).
