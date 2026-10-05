#!/usr/bin/env node
/**
 * docs-check — keeps the wiki honest.
 *
 * Walks docs/, and for every markdown file:
 *   - outside history/: requires frontmatter title, section, order, summary;
 *     section must be one of the known panel sections; routes must be a list
 *   - resolves every relative markdown link to an existing file, and every
 *     #anchor to a heading in the target (same slug rule as the help panel)
 *
 * Exit code 1 on any problem, so it fits into a commit's Verified: line.
 *
 *   npm run docs:check
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const docsDir = path.join(root, 'docs')

// Mirrors DOC_SECTIONS in packages/hub/src/lib/server/docs.ts
const SECTIONS = ['Start', 'How-to', 'Concepts', 'Reference', 'Essays', 'Roadmap', 'History']
const REQUIRED = ['title', 'section', 'order', 'summary']

const problems = []
const report = (file, msg) =>
  problems.push(`${path.relative(root, file).split(path.sep).join('/')}: ${msg}`)

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) return walk(full)
    return e.isFile() && e.name.endsWith('.md') ? [full] : []
  })
}

/** Minimal frontmatter reader: `key: value` lines between the first two `---` lines */
function frontmatter(text) {
  if (!text.startsWith('---')) return { data: null, body: text }
  const end = text.indexOf('\n---', 3)
  if (end === -1) return { data: null, body: text }
  const data = {}
  for (const line of text.slice(3, end).split('\n')) {
    const m = line.match(/^([A-Za-z_]+):\s*(.*)$/)
    if (m) data[m[1]] = m[2].trim()
  }
  return { data, body: text.slice(end + 4) }
}

/** Same id rule as the help panel's heading renderer */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
}

function stripCode(body) {
  return body.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '')
}

const headingCache = new Map()
function headings(file) {
  if (!headingCache.has(file)) {
    const { body } = frontmatter(fs.readFileSync(file, 'utf-8'))
    const ids = new Set()
    for (const m of stripCode(body).matchAll(/^#{1,6}\s+(.+?)\s*$/gm)) ids.add(slugify(m[1]))
    headingCache.set(file, ids)
  }
  return headingCache.get(file)
}

const files = walk(docsDir)
for (const file of files) {
  const text = fs.readFileSync(file, 'utf-8')
  const { data, body } = frontmatter(text)
  const rel = path.relative(docsDir, file).split(path.sep).join('/')
  const archived = rel.startsWith('history/')

  if (!archived) {
    if (!data) report(file, 'no frontmatter')
    else {
      for (const key of REQUIRED) if (!data[key]) report(file, `frontmatter: missing "${key}"`)
      if (data.section && !SECTIONS.includes(data.section))
        report(
          file,
          `frontmatter: unknown section "${data.section}" (known: ${SECTIONS.join(', ')})`,
        )
      if (data.order !== undefined && !/^\d+$/.test(data.order))
        report(file, `frontmatter: order must be an integer, got "${data.order}"`)
      if (data.routes !== undefined && !/^\[.*\]$/.test(data.routes))
        report(file, `frontmatter: routes must be a list like ['/board']`)
    }
  }

  // Relative markdown links: [text](path.md#anchor) — skip http(s), mailto, bare anchors
  for (const m of stripCode(body).matchAll(/\]\(([^)\s]+)\)/g)) {
    const href = m[1]
    if (/^(https?:|mailto:)/.test(href)) continue
    const [target, anchor] = href.split('#')
    if (!target) {
      if (anchor && !headings(file).has(anchor))
        report(file, `anchor "#${anchor}" not found in this page`)
      continue
    }
    if (!target.endsWith('.md')) continue // a repo file like CLAUDE.md is fine on GitHub, not checked here
    const resolved = path.resolve(path.dirname(file), decodeURIComponent(target))
    if (!fs.existsSync(resolved)) {
      report(file, `broken link "${href}"`)
      continue
    }
    if (anchor && !headings(resolved).has(anchor))
      report(file, `anchor "${href}" not found in target`)
  }
}

if (problems.length > 0) {
  console.error(`docs-check: ${problems.length} problem(s) in ${files.length} files\n`)
  for (const p of problems) console.error('  ' + p)
  process.exit(1)
}
console.log(`docs-check: ${files.length} files ok`)
