import type { APIRoute } from 'astro';
import { query } from '../../../lib/db';

export const DELETE: APIRoute = async ({ params, locals }) => {
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

        // Verificar que el usuario objetivo no sea super admin
        const [targetRows] = await query(
            'SELECT id, es_super_admin FROM usuarios WHERE id = ?',
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
                error: 'No se puede eliminar a un Super Administrador'
            }), { status: 400 });
        }

        // Eliminar usuario
        await query('DELETE FROM usuarios WHERE id = ?', [id]);

        return new Response(JSON.stringify({
            success: true,
            mensaje: 'Usuario eliminado exitosamente'
        }), { status: 200 });

    } catch (error: any) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al eliminar usuario'
        }), { status: 500 });
    }
};
