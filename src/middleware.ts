// ============================================
// MIDDLEWARE DE AUTENTICACIÓN Y ROLES
// ============================================

import type { MiddlewareHandler } from 'astro';
import { query } from './lib/db';
import { checkFeatureToggle } from './middleware/featureToggles';

// Rutas públicas y de auth
const PUBLIC_ROUTES = [
    '/admin/login',
    '/admin/logout',
    '/api/auth/login',
    '/api/auth/logout',
    '/api/webhooks'
];

// Rutas que requieren SUPER ADMIN
const SUPER_ADMIN_ROUTES = [
    '/admin/usuarios',
    '/admin/configuracion',
    '/admin/sucursales/nueva',
    '/api/usuarios'
];

// Rutas permitidas para mesero/cocinero
const ROLES_PERMISSIONS: Record<string, string[]> = {
    admin: ['/admin/'],
    mesero: ['/admin/reservas', '/admin/clientes', '/admin/cocina', '/admin/login', '/admin/logout', '/api/'],
    cocinero: ['/admin/cocina', '/admin/login', '/admin/logout', '/api/']
};

function rutaPermitidaParaRol(rol: string, path: string): boolean {
    if (rol === 'admin') return true;
    const rutasPermitidas = ROLES_PERMISSIONS[rol] || [];
    return rutasPermitidas.some(ruta => path === ruta || path.startsWith(ruta + '/') || path.startsWith(ruta + '?'));
}

export const onRequest: MiddlewareHandler = async ({ request, cookies, redirect, locals }, next) => {
    const url = new URL(request.url);
    const path = url.pathname;

    // Permitir rutas públicas
    if (PUBLIC_ROUTES.some(route => path === route || path.startsWith(route + '/'))) {
        return next();
    }

    // Solo aplicar control de acceso en rutas /admin o /api
    if (!path.startsWith('/admin') && !path.startsWith('/api')) {
        return next();
    }

    // Verificar sesión
    const session = cookies.get('session');
    if (!session || session.value !== 'authenticated') {
        if (path.startsWith('/api/')) {
            return new Response(JSON.stringify({ success: false, error: 'No autenticado' }), { status: 401 });
        }
        return redirect('/admin/login');
    }

    // Obtener id del usuario desde la cookie
    const userId = cookies.get('user_id')?.value;
    if (!userId) {
        cookies.delete('session', { path: '/' });
        if (path.startsWith('/api/')) {
            return new Response(JSON.stringify({ success: false, error: 'Sesión inválida' }), { status: 401 });
        }
        return redirect('/admin/login');
    }

    try {
        const [usuarios] = await query(
            `SELECT 
                u.id, 
                u.nombre, 
                u.email, 
                u.rol, 
                u.sucursal_id, 
                u.es_super_admin,
                u.permisos,
                s.nombre AS sucursal_nombre
             FROM usuarios u
             LEFT JOIN sucursales s ON u.sucursal_id = s.id
             WHERE u.id = ? AND u.activo = 1`,
            [userId]
        ) as any[];

        const usuario = usuarios && usuarios[0];

        if (!usuario) {
            cookies.delete('session', { path: '/' });
            cookies.delete('user_id', { path: '/' });
            if (path.startsWith('/api/')) {
                return new Response(JSON.stringify({ success: false, error: 'Usuario no encontrado o inactivo' }), { status: 401 });
            }
            return redirect('/admin/login');
        }

        // Parsear JSON de permisos si existe
        if (typeof usuario.permisos === 'string') {
            try {
                usuario.permisos = JSON.parse(usuario.permisos);
            } catch (e) {
                usuario.permisos = null;
            }
        }

        // Guardar usuario en locals para uso en páginas y API routes
        locals.usuario = {
            id: usuario.id,
            nombre: usuario.nombre,
            email: usuario.email,
            rol: usuario.rol,
            sucursal_id: usuario.sucursal_id,
            es_super_admin: usuario.es_super_admin === 1 || usuario.es_super_admin === true,
            sucursal_nombre: usuario.sucursal_nombre,
            permisos: usuario.permisos
        };

        const esSuperAdmin = locals.usuario.es_super_admin;

        // Restringir rutas exclusivas de SUPER ADMIN
        if (SUPER_ADMIN_ROUTES.some(route => path === route || path.startsWith(route + '/'))) {
            if (!esSuperAdmin) {
                if (path.startsWith('/api/')) {
                    return new Response(JSON.stringify({ success: false, error: 'Acceso denegado. Se requiere ser Super Admin.' }), { status: 403 });
                }
                return redirect('/admin/dashboard');
            }
        }

        // Verificar rol mesero / cocinero si aplica
        if (usuario.rol !== 'admin' && !esSuperAdmin) {
            if (!rutaPermitidaParaRol(usuario.rol, path)) {
                if (path.startsWith('/api/')) {
                    return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), { status: 403 });
                }
                if (usuario.rol === 'mesero') {
                    return redirect('/admin/reservas');
                } else if (usuario.rol === 'cocinero') {
                    return redirect('/admin/cocina');
                }
                return redirect('/admin/login');
            }
        }

        // Verificar Feature Toggles en páginas admin
        if (path.startsWith('/admin') && !path.startsWith('/api/configuracion') && !path.startsWith('/api/auth')) {
            const { allowed, redirectTo } = await checkFeatureToggle(path);
            if (!allowed && redirectTo) {
                return redirect(redirectTo);
            }
        }

        return next();
    } catch (error: any) {
        console.error('Error en middleware auth:', error);
        return next();
    }
};
