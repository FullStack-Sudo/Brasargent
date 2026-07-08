import type { APIRoute } from 'astro';
import pool from '../../../lib/db';

export const POST: APIRoute = async ({ request }) => {
    try {
        const data = await request.json();
        
        // Validar datos mínimos
        const { 
            sucursal_id, 
            nombre_cliente, 
            telefono,
            codigo_pais,
            fecha, 
            hora, 
            numero_personas 
        } = data;
        
        if (!sucursal_id || !nombre_cliente || !telefono || !fecha || !hora || !numero_personas) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Todos los campos obligatorios deben ser completados'
            }), { status: 400 });
        }
        
        // Verificar si ya existe una reserva para esa fecha/hora (pendiente o confirmada)
        const [existentes] = await pool.query(
            `SELECT COUNT(*) as total FROM reservas 
             WHERE sucursal_id = ? AND fecha = ? AND hora = ? 
             AND estado IN ('pendiente', 'confirmada')`,
            [sucursal_id, fecha, hora]
        );
        
        // Si hay más de 3 reservas en la misma hora, sugerir otra hora
        if ((existentes as any[])[0]?.total >= 3) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Horario con mucha demanda. Prueba con otra hora.'
            }), { status: 409 });
        }
        
        const telefono_completo = `${codigo_pais || '591'}${telefono.replace(/[^0-9]/g, '')}`;

        // Insertar reserva como PENDIENTE
        const [result] = await pool.query(
            `INSERT INTO reservas 
             (sucursal_id, nombre_cliente, telefono, codigo_pais, telefono_completo, fecha, hora, numero_personas, observaciones, estado) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')`,
            [
                sucursal_id,
                nombre_cliente,
                telefono,
                codigo_pais || '591',
                telefono_completo,
                fecha,
                hora,
                numero_personas,
                data.observaciones || null
            ]
        );
        // Registrar en logs
        await pool.query(
            `INSERT INTO logs_actividad 
             (accion, tabla_afectada, registro_id, detalles) 
             VALUES ('NUEVA_RESERVA_CLIENTE', 'reservas', ?, ?)`,
            [
                (result as any).insertId,
                JSON.stringify({
                    cliente: nombre_cliente,
                    telefono: telefono_completo,
                    sucursal_id,
                    fecha,
                    hora,
                    personas: numero_personas
                })
            ]
        );
        
        // Enviar respuesta
        return new Response(JSON.stringify({
            success: true,
            mensaje: '¡Reserva solicitada! Espera confirmación por WhatsApp.',
            reserva_id: (result as any).insertId
        }), { status: 201 });
        
    } catch (error: any) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al procesar la reserva'
        }), { status: 500 });
    }
};
