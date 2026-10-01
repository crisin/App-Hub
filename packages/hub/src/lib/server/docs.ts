/**
 * Docs — the hub's docs/ folder as an in-app wiki.
 *
 * One source for two readers: the markdown files in docs/ are the repo
 * documentation AND the content of the help panel. Frontmatter drives the
 * panel: title, section, order, summary, and `routes` — the UI paths an
 * article explains, so the panel can open the right page in context.
 */
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { Marked } from 'marked'
import { PATHS } from './config.js'

const DOCS_DIR = path.join(PATHS.root, 'docs')

/** GitHub-style heading ids, so #anchors in docs work in the panel too */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
}

const markdown = new Marked({
  gfm: true,
  renderer: {
    heading({ tokens, depth }) {
      const html = this.parser.parseInline(tokens)
      return `<h${depth} id="${slugify(html)}">${html}</h${depth}>\n`
    },
  },
})

/** Panel order of sections; unknown sections sort after these */
export const DOC_SECTIONS = ['Start', 'How-to', 'Concepts', 'Reference', 'Roadmap', 'History']

export interface DocMeta {
  /** path relative to docs/, forward slashes — the doc's id */
  path: string
  title: string
  section: string
  order: number
  summary: string
  routes: string[]
}

export interface DocPage extends DocMeta {
  markdown: string
  html: string
}

function toPosix(p: string): string {
  return p.split(path.sep).join('/')
}

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return walk(full)
    return entry.isFile() && entry.name.endsWith('.md') ? [full] : []
  })
}

function metaFor(file: string): { meta: DocMeta; body: string } {
  const rel = toPosix(path.relative(DOCS_DIR, file))
  const { data, content } = matter(fs.readFileSync(file, 'utf-8'), {})
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim()
  const folder = rel.includes('/') ? rel.split('/')[0] : ''
  return {
    meta: {
      path: rel,
      title: typeof data.title === 'string' ? data.title : (heading ?? path.basename(rel, '.md')),
      // archived files without frontmatter: section from their folder
      section: typeof data.section === 'string' ? data.section : folder === 'history' ? 'History' : 'Start',
      order: typeof data.order === 'number' ? data.order : 99,
      summary: typeof data.summary === 'string' ? data.summary : '',
      routes: Array.isArray(data.routes) ? data.routes.map(String) : [],
    },
    body: content,
  }
}

/** All docs, sorted by section, order, title */
export function listDocs(): DocMeta[] {
  const rank = (s: string) => {
    const i = DOC_SECTIONS.indexOf(s)
    return i === -1 ? DOC_SECTIONS.length : i
  }
  return walk(DOCS_DIR)
    .map((f) => metaFor(f).meta)
    .sort((a, b) => rank(a.section) - rank(b.section) || a.order - b.order || a.title.localeCompare(b.title))
}

/** One doc, rendered. Null for unknown paths or paths escaping docs/. */
export function getDoc(relPath: string): DocPage | null {
  const file = path.resolve(DOCS_DIR, relPath)
  const inside = path.relative(DOCS_DIR, file)
  if (!inside || inside.startsWith('..') || path.isAbsolute(inside) || !file.endsWith('.md')) return null
  if (!fs.existsSync(file)) return null
  const { meta, body } = metaFor(file)
  return { ...meta, markdown: body, html: markdown.parse(body, { async: false }) as string }
}

/** Best doc for a UI path: longest matching `routes` prefix, else the overview */
export function docForRoute(routePath: string, docs = listDocs()): DocMeta | undefined {
  let best: { doc: DocMeta; len: number } | undefined
  for (const doc of docs) {
    for (const route of doc.routes) {
      const match = route === '/' ? routePath === '/' : routePath === route || routePath.startsWith(`${route}/`)
      if (match && (!best || route.length > best.len)) best = { doc, len: route.length }
    }
  }
  return best?.doc ?? docs.find((d) => d.path === 'start/overview.md')
}
