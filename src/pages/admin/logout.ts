import type { APIRoute } from 'astro';
import { query } from '../../lib/db';

async function handleLogout({ cookies, redirect }: { cookies: any; redirect: any }) {
    try {
        // 🔴 OBTENER RESERVAS DEL DÍA SIGUIENTE
        const manana = new Date();
        manana.setDate(manana.getDate() + 1);
        const fechaManana = manana.toISOString().split('T')[0];

        let totalManana = 0;
        let totalCubiertosManana = 0;
        let sucursalesManana = 'Ninguna';

        try {
            const [rows] = await query(`
                SELECT 
                    COUNT(*) as total,
                    COALESCE(SUM(cubiertos_reservados), 0) as total_cubiertos,
                    GROUP_CONCAT(DISTINCT s.nombre SEPARATOR ', ') as sucursales
                FROM reservas r
                JOIN sucursales s ON r.sucursal_id = s.id
                WHERE r.fecha = ?
                AND r.estado = 'pendiente'
            `, [fechaManana]) as any[];

            const reservas = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
            totalManana = reservas?.total || 0;
            totalCubiertosManana = reservas?.total_cubiertos || 0;
            sucursalesManana = reservas?.sucursales || 'Ninguna';
        } catch (e) {}

        // 🔴 REGISTRAR EN LOGS
        try {
            await query(
                `INSERT INTO logs_actividad 
                 (usuario_id, accion, tabla_afectada, registro_id, detalles) 
                 VALUES (?, 'CIERRE_SESION', 'usuarios', 1, ?)`,
                [
                    1,
                    JSON.stringify({
                        fecha: new Date().toISOString(),
                        reservas_manana: totalManana,
                        cubiertos_manana: totalCubiertosManana,
                        sucursales_manana: sucursalesManana
                    })
                ]
            );
        } catch (errLog) {}

        // 🔴 ELIMINAR COOKIES DE SESIÓN
        cookies.delete('session', { path: '/' });
        cookies.delete('session_timestamp', { path: '/' });
        cookies.delete('user_name', { path: '/' });

        // 🔴 REDIRIGIR AL LOGIN CON PARÁMETROS DE ALERTA
        return redirect(`/admin/login?logout=true&reservas_manana=${totalManana}&cubiertos_manana=${totalCubiertosManana}`);

    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        cookies.delete('session', { path: '/' });
        cookies.delete('session_timestamp', { path: '/' });
        cookies.delete('user_name', { path: '/' });
        return redirect('/admin/login?logout=true');
    }
}

export const GET: APIRoute = handleLogout;
export const POST: APIRoute = handleLogout;
export const ALL: APIRoute = handleLogout;
