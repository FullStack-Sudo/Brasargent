import type { APIRoute } from 'astro';
import { query } from '../../lib/db';

// 🔴 Obtener IP real del visitante con prioridad Nginx -> Proxy -> Cloudflare -> Fallback
function getClientIP(request: Request): string {
    const headers = request.headers;
    const realIp = headers.get('x-real-ip');
    const forwarded = headers.get('x-forwarded-for');
    const cfConnectingIp = headers.get('cf-connecting-ip');
    
    // Prioridad especificada: x-real-ip -> x-forwarded-for -> cf-connecting-ip -> fallback
    if (realIp && realIp.trim()) return realIp.trim();
    if (forwarded && forwarded.trim()) return forwarded.split(',')[0].trim();
    if (cfConnectingIp && cfConnectingIp.trim()) return cfConnectingIp.trim();
    return '127.0.0.1';
}

// 🔴 GET - Registrar cada visita al sitio (con protección anti-spam de 30s por IP)
export const GET: APIRoute = async ({ request }) => {
    try {
        const clientIP = getClientIP(request);
        const userAgent = request.headers.get('user-agent') || '';
        
        // 🔴 Anti-spam: Verificar si la misma IP registró una visita en los últimos 30 segundos
        const [recentRows] = await query(
            'SELECT COUNT(*) as recents FROM visitas_ip WHERE ip_address = ? AND fecha_visita > NOW() - INTERVAL 30 SECOND',
            [clientIP]
        ) as any[];

        const isRecent = (recentRows?.[0]?.recents || 0) > 0;
        let registrado = false;

        if (!isRecent) {
            // Registrar nueva visita
            await query(
                'INSERT INTO visitas_ip (ip_address, user_agent) VALUES (?, ?)',
                [clientIP, userAgent]
            );
            registrado = true;
        }

        // 🔴 Consultas de métricas estadísticas (sin modificar estructura de la tabla)
        const [totalRows] = await query('SELECT COUNT(*) as total FROM visitas_ip') as any[];
        const totalVisitas = totalRows?.[0]?.total || 0;

        const [unicasRows] = await query('SELECT COUNT(DISTINCT ip_address) as unicas FROM visitas_ip') as any[];
        const visitasUnicas = unicasRows?.[0]?.unicas || 0;

        const [hoyRows] = await query('SELECT COUNT(*) as hoy FROM visitas_ip WHERE DATE(fecha_visita) = CURDATE()') as any[];
        const visitasHoy = hoyRows?.[0]?.hoy || 0;

        const [semanaRows] = await query('SELECT COUNT(*) as semana FROM visitas_ip WHERE fecha_visita >= NOW() - INTERVAL 7 DAY') as any[];
        const visitasSemana = semanaRows?.[0]?.semana || 0;

        return new Response(JSON.stringify({
            success: true,
            total: totalVisitas,
            unicas: visitasUnicas,
            hoy: visitasHoy,
            semana: visitasSemana,
            registrado,
            ip: clientIP
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
        });

    } catch (error: any) {
        console.error('Error en endpoint de visitas (/api/visitas):', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al procesar la visita'
        }), { status: 500 });
    }
};
