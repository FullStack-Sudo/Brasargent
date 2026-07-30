import type { APIRoute } from 'astro';
import { ejecutarReinicioDiario } from '../../../lib/resetDaily';

export const POST: APIRoute = async ({ cookies, request }) => {
    try {
        // Verificar sesión admin
        const session = cookies.get('session');
        if (!session || session.value !== 'authenticated') {
            return new Response(JSON.stringify({
                success: false,
                error: 'No autorizado'
            }), { status: 401 });
        }
        
        // Verificar token CSRF (opcional)
        // ...
        
        const result = await ejecutarReinicioDiario();
        
        if (result.success) {
            return new Response(JSON.stringify({
                success: true,
                mensaje: result.mensaje,
                data: {
                    reservas_archivadas: result.reservas_archivadas,
                    cubiertos_liberados: result.cubiertos_liberados
                }
            }), { status: 200 });
        } else {
            return new Response(JSON.stringify({
                success: false,
                error: result.mensaje
            }), { status: 500 });
        }
        
    } catch (error: any) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al ejecutar reinicio'
        }), { status: 500 });
    }
};
