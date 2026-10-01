---
title: CLI
section: Reference
order: 2
summary: The apphub command — a thin client of the hub API (the hub must be running).
---

# CLI

Run it from the hub repo: `npm run cli -- <command>` (build first with `npm run build`, or
use `npm run dev --workspace=@apphub/cli -- <command>` via tsx). It talks to
`APPHUB_URL` (default `http://localhost:5174`).

## Projects

```bash
apphub new "My App" --template tauri-app      # scaffold (no --template: list templates)
apphub register <path> [-n name] [-d desc]    # make an existing repo a project
apphub list [--status active]                 # projects (re-scans disk)
apphub status <slug> [--set active]           # show / set status
apphub sync                                   # re-index projects + board files (after git pull)
```

## Board

```bash
apphub board list                             # all lanes
apphub board add "Title" [-p slug] [-s plan] [--priority high] [--labels a,b] [-d text]
apphub board move <id> <stage>
apphub board delete <id>
apphub board claude list                      # queue of the runner
apphub board claude run                       # trigger the runner now
apphub board claude claim <id>                # claim for an external agent
apphub board claude complete <id>             # mark done
apphub task add "Title" -p <slug> [--priority high]
apphub task list -p <slug>
apphub task done <item-id>
```

## Agents

```bash
apphub agent list                             # agents + provider status
apphub agent run <slug> "prompt …"
apphub agent critique <item-id> [-r 1..3]     # debate on a board item
```
