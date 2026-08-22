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

        // Reiniciar sesión y obtener nuevo QR
        const result = await openwa.restartSession();
        
        return new Response(JSON.stringify({
            success: result.success,
            qr: result.qr || null,
            mensaje: result.success ? 'Sesión reiniciada. Escanea el nuevo código QR.' : result.error
        }), { 
            status: result.success ? 200 : 500,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al reiniciar la sesión'
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
