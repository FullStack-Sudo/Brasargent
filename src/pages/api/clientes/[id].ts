import type { APIRoute } from 'astro';
import pool from '../../../lib/db';

export const DELETE: APIRoute = async ({ params }) => {
    const id = params.id;
    
    if (!id) {
        return new Response(JSON.stringify({
            success: false,
            error: 'ID de cliente no proporcionado'
        }), { status: 400 });
    }

    try {
        const [result] = await pool.query(
            'DELETE FROM clientes WHERE id = ?',
            [id]
        ) as any[];

        if (result.affectedRows === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Cliente no encontrado'
            }), { status: 404 });
        }

        return new Response(JSON.stringify({
            success: true,
            mensaje: 'Cliente eliminado correctamente'
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error: any) {
        console.error('Error al eliminar cliente:', error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Error interno al eliminar el cliente'
        }), { status: 500 });
    }
};
