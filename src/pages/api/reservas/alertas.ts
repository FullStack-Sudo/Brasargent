import type { APIRoute } from 'astro';
import { query } from '../../../lib/db';

export const GET: APIRoute = async ({ cookies }) => {
    try {
        // Verificar sesión admin
        const session = cookies.get('session');
        if (!session || session.value !== 'authenticated') {
            return new Response(JSON.stringify({
                success: false,
                error: 'No autorizado'
            }), { status: 401 });
        }
        
        // Obtener fecha de mañana (YYYY-MM-DD local)
        const manana = new Date();
        manana.setDate(manana.getDate() + 1);
        const year = manana.getFullYear();
        const month = String(manana.getMonth() + 1).padStart(2, '0');
        const day = String(manana.getDate()).padStart(2, '0');
        const fechaManana = `${year}-${month}-${day}`;
        
        // Obtener reservas de mañana
        const [reservasMananaRows] = await query(`
            SELECT 
                r.id,
                r.numero_reserva,
                r.nombre_cliente,
                r.telefono,
                r.fecha,
                r.hora,
                r.numero_personas,
                r.cantidad_ninos,
                r.cubiertos_reservados,
                r.estado,
                s.nombre AS sucursal_nombre
            FROM reservas r
            JOIN sucursales s ON r.sucursal_id = s.id
            WHERE r.fecha = ?
            AND r.estado IN ('confirmada', 'en_curso')
            ORDER BY r.hora ASC
        `, [fechaManana]) as any[];

        const reservasManana = Array.isArray(reservasMananaRows) ? reservasMananaRows : [];
        
        // Helper para icono de sucursal
        const getIcono = (nombre: string): string => {
            const n = (nombre || '').toLowerCase();
            if (n.includes('churrasquer')) return '🔥';
            if (n.includes('fast')) return '⚡';
            if (n.includes('rodizio')) return '🥩';
            return '📋';
        };

        // Estadísticas
        const totalReservas = reservasManana.length;
        const totalCubiertos = reservasManana.reduce((acc: number, r: any) => acc + (r.cubiertos_reservados || (r.numero_personas || 0) + (r.cantidad_ninos || 0)), 0);
        const totalPersonas = reservasManana.reduce((acc: number, r: any) => acc + (r.numero_personas || 0) + (r.cantidad_ninos || 0), 0);
        
        // Agrupar por sucursal
        const porSucursalMap: Record<string, any> = {};
        reservasManana.forEach((r: any) => {
            const nombreSucursal = r.sucursal_nombre || 'BRASARGENT';
            if (!porSucursalMap[nombreSucursal]) {
                porSucursalMap[nombreSucursal] = {
                    nombre: nombreSucursal,
                    icono: getIcono(nombreSucursal),
                    reservas: [],
                    totalCubiertos: 0,
                    totalPersonas: 0
                };
            }
            const cubiertos = r.cubiertos_reservados || ((r.numero_personas || 0) + (r.cantidad_ninos || 0));
            const personas = (r.numero_personas || 0) + (r.cantidad_ninos || 0);

            porSucursalMap[nombreSucursal].reservas.push(r);
            porSucursalMap[nombreSucursal].totalCubiertos += cubiertos;
            porSucursalMap[nombreSucursal].totalPersonas += personas;
        });
        
        return new Response(JSON.stringify({
            success: true,
            fecha: fechaManana,
            totalReservas,
            totalCubiertos,
            totalPersonas,
            porSucursal: Object.values(porSucursalMap),
            reservas: reservasManana
        }), { status: 200 });
        
    } catch (error: any) {
        console.error('Error en API alertas:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al obtener alertas'
        }), { status: 500 });
    }
};
