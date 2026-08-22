import type { APIRoute } from 'astro';
import { openwa } from '../../../lib/whatsapp/openwa';

function getEnv(key: string): string | undefined {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env?.[key] !== undefined) {
        // @ts-ignore
        return import.meta.env[key];
    }
    return process.env[key];
}

export const GET: APIRoute = async ({ cookies }) => {
    try {
        // Verificar sesión admin
        const session = cookies.get('session');
        if (!session || session.value !== 'authenticated') {
            return new Response(JSON.stringify({
                connected: false,
                error: 'No autorizado'
            }), { 
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const info = await openwa.getSessionInfo();
        
        return new Response(JSON.stringify({
            connected: info.connected,
            session: info.session,
            phone: info.phone,
            pushName: info.pushName
        }), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({
            connected: false,
            error: error.message || 'Error al verificar sesión'
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
