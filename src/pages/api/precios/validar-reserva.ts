import type { APIRoute } from 'astro';
import { permiteReservas } from '../../../lib/precios';

export const GET: APIRoute = async ({ url }) => {
    try {
        const sucursalId = parseInt(url.searchParams.get('sucursal_id') || '0');
        const fecha = url.searchParams.get('fecha') || '';

        if (!sucursalId || !fecha) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Faltan parámetros sucursal_id o fecha'
            }), { status: 400 });
        }

        const validacion = await permiteReservas(sucursalId, fecha);

        return new Response(JSON.stringify({
            success: true,
            permite_reservas: validacion.permite,
            motivo: validacion.motivo || null
        }), { status: 200 });

    } catch (error: any) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al validar reservas para esta fecha'
        }), { status: 500 });
    }
};
