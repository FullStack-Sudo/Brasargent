import type { APIRoute } from 'astro';
import { openwa } from '../../../lib/whatsapp/openwa';

export const GET: APIRoute = async ({ cookies }) => {
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

        const qr = await openwa.getQR();

        return new Response(JSON.stringify({
            success: true,
            qr: qr || null
        }), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al obtener QR'
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
