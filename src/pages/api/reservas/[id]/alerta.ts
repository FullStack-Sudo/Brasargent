import type { APIRoute } from 'astro';
import { marcarAlertaEnviada } from '../../../../lib/queries/reservas';

export const POST: APIRoute = async ({ params, request }) => {
    const { id } = params;
    if (!id) return new Response(null, { status: 400 });
    try {
        const body = await request.json();
        const { alerta_enviada, notificacion_enviada } = body;
        await marcarAlertaEnviada(parseInt(id), alerta_enviada, notificacion_enviada);
        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch(e) {
        return new Response(JSON.stringify({ error: 'Error' }), { status: 400 });
    }
};
