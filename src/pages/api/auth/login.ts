import type { APIRoute } from 'astro';
import { query } from '../../../lib/db';
import { verifyPassword } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        let email = '';
        let password = '';

        const contentType = request.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const data = await request.json();
            email = data.email || '';
            password = data.password || '';
        } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
            const formData = await request.formData();
            email = formData.get('email')?.toString() || '';
            password = formData.get('password')?.toString() || '';
        } else {
            // Intentar JSON por defecto
            try {
                const data = await request.json();
                email = data.email || '';
                password = data.password || '';
            } catch (e) {}
        }

        if (!email || !password) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Debes proporcionar email y contraseña'
            }), { status: 400 });
        }

        // Buscar usuario e incluir datos de sucursal
        const [usuariosData] = await query(
            `SELECT 
                u.id, 
                u.email, 
                u.password, 
                u.nombre, 
                u.apellido,
                u.rol, 
                u.sucursal_id, 
                u.es_super_admin,
                u.activo,
                s.nombre AS sucursal_nombre
             FROM usuarios u
             LEFT JOIN sucursales s ON u.sucursal_id = s.id
             WHERE u.email = ?`,
            [email]
        ) as any[];

        const usuario = usuariosData && usuariosData[0];

        if (!usuario) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Usuario no encontrado'
            }), { status: 401 });
        }

        if (!usuario.activo) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Tu cuenta está desactivada'
            }), { status: 401 });
        }

        // Verificar contraseña
        const isValid = await verifyPassword(password, usuario.password);
        if (!isValid) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Contraseña incorrecta'
            }), { status: 401 });
        }

        // Opciones de Cookie de sesión
        const maxAge = 60 * 60 * 24; // 24 horas
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict' as const,
            path: '/',
            maxAge
        };

        cookies.set('session', 'authenticated', cookieOptions);
        cookies.set('user_id', String(usuario.id), cookieOptions);
        cookies.set('user_name', `${usuario.nombre} ${usuario.apellido || ''}`.trim(), cookieOptions);
        cookies.set('user_role', usuario.rol, cookieOptions);
        cookies.set('user_sucursal', usuario.sucursal_id ? String(usuario.sucursal_id) : '', cookieOptions);
        cookies.set('es_super_admin', usuario.es_super_admin ? 'true' : 'false', cookieOptions);

        return new Response(JSON.stringify({
            success: true,
            mensaje: 'Login exitoso',
            redirect: '/admin/dashboard',
            user: {
                id: usuario.id,
                nombre: `${usuario.nombre} ${usuario.apellido || ''}`.trim(),
                email: usuario.email,
                rol: usuario.rol,
                sucursal_id: usuario.sucursal_id,
                es_super_admin: Boolean(usuario.es_super_admin)
            }
        }), { status: 200 });

    } catch (error: any) {
        console.error('Error al iniciar sesión:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al iniciar sesión'
        }), { status: 500 });
    }
};
