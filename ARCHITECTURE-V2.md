# App Hub v2 — Architecture Proposal: Persistent Self-Building Service

This document proposes the architectural changes needed to evolve App Hub from a dev-server-with-CLI-spawning into a persistent local service with direct Anthropic API integration and self-modification capabilities.

The proposal is structured as implementation phases. Each phase is independently valuable — you don't need to complete all of them to benefit. Phase 1 alone gets you off `npm run dev`. Phase 2 removes the Claude CLI dependency. Phase 3 enables the self-building loop.

---

## Current State (What We're Working With)

App Hub runs as a SvelteKit dev server (`npm run dev` on port 5174). The claude-runner spawns Claude CLI as a child process, streams JSON output via stdout, and manages item lifecycle through the SQLite database. Git worktrees isolate each task's changes. SSE pushes real-time updates to the dashboard.

This works, but has friction points: you must manually start the hub, the runner depends on Claude CLI being installed and configured, only one task runs at a time (single `currentProcess`), and the hub can't modify itself without human intervention.

---

## Phase 1: Production Service

**Goal:** App Hub starts on boot and stays running. No terminal tab required.

### 1.1 Switch to Node Adapter

`@sveltejs/adapter-node` is already a dependency. Swap the config and build for production.

**Files to change:**

- `packages/hub/svelte.config.js` — replace `adapter-auto` with `adapter-node`
- Add build output configuration:

```javascript
import adapter from '@sveltejs/adapter-node';

export default {
  kit: {
    adapter: adapter({
      out: 'build',
      precompress: false,
      envPrefix: 'APPHUB_'
    })
  }
};
```

- `packages/hub/package.json` — add a `start` script:

```json
{
  "scripts": {
    "start": "node build",
    "dev": "vite dev",
    "build": "vite build"
  }
}
```

- Root `package.json` — add top-level `start`:

```json
{
  "scripts": {
    "start": "node packages/hub/build",
    "build": "npm run build --workspace=@apphub/shared && npm run build --workspace=@apphub/hub"
  }
}
```

### 1.2 Environment Configuration

Move from hardcoded values to environment variables, falling back to current defaults so nothing breaks in dev.

Create `packages/hub/.env.example`:

```env
# Server
APPHUB_PORT=5174
APPHUB_HOST=localhost
NODE_ENV=production

# Paths (defaults to monorepo-relative)
APPHUB_DB_PATH=./data/apphub.db
APPHUB_PROJECTS_DIR=../../projects
APPHUB_TEMPLATES_DIR=../../templates

# Anthropic API (Phase 2)
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# Self-modification (Phase 3)
APPHUB_SELF_MODIFY=false
APPHUB_SELF_BRANCH_PREFIX=apphub-self/
```

Update `apphub.config.ts` to read from `process.env` with fallbacks to current hardcoded values. SvelteKit's node adapter exposes env vars prefixed with the `envPrefix` value.

### 1.3 macOS Launch Agent (launchd)

Create `scripts/install-service.sh` that generates and loads a launchd plist:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "...">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.apphub.server</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>${APPHUB_ROOT}/packages/hub/build</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${APPHUB_ROOT}/packages/hub</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>APPHUB_PORT</key>
        <string>5174</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${APPHUB_ROOT}/logs/hub.log</string>
    <key>StandardErrorPath</key>
    <string>${APPHUB_ROOT}/logs/hub-error.log</string>
</dict>
</plist>
```

The script should:
1. Run `npm run build` to produce the production bundle
2. Detect the node binary path
3. Template the plist with resolved absolute paths
4. Copy to `~/Library/LaunchAgents/com.apphub.server.plist`
5. Load with `launchctl load`

Add a companion `scripts/uninstall-service.sh` for cleanup.

### 1.4 Health Check & Auto-Restart

Add a `GET /api/health` endpoint that returns uptime, DB status, and runner state. The launchd `KeepAlive` handles restart-on-crash. The health endpoint lets the CLI and dashboard verify the hub is reachable:

```typescript
// packages/hub/src/routes/api/health/+server.ts
export const GET: RequestHandler = async () => {
  return ok({
    status: 'healthy',
    uptime: process.uptime(),
    db: db ? 'connected' : 'disconnected',
    runner: getRunnerStatus(),
    version: pkg.version
  });
};
```

Update the CLI's `hubFetch` to check `/api/health` with a friendly error when the hub is unreachable:

```
Error: App Hub is not running. Start it with:
  launchctl start com.apphub.server
  — or —
  cd ~/App\ Hub && npm run start
```

### Phase 1 Deliverables

- Hub runs as `node build` (not `vite dev`)
- Starts on boot via launchd, restarts on crash
- Environment-based configuration
- Health check endpoint
- CLI gives clear error when hub is down

---

## Phase 2: Direct Anthropic API Integration

**Goal:** Replace Claude CLI subprocess spawning with direct Anthropic SDK calls. No external CLI dependency. Streaming, tool use, and multi-turn conversations happen in-process.

### 2.1 Add Anthropic SDK

```bash
npm install @anthropic-ai/sdk --workspace=@apphub/hub
```

### 2.2 Create API Client Layer

Create `packages/hub/src/lib/server/anthropic.ts` — a thin wrapper around the SDK that handles configuration, streaming, and error mapping:

```typescript
import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
    client = new Anthropic({ apiKey });
  }
  return client;
}

export function getModel(): string {
  return process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
}
```

### 2.3 Implement Tool Execution Layer

The current claude-runner delegates all tool execution to the Claude CLI, which has built-in `Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob` tools. With direct API integration, the hub must execute these tools itself.

Create `packages/hub/src/lib/server/tools/` directory:

```
tools/
├── index.ts          — tool registry, dispatch
├── definitions.ts    — tool JSON schemas for the API
├── read.ts           — file reading
├── write.ts          — file writing
├── edit.ts           — string replacement editing
├── bash.ts           — sandboxed shell execution
├── grep.ts           — ripgrep wrapper
└── glob.ts           — fast-glob wrapper
```

Each tool module exports:
- `definition` — the JSON schema passed to the API's `tools` parameter
- `execute(input, context)` — runs the tool and returns the result

The `context` object carries:
- `workingDirectory` — the project root (or worktree path)
- `issueId` — for audit trail
- `abortSignal` — for cancellation

**Security consideration:** All file tools must be scoped to the project directory. The `bash` tool should run in a restricted environment — no `rm -rf /`, no network access outside localhost, no access to `~/.ssh` or credentials. Use the same allowlist approach the current runner uses.

```typescript
// tools/index.ts
export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  context: ToolContext
): Promise<string> {
  const tool = registry.get(name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);

  // Scope file paths to working directory
  if ('file_path' in input || 'path' in input) {
    validatePath(input, context.workingDirectory);
  }

  const result = await tool.execute(input, context);

  // Audit trail
  addClaudeNote(context.issueId, 'tool_use', `${name}: ${summarize(input, result)}`);

  return result;
}
```

### 2.4 Rewrite Claude Runner Core

Replace the spawn-based flow in `claude-runner.ts` with an API-driven conversation loop. The new flow:

```
claimItem() → buildPrompt() → runConversation() → handleResult()
```

The conversation loop:

```typescript
async function runConversation(issue: Item, context: RunContext): Promise<void> {
  const client = getClient();
  const messages: MessageParam[] = [];
  const systemPrompt = buildSystemPrompt(issue, context);
  const toolDefs = getToolDefinitions();

  // Initial user message with task description
  messages.push({
    role: 'user',
    content: buildTaskPrompt(issue, context)
  });

  let turnCount = 0;
  const MAX_TURNS = 50; // safety limit

  while (turnCount < MAX_TURNS) {
    turnCount++;

    const stream = client.messages.stream({
      model: getModel(),
      max_tokens: 16384,
      system: systemPrompt,
      messages,
      tools: toolDefs
    });

    // Stream text blocks to SSE as they arrive
    stream.on('text', (text) => {
      emitSSE('output', { type: 'text', content: text, issueId: issue.id });
    });

    const response = await stream.finalMessage();

    // Add assistant response to conversation
    messages.push({ role: 'assistant', content: response.content });

    // If no tool use, conversation is complete
    if (response.stop_reason !== 'tool_use') break;

    // Execute all tool calls
    const toolResults: ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;

      emitSSE('output', {
        type: 'tool_use',
        tool: block.name,
        input: block.input,
        issueId: issue.id
      });

      try {
        const result = await executeTool(block.name, block.input, context);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result
        });
      } catch (err) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: `Error: ${err.message}`,
          is_error: true
        });
      }
    }

    // Add tool results and continue loop
    messages.push({ role: 'user', content: toolResults });
  }
}
```

### 2.5 Prompt Construction

The current runner builds a single prompt string. With multi-turn conversations and tool use, the prompt structure changes:

**System prompt** (persistent context):

```
You are working on project "{project.name}" in the App Hub system.

Project description: {project.description}
{project.context ? `Additional context: ${project.context}` : ''}

Working directory: {context.workingDirectory}

Rules:
- Make changes only within the working directory
- Commit your work with descriptive messages
- If working on a branch, prefix commits with "vibe:"
- Report progress by describing what you've done after each major step
- If blocked, explain what's wrong and stop
```

**Task prompt** (first user message):

```
Complete the following task:

Title: {issue.title}
Priority: {issue.priority}
Description: {issue.description}
Labels: {issue.labels.join(', ')}

Start by reading the project structure to understand the codebase, then implement the changes needed.
```

### 2.6 Token Usage Tracking

With direct API access, track token consumption per item. Add columns to the `items` table:

```sql
ALTER TABLE items ADD COLUMN tokens_input INTEGER DEFAULT 0;
ALTER TABLE items ADD COLUMN tokens_output INTEGER DEFAULT 0;
ALTER TABLE items ADD COLUMN api_cost_cents INTEGER DEFAULT 0;
```

After each API response:

```typescript
const usage = response.usage;
db.prepare(`
  UPDATE items
  SET tokens_input = tokens_input + ?,
      tokens_output = tokens_output + ?
  WHERE id = ?
`).run(usage.input_tokens, usage.output_tokens, issue.id);
```

Display in the dashboard — cost per task, cost per project, running totals.

### 2.7 Concurrency: Task Queue

The current runner is single-process (`currentProcess`). With API calls, support parallel tasks:

Create `packages/hub/src/lib/server/task-queue.ts`:

```typescript
interface QueuedTask {
  issueId: string;
  abortController: AbortController;
  startedAt: Date;
}

const MAX_CONCURRENT = Number(process.env.APPHUB_MAX_CONCURRENT) || 2;
const activeTasks = new Map<string, QueuedTask>();
const pending: string[] = [];

export async function enqueue(issueId: string): Promise<void> {
  if (activeTasks.size >= MAX_CONCURRENT) {
    pending.push(issueId);
    return;
  }
  await startTask(issueId);
}

async function startTask(issueId: string): Promise<void> {
  const controller = new AbortController();
  activeTasks.set(issueId, {
    issueId,
    abortController: controller,
    startedAt: new Date()
  });

  try {
    await runConversation(issueId, controller.signal);
  } finally {
    activeTasks.delete(issueId);
    // Pull next from queue
    if (pending.length > 0) {
      const next = pending.shift()!;
      startTask(next); // fire-and-forget
    }
  }
}

export function cancel(issueId: string): boolean {
  const task = activeTasks.get(issueId);
  if (!task) return false;
  task.abortController.abort();
  return true;
}

export function getStatus(): TaskQueueStatus {
  return {
    active: Array.from(activeTasks.values()),
    pending: [...pending],
    maxConcurrent: MAX_CONCURRENT
  };
}
```

Each task gets its own git worktree, so parallel execution is safe. The `MAX_CONCURRENT` default of 2 balances API rate limits with throughput. Surface the queue status in the dashboard and SSE events.

### 2.8 Migration Path

The rewrite doesn't need to be all-or-nothing. A migration path:

1. Add the Anthropic SDK and tool execution layer alongside the existing claude-runner
2. Add a setting (`APPHUB_RUNNER_MODE=cli|api`) that toggles which backend processes items
3. Default to `cli` for backwards compatibility
4. Once the API runner is stable, flip the default and deprecate the CLI runner
5. Eventually remove the CLI spawning code

### Phase 2 Deliverables

- Anthropic SDK integrated, API key configured via env
- Tool execution layer (read, write, edit, bash, grep, glob)
- Multi-turn conversation loop with streaming
- Token usage tracking per item
- Configurable concurrency (default: 2 parallel tasks)
- Backwards-compatible migration via `RUNNER_MODE` setting
- Same git worktree isolation, same SSE updates, same DB state machine

---

## Phase 3: Self-Modification

**Goal:** App Hub can modify its own codebase — add features, fix bugs, improve itself — with safety guardrails that prevent it from breaking itself.

### 3.1 The Core Problem

Self-modification is conceptually simple: the hub is a project in its own board, items in the "claude" stage trigger the same build flow, and changes land on a branch for review. The hard part is safety — a bad change could break the hub, corrupt the database, or create an infinite loop.

### 3.2 Safety Model

Three layers of protection:

**Layer 1: Isolation**

Self-modification always happens in a git worktree on a dedicated branch (prefixed with `apphub-self/`). The running hub process is never modified in-place. Changes must be explicitly merged.

**Layer 2: Automated Validation**

Before a self-modification branch can be moved to "review", the hub runs a validation pipeline on the worktree:

```typescript
interface ValidationResult {
  passed: boolean;
  checks: {
    name: string;
    passed: boolean;
    output: string;
  }[];
}

async function validateSelfModification(worktreePath: string): Promise<ValidationResult> {
  const checks = [
    { name: 'typescript', cmd: 'npx tsc --noEmit' },
    { name: 'shared-build', cmd: 'npm run build --workspace=@apphub/shared' },
    { name: 'hub-build', cmd: 'npm run build --workspace=@apphub/hub' },
    { name: 'cli-build', cmd: 'npm run build --workspace=@apphub/cli' },
    { name: 'health-check', cmd: 'node build & sleep 5 && curl -sf http://localhost:5175/api/health && kill %1' },
  ];

  // Run each check in the worktree
  // ...
}
```

The health check is the critical one — it actually starts the modified hub on a different port and verifies it responds. If any check fails, the branch is flagged and the item moves to "review" with error notes.

**Layer 3: Human Review Gate**

Self-modification branches are never auto-merged. They always land in "review" stage where the developer can:
- View the diff in the dashboard
- Run the modified version locally
- Merge or discard

A future enhancement could add an auto-merge path for low-risk changes (docs, comments, style) with a confidence threshold, but the initial implementation should always require human approval.

### 3.3 Self-Registration

The hub needs to know about itself as a project. On first startup (or via a CLI command), register the hub:

```typescript
// packages/hub/src/lib/server/self-register.ts
export function ensureSelfRegistered(): void {
  const existing = db.prepare('SELECT 1 FROM projects WHERE slug = ?').get('apphub');
  if (existing) return;

  const meta: ProjectMeta = {
    name: 'App Hub',
    slug: 'apphub',
    description: 'The App Hub system itself',
    status: 'active',
    template: '',
    tags: ['meta', 'self'],
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  };

  // Register with path pointing to monorepo root
  db.prepare(`INSERT INTO projects (slug, name, description, status, path, created, updated)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(meta.slug, meta.name, meta.description, meta.status,
         config.root, meta.created, meta.updated);
}
```

### 3.4 Scoped Self-Modification

Not all changes to the hub are equal. Define scopes with different risk levels:

| Scope | Risk | Examples | Auto-validation |
|-------|------|----------|-----------------|
| `docs` | Low | CLAUDE.md, comments, README | TypeScript check only |
| `style` | Low | CSS changes, theme adjustments | Build + visual check |
| `api` | Medium | New endpoints, response changes | Full build + health check |
| `schema` | High | Database migrations, type changes | Full build + migration test + rollback plan |
| `core` | Critical | claude-runner, db.ts, self-modify logic | Full build + health check + manual review required |

Tag self-modification items with a scope. The validation pipeline runs more or fewer checks based on scope. Core changes always require human review regardless of validation results.

### 3.5 Preventing Infinite Loops

The hub must never create items that trigger itself to create more items. Rules:

1. Self-modification items can only be created by human action (dashboard or CLI), never by the runner itself
2. The runner skips items for the `apphub` project if `APPHUB_SELF_MODIFY` is not explicitly `true`
3. A cooldown period between self-modification runs (e.g., 5 minutes) prevents rapid cycling
4. Max self-modification items in-flight at once: 1

```typescript
function shouldProcessSelfItem(issue: Item): boolean {
  if (issue.project_slug !== 'apphub') return true; // normal project, always process
  if (process.env.APPHUB_SELF_MODIFY !== 'true') return false;

  // Check cooldown
  const lastSelfRun = db.prepare(`
    SELECT MAX(created) as last_run FROM claude_notes
    WHERE issue_id IN (SELECT id FROM items WHERE project_slug = 'apphub')
    AND type = 'info' AND message LIKE 'Self-modification started%'
  `).get();

  if (lastSelfRun?.last_run) {
    const elapsed = Date.now() - new Date(lastSelfRun.last_run).getTime();
    if (elapsed < 5 * 60 * 1000) return false; // 5 min cooldown
  }

  return true;
}
```

### 3.6 Hot Reload (Future Enhancement)

After a self-modification branch is merged into main, the hub could restart itself to pick up changes. This is straightforward with launchd — the process exits, launchd restarts it, the new code runs.

```typescript
export function requestRestart(reason: string): void {
  logger.info('hub', 'restart_requested', reason);
  // Graceful shutdown: close DB, drain SSE connections, then exit
  db.close();
  process.exit(0); // launchd KeepAlive restarts us
}
```

The restart should only happen after verifying the merged code passes all validation checks. A failed restart (hub crashes on startup) is caught by launchd's restart logic, and the developer can roll back the git commit manually.

### Phase 3 Deliverables

- Hub registered as a project in its own board
- Self-modification gated behind `APPHUB_SELF_MODIFY=true`
- Git worktree isolation for all self-changes
- Automated validation pipeline (typecheck, build, health check)
- Human review gate (no auto-merge)
- Scoped risk levels for different change types
- Infinite loop prevention (human-only creation, cooldown, max-in-flight)
- Graceful restart after merge (launchd-based)

---

## Implementation Order

For Claude Code to work through this, here's the suggested step-by-step:

### Phase 1 (Estimated: 1-2 sessions)

1. Switch to `adapter-node`, add `start` script, verify production build works
2. Create env config layer in `apphub.config.ts` with `process.env` fallbacks
3. Add `/api/health` endpoint
4. Create `scripts/install-service.sh` and the launchd plist template
5. Update CLI error messages for hub-not-running state
6. Test the full lifecycle: build → install service → verify auto-start

### Phase 2 (Estimated: 3-5 sessions)

1. Install Anthropic SDK, create `anthropic.ts` client wrapper
2. Build tool execution layer (`tools/` directory) — start with `read`, `write`, `bash`
3. Add remaining tools (`edit`, `grep`, `glob`)
4. Build the conversation loop with streaming and tool dispatch
5. Add `APPHUB_RUNNER_MODE` setting and wire up the toggle
6. Add token tracking columns and dashboard display
7. Build the task queue for parallel execution
8. Test end-to-end: create item → move to claude → watch API-driven execution → review
9. Remove CLI spawning code once API runner is stable

### Phase 3 (Estimated: 2-3 sessions)

1. Add self-registration logic
2. Add `APPHUB_SELF_MODIFY` gate and the `shouldProcessSelfItem` check
3. Build the validation pipeline
4. Add scoped risk levels
5. Wire up the restart-after-merge flow
6. Test: create a self-modification item (e.g., "add a dark mode toggle") → verify isolation → review → merge → restart

---

## Open Questions

Things to decide before or during implementation:

1. **API key management:** Store the Anthropic API key as an env var, or in a local config file, or in the SQLite settings table? Env var is simplest and most secure. Settings table would allow changing it from the dashboard but means storing a secret in SQLite.

2. **Model selection per task:** Should different tasks use different models? (Sonnet for routine tasks, Opus for complex refactors.) Could be a per-project or per-item setting.

3. **Extended thinking:** The Anthropic API supports extended thinking for complex reasoning. Should the hub enable this for high-priority or high-complexity items? It increases cost but improves quality for architectural decisions.

4. **Cost limits:** Should there be a per-item, per-project, or global spending cap? The token tracking in Phase 2 enables this, but the policy needs to be defined.

5. **Multi-project self-modification:** If the hub modifies a template, should it propagate changes to projects spawned from that template? This is powerful but dangerous.

6. **Backup strategy:** Before any self-modification, should the hub snapshot the database? SQLite makes this trivial (`VACUUM INTO 'backup.db'`), and it's a cheap safety net.
