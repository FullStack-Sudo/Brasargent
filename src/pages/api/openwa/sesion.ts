import type { APIRoute } from 'astro';
import { openwaMulti } from '../../../lib/whatsapp/openwa-multi';

// ============================================
// GET - Obtener estado de sesión
// ============================================

export const GET: APIRoute = async ({ cookies, url, locals }) => {
    try {
        const session = cookies.get('session');
        if (!session || session.value !== 'authenticated') {
            return new Response(JSON.stringify({
                success: false,
                error: 'No autorizado'
            }), { status: 401 });
        }

        // Determinar sucursal desde locals o cookies
        const usuario = locals.usuario;
        const esSuperAdmin = usuario?.es_super_admin === true || cookies.get('es_super_admin')?.value === 'true';
        const userSucursal = usuario?.sucursal_id || cookies.get('user_sucursal')?.value;
        
        let sucursalId = parseInt(String(userSucursal || '0'), 10);
        
        // Super admin puede consultar cualquier sucursal
        if (esSuperAdmin) {
            const urlSucursal = url.searchParams.get('sucursal_id');
            if (urlSucursal) sucursalId = parseInt(urlSucursal, 10);
        }

        if (!sucursalId) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Sucursal no especificada'
            }), { status: 400 });
        }

        const result = await openwaMulti.getQR(sucursalId);
        
        return new Response(JSON.stringify(result), { status: 200 });

    } catch (error: any) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al consultar estado de sesión'
        }), { status: 500 });
    }
};

// ============================================
// POST - Iniciar sesión / Obtener QR / Desconectar
// ============================================

export const POST: APIRoute = async ({ cookies, request, locals }) => {
    try {
        const session = cookies.get('session');
        if (!session || session.value !== 'authenticated') {
            return new Response(JSON.stringify({
                success: false,
                error: 'No autorizado'
            }), { status: 401 });
        }

        const body = await request.json();
        const { sucursal_id, accion } = body || {};

        const usuario = locals.usuario;
        const esSuperAdmin = usuario?.es_super_admin === true || cookies.get('es_super_admin')?.value === 'true';
        const userSucursal = usuario?.sucursal_id || cookies.get('user_sucursal')?.value;

        let sucursalId = parseInt(String(sucursal_id || userSucursal || '0'), 10);

        if (!esSuperAdmin && userSucursal) {
            sucursalId = parseInt(String(userSucursal), 10);
        }

        if (!sucursalId) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Sucursal no especificada'
            }), { status: 400 });
        }

        if (accion === 'conectar') {
            const result = await openwaMulti.createOrGetSession(sucursalId);
            return new Response(JSON.stringify(result), { status: 200 });
        }

        if (accion === 'desconectar') {
            const result = await openwaMulti.disconnect(sucursalId);
            return new Response(JSON.stringify(result), { status: 200 });
        }

        return new Response(JSON.stringify({
            success: false,
            error: 'Acción no válida'
        }), { status: 400 });

    } catch (error: any) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error en operación de sesión'
        }), { status: 500 });
    }
};
