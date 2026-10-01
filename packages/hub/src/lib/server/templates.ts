import { exec, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'
import {
  defaultProjectMeta,
  defaultClaudeMd,
  hubClaudeSection,
  DEFAULT_GITATTRIBUTES,
  DEFAULT_GITIGNORE,
  APPHUB_META_FILE,
  DOCS_DIR,
} from '@apphub/shared'
import type { Template } from '@apphub/shared'
import { PATHS } from './config.js'

const execAsync = promisify(exec)
const execFileAsync = promisify(execFile)

/** Read templates from the templates/ directory */
export function listTemplates(): Template[] {
  const templatesDir = PATHS.templates
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

/** Never copied out of a local template, even if someone built or installed inside it */
const COPY_SKIP = new Set(['node_modules', 'target', 'dist', 'build', '.svelte-kit', '.worktrees', '.git'])

/** Binary-ish files that never contain placeholders */
const BINARY_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.icns', '.jar', '.zip', '.pdf', '.woff', '.woff2', '.ttf', '.otf', '.wav', '.mp3', '.ogg', '.db'])

/** Replace template placeholders in every text file below dir */
function replacePlaceholders(dir: string, values: Record<string, string>): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!COPY_SKIP.has(entry.name)) replacePlaceholders(full, values)
      continue
    }
    if (!entry.isFile() || BINARY_EXT.has(path.extname(entry.name).toLowerCase())) continue
    const content = fs.readFileSync(full, 'utf-8')
    if (!content.includes('__APP_')) continue
    let next = content
    for (const [key, value] of Object.entries(values)) next = next.split(key).join(value)
    fs.writeFileSync(full, next)
  }
}

/** Create a new project from a template */
export async function createProject(
  name: string,
  templateSlug: string,
): Promise<{ slug: string; path: string; warnings: string[] }> {
  const slug = slugify(name)
  const projectPath = path.join(PATHS.projects, slug)

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
    // Local template: copy directory, minus build output and installs
    fs.cpSync(template.source, projectPath, {
      recursive: true,
      filter: (src) => !COPY_SKIP.has(path.basename(src)),
    })
    // Remove template.json from the copied project
    const copiedConfig = path.join(projectPath, 'template.json')
    if (fs.existsSync(copiedConfig)) fs.unlinkSync(copiedConfig)
  }

  // __APP_NAME__ / __APP_SLUG__ placeholders (package names, window titles, bundle ids)
  replacePlaceholders(projectPath, { __APP_NAME__: name, __APP_SLUG__: slug })

  // Create .apphub.md
  fs.writeFileSync(
    path.join(projectPath, APPHUB_META_FILE),
    defaultProjectMeta(name, slug, templateSlug),
  )

  // CLAUDE.md: keep a template's own file and append the hub section —
  // overwriting it threw away the template's stack-specific guidance
  const claudeMdPath = path.join(projectPath, 'CLAUDE.md')
  if (fs.existsSync(claudeMdPath)) {
    const own = fs.readFileSync(claudeMdPath, 'utf-8').trimEnd()
    fs.writeFileSync(claudeMdPath, `${own}\n\n${hubClaudeSection(slug)}`)
  } else {
    fs.writeFileSync(claudeMdPath, defaultClaudeMd(name, slug, templateSlug))
  }

  // LF everywhere from the first commit (Windows + macOS checkouts)
  const gitattributes = path.join(projectPath, '.gitattributes')
  if (!fs.existsSync(gitattributes)) fs.writeFileSync(gitattributes, DEFAULT_GITATTRIBUTES)
  const gitignore = path.join(projectPath, '.gitignore')
  if (!fs.existsSync(gitignore)) fs.writeFileSync(gitignore, DEFAULT_GITIGNORE)

  // Create docs/ directory
  const docsDir = path.join(projectPath, DOCS_DIR)
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true })
    fs.writeFileSync(path.join(docsDir, '.gitkeep'), '')
  }

  // Initialize git
  await execAsync('git init', { cwd: projectPath })

  // Post-create hooks are best effort: a failing install must not lose the
  // scaffold. Failures come back as warnings.
  const warnings: string[] = []
  const hooks = Array.isArray(template.postCreate)
    ? template.postCreate
    : template.postCreate
      ? [template.postCreate]
      : []
  for (const cmd of hooks) {
    try {
      // generous maxBuffer: npm install / cargo fetch logs blow the 1 MB default
      await execAsync(cmd, { cwd: projectPath, timeout: 15 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 })
    } catch (err) {
      const msg = err instanceof Error ? err.message.split('\n')[0] : String(err)
      warnings.push(`postCreate "${cmd}" failed: ${msg}`)
    }
  }

  // Initial commit — worktrees branch from HEAD, so a repo without commits
  // cannot take board tasks. Doubles as the first logbook entry.
  try {
    await execFileAsync('git', ['add', '-A'], { cwd: projectPath })
    await execFileAsync(
      'git',
      [
        'commit',
        '-q',
        '-m',
        `chore: scaffold ${name} from the ${templateSlug} template`,
        '-m',
        `Created by App Hub from templates/${templateSlug}: .apphub.md, CLAUDE.md, .gitattributes, .gitignore, docs/.` +
          (hooks.length ? ` postCreate: ${hooks.join(' && ')}${warnings.length ? ' (with warnings)' : ''}.` : ''),
      ],
      { cwd: projectPath },
    )
  } catch (err) {
    warnings.push(`initial commit failed (git user.name/email set?): ${err instanceof Error ? err.message.split('\n')[0] : err}`)
  }

  return { slug, path: projectPath, warnings }
}
