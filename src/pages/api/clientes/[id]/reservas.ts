import type { APIRoute } from 'astro';
import pool from '../../../../lib/db';

export const GET: APIRoute = async ({ params }) => {
    const id = params.id;
    
    if (!id) {
        return new Response(JSON.stringify({
            success: false,
            error: 'ID de cliente no proporcionado'
        }), { status: 400 });
    }

    try {
        // Obtener teléfono y código de país del cliente
        const [clienteRows] = await pool.query(
            'SELECT telefono, codigo_pais FROM clientes WHERE id = ?',
            [id]
        ) as any[];

        if (clienteRows.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Cliente no encontrado'
            }), { status: 404 });
        }

        const cliente = clienteRows[0];

        // Obtener historial de reservas de este cliente
        const [reservasRows] = await pool.query(`
            SELECT 
                r.id,
                r.fecha,
                r.hora,
                r.numero_personas,
                r.estado,
                s.nombre as sucursal_nombre
            FROM reservas r
            LEFT JOIN sucursales s ON r.sucursal_id = s.id
            WHERE r.telefono = ? AND r.codigo_pais = ?
            ORDER BY r.fecha DESC, r.hora DESC
        `, [cliente.telefono, cliente.codigo_pais]) as any[];

        return new Response(JSON.stringify({
            success: true,
            reservas: reservasRows
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error: any) {
        console.error('Error al obtener reservas del cliente:', error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Error interno al obtener el historial de reservas'
        }), { status: 500 });
    }
};
