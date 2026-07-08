import type { APIRoute } from 'astro';
import { getReservas, crearReserva, verificarDisponibilidad } from '../../../lib/queries/reservas';

export const GET: APIRoute = async () => {
    const reservas = await getReservas();
    return new Response(JSON.stringify({ data: reservas }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { sucursal_id, fecha, hora, numero_personas } = body;
        
        // Verificar disponibilidad
        const { disponible } = await verificarDisponibilidad(sucursal_id || 1, fecha, hora, numero_personas);
        if (!disponible) {
            return new Response(JSON.stringify({ error: 'No hay capacidad suficiente en la sucursal para esa fecha y hora.' }), { status: 400 });
        }

        const result = await crearReserva(body);
        if (result.success) {
            return new Response(JSON.stringify({ data: { id: result.id }, message: 'Reserva creada' }), { status: 201 });
        }
        return new Response(JSON.stringify({ error: result.error }), { status: 500 });
    } catch (e) {
        return new Response(JSON.stringify({ error: 'Error processing request' }), { status: 400 });
    }
};
