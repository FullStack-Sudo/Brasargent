import type { APIRoute } from 'astro';
import { query } from '../../../lib/db';

export const GET: APIRoute = async ({ cookies, locals }) => {
    try {
        // Verificar sesión admin
        const session = cookies.get('session');
        if (!session || session.value !== 'authenticated') {
            return new Response(JSON.stringify({
                success: false,
                error: 'No autorizado'
            }), { status: 401 });
        }

        // Obtener datos del usuario desde locals o cookies
        const usuario = locals.usuario;
        const userSucursal = usuario?.sucursal_id || cookies.get('user_sucursal')?.value;
        const esSuperAdmin = usuario?.es_super_admin === true || cookies.get('es_super_admin')?.value === 'true';

        // Fecha de hoy (YYYY-MM-DD local)
        const ahora = new Date();
        const year = ahora.getFullYear();
        const month = String(ahora.getMonth() + 1).padStart(2, '0');
        const day = String(ahora.getDate()).padStart(2, '0');
        const hoy = `${year}-${month}-${day}`;

        let sql = `
            SELECT 
                r.id,
                r.numero_reserva,
                r.nombre_cliente,
                r.telefono,
                r.codigo_pais,
                r.telefono_completo,
                r.email,
                r.fecha,
                r.hora,
                r.numero_personas,
                r.cantidad_ninos,
                r.necesita_silla_bebe,
                r.necesita_menu_infantil,
                r.observaciones,
                COALESCE(r.cubiertos_reservados, (r.numero_personas + COALESCE(r.cantidad_ninos, 0))) AS cubiertos_reservados,
                r.estado,
                s.nombre AS sucursal_nombre,
                s.id AS sucursal_id
            FROM reservas r
            JOIN sucursales s ON r.sucursal_id = s.id
            WHERE r.fecha > ?
            AND r.estado IN ('confirmada', 'pendiente')
        `;

        const params: any[] = [hoy];

        // Filtrar por sucursal si no es super admin
        if (!esSuperAdmin && userSucursal) {
            sql += ` AND r.sucursal_id = ?`;
            params.push(parseInt(String(userSucursal), 10));
        }

        sql += ` ORDER BY r.fecha ASC, r.hora ASC`;

        const [reservasRows] = await query(sql, params) as any[];
        const reservas = Array.isArray(reservasRows) ? reservasRows : [];

        // Helper icono sucursal
        const getIcono = (nombre: string): string => {
            const n = (nombre || '').toLowerCase();
            if (n.includes('churrasquer')) return '🔥';
            if (n.includes('fast')) return '⚡';
            if (n.includes('rodizio')) return '🥩';
            return '📋';
        };

        // Agrupar por fecha
        const porFecha: Record<string, any> = {};
        
        reservas.forEach((r: any) => {
            // Normalizar fecha string YYYY-MM-DD
            let fechaKey = r.fecha;
            if (typeof fechaKey !== 'string') {
                fechaKey = new Date(r.fecha).toISOString().split('T')[0];
            } else if (fechaKey.includes('T')) {
                fechaKey = fechaKey.split('T')[0];
            }
            
            if (!porFecha[fechaKey]) {
                const fechaObj = new Date(fechaKey + 'T12:00:00');
                const fechaFormateada = isNaN(fechaObj.getTime()) ? fechaKey : fechaObj.toLocaleDateString('es-ES', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });

                porFecha[fechaKey] = {
                    fecha: fechaKey,
                    fechaFormateada,
                    reservas: [],
                    totalReservas: 0,
                    totalCubiertos: 0,
                    totalPersonas: 0,
                    sucursales: {}
                };
            }
            
            porFecha[fechaKey].reservas.push(r);
            porFecha[fechaKey].totalReservas++;
            const cubiertos = parseInt(r.cubiertos_reservados || '0', 10);
            const personas = (parseInt(r.numero_personas || '0', 10)) + (parseInt(r.cantidad_ninos || '0', 10));

            porFecha[fechaKey].totalCubiertos += cubiertos;
            porFecha[fechaKey].totalPersonas += personas;
            
            // Agrupar por sucursal dentro de la fecha
            const sucursalKey = r.sucursal_nombre;
            if (!porFecha[fechaKey].sucursales[sucursalKey]) {
                porFecha[fechaKey].sucursales[sucursalKey] = {
                    nombre: r.sucursal_nombre,
                    icono: getIcono(r.sucursal_nombre),
                    reservas: [],
                    cubiertos: 0,
                    personas: 0
                };
            }
            porFecha[fechaKey].sucursales[sucursalKey].reservas.push(r);
            porFecha[fechaKey].sucursales[sucursalKey].cubiertos += cubiertos;
            porFecha[fechaKey].sucursales[sucursalKey].personas += personas;
        });

        // Convertir a array ordenado por fecha
        const fechas = Object.values(porFecha).sort((a: any, b: any) => 
            new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
        );

        return new Response(JSON.stringify({
            success: true,
            totalReservas: reservas.length,
            totalFechas: fechas.length,
            fechas
        }), { status: 200 });

    } catch (error: any) {
        console.error('Error en API reservas futuras:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al obtener reservas futuras'
        }), { status: 500 });
    }
};
