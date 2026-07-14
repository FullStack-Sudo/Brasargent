import type { APIRoute } from 'astro';
import pool from '../../../lib/db';

export const POST: APIRoute = async ({ cookies }) => {
    try {
        // Verificar sesión admin
        const session = cookies.get('session');
        if (!session || session.value !== 'authenticated') {
            return new Response(JSON.stringify({
                success: false,
                error: 'No autorizado'
            }), { status: 401 });
        }
        
        const hoy = new Date().toISOString().split('T')[0];
        
        // Obtener reservas del día actual
        const [reservas] = await pool.query(
            `SELECT id, numero_personas, sucursal_id 
             FROM reservas 
             WHERE fecha = ? AND estado IN ('pendiente', 'confirmada')`,
            [hoy]
        ) as any[];
        
        // Contar total de cubiertos a liberar
        let totalCubiertos = 0;
        const cubiertosPorSucursal: Record<number, number> = {};
        
        reservas.forEach((reserva: any) => {
            totalCubiertos += reserva.numero_personas || 0;
            const sucursalId = reserva.sucursal_id;
            if (!cubiertosPorSucursal[sucursalId]) {
                cubiertosPorSucursal[sucursalId] = 0;
            }
            cubiertosPorSucursal[sucursalId] += reserva.numero_personas || 0;
        });
        
        // Eliminar reservas del día
        await pool.query(
            `DELETE FROM reservas WHERE fecha = ? AND estado IN ('pendiente', 'confirmada')`,
            [hoy]
        );
        
        // Liberar cubiertos por sucursal
        for (const [sucursalId, cantidad] of Object.entries(cubiertosPorSucursal)) {
            await pool.query(
                `UPDATE sucursales 
                 SET 
                     cubiertos_ocupados = GREATEST(0, cubiertos_ocupados - ?),
                     cubiertos_disponibles = LEAST(capacidad_total, cubiertos_disponibles + ?)
                 WHERE id = ?`,
                [cantidad, cantidad, parseInt(sucursalId)]
            );
        }
        
        // Registrar en logs
        await pool.query(
            `INSERT INTO logs_actividad 
             (usuario_id, accion, tabla_afectada, detalles) 
             VALUES (?, 'REINICIO_RESERVAS', 'reservas', ?)`,
            [
                1, // admin_id
                JSON.stringify({
                    fecha: hoy,
                    reservas_eliminadas: reservas.length,
                    cubiertos_liberados: totalCubiertos
                })
            ]
        );
        
        return new Response(JSON.stringify({
            success: true,
            mensaje: 'Reservas reiniciadas exitosamente',
            reservas_eliminadas: reservas.length,
            cubiertos_liberados: totalCubiertos
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
    } catch (error: any) {
        console.error('Error al reiniciar reservas:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al reiniciar reservas'
        }), { status: 500 });
    }
};
