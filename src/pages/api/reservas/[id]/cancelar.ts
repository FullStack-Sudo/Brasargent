import type { APIRoute } from 'astro';
import { query } from '../../../../lib/db';
import { liberarCubiertosAlCancelar } from '../../../../lib/cubiertos';

export const POST: APIRoute = async ({ params, cookies }) => {
    try {
        const { id } = params;

        // Verificar sesión admin
        const session = cookies.get('session');
        if (!session || session.value !== 'authenticated') {
            return new Response(JSON.stringify({
                success: false,
                error: 'No autorizado'
            }), { status: 401 });
        }

        // Obtener datos de la reserva
        const [reservas] = await query(
            'SELECT sucursal_id, cubiertos_reservados, estado FROM reservas WHERE id = ?',
            [id]
        ) as any[];

        const reserva = (reservas as any[])[0];

        if (!reserva) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Reserva no encontrada'
            }), { status: 404 });
        }

        // Solo cancelar reservas confirmadas
        if (reserva.estado !== 'confirmada') {
            return new Response(JSON.stringify({
                success: false,
                error: 'Solo se pueden cancelar reservas confirmadas'
            }), { status: 409 });
        }

        // 🔴 LIBERAR CUBIERTOS
        const result = await liberarCubiertosAlCancelar(
            reserva.sucursal_id,
            reserva.cubiertos_reservados || 0
        );

        if (!result.success) {
            return new Response(JSON.stringify({
                success: false,
                error: result.message
            }), { status: 500 });
        }

        // Actualizar reserva
        await query(
            'UPDATE reservas SET estado = "cancelada", mensaje_admin = "Cancelada por admin" WHERE id = ?',
            [id]
        );

        return new Response(JSON.stringify({
            success: true,
            mensaje: 'Reserva cancelada y cubiertos liberados'
        }), { status: 200 });

    } catch (error: any) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al cancelar reserva'
        }), { status: 500 });
    }
};
