// src/lib/notificaciones.ts
// Sistema de notificaciones multi-canal

import { query } from './db';
import { openwaMulti } from './whatsapp/openwa-multi';

interface NuevaReservaData {
    id: number;
    numero_reserva: string;
    nombre_cliente: string;
    telefono: string;
    fecha: string;
    hora: string;
    numero_personas: number;
    cantidad_ninos: number;
    cubiertos: number;
    sucursal_id: number;
    sucursal_nombre: string;
    observaciones: string;
}

// ============================================
// NOTIFICAR NUEVA RESERVA AL ADMIN
// ============================================
export async function notificarNuevaReserva(data: NuevaReservaData): Promise<void> {
    // Canal 1: WhatsApp al numero corporativo de la sucursal
    await notificarWhatsAppSucursal(data);
    
    // Canal 2: Registrar para SSE (Server-Sent Events)
    await registrarEventoSSE(data);
}

// ============================================
// CANAL 1: WHATSAPP AL NUMERO CORPORATIVO
// ============================================
async function notificarWhatsAppSucursal(data: NuevaReservaData): Promise<void> {
    try {
        // Obtener la sesion OpenWA de la sucursal
        const [sesion] = await query(
            'SELECT session_name, telefono FROM openwa_sesiones WHERE sucursal_id = ?',
            [data.sucursal_id]
        ) as any[];
        
        if (!sesion || !sesion.telefono) {
            console.log('No hay sesion OpenWA configurada para esta sucursal o falta telefono');
            return;
        }
        
        // Construir mensaje
        const fechaFormateada = new Date(data.fecha + 'T12:00:00').toLocaleDateString('es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        
        const totalPersonas = data.numero_personas + data.cantidad_ninos;
        
        let detallePersonas = data.numero_personas + ' adultos';
        if (data.cantidad_ninos > 0) {
            detallePersonas += ' + ' + data.cantidad_ninos + ' niños';
        }
        
        const mensaje = 'NUEVA RESERVA PENDIENTE\n\n' +
            'Número: ' + data.numero_reserva + '\n' +
            'Cliente: ' + data.nombre_cliente + '\n' +
            'Teléfono: ' + data.telefono + '\n\n' +
            'Fecha: ' + fechaFormateada + '\n' +
            'Hora: ' + data.hora + '\n' +
            'Personas: ' + detallePersonas + ' (' + totalPersonas + ' en total)\n' +
            'Cubiertos requeridos: ' + data.cubiertos + '\n\n' +
            'Sucursal: ' + data.sucursal_nombre + '\n' +
            (data.observaciones ? 'Nota del cliente: ' + data.observaciones + '\n\n' : '\n') +
            'ACCIÓN REQUERIDA:\n' +
            'Ingresa al dashboard para ACEPTAR o RECHAZAR esta reserva.\n\n' +
            'BRASARGENT - Sistema de Reservas';
        
        // Enviar al mismo numero vinculado (chat "Tu")
        // El parametro 'to' debe ser el mismo telefono de la sesion
        await openwaMulti.sendMessage(
            data.sucursal_id,
            sesion.telefono,
            mensaje
        );
        
        // Registrar en logs
        await query(
            'INSERT INTO logs_whatsapp (destinatario, mensaje, estado, sesion, fecha_envio) VALUES (?, ?, ?, ?, NOW())',
            [
                sesion.telefono,
                mensaje,
                'enviado',
                sesion.session_name
            ]
        );
        
        console.log('WhatsApp enviado al numero corporativo de ' + data.sucursal_nombre);
        
    } catch (error) {
        console.error('Error enviando WhatsApp a la sucursal:', error);
    }
}

// ============================================
// CANAL 2: REGISTRAR EVENTO PARA SSE
// ============================================
async function registrarEventoSSE(data: NuevaReservaData): Promise<void> {
    try {
        // Insertar en tabla de eventos (para SSE polling)
        await query(
            'INSERT INTO eventos_tiempo_real (tipo, sucursal_id, datos, created_at) VALUES (?, ?, ?, NOW())',
            [
                'nueva_reserva',
                data.sucursal_id,
                JSON.stringify({
                    reserva_id: data.id,
                    numero_reserva: data.numero_reserva,
                    cliente: data.nombre_cliente,
                    personas: data.numero_personas + data.cantidad_ninos,
                    hora: data.hora,
                    fecha: data.fecha,
                    mensaje: 'Nueva reserva pendiente: ' + data.nombre_cliente
                })
            ]
        );
        
        console.log('Evento SSE registrado para sucursal ' + data.sucursal_id);
        
    } catch (error) {
        console.error('Error registrando evento SSE:', error);
    }
}
