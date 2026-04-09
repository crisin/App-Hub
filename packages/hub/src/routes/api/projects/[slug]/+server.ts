import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { APPHUB_META_FILE } from '@apphub/shared';
import { logger } from '$lib/server/logger';

/** GET /api/projects/:slug — get a single project */
export const GET: RequestHandler = async ({ params }) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE slug = ?').get(params.slug) as any;

  if (!project) {
    return json({ ok: false, error: 'Project not found' }, { status: 404 });
  }

  project.tags = JSON.parse(project.tags || '[]');

  // Item counts from the items table
  const counts = db
    .prepare(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN stage = 'done' THEN 1 ELSE 0 END) as done
       FROM items WHERE project_slug = ?`,
    )
    .get(params.slug) as { total: number; done: number } | undefined;
  project.itemSummary = counts ?? { total: 0, done: 0 };

  return json({ ok: true, data: project });
};

/** DELETE /api/projects/:slug — delete a project */
export const DELETE: RequestHandler = async ({ params }) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE slug = ?').get(params.slug) as any;

  if (!project) {
    return json({ ok: false, error: 'Project not found' }, { status: 404 });
  }

  // Remove project directory from disk
  if (project.path && fs.existsSync(project.path)) {
    fs.rmSync(project.path, { recursive: true, force: true });
  }

  // Remove from SQLite (tasks cascade via FK)
  db.prepare('DELETE FROM projects WHERE slug = ?').run(params.slug);

  logger.info('project', 'project.deleted', `Deleted project "${project.name}" (${params.slug})`, {
    slug: params.slug,
  });

  return json({ ok: true, data: { slug: params.slug } });
};

/** PATCH /api/projects/:slug — update project metadata */
export const PATCH: RequestHandler = async ({ params, request }) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE slug = ?').get(params.slug) as any;

  if (!project) {
    return json({ ok: false, error: 'Project not found' }, { status: 404 });
  }

  const updates = await request.json();
  const now = new Date().toISOString();

  // Update the .apphub.md file
  const metaPath = path.join(project.path, APPHUB_META_FILE);
  if (fs.existsSync(metaPath)) {
    const content = fs.readFileSync(metaPath, 'utf-8');
    const parsed = matter(content);
    Object.assign(parsed.data, updates, { updated: now });
    const newContent = matter.stringify(parsed.content, parsed.data);
    fs.writeFileSync(metaPath, newContent);
  }

  // Update SQLite
  const fields = Object.keys(updates)
    .filter(k => ['name', 'description', 'context', 'status', 'tags'].includes(k))
    .map(k => `${k} = @${k}`)
    .join(', ');

  if (fields) {
    const updateData: any = { ...updates, slug: params.slug, updated: now };
    if (updateData.tags && Array.isArray(updateData.tags)) {
      updateData.tags = JSON.stringify(updateData.tags);
    }
    db.prepare(`UPDATE projects SET ${fields}, updated = @updated WHERE slug = @slug`).run(updateData);
  }

  logger.info('project', 'project.updated', `Updated project "${params.slug}"`, {
    slug: params.slug, fields: Object.keys(updates),
  });

  return json({ ok: true, data: { slug: params.slug, ...updates } });
};
