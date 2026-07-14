import type { APIRoute } from 'astro';
import pool from '../../../lib/db';

export const GET: APIRoute = async ({ url }) => {
    try {
        const sucursalId = url.searchParams.get('sucursal_id');
        const fecha = url.searchParams.get('fecha');
        const hora = url.searchParams.get('hora');
        
        if (!sucursalId || !fecha || !hora) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Datos incompletos'
            }), { status: 400 });
        }
        
        // Obtener horarios de la sucursal
        const [rows] = await pool.query(
            `SELECT horarios, permite_reservas FROM sucursales WHERE id = ?`,
            [sucursalId]
        ) as any[];
        
        const sucursal = rows[0];
        
        if (!sucursal || !sucursal.permite_reservas) {
            return new Response(JSON.stringify({
                success: false,
                data: { valida: false, mensaje: 'Esta sucursal no acepta reservas' }
            }));
        }
        
        // Parsear horarios
        let horarios: any = {};
        try {
            horarios = typeof sucursal.horarios === 'string' 
                ? JSON.parse(sucursal.horarios) 
                : sucursal.horarios || {};
        } catch {
            horarios = {};
        }
        
        // Obtener día de la semana
        const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
        const fechaObj = new Date(fecha);
        const diaSemana = diasSemana[fechaObj.getDay()];
        
        // Obtener horario del día
        const horarioDia = horarios[diaSemana] || { activo: false, bloques: [] };
        const bloques = horarioDia.activo ? horarioDia.bloques || [] : [];
        
        // Verificar si la hora está dentro de algún bloque
        let horaValida = false;
        for (const bloque of bloques) {
            if (hora >= bloque.inicio && hora <= bloque.fin) {
                horaValida = true;
                break;
            }
        }
        
        return new Response(JSON.stringify({
            success: true,
            data: {
                valida: horaValida,
                mensaje: horaValida ? 'Hora válida' : 'La hora no está dentro del horario de atención',
                hora: hora,
                horario: bloques
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
            error: error.message || 'Error al validar hora'
        }), { status: 500 });
    }
};
