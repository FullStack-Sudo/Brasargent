import type { APIRoute } from 'astro';
import pool from '../../../lib/db';

export const GET: APIRoute = async () => {
    try {
        const [result] = await pool.query(
            `SELECT COUNT(*) as count FROM clientes WHERE activo = 1`
        ) as any[];
        
        return new Response(JSON.stringify({
            success: true,
            count: result[0]?.count || 0
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            count: 0
        }), { status: 500 });
    }
};
