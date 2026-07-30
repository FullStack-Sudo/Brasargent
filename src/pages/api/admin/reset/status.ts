import type { APIRoute } from 'astro';
import { verificarReinicioHoy } from '../../../../lib/resetDaily';

export const GET: APIRoute = async ({ cookies }) => {
    try {
        const session = cookies.get('session');
        if (!session || session.value !== 'authenticated') {
            return new Response(JSON.stringify({
                success: false,
                error: 'No autorizado'
            }), { status: 401 });
        }
        
        const yaEjecutado = await verificarReinicioHoy();
        const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
        
        return new Response(JSON.stringify({
            success: true,
            data: {
                fecha: hoy,
                ya_ejecutado: yaEjecutado,
                proximo_reinicio: `${hoy} 01:00:00`
            }
        }), { status: 200 });
        
    } catch (error: any) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al verificar estado'
        }), { status: 500 });
    }
};
