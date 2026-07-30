import type { APIRoute } from 'astro';
import { query } from '../../../lib/db';

export const GET: APIRoute = async ({ url, cookies }) => {
    try {
        const session = cookies.get('session');
        if (!session || session.value !== 'authenticated') {
            return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), { status: 401 });
        }

        const sucursalId = parseInt(url.searchParams.get('sucursal_id') || '0');
        if (!sucursalId) {
            return new Response(JSON.stringify({ success: false, error: 'sucursal_id requerido' }), { status: 400 });
        }

        const [festivos] = await query(
            `SELECT * FROM dias_festivos WHERE sucursal_id = ? ORDER BY fecha ASC`,
            [sucursalId]
        ) as any[];

        return new Response(JSON.stringify({ success: true, data: festivos }), { status: 200 });
    } catch (error: any) {
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
    }
};

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const session = cookies.get('session');
        if (!session || session.value !== 'authenticated') {
            return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), { status: 401 });
        }

        const body = await request.json();
        const { sucursal_id, fecha, descripcion, sin_reservas } = body;

        if (!sucursal_id || !fecha) {
            return new Response(JSON.stringify({ success: false, error: 'sucursal_id y fecha son requeridos' }), { status: 400 });
        }

        await query(`
            INSERT INTO dias_festivos (sucursal_id, fecha, descripcion, sin_reservas)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
            descripcion = VALUES(descripcion),
            sin_reservas = VALUES(sin_reservas);
        `, [sucursal_id, fecha, descripcion || 'Día festivo', sin_reservas ?? true]);

        return new Response(JSON.stringify({ success: true, mensaje: 'Día festivo guardado' }), { status: 200 });
    } catch (error: any) {
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
    }
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
    try {
        const session = cookies.get('session');
        if (!session || session.value !== 'authenticated') {
            return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), { status: 401 });
        }

        const url = new URL(request.url);
        const id = parseInt(url.searchParams.get('id') || '0');

        if (!id) {
            return new Response(JSON.stringify({ success: false, error: 'ID de festivo requerido' }), { status: 400 });
        }

        await query(`DELETE FROM dias_festivos WHERE id = ?`, [id]);

        return new Response(JSON.stringify({ success: true, mensaje: 'Día festivo eliminado' }), { status: 200 });
    } catch (error: any) {
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
    }
};
