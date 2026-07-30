import type { APIRoute } from 'astro';
import { query } from '../../../../lib/db';

export const POST: APIRoute = async ({ params, request, cookies }) => {
    try {
        const { id } = params;
        const { personas_asistentes } = await request.json();

        // Verificar sesión admin
        const session = cookies.get('session');
        if (!session || session.value !== 'authenticated') {
            return new Response(JSON.stringify({
                success: false,
                error: 'No autorizado'
            }), { status: 401 });
        }

        // Validar datos
        if (!personas_asistentes || personas_asistentes < 1) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Debe haber al menos 1 persona'
            }), { status: 400 });
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
                s.nombre AS sucursal_nombre,
                s.cubiertos_ocupados,
                s.cubiertos_disponibles,
                s.capacidad_total
             FROM reservas r
             JOIN sucursales s ON r.sucursal_id = s.id
             WHERE r.id = ? AND r.estado IN ('confirmada', 'en_curso')`,
            [id]
        ) as any[];

        const reserva = reservas && reservas.length > 0 ? reservas[0] : null;

        if (!reserva) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Reserva no encontrada o no está confirmada'
            }), { status: 404 });
        }

        // Validar que no supere los reservados
        if (personas_asistentes > reserva.cubiertos_reservados) {
            return new Response(JSON.stringify({
                success: false,
                error: `Solo hay ${reserva.cubiertos_reservados} cubiertos reservados`
            }), { status: 400 });
        }

        // Calcular cubiertos a liberar
        const cubiertosOriginales = reserva.cubiertos_reservados || 0;
        const cubiertosReales = Math.min(personas_asistentes, cubiertosOriginales);
        const cubiertosALiberar = cubiertosOriginales - cubiertosReales;

        // Actualizar reserva con asistencia real
        await query(
            `UPDATE reservas 
             SET 
                 personas_asistentes = ?,
                 cubiertos_reservados = ?,
                 estado = 'en_curso',
                 hora_llegada = NOW()
             WHERE id = ?`,
            [personas_asistentes, cubiertosReales, id]
        );

        // 🔴 LIBERAR CUBIERTOS NO UTILIZADOS
        if (cubiertosALiberar > 0) {
            await query(
                `UPDATE sucursales 
                 SET 
                     cubiertos_ocupados = GREATEST(0, cubiertos_ocupados - ?),
                     cubiertos_disponibles = LEAST(capacidad_total, cubiertos_disponibles + ?)
                 WHERE id = ?`,
                [cubiertosALiberar, cubiertosALiberar, reserva.sucursal_id]
            );
        }

        // Registrar en logs
        await query(
            `INSERT INTO logs_actividad 
             (usuario_id, accion, tabla_afectada, registro_id, detalles) 
             VALUES (?, 'ASISTENCIA_REGISTRADA', 'reservas', ?, ?)`,
            [
                1,
                reserva.id,
                JSON.stringify({
                    cliente: reserva.nombre_cliente,
                    reservados: cubiertosOriginales,
                    asistentes: cubiertosReales,
                    liberados: cubiertosALiberar,
                    sucursal: reserva.sucursal_nombre
                })
            ]
        );

        return new Response(JSON.stringify({
            success: true,
            mensaje: `Asistencia registrada: ${cubiertosReales} personas. ${cubiertosALiberar} cubiertos liberados.`,
            datos: {
                reservados: cubiertosOriginales,
                asistentes: cubiertosReales,
                liberados: cubiertosALiberar,
                ocupados_actuales: Math.max(0, reserva.cubiertos_ocupados - cubiertosALiberar),
                disponibles_actuales: Math.min(reserva.capacidad_total, reserva.cubiertos_disponibles + cubiertosALiberar)
            }
        }), { status: 200 });

    } catch (error: any) {
        console.error('Error al registrar asistencia:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al registrar asistencia'
        }), { status: 500 });
    }
};
