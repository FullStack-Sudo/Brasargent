import type { APIRoute } from 'astro';
import { query } from '../../../../lib/db';
import { 
    actualizarCubiertosAlAprobar, 
    getCubiertosDisponibles,
    verificarCubiertosSuficientes 
} from '../../../../lib/cubiertos';
import { openwa } from '../../../../lib/whatsapp/openwa';
import { generarMensajeConfirmacion } from '../../../../lib/whatsapp';

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
                r.id,
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
                r.numero_reserva,
                s.nombre AS sucursal_nombre,
                s.direccion,
                s.telefono AS telefono_sucursal,
                s.capacidad_total,
                s.cubiertos_disponibles,
                s.cubiertos_ocupados
             FROM reservas r
             JOIN sucursales s ON r.sucursal_id = s.id
             WHERE r.id = ?`,
            [id]
        ) as any[];

        const reserva = Array.isArray(reservas) && reservas.length > 0 ? reservas[0] : null;

        if (!reserva) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Reserva no encontrada'
            }), { status: 404 });
        }

        if (reserva.estado !== 'pendiente') {
            return new Response(JSON.stringify({
                success: false,
                error: `La reserva ya está ${reserva.estado}`
            }), { status: 409 });
        }

        const cubiertosNecesarios = (parseInt(reserva.numero_personas) || 0) + (parseInt(reserva.cantidad_ninos) || 0);

        console.log(`📊 Procesando Reserva ${id}: ${reserva.nombre_cliente}`);
        console.log(`   👥 Personas: ${reserva.numero_personas}, Niños: ${reserva.cantidad_ninos}`);
        console.log(`   🪑 Cubiertos necesarios: ${cubiertosNecesarios}`);

        if (accion === 'aprobar') {
            // 🔴 1. VALIDAR VENTANA DE 24 HORAS
            const ahora = new Date();
            const fechaStr = typeof reserva.fecha === 'string' ? reserva.fecha.slice(0, 10) : new Date(reserva.fecha).toISOString().slice(0, 10);
            const horaStr = reserva.hora ? (reserva.hora.length === 5 ? `${reserva.hora}:00` : reserva.hora) : '12:00:00';
            const fechaHoraReserva = new Date(`${fechaStr}T${horaStr}`);
            const diferenciaMs = fechaHoraReserva.getTime() - ahora.getTime();
            const diferenciaHoras = diferenciaMs / (1000 * 60 * 60);

            if (diferenciaHoras > 24) {
                const diasRestantes = Math.ceil(diferenciaHoras / 24);
                return new Response(JSON.stringify({
                    success: false,
                    error: `⚠️ No se puede confirmar esta reserva aún. Faltan ${diasRestantes} días (${Math.round(diferenciaHoras)}h). Solo se aceptan reservas dentro de las 24 horas previas para no bloquear cubiertos con anticipación.`
                }), { status: 400 });
            }

            // 🔴 2. VERIFICAR DISPONIBILIDAD EN TIEMPO REAL
            const verificacion = await verificarCubiertosSuficientes(
                reserva.sucursal_id,
                cubiertosNecesarios
            );

            if (!verificacion.success) {
                return new Response(JSON.stringify({
                    success: false,
                    error: verificacion.message,
                    disponibles: verificacion.disponibles,
                    necesarios: cubiertosNecesarios
                }), { status: 409 });
            }

            // 🔴 3. ACTUALIZAR RESERVA A CONFIRMADA
            await query(
                `UPDATE reservas 
                 SET estado = 'confirmada',
                     cubiertos_reservados = ?,
                     fecha_confirmacion = NOW(),
                     mensaje_admin = ?
                 WHERE id = ?`,
                [cubiertosNecesarios, mensaje || 'Reserva confirmada', id]
            );

            // 🔴 4. RECALCULAR Y ACTUALIZAR CUBIERTOS EN TIEMPO REAL
            const stats = await getCubiertosDisponibles(reserva.sucursal_id);

            // 🔴 5. ENVIAR MENSAJE POR WHATSAPP CON OPENWA
            let whatsappResult = { success: false, messageId: null as string | null, error: null as string | null };
            const rawTel = String(reserva.telefono_completo || reserva.telefono || '').replace(/\D/g, '');
            const telefonoCliente = rawTel.startsWith('591') || rawTel.length > 8 ? rawTel : `591${rawTel}`;
            const mensajeWhatsApp = generarMensajeConfirmacion(reserva, cubiertosNecesarios);
            const urlWhatsAppFallback = `https://api.whatsapp.com/send/?phone=${telefonoCliente}&text=${encodeURIComponent(mensajeWhatsApp)}&type=phone_number&app_absent=0`;

            try {
                const result = await openwa.sendMessage({
                    to: telefonoCliente,
                    text: mensajeWhatsApp
                });
                
                whatsappResult = {
                    success: result.success,
                    messageId: result.messageId || null,
                    error: result.error || null
                };
                
                console.log(`📱 Mensaje WhatsApp enviado a ${telefonoCliente}:`, result);
                
            } catch (error: any) {
                console.error('❌ Error enviando WhatsApp con OpenWA:', error);
                whatsappResult = {
                    success: false,
                    messageId: null,
                    error: error.message || 'Error desconocido'
                };
            }

            // 🔴 6. REGISTRAR EN LOGS DE ACTIVIDAD
            try {
                await query(
                    `INSERT INTO logs_actividad 
                     (usuario_id, accion, tabla_afectada, registro_id, detalles) 
                     VALUES (?, 'RESERVA_APROBADA_WHATSAPP', 'reservas', ?, ?)`,
                    [
                        1,
                        reserva.id,
                        JSON.stringify({
                            cliente: reserva.nombre_cliente,
                            telefono: telefonoCliente,
                            cubiertos: cubiertosNecesarios,
                            whatsapp_enviado: whatsappResult.success,
                            message_id: whatsappResult.messageId,
                            error: whatsappResult.error,
                            fecha: reserva.fecha,
                            hora: reserva.hora,
                            whatsapp_url: urlWhatsAppFallback
                        })
                    ]
                );
            } catch (errLog) {
                console.error('Error al registrar log de actividad:', errLog);
            }

            return new Response(JSON.stringify({
                success: true,
                mensaje: 'Reserva aprobada exitosamente',
                cubiertos: {
                    ocupados: stats.ocupados,
                    disponibles: stats.disponibles,
                    total: stats.total
                },
                whatsapp: whatsappResult,
                whatsapp_url: urlWhatsAppFallback,
                telefono: telefonoCliente
            }));

        } else if (accion === 'rechazar') {
            await query(
                `UPDATE reservas 
                 SET estado = 'rechazada',
                     mensaje_admin = ?,
                     fecha_rechazo = NOW()
                 WHERE id = ?`,
                [mensaje || 'No hay disponibilidad', id]
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
