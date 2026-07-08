import type { APIRoute } from 'astro';
import pool from '../../../../lib/db';
import { hashPassword } from '../../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies, params }) => {
    try {
        const { id } = params;
        
        // Verificar sesión admin
        const session = cookies.get('session');
        if (!session || session.value !== 'authenticated') {
            return new Response(JSON.stringify({
                success: false,
                error: 'No autorizado'
            }), { status: 401 });
        }
        
        const data = await request.json();
        const { nombre, apellido, email, telefono, rol, sucursal_id, password } = data;
        
        // Validar campos obligatorios
        if (!nombre || !email || !rol) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Faltan campos obligatorios'
            }), { status: 400 });
        }
        
        // Verificar email único
        const [existenteData] = await pool.query(
            'SELECT id FROM usuarios WHERE email = ? AND id != ?',
            [email, id]
        ) as any[];
        
        if (existenteData.length > 0) {
            return new Response(JSON.stringify({
                success: false,
                error: 'El email ya está en uso por otro usuario'
            }), { status: 409 });
        }

        const sucursalIdParsed = sucursal_id ? parseInt(sucursal_id, 10) : null;
        
        if (password) {
            // Actualizar con contraseña
            const hashedPassword = await hashPassword(password);
            await pool.query(
                `UPDATE usuarios 
                 SET nombre = ?, apellido = ?, email = ?, telefono = ?, rol = ?, sucursal_id = ?, password = ?
                 WHERE id = ?`,
                [nombre, apellido || null, email, telefono || null, rol, sucursalIdParsed, hashedPassword, id]
            );
        } else {
            // Actualizar sin cambiar contraseña
            await pool.query(
                `UPDATE usuarios 
                 SET nombre = ?, apellido = ?, email = ?, telefono = ?, rol = ?, sucursal_id = ?
                 WHERE id = ?`,
                [nombre, apellido || null, email, telefono || null, rol, sucursalIdParsed, id]
            );
        }
        
        return new Response(JSON.stringify({
            success: true,
            mensaje: 'Usuario actualizado exitosamente'
        }), { status: 200 });
        
    } catch (error: any) {
        console.error('Error al actualizar usuario:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error interno del servidor'
        }), { status: 500 });
    }
};
