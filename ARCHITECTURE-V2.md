# App Hub v2 — Architecture: Self-Sustaining Build System

> **Status:** Draft v2 — Revised 2026-04-09
> **Author:** Architecture review by Claude (Opus), original by crisin
>
> This document defines the architecture for evolving App Hub from a dev-server-with-CLI-spawning into a persistent, self-building local service. The core thesis: App Hub should be able to receive tasks on its board and autonomously apply code changes to any project in its workspace — including its own codebase.

---

## Design Principles

Before diving into phases, these principles govern all decisions:

1. **Subscription-first, not API-first.** The user has a Claude subscription (Claude Code CLI). The Anthropic API is a future optimization, not a prerequisite. Phase 2 is designed so the CLI-based runner remains a first-class path — not a legacy shim.

2. **Fail safe, not fail silent.** Every automated action must be reversible. Worktree isolation is non-negotiable — the fallback-to-direct-write pattern in the current runner is a bug, not a feature.

3. **Observability over trust.** Every token spent, every file touched, every command run must be auditable from the dashboard. The system should make it easy to understand what happened and why.

4. **Progressive autonomy.** The system starts requiring human approval for everything. Autonomy is earned per-scope, per-project, and can be revoked at any time.

---

## Current State Assessment

### What works well
- Single-process claude-runner with CLI spawning is functional and battle-tested
- Git worktree isolation per task — solid foundation
- SSE real-time updates to dashboard — good UX
- 6-stage kanban (idea → plan → build → claude → review → done) — clean state machine
- Dependency blocking — prevents out-of-order execution
- Auto-queue — picks up next task after completion
- Stale assignment cleanup on restart — crash recovery

### What needs fixing before v2
These are not v2 features — they're defects in v1 that would compound under increased automation:

| Issue | Severity | Fix |
|-------|----------|-----|
| Worktree fallback to direct-write contaminates main branch | **Critical** | Remove fallback. If worktree fails, error out and leave item in claude stage for retry |
| No checkpoint/resume — crash mid-task loses all progress | High | Persist conversation state to DB so tasks can resume |
| `currentProcess` singleton prevents any future concurrency | Medium | Already addressed in Phase 2 design |
| Output buffer capped at 2000 lines, older output lost forever | Low | Stream output to disk (per-task log file), keep last N in memory for SSE |

---

## Phase 1: Production Service

**Goal:** App Hub starts on boot and stays running without a terminal tab. The foundation for everything else.

### 1.1 Node Adapter Build

Switch from `adapter-auto` to `adapter-node`. This is a config change, not a rewrite.

**Files:**
- `packages/hub/svelte.config.js` — swap adapter import
- `packages/hub/package.json` — add `"start": "node build"`
- Root `package.json` — add `"start"` and `"build"` scripts

```js
// packages/hub/svelte.config.js
import adapter from '@sveltejs/adapter-node';
export default {
  compilerOptions: {
    runes: ({ filename }) => !filename.includes('node_modules') || undefined
  },
  kit: {
    adapter: adapter({ out: 'build', precompress: false, envPrefix: 'APPHUB_' })
  }
};
```

**Important:** The `compilerOptions.runes` function must be preserved — it enables Svelte 5 runes globally.

### 1.2 Environment Configuration

Extend `apphub.config.ts` to read from `process.env` with fallbacks to current hardcoded values. Do NOT create a separate env-loading layer — SvelteKit's node adapter already handles `APPHUB_*` prefixed env vars.

```env
# .env.example
APPHUB_PORT=5174
APPHUB_HOST=localhost
APPHUB_DB_PATH=./data/apphub.db
APPHUB_PROJECTS_DIR=../../projects
APPHUB_TEMPLATES_DIR=../../templates
APPHUB_LOG_DIR=../../logs
APPHUB_SELF_MODIFY=false
```

No API key env vars yet — that's Phase 2's concern.

### 1.3 Health Endpoint

`GET /api/health` — returns uptime, DB connection status, runner state, version. Used by CLI and launchd health checks.

```typescript
export const GET: RequestHandler = async () => {
  return ok({
    status: 'healthy',
    uptime: process.uptime(),
    db: db ? 'connected' : 'disconnected',
    runner: getRunnerStatus().state,
    version: pkg.version,
    pid: process.pid
  });
};
```

### 1.4 macOS Launch Agent

`scripts/install-service.sh`:
1. Runs `npm run build` (shared → hub)
2. Detects node binary path via `which node`
3. Templates a launchd plist with resolved absolute paths
4. Installs to `~/Library/LaunchAgents/com.apphub.server.plist`
5. Loads with `launchctl bootstrap gui/$(id -u)`

Key plist properties:
- `RunAtLoad: true` — start on login
- `KeepAlive: true` — restart on crash
- `StandardOutPath` / `StandardErrorPath` → `${APPHUB_ROOT}/logs/`
- `ThrottleInterval: 10` — don't restart-loop faster than 10s

Companion `scripts/uninstall-service.sh` for cleanup.

### 1.5 Persistent Output Logging

Before adding concurrency, fix the output loss problem. Each runner task should write its full output to disk:

```
logs/
├── hub.log                          ← server stdout
├── hub-error.log                    ← server stderr
└── runs/
    ├── item-abc123_2026-04-09T10-30.log
    └── item-def456_2026-04-09T11-15.log
```

The in-memory buffer stays for SSE (last 2000 lines), but the log file is the complete record. Store the log path in `claude_notes` or a new `run_logs` table so the dashboard can serve it.

### Phase 1 Deliverables
- Hub runs as `node build` (not `vite dev`)
- Starts on boot, restarts on crash
- Environment-based configuration with sensible defaults
- Health check endpoint
- CLI gives actionable error when hub is unreachable
- Full task output persisted to disk

### Phase 1 Risks
- **Build output compatibility:** Verify that dynamic imports in `db.ts` (better-sqlite3 native module) work from the built bundle. May need `external` config in vite.
- **Path resolution:** The current `PROJECT_ROOT = path.resolve(process.cwd(), '..', '..')` depends on CWD being `packages/hub`. When run from launchd, CWD is set via `WorkingDirectory` — must match.

---

## Phase 2: Runner Evolution

**Goal:** Support concurrent tasks, direct API integration (optional), and a proper task execution lifecycle. This phase has two independent tracks that can be implemented in any order.

### Track A: Concurrency (CLI-based)

The current runner is a singleton. This track adds a task queue that can run multiple Claude CLI instances in parallel, each in its own worktree.

#### 2A.1 Task Queue

Replace the `currentProcess` singleton with a managed queue:

```typescript
// packages/hub/src/lib/server/task-queue.ts

interface ActiveTask {
  issueId: string;
  process: ChildProcess;
  abortController: AbortController;
  worktreePath: string;
  startedAt: Date;
  logFile: string;
}

const MAX_CONCURRENT = Number(process.env.APPHUB_MAX_CONCURRENT) || 2;
const activeTasks = new Map<string, ActiveTask>();
const pendingQueue: string[] = [];
```

Key behaviors:
- `enqueue(issueId)` — start immediately if under capacity, else queue
- `cancel(issueId)` — kill process, clean up worktree if no commits
- `getStatus()` — return active tasks, pending queue, capacity
- On task completion, auto-dequeue next pending item
- Each task gets its own: worktree, output buffer, SSE channel, log file

**SSE changes:** Events now include `issueId` in every payload (already the case), so the dashboard can multiplex. Add an `event: queue` event type for queue state changes.

#### 2A.2 Remove Direct-Write Fallback

The current worktree creation has a silent fallback to direct repo writes. This is dangerous with concurrency — two tasks could write to the same files simultaneously.

**Change:** If `createWorktree()` fails, the task errors out. The item stays in the `claude` stage for retry. Add a note explaining the failure.

```typescript
if (!isGitRepo(repoRoot)) {
  throw new RunnerError(`${scope} is not a git repository — cannot create isolated worktree`);
}
branchName = branchNameFromIssue(issue.id, issue.title);
worktreePath = createWorktree(repoRoot, branchName); // throws on failure, no fallback
```

#### 2A.3 Task Lifecycle States

Extend the item lifecycle with finer-grained states for the runner:

```
claude (unclaimed) → claimed → running → [completed | failed | cancelled]
                                              ↓           ↓
                                           review        claude (retry)
```

Add a `runner_state` column to items (or a separate `task_runs` table) to track:
- `claimed_at`, `started_at`, `finished_at`
- `attempt_count` (for retry tracking)
- `log_path` (pointer to disk log)
- `exit_code`

This replaces the ephemeral `RunHistoryEntry` array with persistent data.

### Track B: Direct Anthropic API (Optional)

This track replaces Claude CLI spawning with direct Anthropic SDK calls. It's optional because the CLI-based runner is fully functional — this is an optimization for:
- Eliminating the CLI binary dependency
- Getting structured tool results instead of parsing stream-json
- Token usage tracking
- Fine-grained model selection

**Important architectural decision:** Track B is NOT required for self-modification (Phase 3). Phase 3 works with the CLI runner. Track B is about operational efficiency, not capability.

#### 2B.1 Anthropic SDK Integration

```bash
npm install @anthropic-ai/sdk --workspace=@apphub/hub
```

Thin wrapper at `packages/hub/src/lib/server/anthropic.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error(
      'ANTHROPIC_API_KEY not set. Set it in .env or use APPHUB_RUNNER_MODE=cli'
    );
    client = new Anthropic({ apiKey });
  }
  return client;
}
```

#### 2B.2 Tool Execution Layer

The Claude CLI has built-in tools (Read, Write, Edit, Bash, Grep, Glob). With direct API calls, the hub must execute these itself.

```
packages/hub/src/lib/server/tools/
├── index.ts          — registry, dispatch, path validation
├── definitions.ts    — JSON schemas for Anthropic API
├── read.ts           — fs.readFile with path scoping
├── write.ts          — fs.writeFile with path scoping
├── edit.ts           — string replacement (match Claude Code's Edit semantics)
├── bash.ts           — child_process.exec with sandbox constraints
├── grep.ts           — ripgrep subprocess wrapper
└── glob.ts           — fast-glob wrapper
```

**Security model for tool execution:**

```typescript
interface ToolContext {
  workingDirectory: string;  // absolute path to worktree
  issueId: string;           // for audit trail
  abortSignal: AbortSignal;  // for cancellation
  allowedPaths: string[];    // directories the tool may access (worktree + node_modules)
  deniedPaths: string[];     // never allow (~/.ssh, ~/.env, /etc)
}

function validatePath(filePath: string, ctx: ToolContext): string {
  const resolved = path.resolve(ctx.workingDirectory, filePath);
  
  // Must be within an allowed path
  const allowed = ctx.allowedPaths.some(p => resolved.startsWith(p));
  if (!allowed) throw new ToolError(`Path outside allowed scope: ${filePath}`);
  
  // Must not be in a denied path
  const denied = ctx.deniedPaths.some(p => resolved.startsWith(p));
  if (denied) throw new ToolError(`Path in restricted area: ${filePath}`);
  
  return resolved;
}
```

**Bash sandbox constraints:**
- CWD locked to worktree
- PATH restricted to `/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin`
- Timeout: 120s per command
- Blocked commands: `rm -rf /`, `sudo`, `ssh`, `curl` (except localhost), `wget`
- Environment: stripped of sensitive vars (API keys, tokens)

#### 2B.3 Conversation Loop

Multi-turn conversation with streaming and tool dispatch:

```typescript
async function runAPIConversation(issue: Item, ctx: RunContext): Promise<void> {
  const client = getClient();
  const messages: MessageParam[] = [];
  
  messages.push({ role: 'user', content: buildTaskPrompt(issue, ctx) });
  
  let turnCount = 0;
  const MAX_TURNS = 80; // safety limit

  while (turnCount < MAX_TURNS) {
    turnCount++;
    
    const stream = client.messages.stream({
      model: ctx.model || getModel(),
      max_tokens: 16384,
      system: buildSystemPrompt(issue, ctx),
      messages,
      tools: getToolDefinitions()
    });

    // Stream text to SSE
    stream.on('text', (text) => {
      emitSSE('output', { type: 'text', content: text, issueId: issue.id });
    });

    const response = await stream.finalMessage();
    messages.push({ role: 'assistant', content: response.content });
    
    // Track token usage
    trackUsage(issue.id, response.usage);

    if (response.stop_reason !== 'tool_use') break;

    // Execute tools
    const toolResults = await executeToolBatch(response.content, ctx);
    messages.push({ role: 'user', content: toolResults });
  }
}
```

#### 2B.4 Token Usage & Cost Tracking

New DB table (not columns on items — a task may have multiple runs):

```sql
CREATE TABLE api_usage (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cache_read_tokens INTEGER DEFAULT 0,
  cache_write_tokens INTEGER DEFAULT 0,
  cost_cents INTEGER NOT NULL,  -- calculated at write time
  created TEXT NOT NULL,
  FOREIGN KEY (issue_id) REFERENCES items(id)
);
```

Dashboard views:
- Cost per task (sum of all runs)
- Cost per project (sum of all tasks)
- Running total with daily/weekly breakdown
- Cost per model breakdown

#### 2B.5 Runner Mode Toggle

A setting (`APPHUB_RUNNER_MODE=cli|api`) toggles which backend processes items:

```typescript
export function createRunner(mode: RunnerMode): TaskRunner {
  switch (mode) {
    case 'cli': return new CLIRunner();   // current spawn-based approach
    case 'api': return new APIRunner();   // direct Anthropic SDK
    default: return new CLIRunner();      // safe default
  }
}
```

Both runners implement the same interface:
```typescript
interface TaskRunner {
  start(issue: Item, context: RunContext): Promise<void>;
  cancel(issueId: string): boolean;
  getStatus(): RunnerStatus;
}
```

The CLI runner remains the default. The API runner is opt-in.

#### 2B.6 Model Selection

Different tasks benefit from different models. Add a `model` field to items (optional):

| Scope | Default Model | Rationale |
|-------|--------------|-----------|
| Routine tasks (docs, style, small fixes) | `claude-sonnet-4-20250514` | Fast, cheap |
| Feature implementation | `claude-sonnet-4-20250514` | Good balance |
| Complex refactors, architecture | `claude-opus-4-6` | Best reasoning |
| Self-modification (Phase 3) | `claude-opus-4-6` | Highest stakes |

Model can be set per-item via the dashboard or defaulted per-project.

### Phase 2 Deliverables
- **Track A:** Concurrent task execution (default: 2), proper task lifecycle, no direct-write fallback
- **Track B (optional):** Anthropic SDK integration, tool execution layer, token tracking, model selection
- Both tracks share: persistent task logs, queue status in dashboard, SSE multiplexing

---

## Phase 3: Self-Modification

**Goal:** App Hub can modify its own codebase through the same board workflow it uses for any other project. Safety is the primary design constraint.

### 3.1 Architecture Overview

Self-modification is not a special capability — it's the same runner processing items that happen to target the hub's own codebase. The difference is in the safety constraints applied.

```
┌─────────────────────────────────────────────┐
│                  Dashboard                   │
│  User creates item for project: "apphub"     │
│  User drags item to claude stage             │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│              Task Queue                      │
│  Checks: APPHUB_SELF_MODIFY == true?         │
│  Checks: cooldown elapsed?                   │
│  Checks: max self-tasks in-flight?           │
│  Checks: not recursive (runner-created)?     │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│            Runner (CLI or API)               │
│  Worktree: .worktrees/apphub-self/item-xxx   │
│  Branch: apphub-self/{id}-{slug}             │
│  System prompt includes self-mod rules       │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│          Validation Pipeline                 │
│  1. TypeScript check (tsc --noEmit)          │
│  2. Shared package build                     │
│  3. Hub build                                │
│  4. CLI build                                │
│  5. Smoke test (start on alt port, hit       │
│     /api/health, verify response)            │
└──────────────────┬──────────────────────────┘
                   │
           ┌───────┴───────┐
           │               │
      All pass         Any fail
           │               │
           ▼               ▼
┌─────────────┐  ┌──────────────┐
│   Review    │  │   Review     │
│  (clean)    │  │  (with       │
│             │  │   errors)    │
└──────┬──────┘  └──────────────┘
       │
       ▼ (human merges)
┌─────────────────────────────────────────────┐
│          Post-Merge                          │
│  Option A: Manual restart                    │
│  Option B: Graceful restart (process.exit,   │
│            launchd restarts with new code)   │
└─────────────────────────────────────────────┘
```

### 3.2 Self-Registration

On first startup, the hub registers itself as a project in the database:

```typescript
export function ensureSelfRegistered(): void {
  const db = getDb();
  const existing = db.prepare('SELECT 1 FROM projects WHERE slug = ?').get('apphub');
  if (existing) return;

  db.prepare(`
    INSERT INTO projects (slug, name, description, status, path, created, updated)
    VALUES ('apphub', 'App Hub', 'The App Hub system itself', 'active', ?, ?, ?)
  `).run(PROJECT_ROOT, new Date().toISOString(), new Date().toISOString());
}
```

This means items with `project_slug = 'apphub'` target the hub's own code.

### 3.3 Safety Model — Three Layers

#### Layer 1: Gate Checks (prevent bad tasks from starting)

```typescript
function canProcessSelfItem(issue: Item): { allowed: boolean; reason?: string } {
  // Gate 1: Feature flag
  if (process.env.APPHUB_SELF_MODIFY !== 'true') {
    return { allowed: false, reason: 'APPHUB_SELF_MODIFY is not enabled' };
  }
  
  // Gate 2: Only human-created items (prevent recursive creation)
  if (issue.assigned_to === 'claude-runner' || issue.created_by === 'system') {
    return { allowed: false, reason: 'Self-modification items must be human-created' };
  }
  
  // Gate 3: Cooldown (5 min between self-modification runs)
  const lastRun = getLastSelfModificationTime();
  if (lastRun && Date.now() - lastRun < 5 * 60 * 1000) {
    return { allowed: false, reason: 'Cooldown period active' };
  }
  
  // Gate 4: Max in-flight (only 1 self-modification at a time)
  const activeCount = countActiveSelfModTasks();
  if (activeCount >= 1) {
    return { allowed: false, reason: 'Another self-modification task is running' };
  }
  
  return { allowed: true };
}
```

#### Layer 2: Isolation (prevent bad code from affecting the running system)

All self-modification happens in a git worktree on branches prefixed with `apphub-self/`. The running hub process is never modified. The worktree gets its own copy of the entire monorepo.

Additional constraints for self-modification tasks:
- **Bash tool restrictions tightened:** Cannot run `npm run dev`, `npm start`, `launchctl`, or any process management commands
- **Cannot modify `.env` files or `apphub.config.ts`** — configuration changes require human review through a different channel
- **Cannot modify `db.ts` migration logic** — database schema changes are flagged as critical scope

#### Layer 3: Validation (verify changes don't break the build)

```typescript
interface ValidationPipeline {
  checks: ValidationCheck[];
  allPassed: boolean;
  results: ValidationResult[];
}

interface ValidationCheck {
  name: string;
  command: string;
  cwd: string;          // worktree path
  timeout: number;       // ms
  required: boolean;     // if false, failure is a warning
}

const VALIDATION_CHECKS: ValidationCheck[] = [
  {
    name: 'typecheck',
    command: 'npx tsc --noEmit',
    cwd: '{worktree}',
    timeout: 60_000,
    required: true
  },
  {
    name: 'shared-build',
    command: 'npm run build --workspace=@apphub/shared',
    cwd: '{worktree}',
    timeout: 30_000,
    required: true
  },
  {
    name: 'hub-build',
    command: 'npm run build --workspace=@apphub/hub',
    cwd: '{worktree}',
    timeout: 60_000,
    required: true
  },
  {
    name: 'cli-build',
    command: 'npm run build --workspace=@apphub/cli',
    cwd: '{worktree}',
    timeout: 30_000,
    required: false  // warning only
  },
  {
    name: 'smoke-test',
    command: 'node build & PID=$!; sleep 4; curl -sf http://localhost:5175/api/health; EXIT=$?; kill $PID 2>/dev/null; exit $EXIT',
    cwd: '{worktree}/packages/hub',
    timeout: 30_000,
    required: true
  }
];
```

Validation results are stored in the `branch_reviews` table and displayed in the review UI.

#### Layer 4: Human Review Gate (prevent bad code from reaching production)

Self-modification branches are **never auto-merged**. They always land in the `review` stage. The dashboard shows:
- Full diff view
- Validation results (pass/fail per check)
- Build logs
- Option to merge, discard, or send back to Claude with feedback

**Future consideration:** Low-risk auto-merge for changes that pass all validation checks AND are scoped to `docs` or `style`. This should be a dashboard setting, off by default, and require the user to explicitly enable it per-project.

### 3.4 Change Scoping

Tag self-modification items with a risk scope. The runner detects scope from file paths modified:

| Scope | Files | Validation Level |
|-------|-------|-----------------|
| `docs` | `*.md`, `CLAUDE.md`, comments | Typecheck only |
| `style` | `*.css`, `app.css` | Build check |
| `ui` | `routes/**/*.svelte`, component files | Full build |
| `api` | `routes/api/**`, `lib/server/*.ts` | Full build + smoke test |
| `schema` | `db.ts`, migrations, `types.ts` | Full build + smoke test + **migration dry-run** |
| `core` | `claude-runner.ts`, `task-queue.ts`, `self-*.ts` | Full build + smoke test + **always requires review** |

Scope is detected automatically from the git diff, but can be overridden by the user on the item.

### 3.5 Self-Modification System Prompt

When the runner processes a self-modification item, the system prompt includes additional rules:

```
SELF-MODIFICATION RULES:
- You are modifying App Hub's own codebase. Your changes will be reviewed before deployment.
- Do NOT modify database migration logic (db.ts runMigrations) without explicit instructions.
- Do NOT modify environment or configuration files (.env, apphub.config.ts).
- Do NOT modify the self-modification safety logic (this is recursive and dangerous).
- Do NOT create new board items or trigger the runner — that creates infinite loops.
- Always run `npx tsc --noEmit` before committing to catch type errors early.
- Prefer small, focused changes. One concern per commit.
- If you discover you need a database migration, document it in the PR description
  and stop — let the human handle schema changes.
```

### 3.6 Graceful Restart

After a self-modification branch is merged (by the human), the hub can restart to pick up changes:

```typescript
export async function requestRestart(reason: string): Promise<void> {
  logger.info('hub', 'restart_requested', reason);
  
  // 1. Rebuild from merged main
  const buildResult = await exec('npm run build', { cwd: PROJECT_ROOT });
  if (buildResult.exitCode !== 0) {
    logger.error('hub', 'restart_build_failed', buildResult.stderr);
    // Don't restart if build fails — the current version keeps running
    return;
  }
  
  // 2. Drain connections
  emitSSE('system', { type: 'restart', reason, eta: 5 });
  await new Promise(r => setTimeout(r, 3000)); // let SSE message reach clients
  
  // 3. Close DB gracefully
  db.close();
  
  // 4. Exit — launchd KeepAlive restarts with new build
  process.exit(0);
}
```

**Safety net:** If the new build crashes on startup, launchd's `ThrottleInterval` prevents restart-looping. The user can `git revert` and manually restart.

### 3.7 Preventing Infinite Loops — Defense in Depth

This is the most critical safety concern. Multiple independent safeguards:

1. **Human-only creation:** Self-modification items can only be created through the dashboard or CLI by a human. The runner cannot create items for the `apphub` project.

2. **Feature flag:** `APPHUB_SELF_MODIFY=true` must be explicitly set. Default is `false`.

3. **Cooldown:** Minimum 5 minutes between self-modification runs.

4. **Max in-flight:** Only 1 self-modification task at a time (even if concurrency is set higher).

5. **No auto-queue for self-mod:** The auto-trigger after task completion skips `apphub` project items. They must be manually started or wait for the next poll cycle.

6. **Depth limit:** The runner refuses to process items that reference self-modification code paths (detected by checking if changed files include `claude-runner.ts`, `task-queue.ts`, or files in `tools/`).

### Phase 3 Deliverables
- Hub registered as project `apphub` in its own board
- Self-modification gated behind feature flag + gate checks
- Git worktree isolation on `apphub-self/*` branches
- Automated validation pipeline (typecheck → build → smoke test)
- Human review gate (no auto-merge in v1)
- Automatic scope detection from git diff
- Graceful restart after merge
- 6-layer infinite loop prevention

---

## Phase 4: Autonomous Operations (Future)

> This phase is aspirational. Document it for direction, don't implement until Phases 1-3 are stable.

### 4.1 Scheduled Tasks

The hub could run recurring tasks on a schedule:
- **Dependency updates:** Weekly check for outdated npm packages, create items for upgrades
- **Code quality:** Periodic lint/typecheck sweeps, create items for violations
- **Template sync:** When templates change, propagate to spawned projects

### 4.2 Multi-Agent Coordination

With concurrent execution (Phase 2A), tasks could be decomposed:
- A "planning" agent breaks a large feature into subtasks
- Multiple "implementation" agents work on independent subtasks in parallel
- A "review" agent checks consistency across the subtasks before merging

This requires extending the item model with parent-child relationships (already partially exists via `parent_id`).

### 4.3 Learning from Reviews

When a human modifies Claude's branch during review (editing commits, adding fixes), that feedback could be captured and used to improve future prompts for similar tasks. Store review diffs as training signal.

### 4.4 Cross-Project Intelligence

When the hub has worked on multiple projects, it accumulates knowledge about patterns, common issues, and solutions. This could feed into:
- Better template generation
- Smarter task estimation
- Pattern-based code suggestions

---

## Implementation Order

### Phase 1 — Foundation (1-2 sessions)

| Step | Task | Depends On |
|------|------|-----------|
| 1.1 | Switch to adapter-node, verify production build | — |
| 1.2 | Add env config to apphub.config.ts | — |
| 1.3 | Add /api/health endpoint | — |
| 1.4 | Create install/uninstall service scripts | 1.1 |
| 1.5 | Add persistent output logging (per-task log files) | — |
| 1.6 | Update CLI error messages for hub-not-running | 1.3 |
| 1.7 | End-to-end test: build → install → auto-start → health check | 1.1-1.4 |

Steps 1.1-1.3, 1.5 can be parallelized.

### Phase 2A — Concurrency (2-3 sessions)

| Step | Task | Depends On |
|------|------|-----------|
| 2A.1 | Remove direct-write fallback, error on worktree failure | — |
| 2A.2 | Add task lifecycle states (DB table or columns) | — |
| 2A.3 | Build task queue with configurable concurrency | 2A.1, 2A.2 |
| 2A.4 | Update SSE events for multiplexed task output | 2A.3 |
| 2A.5 | Update dashboard to show multiple active tasks | 2A.4 |
| 2A.6 | Test: run 2 tasks concurrently, verify isolation | 2A.3-2A.5 |

### Phase 2B — API Runner (3-4 sessions, optional)

| Step | Task | Depends On |
|------|------|-----------|
| 2B.1 | Install Anthropic SDK, create client wrapper | — |
| 2B.2 | Build tool execution layer (read, write, bash) | — |
| 2B.3 | Add remaining tools (edit, grep, glob) | 2B.2 |
| 2B.4 | Build conversation loop with streaming | 2B.1, 2B.3 |
| 2B.5 | Add RUNNER_MODE toggle, TaskRunner interface | 2B.4 |
| 2B.6 | Add token tracking table and dashboard display | 2B.4 |
| 2B.7 | Add model selection per-item | 2B.6 |
| 2B.8 | End-to-end test: API runner processes item | 2B.1-2B.5 |

### Phase 3 — Self-Modification (2-3 sessions)

| Step | Task | Depends On |
|------|------|-----------|
| 3.1 | Add self-registration on startup | Phase 1 |
| 3.2 | Add gate checks (feature flag, cooldown, max-in-flight) | 3.1 |
| 3.3 | Build validation pipeline | 3.1 |
| 3.4 | Add scope detection from git diff | 3.3 |
| 3.5 | Add self-modification system prompt rules | 3.2 |
| 3.6 | Wire up graceful restart after merge | Phase 1.4 |
| 3.7 | Test: create self-mod item → validate → review → merge → restart | 3.1-3.6 |

---

## Resolved Design Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| API key storage | Environment variable only | Simplest, most secure. Never in SQLite or dashboard. |
| Runner default | CLI-based (`RUNNER_MODE=cli`) | Works today, no API key needed, uses existing subscription |
| Self-mod auto-merge | No, always human review | Safety first. Can revisit after months of stable operation |
| DB backup before self-mod | Yes, `VACUUM INTO` before each self-mod run | Cheap insurance, SQLite makes it trivial |
| Extended thinking | Enable for `core` and `schema` scope self-mods | Worth the cost for highest-stakes changes |
| Cost limits | Per-item soft cap (warn at $2, hard stop at $10) | Prevents runaway tasks. Configurable via settings. |
| Template propagation | No auto-propagation in v2 | Too dangerous. Document as Phase 4 aspiration. |

## Open Questions (Remaining)

1. **Conversation persistence for resume:** If the runner crashes mid-task, should we persist the conversation history to disk so it can resume? This is complex (tool results may be stale) but would prevent losing progress on long tasks.

2. **Multi-project worktrees:** When a task spans multiple packages in the monorepo (e.g., shared types + hub), the worktree is already the full monorepo. But what about tasks that need to modify both a template and a spawned project? This needs a clear policy.

3. **Review UI for self-modification:** The current review UI shows diffs and commits. For self-modification, it should also show validation results, build logs, and a "test locally" button (starts the modified build on an alt port). How much of this is v2 scope vs. future?

4. **Rate limiting and backoff:** The Anthropic API has rate limits. Should the task queue implement exponential backoff, or just fail fast and let the user retry? With a Claude subscription (CLI mode), this isn't an issue — but with direct API mode, it matters.
