import type { APIRoute } from 'astro';
import pool from '../../../../lib/db';

export const PUT: APIRoute = async ({ params, request, cookies }) => {
    try {
        const { id } = params;
        const { estado } = await request.json();
        
        // Verificar sesión
        const session = cookies.get('session');
        if (!session || session.value !== 'authenticated') {
            return new Response(JSON.stringify({
                success: false,
                error: 'No autorizado'
            }), { status: 401 });
        }
        
        const userId = cookies.get('user_id')?.value;
        const userRole = cookies.get('user_role')?.value || 'mesero';
        
        // Verificar que el pedido existe
        const pedidoData = await pool.query(
            'SELECT id, estado FROM pedidos_cocina_grupo WHERE id = ?',
            [id]
        ) as any[];
        const pedido = pedidoData[0][0];
        
        if (!pedido) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Pedido no encontrado'
            }), { status: 404 });
        }
        
        // Actualizar estado
        let queryStr = 'UPDATE pedidos_cocina_grupo SET estado = ?';
        const paramsArray: any[] = [estado];
        
        // Si es entregado, registrar quién y cuándo
        if (estado === 'entregado') {
            queryStr += ', entregado_at = NOW(), entregado_por = ?';
            paramsArray.push(userId || null);
        }
        
        queryStr += ' WHERE id = ?';
        paramsArray.push(id);
        
        await pool.query(queryStr, paramsArray);
        
        // Registrar en logs
        await pool.query(
            `INSERT INTO logs_actividad 
             (usuario_id, accion, tabla_afectada, registro_id, detalles) 
             VALUES (?, ?, 'pedidos_cocina_grupo', ?, ?)`,
            [
                userId || null,
                estado === 'entregado' ? 'PEDIDO_ENTREGADO' : 
                estado === 'listo' ? 'PLATO_LISTO' : 'PEDIDO_PREPARANDO',
                id,
                JSON.stringify({ estado, pedido_id: id })
            ]
        );
        
        return new Response(JSON.stringify({
            success: true,
            mensaje: `Estado actualizado a "${estado}"`
        }), { status: 200 });
        
    } catch (error: any) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al actualizar estado'
        }), { status: 500 });
    }
};
