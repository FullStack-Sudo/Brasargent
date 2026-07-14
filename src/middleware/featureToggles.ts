import pool from '../lib/db';

// Cache de configuración (5 minutos)
let configCache: Record<string, string> = {};
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

async function getConfig(clave: string): Promise<boolean> {
    // Verificar cache
    const now = Date.now();
    if (now - cacheTimestamp > CACHE_TTL) {
        try {
            const [rows] = await pool.query('SELECT clave, valor FROM configuracion_sistema');
            configCache = {};
            (rows as any[]).forEach((item: any) => {
                configCache[item.clave] = item.valor;
            });
            cacheTimestamp = now;
        } catch (error) {
            console.error('Error al cargar configuración:', error);
        }
    }
    
    return configCache[clave] === 'true';
}

// Funciones de verificación
export async function isModuloCocinaActivo(): Promise<boolean> {
    return await getConfig('modulo_cocina');
}

export async function isModuloReservasActivo(): Promise<boolean> {
    return await getConfig('modulo_reservas');
}

export async function isModuloMenuActivo(): Promise<boolean> {
    return await getConfig('modulo_menu');
}

export async function isModuloClientesActivo(): Promise<boolean> {
    return await getConfig('modulo_clientes');
}

// Middleware para redirigir si un módulo está desactivado
export async function checkFeatureToggle(path: string): Promise<{ allowed: boolean; redirectTo?: string }> {
    // Rutas de Cocina
    if (path.startsWith('/admin/cocina') || path.includes('pedidos_cocina')) {
        const activo = await isModuloCocinaActivo();
        if (!activo) {
            return { allowed: false, redirectTo: '/admin/dashboard' };
        }
    }
    
    // Rutas de Reservas
    if (path.startsWith('/admin/reservas') && !path.includes('/api/')) {
        const activo = await isModuloReservasActivo();
        if (!activo) {
            return { allowed: false, redirectTo: '/admin/dashboard' };
        }
    }
    
    // Rutas de Menú
    if (path.startsWith('/admin/menu')) {
        const activo = await isModuloMenuActivo();
        if (!activo) {
            return { allowed: false, redirectTo: '/admin/dashboard' };
        }
    }
    
    // Rutas de Clientes
    if (path.startsWith('/admin/clientes')) {
        const activo = await isModuloClientesActivo();
        if (!activo) {
            return { allowed: false, redirectTo: '/admin/dashboard' };
        }
    }
    
    return { allowed: true };
}
