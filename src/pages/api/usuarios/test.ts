import type { APIRoute } from 'astro';
import pool from '../../../lib/db';

export const GET: APIRoute = async () => {
    try {
        // Probar conexión a la base de datos
        const [result] = await pool.query('SELECT 1 as connection_test') as any[];
        
        return new Response(JSON.stringify({
            success: true,
            mensaje: 'Conexión a la base de datos exitosa',
            test: result
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error: any) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error de conexión a la base de datos'
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
};
