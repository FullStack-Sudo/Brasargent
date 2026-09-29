import type { APIRoute } from 'astro';
import { query } from '../../../lib/db';

export const GET: APIRoute = async ({ url, cookies }) => {
    try {
        const session = cookies.get('session');
        if (!session || session.value !== 'authenticated') {
            return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), { status: 401 });
        }

        const sucursalIdParam = url.searchParams.get('sucursal_id');
        const sucursalId = sucursalIdParam ? parseInt(sucursalIdParam, 10) : 0;

        let sql = `
            SELECT 
                df.id, 
                df.sucursal_id, 
                DATE_FORMAT(df.fecha, '%Y-%m-%d') AS fecha, 
                df.descripcion, 
                df.sin_reservas, 
                s.nombre AS sucursal_nombre 
            FROM dias_festivos df 
            LEFT JOIN sucursales s ON df.sucursal_id = s.id
        `;
        const params: any[] = [];

        if (sucursalId > 0) {
            sql += ` WHERE df.sucursal_id = ?`;
            params.push(sucursalId);
        }

        sql += ` ORDER BY df.fecha ASC`;

        const [festivos] = await query(sql, params) as any[];

        return new Response(JSON.stringify({ success: true, data: festivos || [] }), { status: 200 });
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
