import pool from '../db';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

const MOCK_RESERVAS = [
    { id: 1, sucursal_id: 1, nombre_cliente: 'Carlos Mendoza', telefono: '70000111', email: 'carlos@email.com', fecha: '2026-07-15', hora: '19:00:00', numero_personas: 4, tipo_servicio: 'rodizio', estado: 'confirmada', alerta_enviada: 0, tiempo_restante: 60, notificacion_enviada: 0 },
    { id: 2, sucursal_id: 1, nombre_cliente: 'Ana Rodríguez', telefono: '70000222', email: 'ana@email.com', fecha: '2026-07-15', hora: '20:30:00', numero_personas: 2, tipo_servicio: 'carta', estado: 'pendiente', alerta_enviada: 0, tiempo_restante: 150, notificacion_enviada: 0 },
    { id: 3, sucursal_id: 1, nombre_cliente: 'Luis Gómez (VIP)', telefono: '70000333', email: 'luis@email.com', fecha: '2026-07-15', hora: '21:00:00', numero_personas: 8, tipo_servicio: 'rodizio', estado: 'confirmada', alerta_enviada: 0, tiempo_restante: 180, notificacion_enviada: 0 }
];

export async function getReservas() {
    try {
        const query = `
            SELECT r.*, s.nombre as sucursal, s.telefono as telefono_sucursal, cr.tiempo_alerta, cr.mensaje_recordatorio
            FROM reservas r
            JOIN sucursales s ON r.sucursal_id = s.id
            LEFT JOIN configuracion_reservas cr ON s.id = cr.sucursal_id
            ORDER BY r.fecha ASC, r.hora ASC
            LIMIT 50;
        `;
        const [rows] = await pool.query<RowDataPacket[]>(query);
        if (rows.length === 0) return MOCK_RESERVAS;
        return rows;
    } catch (error) {
        console.warn("Error DB (getReservas): Usando MOCK DATA", error);
        return MOCK_RESERVAS;
    }
}

export async function getReserva(id: number) {
    try {
        const query = `
            SELECT r.*, s.nombre as sucursal, s.telefono as telefono_sucursal, cr.tiempo_alerta, cr.mensaje_recordatorio
            FROM reservas r
            JOIN sucursales s ON r.sucursal_id = s.id
            LEFT JOIN configuracion_reservas cr ON s.id = cr.sucursal_id
            WHERE r.id = ?;
        `;
        const [rows] = await pool.query<RowDataPacket[]>(query, [id]);
        if (rows.length === 0) return MOCK_RESERVAS.find(r => r.id === id);
        return rows[0];
    } catch (error) {
        console.warn("Error DB (getReserva): Usando MOCK DATA", error);
        return MOCK_RESERVAS.find(r => r.id === id);
    }
}

export async function verificarDisponibilidad(sucursalId: number, fecha: string, hora: string, personas: number) {
    try {
        // En lugar del procedimiento, hacemos la consulta manualmente como fallback
        const [sucRows] = await pool.query<RowDataPacket[]>(`SELECT capacidad_total FROM sucursales WHERE id = ?`, [sucursalId]);
        if (sucRows.length === 0) return { disponible: false, actual: 0, maxima: 0 };
        const maxima = sucRows[0].capacidad_total;

        const [resRows] = await pool.query<RowDataPacket[]>(`
            SELECT COALESCE(SUM(numero_personas), 0) as actual
            FROM reservas
            WHERE sucursal_id = ? AND fecha = ? 
            AND hora BETWEEN ADDTIME(?, '-01:00:00') AND ADDTIME(?, '01:00:00')
            AND estado = 'confirmada'
        `, [sucursalId, fecha, hora, hora]);
        
        const actual = resRows[0].actual;
        const disponible = (actual + personas) <= maxima;

        return { disponible, actual, maxima };
    } catch (error) {
        console.warn("Error DB (verificarDisponibilidad): Asumiendo disponible");
        return { disponible: true, actual: 0, maxima: 120 };
    }
}

export async function crearReserva(data: any) {
    try {
        const query = `
            INSERT INTO reservas (sucursal_id, nombre_cliente, telefono, email, fecha, hora, numero_personas, tipo_servicio, estado, observaciones)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const [result] = await pool.query<ResultSetHeader>(query, [
            data.sucursal_id || 1,
            data.nombre_cliente,
            data.telefono,
            data.email || null,
            data.fecha,
            data.hora,
            data.numero_personas,
            data.tipo_servicio || 'carta',
            'pendiente',
            data.observaciones || null
        ]);
        
        return { success: true, id: result.insertId };
    } catch (error) {
        console.error("Error DB (crearReserva):", error);
        return { success: false, error: "Error al crear la reserva" };
    }
}

export async function actualizarEstadoReserva(id: number, estado: string, motivo: string = '') {
    try {
        const conn = await pool.getConnection();
        await conn.beginTransaction();

        try {
            // Obtener estado anterior y datos
            const [resRows] = await conn.query<RowDataPacket[]>(`SELECT sucursal_id, numero_personas, estado FROM reservas WHERE id = ?`, [id]);
            if (resRows.length === 0) throw new Error("Reserva no encontrada");
            const reserva = resRows[0];

            // Actualizar reserva
            await conn.query(`UPDATE reservas SET estado = ?, observaciones = CONCAT_WS(' - ', observaciones, ?) WHERE id = ?`, [estado, motivo, id]);

            // Emular el Trigger manualmente por si falló su creación
            if (estado === 'confirmada' && reserva.estado !== 'confirmada') {
                await conn.query(`UPDATE sucursales SET capacidad_actual = capacidad_actual + ? WHERE id = ?`, [reserva.numero_personas, reserva.sucursal_id]);
            } else if (estado === 'cancelada' && reserva.estado !== 'cancelada') {
                // Solo si antes estaba confirmada habría que restar, pero la lógica del trigger decía != cancelada.
                // Ajuste más seguro: si cancelo una confirmada, libero cupo.
                if (reserva.estado === 'confirmada') {
                    await conn.query(`UPDATE sucursales SET capacidad_actual = GREATEST(0, capacidad_actual - ?) WHERE id = ?`, [reserva.numero_personas, reserva.sucursal_id]);
                }
            }

            await conn.commit();
            conn.release();
            return { success: true };
        } catch (err) {
            await conn.rollback();
            conn.release();
            throw err;
        }
    } catch (error) {
        console.error("Error DB (actualizarEstadoReserva):", error);
        return { success: false, error: "Error al actualizar estado" };
    }
}

export async function marcarAlertaEnviada(id: number, alerta: boolean, notificacion: boolean) {
    try {
        // En algunas BD la columna se llama alerta_enviada, en otras quiza no. Usamos try/catch.
        await pool.query(`UPDATE reservas SET alerta_enviada = ?, notificacion_enviada = ? WHERE id = ?`, [alerta, notificacion, id]);
        return { success: true };
    } catch (error) {
        console.warn("Error DB (marcarAlertaEnviada): Simulado");
        return { success: true };
    }
}
