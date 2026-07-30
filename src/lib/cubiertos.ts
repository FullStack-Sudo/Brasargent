import { query } from './db';

// ============================================
// ACTUALIZAR CUBIERTOS AL APROBAR RESERVA
// ============================================

export async function actualizarCubiertosAlAprobar(
    sucursalId: number,
    personas: number
): Promise<{ success: boolean; message: string }> {
    try {
        // Verificar si hay suficientes cubiertos
        const [rows] = await query(
            'SELECT capacidad_total, cubiertos_disponibles FROM sucursales WHERE id = ?',
            [sucursalId]
        ) as any[];

        const sucursal = rows && rows.length > 0 ? rows[0] : null;

        if (!sucursal) {
            return { success: false, message: 'Sucursal no encontrada' };
        }

        if (sucursal.cubiertos_disponibles < personas) {
            return {
                success: false,
                message: `No hay suficientes cubiertos. Disponibles: ${sucursal.cubiertos_disponibles}`
            };
        }

        // Actualizar cubiertos
        await query(
            `UPDATE sucursales 
             SET 
                 cubiertos_ocupados = cubiertos_ocupados + ?,
                 cubiertos_disponibles = cubiertos_disponibles - ?
             WHERE id = ?`,
            [personas, personas, sucursalId]
        );

        // Registrar en logs
        await query(
            `INSERT INTO logs_actividad 
             (usuario_id, accion, tabla_afectada, registro_id, detalles) 
             VALUES (?, 'CUBIERTOS_ACTUALIZADOS', 'sucursales', ?, ?)`,
            [
                1,
                sucursalId,
                JSON.stringify({
                    cubiertos_ocupados: personas,
                    accion: 'aprobar_reserva'
                })
            ]
        );

        return { success: true, message: 'Cubiertos actualizados correctamente' };

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
        // Verificar que no se vayan a negativo
        const [rows] = await query(
            'SELECT cubiertos_ocupados FROM sucursales WHERE id = ?',
            [sucursalId]
        ) as any[];

        const sucursal = rows && rows.length > 0 ? rows[0] : null;

        if (!sucursal) {
            return { success: false, message: 'Sucursal no encontrada' };
        }

        const nuevosOcupados = Math.max(0, sucursal.cubiertos_ocupados - personas);

        // Actualizar cubiertos
        await query(
            `UPDATE sucursales 
             SET 
                 cubiertos_ocupados = ?,
                 cubiertos_disponibles = capacidad_total - ?
             WHERE id = ?`,
            [nuevosOcupados, nuevosOcupados, sucursalId]
        );

        return { success: true, message: 'Cubiertos liberados correctamente' };

    } catch (error: any) {
        console.error('Error al liberar cubiertos:', error);
        return { success: false, message: error.message || 'Error al liberar cubiertos' };
    }
}

// ============================================
// OBTENER ESTADÍSTICAS DE CUBIERTOS (CON AUTO-SINCRONIZACIÓN Y ESTADOS ACTIVOS)
// ============================================

export async function getEstadisticasCubiertos(sucursalId?: number) {
    const where = sucursalId ? 'WHERE s.id = ?' : '';
    const params = sucursalId ? [sucursalId] : [];

    // Calcula de forma dinámica basándose en reservas activas (confirmada o en_curso)
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

    // Auto-sincroniza las columnas cubiertos_ocupados y cubiertos_disponibles en la tabla sucursales
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
