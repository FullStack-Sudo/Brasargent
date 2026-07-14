import type { APIRoute } from 'astro';
import pool from '../../../lib/db';

export const GET: APIRoute = async ({ cookies }) => {
    try {
        // Verificar sesión admin
        const session = cookies.get('session');
        if (!session || session.value !== 'authenticated') {
            return new Response(JSON.stringify({
                success: false,
                error: 'No autorizado'
            }), { status: 401 });
        }
        
        const [config] = await pool.query(
            'SELECT clave, valor, tipo, descripcion FROM configuracion_sistema ORDER BY id'
        );
        
        return new Response(JSON.stringify({
            success: true,
            data: config
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
    } catch (error: any) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al obtener configuración'
        }), { status: 500 });
    }
};

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        // Verificar sesión admin
        const session = cookies.get('session');
        if (!session || session.value !== 'authenticated') {
            return new Response(JSON.stringify({
                success: false,
                error: 'No autorizado'
            }), { status: 401 });
        }
        
        const { clave, valor } = await request.json();
        
        if (!clave) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Clave requerida'
            }), { status: 400 });
        }
        
        await pool.query(
            `UPDATE configuracion_sistema 
             SET valor = ?, updated_at = NOW() 
             WHERE clave = ?`,
            [valor, clave]
        );
        
        return new Response(JSON.stringify({
            success: true,
            mensaje: 'Configuración actualizada'
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
    } catch (error: any) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al actualizar configuración'
        }), { status: 500 });
    }
};
