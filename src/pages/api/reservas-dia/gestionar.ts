// src/pages/api/reservas-dia/gestionar.ts
// API para aceptar o cancelar reservas del dia

import type { APIRoute } from 'astro';
import { query } from '../../../lib/db';
import { actualizarCubiertosAlAprobar, liberarCubiertosAlCancelar } from '../../../lib/cubiertos';

export const POST: APIRoute = async ({ request, cookies, locals }) => {
    try {
        // Verificar sesion
        const session = cookies.get('session');
        if (!session || session.value !== 'authenticated') {
            return new Response(JSON.stringify({
                success: false,
                error: 'No autorizado'
            }), { status: 401 });
        }
        
        const usuario = locals.usuario;
        const esSuperAdmin = usuario?.es_super_admin === true ||
            usuario?.es_super_admin === 1 ||
            cookies.get('es_super_admin')?.value === 'true';
        const userSucursalId = usuario?.sucursal_id ||
            cookies.get('user_sucursal')?.value;
        
        const { reserva_id, accion, motivo } = await request.json();
        
        if (!reserva_id || !accion) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Datos incompletos'
            }), { status: 400 });
        }
        
        // Obtener datos de la reserva
        const [reservaRows] = await query(
            `SELECT 
                r.id,
                r.sucursal_id,
                r.cubiertos_reservados,
                r.estado,
                r.nombre_cliente,
                r.numero_reserva,
                r.telefono_completo,
                r.fecha,
                r.hora,
                r.numero_personas,
                r.cantidad_ninos,
                r.necesita_silla_bebe,
                r.necesita_menu_infantil,
                s.nombre AS sucursal_nombre,
                s.direccion AS sucursal_direccion
            FROM reservas r
            JOIN sucursales s ON r.sucursal_id = s.id
            WHERE r.id = ?`,
            [reserva_id]
        ) as any[];
        
        const reserva = Array.isArray(reservaRows) && reservaRows.length > 0 ? reservaRows[0] : null;
        
        if (!reserva) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Reserva no encontrada'
            }), { status: 404 });
        }
        
        // Verificar permisos
        if (!esSuperAdmin) {
            const sucursalIdNum = parseInt(String(userSucursalId || '0'), 10);
            if (reserva.sucursal_id !== sucursalIdNum) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'No tienes permiso para gestionar reservas de otra sucursal'
                }), { status: 403 });
            }
        }
        
        // Verificar estado de la reserva
        if (reserva.estado === 'cancelada') {
            return new Response(JSON.stringify({
                success: false,
                error: 'La reserva ya esta cancelada'
            }), { status: 409 });
        }
        
        // ============================================
        // ACEPTAR RESERVA
        // ============================================
        if (accion === 'aceptar') {
            if (reserva.estado === 'confirmada') {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'La reserva ya esta confirmada'
                }), { status: 409 });
            }
            
            // Actualizar cubiertos
            const resultCubiertos = await actualizarCubiertosAlAprobar(
                reserva.sucursal_id,
                reserva.cubiertos_reservados || 0
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
                     fecha_confirmacion = NOW()
                 WHERE id = ?`,
                [reserva_id]
            );
            
            // Enviar WhatsApp
            let whatsappEnviado = false;
            try {
                const { openwa } = await import('../../../lib/whatsapp/openwa');
                const { openwaMulti } = await import('../../../lib/whatsapp/openwa-multi');
                
                const mensajeWhatsApp = generarMensajeConfirmacion({
                    nombre_cliente: reserva.nombre_cliente,
                    numero_reserva: reserva.numero_reserva,
                    sucursal_nombre: reserva.sucursal_nombre,
                    direccion: reserva.sucursal_direccion || '',
                    fecha: reserva.fecha,
                    hora: reserva.hora,
                    numero_personas: reserva.numero_personas,
                    cantidad_ninos: reserva.cantidad_ninos,
                    necesita_silla_bebe: reserva.necesita_silla_bebe === 1,
                    necesita_menu_infantil: reserva.necesita_menu_infantil === 1
                });
                
                const telefonoCliente = reserva.telefono_completo;
                
                let result = await openwaMulti.sendMessage(
                    reserva.sucursal_id,
                    telefonoCliente,
                    mensajeWhatsApp
                );
                
                if (!result.success) {
                    const fallbackRes = await openwa.sendMessage({
                        to: telefonoCliente,
                        text: mensajeWhatsApp
                    });
                    whatsappEnviado = fallbackRes.success;
                } else {
                    whatsappEnviado = true;
                }
            } catch (e) {
                console.error("Error enviando whatsapp en gestionar.ts:", e);
            }
            
            // Registrar en logs
            await query(
                `INSERT INTO logs_actividad 
                 (usuario_id, accion, tabla_afectada, registro_id, detalles) 
                 VALUES (?, 'RESERVA_ACEPTADA', 'reservas', ?, ?)`,
                [
                    usuario?.id || null,
                    reserva.id,
                    JSON.stringify({
                        numero_reserva: reserva.numero_reserva,
                        cliente: reserva.nombre_cliente,
                        sucursal: reserva.sucursal_nombre,
                        cubiertos: reserva.cubiertos_reservados
                    })
                ]
            );
            
            return new Response(JSON.stringify({
                success: true,
                mensaje: 'Reserva aceptada correctamente',
                reserva_id: reserva.id,
                nuevo_estado: 'confirmada',
                whatsapp_enviado: whatsappEnviado
            }), { status: 200 });
        }
        
        // ============================================
        // CANCELAR RESERVA
        // ============================================
        if (accion === 'cancelar') {
            // Liberar cubiertos solo si estaba confirmada
            if (reserva.estado === 'confirmada') {
                await liberarCubiertosAlCancelar(
                    reserva.sucursal_id,
                    reserva.cubiertos_reservados || 0
                );
            }
            
            // Actualizar reserva
            await query(
                `UPDATE reservas 
                 SET estado = 'cancelada',
                     mensaje_admin = ?,
                     fecha_cancelacion = NOW()
                 WHERE id = ?`,
                [motivo || 'Cancelada por el administrador', reserva_id]
            );
            
            // Registrar en logs
            await query(
                `INSERT INTO logs_actividad 
                 (usuario_id, accion, tabla_afectada, registro_id, detalles) 
                 VALUES (?, 'RESERVA_CANCELADA', 'reservas', ?, ?)`,
                [
                    usuario?.id || null,
                    reserva.id,
                    JSON.stringify({
                        numero_reserva: reserva.numero_reserva,
                        cliente: reserva.nombre_cliente,
                        sucursal: reserva.sucursal_nombre,
                        motivo: motivo || 'Cancelada por el administrador'
                    })
                ]
            );
            
            return new Response(JSON.stringify({
                success: true,
                mensaje: 'Reserva cancelada correctamente',
                reserva_id: reserva.id,
                nuevo_estado: 'cancelada'
            }), { status: 200 });
        }
        
        // ============================================
        // ELIMINAR RESERVA
        // ============================================
        if (accion === 'eliminar') {
            // Liberar cubiertos solo si estaba confirmada
            if (reserva.estado === 'confirmada') {
                await liberarCubiertosAlCancelar(
                    reserva.sucursal_id,
                    reserva.cubiertos_reservados || 0
                );
            }
            
            // Eliminar reserva
            await query(
                `DELETE FROM reservas WHERE id = ?`,
                [reserva_id]
            );
            
            // Registrar en logs
            await query(
                `INSERT INTO logs_actividad 
                 (usuario_id, accion, tabla_afectada, registro_id, detalles) 
                 VALUES (?, 'RESERVA_ELIMINADA', 'reservas', ?, ?)`,
                [
                    usuario?.id || null,
                    reserva.id,
                    JSON.stringify({
                        numero_reserva: reserva.numero_reserva,
                        cliente: reserva.nombre_cliente,
                        sucursal: reserva.sucursal_nombre,
                        estado_anterior: reserva.estado,
                        motivo: motivo || 'Eliminada por el administrador'
                    })
                ]
            );
            
            return new Response(JSON.stringify({
                success: true,
                mensaje: 'Reserva eliminada correctamente',
                reserva_id: reserva.id
            }), { status: 200 });
        }
        
        return new Response(JSON.stringify({
            success: false,
            error: 'Accion no valida'
        }), { status: 400 });
        
    } catch (error: any) {
        console.error('Error al gestionar reserva:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al gestionar reserva'
        }), { status: 500 });
    }
};

// ============================================
// GENERAR MENSAJE DE CONFIRMACIÓN
// ============================================

function generarMensajeConfirmacion(data: any): string {
    let fechaFormateada = data.fecha;
    try {
        const fechaObj = new Date(data.fecha + 'T12:00:00');
        if (!isNaN(fechaObj.getTime())) {
            fechaFormateada = fechaObj.toLocaleDateString('es-ES', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
    } catch (e) {}
    
    const totalPersonas = (data.numero_personas || 0) + (data.cantidad_ninos || 0);
    let personasTexto = `${data.numero_personas || 0} Adultos`;
    if (data.cantidad_ninos > 0) {
        personasTexto += `\n${data.cantidad_ninos} Niños (2-12 años)`;
    }
    personasTexto += `\nTotal: ${totalPersonas} personas`;
    
    return `BRASARGENT - Tu Reserva fue Exitosa!

Hola ${data.nombre_cliente}!

Tu reserva en ${data.sucursal_nombre} ha sido confirmada.

Numero de Reserva: ${data.numero_reserva}

Fecha: ${fechaFormateada}
Hora: ${data.hora}
Ubicacion: ${data.direccion}

Detalle de Personas:
${personasTexto}

Te recordamos que tienes que estar 10 minutos antes de la hora de tu reserva.

¡Te esperamos!

Si no vas a poder asistir, por favor notifica al restaurante.

BRASARGENT - El mejor churrasco de Santa Cruz, Bolivia`;
}
