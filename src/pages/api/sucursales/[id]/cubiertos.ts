import type { APIRoute } from 'astro';
import pool from '../../../../lib/db';

export const GET: APIRoute = async ({ params }) => {
    try {
        const { id } = params;
        
        if (!id) {
            return new Response(JSON.stringify({
                success: false,
                error: 'ID de sucursal requerido'
            }), { status: 400 });
        }
        
        const [sucursal] = await pool.query(
            `SELECT 
                id,
                nombre,
                capacidad_total,
                cubiertos_disponibles,
                cubiertos_ocupados
             FROM sucursales 
             WHERE id = ? AND activo = 1`,
            [id]
        ) as any[];
        
        if (!sucursal || sucursal.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Sucursal no encontrada'
            }), { status: 404 });
        }
        
        const sucursalData = sucursal[0];
        const porcentaje_ocupacion = Math.round((sucursalData.cubiertos_ocupados / sucursalData.capacidad_total) * 100);
        
        return new Response(JSON.stringify({
            success: true,
            data: {
                ...sucursalData,
                porcentaje_ocupacion,
                estado_color: porcentaje_ocupacion > 80 ? '#ef4444' :
                              porcentaje_ocupacion > 60 ? '#f59e0b' : '#10b981'
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
            error: error.message || 'Error al obtener cubiertos'
        }), { status: 500 });
    }
};
