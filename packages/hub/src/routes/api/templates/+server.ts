import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listTemplates } from '$lib/server/templates';

/** GET /api/templates — list available templates */
export const GET: RequestHandler = async () => {
  const templates = listTemplates();
  return json({ ok: true, data: templates });
};
