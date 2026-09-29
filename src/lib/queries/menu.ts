import pool from '../db';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

// Interfaz para fallback y datos extra (Concepto, Rating, Icono)
export const SUCURSAL_META: Record<number, any> = {
    1: { icon: '', concepto: 'Churrasquería', rating: 4.3, resenas: '1.2K' },
    2: { icon: '', concepto: 'Rodizio Tradicional', rating: 4.5, resenas: '1.3K' }, // Modificado para que coincida con el screenshot y texto
    3: { icon: '', concepto: 'Restaurante', rating: 3.9, resenas: '100' }
};

const mockData = {
    sucursales: [
        {
            id: 1,
            nombre: 'Churrasquería',
            direccion: 'Sucursal Beni, Av. casi - 5to anillo',
            telefono: '+591 70000001',
            horario: 'Lun-Sáb: 11:30-15:00 / 18:30-22:00, Dom: 11:30-15:00',
            capacidad: 60,
            activo: 1,
            total_platos: 10,
            disponibles: 8,
            agotados: 2
        },
        {
            id: 2,
            nombre: 'Fast Grill',
            direccion: 'C. 12 Oeste',
            telefono: '+591 70000002',
            horario: 'Lun-Dom: 12:00-22:00',
            capacidad: 40,
            activo: 1,
            total_platos: 8,
            disponibles: 8,
            agotados: 0
        },
        {
            id: 3,
            nombre: 'Rodizio',
            direccion: 'Las Brisas',
            telefono: '+591 70000003',
            horario: 'Lun-Sáb: 11:30-15:30 / 18:30-22:00, Dom: 11:30-15:30',
            capacidad: 80,
            activo: 1,
            total_platos: 10,
            disponibles: 10,
            agotados: 0
        }
    ],
    menu: [
        // Churrasquería (ID 1)
        { id: 1, nombre: 'Picaña Premium', descripcion: 'Corte jugoso con marmoleo perfecto, asado a la parrilla', precio: 120.00, categoria: 'Cortes', imagen_url: '', disponible: 1, destacado: 1, sucursal_id: 1 },
        { id: 2, nombre: 'Costilla de Res', descripcion: 'Costilla asada a la parrilla con hueso', precio: 95.00, categoria: 'Cortes', imagen_url: '', disponible: 1, destacado: 0, sucursal_id: 1 },
        { id: 3, nombre: 'Parrillada Mixta', descripcion: 'Variedad de carnes para compartir (2 personas)', precio: 180.00, categoria: 'Parrilladas', imagen_url: '', disponible: 1, destacado: 1, sucursal_id: 1 },
        { id: 4, nombre: 'Churrasco Argentino', descripcion: 'Churrasco con papas fritas y ensalada', precio: 85.00, categoria: 'Parrilladas', imagen_url: '', disponible: 1, destacado: 0, sucursal_id: 1 },
        { id: 5, nombre: 'Choripán', descripcion: 'Chorizo con pan y chimichurri', precio: 30.00, categoria: 'Entradas', imagen_url: '', disponible: 1, destacado: 0, sucursal_id: 1 },
        { id: 6, nombre: 'Provoleta', descripcion: 'Provoleta a la parrilla con orégano', precio: 35.00, categoria: 'Entradas', imagen_url: '', disponible: 0, destacado: 0, sucursal_id: 1 },
        { id: 7, nombre: 'Ensalada Mixta', descripcion: 'Ensalada fresca con vegetales de temporada', precio: 25.00, categoria: 'Guarniciones', imagen_url: '', disponible: 1, destacado: 0, sucursal_id: 1 },
        { id: 8, nombre: 'Lomo Fino', descripcion: 'Lomo de res con guarnición de verduras', precio: 110.00, categoria: 'Cortes', imagen_url: '', disponible: 1, destacado: 1, sucursal_id: 1 },
        { id: 9, nombre: 'Picaña Especial', descripcion: 'Picaña madurada 30 días', precio: 150.00, categoria: 'Cortes Premium', imagen_url: '', disponible: 1, destacado: 1, sucursal_id: 1 },
        { id: 10, nombre: 'Costilla Especial', descripcion: 'Costilla BBQ ahumada', precio: 130.00, categoria: 'Cortes Premium', imagen_url: '', disponible: 0, destacado: 0, sucursal_id: 1 },
        
        // Fast Grill (ID 2)
        { id: 11, nombre: 'Hamburguesa Premium', descripcion: 'Hamburguesa de carne angus con queso y vegetales', precio: 45.00, categoria: 'Comida Rápida', imagen_url: '', disponible: 1, destacado: 1, sucursal_id: 2 },
        { id: 12, nombre: 'Hot Dog Especial', descripcion: 'Pan con salchicha y acompañamientos', precio: 25.00, categoria: 'Comida Rápida', imagen_url: '', disponible: 1, destacado: 0, sucursal_id: 2 },
        { id: 13, nombre: 'Sandwich de Lomo', descripcion: 'Lomo con pan integral y vegetales', precio: 35.00, categoria: 'Sándwiches', imagen_url: '', disponible: 1, destacado: 0, sucursal_id: 2 },
        { id: 14, nombre: 'Papas Fritas', descripcion: 'Papas fritas crujientes con sal', precio: 15.00, categoria: 'Acompañamientos', imagen_url: '', disponible: 1, destacado: 0, sucursal_id: 2 },
        { id: 15, nombre: 'Nuggets de Pollo', descripcion: 'Nuggets de pollo con salsa dip', precio: 25.00, categoria: 'Comida Rápida', imagen_url: '', disponible: 1, destacado: 0, sucursal_id: 2 },
        { id: 16, nombre: 'Ensalada César', descripcion: 'Ensalada con pollo y aderezo César', precio: 30.00, categoria: 'Ensaladas', imagen_url: '', disponible: 1, destacado: 0, sucursal_id: 2 },
        { id: 17, nombre: 'Vino Malbec', descripcion: 'Copa de vino Malbec argentino', precio: 35.00, categoria: 'Bebidas', imagen_url: '', disponible: 1, destacado: 0, sucursal_id: 2 },
        { id: 18, nombre: 'Soda', descripcion: 'Bebida gaseosa de 500ml', precio: 15.00, categoria: 'Bebidas', imagen_url: '', disponible: 1, destacado: 0, sucursal_id: 2 },

        // Rodizio (ID 3)
        { id: 19, nombre: 'Rodizio Completo', descripcion: 'Experiencia completa con todos los cortes', precio: 250.00, categoria: 'Experiencia', imagen_url: '', disponible: 1, destacado: 1, sucursal_id: 3 },
        { id: 20, nombre: 'Picaña en Espada', descripcion: 'Picaña asada en espada directo a la mesa', precio: 150.00, categoria: 'Espadas', imagen_url: '', disponible: 1, destacado: 1, sucursal_id: 3 },
        { id: 21, nombre: 'Costilla en Espada', descripcion: 'Costilla asada en espada', precio: 130.00, categoria: 'Espadas', imagen_url: '', disponible: 1, destacado: 0, sucursal_id: 3 },
        { id: 22, nombre: 'Lomo en Espada', descripcion: 'Lomo asado en espada', precio: 140.00, categoria: 'Espadas', imagen_url: '', disponible: 1, destacado: 1, sucursal_id: 3 },
        { id: 23, nombre: 'Buffet de Guarniciones', descripcion: 'Variedad de guarniciones y acompañamientos', precio: 60.00, categoria: 'Buffet', imagen_url: '', disponible: 1, destacado: 0, sucursal_id: 3 },
        { id: 24, nombre: 'Ensaladas Variadas', descripcion: 'Selección de ensaladas frescas', precio: 35.00, categoria: 'Buffet', imagen_url: '', disponible: 1, destacado: 0, sucursal_id: 3 },
        { id: 25, nombre: 'Flan Casero', descripcion: 'Flan con dulce de leche y crema', precio: 30.00, categoria: 'Postres', imagen_url: '', disponible: 1, destacado: 0, sucursal_id: 3 },
        { id: 26, nombre: 'Helado Artesanal', descripcion: 'Helado de vainilla con salsa de chocolate', precio: 25.00, categoria: 'Postres', imagen_url: '', disponible: 1, destacado: 0, sucursal_id: 3 },
        { id: 27, nombre: 'Vino Malbec', descripcion: 'Copa de vino Malbec argentino', precio: 35.00, categoria: 'Bebidas', imagen_url: '', disponible: 1, destacado: 0, sucursal_id: 3 },
        { id: 28, nombre: 'Soda', descripcion: 'Bebida gaseosa de 500ml', precio: 15.00, categoria: 'Bebidas', imagen_url: '', disponible: 1, destacado: 0, sucursal_id: 3 }
    ]
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
        
        if (rows.length === 0) return mockData.sucursales.map(s => ({...s, ...SUCURSAL_META[s.id]}));
        
        return rows.map(r => ({
            ...r,
            concepto: SUCURSAL_META[r.id]?.concepto || 'Restaurante',
            rating: SUCURSAL_META[r.id]?.rating || 4.0,
            reseñas: SUCURSAL_META[r.id]?.resenas || '0'
        }));
    } catch (error) {
        console.warn("Error DB (getSucursalesActivas): Usando MOCK DATA", error);
        return mockData.sucursales.map(s => ({...s, ...SUCURSAL_META[s.id]}));
    }
}

export async function getMenuSucursal(sucursalId: number) {
    try {
        const qSucursal = `SELECT id, nombre, direccion, horario FROM sucursales WHERE id = ?`;
        const [sucRows] = await pool.query<RowDataPacket[]>(qSucursal, [sucursalId]);
        
        if (sucRows.length === 0) throw new Error("Sucursal no encontrada en BD");
        
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
    } catch (error) {
        console.warn("Error DB (getMenuSucursal): Usando MOCK DATA", error);
        const suc = mockData.sucursales.find(s => s.id === sucursalId) || mockData.sucursales[0];
        return {
            sucursal: { ...suc, ...SUCURSAL_META[suc.id] },
            platos: mockData.menu.filter(p => p.sucursal_id === sucursalId)
        };
    }
}

export async function toggleDisponibilidad(sucursalId: number, platoId: number, disponible: boolean) {
    const val = disponible ? 1 : 0;
    const item = mockData.menu.find(p => p.id === platoId && p.sucursal_id === sucursalId);
    if (item) item.disponible = val;

    try {
        const query = `
            UPDATE menu_sucursal
            SET disponible = ?
            WHERE sucursal_id = ? AND plato_id = ?;
        `;
        await pool.query<ResultSetHeader>(query, [val, sucursalId, platoId]);
        return true; 
    } catch (error) {
        console.warn("Error DB (toggleDisponibilidad): Usando MOCK DATA");
        return true;
    }
}

export async function actualizarPlato(id: number, nombre: string, descripcion: string, precio: number, categoria_id: number) {
    const categorias = await getCategorias();
    const catObj = categorias.find((c: any) => c.id === categoria_id);
    const catNombre = catObj ? catObj.nombre : 'General';

    const item = mockData.menu.find(p => p.id === id);
    if (item) {
        item.nombre = nombre;
        item.descripcion = descripcion;
        item.precio = precio;
        item.categoria = catNombre;
    }

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
        console.warn("Error DB (actualizarPlato): Usando MOCK DATA");
        return true;
    }
}

export async function actualizarImagenPlato(id: number, imagen_url: string) {
    const item = mockData.menu.find(p => p.id === id);
    if (item) item.imagen_url = imagen_url;

    try {
        const query = `
            UPDATE platos
            SET imagen_url = ?
            WHERE id = ?;
        `;
        await pool.query<ResultSetHeader>(query, [imagen_url, id]);
        return true;
    } catch (error) {
        console.warn("Error DB (actualizarImagenPlato): Usando MOCK DATA");
        return true;
    }
}

export async function crearPlato(sucursalId: number, nombre: string, descripcion: string, precio: number, categoria_id: number) {
    const categorias = await getCategorias();
    const catObj = categorias.find((c: any) => c.id === categoria_id);
    const catNombre = catObj ? catObj.nombre : 'General';
    const newPlatoId = Math.floor(Math.random() * 1000) + 100;

    const newMockItem = {
        id: newPlatoId,
        nombre,
        descripcion,
        precio,
        categoria: catNombre,
        imagen_url: '',
        disponible: 1,
        destacado: 0,
        sucursal_id: sucursalId
    };
    mockData.menu.push(newMockItem);

    try {
        // Insertar en la tabla platos
        const queryPlato = `
            INSERT INTO platos (nombre, descripcion, precio, categoria_id)
            VALUES (?, ?, ?, ?);
        `;
        const [resultPlato] = await pool.query<ResultSetHeader>(queryPlato, [nombre, descripcion, precio, categoria_id]);
        
        const realId = resultPlato.insertId;
        newMockItem.id = realId;

        // Vincular a la sucursal
        const queryVinculo = `
            INSERT INTO menu_sucursal (sucursal_id, plato_id, disponible)
            VALUES (?, ?, 1);
        `;
        await pool.query<ResultSetHeader>(queryVinculo, [sucursalId, realId]);
        
        return { success: true, id: realId };
    } catch (error) {
        console.error("Error DB (crearPlato): Usando MOCK DATA", error);
        return { success: true, id: newPlatoId };
    }
}

export async function eliminarPlato(platoId: number, sucursalId?: number) {
    const idx = mockData.menu.findIndex(p => p.id === platoId && (!sucursalId || p.sucursal_id === sucursalId));
    if (idx !== -1) {
        mockData.menu.splice(idx, 1);
    }

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
        console.warn("Error DB (eliminarPlato): Usando MOCK DATA", error);
        return true;
    }
}

export async function getCategorias() {
    try {
        const [rows] = await pool.query<RowDataPacket[]>('SELECT id, nombre FROM categorias ORDER BY nombre ASC');
        if (rows && rows.length > 0) return rows;
        return [
            { id: 1, nombre: 'Cortes' },
            { id: 2, nombre: 'Parrilladas' },
            { id: 3, nombre: 'Entradas' },
            { id: 4, nombre: 'Guarniciones' },
            { id: 5, nombre: 'Cortes Premium' },
            { id: 6, nombre: 'Comida Rápida' },
            { id: 7, nombre: 'Sándwiches' },
            { id: 8, nombre: 'Ensaladas' },
            { id: 9, nombre: 'Bebidas' },
            { id: 10, nombre: 'Experiencia' },
            { id: 11, nombre: 'Espadas' },
            { id: 12, nombre: 'Buffet' },
            { id: 13, nombre: 'Postres' }
        ];
    } catch (e) {
        return [
            { id: 1, nombre: 'Cortes' },
            { id: 2, nombre: 'Parrilladas' },
            { id: 3, nombre: 'Entradas' },
            { id: 4, nombre: 'Guarniciones' },
            { id: 5, nombre: 'Cortes Premium' },
            { id: 6, nombre: 'Comida Rápida' },
            { id: 7, nombre: 'Sándwiches' },
            { id: 8, nombre: 'Ensaladas' },
            { id: 9, nombre: 'Bebidas' },
            { id: 10, nombre: 'Experiencia' },
            { id: 11, nombre: 'Espadas' },
            { id: 12, nombre: 'Buffet' },
            { id: 13, nombre: 'Postres' }
        ];
    }
}

