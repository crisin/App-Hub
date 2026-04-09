# App Hub — Refactoring Guide

This document is the output of a deep codebase analysis. It contains actionable refactoring steps ordered by priority. Work through them sequentially — later steps assume earlier ones are complete.

After completing each step: rebuild shared (`npm run build --workspace=@apphub/shared`), then run the hub dev server (`npm run dev`) to verify nothing broke. Fix any TypeScript or runtime errors before moving on.

---

## Step 1: Unify Task/Item Type System (Critical) — ✅ DONE

> **Status:** Completed. `Task`, `TaskStatus`, `TaskPriority` removed from shared types. Legacy `/api/projects/[slug]/tasks` route removed. CLI `task.ts` rewritten to use `/api/projects/[slug]/items`. Shared package builds cleanly.
>
> **Carryover to Step 2:** `board.ts` still hardcodes old lane names (`backlog`, `todo`, `in_progress`) — will crash at runtime until Step 2 is completed.

### Problem

The shared package defines two parallel systems that were never reconciled:

- `Task` type with `TaskStatus` (`todo | in_progress | done | blocked`) — legacy system
- `Item` type with `ItemStage` (`idea | plan | build | claude | review | done`) — current system

The hub's board API uses `Item`. The CLI's `task.ts` commands hit a separate `/api/projects/[slug]/tasks` endpoint using the legacy `Task` type. Items added via the board don't appear in task lists, and tasks added via CLI don't appear on the board.

### What to change

**In `packages/shared/src/types.ts`:**

- Remove the `Task` interface (lines ~25-33)
- Remove `TaskStatus` type alias
- Remove `TaskPriority` type alias
- Remove `Project` interface if it's the old one (lines ~35-46) — check if anything still imports it
- Keep `Item`, `ItemStage`, `ItemPriority`, and all Item-related types as the canonical model

**In `packages/shared/src/schemas.ts`:**

- Remove `TASK_STATUSES` (unused, line ~12)
- Remove `TASK_PRIORITIES` (unused, line ~15)
- Keep `ITEM_STAGES`, `ITEM_STAGE_LABELS`, and `ITEM_PRIORITIES`

**In `packages/hub/src/routes/api/projects/[slug]/tasks/`:**

- Either remove this route entirely, or rewrite it as a thin wrapper that maps to the Item system (creating items with a default stage, etc.)

**In `packages/cli/src/commands/task.ts`:**

- Rewrite to call the board/items API (`/api/board` or `/api/projects/[slug]/items`) instead of the legacy tasks endpoint
- Map CLI-friendly subcommands (`add`, `list`, `done`) to Item operations

**In `packages/shared/src/index.ts`:**

- Remove re-exports of deleted types

After this step, grep the entire repo for `Task`, `TaskStatus`, `TaskPriority` to catch any remaining references.

---

## Step 2: Fix Stage/Lane Terminology Mismatch (Critical) — ✅ DONE

> **Status:** Completed. CLI `board.ts` fully rewritten — imports `ITEM_STAGES`/`ITEM_STAGE_LABELS` from shared, uses `--stage` options, defaults to `ITEM_STAGES[0]`. All hub board API routes accept only `stage` (no backwards-compat `lane`). Claim route sets `'build'` instead of invalid `'in_progress'`. Suggest route imports validation constants from shared.
>
> **Cosmetic carryover (optional):** The board Svelte page and its server loader still use `lane` as local variable names and `data.lanes` as a property name. Values are correct — just naming inconsistency. A few `claude-runner.ts` log messages also say "lane" instead of "stage".

### Problem

The hub API returns items grouped by **stage** using `ItemStage` values: `idea | plan | build | claude | review | done`.

The CLI's `board.ts` hardcodes a completely different set of **lane** names: `backlog | todo | in_progress | claude | done`.

This means the CLI board command crashes at runtime — it iterates over keys that don't exist in the API response.

### What to change

**In `packages/cli/src/commands/board.ts`:**

- Line ~15: Replace the hardcoded `laneOrder` array `['backlog', 'todo', 'in_progress', 'claude', 'done']` with an import: `import { ITEM_STAGES } from '@apphub/shared'`
- Lines ~16-22: Replace `laneLabels` map to use actual stage names. Import `ITEM_STAGE_LABELS` from `@apphub/shared` instead of defining a local mapping.
- Line ~34: Fix `const issues = lanes[lane] ?? []` — the variable name and key access need to use stage terminology, not lane terminology
- Line ~57: Replace default lane `'backlog'` with `ITEM_STAGES[0]` (which is `'idea'`)
- Lines ~70, ~83, ~100: Replace all references to the `lane` field with `stage` when sending data to the API
- Line ~92-94: Replace lane validation with `ITEM_STAGES.includes(...)` check

**In `packages/hub/src/routes/api/board/+server.ts`:**

- Remove the backwards-compat `lane` field acceptance (if it still exists). Standardize on `stage` everywhere.

**In `packages/hub/src/routes/api/board/suggest/+server.ts`:**

- Lines ~186-187: Replace hardcoded `validPriorities` and `validStages` with imports from `@apphub/shared` (`ITEM_PRIORITIES`, `ITEM_STAGES`)

---

## Step 3: Clean Up Dead Exports from Shared Package (High) — ✅ DONE

> **Status:** Completed. All 7 dead types removed from types.ts, all dead constants removed from schemas.ts (ITEM_TYPES, PHASE_STATUSES, FLOW_STAGES) and constants.ts (DEV_API_BASE, TASKS_FILE). Zero broken imports, build passes. No new dead exports remain.

### Problem

Seven types and six constants are exported from the shared package but never imported anywhere. This bloats the package and creates confusion about which types are canonical.

### What to remove

**Dead types in `packages/shared/src/types.ts`:**

- `ProjectWithStats` (lines ~96-104) — 0 imports
- `BranchReview` (lines ~165-181) — 0 imports
- `DevUserRole` (line ~184) — 0 imports
- `DevUser` (lines ~187-193) — 0 imports
- `DevApiKey` (lines ~196-203) — 0 imports
- `DevAuthToken` (lines ~206-212) — 0 imports
- `ApiResponse<T>` (lines ~215-219) — 0 imports

**Dead constants in `packages/shared/src/schemas.ts`:**

- `TASK_STATUSES` (line ~12) — should already be gone after Step 1
- `TASK_PRIORITIES` (line ~15) — should already be gone after Step 1
- `ITEM_TYPES` (line ~34) — 0 imports
- `PHASE_STATUSES` (line ~40) — 0 imports
- `FLOW_STAGES` (line ~21) — 0 imports, overlaps with `ITEM_STAGES`

**Dead constant in `packages/shared/src/constants.ts`:**

- `DEV_API_BASE` (line ~10) — 0 imports

Before deleting each one, do a final grep to confirm it's truly unused. Then update `index.ts` exports.

---

## Step 4: Add Error Handling to All CLI Commands (High)

### Problem

Most CLI commands (`task.ts`, `board.ts`) call `hubFetch()` without try-catch. If the hub is down or returns non-JSON, the CLI crashes with an unhandled exception. Only `new.ts` and `sync.ts` have proper error handling with spinners.

### What to change

**Create `packages/cli/src/lib/withSpinner.ts`:**

Extract the spinner + try-catch pattern used in `new.ts` and `sync.ts` into a reusable helper:

```typescript
import ora from 'ora';

export async function withSpinner<T>(
  message: string,
  fn: () => Promise<T>
): Promise<T> {
  const spinner = ora(message).start();
  try {
    const result = await fn();
    spinner.succeed();
    return result;
  } catch (err) {
    spinner.fail(err instanceof Error ? err.message : 'Unknown error');
    process.exit(1);
  }
}
```

**Wrap all commands in `task.ts` and `board.ts`** with this helper or at minimum a try-catch that prints a useful error and exits cleanly.

**Fix `packages/cli/src/lib/api.ts` (line ~12):**

`res.json()` can throw if the response body isn't valid JSON. Wrap it:

```typescript
const text = await res.text();
let body;
try {
  body = JSON.parse(text);
} catch {
  throw new Error(`Hub returned non-JSON response (${res.status}): ${text.slice(0, 200)}`);
}
```

**Fix `packages/cli/src/commands/board.ts` (line ~183):**

`scriptPath` uses `process.cwd()` to find `scripts/claude-runner.sh`. This breaks unless the CLI is run from the project root. Use `import.meta.url` or `__dirname` to resolve relative to the CLI package instead.

---

## Step 5: Remove Unused CLI Dependencies (High — quick win)

### Problem

The CLI's `package.json` lists three dependencies that are never imported:

- `gray-matter@^4.0.3`
- `degit@^2.8.4`
- `better-sqlite3@^11.9.0`

### What to change

```bash
cd packages/cli
npm uninstall gray-matter degit better-sqlite3
```

Verify nothing breaks. These were likely copied from the hub package during initial scaffolding.

---

## Step 6: Centralize Hardcoded Constants (Medium)

### Problem

Values that should come from the shared package are duplicated across the codebase.

### Specific duplications to fix

**Hub port (5174) — 3 locations:**

- `packages/shared/src/constants.ts` line ~7: `HUB_PORT = 5174` (canonical)
- `packages/cli/src/lib/api.ts` line ~1: hardcoded `http://localhost:5174`
- `packages/hub/src/lib/server/claude-runner.ts` line ~59: `http://localhost:${process.env.PORT ?? 5174}`

→ CLI and claude-runner should import `HUB_PORT` from `@apphub/shared`

**Auth TTL values — 2 locations that may drift:**

- `packages/hub/src/routes/api/dev/auth/+server.ts` line ~17-18: `ACCESS_TTL = 60 * 60`, `REFRESH_TTL = 7 * 24 * 60 * 60`
- `packages/hub/src/routes/api/dev/auth/refresh/+server.ts` lines ~13-14: duplicate TTL definitions

→ Extract to a shared constant in `packages/hub/src/lib/server/constants.ts` (hub-internal, not shared package since these are server-only)

**ATTACHMENTS_DIR — defined in multiple API routes:**

- `packages/hub/src/routes/api/board/[id]/attachments/+server.ts` line ~9
- `packages/hub/src/routes/api/board/[id]/+server.ts` line ~9

→ Extract to `packages/hub/src/lib/server/constants.ts`

**Priority/stage validation lists:**

- `packages/hub/src/routes/api/board/suggest/+server.ts` line ~154: hardcoded timeout `180_000`
- Same file lines ~186-187: hardcoded `validPriorities` and `validStages`

→ Import from `@apphub/shared` (should be done in Step 2 already for stages)

---

## Step 7: Fix `as any` Type Casts in Hub (Medium)

### Problem

Multiple files cast database query results to `any` or `any[]`, defeating TypeScript safety. The shared package defines proper interfaces — they should be used.

### Locations to fix

- `packages/hub/src/lib/server/data.ts` lines ~462, ~508: `as any[]` on query results
- `packages/hub/src/lib/server/scanner.ts` line ~121: `as any[]` on project rows
- `packages/hub/src/lib/server/project-summary.ts` line ~44: `as any` on query result
- `packages/hub/src/routes/api/board/+server.ts` line ~23: `as any[]`
- `packages/hub/src/routes/api/branches/+server.ts` line ~18: `as any[]`
- `packages/hub/src/routes/reviews/+page.server.ts` line ~22: `as any[]`
- `packages/hub/src/routes/api/board/[id]/notes/+server.ts` line ~35: `as any`

### Approach

For each location:

1. Check what the SQL query returns (column names and types)
2. Find or create a matching TypeScript interface (prefer extending existing shared types)
3. Create a `DbRow` type in `packages/hub/src/lib/server/db.ts` if the shape is DB-specific (e.g., has `created_at` as string instead of Date)
4. Replace the `as any` cast with the proper type

---

## Step 8: Extract Duplicated Logic in Hub Routes (Medium)

### Problem

Several patterns are copy-pasted across route files.

### Duplications to extract

**1. Log query filtering — duplicated between:**

- `packages/hub/src/routes/api/logs/+server.ts` (lines ~6-27)
- `packages/hub/src/routes/logs/+page.server.ts` (lines ~4-17)

→ Extract to `packages/hub/src/lib/server/log-queries.ts`

**2. Attachment file-finding logic — duplicated within:**

- `packages/hub/src/routes/api/board/[id]/attachments/[attachmentId]/+server.ts` (lines ~21-23 and ~55-56)

→ Extract `findAttachmentFile(attachmentId)` helper to `packages/hub/src/lib/server/file-utils.ts`

**3. Item filter-building — duplicated between:**

- `packages/hub/src/routes/api/projects/[slug]/items/+server.ts` (lines ~14-18)
- `packages/hub/src/routes/api/items/+server.ts` (lines ~14-19)

→ Extract `buildItemFilter(params)` to `packages/hub/src/lib/server/data.ts`

**4. Position calculation — duplicated across:**

- `getNextPosition()` (lines ~426-436 in data.ts)
- Inline `max(position)` queries in `createItem()` (lines ~296-300) and `createPhase()` (lines ~610-612)

→ Consolidate into a single `getNextPosition(table, parentColumn, parentId)` function

**5. Dynamic SQL UPDATE building — duplicated in:**

- `listItemsByStage()` condition building (data.ts lines ~138-176)
- `updateItem()` (data.ts lines ~366-378)
- `updatePhase()` (data.ts lines ~645-652)

→ Extract a `buildUpdateClause(updates)` helper

---

## Step 9: Standardize API Response Format (Medium)

### Problem

The documented contract is `{ ok: boolean, data?: T, error?: string }` but several routes deviate.

### Specific fixes

**Missing `data` field:**

- `packages/hub/src/routes/api/board/reorder/+server.ts` line ~37: returns `{ ok: true }` without `data`
  → Change to `{ ok: true, data: null }` or `{ ok: true, data: { reordered: true } }`

**Inconsistent error status codes:**

- `packages/hub/src/routes/api/board/suggest/+server.ts` line ~213: returns 500 for "Claude CLI not found"
  → Should be 503 (Service Unavailable)

- `packages/hub/src/routes/api/board/[id]/dependencies/+server.ts` line ~79: returns 400 for circular dependency
  → Should be 409 (Conflict), matching the existing-dependency check at line ~70

**Missing error responses:**

- `packages/hub/src/routes/api/board/claude/status/+server.ts`: no error path — if `getRunnerStatusExtended()` throws, the route crashes
  → Add try-catch returning `{ ok: false, error: message }` with status 500

- `packages/hub/src/routes/api/board/events/+server.ts` lines ~41-44: empty catch block swallows errors silently
  → At minimum log the error; consider sending an SSE error event

**Auth refresh inconsistency:**

- `packages/hub/src/routes/api/dev/auth/refresh/+server.ts` line ~65: response is missing the `user` field that the main POST `/api/dev/auth/+server.ts` (line ~84) includes
  → Add `user` to the refresh response for consistency

### Optional improvement

Create a response helper in `packages/hub/src/lib/server/response.ts`:

```typescript
import { json } from '@sveltejs/kit';

export function ok<T>(data: T, status = 200) {
  return json({ ok: true, data }, { status });
}

export function err(error: string, status = 400) {
  return json({ ok: false, error }, { status });
}
```

Then use `return ok(projects)` and `return err('Not found', 404)` across all routes.

---

## Step 10: Fix Race Condition in Claude Runner (Medium)

### Problem

In `packages/hub/src/lib/server/claude-runner.ts` (lines ~408-414), item claiming uses optimistic locking without a transaction:

```javascript
const result = db.prepare('UPDATE ... WHERE ... AND assigned_to = ""').run(...)
if (result.changes === 0) return // Another runner claimed it
```

Two concurrent runners could both read `assigned_to = ''` before either writes. Since better-sqlite3 is synchronous and single-connection, this is less risky than it looks, but wrapping in a transaction is still the correct fix.

### What to change

Wrap the claim check + update in a `db.transaction()`:

```typescript
const claimItem = db.transaction((itemId: string, runnerId: string) => {
  const item = db.prepare('SELECT assigned_to FROM items WHERE id = ?').get(itemId);
  if (!item || item.assigned_to !== '') return false;
  db.prepare('UPDATE items SET assigned_to = ? WHERE id = ?').run(runnerId, itemId);
  return true;
});
```

### Also fix in the same file

**Resource leak (lines ~574-598):** `currentProcess.stdout?.on('data')` listeners are never cleaned up if the process crashes before the `close` event. Store listener references and remove them in an error handler.

**Unbounded buffer:** `stdoutBuffer` can grow without limit. Add a max size check or process lines incrementally.

---

## Step 11: Add Missing Validation (Low)

### Locations

**Empty PATCH body:**

- `packages/hub/src/routes/api/projects/[slug]/phases/[id]/+server.ts` PATCH (lines ~6-20): accepts an empty `updates` object. Add a check:
  ```typescript
  if (Object.keys(updates).length === 0) return err('No updates provided', 400);
  ```

**Dependency type fallback:**

- `packages/hub/src/routes/api/board/[id]/dependencies/+server.ts` POST (line ~52): silently falls back to `'blocks'` for invalid `dependency_type`. Should return 400 instead.

**Attachment validation:**

- `ATTACHMENT_MIME_TYPES` and `ATTACHMENT_MAX_SIZE` are defined in the shared package but the upload endpoint doesn't validate against them. Add checks in the POST handler.

---

## Step 12: Remove Unused Imports in Routes (Low — quick win)

Specific unused imports found:

- `packages/hub/src/routes/api/board/suggest/+server.ts` line ~13: `spawn` import shadowed by local definition at line ~113
- `packages/hub/src/routes/api/board/[id]/dependencies/+server.ts` line ~4: `randomUUID` imported but never used
- `packages/hub/src/routes/api/projects/[slug]/+server.ts` line ~6: `matter` imported but never called

Run the TypeScript compiler with `--noUnusedLocals` to catch any others:
```bash
cd packages/hub && npx tsc --noEmit --noUnusedLocals 2>&1 | grep "declared but"
```

---

## Verification Checklist

After completing all steps, verify:

- [ ] `npm run build --workspace=@apphub/shared` succeeds
- [ ] `npm run dev` starts the hub without errors
- [ ] Creating a project through the UI works end-to-end
- [ ] `npm run cli -- list` returns projects
- [ ] `npm run cli -- board` (if implemented) shows items by correct stage names
- [ ] No `as any` casts remain in hub server code (grep for `as any`)
- [ ] No hardcoded `5174` outside of shared constants (grep for `5174`)
- [ ] No references to removed types (grep for `TaskStatus`, `TaskPriority`, `BranchReview`, etc.)
