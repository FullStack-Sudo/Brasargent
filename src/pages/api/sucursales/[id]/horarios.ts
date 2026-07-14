import type { APIRoute } from 'astro';
import pool from '../../../../lib/db';

export const GET: APIRoute = async ({ params }) => {
    try {
        const { id } = params;
        
        const [rows] = await pool.query(
            `SELECT 
                id,
                nombre,
                horarios,
                permite_reservas,
                permite_cubiertos
             FROM sucursales 
             WHERE id = ?`,
            [id]
        ) as any[];
        
        const sucursal = rows[0];
        
        if (!sucursal) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Sucursal no encontrada'
            }), { status: 404 });
        }
        
        // Parsear horarios
        let horarios = {};
        try {
            horarios = typeof sucursal.horarios === 'string' 
                ? JSON.parse(sucursal.horarios) 
                : sucursal.horarios || {};
        } catch {
            horarios = {};
        }
        
        return new Response(JSON.stringify({
            success: true,
            data: {
                nombre: sucursal.nombre,
                horarios: horarios,
                permite_reservas: sucursal.permite_reservas === 1,
                permite_cubiertos: sucursal.permite_cubiertos === 1
            }
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
    } catch (error: any) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al obtener horarios'
        }), { status: 500 });
    }
};
