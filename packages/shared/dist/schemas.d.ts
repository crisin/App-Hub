import type { ProjectStatus, ItemPriority, ItemStage, DependencyType } from './types.js';
/** Valid project statuses */
export declare const PROJECT_STATUSES: ProjectStatus[];
/** Valid item priorities */
export declare const ITEM_PRIORITIES: ItemPriority[];
/** Item stages — the unified flow pipeline (including claude execution stage) */
export declare const ITEM_STAGES: ItemStage[];
/** Human-readable stage labels */
export declare const ITEM_STAGE_LABELS: Record<ItemStage, string>;
/** Dependency types */
export declare const DEPENDENCY_TYPES: DependencyType[];
/** Default phases seeded when creating a new project */
export declare const DEFAULT_PHASES: string[];
/** Allowed attachment MIME types */
export declare const ATTACHMENT_MIME_TYPES: string[];
/** Max attachment size in bytes (10 MB) */
export declare const ATTACHMENT_MAX_SIZE: number;
/** Default .apphub.md frontmatter template */
export declare function defaultProjectMeta(name: string, slug: string, template: string): string;
/** Default CLAUDE.md for spawned projects */
export declare function defaultClaudeMd(name: string, slug: string, template: string): string;
