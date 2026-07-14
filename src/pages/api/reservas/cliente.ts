import type { APIRoute } from 'astro';
import pool from '../../../lib/db';

export const POST: APIRoute = async ({ request }) => {
    try {
        const data = await request.json();
        
        const { 
            sucursal_id, 
            nombre_cliente, 
            telefono,
            codigo_pais,
            fecha, 
            hora,
            turno,
            numero_personas,
            cantidad_ninos,
            cantidad_bebes,
            necesita_silla_bebe,
            necesita_menu_infantil,
            observaciones
        } = data;
        
        // ============================================
        // VALIDACIONES BÁSICAS
        // ============================================
        
        if (!sucursal_id || !nombre_cliente || !telefono || !fecha || !hora || !numero_personas) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Todos los campos obligatorios deben ser completados'
            }), { status: 400 });
        }
        
        // ============================================
        // 🔴 VALIDACIÓN DE HORARIO DEL ADMIN
        // ============================================
        
        // 1. Obtener datos de la sucursal
        const [sucursalRows] = await pool.query(
            `SELECT horarios, permite_reservas, capacidad_total 
             FROM sucursales 
             WHERE id = ? AND activo = 1`,
            [sucursal_id]
        ) as any[];
        
        const sucursal = (sucursalRows as any[])[0];
        
        if (!sucursal) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Sucursal no encontrada o inactiva'
            }), { status: 404 });
        }
        
        // 2. Verificar si permite reservas
        if (!sucursal.permite_reservas) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Esta sucursal no acepta reservas'
            }), { status: 403 });
        }
        
        // 3. Parsear horarios configurados por el admin
        let horarios: any = {};
        try {
            horarios = typeof sucursal.horarios === 'string' 
                ? JSON.parse(sucursal.horarios) 
                : sucursal.horarios || {};
        } catch {
            return new Response(JSON.stringify({
                success: false,
                error: 'Error en la configuración de horarios de la sucursal'
            }), { status: 500 });
        }
        
        // 4. Obtener el día de la semana de la fecha solicitada
        const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
        const fechaObj = new Date(fecha + 'T12:00:00'); // T12 para evitar problemas de timezone
        const diaSemana = diasSemana[fechaObj.getDay()];
        
        // 5. Verificar si la sucursal está abierta ese día
        const horarioDia = horarios[diaSemana];
        
        if (!horarioDia || !horarioDia.activo || !horarioDia.bloques || horarioDia.bloques.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: `La sucursal está cerrada el día ${diaSemana}. No se pueden hacer reservas.`
            }), { status: 403 });
        }
        
        // 6. 🔴 VERIFICAR QUE LA HORA ESTÁ DENTRO DE ALGÚN BLOQUE HORARIO
        let horaValida = false;
        for (const bloque of horarioDia.bloques) {
            if (hora >= bloque.inicio && hora <= bloque.fin) {
                horaValida = true;
                break;
            }
        }
        
        if (!horaValida) {
            const horariosStr = horarioDia.bloques
                .map((b: any) => `${b.inicio} - ${b.fin}`)
                .join(' y ');
            return new Response(JSON.stringify({
                success: false,
                error: `La hora ${hora} no está dentro del horario de atención (${horariosStr}). Selecciona una hora válida.`
            }), { status: 403 });
        }
        
        // 7. Validar capacidad disponible para esa hora
        const [reservasEnHora] = await pool.query(
            `SELECT COALESCE(SUM(numero_personas), 0) as total
             FROM reservas 
             WHERE sucursal_id = ? 
             AND fecha = ? 
             AND hora = ? 
             AND estado IN ('pendiente', 'confirmada')`,
            [sucursal_id, fecha, hora]
        ) as any[];
        
        const ocupadosEnHora = (reservasEnHora as any[])[0]?.total || 0;
        const capacidadTotal = sucursal.capacidad_total || 120;
        
        if (ocupadosEnHora + numero_personas > capacidadTotal) {
            return new Response(JSON.stringify({
                success: false,
                error: `No hay capacidad suficiente para ${numero_personas} personas a las ${hora}. Disponibles: ${capacidadTotal - ocupadosEnHora} cubiertos.`
            }), { status: 409 });
        }
        
        // ============================================
        // ✅ TODAS LAS VALIDACIONES PASARON - GUARDAR
        // ============================================
        
        const telefono_completo = `${codigo_pais || '591'}${telefono.replace(/[^0-9]/g, '')}`;

        const [result] = await pool.query(
            `INSERT INTO reservas 
             (sucursal_id, nombre_cliente, telefono, codigo_pais, telefono_completo, fecha, hora, turno, numero_personas, cantidad_ninos, cantidad_bebes, necesita_silla_bebe, necesita_menu_infantil, observaciones, estado) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')`,
            [
                sucursal_id,
                nombre_cliente,
                telefono,
                codigo_pais || '591',
                telefono_completo,
                fecha,
                hora,
                turno || null,
                numero_personas,
                cantidad_ninos || 0,
                cantidad_bebes || 0,
                necesita_silla_bebe ? 1 : 0,
                necesita_menu_infantil ? 1 : 0,
                observaciones || null
            ]
        );
        
        // Registrar en logs
        try {
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
                        personas: numero_personas,
                        validacion_horario: 'APROBADA'
                    })
                ]
            );
        } catch {
            // Logs opcionales — no romper la reserva si falla
        }
        
        return new Response(JSON.stringify({
            success: true,
            mensaje: '¡Reserva solicitada! Espera confirmación por WhatsApp.',
            reserva_id: (result as any).insertId
        }), { status: 201 });
        
    } catch (error: any) {
        console.error('Error en reserva:', error);
        let errorMsg = error.message || 'Error al procesar la reserva';
        if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('connect')) {
            errorMsg = 'El servicio de reservas no está disponible en este momento';
        }
        return new Response(JSON.stringify({
            success: false,
            error: errorMsg
        }), { status: 500 });
    }
};
