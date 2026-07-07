import type { APIRoute } from 'astro';
import { actualizarPlato } from '../../../../lib/queries/menu';
import { z } from 'zod';

const updateSchema = z.object({
    plato_id: z.number(),
    nombre: z.string().min(1).max(100),
    descripcion: z.string().max(255),
    precio: z.number().min(0),
    categoria_id: z.number()
});

export const PUT: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        
        // Validación con Zod
        const result = updateSchema.safeParse(body);
        if (!result.success) {
            return new Response(JSON.stringify({ 
                success: false, 
                message: 'Datos inválidos',
                errors: result.error.errors
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const { plato_id, nombre, descripcion, precio, categoria_id } = result.data;
        const success = await actualizarPlato(plato_id, nombre, descripcion, precio, categoria_id);
        
        return new Response(JSON.stringify({
            success,
            message: success ? 'Plato actualizado exitosamente' : 'Error al actualizar el plato'
        }), {
            status: success ? 200 : 500,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            message: 'Error interno del servidor'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
