import type { APIRoute } from 'astro';
import { crearPlato, actualizarImagenPlato } from '../../../../lib/queries/menu';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const createPlatoSchema = z.object({
    sucursal_id: z.coerce.number().int().positive(),
    nombre: z.string().min(1, "El nombre es requerido").max(100),
    descripcion: z.string().max(500).optional().default(""),
    precio: z.coerce.number().positive("El precio debe ser mayor a 0"),
    categoria_id: z.coerce.number().int().positive(),
    destacado: z.coerce.number().int().optional().default(0),
    sucursales: z.array(z.coerce.number()).optional().default([])
});

export const POST: APIRoute = async ({ request }) => {
    try {
        const contentType = request.headers.get('content-type') || '';
        let payload: any = {};
        let imageFile: File | null = null;

        if (contentType.includes('multipart/form-data')) {
            const formData = await request.formData();
            payload = {
                sucursal_id: formData.get('sucursal_id'),
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
        
        // Validar datos
        const parsed = createPlatoSchema.safeParse(payload);
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
        
        if (!result.success) {
            throw new Error("No se pudo crear el plato");
        }

        // Si se envió un archivo de imagen, guardarlo y actualizar la URL
        if (result.id && imageFile) {
            try {
                // Validación de tamaño (< 2MB)
                if (imageFile.size > 2 * 1024 * 1024) {
                    console.warn("Imagen excede 2MB, se omite la subida");
                } else {
                    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
                    if (validTypes.includes(imageFile.type)) {
                        const arrayBuffer = await imageFile.arrayBuffer();
                        const buffer = Buffer.from(arrayBuffer);
                        const ext = imageFile.type.split('/')[1] || 'jpg';
                        const fileName = `plato_${result.id}_${Date.now()}.${ext}`;
                        const __filename = fileURLToPath(import.meta.url);
                        const __dirname = path.dirname(__filename);
                        const projectRoot = path.resolve(__dirname, '../../../../../');
                        const uploadDir = path.join(projectRoot, 'public', 'uploads', 'platos');
                        await fs.mkdir(uploadDir, { recursive: true });
                        const filePath = path.join(uploadDir, fileName);
                        await fs.writeFile(filePath, buffer);
                        const imageUrl = `/uploads/platos/${fileName}`;
                        await actualizarImagenPlato(result.id, imageUrl);
                    }
                }
            } catch (imgErr) {
                console.error("Error al guardar imagen del plato:", imgErr);
                // No fallar la creación por un error de imagen
            }
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
