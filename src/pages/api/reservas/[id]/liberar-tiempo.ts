import type { APIRoute } from 'astro';
import { query } from '../../../../lib/db';
import { calcularTiempoLiberacion } from '../../../../lib/liberacion-cubiertos';

export const POST: APIRoute = async ({ params, request, cookies }) => {
    try {
        const { id } = params;
        const { accion, tipo_servicio } = await request.json();

        // Verificar sesión admin
        const session = cookies.get('session');
        if (!session || session.value !== 'authenticated') {
            return new Response(JSON.stringify({
                success: false,
                error: 'No autorizado'
            }), { status: 401 });
        }

        // Obtener datos de la reserva
        const [rows] = await query(
            `SELECT 
                r.*,
                s.nombre AS sucursal_nombre,
                s.concepto AS sucursal_concepto
             FROM reservas r
             JOIN sucursales s ON r.sucursal_id = s.id
             WHERE r.id = ?`,
            [id]
        ) as any[];

        const reserva = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

        if (!reserva) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Reserva no encontrada'
            }), { status: 404 });
        }

        const conceptoFinal = tipo_servicio || reserva.sucursal_concepto || 'default';

        if (accion === 'estimar') {
            // Calcular tiempo estimado de liberación
            const fechaHoraStr = `${reserva.fecha.toString().slice(0, 10)}T${reserva.hora}`;
            const fechaLlegada = new Date(fechaHoraStr);
            const tiempoLiberacion = calcularTiempoLiberacion(
                conceptoFinal,
                reserva.numero_personas || 0,
                fechaLlegada
            );

            return new Response(JSON.stringify({
                success: true,
                datos: {
                    tiempo_estimado: tiempoLiberacion.toISOString(),
                    minutos_estimados: Math.round((tiempoLiberacion.getTime() - fechaLlegada.getTime()) / 60000),
                    tipo_servicio: conceptoFinal
                }
            }), { status: 200 });
        }

        if (accion === 'registrar_llegada') {
            // Registrar hora de llegada real y calcular hora de liberación estimada
            const horaActual = new Date();
            const tiempoLiberacion = calcularTiempoLiberacion(
                conceptoFinal,
                reserva.numero_personas || 0,
                horaActual
            );

            const horaActualStr = horaActual.toTimeString().slice(0, 8);
            const tiempoLiberacionStr = tiempoLiberacion.toISOString().slice(0, 19).replace('T', ' ');

            await query(
                `UPDATE reservas 
                 SET 
                     hora_llegada_estimada = ?,
                     hora_liberacion_estimada = ?,
                     estado = 'en_curso'
                 WHERE id = ?`,
                [horaActualStr, tiempoLiberacionStr, id]
            );

            return new Response(JSON.stringify({
                success: true,
                mensaje: `Llegada registrada. La mesa se liberará aproximadamente a las ${tiempoLiberacion.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`,
                hora_liberacion: tiempoLiberacion.toISOString()
            }), { status: 200 });
        }

        return new Response(JSON.stringify({
            success: false,
            error: 'Acción no válida'
        }), { status: 400 });

    } catch (error: any) {
        console.error('Error en liberar-tiempo:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al procesar la solicitud'
        }), { status: 500 });
    }
};
