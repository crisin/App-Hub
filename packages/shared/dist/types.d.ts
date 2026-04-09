/** Project status lifecycle */
export type ProjectStatus = 'idea' | 'active' | 'paused' | 'completed' | 'archived';
/** Item priority levels */
export type ItemPriority = 'low' | 'medium' | 'high' | 'critical';
/** Project metadata stored in .apphub.md frontmatter */
export interface ProjectMeta {
    name: string;
    slug: string;
    description: string;
    context?: string;
    status: ProjectStatus;
    template: string;
    tags: string[];
    created: string;
    updated: string;
    repo?: string;
}
/** Template definition */
export interface Template {
    name: string;
    slug: string;
    description: string;
    source: string;
    tags: string[];
    postCreate?: string;
}
/**
 * Item stage — the unified flow pipeline.
 * 'claude' is a special execution stage where Claude Code works on the item.
 */
export type ItemStage = 'idea' | 'plan' | 'build' | 'claude' | 'review' | 'done';
/** Item type — semantic distinction */
export type ItemType = 'task' | 'idea' | 'bug' | 'plan' | 'note';
/** A work item — the single source of truth for all tracked work */
export interface Item {
    id: string;
    project_slug: string;
    title: string;
    description: string;
    stage: ItemStage;
    priority: ItemPriority;
    labels: string[];
    position: number;
    assigned_to: string;
    parent_id: string | null;
    phase_id: string | null;
    item_type: ItemType;
    created: string;
    updated: string;
    attachment_count?: number;
    child_count?: number;
    blocked_by_count?: number;
    blocks_count?: number;
    is_blocked?: boolean;
    attachments?: IssueAttachment[];
    notes?: ClaudeNote[];
    blocked_by?: ItemDependency[];
    blocks?: ItemDependency[];
}
/** Dependency relationship types */
export type DependencyType = 'blocks' | 'relates_to';
/** A dependency link between two items */
export interface ItemDependency {
    id: string;
    item_id: string;
    depends_on_id: string;
    dependency_type: DependencyType;
    created: string;
    item_title?: string;
    item_stage?: ItemStage;
    depends_on_title?: string;
    depends_on_stage?: ItemStage;
    depends_on_project?: string;
}
/** Claude note — progress/commit-style entry on an item */
export type ClaudeNoteType = 'progress' | 'commit' | 'error' | 'info';
export interface ClaudeNote {
    id: string;
    issue_id: string;
    type: ClaudeNoteType;
    message: string;
    created: string;
}
/** File attachment on an item */
export interface IssueAttachment {
    id: string;
    issue_id: string;
    filename: string;
    mime_type: string;
    size_bytes: number;
    created: string;
}
/** Phase status */
export type PhaseStatus = 'upcoming' | 'active' | 'completed';
/** A project phase / milestone */
export interface Phase {
    id: string;
    project_slug: string;
    name: string;
    position: number;
    status: PhaseStatus;
    target_date: string | null;
    created: string;
    updated: string;
    item_count?: number;
    done_count?: number;
    completion_pct?: number;
}
