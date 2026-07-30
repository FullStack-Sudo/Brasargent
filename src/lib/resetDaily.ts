// ============================================
// SISTEMA DE REINICIO AUTOMÁTICO DIARIO
// ============================================

import pool from './db';

// ============================================
// VERIFICAR SI YA SE EJECUTÓ HOY
// ============================================

export async function verificarReinicioHoy(): Promise<boolean> {
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
    const [result] = await pool.query(
        `SELECT reinicio_ejecutado 
         FROM control_reinicio_diario 
         WHERE fecha = ?`,
        [hoy]
    ) as any[];
    
    return result && result.length > 0 && result[0].reinicio_ejecutado === 1;
}

// ============================================
// EJECUTAR REINICIO DIARIO
// ============================================

export async function ejecutarReinicioDiario(): Promise<{
    success: boolean;
    mensaje: string;
    reservas_archivadas?: number;
    cubiertos_liberados?: number;
}> {
    try {
        console.log('🔄 Iniciando reinicio diario a las 01:00 AM...');
        
        // 1. Verificar si ya se ejecutó hoy
        const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
        const ayer = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
        const yaEjecutado = await verificarReinicioHoy();
        if (yaEjecutado) {
            console.log('⚠️ El reinicio diario ya se ejecutó hoy');
            return {
                success: true,
                mensaje: 'El reinicio diario ya se ejecutó hoy'
            };
        }
        
        // 2. Obtener reservas del día anterior
        const [reservasAyer] = await pool.query(
            `SELECT 
                id, 
                numero_personas, 
                sucursal_id,
                cubiertos_reservados
             FROM reservas 
             WHERE fecha = ? 
             AND estado IN ('pendiente', 'confirmada')`,
            [ayer]
        ) as any[];
        
        const totalReservas = reservasAyer.length;
        let totalCubiertos = 0;
        const cubiertosPorSucursal: Record<number, number> = {};
        
        // 3. Calcular cubiertos a liberar por sucursal
        reservasAyer.forEach((reserva: any) => {
            const cubiertos = reserva.cubiertos_reservados || reserva.numero_personas || 0;
            totalCubiertos += cubiertos;
            
            const sucursalId = reserva.sucursal_id;
            if (!cubiertosPorSucursal[sucursalId]) {
                cubiertosPorSucursal[sucursalId] = 0;
            }
            cubiertosPorSucursal[sucursalId] += cubiertos;
        });
        
        // 4. Actualizar reservas del día anterior a "archivadas" o "canceladas"
        await pool.query(
            `UPDATE reservas 
             SET estado = 'archivada', 
                 mensaje_admin = CONCAT('Archivada automáticamente el ', ?)
             WHERE fecha = ? 
             AND estado IN ('pendiente', 'confirmada')`,
            [hoy, ayer]
        );
        
        // 5. Reiniciar cubiertos por sucursal
        const [sucursales] = await pool.query('SELECT id, capacidad_total FROM sucursales WHERE activo = 1') as any[];
        
        for (const sucursal of sucursales) {
            const cubiertosALiberar = cubiertosPorSucursal[sucursal.id] || 0;
            
            await pool.query(
                `UPDATE sucursales 
                 SET 
                     cubiertos_ocupados = 0,
                     cubiertos_disponibles = capacidad_total
                 WHERE id = ?`,
                [sucursal.id]
            );
        }
        
        // 6. Registrar en control de reinicio
        await pool.query(
            `INSERT INTO control_reinicio_diario 
             (fecha, reinicio_ejecutado, reservas_archivadas, cubiertos_liberados, ejecutado_a) 
             VALUES (?, TRUE, ?, ?, NOW())`,
            [hoy, totalReservas, totalCubiertos]
        );
        
        // 7. Registrar en logs de actividad
        await pool.query(
            `INSERT INTO logs_actividad 
             (accion, tabla_afectada, detalles) 
             VALUES ('REINICIO_DIARIO', 'reservas', ?)`,
            [
                JSON.stringify({
                    fecha: hoy,
                    reservas_archivadas: totalReservas,
                    cubiertos_liberados: totalCubiertos,
                    sucursales_actualizadas: Object.keys(cubiertosPorSucursal).length
                })
            ]
        );
        
        console.log(`✅ Reinicio diario completado: ${totalReservas} reservas archivadas, ${totalCubiertos} cubiertos liberados`);
        
        // 🔔 Notificar al admin (opcional)
        await notificarReinicio(totalReservas, totalCubiertos);
        
        return {
            success: true,
            mensaje: `Reinicio completado. ${totalReservas} reservas archivadas, ${totalCubiertos} cubiertos liberados.`,
            reservas_archivadas: totalReservas,
            cubiertos_liberados: totalCubiertos
        };
        
    } catch (error: any) {
        console.error('❌ Error en reinicio diario:', error);
        return {
            success: false,
            mensaje: error.message || 'Error al ejecutar reinicio diario'
        };
    }
}

// ============================================
// NOTIFICAR AL ADMIN
// ============================================

async function notificarReinicio(reservas: number, cubiertos: number) {
    try {
        // Opción 1: Guardar en una tabla de notificaciones (si existe)
        // await pool.query(
        //    `INSERT INTO notificaciones (titulo, mensaje, leido) 
        //     VALUES (?, ?, FALSE)`,
        //    [
        //        '🔄 Reinicio Diario Completado',
        //        `${reservas} reservas archivadas, ${cubiertos} cubiertos liberados. Nuevo día comenzó.`
        //    ]
        // );
        
        // Opción 2: Enviar WhatsApp al admin (opcional)
        // await enviarWhatsAppAdmin(`Reinicio diario completado`);
        
        console.log('Notificación de reinicio omitida (tabla no configurada).');
    } catch (error) {
        console.error('Error al notificar reinicio:', error);
    }
}
