import type { APIRoute } from 'astro';
import { query } from '../../../../lib/db';
import { actualizarCubiertosAlAprobar } from '../../../../lib/cubiertos';
import { enviarWhatsApp, generarMensajeConfirmacion } from '../../../../lib/whatsapp';

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

        // Obtener datos completos de la reserva
        const [reservas] = await query(
            `SELECT 
                r.id,
                r.numero_reserva,
                r.sucursal_id,
                r.nombre_cliente,
                r.telefono,
                r.telefono_completo,
                r.codigo_pais,
                r.fecha,
                r.hora,
                r.numero_personas,
                r.cantidad_ninos,
                r.cubiertos_reservados,
                r.estado,
                s.nombre AS sucursal_nombre,
                s.direccion,
                s.telefono AS telefono_sucursal,
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
        const adultos = parseInt(reserva.numero_personas) || 0;
        const ninos = parseInt(reserva.cantidad_ninos) || 0;
        const cubiertosNecesarios = reserva.cubiertos_reservados || (adultos + ninos);

        // Obtener ID de usuario (admin)
        const userIdCookie = cookies.get('user_id');
        const adminId = userIdCookie ? parseInt(userIdCookie.value) : 1;

        if (accion === 'aprobar') {
            // Actualizar cubiertos en sucursal
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

            // Actualizar reserva a confirmada
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

            // 🔴 ENVIAR MENSAJE DE WHATSAPP AL CLIENTE
            const mensajeWhatsApp = generarMensajeConfirmacion(reserva, cubiertosNecesarios);
            const telefonoCliente = reserva.telefono_completo || `${reserva.codigo_pais || '591'}${reserva.telefono}`;
            
            // Enviar WhatsApp
            const whatsappResult = await enviarWhatsApp(telefonoCliente, mensajeWhatsApp);

            // Registrar en logs de actividad
            try {
                await query(
                    `INSERT INTO logs_actividad 
                     (usuario_id, accion, tabla_afectada, registro_id, detalles) 
                     VALUES (?, 'RESERVA_APROBADA_Y_NOTIFICADA', 'reservas', ?, ?)`,
                    [
                        adminId,
                        reserva.id,
                        JSON.stringify({
                            cliente: reserva.nombre_cliente,
                            telefono: telefonoCliente,
                            cubiertos: cubiertosNecesarios,
                            whatsapp_enviado: whatsappResult.success,
                            fecha: reserva.fecha,
                            hora: reserva.hora
                        })
                    ]
                );
            } catch (errLog) {
                console.error('Error al registrar log de aprobación:', errLog);
            }

            return new Response(JSON.stringify({
                success: true,
                mensaje: 'Reserva aprobada exitosamente',
                cubiertos_ocupados: cubiertosNecesarios,
                cubiertos_disponibles: reserva.cubiertos_disponibles - cubiertosNecesarios,
                whatsapp: whatsappResult,
                whatsapp_enviado: whatsappResult.success,
                url_whatsapp: whatsappResult.url || whatsappResult.url_whatsapp
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
