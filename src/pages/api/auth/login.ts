import type { APIRoute } from 'astro';
import pool from '../../../lib/db';
import { verifyPassword } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Faltan credenciales'
            }), { status: 400 });
        }

        // Buscar el usuario por email
        const [usuariosData] = await pool.query(
            'SELECT * FROM usuarios WHERE email = ?',
            [email]
        ) as any[];

        const usuario = usuariosData[0];

        if (!usuario) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Usuario no encontrado'
            }), { status: 404 });
        }

        if (!usuario.activo) {
            return new Response(JSON.stringify({
                success: false,
                error: 'El usuario está inactivo. Contacta al administrador.'
            }), { status: 403 });
        }

        // Verificar la contraseña
        const isPasswordValid = await verifyPassword(password, usuario.password);

        if (!isPasswordValid) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Contraseña incorrecta'
            }), { status: 401 });
        }

        // Configurar cookies de sesión
        const maxAge = 60 * 60 * 24; // 1 día
        const cookieOptions = {
            path: '/',
            maxAge: maxAge,
            httpOnly: false, // para que el frontend pueda leerlas si necesita
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax' as const
        };

        cookies.set('session', 'authenticated', cookieOptions);
        cookies.set('user_name', `${usuario.nombre} ${usuario.apellido || ''}`.trim(), cookieOptions);
        cookies.set('user_id', String(usuario.id), cookieOptions);
        cookies.set('user_role', usuario.rol, cookieOptions);

        return new Response(JSON.stringify({
            success: true,
            mensaje: 'Login exitoso',
            user: {
                id: usuario.id,
                nombre: usuario.nombre,
                rol: usuario.rol
            }
        }), { status: 200 });
        
    } catch (error: any) {
        console.error('Error en login:', error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Error interno del servidor'
        }), { status: 500 });
    }
};
