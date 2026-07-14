import type { APIRoute } from 'astro';
import pool from '../../../../lib/db';

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
        
        // Obtener datos de la reserva y sucursal
        const [reservas] = await pool.query(
            `SELECT 
                r.*,
                s.capacidad_total,
                s.cubiertos_disponibles,
                s.cubiertos_ocupados,
                s.nombre AS sucursal_nombre
             FROM reservas r
             JOIN sucursales s ON r.sucursal_id = s.id
             WHERE r.id = ?`,
            [id]
        );
        
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
        
        // Verificar que el total de personas no supere la capacidad
        const personas = parseInt(reserva.numero_personas) || 0;
        const cubiertos_necesarios = personas;
        
        // Obtener ID de usuario (admin)
        const userIdCookie = cookies.get('user_id');
        const adminId = userIdCookie ? parseInt(userIdCookie.value) : null;
        
        if (accion === 'aprobar') {
            // Verificar disponibilidad de cubiertos
            if (reserva.cubiertos_disponibles < cubiertos_necesarios) {
                return new Response(JSON.stringify({
                    success: false,
                    error: `No hay suficientes cubiertos disponibles. Disponibles: ${reserva.cubiertos_disponibles}, Necesarios: ${cubiertos_necesarios}`
                }), { status: 409 });
            }
            
            // Actualizar reserva a confirmada (Esto disparará el trigger que actualiza sucursales y logs)
            await pool.query(
                `UPDATE reservas 
                 SET estado = 'confirmada',
                     cubiertos_reservados = ?,
                     fecha_confirmacion = NOW(),
                     mensaje_admin = ?,
                     confirmado_por = ?
                 WHERE id = ?`,
                [cubiertos_necesarios, mensaje || 'Reserva aprobada', adminId, id]
            );
            
            // Enviar WhatsApp de confirmación
            await enviarWhatsApp(reserva.telefono, 'confirmada', reserva, personas);
            
            return new Response(JSON.stringify({
                success: true,
                mensaje: `Reserva aprobada. ${personas} cubiertos ocupados. Quedan ${reserva.cubiertos_disponibles - personas} disponibles.`,
                cubiertos: {
                    ocupados: reserva.cubiertos_ocupados + personas,
                    disponibles: reserva.cubiertos_disponibles - personas,
                    total: reserva.capacidad_total
                }
            }));
            
        } else if (accion === 'rechazar') {
            // Rechazar reserva (no ocupa cubiertos)
            await pool.query(
                `UPDATE reservas 
                 SET estado = 'rechazada',
                     mensaje_admin = ?,
                     fecha_rechazo = NOW(),
                     confirmado_por = ?
                 WHERE id = ?`,
                [mensaje || 'No hay disponibilidad para tu reserva', adminId, id]
            );
            
            // Enviar WhatsApp de rechazo
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
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al procesar la reserva'
        }), { status: 500 });
    }
};

// Función para enviar WhatsApp (simulada)
async function enviarWhatsApp(telefono: string, estado: string, reserva: any, personas: number) {
    const dateObj = new Date(reserva.fecha);
    const fecha = dateObj.toISOString().split('T')[0];

    const mensajes = {
        confirmada: `¡Reserva CONFIRMADA en BRASARGENT!\n\nHola ${reserva.nombre_cliente}!\n\nTu reserva ha sido aprobada:\n ${reserva.sucursal_nombre}\n ${fecha}\n ${reserva.hora}\n ${personas} personas (${personas} cubiertos)\n\n¡Te esperamos! `,
        rechazada: `Lo sentimos, tu reserva no pudo ser confirmada.\n\nHola ${reserva.nombre_cliente}!\n\nNo tenemos disponibilidad para:\n ${fecha}\n ${reserva.hora}\n\nTe invitamos a intentar con otra fecha u hora.\n¡Disculpa las molestias!`
    };
    
    console.log(`Enviando WhatsApp a ${telefono}:`, mensajes[estado as keyof typeof mensajes]);
    return true;
}
