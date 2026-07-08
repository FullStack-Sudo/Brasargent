import type { APIRoute } from 'astro';
import { getReserva } from '../../../lib/queries/reservas';

export const GET: APIRoute = async ({ params }) => {
    const { id } = params;
    if (!id) return new Response(null, { status: 400 });
    const reserva = await getReserva(parseInt(id));
    if (!reserva) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    return new Response(JSON.stringify({ data: reserva }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

import pool from '../../../lib/db';

export const DELETE: APIRoute = async ({ params }) => {
    const { id } = params;
    
    if (!id) {
        return new Response(JSON.stringify({
            success: false,
            error: 'ID de reserva no proporcionado'
        }), { status: 400 });
    }

    try {
        const [result] = await pool.query(
            'DELETE FROM reservas WHERE id = ?',
            [id]
        ) as any[];

        if (result.affectedRows === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Reserva no encontrada'
            }), { status: 404 });
        }

        return new Response(JSON.stringify({
            success: true,
            mensaje: 'Reserva eliminada correctamente'
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error: any) {
        console.error('Error al eliminar reserva:', error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Error interno al eliminar la reserva'
        }), { status: 500 });
    }
};
