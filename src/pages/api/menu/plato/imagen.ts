import type { APIRoute } from 'astro';
import { actualizarImagenPlato } from '../../../../lib/queries/menu';
import fs from 'fs/promises';
import path from 'path';

export const POST: APIRoute = async ({ request }) => {
    try {
        const formData = await request.formData();
        const plato_id = formData.get('plato_id');
        const imagen = formData.get('imagen') as File | null;
        
        if (!plato_id || !imagen) {
            return new Response(JSON.stringify({ success: false, message: 'Datos incompletos' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Validación de tamaño (< 2MB)
        if (imagen.size > 2 * 1024 * 1024) {
            return new Response(JSON.stringify({ success: false, message: 'La imagen excede los 2MB permitidos' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Validación de tipo
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(imagen.type)) {
            return new Response(JSON.stringify({ success: false, message: 'Formato inválido. Usa JPG, PNG o WEBP' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Procesar archivo
        const arrayBuffer = await imagen.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Determinar extensión y crear nombre único
        const ext = imagen.type.split('/')[1];
        const fileName = `plato_${plato_id}_${Date.now()}.${ext}`;

        // ✅ Ruta absoluta correcta en Docker
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'platos');        


        try {
            await fs.mkdir(uploadDir, { recursive: true });
        } catch (e) {
            console.error('Error creando directorio', e);
        }
        
        const filePath = path.join(uploadDir, fileName);
        await fs.writeFile(filePath, buffer);
        
        const imageUrl = `/uploads/platos/${fileName}`;
        const idNum = Number(plato_id);
        
        // Actualizar BD
        await actualizarImagenPlato(idNum, imageUrl);
        
        return new Response(JSON.stringify({
            success: true,
            message: 'Imagen subida exitosamente',
            imagen_url: imageUrl
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        
    } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({
            success: false,
            message: 'Error interno del servidor al procesar la imagen'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
