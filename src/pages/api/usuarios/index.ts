import type { APIRoute } from 'astro';
import { query } from '../../../lib/db';

export const GET: APIRoute = async ({ locals }) => {
    try {
        // Verificar Super Admin
        const usuario = locals.usuario;
        if (!usuario || !usuario.es_super_admin) {
            return new Response(JSON.stringify({
                success: false,
                error: 'No autorizado. Solo Super Admin puede listar usuarios.'
            }), { status: 403 });
        }

        // Obtener todos los usuarios (excepto super admin)
        const [usuarios] = await query(
            `SELECT 
                u.id,
                u.nombre,
                u.apellido,
                u.email,
                u.telefono,
                u.rol,
                u.sucursal_id,
                u.es_super_admin,
                u.activo,
                u.created_at,
                s.nombre AS sucursal_nombre
             FROM usuarios u
             LEFT JOIN sucursales s ON u.sucursal_id = s.id
             WHERE u.es_super_admin = FALSE
             ORDER BY s.nombre, u.nombre`
        ) as any[];

        return new Response(JSON.stringify({
            success: true,
            usuarios
        }), { status: 200 });

    } catch (error: any) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), { status: 500 });
    }
};
