import type { APIRoute } from 'astro';
import { openwa } from '../../../lib/whatsapp/openwa';

export const POST: APIRoute = async ({ cookies }) => {
    try {
        // Verificar sesión admin
        const session = cookies.get('session');
        if (!session || session.value !== 'authenticated') {
            return new Response(JSON.stringify({
                success: false,
                error: 'No autorizado'
            }), { 
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Cerrar sesión de OpenWA
        const result = await openwa.logout();
        
        if (!result.success) {
            return new Response(JSON.stringify({
                success: false,
                error: result.error || 'Error al cerrar sesión'
            }), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({
            success: true,
            mensaje: 'Sesión de WhatsApp cerrada correctamente'
        }), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al cerrar sesión'
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
