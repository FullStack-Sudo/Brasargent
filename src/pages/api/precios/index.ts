import type { APIRoute } from 'astro';
import { getPrecioCubierto } from '../../../lib/precios';

export const GET: APIRoute = async ({ url }) => {
    try {
        const sucursalId = parseInt(url.searchParams.get('sucursal_id') || '0');
        const fecha = url.searchParams.get('fecha') || '';
        const hora = url.searchParams.get('hora') || '12:00';
        
        if (!sucursalId || !fecha) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Datos incompletos'
            }), { status: 400 });
        }
        
        const precio = await getPrecioCubierto(sucursalId, fecha, hora);
        
        if (!precio) {
            return new Response(JSON.stringify({
                success: false,
                error: 'No se encontraron precios para esta fecha'
            }), { status: 404 });
        }
        
        return new Response(JSON.stringify({
            success: true,
            precio_adulto: precio.precio_adulto,
            precio_nino: precio.precio_nino,
            edad_minima: precio.edad_minima,
            edad_maxima: precio.edad_maxima
        }), { status: 200 });
        
    } catch (error: any) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al obtener precios'
        }), { status: 500 });
    }
};
