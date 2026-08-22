import { query } from './db';

// ============================================
// OBTENER CUBIERTOS DISPONIBLES EN TIEMPO REAL
// ============================================

export async function getCubiertosDisponibles(sucursalId: number): Promise<{
    disponibles: number;
    ocupados: number;
    total: number;
}> {
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

    // 🔴 RECALCULAR en tiempo real desde reservas confirmadas y en curso
    const [reservasRows] = await query(
        `SELECT COALESCE(SUM(cubiertos_reservados), 0) as total
         FROM reservas 
         WHERE sucursal_id = ? 
         AND estado IN ('confirmada', 'en_curso')`,
        [sucursalId]
    ) as any[];

    const reservas = Array.isArray(reservasRows) && reservasRows.length > 0 ? reservasRows[0] : null;
    const ocupadosReales = parseInt(reservas?.total || '0', 10);
    const total = parseInt(sucursal.capacidad_total || '0', 10);
    const disponibles = Math.max(0, total - ocupadosReales);

    // 🔴 ACTUALIZAR la base de datos con los valores sincronizados
    await query(
        `UPDATE sucursales 
         SET 
             cubiertos_ocupados = ?,
             cubiertos_disponibles = ?
         WHERE id = ?`,
        [ocupadosReales, disponibles, sucursalId]
    );

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
    personas: number
): Promise<{ success: boolean; message: string; disponibles: number }> {
    // 🔴 OBTENER DATOS EN TIEMPO REAL
    const stats = await getCubiertosDisponibles(sucursalId);
    
    // Logs de depuración
    console.log(`🔍 Verificando cubiertos para sucursal ${sucursalId}:`);
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
// ACTUALIZAR CUBIERTOS AL APROBAR RESERVA (CORREGIDO)
// ============================================

export async function actualizarCubiertosAlAprobar(
    sucursalId: number,
    personas: number
): Promise<{ success: boolean; message: string; nuevos_disponibles?: number }> {
    try {
        // 🔴 1. Verificar disponibilidad en tiempo real
        const verificacion = await verificarCubiertosSuficientes(sucursalId, personas);
        
        if (!verificacion.success) {
            return { 
                success: false, 
                message: verificacion.message 
            };
        }

        // 🔴 2. Obtener valores actuales sincronizados de la base de datos
        const stats = await getCubiertosDisponibles(sucursalId);

        // 🔴 3. Calcular nuevos valores
        const nuevosOcupados = stats.ocupados + personas;
        const nuevosDisponibles = stats.total - nuevosOcupados;

        // 🔴 4. Validar que no queden negativos (doble seguridad)
        if (nuevosDisponibles < 0) {
            return {
                success: false,
                message: `No hay suficientes cubiertos. Disponibles: ${stats.disponibles}`
            };
        }

        // 🔴 5. Actualizar sucursal
        await query(
            `UPDATE sucursales 
             SET 
                 cubiertos_ocupados = ?,
                 cubiertos_disponibles = ?
             WHERE id = ?`,
            [nuevosOcupados, nuevosDisponibles, sucursalId]
        );

        console.log(`✅ Cubiertos actualizados: ${stats.ocupados} → ${nuevosOcupados} ocupados`);
        console.log(`✅ Disponibles: ${stats.disponibles} → ${nuevosDisponibles}`);

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
    personas: number
): Promise<{ success: boolean; message: string }> {
    try {
        const stats = await getCubiertosDisponibles(sucursalId);
        const nuevosOcupados = Math.max(0, stats.ocupados - personas);
        const nuevosDisponibles = Math.min(stats.total, stats.total - nuevosOcupados);

        await query(
            `UPDATE sucursales 
             SET 
                 cubiertos_ocupados = ?,
                 cubiertos_disponibles = ?
             WHERE id = ?`,
            [nuevosOcupados, nuevosDisponibles, sucursalId]
        );

        return { success: true, message: 'Cubiertos liberados correctamente' };
    } catch (error: any) {
        console.error('Error al liberar cubiertos:', error);
        return { success: false, message: error.message || 'Error al liberar cubiertos' };
    }
}

// ============================================
// OBTENER ESTADÍSTICAS DE CUBIERTOS
// ============================================

export async function getEstadisticasCubiertos(sucursalId?: number) {
    const where = sucursalId ? 'WHERE s.id = ?' : '';
    const params = sucursalId ? [sucursalId] : [];

    const [results] = await query(
        `SELECT 
            s.id,
            s.nombre,
            s.capacidad_total,
            COALESCE(
                SUM(
                    CASE 
                        WHEN r.estado IN ('confirmada', 'en_curso') 
                        THEN r.cubiertos_reservados 
                        ELSE 0 
                    END
                ), 0
            ) AS cubiertos_ocupados,
            (
                s.capacidad_total - COALESCE(
                    SUM(
                        CASE 
                            WHEN r.estado IN ('confirmada', 'en_curso') 
                            THEN r.cubiertos_reservados 
                            ELSE 0 
                        END
                    ), 0
                )
            ) AS cubiertos_disponibles,
            ROUND(
                (
                    COALESCE(
                        SUM(
                            CASE 
                                WHEN r.estado IN ('confirmada', 'en_curso') 
                                THEN r.cubiertos_reservados 
                                ELSE 0 
                            END
                        ), 0
                    ) / s.capacidad_total
                ) * 100, 1
            ) AS porcentaje_ocupacion
         FROM sucursales s
         LEFT JOIN reservas r ON s.id = r.sucursal_id
         ${where}
         GROUP BY s.id, s.nombre, s.capacidad_total
         ORDER BY s.nombre`,
        params
    ) as any[];

    if (results && results.length > 0) {
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
