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
        
        // Verificar que el pedido existe
        const [pedidosData] = await pool.query(
            'SELECT id, estado FROM pedidos_cocina WHERE id = ?',
            [id]
        ) as any[];
        
        const pedido = pedidosData[0];
        
        if (!pedido) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Pedido no encontrado'
            }), { status: 404 });
        }
        
        // Actualizar estado
        await pool.query(
            'UPDATE pedidos_cocina SET estado = ? WHERE id = ?',
            [estado, id]
        );
        
        return new Response(JSON.stringify({
            success: true,
            mensaje: `Estado actualizado a "${estado}"`
        }), { status: 200 });
        
    } catch (error: any) {
        console.error('Error al actualizar pedido:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al actualizar estado'
        }), { status: 500 });
    }
};
