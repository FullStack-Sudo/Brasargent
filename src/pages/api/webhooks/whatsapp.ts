import type { APIRoute } from 'astro';
import { query } from '../../../lib/db';

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        console.log('📩 Webhook recibido de WhatsApp OpenWA:', body);

        const messageId = body.messageId || body.id;
        const status = body.status || body.ack || 'entregado';

        // Actualizar estado del mensaje si existe messageId
        if (messageId) {
            await query(
                `UPDATE logs_whatsapp 
                 SET estado = ?, fecha_actualizacion = NOW() 
                 WHERE message_id = ?`,
                [status, messageId]
            );
            
            console.log(`✅ Estado actualizado: ${messageId} → ${status}`);
        }

        return new Response(JSON.stringify({ success: true }), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('❌ Error en webhook WhatsApp:', error);
        return new Response(JSON.stringify({ success: false, error: error.message }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
