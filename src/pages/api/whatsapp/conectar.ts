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

        // Iniciar sesión y obtener QR
        const result = await openwa.startSession();
        
        if (!result.success) {
            return new Response(JSON.stringify({
                success: false,
                error: result.error || 'Error al iniciar sesión'
            }), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({
            success: true,
            qr: result.qr || null,
            mensaje: 'Sesión iniciada. Escanea el QR con WhatsApp.'
        }), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al conectar'
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
