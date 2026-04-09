import matter from 'gray-matter'
import type { ProjectMeta } from '@apphub/shared'

/**
 * Parse .apphub.md file content into ProjectMeta
 */
export function parseProjectMeta(content: string): Partial<ProjectMeta> {
  const { data } = matter(content)
  return {
    name: data.name ?? '',
    slug: data.slug ?? '',
    description: data.description ?? '',
    context: data.context ?? '',
    status: data.status ?? 'idea',
    template: data.template ?? '',
    tags: Array.isArray(data.tags) ? data.tags : [],
    created: data.created ?? new Date().toISOString(),
    updated: data.updated ?? new Date().toISOString(),
    repo: data.repo,
  }
}
