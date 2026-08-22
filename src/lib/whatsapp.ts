// ============================================
// SERVICIO DE WHATSAPP - BRASARGENT
// ============================================

export interface enviarWhatsAppResult {
    success: boolean;
    error?: string;
    url?: string;
    url_whatsapp?: string;
    mensaje?: string;
}

// ============================================
// GENERAR URL DE WHATSAPP CON MENSAJE
// ============================================

export function generarURLWhatsApp(
    telefono: string,
    mensaje: string
): string {
    // Limpiar número (solo dígitos)
    const telefonoLimpio = String(telefono || '').replace(/\D/g, '');
    
    // Si el número no tiene código de país, asumir Bolivia (+591)
    let numeroFinal = telefonoLimpio;
    if (!numeroFinal.startsWith('591') && numeroFinal.length <= 8) {
        numeroFinal = `591${numeroFinal}`;
    }

    // Construir URL de WhatsApp
    return `https://api.whatsapp.com/send/?phone=${numeroFinal}&text=${encodeURIComponent(mensaje)}&type=phone_number&app_absent=0`;
}

// ============================================
// ABRIR WHATSAPP EN NUEVA VENTANA
// ============================================

export function abrirWhatsApp(url: string): void {
    if (typeof window !== 'undefined') {
        window.open(url, '_blank');
    }
}

export async function enviarWhatsApp(
    telefono: string,
    mensaje: string
): Promise<enviarWhatsAppResult> {
    try {
        if (!telefono || String(telefono).length < 7) {
            return { 
                success: false, 
                error: 'Número de teléfono inválido' 
            };
        }

        const url = generarURLWhatsApp(telefono, mensaje);
        const telefonoLimpio = String(telefono).replace(/\D/g, '');
        const numeroFinal = telefonoLimpio.startsWith('591') || telefonoLimpio.length > 8 ? telefonoLimpio : `591${telefonoLimpio}`;

        console.log('----------------------------------------------------');
        console.log(`📱 [WHATSAPP OUTGOING] Destinatario: +${numeroFinal}`);
        console.log('📝 Contenido del mensaje:');
        console.log(mensaje);
        console.log(`🔗 Link directo WhatsApp: ${url}`);
        console.log('----------------------------------------------------');
        
        abrirWhatsApp(url);

        return { 
            success: true, 
            url: url,
            url_whatsapp: url,
            mensaje: 'WhatsApp generado correctamente'
        };

    } catch (error: any) {
        console.error('Error al procesar envío de WhatsApp:', error);
        return { 
            success: false, 
            error: error.message || 'Error desconocido' 
        };
    }
}

// ============================================
// GENERAR MENSAJE DE CONFIRMACIÓN DE RESERVA
// ============================================

export function generarMensajeConfirmacion(reserva: any, cubiertos?: number): string {
    const rawFecha = reserva.fecha instanceof Date ? reserva.fecha.toISOString().split('T')[0] : String(reserva.fecha).split('T')[0];
    
    const fechaFormateada = new Date(rawFecha + 'T12:00:00').toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const horaLimpia = typeof reserva.hora === 'string' ? reserva.hora.substring(0, 5) : reserva.hora;
    const totalPersonas = (parseInt(reserva.numero_personas) || 0) + (parseInt(reserva.cantidad_ninos) || 0);

    let personasTexto = `${reserva.numero_personas || 0} Adultos`;
    if (reserva.cantidad_ninos > 0) {
        personasTexto += `\n${reserva.cantidad_ninos} Niños (2-12 años)`;
    }
    personasTexto += `\nTotal: ${totalPersonas} personas`;

    const numeroReserva = reserva.numero_reserva || `BR-${new Date().getFullYear()}-${String(reserva.id || '0001').padStart(4, '0')}`;

    return `BRASARGENT - Tu Reserva fue Exitosa!

Hola ${reserva.nombre_cliente}!

Tu reserva en ${reserva.sucursal_nombre || 'Brasargent'} ha sido confirmada.

Numero de Reserva: ${numeroReserva}

Fecha: ${fechaFormateada}
Hora: ${horaLimpia}
Ubicacion: ${reserva.direccion || 'Sucursal Brasargent'}

Detalle de Personas:
${personasTexto}

Te recordamos que tienes que estar 10 minutos antes de la hora de tu reserva.

¡Te esperamos!

Si no vas a poder asistir, por favor notifica al restaurante.

BRASARGENT - El mejor churrasco de Santa Cruz, Bolivia`;
}

// ============================================
// ENVIAR WHATSAPP CON API REAL (PRODUCCIÓN)
// ============================================

export async function enviarWhatsAppApi(
    telefono: string,
    mensaje: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const WHAPI_TOKEN = process.env.WHATSAPP_TOKEN || '';
        const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || '';
        
        if (!WHAPI_TOKEN || !PHONE_NUMBER_ID) {
            return { 
                success: false, 
                error: 'WhatsApp API no configurada' 
            };
        }

        const telefonoLimpio = telefono.replace(/\D/g, '');
        const numeroFinal = telefonoLimpio.startsWith('591') ? telefonoLimpio : `591${telefonoLimpio}`;

        const response = await fetch(
            `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${WHAPI_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    to: numeroFinal,
                    type: 'text',
                    text: { body: mensaje }
                })
            }
        );

        if (!response.ok) {
            const error = await response.text();
            return { success: false, error: `Error API: ${error}` };
        }

        return { success: true };

    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
