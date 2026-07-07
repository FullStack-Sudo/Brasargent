import type { APIRoute } from 'astro';
import { crearPlato } from '../../../../lib/queries/menu';
import { z } from 'zod';

const createPlatoSchema = z.object({
    sucursal_id: z.number().int().positive(),
    nombre: z.string().min(1, "El nombre es requerido").max(100),
    descripcion: z.string().max(500).optional().default(""),
    precio: z.number().positive("El precio debe ser mayor a 0"),
    categoria_id: z.number().int().positive(),
    destacado: z.number().int().optional().default(0),
    sucursales: z.array(z.number()).optional().default([])
});

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        
        // Validar datos
        const parsed = createPlatoSchema.safeParse(body);
        if (!parsed.success) {
            return new Response(JSON.stringify({ 
                success: false, 
                message: "Datos inválidos", 
                errors: parsed.error.format() 
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const data = parsed.data;
        
        const result = await crearPlato(
            data.sucursal_id,
            data.nombre,
            data.descripcion,
            data.precio,
            data.categoria_id
        );
        
        // Si el usuario seleccionó múltiples sucursales (ej: 1, 2, 3), 
        // aquí se podría hacer un bucle para vincular el plato a cada sucursal extra.
        // Lo mismo para el flag destacado (guardarlo en la DB si existe la columna).

        if (!result.success) {
            throw new Error("No se pudo crear el plato");
        }

        return new Response(JSON.stringify({ 
            success: true, 
            message: "Plato creado exitosamente",
            id: result.id
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error("API Error (create plato):", error);
        return new Response(JSON.stringify({ 
            success: false, 
            message: error.message || "Error interno del servidor" 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
