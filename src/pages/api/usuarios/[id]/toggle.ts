import type { APIRoute } from 'astro';
import { query } from '../../../../lib/db';

export const POST: APIRoute = async ({ params, locals }) => {
    try {
        const usuario = locals.usuario;
        if (!usuario || !usuario.es_super_admin) {
            return new Response(JSON.stringify({
                success: false,
                error: 'No autorizado'
            }), { status: 403 });
        }

        const id = params.id;
        if (!id) {
            return new Response(JSON.stringify({
                success: false,
                error: 'ID de usuario requerido'
            }), { status: 400 });
        }

        // Obtener usuario actual
        const [targetRows] = await query(
            'SELECT id, activo, es_super_admin, nombre FROM usuarios WHERE id = ?',
            [id]
        ) as any[];

        const target = targetRows && targetRows[0];
        if (!target) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Usuario no encontrado'
            }), { status: 404 });
        }

        if (target.es_super_admin) {
            return new Response(JSON.stringify({
                success: false,
                error: 'No se puede desactivar a un Super Administrador'
            }), { status: 400 });
        }

        const nuevoEstado = target.activo ? 0 : 1;
        await query(
            'UPDATE usuarios SET activo = ? WHERE id = ?',
            [nuevoEstado, id]
        );

        return new Response(JSON.stringify({
            success: true,
            mensaje: `Usuario ${nuevoEstado ? 'activado' : 'desactivado'} correctamente`,
            activo: Boolean(nuevoEstado)
        }), { status: 200 });

    } catch (error: any) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al cambiar estado del usuario'
        }), { status: 500 });
    }
};
