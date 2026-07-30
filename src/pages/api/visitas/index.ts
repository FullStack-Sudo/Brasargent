import type { APIRoute } from 'astro';
import { query } from '../../../lib/db';

// 🔴 Obtener IP real del visitante (compatible con proxys, Cloudflare y Nginx)
function getClientIP(request: Request): string {
    const headers = request.headers;
    const cfConnectingIp = headers.get('cf-connecting-ip');
    const realIp = headers.get('x-real-ip');
    const forwarded = headers.get('x-forwarded-for');
    
    // Prioridad: Cloudflare → X-Real-IP → X-Forwarded-For → Conexión por defecto
    if (cfConnectingIp) return cfConnectingIp.trim();
    if (realIp) return realIp.trim();
    if (forwarded) return forwarded.split(',')[0].trim();
    return '127.0.0.1';
}

// 🔴 GET - Registrar visita si es única por IP y obtener total de visitas
export const GET: APIRoute = async ({ request }) => {
    try {
        const clientIP = getClientIP(request);
        
        // Verificar si la IP ya existe
        const [existingRows] = await query(
            'SELECT id FROM visitas_ip WHERE ip_address = ?',
            [clientIP]
        ) as any[];

        let esNueva = false;

        if (!existingRows || existingRows.length === 0) {
            // Registrar nueva visita
            const userAgent = request.headers.get('user-agent') || '';
            await query(
                'INSERT INTO visitas_ip (ip_address, user_agent) VALUES (?, ?)',
                [clientIP, userAgent]
            );
            esNueva = true;
        }

        // Obtener total de visitas únicas
        const [resultRows] = await query(
            'SELECT COUNT(*) as total FROM visitas_ip'
        ) as any[];
        const totalVisitas = resultRows?.[0]?.total || 0;

        return new Response(JSON.stringify({
            success: true,
            total: totalVisitas,
            es_nueva: esNueva,
            ip: clientIP
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
        });

    } catch (error: any) {
        console.error('Error en contador de visitas:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al procesar la visita'
        }), { status: 500 });
    }
};
