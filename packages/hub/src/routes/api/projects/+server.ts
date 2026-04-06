import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProjectsFromDb, syncProjects } from '$lib/server/scanner';
import { createProject } from '$lib/server/templates';
import { logger } from '$lib/server/logger';

/** GET /api/projects — list all projects */
export const GET: RequestHandler = async ({ url }) => {
  const fresh = url.searchParams.get('sync') === 'true';
  const projects = fresh ? syncProjects() : getProjectsFromDb();
  return json({ ok: true, data: projects });
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
