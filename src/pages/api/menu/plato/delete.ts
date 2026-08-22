import type { APIRoute } from 'astro';
import { eliminarPlato } from '../../../../lib/queries/menu';

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        // Verificar sesión admin
        const session = cookies.get('session');
        if (!session || session.value !== 'authenticated') {
            return new Response(JSON.stringify({
                success: false,
                message: 'No autorizado'
            }), { 
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const body = await request.json();
        const platoId = Number(body.plato_id);
        const sucursalId = body.sucursal_id ? Number(body.sucursal_id) : undefined;

        if (!platoId || isNaN(platoId) || platoId <= 0) {
            return new Response(JSON.stringify({ 
                success: false, 
                message: 'ID de plato no válido' 
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const success = await eliminarPlato(platoId, sucursalId);

        return new Response(JSON.stringify({
            success,
            message: success ? 'Plato eliminado del menú exitosamente' : 'Error al eliminar el plato'
        }), {
            status: success ? 200 : 500,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error: any) {
        console.error('❌ Error al eliminar plato:', error);
        return new Response(JSON.stringify({
            success: false,
            message: error.message || 'Error interno del servidor'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export const DELETE = POST;
