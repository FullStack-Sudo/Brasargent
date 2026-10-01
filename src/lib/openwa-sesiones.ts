// src/lib/openwa-sesiones.ts
// Lógica para manejar sesiones de OpenWA por sucursal
// (Este archivo SÍ puede usar < y > sin problemas)

import { query } from './db';

// ============================================
// GENERAR NOMBRE DE SESIÓN
// ============================================
export function generarSessionName(nombre: string, id: number): string {
    const prefijos = ['churrasqueria', 'fastgrill', 'rodizio'];
    
    // Si el id está en rango, usar el prefijo
    if (id >= 1 && id <= 3) {
        return prefijos[id - 1];
    }
    
    // Fallback
    return 'sucursal' + id;
}

// ============================================
// INICIALIZAR SESIONES
// ============================================
export async function inicializarSesiones(): Promise<void> {
    const [sucursales] = await query('SELECT id, nombre FROM sucursales') as any;
    const lista = Array.isArray(sucursales) ? sucursales : [];
    
    for (const sucursal of lista) {
        const sessionName = generarSessionName(sucursal.nombre, sucursal.id);
        
        await query(
            'INSERT INTO openwa_sesiones (sucursal_id, session_name, status) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE sucursal_id = VALUES(sucursal_id)',
            [sucursal.id, sessionName, 'disconnected']
        );
    }
}

// ============================================
// OBTENER SESIONES
// ============================================
export async function obtenerSesiones(
    esSuperAdmin: boolean,
    userSucursal: any
): Promise<any[]> {
    let sesiones: any[] = [];
    
    if (esSuperAdmin) {
        const [rows] = await query(
            'SELECT os.*, s.nombre AS sucursal_nombre FROM openwa_sesiones os JOIN sucursales s ON os.sucursal_id = s.id ORDER BY s.nombre'
        ) as any;
        sesiones = rows;
    } else {
        const sucursalIdNum = parseInt(String(userSucursal || '0'), 10);
        const [rows] = await query(
            'SELECT os.*, s.nombre AS sucursal_nombre FROM openwa_sesiones os JOIN sucursales s ON os.sucursal_id = s.id WHERE os.sucursal_id = ?',
            [sucursalIdNum]
        ) as any;
        sesiones = rows;
    }
    
    return Array.isArray(sesiones) ? sesiones : [];
}
