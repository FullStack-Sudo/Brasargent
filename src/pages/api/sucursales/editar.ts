import type { APIRoute } from 'astro';
import pool from '../../../lib/db';

export const PUT: APIRoute = async ({ request, cookies }) => {
    try {
        // Verificar sesión admin
        const session = cookies.get('session');
        if (!session || session.value !== 'authenticated') {
            return new Response(JSON.stringify({
                success: false,
                error: 'No autorizado'
            }), { status: 401 });
        }
        
        const data = await request.json();
        const { 
            id,
            nombre,
            concepto,
            direccion,
            telefono,
            capacidad_total,
            rating,
            activo,
            permite_reservas,
            permite_cubiertos,
            horarios
        } = data;
        
        // Validar campos obligatorios
        if (!id || !nombre || !direccion || !telefono) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Todos los campos obligatorios deben ser completados'
            }), { status: 400 });
        }
        
        // Actualizar sucursal
        await pool.query(
            `UPDATE sucursales 
             SET 
                nombre = ?,
                concepto = ?,
                direccion = ?,
                telefono = ?,
                capacidad_total = ?,
                rating = ?,
                activo = ?,
                permite_reservas = ?,
                permite_cubiertos = ?,
                horarios = ?,
                updated_at = NOW()
             WHERE id = ?`,
            [
                nombre,
                concepto || null,
                direccion,
                telefono,
                capacidad_total || 120,
                rating || 0,
                activo ? 1 : 0,
                permite_reservas ? 1 : 0,
                permite_cubiertos ? 1 : 0,
                JSON.stringify(horarios),
                id
            ]
        );
        
        // Registrar en logs (opcional si la tabla no existe, pero lo añadimos por código del usuario)
        // Revisaremos si existe tabla logs_actividad, si no, lo manejamos con un try-catch
        try {
            await pool.query(
                `INSERT INTO logs_actividad 
                 (usuario_id, accion, tabla_afectada, registro_id, detalles) 
                 VALUES (?, 'SUCURSAL_ACTUALIZADA', 'sucursales', ?, ?)`,
                [
                    1, // admin_id
                    id,
                    JSON.stringify({ nombre, capacidad_total })
                ]
            );
        } catch (e) {
            console.warn('No se pudo insertar en logs_actividad, ignorando.');
        }
        
        return new Response(JSON.stringify({
            success: true,
            mensaje: 'Sucursal actualizada exitosamente'
        }), { status: 200 });
        
    } catch (error: any) {
        console.error('Error al actualizar sucursal:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al actualizar sucursal'
        }), { status: 500 });
    }
};
