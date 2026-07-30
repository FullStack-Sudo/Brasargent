import { query } from '../src/lib/db.js';
import { liberarCubiertosAlCancelar } from '../src/lib/cubiertos.js';

async function liberarCubiertosAutomaticamente() {
    console.log('🔄 Verificando reservas antiguas para liberar cubiertos...');

    try {
        // Reservas confirmadas con más de 4 horas de antigüedad
        const [reservasAntiguas] = await query(`
            SELECT 
                id,
                sucursal_id,
                cubiertos_reservados,
                nombre_cliente
            FROM reservas
            WHERE estado = 'confirmada'
            AND created_at < DATE_SUB(NOW(), INTERVAL 4 HOUR)
        `) as any[];

        if (!reservasAntiguas || reservasAntiguas.length === 0) {
            console.log('✅ No hay reservas antiguas para liberar');
            process.exit(0);
        }

        for (const reserva of reservasAntiguas) {
            // Liberar cubiertos
            await liberarCubiertosAlCancelar(
                reserva.sucursal_id,
                reserva.cubiertos_reservados || 0
            );

            // Actualizar reserva
            await query(
                `UPDATE reservas 
                 SET estado = 'completada',
                     fecha_completada = NOW(),
                     mensaje_admin = 'Liberado automáticamente'
                 WHERE id = ?`,
                [reserva.id]
            );

            console.log(`✅ Liberados ${reserva.cubiertos_reservados} cubiertos de ${reserva.nombre_cliente}`);
        }

        console.log('✅ Liberación automática completada');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

liberarCubiertosAutomaticamente();
