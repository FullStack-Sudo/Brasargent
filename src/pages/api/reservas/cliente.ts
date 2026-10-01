import type { APIRoute } from 'astro';
import { query } from '../../../lib/db';
import { openwa } from '../../../lib/whatsapp/openwa';
import { openwaMulti } from '../../../lib/whatsapp/openwa-multi';
import { verificarCubiertosSuficientes, actualizarCubiertosAlAprobar } from '../../../lib/cubiertos';
import { generarNumeroReserva } from '../../../lib/reservas';

export const POST: APIRoute = async ({ request }) => {
    try {
        const data = await request.json();
        
        const { 
            sucursal_id, 
            nombre_cliente, 
            telefono, 
            codigo_pais,
            telefono_completo,
            fecha, 
            hora, 
            numero_personas,
            cantidad_ninos,
            ninos,
            necesita_silla_bebe,
            necesita_menu_infantil,
            observaciones
        } = data;
        
        // ============================================
        // 1. VALIDACIONES
        // ============================================
        
        if (!sucursal_id || !nombre_cliente || !telefono || !fecha || !hora || !numero_personas) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Todos los campos obligatorios deben ser completados'
            }), { status: 400 });
        }
        
        const totalNinos = (cantidad_ninos !== undefined ? cantidad_ninos : ninos) || 0;
        // Calcular cubiertos necesarios (Adultos + Niños)
        const cubiertosNecesarios = (parseInt(numero_personas) || 0) + (parseInt(totalNinos) || 0);
        
        // Verificar disponibilidad de cubiertos
        const verificacion = await verificarCubiertosSuficientes(Number(sucursal_id), cubiertosNecesarios);
        
        if (!verificacion.success) {
            return new Response(JSON.stringify({
                success: false,
                error: verificacion.message
            }), { status: 409 });
        }
        
        // ============================================
        // 2. GENERAR NÚMERO DE RESERVA
        // ============================================
        
        const numeroReserva = await generarNumeroReserva(Number(sucursal_id));
        
        // ============================================
        // 3. INSERTAR RESERVA COMO CONFIRMADA
        // ============================================
        
        const finalTelefonoCompleto = telefono_completo || `${codigo_pais || '591'}${telefono.toString().replace(/\D/g, '')}`;

        const [insertResult] = await query(
            `INSERT INTO reservas 
             (sucursal_id, nombre_cliente, telefono, codigo_pais, telefono_completo, 
              fecha, hora, numero_personas, cantidad_ninos,
              necesita_silla_bebe, necesita_menu_infantil, observaciones,
              cubiertos_reservados, numero_reserva, estado, fecha_confirmacion) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmada', NOW())`,
            [
                sucursal_id,
                nombre_cliente,
                telefono,
                codigo_pais || '591',
                finalTelefonoCompleto,
                fecha,
                hora,
                numero_personas,
                totalNinos,
                necesita_silla_bebe ? 1 : 0,
                necesita_menu_infantil ? 1 : 0,
                observaciones || null,
                cubiertosNecesarios,
                numeroReserva
            ]
        ) as any[];
        
        const reservaId = insertResult?.insertId || (Array.isArray(insertResult) ? insertResult[0]?.insertId : null);
        
        // ============================================
        // 4. ACTUALIZAR CUBIERTOS
        // ============================================
        
        await actualizarCubiertosAlAprobar(Number(sucursal_id), cubiertosNecesarios);
        
        // ============================================
        // 5. ENVIAR WHATSAPP AUTOMÁTICAMENTE
        // ============================================
        
        let whatsappResult = { success: false, error: 'No se pudo enviar' };
        
        try {
            const [sucursalDataRows] = await query(
                `SELECT nombre, direccion, telefono FROM sucursales WHERE id = ?`,
                [sucursal_id]
            ) as any[];
            const sucursalData = Array.isArray(sucursalDataRows) && sucursalDataRows.length > 0 ? sucursalDataRows[0] : null;
            
            const mensajeWhatsApp = generarMensajeConfirmacion({
                nombre_cliente,
                numero_reserva: numeroReserva,
                sucursal_nombre: sucursalData?.nombre || 'BRASARGENT',
                direccion: sucursalData?.direccion || '',
                fecha,
                hora,
                numero_personas,
                cantidad_ninos: totalNinos,
                necesita_silla_bebe: necesita_silla_bebe || false,
                necesita_menu_infantil: necesita_menu_infantil || false
            });
            
            const telefonoCliente = finalTelefonoCompleto;
            
            // Enviar por OpenWA multi-sesión por sucursal
            let result = await openwaMulti.sendMessage(
                Number(sucursal_id),
                telefonoCliente,
                mensajeWhatsApp
            );
            if (!result.success) {
                // Fallback a cliente general
                const fallbackRes = await openwa.sendMessage({
                    to: telefonoCliente,
                    text: mensajeWhatsApp
                });
                result = {
                    success: fallbackRes.success,
                    messageId: fallbackRes.messageId,
                    error: fallbackRes.error
                };
            }
            
            whatsappResult = {
                success: result.success,
                error: result.error || null
            };
            
        } catch (error: any) {
            console.error('❌ Error enviando WhatsApp:', error);
            whatsappResult = {
                success: false,
                error: error.message || 'Error desconocido'
            };
        }
        
        // ============================================
        // 6. REGISTRAR EN LOGS
        // ============================================
        
        try {
            await query(
                `INSERT INTO logs_actividad 
                 (accion, tabla_afectada, registro_id, detalles) 
                 VALUES ('RESERVA_AUTOMATICA', 'reservas', ?, ?)`,
                [
                    reservaId,
                    JSON.stringify({
                        cliente: nombre_cliente,
                        numero_reserva: numeroReserva,
                        telefono: finalTelefonoCompleto,
                        cubiertos: cubiertosNecesarios,
                        whatsapp_enviado: whatsappResult.success,
                        fecha,
                        hora
                    })
                ]
            );
        } catch (e) {
            console.error('Error registrando actividad:', e);
        }
        
        // ============================================
        // 7. RESPUESTA
        // ============================================
        
        return new Response(JSON.stringify({
            success: true,
            mensaje: '¡Reserva confirmada automáticamente!',
            reserva_id: reservaId,
            numero_reserva: numeroReserva,
            reserva: {
                id: reservaId,
                numero_reserva: numeroReserva,
                estado: 'confirmada',
                whatsapp_enviado: whatsappResult.success
            }
        }), { status: 201 });
        
    } catch (error: any) {
        console.error('Error en reserva:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al procesar la reserva'
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
