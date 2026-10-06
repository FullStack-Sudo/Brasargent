import type { APIRoute } from 'astro';
import { query } from '../../../lib/db';
import { verificarCubiertosSuficientes } from '../../../lib/cubiertos';
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
        // 3. INSERTAR RESERVA COMO PENDIENTE
        // ============================================
        
        const finalTelefonoCompleto = telefono_completo || `${codigo_pais || '591'}${telefono.toString().replace(/\D/g, '')}`;

        const [insertResult] = await query(
            `INSERT INTO reservas 
             (sucursal_id, nombre_cliente, telefono, codigo_pais, telefono_completo, 
              fecha, hora, numero_personas, cantidad_ninos,
              necesita_silla_bebe, necesita_menu_infantil, observaciones,
              cubiertos_reservados, numero_reserva, estado, fecha_confirmacion) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', NULL)`,
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
        // 4. REGISTRAR EN LOGS
        // ============================================
        
        try {
            await query(
                `INSERT INTO logs_actividad 
                 (accion, tabla_afectada, registro_id, detalles) 
                 VALUES ('RESERVA_PENDIENTE', 'reservas', ?, ?)`,
                [
                    reservaId,
                    JSON.stringify({
                        cliente: nombre_cliente,
                        numero_reserva: numeroReserva,
                        telefono: finalTelefonoCompleto,
                        cubiertos: cubiertosNecesarios,
                        fecha,
                        hora
                    })
                ]
            );
        } catch (e) {
            console.error('Error registrando actividad:', e);
        }
        
        // ============================================
        // 5. DISPARAR NOTIFICACIONES AL ADMIN
        // ============================================
        
        try {
            const { notificarNuevaReserva } = await import('../../../lib/notificaciones');
            
            // Need sucursal nombre for notification
            const [suc] = await query('SELECT nombre FROM sucursales WHERE id = ?', [sucursal_id]) as any[];
            
            await notificarNuevaReserva({
                id: reservaId,
                numero_reserva: numeroReserva,
                nombre_cliente,
                telefono: finalTelefonoCompleto,
                fecha,
                hora,
                numero_personas: parseInt(numero_personas) || 0,
                cantidad_ninos: parseInt(totalNinos) || 0,
                cubiertos: cubiertosNecesarios,
                sucursal_id: Number(sucursal_id),
                sucursal_nombre: suc?.nombre || '',
                observaciones: observaciones || ''
            });
        } catch (error) {
            console.error('Error enviando notificaciones al admin:', error);
            // No fallar la reserva si las notificaciones fallan
        }
        
        // ============================================
        // 5. RESPUESTA
        // ============================================
        
        return new Response(JSON.stringify({
            success: true,
            mensaje: '¡Reserva solicitada correctamente!',
            reserva_id: reservaId,
            numero_reserva: numeroReserva,
            reserva: {
                id: reservaId,
                numero_reserva: numeroReserva,
                estado: 'pendiente'
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
