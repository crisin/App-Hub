/**
 * kosmos — the hub reads the knowledge vault and draws it as one graph.
 *
 * kosmos is an Obsidian vault of markdown files; its `werkstatt/` folder (a
 * repo of its own) is the cross-project memory for coding agents: playbooks,
 * decisions, conventions, plans. The hub is a reader, never a source — nothing
 * in here writes into kosmos.
 *
 * What is read:
 *   - werkstatt/  — every markdown page that has a `type` in its frontmatter
 *   - projekte/   — the vault's one-page-per-project notes (frontmatter + body)
 * Nothing else of the vault (eingang/, ideen/, wissen/, quellen/) is touched.
 *
 * Edges come from data that is already explicit in the files:
 *   projects: [...]      page → project      (concerns)
 *   topics: [...]        page → topic        (topics that at least two pages share)
 *   [text](other.md)     page → page         (link), also [[wikilinks]]
 *   "ersetzt durch 004"  decision → decision (supersedes)
 *   verbindungen: [...]  project → project   (data flow)
 *   bausteine: [...]     shared building blocks that have no playbook yet
 *
 * Projects are the union of kosmos and the hub's own registry, joined by
 * repository first and by slug second.
 */
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { Marked } from 'marked'
import { HUB_ROOT, KOSMOS_DIR_ENV } from './config.js'
import { readLocalConfig, writeLocalConfig } from './local-config.js'
import { getDb } from './db.js'
import { getProjectsFromDb, normalizeRepoUrl, projectLocation } from './scanner.js'
import type { ProjectRow } from './scanner.js'

// ── Location ────────────────────────────────────────────────────────

export interface KosmosLocation {
  /** Configured path, absolute — null when nothing is configured */
  path: string | null
  /** Where the path comes from: APPHUB_KOSMOS_DIR, apphub.local.json, or nowhere */
  source: 'env' | 'local' | 'none'
  exists: boolean
  /** 'vault' = Obsidian vault with werkstatt/ inside; 'werkstatt' = a bare werkstatt clone */
  layout: 'vault' | 'werkstatt' | null
}

function isDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory()
  } catch {
    return false
  }
}

export function getKosmosLocation(): KosmosLocation {
  const local = readLocalConfig().kosmos
  const configured = KOSMOS_DIR_ENV ?? (local ? path.resolve(HUB_ROOT, local) : null)
  if (!configured) return { path: null, source: 'none', exists: false, layout: null }
  const exists = isDir(configured)
  return {
    path: configured,
    source: KOSMOS_DIR_ENV ? 'env' : 'local',
    exists,
    layout: !exists ? null : isDir(path.join(configured, 'werkstatt')) ? 'vault' : 'werkstatt',
  }
}

/** Store the kosmos path in apphub.local.json; null or '' removes it. Throws on a bad path. */
export function setKosmosPath(rawPath: string | null): KosmosLocation {
  const config = readLocalConfig()
  if (!rawPath) {
    delete config.kosmos
  } else {
    const abs = path.resolve(rawPath)
    if (!isDir(abs)) throw new Error(`Not a directory: ${abs}`)
    config.kosmos = abs
  }
  writeLocalConfig(config)
  return getKosmosLocation()
}

// ── Pages ───────────────────────────────────────────────────────────

/** Vault folders the hub may read besides werkstatt/ — everything else stays private */
const VAULT_FOLDERS = ['projekte']

const PAGE_TYPES = ['playbook', 'entscheidung', 'konvention', 'plan', 'uebersicht'] as const
type PageType = (typeof PAGE_TYPES)[number] | 'seite'

interface Page {
  /** Path relative to the kosmos root, forward slashes — the page's id */
  id: string
  abs: string
  area: 'werkstatt' | 'vault'
  data: Record<string, unknown>
  body: string
  title: string
  type: PageType
  topics: string[]
  projects: string[]
  summary: string
  updated: string
}

function toPosix(p: string): string {
  return p.split(path.sep).join('/')
}

function walkMarkdown(dir: string): string[] {
  if (!isDir(dir)) return []
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walkMarkdown(full))
    else if (entry.name.endsWith('.md')) out.push(full)
  }
  return out
}

/** `[a, b]`, or `a, b` as one string → trimmed, lower-cased, de-duplicated */
function strList(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  return [...new Set(raw.map((v) => String(v).trim().toLowerCase()).filter(Boolean))]
}

/** YAML turns `2026-11-10` into a Date — give it back as a plain day */
function dayString(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return typeof value === 'string' ? value : ''
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function firstHeading(body: string): string {
  return body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? ''
}

function readPage(root: string, abs: string, area: Page['area']): Page {
  const parsed = matter(fs.readFileSync(abs, 'utf-8'))
  const data = parsed.data as Record<string, unknown>
  const declared = text(data.type).toLowerCase()
  return {
    id: toPosix(path.relative(root, abs)),
    abs,
    area,
    data,
    body: parsed.content,
    title: text(data.title) || firstHeading(parsed.content) || path.basename(abs, '.md'),
    type: (PAGE_TYPES as readonly string[]).includes(declared) ? (declared as PageType) : 'seite',
    topics: strList(data.topics),
    projects: strList(data.projects),
    summary: text(data.summary),
    updated: dayString(data.updated),
  }
}

/**
 * All pages the hub may read. Werkstatt pages need a `type` in their
 * frontmatter (that skips CLAUDE.md and the copy templates); vault pages are
 * the direct children of the allowed folders.
 */
function scanPages(loc: KosmosLocation): Page[] {
  if (!loc.path || !loc.exists) return []
  const root = loc.path
  const werkstattDir = loc.layout === 'vault' ? path.join(root, 'werkstatt') : root

  const pages = walkMarkdown(werkstattDir)
    .map((abs) => readPage(root, abs, 'werkstatt'))
    .filter((p) => text(p.data.type) !== '')

  if (loc.layout === 'vault') {
    for (const folder of VAULT_FOLDERS) {
      const dir = path.join(root, folder)
      if (!isDir(dir)) continue
      for (const name of fs.readdirSync(dir).sort()) {
        if (name.endsWith('.md')) pages.push(readPage(root, path.join(dir, name), 'vault'))
      }
    }
  }
  return pages
}

// ── Links ───────────────────────────────────────────────────────────

/** Fenced and inline code would yield links that are only examples */
function stripCode(body: string): string {
  return body.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '')
}

/** Page ids a page links to — relative markdown links and [[wikilinks]] */
function linkedPageIds(page: Page, byId: Map<string, Page>): string[] {
  const body = stripCode(page.body)
  const found = new Set<string>()
  const dir = path.posix.dirname(page.id)

  for (const m of body.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    let href = m[1].split('#')[0].split('?')[0]
    if (!href || /^[a-z][a-z0-9+.-]*:/i.test(href)) continue
    try {
      href = decodeURIComponent(href)
    } catch {
      // keep the raw href
    }
    const target = href.startsWith('/')
      ? path.posix.normalize(href.slice(1))
      : path.posix.normalize(path.posix.join(dir, href))
    if (byId.has(target)) found.add(target)
  }

  for (const m of body.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)) {
    const name = m[1].trim().replace(/\.md$/, '')
    const direct = `${name}.md`
    if (byId.has(direct)) {
      found.add(direct)
      continue
    }
    // Obsidian resolves a bare [[name]] by file name anywhere in the vault
    const base = path.posix.basename(name)
    const hit = [...byId.keys()].find((id) => path.posix.basename(id, '.md') === base)
    if (hit) found.add(hit)
  }

  found.delete(page.id)
  return [...found]
}

// ── Projects ────────────────────────────────────────────────────────

/** "crisin/App-Hub", a GitHub URL or an ssh remote → "crisin/app-hub"; '' for "keins" and the like */
function repoKey(raw: string): string {
  const value = raw.trim()
  if (/^[\w.-]+\/[\w.-]+$/.test(value)) return value.replace(/\.git$/, '').toLowerCase()
  const url = normalizeRepoUrl(value)
  return url ? url.replace(/^https:\/\/(www\.)?github\.com\//, '').toLowerCase() : ''
}

function repoUrl(raw: string): string {
  const value = raw.trim()
  if (/^[\w.-]+\/[\w.-]+$/.test(value)) return `https://github.com/${value}`
  return normalizeRepoUrl(value)
}

interface Project {
  slug: string
  name: string
  /** Repositories as written in kosmos or reported by the hub */
  repos: string[]
  /** The vault's projekte/<slug>.md, if there is one */
  page?: Page
  hub?: ProjectRow
}

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}

/** Board items per hub project: open (everything not done) and done */
function boardCounts(): Map<string, { open: number; done: number }> {
  const counts = new Map<string, { open: number; done: number }>()
  try {
    const rows = getDb()
      .prepare('SELECT project_slug, stage, COUNT(*) AS n FROM items GROUP BY project_slug, stage')
      .all() as { project_slug: string; stage: string; n: number }[]
    for (const row of rows) {
      const entry = counts.get(row.project_slug) ?? { open: 0, done: 0 }
      if (row.stage === 'done') entry.done += row.n
      else entry.open += row.n
      counts.set(row.project_slug, entry)
    }
  } catch {
    // no index yet — the map still works without board numbers
  }
  return counts
}

// ── Graph ───────────────────────────────────────────────────────────

export type KosmosNodeType = 'projekt' | PageType | 'baustein' | 'thema'
export type KosmosEdgeType = 'betrifft' | 'betrifft-alle' | 'thema' | 'link' | 'ersetzt' | 'verbindung'

export interface KosmosDetail {
  key: string
  value: string
}

export interface KosmosNode {
  id: string
  label: string
  type: KosmosNodeType
  meta: {
    /** Page path inside kosmos, or the project's path on disk */
    path?: string
    description?: string
    tags?: string[]
    details?: KosmosDetail[]
    /** Repository link (projects) */
    url?: string
    /** Page that can be opened in the reader */
    pageId?: string
  }
}

export interface KosmosEdge {
  source: string
  target: string
  type: KosmosEdgeType
  label?: string
}

export interface KosmosGraph {
  nodes: KosmosNode[]
  edges: KosmosEdge[]
  stats: { projects: number; pages: number; topics: number; blocks: number; edges: number }
}

const pageNode = (id: string) => `page:${id}`
const projectNode = (slug: string) => `project:${slug}`
const topicNode = (name: string) => `topic:${name}`
const blockNode = (slug: string) => `block:${slug}`

/** A page lists "everything" when it names at least this share of all referenced projects */
const ALL_PROJECTS_SHARE = 0.8

export function buildKosmosGraph(loc: KosmosLocation = getKosmosLocation()): KosmosGraph {
  const pages = scanPages(loc)
  const byId = new Map(pages.map((p) => [p.id, p]))
  const werkstattPages = pages.filter((p) => p.area === 'werkstatt')
  const projectPages = pages.filter((p) => p.area === 'vault')

  const nodes: KosmosNode[] = []
  const edges: KosmosEdge[] = []
  const edgeKeys = new Set<string>()
  const addEdge = (edge: KosmosEdge) => {
    if (edge.source === edge.target) return
    const key = `${edge.source}→${edge.target}→${edge.type}`
    if (edgeKeys.has(key)) return
    edgeKeys.add(key)
    edges.push(edge)
  }

  // ── Projects: kosmos pages, frontmatter references, hub registry ──
  const projects = new Map<string, Project>()
  const ensureProject = (slug: string): Project => {
    let project = projects.get(slug)
    if (!project) {
      project = { slug, name: slug, repos: [] }
      projects.set(slug, project)
    }
    return project
  }

  for (const page of projectPages) {
    const project = ensureProject(path.posix.basename(page.id, '.md').toLowerCase())
    project.page = page
    project.name = page.title
    project.repos = text(page.data.repo)
      .split(',')
      .map((r) => r.trim())
      .filter((r) => repoKey(r) !== '')
  }

  for (const page of werkstattPages) page.projects.forEach(ensureProject)

  interface Connection { von: string; nach: string; was: string }
  interface Block { name: string; projects: string[]; page: Page }
  const connections: Connection[] = []
  const blocks: Block[] = []
  for (const page of werkstattPages) {
    for (const entry of Array.isArray(page.data.verbindungen) ? page.data.verbindungen : []) {
      const von = text(entry?.von).toLowerCase()
      const nach = text(entry?.nach).toLowerCase()
      if (von && nach) connections.push({ von, nach, was: text(entry?.was) })
    }
    for (const entry of Array.isArray(page.data.bausteine) ? page.data.bausteine : []) {
      const name = text(entry?.name)
      if (name) blocks.push({ name, projects: strList(entry?.projects), page })
    }
  }
  connections.forEach((c) => [c.von, c.nach].forEach(ensureProject))
  blocks.forEach((b) => b.projects.forEach(ensureProject))

  let hubProjects: ProjectRow[] = []
  try {
    hubProjects = getProjectsFromDb()
  } catch {
    // no index yet — kosmos alone still makes a map
  }
  for (const row of hubProjects) {
    const key = repoKey(row.repo ?? '')
    const match =
      (key ? [...projects.values()].find((p) => p.repos.some((r) => repoKey(r) === key)) : undefined) ??
      projects.get(row.slug)
    const project = match ?? ensureProject(row.slug)
    if (project.hub) continue // first hub project wins; a second one with the same repo stays unlinked
    project.hub = row
    if (!project.page) project.name = row.name
    if (project.repos.length === 0 && row.repo) project.repos = [row.repo]
  }

  const counts = boardCounts()
  for (const project of projects.values()) {
    const details: KosmosDetail[] = []
    const data = project.page?.data ?? {}
    if (text(data.status)) details.push({ key: 'Status', value: text(data.status) })
    if (text(data.bereich)) details.push({ key: 'Area', value: text(data.bereich) })
    if (text(data.naechster_schritt)) details.push({ key: 'Next step', value: text(data.naechster_schritt) })
    if (project.repos.length) details.push({ key: 'Repo', value: project.repos.join(', ') })
    if (project.hub) {
      details.push({ key: 'Hub project', value: `${project.hub.slug} (${projectLocation(project.hub.path)})` })
      const board = counts.get(project.hub.slug)
      if (board) details.push({ key: 'Board', value: `${board.open} open · ${board.done} done` })
    }
    details.push({
      key: 'Known to',
      value: [project.page ? 'kosmos' : '', project.hub ? 'hub' : ''].filter(Boolean).join(' + ') || 'references only',
    })

    nodes.push({
      id: projectNode(project.slug),
      label: project.name,
      type: 'projekt',
      meta: {
        path: project.hub?.path ?? project.page?.id,
        description: project.hub?.description || undefined,
        details,
        url: project.repos.map(repoUrl).find(Boolean),
        pageId: project.page?.id,
      },
    })
  }

  // ── Pages ─────────────────────────────────────────────────────────
  const referenced = new Set(werkstattPages.flatMap((p) => p.projects))
  // A topic becomes a node once two pages share it — used once, it connects
  // nothing and stays a chip on its page.
  const topicUse = new Map<string, number>()
  for (const page of werkstattPages) page.topics.forEach((t) => topicUse.set(t, (topicUse.get(t) ?? 0) + 1))
  const topics = new Map([...topicUse].filter(([, pageCount]) => pageCount >= 2))

  for (const page of werkstattPages) {
    const concernsAll = page.projects.length >= 4 && page.projects.length >= referenced.size * ALL_PROJECTS_SHARE
    const status = page.type === 'entscheidung' ? (page.body.match(/^Status:\s*(.+)$/m)?.[1]?.trim() ?? '') : ''

    const details: KosmosDetail[] = []
    if (status) details.push({ key: 'Status', value: status })
    if (page.projects.length) {
      details.push({ key: 'Concerns', value: concernsAll ? 'all projects' : page.projects.join(', ') })
    }
    if (page.updated) details.push({ key: 'Updated', value: page.updated })

    nodes.push({
      id: pageNode(page.id),
      label: page.title,
      type: page.type,
      meta: { path: page.id, description: page.summary || undefined, tags: page.topics, details, pageId: page.id },
    })

    for (const slug of page.projects) {
      addEdge({ source: pageNode(page.id), target: projectNode(slug), type: concernsAll ? 'betrifft-alle' : 'betrifft' })
    }
    for (const topic of page.topics) {
      if (topics.has(topic)) addEdge({ source: pageNode(page.id), target: topicNode(topic), type: 'thema' })
    }

    // "ersetzt durch 004" on this page, "Ersetzt aus 001 …" on the newer one
    if (status) {
      const sibling = (number: string) =>
        werkstattPages.find(
          (p) => path.posix.dirname(p.id) === path.posix.dirname(page.id) && path.posix.basename(p.id).startsWith(`${number}-`),
        )
      for (const m of status.matchAll(/ersetzt durch (\d{3})/gi)) {
        const newer = sibling(m[1])
        if (newer) addEdge({ source: pageNode(newer.id), target: pageNode(page.id), type: 'ersetzt', label: 'ersetzt' })
      }
      for (const m of status.matchAll(/ersetzt aus (\d{3})/gi)) {
        const older = sibling(m[1])
        if (older) addEdge({ source: pageNode(page.id), target: pageNode(older.id), type: 'ersetzt', label: 'ersetzt' })
      }
    }
  }

  // Links — a link to a project's vault page points at the project node
  const linkTarget = (id: string) => {
    const target = byId.get(id)!
    return target.area === 'vault' ? projectNode(path.posix.basename(id, '.md').toLowerCase()) : pageNode(id)
  }
  for (const page of pages) {
    const source = linkTarget(page.id)
    for (const id of linkedPageIds(page, byId)) addEdge({ source, target: linkTarget(id), type: 'link' })
  }

  for (const [topic, pageCount] of topics) {
    nodes.push({
      id: topicNode(topic),
      label: topic,
      type: 'thema',
      meta: { details: [{ key: 'Pages', value: String(pageCount) }] },
    })
  }

  // ── Building blocks without a playbook, data flows ────────────────
  for (const block of blocks) {
    const id = blockNode(slugifyName(block.name))
    nodes.push({
      id,
      label: block.name,
      type: 'baustein',
      meta: {
        path: block.page.id,
        description: 'Built more than once, no playbook yet.',
        details: [{ key: 'Built in', value: block.projects.join(', ') }],
        pageId: block.page.id,
      },
    })
    for (const slug of block.projects) addEdge({ source: id, target: projectNode(slug), type: 'betrifft' })
  }
  for (const c of connections) {
    addEdge({ source: projectNode(c.von), target: projectNode(c.nach), type: 'verbindung', label: c.was || undefined })
  }

  return {
    nodes,
    edges,
    stats: {
      projects: projects.size,
      pages: werkstattPages.length,
      topics: topics.size,
      blocks: blocks.length,
      edges: edges.length,
    },
  }
}

// ── Reader ──────────────────────────────────────────────────────────

export interface KosmosPage {
  id: string
  title: string
  type: string
  html: string
}

const markdown = new Marked({ gfm: true })

/** [[target|label]] → a root-relative markdown link the reader can follow */
function wikilinksToMarkdown(body: string): string {
  return body.replace(/\[\[([^\]|#]+)(#[^\]|]*)?(?:\|([^\]]*))?\]\]/g, (_all, target: string, _anchor, label?: string) => {
    const name = target.trim().replace(/\.md$/, '')
    return `[${label?.trim() || name}](/${encodeURI(name)}.md)`
  })
}

/** One page, rendered — only pages the map itself may read (see scanPages) */
export function getKosmosPage(id: string, loc: KosmosLocation = getKosmosLocation()): KosmosPage | null {
  const page = scanPages(loc).find((p) => p.id === id)
  if (!page) return null
  return {
    id: page.id,
    title: page.title,
    type: page.area === 'vault' ? 'projekt' : page.type,
    html: markdown.parse(wikilinksToMarkdown(page.body)) as string,
  }
}
