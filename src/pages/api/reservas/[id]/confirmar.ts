import type { APIRoute } from 'astro';
import { query } from '../../../../lib/db';
import { generarMensajeConfirmacion } from '../../../../lib/mensajes';

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

        // 🔴 Obtener datos de la reserva (sin bebés)
        const [reservaRows] = await query(`
            SELECT 
                r.id,
                r.numero_reserva,
                r.nombre_cliente,
                r.telefono,
                r.telefono_completo,
                r.codigo_pais,
                r.fecha,
                r.hora,
                r.numero_personas AS adultos,
                r.cantidad_ninos AS ninos,
                r.necesita_silla_bebe AS necesita_silla,
                r.observaciones,
                s.nombre AS sucursal,
                s.direccion,
                s.telefono AS telefono_sucursal
            FROM reservas r
            JOIN sucursales s ON r.sucursal_id = s.id
            WHERE r.id = ?
        `, [id]) as any[];

        const reserva = reservaRows?.[0];

        if (!reserva) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Reserva no encontrada'
            }), { status: 404 });
        }

        // 🔴 Verificar que tenga número de reserva
        if (!reserva.numero_reserva) {
            const year = new Date().getFullYear();
            const [maxResult] = await query(
                `SELECT COALESCE(MAX(CAST(SUBSTRING(numero_reserva, 9) AS UNSIGNED)), 0) + 1 as num FROM reservas WHERE numero_reserva LIKE ?`,
                [`BR-${year}-%`]
            ) as any[];
            const nextNum = maxResult?.[0]?.num || 1;
            const numeroReserva = `BR-${year}-${String(nextNum).padStart(4, '0')}`;
            
            await query(
                'UPDATE reservas SET numero_reserva = ? WHERE id = ?',
                [numeroReserva, id]
            );
            reserva.numero_reserva = numeroReserva;
        }

        // 🔴 Preparar datos (sin bebés)
        const totalPersonas = (reserva.adultos || 0) + (reserva.ninos || 0);

        const data = {
            id: reserva.id,
            numero_reserva: reserva.numero_reserva,
            nombre_cliente: reserva.nombre_cliente,
            telefono: reserva.telefono_sucursal || '',
            sucursal: reserva.sucursal,
            direccion: reserva.direccion,
            fecha: reserva.fecha,
            hora: reserva.hora,
            adultos: reserva.adultos || 0,
            ninos: reserva.ninos || 0,
            total_personas: totalPersonas,
            necesita_silla: reserva.necesita_silla === 1,
            observaciones: reserva.observaciones
        };

        // 🔴 Generar mensaje
        const mensaje = generarMensajeConfirmacion(data);

        // 🔴 Enviar por WhatsApp
        const telefonoCliente = reserva.telefono_completo || `591${reserva.telefono}`;
        const urlWhatsApp = `https://wa.me/${telefonoCliente}?text=${encodeURIComponent(mensaje)}`;
        
        console.log('📱 Mensaje de confirmación para:', telefonoCliente);
        console.log('📝 Contenido del mensaje:\n', mensaje);

        // 🔴 Registrar en logs
        try {
            await query(
                `INSERT INTO logs_actividad 
                 (usuario_id, accion, tabla_afectada, registro_id, detalles) 
                 VALUES (?, 'MENSAJE_CONFIRMACION_ENVIADO', 'reservas', ?, ?)`,
                [
                    1, // admin_id
                    reserva.id,
                    JSON.stringify({
                        numero_reserva: reserva.numero_reserva,
                        telefono: telefonoCliente,
                        personas: totalPersonas,
                        adultos: reserva.adultos,
                        ninos: reserva.ninos
                    })
                ]
            );
        } catch {
            // Log opcional
        }

        return new Response(JSON.stringify({
            success: true,
            mensaje: 'Mensaje de confirmación generado para WhatsApp',
            numero_reserva: reserva.numero_reserva,
            telefono: telefonoCliente,
            personas: totalPersonas,
            texto_whatsapp: mensaje,
            url_whatsapp: urlWhatsApp
        }), { status: 200 });

    } catch (error: any) {
        console.error('Error al confirmar reserva:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al enviar mensaje'
        }), { status: 500 });
    }
};
