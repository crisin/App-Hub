# Refactoring Complete

All 12 steps from `REFACTOR.md` have been completed. Date: 2026-04-09.

| Step | Description | Commit | Notes |
|------|------------|--------|-------|
| 1 | Unify Task/Item Type System | `vibe: unify task/item type system` | Removed `Task`, `TaskStatus`, `TaskPriority`. Deleted legacy `/api/projects/[slug]/tasks` route. Rewrote CLI `task.ts` to use items API. |
| 2 | Fix Stage/Lane Terminology | `vibe: fix stage/lane terminology mismatch` | CLI `board.ts` imports `ITEM_STAGES`/`ITEM_STAGE_LABELS` from shared. All hub routes standardized on `stage`. |
| 3 | Clean Up Dead Exports | `vibe: clean up dead exports from shared package` | Removed 7 dead types, 5 dead constants. Zero broken imports. |
| 4 | Add Error Handling to CLI | `vibe: add error handling to all CLI commands` | Created `withSpinner.ts` helper. All commands wrapped. Fixed `api.ts` non-JSON response handling. |
| 5 | Remove Unused CLI Dependencies | `vibe: remove unused CLI dependencies` | Removed `gray-matter`, `degit`, `better-sqlite3` from CLI package.json. |
| 6 | Centralize Hardcoded Constants | `vibe: centralize hardcoded constants` | Created `hub/lib/server/constants.ts` (ATTACHMENTS_DIR, ACCESS_TTL, REFRESH_TTL). CLI and claude-runner import HUB_PORT from shared. |
| 7 | Fix `as any` Type Casts | `vibe: fix as-any type casts in hub` | Added DB row types (DbProjectRow, DbItemRow, etc.) to `db.ts`. Replaced ~40 unsafe casts across hub routes. |
| 8 | Extract Duplicated Logic | `vibe: extract duplicated logic into shared helpers` | Created `log-queries.ts`, `file-utils.ts`. Added `buildItemFilters()` and generalized `getNextPosition()` in `data.ts`. |
| 9 | Standardize API Response Format | `vibe: standardize API response format` | Created `response.ts` (ok/err helpers). Fixed status codes (suggest 500->503, circular dep 400->409). Added missing data/user fields. Added try-catch to claude/status. Added SSE error logging. |
| 10 | Fix Race Condition in Claude Runner | `vibe: fix race condition and resource leaks in Claude runner` | Wrapped item claim in `db.transaction()`. Added 256KB max stdout buffer. Added listener cleanup on close/error. |
| 11 | Add Missing Validation | `vibe: add missing validation to API routes` | Reject empty PATCH body on phases (400). Return 400 for invalid dependency_type. Attachment MIME/size checks already existed. |
| 12 | Remove Unused Imports | `vibe: remove unused DbItemRow import in claude-runner` | `tsc --noUnusedLocals` sweep found 1 unused import. |

## New Files Created

- `packages/hub/src/lib/server/constants.ts` — hub-internal constants (ATTACHMENTS_DIR, TTLs)
- `packages/hub/src/lib/server/log-queries.ts` — shared log query filtering
- `packages/hub/src/lib/server/file-utils.ts` — attachment file finder
- `packages/hub/src/lib/server/response.ts` — ok()/err() response helpers
- `packages/cli/src/lib/withSpinner.ts` — reusable spinner + error handling

## Verification

- `npm run build --workspace=@apphub/shared` passes
- `npx tsc --noEmit -p packages/hub/tsconfig.json` passes (zero errors)
- `npx tsc --noEmit --noUnusedLocals -p packages/hub/tsconfig.json` passes (zero unused)
