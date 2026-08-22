import { query } from './db';

// ============================================
// TIEMPOS ESTIMADOS POR TIPO DE SERVICIO (MINUTOS)
// ============================================

const TIEMPOS_ESTIMADOS: Record<string, number> = {
    'rodizio': 120,      // 2 horas
    'fast_grill': 60,    // 1 hora
    'carta': 90,         // 1.5 horas
    'evento': 180,       // 3 horas
    'default': 120       // 2 horas por defecto
};

// ============================================
// CALCULAR TIEMPO DE LIBERACIÓN
// ============================================

export function calcularTiempoLiberacion(
    tipoServicio: string,
    numPersonas: number,
    fechaLlegada: Date
): Date {
    // Obtener tiempo base por tipo de servicio
    const clave = (tipoServicio || 'default').toLowerCase().replace(/\s+/g, '_');
    let minutos = TIEMPOS_ESTIMADOS[clave] || TIEMPOS_ESTIMADOS['default'];
    
    // Añadir tiempo extra por grupo grande
    if (numPersonas > 30) {
        minutos += 90;
    } else if (numPersonas > 20) {
        minutos += 60;
    } else if (numPersonas > 10) {
        minutos += 30;
    }
    
    // Calcular fecha de liberación
    const fechaLiberacion = new Date(fechaLlegada.getTime() + minutos * 60 * 1000);
    
    return fechaLiberacion;
}

// ============================================
// VERIFICAR RESERVAS PARA LIBERAR AUTOMÁTICAMENTE
// ============================================

export async function verificarReservasParaLiberar(): Promise<void> {
    try {
        const ahora = new Date();
        const ahoraStr = ahora.toISOString().slice(0, 19).replace('T', ' ');
        
        // Obtener reservas que ya superaron su tiempo estimado de liberación
        const [rows] = await query(`
            SELECT 
                r.id,
                r.sucursal_id,
                r.cubiertos_reservados,
                r.nombre_cliente,
                s.nombre AS sucursal_nombre
            FROM reservas r
            JOIN sucursales s ON r.sucursal_id = s.id
            WHERE r.estado = 'en_curso'
            AND r.hora_liberacion_estimada IS NOT NULL
            AND r.hora_liberacion_estimada <= ?
            AND r.liberacion_automatica = FALSE
        `, [ahoraStr]) as any[];
        
        const reservas = Array.isArray(rows) ? rows : [];

        if (reservas.length === 0) {
            return;
        }
        
        console.log(`🔍 ${reservas.length} reservas listas para liberar automáticamente`);
        
        for (const reserva of reservas) {
            const cubiertos = reserva.cubiertos_reservados || 0;

            // Liberar cubiertos automáticamente
            await query(
                `UPDATE sucursales 
                 SET 
                     cubiertos_ocupados = GREATEST(0, cubiertos_ocupados - ?),
                     cubiertos_disponibles = LEAST(capacidad_total, cubiertos_disponibles + ?)
                 WHERE id = ?`,
                [cubiertos, cubiertos, reserva.sucursal_id]
            );
            
            // Actualizar estado de la reserva
            await query(
                `UPDATE reservas 
                 SET estado = 'completada',
                     liberacion_automatica = TRUE,
                     liberado_en = NOW(),
                     mensaje_admin = CONCAT('Liberado automáticamente el ', NOW())
                 WHERE id = ?`,
                [reserva.id]
            );
            
            console.log(`✅ Liberados ${cubiertos} cubiertos de ${reserva.nombre_cliente} (${reserva.sucursal_nombre})`);
        }
    } catch (error) {
        console.error('❌ Error en liberación automática de cubiertos:', error);
    }
}

// ============================================
// PREDECIR DISPONIBILIDAD FUTURA
// ============================================

export async function predecirDisponibilidad(sucursalId: number): Promise<any[]> {
    try {
        const ahora = new Date();
        const proximasHoras = new Date(ahora.getTime() + 4 * 60 * 60 * 1000); // Próximas 4 horas
        const proximasHorasStr = proximasHoras.toISOString().slice(0, 19).replace('T', ' ');

        const [rows] = await query(`
            SELECT 
                r.id,
                r.nombre_cliente,
                r.numero_personas,
                r.cantidad_ninos,
                r.cubiertos_reservados,
                r.hora_liberacion_estimada,
                r.hora_llegada_estimada,
                GREATEST(0, TIMESTAMPDIFF(MINUTE, NOW(), r.hora_liberacion_estimada)) AS minutos_restantes
            FROM reservas r
            WHERE r.sucursal_id = ?
            AND r.estado IN ('confirmada', 'en_curso')
            AND r.hora_liberacion_estimada > NOW()
            AND r.hora_liberacion_estimada < ?
            ORDER BY r.hora_liberacion_estimada ASC
        `, [sucursalId, proximasHorasStr]) as any[];
        
        return Array.isArray(rows) ? rows : [];
    } catch (error) {
        console.error('Error al predecir disponibilidad:', error);
        return [];
    }
}
