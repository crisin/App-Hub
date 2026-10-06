/**
 * Item hooks — the side effects of board changes, in one place.
 *
 * Every route that creates or changes items calls these, so the board page,
 * the project page, the CLI and external agents behave the same. (Before,
 * only the /api/board routes started the runner or the debate; the project
 * page's /api/items and /api/projects/:slug/items did neither.)
 *
 *  - clients refresh (SSE "board" event)
 *  - the runner looks for work: an item entered the claude lane, or a
 *    blocker became done and released a queued item. autoTriggerIfNeeded()
 *    is a no-op while a run is active or the lane holds nothing runnable.
 *  - label hooks on new items: "debate" starts a critic/advocate/judge run
 */
import { autoTriggerIfNeeded, emitBoardChanged } from './claude-runner.js'
import { autoCritiqueIfLabeled } from './debate.js'

/** After an item was created (any route) */
export function afterItemCreated(item: { id: string; labels?: unknown }): void {
  emitBoardChanged()
  autoTriggerIfNeeded()
  autoCritiqueIfLabeled(item.id, item.labels)
}

/** After items were updated, moved, reordered, merged, discarded or deleted */
export function afterItemsChanged(): void {
  emitBoardChanged()
  autoTriggerIfNeeded()
}
