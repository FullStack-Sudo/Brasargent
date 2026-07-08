import type { APIRoute } from 'astro';
import { actualizarEstadoReserva } from '../../../../lib/queries/reservas';

export const POST: APIRoute = async ({ params, request }) => {
    const { id } = params;
    if (!id) return new Response(null, { status: 400 });
    try {
        const body = await request.json();
        const { estado, motivo } = body;
        await actualizarEstadoReserva(parseInt(id), estado, motivo);
        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch(e) {
        return new Response(JSON.stringify({ error: 'Error' }), { status: 400 });
    }
};
