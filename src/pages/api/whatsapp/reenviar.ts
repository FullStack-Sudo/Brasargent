import type { APIRoute } from 'astro';
import pool from '../../../lib/db';
import { openwa } from '../../../lib/whatsapp/openwa';

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        // Verificar sesión admin
        const session = cookies.get('session');
        if (!session || session.value !== 'authenticated') {
            return new Response(JSON.stringify({
                success: false,
                error: 'No autorizado'
            }), { 
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const { mensajes, accion, nuevoTexto } = await request.json();
        
        // Validar que hay mensajes
        if (!mensajes || !Array.isArray(mensajes) || mensajes.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Selecciona al menos un mensaje'
            }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Verificar conexión OpenWA
        const isConnected = await openwa.checkConnection();
        if (!isConnected) {
            return new Response(JSON.stringify({
                success: false,
                error: 'OpenWA no está conectado. Vincula WhatsApp primero.'
            }), { 
                status: 409,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Procesar cada mensaje
        const resultados = [];
        
        for (const msgItem of mensajes) {
            try {
                const id = typeof msgItem === 'object' ? msgItem.id : msgItem;
                
                // Obtener datos del mensaje de la base de datos
                const [rows] = await pool.query(
                    'SELECT destinatario, mensaje FROM logs_whatsapp WHERE id = ?',
                    [id]
                ) as any[];
                
                const log = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
                if (!log) {
                    resultados.push({ id, success: false, error: 'Mensaje no encontrado' });
                    continue;
                }

                // Usar texto modificado si se proporcionó o si la acción es editar
                const texto = (accion === 'editar' && nuevoTexto) ? nuevoTexto : log.mensaje;

                // Enviar mensaje por OpenWA
                const result = await openwa.sendMessage({
                    to: log.destinatario,
                    text: texto
                });

                // Actualizar estado en logs
                if (result.success) {
                    await pool.query(
                        `UPDATE logs_whatsapp 
                         SET estado = 'reenviado', 
                             mensaje = ?,
                             fecha_reenvio = NOW() 
                         WHERE id = ?`,
                        [texto, id]
                    );
                }

                resultados.push({
                    id: id,
                    success: result.success,
                    error: result.error || null
                });

            } catch (error: any) {
                const id = typeof msgItem === 'object' ? msgItem.id : msgItem;
                resultados.push({
                    id: id,
                    success: false,
                    error: error.message || 'Error al procesar'
                });
            }
        }

        // Contar resultados
        const exitos = resultados.filter(r => r.success).length;
        const fallos = resultados.filter(r => !r.success).length;

        return new Response(JSON.stringify({
            success: true,
            mensaje: `${exitos} mensajes reenviados correctamente${fallos > 0 ? `, ${fallos} fallos` : ''}`,
            resultados: resultados
        }), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('❌ Error al reenviar mensajes:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al reenviar mensajes'
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
