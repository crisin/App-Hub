---
title: Configuration
section: Reference
order: 3
summary: Environment variables, machine-local files and where things live on disk.
routes: ['/settings']
---

# Configuration

Nothing is required — every value has a default. Put overrides in `packages/hub/.env`
(see `.env.example`) or the environment. Path values may be relative to the hub root.

## Server and paths

| Variable | Default | Meaning |
| --- | --- | --- |
| `APPHUB_PORT` / `APPHUB_HOST` | `5174` / `127.0.0.1` (production) | listen address (`vite dev` uses 5174 on localhost) |
| `APPHUB_ROOT` | auto-detected | hub root, if detection (walk up to `package.json` "apphub") fails |
| `APPHUB_PROJECTS_DIR` | `projects` | where new projects are scaffolded |
| `APPHUB_TEMPLATES_DIR` | `templates` | template folders |
| `APPHUB_AGENTS_DIR` | `agents` | agent definitions |
| `APPHUB_LOG_DIR` | `logs` | run logs, debate transcripts |
| `APPHUB_DATA_DIR` | `packages/hub/data` | SQLite index + attachments |
| `APPHUB_DB_PATH` | `<data>/apphub.db` | the index file itself |
| `APPHUB_PROJECT_PATHS` | — | extra project repos, `;`-separated on Windows, `:` elsewhere |
| `APPHUB_URL` | `http://localhost:5174` | where the CLI finds the hub |

## Models

| Variable | Default | Meaning |
| --- | --- | --- |
| `APPHUB_OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama for `provider: ollama` agents and aider |
| `APPHUB_OPENAI_COMPAT_URL` / `_KEY` | `http://127.0.0.1:1234` | LM Studio / llama.cpp / vLLM |
| `ANTHROPIC_API_KEY` | — | enables `provider: anthropic` |
| `APPHUB_AIDER_MODEL` | `ollama_chat/qwen3-coder:30b` | model for items labeled `aider` |
| `APPHUB_AIDER_WEAK_MODEL` / `_EDITOR_MODEL` | = main model | pin them to models that exist locally |

## Machine-local files (gitignored)

| File | Content |
| --- | --- |
| `apphub.local.json` | `{ "projects": [ "D:/path/to/repo" ] }` — written by `apphub register` |
| `packages/hub/.env` | the variables above |
| `packages/hub/data/` | SQLite index, attachments |
| `logs/` | `runs/<item>_<ts>.log`, `agents/debate_<ts>.md` |

## UI settings

Settings → Interface (theme and appearance) and Settings → Auth (dev users, API keys) are
stored in the local database.

## Running as a service

- **macOS:** `./scripts/install-service.sh` (launchd login item, runs `scripts/start.mjs`),
  `./scripts/uninstall-service.sh`.
- **Windows:** not automated yet — `npm run build` once, then `npm run start` (also
  `scripts/start.mjs`). A Task Scheduler entry is on the [roadmap](../roadmap.md).
