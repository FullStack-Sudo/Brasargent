// ============================================
// SCRIPT DE PRUEBA DE WHATSAPP - BRASARGENT
// ============================================

import { enviarWhatsApp, generarMensajeConfirmacion } from '../lib/whatsapp';

async function testWhatsApp() {
    console.log('🚀 Iniciando prueba de envío de WhatsApp...');

    const reservaPrueba = {
        id: 999,
        numero_reserva: 'BR-2026-TEST',
        nombre_cliente: 'Carlos Gómez Pérez',
        telefono: '70000111',
        codigo_pais: '591',
        telefono_completo: '59170000111',
        fecha: '2026-08-01',
        hora: '19:30:00',
        numero_personas: 4,
        cantidad_ninos: 2,
        sucursal_nombre: 'Churrasquería (Equipetrol)',
        direccion: 'Av. San Martín #123, Santa Cruz',
        necesita_silla_bebe: 1
    };

    const mensaje = generarMensajeConfirmacion(reservaPrueba, 6);
    const result = await enviarWhatsApp(reservaPrueba.telefono_completo, mensaje);
    
    if (result.success) {
        console.log('✅ Mensaje generado y probado exitosamente');
        console.log('🔗 URL de WhatsApp Web:', result.url_whatsapp);
    } else {
        console.error('❌ Error en prueba:', result.error);
    }
}

testWhatsApp();
