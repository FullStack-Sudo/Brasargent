import { query } from './db';

// ============================================
// GENERAR NÚMERO DE RESERVA POR SUCURSAL
// ============================================

export async function generarNumeroReserva(
    sucursalId: number
): Promise<string> {
    try {
        // Obtener prefijo de la sucursal
        const [sucursales] = await query(
            'SELECT prefijo_reserva FROM sucursales WHERE id = ?',
            [sucursalId]
        ) as any[];
        
        const sucursal = Array.isArray(sucursales) && sucursales.length > 0 ? sucursales[0] : null;
        const prefijo = sucursal?.prefijo_reserva || 'BR';
        const year = new Date().getFullYear();
        
        const prefixPattern = `${prefijo}-${year}-`;
        
        // Obtener el siguiente número secuencial para la sucursal y año
        const [rows] = await query(
            `SELECT COALESCE(MAX(CAST(SUBSTRING(numero_reserva, ?) AS UNSIGNED)), 0) + 1 as next_num
             FROM reservas 
             WHERE numero_reserva LIKE CONCAT(?, '%')`,
            [prefixPattern.length + 1, prefixPattern]
        ) as any[];
        
        const result = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
        const nextNum = result?.next_num || 1;
        const numeroFormateado = String(nextNum).padStart(4, '0');
        
        return `${prefijo}-${year}-${numeroFormateado}`;
    } catch (error) {
        console.error('Error al generar número de reserva:', error);
        // Fallback
        const fallback = `BR-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;
        return fallback;
    }
}

// ============================================
// VALIDAR NÚMERO DE RESERVA
// ============================================

export function validarNumeroReserva(numero: string): boolean {
    const regex = /^[A-Z]{3,4}-\d{4}-\d{4}$/;
    return regex.test(numero);
}

// ============================================
// EXTRAER INFORMACIÓN DEL NÚMERO DE RESERVA
// ============================================

export function extraerInfoNumeroReserva(numero: string): {
    prefijo: string;
    año: string;
    secuencia: string;
} | null {
    if (!numero) return null;
    const partes = numero.split('-');
    if (partes.length !== 3) return null;
    
    return {
        prefijo: partes[0],
        año: partes[1],
        secuencia: partes[2]
    };
}

// ============================================
// VERIFICAR SI UNA RESERVA ES ACEPTABLE (24H O MENOS)
// ============================================

export function esAceptable(fechaReserva: string, horaReserva: string): boolean {
    const ahora = new Date();
    const fechaStr = typeof fechaReserva === 'string' ? fechaReserva.slice(0, 10) : new Date(fechaReserva).toISOString().slice(0, 10);
    const horaStr = horaReserva ? (horaReserva.length === 5 ? `${horaReserva}:00` : horaReserva) : '12:00:00';
    
    const fechaHoraReserva = new Date(`${fechaStr}T${horaStr}`);
    
    // Calcular diferencia en horas
    const diferenciaMs = fechaHoraReserva.getTime() - ahora.getTime();
    const diferenciaHoras = diferenciaMs / (1000 * 60 * 60);
    
    // Solo aceptable si faltan 24 horas o menos
    return diferenciaHoras <= 24 && diferenciaHoras >= -4;
}

// ============================================
// OBTENER RESERVAS ACEPTABLES (DENTRO DE 24 HORAS)
// ============================================

export async function getReservasAceptables(): Promise<any[]> {
    const ahora = new Date();
    const fechaLimite = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);
    const fechaLimiteStr = fechaLimite.toISOString().slice(0, 19).replace('T', ' ');

    try {
        const [rows] = await query(`
            SELECT 
                r.id,
                r.nombre_cliente,
                r.telefono,
                r.fecha,
                r.hora,
                r.numero_personas,
                r.cantidad_ninos,
                r.sucursal_id,
                s.nombre AS sucursal_nombre
            FROM reservas r
            JOIN sucursales s ON r.sucursal_id = s.id
            WHERE r.estado = 'pendiente'
            AND CONCAT(r.fecha, ' ', r.hora) BETWEEN NOW() AND ?
            ORDER BY r.fecha ASC, r.hora ASC
        `, [fechaLimiteStr]) as any[];
        
        return Array.isArray(rows) ? rows : [];
    } catch (error) {
        console.error('Error al obtener reservas aceptables:', error);
        return [];
    }
}

// ============================================
// OBTENER RESERVAS FUTURAS (MÁS DE 24H)
// ============================================

export async function getReservasFuturas(): Promise<any[]> {
    const ahora = new Date();
    const fechaLimite = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000);
    const fechaLimiteStr = fechaLimite.toISOString().slice(0, 19).replace('T', ' ');

    try {
        const [rows] = await query(`
            SELECT 
                r.id,
                r.nombre_cliente,
                r.telefono,
                r.fecha,
                r.hora,
                r.numero_personas,
                r.cantidad_ninos,
                r.sucursal_id,
                s.nombre AS sucursal_nombre,
                TIMESTAMPDIFF(HOUR, NOW(), CONCAT(r.fecha, ' ', r.hora)) AS horas_restantes
            FROM reservas r
            JOIN sucursales s ON r.sucursal_id = s.id
            WHERE r.estado = 'pendiente'
            AND CONCAT(r.fecha, ' ', r.hora) > NOW()
            AND CONCAT(r.fecha, ' ', r.hora) < ?
            ORDER BY r.fecha ASC, r.hora ASC
        `, [fechaLimiteStr]) as any[];
        
        return Array.isArray(rows) ? rows : [];
    } catch (error) {
        console.error('Error al obtener reservas futuras:', error);
        return [];
    }
}
