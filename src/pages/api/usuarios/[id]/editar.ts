import type { APIRoute } from 'astro';
import { query } from '../../../../lib/db';
import { hashPassword } from '../../../../lib/auth';

export const POST: APIRoute = async ({ request, locals, params }) => {
    try {
        const usuario = locals.usuario;
        if (!usuario || !usuario.es_super_admin) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Solo el Super Administrador puede editar usuarios'
            }), { status: 403 });
        }

        const { id } = params;
        if (!id) {
            return new Response(JSON.stringify({
                success: false,
                error: 'ID de usuario requerido'
            }), { status: 400 });
        }

        const data = await request.json();
        const { nombre, apellido, email, telefono, sucursal_id, password, permisos } = data;

        if (!nombre || !email || !sucursal_id) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Todos los campos obligatorios deben ser completados'
            }), { status: 400 });
        }

        // Verificar que no exista otro usuario con ese email
        const [existenteData] = await query(
            'SELECT id FROM usuarios WHERE email = ? AND id != ?',
            [email, id]
        ) as any[];

        if (existenteData && existenteData.length > 0) {
            return new Response(JSON.stringify({
                success: false,
                error: 'El email ya está registrado en otra cuenta'
            }), { status: 409 });
        }

        const sucursalIdParsed = parseInt(sucursal_id, 10);
        const permisosObj = permisos || {};

        if (password && password.trim().length > 0) {
            if (password.length < 6) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'La contraseña debe tener al menos 6 caracteres'
                }), { status: 400 });
            }
            const hashedPassword = await hashPassword(password);
            await query(
                `UPDATE usuarios 
                 SET nombre = ?, apellido = ?, email = ?, telefono = ?, sucursal_id = ?, permisos = ?, password = ?
                 WHERE id = ? AND es_super_admin = FALSE`,
                [nombre, apellido || null, email, telefono || null, sucursalIdParsed, JSON.stringify(permisosObj), hashedPassword, id]
            );
        } else {
            await query(
                `UPDATE usuarios 
                 SET nombre = ?, apellido = ?, email = ?, telefono = ?, sucursal_id = ?, permisos = ?
                 WHERE id = ? AND es_super_admin = FALSE`,
                [nombre, apellido || null, email, telefono || null, sucursalIdParsed, JSON.stringify(permisosObj), id]
            );
        }

        // Actualizar permisos por sucursal
        await query(
            `INSERT INTO permisos_sucursal 
             (usuario_id, sucursal_id, puede_ver_reservas, puede_aprobar_reservas, 
              puede_rechazar_reservas, puede_ver_menu, puede_editar_menu, 
              puede_ver_clientes, puede_ver_reportes) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
              sucursal_id = VALUES(sucursal_id),
              puede_ver_reservas = VALUES(puede_ver_reservas),
              puede_aprobar_reservas = VALUES(puede_aprobar_reservas),
              puede_rechazar_reservas = VALUES(puede_rechazar_reservas),
              puede_ver_menu = VALUES(puede_ver_menu),
              puede_editar_menu = VALUES(puede_editar_menu),
              puede_ver_clientes = VALUES(puede_ver_clientes),
              puede_ver_reportes = VALUES(puede_ver_reportes)`,
            [
                id, 
                sucursalIdParsed,
                Boolean(permisosObj.puede_ver_reservas ?? true),
                Boolean(permisosObj.puede_aprobar_reservas ?? true),
                Boolean(permisosObj.puede_rechazar_reservas ?? true),
                Boolean(permisosObj.puede_ver_menu ?? true),
                Boolean(permisosObj.puede_editar_menu ?? false),
                Boolean(permisosObj.puede_ver_clientes ?? true),
                Boolean(permisosObj.puede_ver_reportes ?? true)
            ]
        );

        return new Response(JSON.stringify({
            success: true,
            mensaje: 'Administrador actualizado exitosamente'
        }), { status: 200 });

    } catch (error: any) {
        console.error('Error al editar usuario:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al editar usuario'
        }), { status: 500 });
    }
};
