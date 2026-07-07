import type { APIRoute } from 'astro';
import { getSucursalesActivas } from '../../../lib/queries/menu';

export const GET: APIRoute = async ({ request }) => {
    try {
        const sucursales = await getSucursalesActivas();
        
        return new Response(JSON.stringify({
            success: true,
            data: sucursales
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            message: 'Error al obtener sucursales'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
