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
            }), { status: 401 });
        }
        
        const data = await request.json();
        const { 
            nombre,
            concepto,
            direccion,
            telefono,
            capacidad_total,
            permite_reservas,
            permite_cubiertos,
            horarios
        } = data;
        
        // Validar campos obligatorios
        if (!nombre || !direccion || !telefono) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Los campos nombre, dirección y teléfono son obligatorios'
            }), { status: 400 });
        }
        
        // Insertar sucursal
        const [result] = await pool.query(
            `INSERT INTO sucursales 
             (nombre, concepto, direccion, telefono, capacidad_total, cubiertos_disponibles, permite_reservas, permite_cubiertos, horarios, activo) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [
                nombre,
                concepto || 'Restaurante',
                direccion,
                telefono,
                capacidad_total || 120,
                capacidad_total || 120, // cubiertos_disponibles = capacidad_total inicialmente
                permite_reservas !== undefined ? permite_reservas : 1,
                permite_cubiertos !== undefined ? permite_cubiertos : 1,
                JSON.stringify(horarios)
            ]
        ) as any[];
        
        const nuevoId = result.insertId;
        
        // Registrar en logs
        await pool.query(
            `INSERT INTO logs_actividad 
             (usuario_id, accion, tabla_afectada, registro_id, detalles) 
             VALUES (?, 'SUCURSAL_CREADA', 'sucursales', ?, ?)`,
            [
                1,
                nuevoId,
                JSON.stringify({ 
                    nombre, 
                    capacidad_total,
                    permite_reservas,
                    permite_cubiertos
                })
            ]
        );
        
        return new Response(JSON.stringify({
            success: true,
            mensaje: 'Sucursal creada exitosamente',
            id: nuevoId
        }), { status: 201 });
        
    } catch (error: any) {
        console.error('Error al crear sucursal:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al crear la sucursal'
        }), { status: 500 });
    }
};
