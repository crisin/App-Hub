import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProjectsFromDb, syncProjects } from '$lib/server/scanner';
import { createProject } from '$lib/server/templates';
import { seedDefaultPhases } from '$lib/server/data';
import { getDb } from '$lib/server/db';
import { logger } from '$lib/server/logger';

/** GET /api/projects — list all projects */
export const GET: RequestHandler = async ({ url }) => {
  const fresh = url.searchParams.get('sync') === 'true';
  const projects = fresh ? syncProjects() : getProjectsFromDb();

  // Attach item counts from the items table
  const db = getDb();
  const itemCounts = db
    .prepare(
      `SELECT project_slug, COUNT(*) as total,
              SUM(CASE WHEN stage = 'done' THEN 1 ELSE 0 END) as done
       FROM items GROUP BY project_slug`,
    )
    .all() as { project_slug: string; total: number; done: number }[];

  const countMap = new Map(itemCounts.map((r) => [r.project_slug, { total: r.total, done: r.done }]));

  const projectsWithCounts = projects.map((p) => ({
    ...p,
    itemSummary: countMap.get(p.slug) ?? { total: 0, done: 0 },
  }));

  return json({ ok: true, data: projectsWithCounts });
};

/** POST /api/projects — create a new project */
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { name, template } = body;

  if (!name || !template) {
    return json({ ok: false, error: 'name and template are required' }, { status: 400 });
  }

  try {
    const result = await createProject(name, template);
    // Sync to pick up the new project
    syncProjects();
    // Seed default phases for the new project
    seedDefaultPhases(result.slug);
    logger.info('project', 'project.created', `Created project "${name}" from template "${template}"`, {
      slug: result.slug, template,
    });
    return json({ ok: true, data: result }, { status: 201 });
  } catch (err: any) {
    logger.error('project', 'project.create_failed', `Failed to create project "${name}": ${err.message}`, {
      template, error: err.message,
    });
    return json({ ok: false, error: err.message }, { status: 400 });
  }
};
