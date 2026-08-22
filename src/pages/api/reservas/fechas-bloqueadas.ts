import type { APIRoute } from 'astro';
import { query } from '../../../lib/db';

export const GET: APIRoute = async ({ url }) => {
    try {
        const sucursalIdParam = url.searchParams.get('sucursal_id');
        const sucursalId = sucursalIdParam ? parseInt(sucursalIdParam, 10) : null;

        let sql = `
            SELECT 
                id,
                sucursal_id,
                DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
                descripcion,
                sin_reservas
            FROM dias_festivos
            WHERE sin_reservas = TRUE
        `;
        const params: any[] = [];

        if (sucursalId) {
            sql += ` AND (sucursal_id = ? OR sucursal_id IS NULL)`;
            params.push(sucursalId);
        }

        sql += ` ORDER BY fecha ASC`;

        const [rows] = await query(sql, params) as any[];

        return new Response(JSON.stringify({
            success: true,
            domingos_deshabilitados: true,
            fechas_bloqueadas: rows || []
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error: any) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al obtener fechas bloqueadas'
        }), { status: 500 });
    }
};
