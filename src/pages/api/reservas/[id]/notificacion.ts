import type { APIRoute } from 'astro';
import pool from '../../../../lib/db';

export const POST: APIRoute = async ({ params, request }) => {
    try {
        const { id } = params;
        const data = await request.json();
        
        if (!id) {
            return new Response(JSON.stringify({ success: false, error: 'ID de reserva requerido' }), { status: 400 });
        }
        
        // Asumiendo que podemos guardar un registro de notificaciones o simplemente devolver success. 
        // Por ahora devolveremos true para que UI actúe
        
        return new Response(JSON.stringify({
            success: true,
            mensaje: 'Notificación registrada'
        }), { status: 200 });
        
    } catch (error: any) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al procesar'
        }), { status: 500 });
    }
};
