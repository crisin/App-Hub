import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import fs from 'node:fs';
import path from 'node:path';
import { TASKS_FILE } from '@apphub/shared';
import { parseTasks, serializeTasks } from '$lib/server/parser';
import type { Task, TaskStatus, TaskPriority } from '@apphub/shared';

/** GET /api/projects/:slug/tasks — list tasks for a project */
export const GET: RequestHandler = async ({ params }) => {
  const db = getDb();
  const tasks = db.prepare('SELECT * FROM tasks WHERE project = ? ORDER BY created').all(params.slug);
  return json({ ok: true, data: tasks });
};

/** POST /api/projects/:slug/tasks — add a task */
export const POST: RequestHandler = async ({ params, request }) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE slug = ?').get(params.slug) as any;

  if (!project) {
    return json({ ok: false, error: 'Project not found' }, { status: 404 });
  }

  const body = await request.json();
  const now = new Date().toISOString();
  const task: Task = {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: body.title,
    status: (body.status as TaskStatus) ?? 'todo',
    priority: (body.priority as TaskPriority) ?? 'medium',
    description: body.description ?? '',
    created: now,
    updated: now,
  };

  // Insert into SQLite
  db.prepare(`
    INSERT INTO tasks (id, project, title, status, priority, description, created, updated)
    VALUES (@id, @project, @title, @status, @priority, @description, @created, @updated)
  `).run({ ...task, project: params.slug });

  // Update TASKS.md
  const tasksPath = path.join(project.path, TASKS_FILE);
  const allTasks = db.prepare('SELECT * FROM tasks WHERE project = ?').all(params.slug) as Task[];
  fs.writeFileSync(tasksPath, serializeTasks(allTasks, project.name));

  return json({ ok: true, data: task }, { status: 201 });
};

/** PATCH /api/projects/:slug/tasks — update a task (body must include id) */
export const PATCH: RequestHandler = async ({ params, request }) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE slug = ?').get(params.slug) as any;
  if (!project) return json({ ok: false, error: 'Project not found' }, { status: 404 });

  const body = await request.json();
  if (!body.id) return json({ ok: false, error: 'Task id is required' }, { status: 400 });

  const now = new Date().toISOString();
  const fields = Object.keys(body)
    .filter(k => ['title', 'status', 'priority', 'description'].includes(k))
    .map(k => `${k} = @${k}`)
    .join(', ');

  if (fields) {
    db.prepare(`UPDATE tasks SET ${fields}, updated = @updated WHERE id = @id AND project = @project`)
      .run({ ...body, updated: now, project: params.slug });
  }

  // Rewrite TASKS.md
  const allTasks = db.prepare('SELECT * FROM tasks WHERE project = ?').all(params.slug) as Task[];
  const tasksPath = path.join(project.path, TASKS_FILE);
  fs.writeFileSync(tasksPath, serializeTasks(allTasks, project.name));

  return json({ ok: true, data: { ...body, updated: now } });
};
