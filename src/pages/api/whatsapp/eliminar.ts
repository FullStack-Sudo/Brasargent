import type { APIRoute } from 'astro';
import pool from '../../../lib/db';

export const POST: APIRoute = async ({ request, cookies }) => {
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

        const body = await request.json();
        let ids: number[] = [];

        if (Array.isArray(body.ids)) {
            ids = body.ids.map((id: any) => Number(id)).filter((id: number) => !isNaN(id) && id > 0);
        } else if (body.id) {
            const parsed = Number(body.id);
            if (!isNaN(parsed) && parsed > 0) {
                ids = [parsed];
            }
        }

        if (ids.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Selecciona al menos un mensaje válido para eliminar'
            }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const [result] = await pool.query(
            'DELETE FROM logs_whatsapp WHERE id IN (?)',
            [ids]
        ) as any[];

        const affectedRows = result?.affectedRows || 0;

        return new Response(JSON.stringify({
            success: true,
            mensaje: affectedRows === 1 ? 'Mensaje eliminado correctamente' : `${affectedRows} mensajes eliminados correctamente`,
            count: affectedRows
        }), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('❌ Error al eliminar mensajes de whatsapp:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al eliminar mensajes'
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export const DELETE = POST;
