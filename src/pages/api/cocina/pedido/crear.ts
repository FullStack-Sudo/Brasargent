import type { APIRoute } from 'astro';
import pool from '../../../../lib/db';
import { randomUUID } from 'crypto';

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        // Verificar sesión
        const session = cookies.get('session');
        if (!session || session.value !== 'authenticated') {
            return new Response(JSON.stringify({
                success: false,
                error: 'No autorizado'
            }), { status: 401 });
        }
        
        const data = await request.json();
        const { 
            sucursal_id, 
            mesa_id, 
            platos,  // Array de { plato_id, cantidad, nombre, precio }
            prioridad,
            notas,
            reserva_id,
            nombre_cliente
        } = data;
        
        // Validar campos
        if (!sucursal_id || !mesa_id || !platos || platos.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Datos incompletos. Se requiere: sucursal_id, mesa_id, platos[]'
            }), { status: 400 });
        }
        
        // Generar ID único para el grupo
        const grupoId = `PED-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        
        // Obtener mesero_id de la sesión
        const userId = cookies.get('user_id')?.value;
        const userRole = cookies.get('user_role')?.value || 'mesero';
        const userName = cookies.get('user_name')?.value || 'Mesero';
        
        // Calcular total del pedido
        let totalPedido = 0;
        const itemsConPrecio = [];
        
        for (const plato of platos) {
            // Obtener precio del plato
            const platoDataResults = await pool.query(
                'SELECT precio, nombre FROM platos WHERE id = ?',
                [plato.plato_id]
            ) as any[];
            const platoData = platoDataResults[0][0];
            
            if (!platoData) {
                return new Response(JSON.stringify({
                    success: false,
                    error: `Plato ID ${plato.plato_id} no encontrado`
                }), { status: 404 });
            }
            
            const precio = platoData.precio;
            const subtotal = precio * (plato.cantidad || 1);
            totalPedido += subtotal;
            
            itemsConPrecio.push({
                plato_id: plato.plato_id,
                nombre: platoData.nombre,
                cantidad: plato.cantidad || 1,
                precio: precio,
                subtotal: subtotal
            });
        }
        
        // Obtener nombre del cliente desde la reserva (si existe)
        let clienteNombre = nombre_cliente || '';
        if (reserva_id && !clienteNombre) {
            const reservaDataResults = await pool.query(
                'SELECT nombre_cliente FROM reservas WHERE id = ?',
                [reserva_id]
            ) as any[];
            const reserva = reservaDataResults[0][0];
            if (reserva) {
                clienteNombre = reserva.nombre_cliente;
            }
        }
        
        // Crear grupo de pedido
        const result = await pool.query(
            `INSERT INTO pedidos_cocina_grupo 
             (grupo_id, sucursal_id, mesa_id, reserva_id, nombre_cliente, 
              mesero_id, prioridad, total_pedido, items, notas) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                grupoId,
                sucursal_id,
                mesa_id,
                reserva_id || null,
                clienteNombre || `Mesa ${mesa_id}`,
                userId || null,
                prioridad || 'normal',
                totalPedido,
                JSON.stringify(itemsConPrecio),
                notas || null
            ]
        ) as any[];
        
        // Registrar en logs
        await pool.query(
            `INSERT INTO logs_actividad 
             (usuario_id, accion, tabla_afectada, registro_id, detalles) 
             VALUES (?, 'NUEVO_PEDIDO_GRUPO', 'pedidos_cocina_grupo', ?, ?)`,
            [
                userId || null,
                (result as any)[0].insertId,
                JSON.stringify({
                    grupo_id: grupoId,
                    mesa: mesa_id,
                    items: itemsConPrecio.length,
                    total: totalPedido,
                    cliente: clienteNombre || `Mesa ${mesa_id}`,
                    mesero: userName
                })
            ]
        );
        
        return new Response(JSON.stringify({
            success: true,
            mensaje: 'Pedido enviado a cocina',
            grupo_id: grupoId,
            total: totalPedido,
            items: itemsConPrecio.length
        }), { status: 201 });
        
    } catch (error: any) {
        console.error('Error al crear pedido:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al crear pedido'
        }), { status: 500 });
    }
};
