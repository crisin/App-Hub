import matter from 'gray-matter'
import type { ProjectMeta, Task, TaskStatus, TaskPriority } from '@apphub/shared'

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

/**
 * Parse TASKS.md content into an array of Tasks.
 *
 * Expected format per task line:
 *   - [ ] **Task title** | priority: high | id: task-001
 *   - [x] **Done task** | priority: low | id: task-002
 *
 * Section headers (## Todo, ## In Progress, ## Done, ## Blocked) determine status.
 */
export function parseTasks(content: string): Task[] {
  const lines = content.split('\n')
  const tasks: Task[] = []
  let currentStatus: TaskStatus = 'todo'

  const sectionMap: Record<string, TaskStatus> = {
    todo: 'todo',
    'in progress': 'in_progress',
    done: 'done',
    blocked: 'blocked',
  }

  for (const line of lines) {
    const trimmed = line.trim()

    // Detect section headers
    const sectionMatch = trimmed.match(/^##\s+(.+)/)
    if (sectionMatch) {
      const sectionName = sectionMatch[1].toLowerCase().trim()
      if (sectionMap[sectionName]) {
        currentStatus = sectionMap[sectionName]
      }
      continue
    }

    // Detect task lines: - [ ] or - [x]
    const taskMatch = trimmed.match(/^-\s+\[([ xX])\]\s+\*\*(.+?)\*\*(?:\s*\|(.*))?$/)
    if (taskMatch) {
      const checked = taskMatch[1].toLowerCase() === 'x'
      const title = taskMatch[2].trim()
      const metaStr = taskMatch[3] ?? ''

      // Parse inline metadata (| key: value pairs)
      const meta: Record<string, string> = {}
      for (const part of metaStr.split('|')) {
        const [key, ...vals] = part.split(':')
        if (key && vals.length) {
          meta[key.trim().toLowerCase()] = vals.join(':').trim()
        }
      }

      const status: TaskStatus = checked ? 'done' : currentStatus
      const now = new Date().toISOString()

      tasks.push({
        id: meta.id ?? `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title,
        status,
        priority: (meta.priority as TaskPriority) ?? 'medium',
        created: meta.created ?? now,
        updated: meta.updated ?? now,
      })
    }
  }

  return tasks
}

/**
 * Serialize tasks back to TASKS.md format
 */
export function serializeTasks(tasks: Task[], projectName: string): string {
  const sections: Record<TaskStatus, Task[]> = {
    todo: [],
    in_progress: [],
    done: [],
    blocked: [],
  }

  for (const task of tasks) {
    sections[task.status].push(task)
  }

  const sectionNames: Record<TaskStatus, string> = {
    todo: 'Todo',
    in_progress: 'In Progress',
    done: 'Done',
    blocked: 'Blocked',
  }

  let md = `---\nproject: "${projectName}"\n---\n\n# Tasks\n`

  for (const status of ['todo', 'in_progress', 'done', 'blocked'] as TaskStatus[]) {
    md += `\n## ${sectionNames[status]}\n\n`
    for (const task of sections[status]) {
      const check = task.status === 'done' ? 'x' : ' '
      md += `- [${check}] **${task.title}** | priority: ${task.priority} | id: ${task.id}\n`
      if (task.description) {
        md += `  ${task.description}\n`
      }
    }
  }

  return md
}
