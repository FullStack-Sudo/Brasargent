// src/pages/api/reservas-dia/index.ts
// API para obtener reservas del dia

import type { APIRoute } from 'astro';
import { obtenerReservasDelDia, agruparPorSucursal } from '../../../lib/reservas-dia';

export const GET: APIRoute = async ({ cookies, locals }) => {
    try {
        const session = cookies.get('session');
        if (!session || session.value !== 'authenticated') {
            return new Response(JSON.stringify({
                success: false,
                error: 'No autorizado'
            }), { status: 401 });
        }
        
        const usuario = locals.usuario;
        const esSuperAdmin = usuario?.es_super_admin === true ||
            usuario?.es_super_admin === 1 ||
            cookies.get('es_super_admin')?.value === 'true';
        const userSucursalId = usuario?.sucursal_id ||
            cookies.get('user_sucursal')?.value;
        
        const reservas = await obtenerReservasDelDia(esSuperAdmin, userSucursalId);
        const grupos = agruparPorSucursal(reservas);
        
        // Estadisticas generales
        const totalReservas = reservas.length;
        const totalPendientes = reservas.filter((r: any) => r.estado === 'pendiente').length;
        const totalConfirmadas = reservas.filter((r: any) => r.estado === 'confirmada').length;
        const totalCanceladas = reservas.filter((r: any) => r.estado === 'cancelada').length;
        const totalCubiertos = reservas.reduce(
            (acc: number, r: any) => acc + (r.cubiertos_reservados || 0),
            0
        );
        
        const ahora = new Date();
        const year = ahora.getFullYear();
        const month = String(ahora.getMonth() + 1).padStart(2, '0');
        const day = String(ahora.getDate()).padStart(2, '0');
        const hoy = `${year}-${month}-${day}`;
        const fechaObj = new Date(year, ahora.getMonth(), me(day));
        const fechaFormateada = fechaObj.toLocaleDateString('es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        
        return new Response(JSON.stringify({
            success: true,
            fecha: hoy,
            fecha_formateada: fechaFormateada,
            estadisticas: {
                total_reservas: totalReservas,
                total_pendientes: totalPendientes,
                total_confirmadas: totalConfirmadas,
                total_canceladas: totalCanceladas,
                total_cubiertos: totalCubiertos
            },
            grupos
        }), { status: 200 });
        
    } catch (error: any) {
        console.error('Error al obtener reservas del dia:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al obtener reservas'
        }), { status: 500 });
    }
};

function me(d: string) {
    return parseInt(d, 10);
}
