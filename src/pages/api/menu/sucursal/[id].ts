import type { APIRoute } from 'astro';
import { getMenuSucursal } from '../../../../lib/queries/menu';

export const GET: APIRoute = async ({ params }) => {
    const sucursalId = Number(params.id);
    
    if (isNaN(sucursalId)) {
        return new Response(JSON.stringify({ success: false, message: 'ID inválido' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const data = await getMenuSucursal(sucursalId);
        
        return new Response(JSON.stringify({
            success: true,
            data
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            message: 'Error al obtener el menú'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
