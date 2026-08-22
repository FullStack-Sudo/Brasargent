// ============================================
// PLANTILLA DE MENSAJE PARA WHATSAPP (SIN EMOJIS, SIN BEBÉS, SIN MENÚ INFANTIL)
// ============================================

export interface ReservaData {
    id: number;
    numero_reserva: string;
    nombre_cliente: string;
    telefono: string;
    sucursal: string;
    direccion: string;
    fecha: string | Date;
    hora: string;
    adultos: number;
    ninos: number;
    total_personas: number;
    necesita_silla: boolean;
    observaciones: string | null;
}

// Helper para convertir cualquier tipo de fecha a formato string YYYY-MM-DD
function parseFechaStr(fecha: string | Date): string {
    if (!fecha) return new Date().toISOString().split('T')[0];
    if (fecha instanceof Date) {
        return fecha.toISOString().split('T')[0];
    }
    const str = String(fecha);
    if (str.includes('T')) {
        return str.split('T')[0];
    }
    return str;
}

// 🔴 PLANTILLA PRINCIPAL (SIN EMOJIS, SIN BEBÉS, SIN MENÚ INFANTIL)
export function generarMensajeConfirmacion(data: ReservaData): string {
    const rawFecha = parseFechaStr(data.fecha);
    const fechaFormateada = new Date(rawFecha + 'T12:00:00').toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const horaLimpia = typeof data.hora === 'string' ? data.hora.substring(0, 5) : data.hora;

    // 🔴 Desglose de personas (solo Adultos y Niños)
    const desglosePersonas = [];
    if (data.adultos > 0) desglosePersonas.push(`${data.adultos} Adultos`);
    if (data.ninos > 0) desglosePersonas.push(`${data.ninos} Niños (2-12 años)`);
    
    const totalPersonas = (data.adultos || 0) + (data.ninos || 0);
    const personasTexto = desglosePersonas.join(', ');

    const lineasAdicionales = [];
    if (data.necesita_silla) lineasAdicionales.push('Silla para nino: Preparada');

    const textoAdicional = lineasAdicionales.length > 0 ? `\n${lineasAdicionales.join('\n')}\n` : '';

    return `BRASARGENT - Tu Reserva fue Exitosa!

Hola ${data.nombre_cliente}!

Tu reserva en ${data.sucursal} ha sido confirmada.

Numero de Reserva: ${data.numero_reserva}

Fecha: ${fechaFormateada}
Hora: ${horaLimpia}
Ubicacion: ${data.direccion}

Detalle de Personas:
${personasTexto || 'Sin personas registradas'}
Total: ${totalPersonas} ${totalPersonas === 1 ? 'persona' : 'personas'}${textoAdicional}
Te recordamos que tienes que estar 10 minutos antes de la hora de tu reserva.

¡Te esperamos!

Si no vas a poder asistir, por favor notifica al restaurante.

BRASARGENT - El mejor churrasco de Santa Cruz, Bolivia`;
}

// 🔴 PLANTILLA CORTA (Alternativa sin emojis)
export function generarMensajeConfirmacionCorto(data: ReservaData): string {
    const rawFecha = parseFechaStr(data.fecha);
    const totalPersonas = (data.adultos || 0) + (data.ninos || 0);
    const horaLimpia = typeof data.hora === 'string' ? data.hora.substring(0, 5) : data.hora;

    const fechaFormateada = new Date(rawFecha + 'T12:00:00').toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });

    return `BRASARGENT - Tu Reserva fue Exitosa!

Hola ${data.nombre_cliente}!

Tu reserva en ${data.sucursal} ha sido confirmada.

Numero de Reserva: ${data.numero_reserva}

Fecha: ${fechaFormateada}
Hora: ${horaLimpia}

Personas:
${data.adultos > 0 ? `  ${data.adultos} Adultos` : ''}
${data.ninos > 0 ? `  ${data.ninos} Niños (2-12 años)` : ''}
Total: ${totalPersonas}

Te recordamos que tienes que estar 10 minutos antes.

¡Te esperamos!

Si no vas a poder asistir, por favor notifica al restaurante.

El mejor churrasco de Santa Cruz, Bolivia`;
}

// Compatibilidad retroactiva
export const PLANTILLAS = {
    confirmacion: {
        formal: (reserva: any) => generarMensajeConfirmacion({
            id: reserva.id,
            numero_reserva: reserva.numero_reserva || `BR-${new Date().getFullYear()}-0001`,
            nombre_cliente: reserva.nombre_cliente,
            telefono: reserva.sucursal_telefono || '',
            sucursal: reserva.sucursal_nombre || reserva.sucursal || '',
            direccion: reserva.sucursal_direccion || reserva.direccion || '',
            fecha: reserva.fecha,
            hora: reserva.hora,
            adultos: parseInt(reserva.numero_personas || reserva.adultos || 0),
            ninos: parseInt(reserva.cantidad_ninos || reserva.ninos || 0),
            total_personas: (parseInt(reserva.numero_personas || 0) + parseInt(reserva.cantidad_ninos || 0)),
            necesita_silla: reserva.necesita_silla_bebe === 1 || reserva.necesita_silla === true,
            observaciones: reserva.observaciones || null
        }),
        casual: (reserva: any) => generarMensajeConfirmacionCorto({
            id: reserva.id,
            numero_reserva: reserva.numero_reserva || `BR-${new Date().getFullYear()}-0001`,
            nombre_cliente: reserva.nombre_cliente,
            telefono: reserva.sucursal_telefono || '',
            sucursal: reserva.sucursal_nombre || reserva.sucursal || '',
            direccion: reserva.sucursal_direccion || reserva.direccion || '',
            fecha: reserva.fecha,
            hora: reserva.hora,
            adultos: parseInt(reserva.numero_personas || reserva.adultos || 0),
            ninos: parseInt(reserva.cantidad_ninos || reserva.ninos || 0),
            total_personas: (parseInt(reserva.numero_personas || 0) + parseInt(reserva.cantidad_ninos || 0)),
            necesita_silla: reserva.necesita_silla_bebe === 1 || reserva.necesita_silla === true,
            observaciones: reserva.observaciones || null
        }),
        breve: (reserva: any) => generarMensajeConfirmacionCorto({
            id: reserva.id,
            numero_reserva: reserva.numero_reserva || `BR-${new Date().getFullYear()}-0001`,
            nombre_cliente: reserva.nombre_cliente,
            telefono: reserva.sucursal_telefono || '',
            sucursal: reserva.sucursal_nombre || reserva.sucursal || '',
            direccion: reserva.sucursal_direccion || reserva.direccion || '',
            fecha: reserva.fecha,
            hora: reserva.hora,
            adultos: parseInt(reserva.numero_personas || reserva.adultos || 0),
            ninos: parseInt(reserva.cantidad_ninos || reserva.ninos || 0),
            total_personas: (parseInt(reserva.numero_personas || 0) + parseInt(reserva.cantidad_ninos || 0)),
            necesita_silla: reserva.necesita_silla_bebe === 1 || reserva.necesita_silla === true,
            observaciones: reserva.observaciones || null
        })
    },
    rechazo: (reserva: any) => `BRASARGENT - Reserva No Confirmada

Hola ${reserva.nombre_cliente},

Numero de Solicitud: ${reserva.numero_reserva || ''}
Lamentamos informarte que tu reserva en ${reserva.sucursal_nombre || reserva.sucursal} no pudo ser confirmada.

Fecha: ${parseFechaStr(reserva.fecha)}
Hora: ${typeof reserva.hora === 'string' ? reserva.hora.substring(0, 5) : reserva.hora}

Motivo: No hay disponibilidad en el horario solicitado.
Te invitamos a elegir otra fecha u hora.

Esperamos verte pronto en BRASARGENT.`
};
