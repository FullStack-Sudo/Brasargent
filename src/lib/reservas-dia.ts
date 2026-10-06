// src/lib/reservas-dia.ts
// Logica para gestionar reservas del dia

import { query } from './db';

function getFechaHoyLocal(): string {
    const ahora = new Date();
    const year = ahora.getFullYear();
    const month = String(ahora.getMonth() + 1).padStart(2, '0');
    const day = String(ahora.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ============================================
// OBTENER RESERVAS DEL DIA POR SUCURSAL
// ============================================
export async function obtenerReservasDelDia(
    esSuperAdmin: boolean,
    userSucursalId: any
): Promise<any[]> {
    const hoy = getFechaHoyLocal();
    let reservas: any[] = [];
    
    if (esSuperAdmin) {
        // Super Admin ve todas las sucursales
        const [rows] = await query(
            `SELECT 
                r.id,
                r.numero_reserva,
                r.nombre_cliente,
                r.telefono,
                r.telefono_completo,
                r.fecha,
                r.hora,
                r.numero_personas,
                r.cantidad_ninos,
                r.cubiertos_reservados,
                r.estado,
                r.observaciones,
                s.id AS sucursal_id,
                s.nombre AS sucursal_nombre
            FROM reservas r
            JOIN sucursales s ON r.sucursal_id = s.id
            WHERE r.fecha = ?
            ORDER BY s.nombre, r.hora ASC`,
            [hoy]
        ) as any[];
        reservas = Array.isArray(rows) ? rows : [];
    } else {
        // Admin de sucursal solo ve su sucursal
        const sucursalIdNum = parseInt(String(userSucursalId || '0'), 10);
        const [rows] = await query(
            `SELECT 
                r.id,
                r.numero_reserva,
                r.nombre_cliente,
                r.telefono,
                r.telefono_completo,
                r.fecha,
                r.hora,
                r.numero_personas,
                r.cantidad_ninos,
                r.cubiertos_reservados,
                r.estado,
                r.observaciones,
                s.id AS sucursal_id,
                s.nombre AS sucursal_nombre
            FROM reservas r
            JOIN sucursales s ON r.sucursal_id = s.id
            WHERE r.fecha = ?
            AND r.sucursal_id = ?
            ORDER BY r.hora ASC`,
            [hoy, sucursalIdNum]
        ) as any[];
        reservas = Array.isArray(rows) ? rows : [];
    }
    
    return reservas;
}

// ============================================
// AGRUPAR RESERVAS POR SUCURSAL
// ============================================
export function agruparPorSucursal(reservas: any[]): any[] {
    const grupos: Record<string, any> = {};
    
    for (const reserva of reservas) {
        const key = reserva.sucursal_nombre;
        if (!grupos[key]) {
            grupos[key] = {
                sucursal_nombre: reserva.sucursal_nombre,
                sucursal_id: reserva.sucursal_id,
                reservas: [],
                total_pendientes: 0,
                total_confirmadas: 0,
                total_canceladas: 0,
                total_cubiertos: 0
            };
        }
        
        grupos[key].reservas.push(reserva);
        grupos[key].total_cubiertos += reserva.cubiertos_reservados || 0;
        
        if (reserva.estado === 'pendiente') grupos[key].total_pendientes++;
        if (reserva.estado === 'confirmada') grupos[key].total_confirmadas++;
        if (reserva.estado === 'cancelada') grupos[key].total_canceladas++;
    }
    
    return Object.values(grupos);
}
