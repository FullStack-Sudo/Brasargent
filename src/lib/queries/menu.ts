import pool from '../db';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

// Datos extra de presentación (Concepto, Rating, Icono). NO contiene platos:
// el menú siempre se lee de la base de datos para respetar lo que hace el admin.
export const SUCURSAL_META: Record<number, any> = {
    1: { icon: '', concepto: 'Churrasquería', rating: 4.3, resenas: '1.2K' },
    2: { icon: '', concepto: 'Rodizio Tradicional', rating: 4.5, resenas: '1.3K' },
    3: { icon: '', concepto: 'Restaurante', rating: 3.9, resenas: '100' }
};

export async function getSucursalesActivas() {
    try {
        const query = `
            SELECT 
                s.id,
                s.nombre,
                s.direccion,
                s.telefono,
                s.horario,
                s.capacidad,
                s.activo,
                COUNT(DISTINCT ms.plato_id) AS total_platos,
                SUM(CASE WHEN ms.disponible = 1 THEN 1 ELSE 0 END) AS disponibles,
                SUM(CASE WHEN ms.disponible = 0 THEN 1 ELSE 0 END) AS agotados
            FROM sucursales s
            LEFT JOIN menu_sucursal ms ON s.id = ms.sucursal_id
            WHERE s.activo = 1
            GROUP BY s.id
            ORDER BY s.nombre;
        `;
        const [rows] = await pool.query<RowDataPacket[]>(query);

        return rows.map(r => ({
            ...r,
            total_platos: Number(r.total_platos) || 0,
            disponibles: Number(r.disponibles) || 0,
            agotados: Number(r.agotados) || 0,
            concepto: SUCURSAL_META[r.id]?.concepto || 'Restaurante',
            rating: SUCURSAL_META[r.id]?.rating || 4.0,
            reseñas: SUCURSAL_META[r.id]?.resenas || '0'
        }));
    } catch (error) {
        console.error("Error DB (getSucursalesActivas):", error);
        return [];
    }
}

export async function getMenuSucursal(sucursalId: number) {
    const qSucursal = `SELECT id, nombre, direccion, horario FROM sucursales WHERE id = ?`;
    const [sucRows] = await pool.query<RowDataPacket[]>(qSucursal, [sucursalId]);

    if (sucRows.length === 0) return null;

    const sucursalBase = sucRows[0];

    const qMenu = `
        SELECT 
            p.id,
            p.nombre,
            p.descripcion,
            p.precio,
            p.categoria_id,
            c.nombre AS categoria,
            p.imagen_url,
            ms.disponible,
            p.destacado
        FROM menu_sucursal ms
        JOIN platos p ON ms.plato_id = p.id
        JOIN categorias c ON p.categoria_id = c.id
        WHERE ms.sucursal_id = ?
        ORDER BY c.nombre, p.nombre;
    `;
    const [platos] = await pool.query<RowDataPacket[]>(qMenu, [sucursalId]);

    return {
        sucursal: {
            ...sucursalBase,
            concepto: SUCURSAL_META[sucursalId]?.concepto || 'Restaurante',
            rating: SUCURSAL_META[sucursalId]?.rating || 4.0,
            reseñas: SUCURSAL_META[sucursalId]?.resenas || '0'
        },
        platos: platos
    };
}

export async function toggleDisponibilidad(sucursalId: number, platoId: number, disponible: boolean) {
    const val = disponible ? 1 : 0;
    try {
        const query = `
            UPDATE menu_sucursal
            SET disponible = ?
            WHERE sucursal_id = ? AND plato_id = ?;
        `;
        await pool.query<ResultSetHeader>(query, [val, sucursalId, platoId]);
        return true;
    } catch (error) {
        console.error("Error DB (toggleDisponibilidad):", error);
        return false;
    }
}

export async function actualizarPlato(id: number, nombre: string, descripcion: string, precio: number, categoria_id: number) {
    try {
        const query = `
            UPDATE platos
            SET 
                nombre = ?,
                descripcion = ?,
                precio = ?,
                categoria_id = ?
            WHERE id = ?;
        `;
        await pool.query<ResultSetHeader>(query, [nombre, descripcion, precio, categoria_id, id]);
        return true;
    } catch (error) {
        console.error("Error DB (actualizarPlato):", error);
        return false;
    }
}

export async function actualizarImagenPlato(id: number, imagen_url: string) {
    try {
        const query = `
            UPDATE platos
            SET imagen_url = ?
            WHERE id = ?;
        `;
        await pool.query<ResultSetHeader>(query, [imagen_url, id]);
        return true;
    } catch (error) {
        console.error("Error DB (actualizarImagenPlato):", error);
        return false;
    }
}

export async function crearPlato(sucursalId: number, nombre: string, descripcion: string, precio: number, categoria_id: number) {
    try {
        const queryPlato = `
            INSERT INTO platos (nombre, descripcion, precio, categoria_id)
            VALUES (?, ?, ?, ?);
        `;
        const [resultPlato] = await pool.query<ResultSetHeader>(queryPlato, [nombre, descripcion, precio, categoria_id]);

        const realId = resultPlato.insertId;

        const queryVinculo = `
            INSERT INTO menu_sucursal (sucursal_id, plato_id, disponible)
            VALUES (?, ?, 1);
        `;
        await pool.query<ResultSetHeader>(queryVinculo, [sucursalId, realId]);

        return { success: true, id: realId };
    } catch (error) {
        console.error("Error DB (crearPlato):", error);
        return { success: false, id: 0 };
    }
}

export async function eliminarPlato(platoId: number, sucursalId?: number) {
    try {
        if (sucursalId) {
            await pool.query('DELETE FROM menu_sucursal WHERE sucursal_id = ? AND plato_id = ?', [sucursalId, platoId]);
            const [rows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM menu_sucursal WHERE plato_id = ?', [platoId]);
            if (rows.length > 0 && rows[0].count === 0) {
                await pool.query('DELETE FROM platos WHERE id = ?', [platoId]);
            }
        } else {
            await pool.query('DELETE FROM menu_sucursal WHERE plato_id = ?', [platoId]);
            await pool.query('DELETE FROM platos WHERE id = ?', [platoId]);
        }
        return true;
    } catch (error) {
        console.error("Error DB (eliminarPlato):", error);
        return false;
    }
}

// ============================================
// CATEGORÍAS (CRUD)
// ============================================

// Categorías base del menú. Se crean en BD si no existen (una vez por arranque).
const CATEGORIAS_BASE = [
    'Entradas',
    'Cortes clásicos',
    'Platos premium',
    'Cortes junior',
    'Extras',
    'Bebidas',
    'Postres'
];

// Categorías antiguas: se ocultan si ya no tienen platos asociados.
const CATEGORIAS_LEGACY = [
    'Cortes', 'Parrilladas', 'Guarniciones', 'Cortes Premium', 'Comida Rápida',
    'Sándwiches', 'Ensaladas', 'Experiencia', 'Espadas', 'Buffet'
];

const norm = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

let categoriasBaseAseguradas = false;

async function asegurarCategoriasBase() {
    if (categoriasBaseAseguradas) return;
    const [rows] = await pool.query<RowDataPacket[]>('SELECT id, nombre FROM categorias');
    for (const nombre of CATEGORIAS_BASE) {
        if (!rows.some(r => norm(r.nombre) === norm(nombre))) {
            await pool.query<ResultSetHeader>('INSERT INTO categorias (nombre) VALUES (?)', [nombre]);
        }
    }
    categoriasBaseAseguradas = true;
}

export async function getCategorias() {
    try {
        await asegurarCategoriasBase();
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT c.id, c.nombre, COUNT(p.id) AS total_platos
             FROM categorias c
             LEFT JOIN platos p ON p.categoria_id = c.id
             GROUP BY c.id, c.nombre
             ORDER BY c.id ASC`
        );
        const legacy = CATEGORIAS_LEGACY.map(norm);
        const lista = rows
            .map(r => ({ id: r.id as number, nombre: r.nombre as string, total_platos: Number(r.total_platos) || 0 }))
            .filter(r => !(legacy.includes(norm(r.nombre)) && r.total_platos === 0));

        // Orden: primero las base en el orden indicado, luego las creadas por el admin
        const idxBase = (n: string) => {
            const i = CATEGORIAS_BASE.findIndex(b => norm(b) === norm(n));
            return i === -1 ? Number.MAX_SAFE_INTEGER : i;
        };
        return lista.sort((a, b) => idxBase(a.nombre) - idxBase(b.nombre) || a.id - b.id);
    } catch (e) {
        console.error("Error DB (getCategorias):", e);
        return [];
    }
}

async function existeNombreCategoria(nombre: string, excluirId?: number) {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT id, nombre FROM categorias');
    return rows.some(r => r.id !== excluirId && norm(r.nombre) === norm(nombre));
}

export async function crearCategoria(nombre: string): Promise<{ success: boolean; id?: number; message?: string }> {
    const limpio = nombre.trim();
    if (!limpio) return { success: false, message: 'El nombre es requerido' };
    try {
        if (await existeNombreCategoria(limpio)) {
            return { success: false, message: 'Ya existe una categoría con ese nombre' };
        }
        const [res] = await pool.query<ResultSetHeader>('INSERT INTO categorias (nombre) VALUES (?)', [limpio]);
        return { success: true, id: res.insertId };
    } catch (e) {
        console.error("Error DB (crearCategoria):", e);
        return { success: false, message: 'Error al crear la categoría' };
    }
}

export async function actualizarCategoria(id: number, nombre: string): Promise<{ success: boolean; message?: string }> {
    const limpio = nombre.trim();
    if (!limpio) return { success: false, message: 'El nombre es requerido' };
    try {
        if (await existeNombreCategoria(limpio, id)) {
            return { success: false, message: 'Ya existe una categoría con ese nombre' };
        }
        await pool.query<ResultSetHeader>('UPDATE categorias SET nombre = ? WHERE id = ?', [limpio, id]);
        return { success: true };
    } catch (e) {
        console.error("Error DB (actualizarCategoria):", e);
        return { success: false, message: 'Error al actualizar la categoría' };
    }
}

export async function eliminarCategoria(id: number): Promise<{ success: boolean; message?: string }> {
    try {
        const [rows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM platos WHERE categoria_id = ?', [id]);
        const total = Number(rows[0]?.total) || 0;
        if (total > 0) {
            return {
                success: false,
                message: `No se puede eliminar: tiene ${total} ${total === 1 ? 'plato asociado' : 'platos asociados'}. Muévelos a otra categoría primero.`
            };
        }
        await pool.query<ResultSetHeader>('DELETE FROM categorias WHERE id = ?', [id]);
        return { success: true };
    } catch (e) {
        console.error("Error DB (eliminarCategoria):", e);
        return { success: false, message: 'Error al eliminar la categoría' };
    }
}
