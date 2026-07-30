import type { APIRoute } from 'astro';
import { query } from '../../../lib/db';

export const GET: APIRoute = async () => {
    try {
        // Obtener total de visitas únicas
        const [totalResult] = await query(
            'SELECT COUNT(*) as total FROM visitas_ip'
        ) as any[];
        const total = totalResult?.[0]?.total || 0;

        // 🔴 Obtener visitas de hoy
        const [hoyResult] = await query(
            "SELECT COUNT(*) as hoy FROM visitas_ip WHERE DATE(fecha_visita) = CURDATE()"
        ) as any[];
        const hoy = hoyResult?.[0]?.hoy || 0;

        // 🔴 Obtener visitas de la última semana
        const [semanaResult] = await query(
            "SELECT COUNT(*) as semana FROM visitas_ip WHERE fecha_visita >= DATE_SUB(NOW(), INTERVAL 7 DAY)"
        ) as any[];
        const semana = semanaResult?.[0]?.semana || 0;

        return new Response(JSON.stringify({
            success: true,
            total,
            hoy,
            semana
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
        });

    } catch (error: any) {
        console.error('Error al obtener estadísticas de visitas:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al obtener estadísticas'
        }), { status: 500 });
    }
};
