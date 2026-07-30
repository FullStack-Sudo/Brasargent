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
            `SELECT 
                r.id,
                r.sucursal_id,
                r.cubiertos_reservados,
                r.estado,
                r.nombre_cliente,
                s.nombre AS sucursal_nombre
             FROM reservas r
             JOIN sucursales s ON r.sucursal_id = s.id
             WHERE r.id = ?`,
            [id]
        ) as any[];

        const reserva = reservas && reservas.length > 0 ? reservas[0] : null;

        if (!reserva) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Reserva no encontrada'
            }), { status: 404 });
        }

        // Verificar que la reserva esté confirmada o en_curso
        if (reserva.estado !== 'confirmada' && reserva.estado !== 'en_curso') {
            return new Response(JSON.stringify({
                success: false,
                error: 'Solo se pueden liberar reservas confirmadas o en curso'
            }), { status: 409 });
        }

        // Verificar que tenga cubiertos asignados
        if (!reserva.cubiertos_reservados || reserva.cubiertos_reservados === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Esta reserva no tiene cubiertos asignados'
            }), { status: 409 });
        }

        // 🔴 ACTUALIZAR RESERVA A "COMPLETADA"
        await query(
            `UPDATE reservas 
             SET estado = 'completada',
                 fecha_completada = NOW()
             WHERE id = ?`,
            [id]
        );

        // 🔴 LIBERAR CUBIERTOS
        await liberarCubiertosAlCancelar(
            reserva.sucursal_id,
            reserva.cubiertos_reservados
        );

        // 🔴 REGISTRAR EN LOGS
        await query(
            `INSERT INTO logs_actividad 
             (usuario_id, accion, tabla_afectada, registro_id, detalles) 
             VALUES (?, 'CUBIERTOS_LIBERADOS', 'reservas', ?, ?)`,
            [
                1, // admin_id
                reserva.id,
                JSON.stringify({
                    cliente: reserva.nombre_cliente,
                    sucursal: reserva.sucursal_nombre,
                    cubiertos_liberados: reserva.cubiertos_reservados
                })
            ]
        );

        return new Response(JSON.stringify({
            success: true,
            mensaje: `Mesa liberada. ${reserva.cubiertos_reservados} cubiertos disponibles nuevamente`,
            cubiertos_liberados: reserva.cubiertos_reservados
        }), { status: 200 });

    } catch (error: any) {
        console.error('Error al liberar cubiertos:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al liberar cubiertos'
        }), { status: 500 });
    }
};
