import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import type { DbProjectRow } from '$lib/server/db';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { APPHUB_META_FILE } from '@apphub/shared';
import { logger } from '$lib/server/logger';
import { projectLocation, unregisterProjectPath, normalizeRepoUrl, syncProjects } from '$lib/server/scanner';
import { YAML_DUMP } from '$lib/server/board-files';

/** GET /api/projects/:slug — get a single project */
export const GET: RequestHandler = async ({ params }) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE slug = ?').get(params.slug) as DbProjectRow | undefined;

  if (!project) {
    return json({ ok: false, error: 'Project not found' }, { status: 404 });
  }

  // Item counts from the items table
  const counts = db
    .prepare(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN stage = 'done' THEN 1 ELSE 0 END) as done
       FROM items WHERE project_slug = ?`,
    )
    .get(params.slug) as { total: number; done: number } | undefined;

  return json({
    ok: true,
    data: {
      ...project,
      tags: JSON.parse(project.tags || '[]'),
      itemSummary: counts ?? { total: 0, done: 0 },
    },
  });
};

/**
 * DELETE /api/projects/:slug — remove a project.
 * What happens on disk depends on where the project lives:
 *   hub      → refused (its path is the hub repo itself)
 *   managed  → inside projects/: the directory is deleted
 *   external → registered path elsewhere: unregistered only, files untouched
 */
export const DELETE: RequestHandler = async ({ params }) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE slug = ?').get(params.slug) as DbProjectRow | undefined;

  if (!project) {
    return json({ ok: false, error: 'Project not found' }, { status: 404 });
  }

  const location = project.path ? projectLocation(project.path) : 'external';
  if (location === 'hub') {
    return json({ ok: false, error: 'The hub project cannot be deleted — its path is the hub repo' }, { status: 400 });
  }

  if (location === 'managed' && fs.existsSync(project.path)) {
    fs.rmSync(project.path, { recursive: true, force: true });
  } else if (location === 'external') {
    unregisterProjectPath(project.path);
  }

  // Drop the project's board from the index too. Its board files went with the
  // directory (managed) or stay in the unregistered repo (external).
  db.transaction(() => {
    const ids = db.prepare('SELECT id FROM items WHERE project_slug = ?').all(params.slug) as { id: string }[];
    for (const { id } of ids) {
      db.prepare('DELETE FROM item_dependencies WHERE item_id = ? OR depends_on_id = ?').run(id, id);
      db.prepare('DELETE FROM claude_notes WHERE issue_id = ?').run(id);
    }
    db.prepare('DELETE FROM items WHERE project_slug = ?').run(params.slug);
    db.prepare('DELETE FROM phases WHERE project_slug = ?').run(params.slug);
    db.prepare('DELETE FROM projects WHERE slug = ?').run(params.slug);
  })();

  logger.info('project', 'project.deleted', `Removed project "${project.name}" (${params.slug}, ${location})`, {
    slug: params.slug,
    location,
    filesDeleted: location === 'managed',
  });

  return json({ ok: true, data: { slug: params.slug, location, filesDeleted: location === 'managed' } });
};

/** PATCH /api/projects/:slug — update project metadata */
export const PATCH: RequestHandler = async ({ params, request }) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE slug = ?').get(params.slug) as DbProjectRow | undefined;

  if (!project) {
    return json({ ok: false, error: 'Project not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const now = new Date().toISOString();

  // Only editable metadata — slug, path, created etc. are not fields to overwrite from outside
  const EDITABLE = ['name', 'description', 'context', 'status', 'tags', 'repo'];
  const unknown = Object.keys(body).filter((k) => !EDITABLE.includes(k));
  if (unknown.length > 0) {
    return json({ ok: false, error: `Not editable: ${unknown.join(', ')} (allowed: ${EDITABLE.join(', ')})` }, { status: 400 });
  }
  const updates: Record<string, unknown> = { ...body };
  if (typeof updates.repo === 'string') {
    const repo = normalizeRepoUrl(updates.repo);
    if (updates.repo.trim() && !repo) {
      return json({ ok: false, error: `Not a http(s) or git@ repository URL: ${updates.repo}` }, { status: 400 });
    }
    updates.repo = repo; // '' clears it → the git remote is used again on next sync
  }

  // Update the .apphub.md file
  const metaPath = path.join(project.path, APPHUB_META_FILE);
  if (fs.existsSync(metaPath)) {
    const content = fs.readFileSync(metaPath, 'utf-8');
    const parsed = matter(content, {});
    Object.assign(parsed.data, updates, { updated: now });
    if (parsed.data.repo === '') delete parsed.data.repo;
    // no line folding: keeps `context: |` blocks literal, diffs stay minimal
    const newContent = matter.stringify(parsed.content, parsed.data, YAML_DUMP);
    fs.writeFileSync(metaPath, newContent);
  }

  // Update SQLite
  const fields = Object.keys(updates)
    .map(k => `${k} = @${k}`)
    .join(', ');

  if (fields) {
    const updateData: any = { ...updates, slug: params.slug, updated: now };
    if (updateData.tags && Array.isArray(updateData.tags)) {
      updateData.tags = JSON.stringify(updateData.tags);
    }
    db.prepare(`UPDATE projects SET ${fields}, updated = @updated WHERE slug = @slug`).run(updateData);
  }

  // A cleared repo falls back to the git remote — re-index so the answer shows the effective value
  if ('repo' in updates) syncProjects();
  const effective = db.prepare('SELECT repo FROM projects WHERE slug = ?').get(params.slug) as { repo: string } | undefined;

  logger.info('project', 'project.updated', `Updated project "${params.slug}"`, {
    slug: params.slug, fields: Object.keys(updates),
  });

  return json({ ok: true, data: { slug: params.slug, ...updates, repo: effective?.repo ?? '' } });
};
