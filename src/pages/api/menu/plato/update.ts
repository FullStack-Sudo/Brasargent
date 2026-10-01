import type { APIRoute } from 'astro';
import { actualizarPlato, actualizarImagenPlato } from '../../../../lib/queries/menu';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

const updateSchema = z.object({
    plato_id: z.coerce.number().int().positive(),
    nombre: z.string().min(1, "El nombre es requerido").max(100),
    descripcion: z.string().max(500).optional().default(""),
    precio: z.coerce.number().min(0),
    categoria_id: z.coerce.number().int().optional().default(1),
    destacado: z.coerce.number().int().optional().default(0)
});

export const POST: APIRoute = async ({ request }) => {
    try {
        const contentType = request.headers.get('content-type') || '';
        let payload: any = {};
        let imageFile: File | null = null;

        if (contentType.includes('multipart/form-data')) {
            const formData = await request.formData();
            payload = {
                plato_id: formData.get('plato_id'),
                nombre: formData.get('nombre'),
                descripcion: formData.get('descripcion'),
                precio: formData.get('precio'),
                categoria_id: formData.get('categoria_id'),
                destacado: formData.get('destacado') === '1' || formData.get('destacado') === 'true' ? 1 : 0
            };
            const file = formData.get('imagen');
            if (file && file instanceof File && file.size > 0) {
                imageFile = file;
            }
        } else {
            payload = await request.json();
        }
        
        // Validación con Zod
        const result = updateSchema.safeParse(payload);
        if (!result.success) {
            return new Response(JSON.stringify({ 
                success: false, 
                message: 'Datos inválidos',
                errors: result.error.issues
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const { plato_id, nombre, descripcion, precio, categoria_id, destacado } = result.data;
        const success = await actualizarPlato(plato_id, nombre, descripcion, precio, categoria_id, destacado);

        // Si se envió un archivo de imagen, guardarlo y actualizar la URL
        if (success && imageFile) {
            try {
                const arrayBuffer = await imageFile.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const ext = imageFile.type.split('/')[1] || 'jpg';
                const fileName = `plato_${plato_id}_${Date.now()}.${ext}`;
		const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'platos');
                await fs.mkdir(uploadDir, { recursive: true });
                const filePath = path.join(uploadDir, fileName);
                await fs.writeFile(filePath, buffer);
                const imageUrl = `/uploads/platos/${fileName}`;
                await actualizarImagenPlato(plato_id, imageUrl);
            } catch (imgErr) {
                console.error("Error al guardar imagen del plato:", imgErr);
            }
        }
        
        return new Response(JSON.stringify({
            success,
            message: success ? 'Plato actualizado exitosamente' : 'Error al actualizar el plato'
        }), {
            status: success ? 200 : 500,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error: any) {
        console.error("Error en API update plato:", error);
        return new Response(JSON.stringify({
            success: false,
            message: error.message || 'Error interno del servidor'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export const PUT = POST;
