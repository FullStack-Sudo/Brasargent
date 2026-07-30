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
        
        // Obtener total de reservas antes de borrar para el log
        const [reservas] = await pool.query(`SELECT COUNT(*) as total FROM reservas`) as any[];
        const totalReservas = reservas[0]?.total || 0;
        
        // 1. ELIMINAR TODAS LAS RESERVAS (presentes y futuras)
        await pool.query(`DELETE FROM reservas`);
        
        // 2. REINICIAR COMPLETAMENTE LA CAPACIDAD DE LAS SUCURSALES
        await pool.query(`
            UPDATE sucursales 
            SET 
                cubiertos_ocupados = 0,
                cubiertos_disponibles = capacidad_total
            WHERE activo = 1
        `);
        
        // Registrar en logs
        await pool.query(
            `INSERT INTO logs_actividad 
             (usuario_id, accion, tabla_afectada, detalles) 
             VALUES (?, 'REINICIO_TOTAL_RESERVAS', 'reservas', ?)`,
            [
                1, // admin_id
                JSON.stringify({
                    fecha_reinicio: new Date().toISOString(),
                    reservas_eliminadas: totalReservas,
                    descripcion: 'Se reiniciaron todas las reservas y se restableció la capacidad en todas las sucursales.'
                })
            ]
        );
        
        return new Response(JSON.stringify({
            success: true,
            mensaje: 'Todas las reservas han sido eliminadas y la capacidad se reinició exitosamente.',
            reservas_eliminadas: totalReservas,
            cubiertos_liberados: 'Todos'
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
