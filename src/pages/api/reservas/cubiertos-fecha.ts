import type { APIRoute } from 'astro';
import { query } from '../../../lib/db';

export const GET: APIRoute = async ({ cookies, url, locals }) => {
    try {
        const session = cookies.get('session');
        if (!session || session.value !== 'authenticated') {
            return new Response(JSON.stringify({
                success: false,
                error: 'No autorizado'
            }), { status: 401 });
        }

        const fecha = url.searchParams.get('fecha');
        if (!fecha) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Fecha requerida'
            }), { status: 400 });
        }

        const usuario = locals.usuario;
        const userSucursal = usuario?.sucursal_id || cookies.get('user_sucursal')?.value;
        const esSuperAdmin = usuario?.es_super_admin === true || cookies.get('es_super_admin')?.value === 'true';

        // Helper icono sucursal
        const getIcono = (nombre: string): string => {
            const n = (nombre || '').toLowerCase();
            if (n.includes('churrasquer')) return '🔥';
            if (n.includes('fast')) return '⚡';
            if (n.includes('rodizio')) return '🥩';
            return '📋';
        };

        let sql = `
            SELECT 
                s.id,
                s.nombre,
                s.capacidad_total,
                COALESCE(cf.cubiertos_ocupados, 0) AS cubiertos_ocupados,
                s.capacidad_total - COALESCE(cf.cubiertos_ocupados, 0) AS cubiertos_disponibles
            FROM sucursales s
            LEFT JOIN cubiertos_por_fecha cf ON s.id = cf.sucursal_id AND cf.fecha = ?
            WHERE s.activo = 1
        `;

        const params: any[] = [fecha];

        if (!esSuperAdmin && userSucursal) {
            sql += ` AND s.id = ?`;
            params.push(parseInt(String(userSucursal), 10));
        }

        sql += ` ORDER BY s.nombre`;

        const [cubiertosRows] = await query(sql, params) as any[];
        const cubiertosList = Array.isArray(cubiertosRows) ? cubiertosRows : [];

        const cubiertos = cubiertosList.map((item: any) => ({
            id: item.id,
            nombre: item.nombre,
            icono: getIcono(item.nombre),
            capacidad_total: item.capacidad_total,
            cubiertos_ocupados: item.cubiertos_ocupados,
            cubiertos_disponibles: Math.max(0, item.cubiertos_disponibles)
        }));

        return new Response(JSON.stringify({
            success: true,
            fecha,
            cubiertos
        }), { status: 200 });

    } catch (error: any) {
        console.error('Error en API cubiertos por fecha:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al obtener cubiertos'
        }), { status: 500 });
    }
};
