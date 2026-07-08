import type { APIRoute } from 'astro';
import pool from '../../../lib/db';

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        // Verificar sesión admin
        const session = cookies.get('session');
        if (!session || session.value !== 'authenticated') {
            return new Response(JSON.stringify({
                success: false,
                error: 'No autorizado'
            }), { status: 401 });
        }
        
        const { sucursal_id, capacidad_total } = await request.json();
        
        if (!sucursal_id || !capacidad_total || capacidad_total < 1) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Datos inválidos'
            }), { status: 400 });
        }
        
        // Actualizar capacidad
        await pool.query(
            `UPDATE sucursales 
             SET capacidad_total = ?,
                 cubiertos_disponibles = ? - cubiertos_ocupados
             WHERE id = ?`,
            [capacidad_total, capacidad_total, sucursal_id]
        );
        
        // Obtener datos actualizados
        const [sucursalData] = await pool.query(
            `SELECT 
                capacidad_total,
                cubiertos_disponibles,
                cubiertos_ocupados
             FROM sucursales 
             WHERE id = ?`,
            [sucursal_id]
        ) as any[];
        
        return new Response(JSON.stringify({
            success: true,
            mensaje: 'Capacidad actualizada',
            data: sucursalData[0]
        }), { status: 200 });
        
    } catch (error: any) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al actualizar capacidad'
        }), { status: 500 });
    }
};
