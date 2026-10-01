---
title: Agents and the debate
section: How-to
order: 5
summary: Run an LLM role on a prompt, or let an idea defend itself in a debate.
routes: ['/agents']
---

# Agents and the debate

An **agent** is a markdown file in `agents/`: frontmatter wires it to a model, the body is
its system prompt. Adding an agent = adding a file.

```markdown
---
name: Critic
description: Attacks ideas hard but fair to expose real weaknesses
provider: ollama            # ollama | openai-compatible | anthropic
model: gpt-oss:20b
temperature: 0.7            # optional
maxTokens: 1500             # optional
---
You are a sharp, experienced critic in a product debate. …
```

| Provider | Talks to | Configure |
| --- | --- | --- |
| `ollama` | local Ollama (OpenAI-compatible endpoint) | `APPHUB_OLLAMA_URL` (default `http://127.0.0.1:11434`) |
| `openai-compatible` | LM Studio, llama.cpp, vLLM, … | `APPHUB_OPENAI_COMPAT_URL`, `APPHUB_OPENAI_COMPAT_KEY` |
| `anthropic` | Claude via the official SDK | `ANTHROPIC_API_KEY` |

Bundled: `critic`, `advocate`, `judge` (the debate roles), `summarizer`, `ui-drafter`.

## Run one agent

- **UI:** Agents page → pick an agent → prompt → Run. It also shows which providers are
  reachable.
- **CLI:** `npm run cli -- agent run summarizer "…text…"`
- **API:** `POST /api/agents/<slug>/run` with `{ "prompt": "…" }`

## Debate an idea

The critic attacks, the advocate defends (one or more rounds), the judge reads the transcript
and delivers a verdict. The verdict is added as a note to the board item; the full transcript
lands in `logs/agents/debate_<timestamp>.md`.

- Create an item with the label **`debate`** (board / `POST /api/board`) — the debate starts
  automatically in the background.
- Or on demand: `npm run cli -- agent critique <item-id> -r 2` /
  `POST /api/board/<id>/critique` with `{ "rounds": 2 }`.

Local models on a CPU-heavy box take minutes per turn — `gpt-oss:20b` (MoE) is the fast
default here; bigger thinking models need more `maxTokens`.

## Coding agents are different

Agents above *talk*. Coding work on board items runs through **coder backends** — full agent
CLIs (Claude Code, aider) spawned in a worktree. See [runner](../concepts/runner.md).
