import type { APIRoute } from 'astro';
import pool from '../../../../lib/db';

export const POST: APIRoute = async ({ params, request, cookies }) => {
    try {
        const { id } = params;
        const { activo } = await request.json();
        
        // Verificar sesión admin
        const session = cookies.get('session');
        if (!session || session.value !== 'authenticated') {
            return new Response(JSON.stringify({
                success: false,
                error: 'No autorizado'
            }), { status: 401 });
        }
        
        // Verificar que la sucursal existe
        const [sucursalRows] = await pool.query(
            'SELECT id, nombre FROM sucursales WHERE id = ?',
            [id]
        ) as any[];
        const sucursal = sucursalRows[0];
        
        if (!sucursal) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Sucursal no encontrada'
            }), { status: 404 });
        }
        
        // Actualizar estado
        await pool.query(
            'UPDATE sucursales SET activo = ? WHERE id = ?',
            [activo, id]
        );
        
        // Registrar en logs
        await pool.query(
            `INSERT INTO logs_actividad 
             (usuario_id, accion, tabla_afectada, registro_id, detalles) 
             VALUES (?, 'SUCURSAL_TOGGLE', 'sucursales', ?, ?)`,
            [
                1,
                id,
                JSON.stringify({
                    nombre: sucursal.nombre,
                    nuevo_estado: activo === 1 ? 'Activa' : 'Inactiva'
                })
            ]
        );
        
        return new Response(JSON.stringify({
            success: true,
            mensaje: `Sucursal ${activo === 1 ? 'activada' : 'desactivada'} exitosamente`
        }), { status: 200 });
        
    } catch (error: any) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al cambiar estado'
        }), { status: 500 });
    }
};
