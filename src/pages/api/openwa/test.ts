import type { APIRoute } from 'astro';
import { openwaMulti } from '../../../lib/whatsapp/openwa-multi';

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
        const { sucursal_id, telefono, mensaje } = body || {};

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

        if (!telefono) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Teléfono requerido'
            }), { status: 400 });
        }

        const texto = mensaje || '🧪 Prueba de conexión BRASARGENT WhatsApp';
        const result = await openwaMulti.sendMessage(sucursalId, telefono, texto);

        return new Response(JSON.stringify(result), { status: result.success ? 200 : 400 });

    } catch (error: any) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al enviar mensaje de prueba'
        }), { status: 500 });
    }
};
