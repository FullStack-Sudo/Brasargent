import type { APIRoute } from 'astro';
import { query } from '../../../lib/db';
import { hashPassword } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, locals }) => {
    try {
        // 🔴 VERIFICAR QUE SEA SUPER ADMIN
        const usuario = locals.usuario;
        if (!usuario || !usuario.es_super_admin) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Solo el Super Administrador puede crear usuarios'
            }), { status: 403 });
        }

        const data = await request.json();
        const { 
            nombre, 
            apellido, 
            email, 
            telefono, 
            password, 
            sucursal_id,
            permisos
        } = data;

        // Validar campos obligatorios
        if (!nombre || !email || !password || !sucursal_id) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Todos los campos obligatorios deben ser completados'
            }), { status: 400 });
        }

        // Verificar que el email no exista
        const [existente] = await query(
            'SELECT id FROM usuarios WHERE email = ?',
            [email]
        ) as any[];

        if (existente && existente.length > 0) {
            return new Response(JSON.stringify({
                success: false,
                error: 'El email ya está registrado'
            }), { status: 409 });
        }

        // Verificar que la sucursal exista
        const [sucursalRows] = await query(
            'SELECT id, nombre FROM sucursales WHERE id = ? AND activo = 1',
            [sucursal_id]
        ) as any[];

        const sucursal = sucursalRows && sucursalRows[0];

        if (!sucursal) {
            return new Response(JSON.stringify({
                success: false,
                error: 'La sucursal no existe o está inactiva'
            }), { status: 404 });
        }

        // Hash de la contraseña
        const hashedPassword = await hashPassword(password);

        // Permisos default o personalizados
        const permisosObj = permisos || {
            puede_ver_reservas: true,
            puede_aprobar_reservas: true,
            puede_rechazar_reservas: true,
            puede_ver_menu: true,
            puede_editar_menu: false,
            puede_ver_clientes: true,
            puede_ver_reportes: true
        };

        // Insertar usuario (admin de sucursal)
        const [result] = await query(
            `INSERT INTO usuarios 
             (nombre, apellido, email, telefono, password, rol, sucursal_id, es_super_admin, permisos, activo) 
             VALUES (?, ?, ?, ?, ?, 'admin', ?, FALSE, ?, TRUE)`,
            [
                nombre, 
                apellido || null, 
                email, 
                telefono || null, 
                hashedPassword, 
                sucursal_id,
                JSON.stringify(permisosObj)
            ]
        ) as any[];

        const nuevoUsuarioId = result.insertId;

        // Insertar o actualizar permisos por sucursal
        await query(
            `INSERT INTO permisos_sucursal 
             (usuario_id, sucursal_id, puede_ver_reservas, puede_aprobar_reservas, 
              puede_rechazar_reservas, puede_ver_menu, puede_editar_menu, 
              puede_ver_clientes, puede_ver_reportes) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
              puede_ver_reservas = VALUES(puede_ver_reservas),
              puede_aprobar_reservas = VALUES(puede_aprobar_reservas),
              puede_rechazar_reservas = VALUES(puede_rechazar_reservas),
              puede_ver_menu = VALUES(puede_ver_menu),
              puede_editar_menu = VALUES(puede_editar_menu),
              puede_ver_clientes = VALUES(puede_ver_clientes),
              puede_ver_reportes = VALUES(puede_ver_reportes)`,
            [
                nuevoUsuarioId, 
                sucursal_id,
                Boolean(permisosObj.puede_ver_reservas ?? true),
                Boolean(permisosObj.puede_aprobar_reservas ?? true),
                Boolean(permisosObj.puede_rechazar_reservas ?? true),
                Boolean(permisosObj.puede_ver_menu ?? true),
                Boolean(permisosObj.puede_editar_menu ?? false),
                Boolean(permisosObj.puede_ver_clientes ?? true),
                Boolean(permisosObj.puede_ver_reportes ?? true)
            ]
        );

        // Registrar en logs
        try {
            await query(
                `INSERT INTO logs_actividad 
                 (usuario_id, accion, tabla_afectada, registro_id, detalles) 
                 VALUES (?, 'USUARIO_CREADO', 'usuarios', ?, ?)`,
                [
                    usuario.id,
                    nuevoUsuarioId,
                    JSON.stringify({
                        nombre: `${nombre} ${apellido || ''}`.trim(),
                        email,
                        sucursal: sucursal.nombre,
                        creado_por: usuario.nombre
                    })
                ]
            );
        } catch (logErr) {
            console.error('Error guardando log de actividad:', logErr);
        }

        return new Response(JSON.stringify({
            success: true,
            mensaje: `Administrador creado para ${sucursal.nombre}`,
            usuario: {
                id: nuevoUsuarioId,
                nombre: `${nombre} ${apellido || ''}`.trim(),
                email,
                sucursal: sucursal.nombre
            }
        }), { status: 201 });

    } catch (error: any) {
        console.error('Error al crear usuario:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al crear usuario'
        }), { status: 500 });
    }
};
