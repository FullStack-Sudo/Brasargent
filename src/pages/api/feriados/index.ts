import type { APIRoute } from 'astro';
import { query } from '../../../lib/db';

export const GET: APIRoute = async () => {
    try {
        // Obtener días feriados configurados en la base de datos
        const feriados = await query(
            'SELECT fecha, descripcion FROM dias_festivos WHERE sin_reservas = TRUE ORDER BY fecha'
        ) as any[];
        
        const fechasList = (feriados || []).map((f: any) => {
            if (f.fecha instanceof Date) {
                return f.fecha.toISOString().split('T')[0];
            }
            return String(f.fecha).split('T')[0];
        });

        return new Response(JSON.stringify({
            success: true,
            feriados: fechasList
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error: any) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al obtener feriados'
        }), { status: 500 });
    }
};
