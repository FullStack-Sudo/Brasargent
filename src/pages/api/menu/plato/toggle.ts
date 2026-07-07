import type { APIRoute } from 'astro';
import { toggleDisponibilidad } from '../../../../lib/queries/menu';

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { sucursal_id, plato_id, disponible } = body;
        
        if (!sucursal_id || !plato_id || typeof disponible !== 'boolean') {
            return new Response(JSON.stringify({ success: false, message: 'Datos inválidos' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const success = await toggleDisponibilidad(sucursal_id, plato_id, disponible);
        
        return new Response(JSON.stringify({
            success,
            message: success ? 'Estado actualizado' : 'Error al actualizar',
            disponible
        }), {
            status: success ? 200 : 500,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            message: 'Error interno del servidor'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
