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

        const [precios] = await query(
            `SELECT * FROM precios_cubiertos WHERE sucursal_id = ? ORDER BY FIELD(dia_semana, 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'), horario`,
            [sucursalId]
        ) as any[];

        return new Response(JSON.stringify({ success: true, data: precios }), { status: 200 });
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
        const { sucursal_id, dia_semana, horario, precio_adulto, precio_nino } = body;

        if (!sucursal_id || !dia_semana || !horario || precio_adulto === undefined || precio_nino === undefined) {
            return new Response(JSON.stringify({ success: false, error: 'Campos requeridos incompletos' }), { status: 400 });
        }

        await query(`
            INSERT INTO precios_cubiertos (sucursal_id, dia_semana, horario, precio_adulto, precio_nino)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
            precio_adulto = VALUES(precio_adulto),
            precio_nino = VALUES(precio_nino);
        `, [sucursal_id, dia_semana, horario, precio_adulto, precio_nino]);

        return new Response(JSON.stringify({ success: true, mensaje: 'Precio guardado exitosamente' }), { status: 200 });
    } catch (error: any) {
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
    }
};
