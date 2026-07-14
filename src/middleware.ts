import type { MiddlewareHandler } from 'astro';
import { checkFeatureToggle } from './middleware/featureToggles';

// Rutas protegidas por rol
const ROLES = {
    admin: ['/admin/'],
    mesero: ['/admin/reservas', '/admin/clientes', '/admin/cocina', '/admin/login', '/admin/logout', '/api/'],
    cocinero: ['/admin/cocina', '/admin/login', '/admin/logout', '/api/']
};

// Verificar si una ruta está permitida para un rol
function rutaPermitida(rol: string, path: string): boolean {
    if (rol === 'admin') return true;
    
    const rutasPermitidas = ROLES[rol as keyof typeof ROLES] || [];
    return rutasPermitidas.some(ruta => path === ruta || path.startsWith(ruta + '/') || path.startsWith(ruta + '?'));
}

export const onRequest: MiddlewareHandler = async ({ request, cookies, redirect }, next) => {
    const url = new URL(request.url);
    const path = url.pathname;

    // Rutas públicas y de API (algunas APIs manejan su propia autenticación)
    if (path === '/admin/login' || path === '/admin/logout' || path.startsWith('/api/auth/')) {
        return next();
    }

    // Proteger las rutas que empiezan con /admin o APIs (si es necesario)
    if (path.startsWith('/admin')) {
        // Verificar autenticación
        const session = cookies.get('session');
        if (!session || session.value !== 'authenticated') {
            return redirect('/admin/login');
        }

        // Obtener rol del usuario
        const userRole = cookies.get('user_role')?.value || 'mesero';

        // Mesero y Cocinero tienen acceso limitado
        if (userRole !== 'admin' && !rutaPermitida(userRole, path)) {
            // Redirigir según rol
            if (userRole === 'mesero') {
                return redirect('/admin/reservas');
            } else if (userRole === 'cocinero') {
                return redirect('/admin/cocina');
            }
            return redirect('/admin/login');
        }
        
        // Verificar feature toggles (excepto API de configuración)
        if (!path.startsWith('/api/configuracion') && !path.startsWith('/api/auth')) {
            const { allowed, redirectTo } = await checkFeatureToggle(path);
            if (!allowed && redirectTo) {
                return redirect(redirectTo);
            }
        }
    }

    return next();
};
