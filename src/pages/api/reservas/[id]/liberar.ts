import type { APIRoute } from 'astro';
import { query } from '../../../../lib/db';
import { liberarCubiertosAlCancelar } from '../../../../lib/cubiertos';

export const POST: APIRoute = async ({ params, locals, cookies }) => {
    try {
        const { id } = params;

        // Verificar sesión admin o locals usuario
        const usuario = locals.usuario;
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
                r.numero_personas,
                r.cantidad_ninos,
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

        // Verificar pertenencia a la sucursal del admin (si no es super admin)
        if (usuario && !usuario.es_super_admin && usuario.sucursal_id && usuario.sucursal_id !== reserva.sucursal_id) {
            return new Response(JSON.stringify({
                success: false,
                error: 'No tienes permisos para modificar reservas de otra sucursal'
            }), { status: 403 });
        }

        // Verificar que la reserva esté confirmada o en_curso
        if (reserva.estado !== 'confirmada' && reserva.estado !== 'en_curso') {
            return new Response(JSON.stringify({
                success: false,
                error: 'Solo se pueden liberar reservas confirmadas o en curso'
            }), { status: 409 });
        }

        const cubiertosLiberar = reserva.cubiertos_reservados || (parseInt(reserva.numero_personas || '0', 10) + parseInt(reserva.cantidad_ninos || '0', 10));

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
            cubiertosLiberar
        );

        // 🔴 REGISTRAR EN LOGS
        try {
            await query(
                `INSERT INTO logs_actividad 
                 (usuario_id, accion, tabla_afectada, registro_id, detalles) 
                 VALUES (?, 'CUBIERTOS_LIBERADOS', 'reservas', ?, ?)`,
                [
                    usuario?.id || 1,
                    reserva.id,
                    JSON.stringify({
                        cliente: reserva.nombre_cliente,
                        sucursal: reserva.sucursal_nombre,
                        cubiertos_liberados: cubiertosLiberar
                    })
                ]
            );
        } catch (logErr) {
            console.error('Error al guardar log de actividad:', logErr);
        }

        return new Response(JSON.stringify({
            success: true,
            mensaje: `Mesa liberada con éxito. ${cubiertosLiberar} cubiertos disponibles nuevamente para ${reserva.sucursal_nombre}.`,
            cubiertos_liberados: cubiertosLiberar
        }), { status: 200 });

    } catch (error: any) {
        console.error('Error al liberar cubiertos:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al liberar cubiertos'
        }), { status: 500 });
    }
};
