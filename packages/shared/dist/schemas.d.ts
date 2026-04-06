import type { ProjectStatus, TaskPriority, TaskStatus, BoardLane, ItemStage, ItemType } from './types.js';
/** Valid project statuses */
export declare const PROJECT_STATUSES: ProjectStatus[];
/** Valid task statuses */
export declare const TASK_STATUSES: TaskStatus[];
/** Valid task priorities */
export declare const TASK_PRIORITIES: TaskPriority[];
/** Item stages — the flow pipeline */
export declare const ITEM_STAGES: ItemStage[];
/** Human-readable stage labels */
export declare const ITEM_STAGE_LABELS: Record<ItemStage, string>;
/** Item types */
export declare const ITEM_TYPES: ItemType[];
/** Map old board lanes to new stages */
export declare const LANE_TO_STAGE: Record<BoardLane, ItemStage>;
/** @deprecated Use ITEM_STAGES instead */
export declare const BOARD_LANES: BoardLane[];
/** @deprecated Use ITEM_STAGE_LABELS instead */
export declare const BOARD_LANE_LABELS: Record<BoardLane, string>;
/** Allowed attachment MIME types */
export declare const ATTACHMENT_MIME_TYPES: string[];
/** Max attachment size in bytes (10 MB) */
export declare const ATTACHMENT_MAX_SIZE: number;
/** Default .apphub.md frontmatter template */
export declare function defaultProjectMeta(name: string, slug: string, template: string): string;
/** Default CLAUDE.md for spawned projects */
export declare function defaultClaudeMd(name: string, slug: string, template: string): string;
/** Default TASKS.md template */
export declare function defaultTasksMd(projectName: string): string;
