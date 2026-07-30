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

    // Rutas públicas y de API
    if (path === '/admin/login' || path === '/admin/logout' || path.startsWith('/api/auth/')) {
        return next();
    }

    // Proteger las rutas que empiezan con /admin
    if (path.startsWith('/admin')) {
        const session = cookies.get('session');
        if (!session || session.value !== 'authenticated') {
            return redirect('/admin/login');
        }

        const userRole = cookies.get('user_role')?.value || 'mesero';

        if (userRole !== 'admin' && !rutaPermitida(userRole, path)) {
            if (userRole === 'mesero') {
                return redirect('/admin/reservas');
            } else if (userRole === 'cocinero') {
                return redirect('/admin/cocina');
            }
            return redirect('/admin/login');
        }
        
        if (!path.startsWith('/api/configuracion') && !path.startsWith('/api/auth')) {
            const { allowed, redirectTo } = await checkFeatureToggle(path);
            if (!allowed && redirectTo) {
                return redirect(redirectTo);
            }
        }
    }

    return next();
};
