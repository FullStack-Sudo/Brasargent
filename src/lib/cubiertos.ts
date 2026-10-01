import { query } from './db';

// ============================================
// OBTENER CUBIERTOS DISPONIBLES EN TIEMPO REAL POR FECHA
// ============================================

export async function getCubiertosDisponibles(sucursalId: number, fechaTarget?: string): Promise<{
    disponibles: number;
    ocupados: number;
    total: number;
}> {
    const hoy = new Date().toISOString().split('T')[0];
    const targetFecha = fechaTarget || hoy;

    const [sucursalRows] = await query(
        `SELECT 
            capacidad_total,
            cubiertos_disponibles,
            cubiertos_ocupados
         FROM sucursales 
         WHERE id = ?`,
        [sucursalId]
    ) as any[];

    const sucursal = Array.isArray(sucursalRows) && sucursalRows.length > 0 ? sucursalRows[0] : null;

    if (!sucursal) {
        return { disponibles: 0, ocupados: 0, total: 0 };
    }

    // 🔴 RECALCULAR en tiempo real desde reservas confirmadas y en curso PARA LA FECHA ESPECÍFICA
    const [reservasRows] = await query(
        `SELECT COALESCE(SUM(cubiertos_reservados), 0) as total
         FROM reservas 
         WHERE sucursal_id = ? 
         AND fecha = ?
         AND estado IN ('confirmada', 'en_curso')`,
        [sucursalId, targetFecha]
    ) as any[];

    const reservas = Array.isArray(reservasRows) && reservasRows.length > 0 ? reservasRows[0] : null;
    const ocupadosReales = parseInt(reservas?.total || '0', 10);
    const total = parseInt(sucursal.capacidad_total || '0', 10);
    const disponibles = Math.max(0, total - ocupadosReales);

    // Si la fecha es hoy, sincronizar las columnas en sucursales
    if (targetFecha === hoy) {
        await query(
            `UPDATE sucursales 
             SET 
                 cubiertos_ocupados = ?,
                 cubiertos_disponibles = ?
             WHERE id = ?`,
            [ocupadosReales, disponibles, sucursalId]
        );
    }

    // También actualizar/sincronizar en cubiertos_por_fecha
    try {
        await query(
            `INSERT INTO cubiertos_por_fecha
                (sucursal_id, fecha, capacidad_total, cubiertos_ocupados, cubiertos_disponibles)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                cubiertos_ocupados = VALUES(cubiertos_ocupados),
                cubiertos_disponibles = VALUES(cubiertos_disponibles)`,
            [sucursalId, targetFecha, total, ocupadosReales, disponibles]
        );
    } catch (e) {}

    return {
        disponibles: disponibles,
        ocupados: ocupadosReales,
        total: total
    };
}

// ============================================
// VERIFICAR SI HAY CUBIERTOS SUFICIENTES
// ============================================

export async function verificarCubiertosSuficientes(
    sucursalId: number,
    personas: number,
    fechaTarget?: string
): Promise<{ success: boolean; message: string; disponibles: number }> {
    // 🔴 OBTENER DATOS EN TIEMPO REAL PARA LA FECHA ESPECÍFICA
    const stats = await getCubiertosDisponibles(sucursalId, fechaTarget);
    
    console.log(`🔍 Verificando cubiertos para sucursal ${sucursalId} (Fecha: ${fechaTarget || 'HOY'}):`);
    console.log(`   📊 Total: ${stats.total}`);
    console.log(`   📊 Ocupados: ${stats.ocupados}`);
    console.log(`   📊 Disponibles: ${stats.disponibles}`);
    console.log(`   📊 Necesarios: ${personas}`);

    if (stats.disponibles < personas) {
        return {
            success: false,
            message: `No hay suficientes cubiertos. Disponibles: ${stats.disponibles}, Necesarios: ${personas}`,
            disponibles: stats.disponibles
        };
    }

    return {
        success: true,
        message: `Cubiertos suficientes. Disponibles: ${stats.disponibles}`,
        disponibles: stats.disponibles
    };
}

// ============================================
// ACTUALIZAR CUBIERTOS AL APROBAR RESERVA
// ============================================

export async function actualizarCubiertosAlAprobar(
    sucursalId: number,
    personas: number,
    fechaTarget?: string
): Promise<{ success: boolean; message: string; nuevos_disponibles?: number }> {
    try {
        const stats = await getCubiertosDisponibles(sucursalId, fechaTarget);
        
        const nuevosOcupados = stats.ocupados + personas;
        const nuevosDisponibles = stats.total - nuevosOcupados;

        if (nuevosDisponibles < 0) {
            return {
                success: false,
                message: `No hay suficientes cubiertos. Disponibles: ${stats.disponibles}`
            };
        }

        const hoy = new Date().toISOString().split('T')[0];
        const targetFecha = fechaTarget || hoy;

        if (targetFecha === hoy) {
            await query(
                `UPDATE sucursales 
                 SET 
                     cubiertos_ocupados = ?,
                     cubiertos_disponibles = ?
                 WHERE id = ?`,
                [nuevosOcupados, nuevosDisponibles, sucursalId]
            );
        }

        try {
            await query(
                `INSERT INTO cubiertos_por_fecha
                    (sucursal_id, fecha, capacidad_total, cubiertos_ocupados, cubiertos_disponibles)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    cubiertos_ocupados = VALUES(cubiertos_ocupados),
                    cubiertos_disponibles = VALUES(cubiertos_disponibles)`,
                [sucursalId, targetFecha, stats.total, nuevosOcupados, nuevosDisponibles]
            );
        } catch (e) {}

        return {
            success: true,
            message: `Cubiertos actualizados correctamente`,
            nuevos_disponibles: nuevosDisponibles
        };

    } catch (error: any) {
        console.error('Error al actualizar cubiertos:', error);
        return { success: false, message: error.message || 'Error al actualizar cubiertos' };
    }
}

// ============================================
// LIBERAR CUBIERTOS AL CANCELAR RESERVA
// ============================================

export async function liberarCubiertosAlCancelar(
    sucursalId: number,
    personas: number,
    fechaTarget?: string
): Promise<{ success: boolean; message: string }> {
    try {
        const stats = await getCubiertosDisponibles(sucursalId, fechaTarget);
        const nuevosOcupados = Math.max(0, stats.ocupados - personas);
        const nuevosDisponibles = Math.min(stats.total, stats.total - nuevosOcupados);

        const hoy = new Date().toISOString().split('T')[0];
        const targetFecha = fechaTarget || hoy;

        if (targetFecha === hoy) {
            await query(
                `UPDATE sucursales 
                 SET 
                     cubiertos_ocupados = ?,
                     cubiertos_disponibles = ?
                 WHERE id = ?`,
                [nuevosOcupados, nuevosDisponibles, sucursalId]
            );
        }

        try {
            await query(
                `INSERT INTO cubiertos_por_fecha
                    (sucursal_id, fecha, capacidad_total, cubiertos_ocupados, cubiertos_disponibles)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    cubiertos_ocupados = VALUES(cubiertos_ocupados),
                    cubiertos_disponibles = VALUES(cubiertos_disponibles)`,
                [sucursalId, targetFecha, stats.total, nuevosOcupados, nuevosDisponibles]
            );
        } catch (e) {}

        return { success: true, message: 'Cubiertos liberados correctamente' };
    } catch (error: any) {
        console.error('Error al liberar cubiertos:', error);
        return { success: false, message: error.message || 'Error al liberar cubiertos' };
    }
}

// ============================================
// OBTENER ESTADÍSTICAS DE CUBIERTOS POR FECHA (POR DEFECTO HOY)
// ============================================

export async function getEstadisticasCubiertos(sucursalId?: number, fechaTarget?: string) {
    const hoy = new Date().toISOString().split('T')[0];
    const targetFecha = fechaTarget || hoy;

    const whereClause = sucursalId ? 'WHERE s.id = ? AND s.activo = 1' : 'WHERE s.activo = 1';
    const params = [targetFecha, ...(sucursalId ? [sucursalId] : [])];

    const [results] = await query(
        `SELECT 
            s.id,
            s.nombre,
            s.capacidad_total,
            COALESCE(
                SUM(
                    CASE 
                        WHEN r.estado IN ('confirmada', 'en_curso') AND r.fecha = ?
                        THEN r.cubiertos_reservados 
                        ELSE 0 
                    END
                ), 0
            ) AS cubiertos_ocupados,
            (
                s.capacidad_total - COALESCE(
                    SUM(
                        CASE 
                            WHEN r.estado IN ('confirmada', 'en_curso') AND r.fecha = ?
                            THEN r.cubiertos_reservados 
                            ELSE 0 
                        END
                    ), 0
                )
            ) AS cubiertos_disponibles
         FROM sucursales s
         LEFT JOIN reservas r ON s.id = r.sucursal_id
         ${whereClause}
         GROUP BY s.id, s.nombre, s.capacidad_total
         ORDER BY s.nombre`,
        [targetFecha, ...params]
    ) as any[];

    if (results && results.length > 0 && targetFecha === hoy) {
        for (const item of results) {
            await query(
                `UPDATE sucursales 
                 SET cubiertos_ocupados = ?, 
                     cubiertos_disponibles = ? 
                 WHERE id = ?`,
                [item.cubiertos_ocupados, item.cubiertos_disponibles, item.id]
            );
        }
    }

    return results || [];
}
