---
title: Trust model
section: Concepts
order: 5
summary: Who may do what — the loopback binding, the review gate, what agents can touch, and what the hub does not protect against.
---

# Trust model

The hub exists to let software write software on your machine. That is only safe if it is clear
what runs with which rights and where the gates are. This page is the honest version.

## The two rules

1. **Nothing an agent writes reaches a branch unreviewed.** Every coding run happens in its own
   git worktree on its own branch. The runner never pushes, never merges, never checks out the
   base branch. The only way into your branch is the review lane, where you read the diff and
   press Merge. Discard throws the branch away.
2. **The hub is reachable only from the machine it runs on.** `scripts/start.mjs` binds
   `127.0.0.1:5174`. The hub's API has no authentication; the binding is the authentication.

## What runs with what rights

| Actor | Rights | Boundary |
| --- | --- | --- |
| **You** in the UI or CLI | everything | the loopback binding |
| **The hub process** | your user's rights | it is your process |
| **Claude Code** as coder backend | `--allowedTools Read,Grep,Glob,Bash,Edit,Write`, prompted into the worktree | the worktree is a git boundary, **not** a sandbox: Bash is a shell with your user's rights |
| **aider** as coder backend | `--yes-always`, auto-commits | same: it runs as you, in the worktree |
| **Talking agents** (critic, judge, …) | produce text only | they call a model endpoint and return a string |
| **Spawned projects** using dev auth | log in, verify tokens, read their user | `/api/dev/*` only, open CORS |
| **Anyone who can reach port 5174** | everything you can | so nobody else may reach it |

The worktree isolation protects **your branches** from unreviewed changes. It does not protect
your machine from a prompt-injected or confused agent that runs a bad shell command. In
practice Claude Code is careful and the runner's prompt is narrow, but the right mental model
is: a coding run is a contractor with keys to the house who is told to stay in one room. Review
the diff; look at the `Verified:` line; if a run did strange things, the full transcript is in
`logs/runs/`.

## The review gate in detail

- Branch name `claude/<id>-<slug>`, worktree under `<repo>/.worktrees/`, excluded from git via
  `.git/info/exclude` so it never ends up committed.
- Merge is `--no-ff` with a `merge(board): <item>` commit, so the logbook keeps the run as a
  unit; the item goes to **done**.
- A run that failed but committed still goes to **review**, because partial work may be worth
  keeping. A run without commits parks the item in **build** with a note, never back in
  **claude**, so a broken item cannot loop.
- Aider writes its own commit messages with the weak model; read them.

## Secrets

- `ANTHROPIC_API_KEY`, `APPHUB_OPENAI_COMPAT_KEY` and model URLs live in `packages/hub/.env`,
  gitignored. Agents receive the hub's environment when spawned, which is how Claude Code finds
  its own login; keep secrets you do not want agents to see out of that environment.
- Dev auth: passwords are scrypt-hashed, tokens are HS256 JWTs signed with a per-install secret
  stored in the index, API keys are stored as SHA-256 hashes and shown once. The refresh-token
  and user tables are in SQLite only.
- The runner prompt tells Claude Code to post progress notes with `curl` to the hub API.
  Everything an agent posts there is visible on the board; the API accepts it without auth
  because only local processes can reach it.

## What the hub does not do

- No authentication or rate limiting on its own API. Exposing it beyond loopback without a
  proxy that authenticates is exposing a remote shell, see
  [run it permanently](../howto/deploy.md).
- No sandboxing of agents (containers, seccomp, restricted users). If you want that, run the
  hub itself in a container or as a separate OS user, and accept the friction with GUIs,
  signing and GPUs.
- No secret scanning of agent commits. Review catches it; nothing else does.
- Dev auth's CORS is intentionally permissive. It is for the apps you scaffold, during
  development, on your machine.

## Why this is enough for its purpose

This is a one-person tool on the owner's own machines. The gates that matter are the ones
between an agent's output and the code that gets kept: worktree, branch, review, logbook. Those
are strict. The gates that would matter for a multi-user or internet-facing service are absent on
purpose, because adding them would cost more than they protect here. The moment the hub leaves
loopback, that calculation changes, and the deployment page says what to add.
