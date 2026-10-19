import type { APIRoute } from 'astro';
import { getCategorias, crearCategoria, actualizarCategoria, eliminarCategoria } from '../../../../lib/queries/menu';

const json = (body: any, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// /api/menu es público en el middleware, por eso la sesión se valida aquí.
const autenticado = (cookies: any) => cookies.get('session')?.value === 'authenticated';

export const GET: APIRoute = async ({ cookies }) => {
    if (!autenticado(cookies)) return json({ success: false, message: 'No autorizado' }, 401);
    const data = await getCategorias();
    return json({ success: true, data });
};

export const POST: APIRoute = async ({ request, cookies }) => {
    if (!autenticado(cookies)) return json({ success: false, message: 'No autorizado' }, 401);
    const body = await request.json().catch(() => ({}));
    const res = await crearCategoria(String(body.nombre ?? ''));
    return json(res, res.success ? 200 : 400);
};

export const PUT: APIRoute = async ({ request, cookies }) => {
    if (!autenticado(cookies)) return json({ success: false, message: 'No autorizado' }, 401);
    const body = await request.json().catch(() => ({}));
    const id = Number(body.id);
    if (!id) return json({ success: false, message: 'ID inválido' }, 400);
    const res = await actualizarCategoria(id, String(body.nombre ?? ''));
    return json(res, res.success ? 200 : 400);
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
    if (!autenticado(cookies)) return json({ success: false, message: 'No autorizado' }, 401);
    const body = await request.json().catch(() => ({}));
    const id = Number(body.id);
    if (!id) return json({ success: false, message: 'ID inválido' }, 400);
    const res = await eliminarCategoria(id);
    return json(res, res.success ? 200 : 400);
};
