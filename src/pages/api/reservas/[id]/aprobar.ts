import type { APIRoute } from 'astro';
import { query } from '../../../../lib/db';
import { actualizarCubiertosAlAprobar } from '../../../../lib/cubiertos';
import { PLANTILLAS } from '../../../../lib/mensajes';

export const POST: APIRoute = async ({ params, request, cookies }) => {
    try {
        const { id } = params;
        const { accion, mensaje } = await request.json();

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
                r.*,
                s.nombre AS sucursal_nombre,
                s.cubiertos_disponibles
             FROM reservas r
             JOIN sucursales s ON r.sucursal_id = s.id
             WHERE r.id = ?`,
            [id]
        ) as any[];

        const reserva = (reservas as any[])[0];

        if (!reserva) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Reserva no encontrada'
            }), { status: 404 });
        }

        // Verificar que la reserva esté pendiente
        if (reserva.estado !== 'pendiente') {
            return new Response(JSON.stringify({
                success: false,
                error: `La reserva ya está ${reserva.estado}`
            }), { status: 409 });
        }

        // Calcular cubiertos necesarios (Adultos + Niños)
        const personas = parseInt(reserva.numero_personas) || 0;
        const ninos = parseInt(reserva.cantidad_ninos) || 0;
        const cubiertosNecesarios = reserva.cubiertos_reservados || (personas + ninos);

        // Obtener ID de usuario (admin)
        const userIdCookie = cookies.get('user_id');
        const adminId = userIdCookie ? parseInt(userIdCookie.value) : 1;

        if (accion === 'aprobar') {
            // 🔴 ACTUALIZAR CUBIERTOS
            const resultCubiertos = await actualizarCubiertosAlAprobar(
                reserva.sucursal_id,
                cubiertosNecesarios
            );

            if (!resultCubiertos.success) {
                return new Response(JSON.stringify({
                    success: false,
                    error: resultCubiertos.message
                }), { status: 409 });
            }

            // Actualizar reserva
            await query(
                `UPDATE reservas 
                 SET estado = 'confirmada',
                     cubiertos_reservados = ?,
                     fecha_confirmacion = NOW(),
                     mensaje_admin = ?,
                     confirmado_por = ?
                 WHERE id = ?`,
                [cubiertosNecesarios, mensaje || 'Reserva confirmada', adminId, id]
            );

            // Enviar mensaje de confirmación
            await enviarWhatsApp(reserva.telefono, 'confirmada', reserva, personas);

            return new Response(JSON.stringify({
                success: true,
                mensaje: 'Reserva aprobada exitosamente',
                cubiertos_ocupados: cubiertosNecesarios,
                cubiertos_disponibles: reserva.cubiertos_disponibles - cubiertosNecesarios
            }));

        } else if (accion === 'rechazar') {
            // Rechazar reserva (no ocupa cubiertos)
            await query(
                `UPDATE reservas 
                 SET estado = 'rechazada',
                     mensaje_admin = ?,
                     fecha_rechazo = NOW(),
                     confirmado_por = ?
                 WHERE id = ?`,
                [mensaje || 'No hay disponibilidad', adminId, id]
            );

            // Enviar mensaje de rechazo
            await enviarWhatsApp(reserva.telefono, 'rechazada', reserva, personas);

            return new Response(JSON.stringify({
                success: true,
                mensaje: 'Reserva rechazada'
            }));
        }

        return new Response(JSON.stringify({
            success: false,
            error: 'Acción no válida'
        }), { status: 400 });

    } catch (error: any) {
        console.error('Error al procesar reserva:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al procesar la reserva'
        }), { status: 500 });
    }
};

// Función para enviar WhatsApp
async function enviarWhatsApp(telefono: string, estado: string, reserva: any, personas: number) {
    let mensajeStr = '';
    
    if (reserva.hora && typeof reserva.hora === 'string') {
        reserva.hora = reserva.hora.substring(0, 5);
    }
    
    if (estado === 'confirmada') {
        mensajeStr = PLANTILLAS.confirmacion.formal(reserva, personas);
    } else if (estado === 'rechazada') {
        mensajeStr = PLANTILLAS.rechazo(reserva);
    }

    const telFinal = reserva.telefono_completo || `591${telefono}`;
    
    console.log(`📱 Mensaje de ${estado} preparado para: ${telFinal}`);
    
    try {
        await query(
            `INSERT INTO logs_actividad 
             (usuario_id, accion, tabla_afectada, registro_id, detalles) 
             VALUES (?, ?, 'reservas', ?, ?)`,
            [
                reserva.confirmado_por || 1, 
                estado === 'confirmada' ? 'MENSAJE_CONFIRMACION_ENVIADO' : 'MENSAJE_RECHAZO_ENVIADO',
                reserva.id,
                JSON.stringify({
                    telefono: telFinal,
                    fecha: reserva.fecha,
                    hora: reserva.hora,
                    sucursal: reserva.sucursal_nombre,
                    personas: personas
                })
            ]
        );
    } catch (err) {
        console.error('Error guardando log de mensaje:', err);
    }
    
    return true;
}
