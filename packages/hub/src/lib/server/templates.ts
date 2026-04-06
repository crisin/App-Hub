import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'
import {
  defaultProjectMeta,
  defaultTasksMd,
  defaultClaudeMd,
  APPHUB_META_FILE,
  TASKS_FILE,
  DOCS_DIR,
} from '@apphub/shared'
import type { Template } from '@apphub/shared'

const execAsync = promisify(exec)

/** Read templates from the templates/ directory */
export function listTemplates(): Template[] {
  const templatesDir = path.resolve(process.cwd(), '..', '..', 'templates')
  if (!fs.existsSync(templatesDir)) return []

  const entries = fs.readdirSync(templatesDir, { withFileTypes: true })
  const templates: Template[] = []

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue

    const configPath = path.join(templatesDir, entry.name, 'template.json')
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      templates.push({
        name: config.name ?? entry.name,
        slug: entry.name,
        description: config.description ?? '',
        source: config.source ?? path.join(templatesDir, entry.name),
        tags: config.tags ?? [],
        postCreate: config.postCreate,
      })
    } else {
      templates.push({
        name: entry.name,
        slug: entry.name,
        description: '',
        source: path.join(templatesDir, entry.name),
        tags: [],
      })
    }
  }

  return templates
}

/** Slugify a project name */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Create a new project from a template */
export async function createProject(
  name: string,
  templateSlug: string,
): Promise<{ slug: string; path: string }> {
  const slug = slugify(name)
  const projectsDir = path.resolve(process.cwd(), '..', '..', 'projects')
  const projectPath = path.join(projectsDir, slug)

  if (fs.existsSync(projectPath)) {
    throw new Error(`Project "${slug}" already exists at ${projectPath}`)
  }

  const templates = listTemplates()
  const template = templates.find((t) => t.slug === templateSlug)

  if (!template) {
    throw new Error(
      `Template "${templateSlug}" not found. Available: ${templates.map((t) => t.slug).join(', ')}`,
    )
  }

  // Copy template to project directory
  if (template.source.startsWith('http') || template.source.includes('github.com')) {
    // Clone from git using degit
    await execAsync(`npx degit ${template.source} "${projectPath}"`)
  } else {
    // Local template: copy directory
    fs.cpSync(template.source, projectPath, { recursive: true })
    // Remove template.json from the copied project
    const copiedConfig = path.join(projectPath, 'template.json')
    if (fs.existsSync(copiedConfig)) fs.unlinkSync(copiedConfig)
  }

  // Create .apphub.md
  fs.writeFileSync(
    path.join(projectPath, APPHUB_META_FILE),
    defaultProjectMeta(name, slug, templateSlug),
  )

  // Create TASKS.md
  fs.writeFileSync(path.join(projectPath, TASKS_FILE), defaultTasksMd(name))

  // Create CLAUDE.md
  fs.writeFileSync(path.join(projectPath, 'CLAUDE.md'), defaultClaudeMd(name, slug, templateSlug))

  // Create docs/ directory
  const docsDir = path.join(projectPath, DOCS_DIR)
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true })
    fs.writeFileSync(path.join(docsDir, '.gitkeep'), '')
  }

  // Initialize git
  await execAsync('git init', { cwd: projectPath })

  // Run post-create hook if defined
  if (template.postCreate) {
    await execAsync(template.postCreate, { cwd: projectPath })
  }

  return { slug, path: projectPath }
}
