// ============================================
// SERVICIO DE REPORTES - EXCEL Y PDF
// ============================================

import * as XLSX from 'xlsx';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import pool, { query } from './db';

export interface ReservaReporte {
    id: number;
    numero_reserva: string;
    nombre_cliente: string;
    telefono: string;
    sucursal: string;
    fecha: string;
    hora: string;
    adultos: number;
    ninos: number;
    total_personas: number;
    estado: string;
    mensaje_admin: string | null;
    fecha_confirmacion: string | null;
    fecha_rechazo: string | null;
    motivo_rechazo: string | null;
    created_at: string;
}

// ============================================
// OBTENER DATOS PARA REPORTE
// ============================================

export async function getDatosReporte(
    fechaInicio?: string,
    fechaFin?: string,
    sucursalId?: number
): Promise<ReservaReporte[]> {
    let sql = `
        SELECT 
            r.id,
            r.numero_reserva,
            r.nombre_cliente,
            r.telefono,
            s.nombre AS sucursal,
            r.fecha,
            r.hora,
            r.numero_personas AS adultos,
            r.cantidad_ninos AS ninos,
            (r.numero_personas + COALESCE(r.cantidad_ninos, 0)) AS total_personas,
            r.estado,
            r.mensaje_admin,
            r.fecha_confirmacion,
            r.fecha_rechazo,
            r.mensaje_admin AS motivo_rechazo,
            r.created_at
        FROM reservas r
        JOIN sucursales s ON r.sucursal_id = s.id
        WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (fechaInicio) {
        sql += ` AND r.fecha >= ?`;
        params.push(fechaInicio);
    }
    
    if (fechaFin) {
        sql += ` AND r.fecha <= ?`;
        params.push(fechaFin);
    }
    
    if (sucursalId) {
        sql += ` AND r.sucursal_id = ?`;
        params.push(sucursalId);
    }
    
    sql += ` ORDER BY r.fecha DESC, r.hora DESC`;
    
    try {
        const [rows] = await pool.query(sql, params) as any[];
        return Array.isArray(rows) ? rows : [];
    } catch (e) {
        console.error('Error fetching report data:', e);
        return [];
    }
}

// ============================================
// GENERAR EXCEL
// ============================================

export function generarExcel(reservas: ReservaReporte[]): Uint8Array {
    // Preparar datos para Excel
    const datos = reservas.map((r) => ({
        'Nº Reserva': r.numero_reserva || `RES-${r.id}`,
        'Cliente': r.nombre_cliente || 'N/A',
        'Teléfono': r.telefono || 'N/A',
        'Sucursal': r.sucursal || 'General',
        'Fecha': r.fecha ? new Date(r.fecha).toLocaleDateString('es-ES') : 'N/A',
        'Hora': r.hora || '',
        'Adultos': r.adultos || 0,
        'Niños': r.ninos || 0,
        'Total Personas': r.total_personas || 0,
        'Estado': r.estado === 'confirmada' ? 'Confirmada' :
                  r.estado === 'pendiente' ? 'Pendiente' :
                  r.estado === 'rechazada' ? 'Rechazada' :
                  r.estado === 'cancelada' ? 'Cancelada' : r.estado,
        'Motivo': r.mensaje_admin || r.motivo_rechazo || '-',
        'Fecha Registro': r.created_at ? new Date(r.created_at).toLocaleString('es-ES') : 'N/A'
    }));

    // Crear libro de trabajo
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(datos);
    
    // Ajustar ancho de columnas
    const colWidths = [
        { wch: 14 }, // Nº Reserva
        { wch: 25 }, // Cliente
        { wch: 15 }, // Teléfono
        { wch: 25 }, // Sucursal
        { wch: 15 }, // Fecha
        { wch: 10 }, // Hora
        { wch: 10 }, // Adultos
        { wch: 10 }, // Niños
        { wch: 15 }, // Total Personas
        { wch: 15 }, // Estado
        { wch: 30 }, // Motivo
        { wch: 25 }, // Fecha Registro
    ];
    ws['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(wb, ws, 'Reservas');
    
    // Agregar hoja de resumen
    const resumen = [
        ['BRASARGENT - REPORTE DE RESERVAS'],
        [''],
        ['Fecha de generación:', new Date().toLocaleString('es-ES')],
        ['Total reservas:', reservas.length],
        ['Confirmadas:', reservas.filter(r => r.estado === 'confirmada').length],
        ['Pendientes:', reservas.filter(r => r.estado === 'pendiente').length],
        ['Rechazadas:', reservas.filter(r => r.estado === 'rechazada').length],
        ['Canceladas:', reservas.filter(r => r.estado === 'cancelada').length],
        [''],
        ['Resumen por sucursal:'],
    ];
    
    // Agrupar por sucursal
    const sucursales = [...new Set(reservas.map(r => r.sucursal))];
    sucursales.forEach(suc => {
        const count = reservas.filter(r => r.sucursal === suc).length;
        resumen.push([`${suc}:`, `${count} reservas`]);
    });
    
    const wsResumen = XLSX.utils.aoa_to_sheet(resumen);
    wsResumen['!cols'] = [{ wch: 30 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');
    
    // Generar buffer
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    return buffer;
}

// ============================================
// GENERAR PDF
// ============================================

function sanitizeWinAnsi(text: string): string {
    if (!text) return '';
    return text
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
        .replace(/…/g, '...')
        .replace(/[^\x00-\xFF]/g, '');
}

export async function generarPDF(reservas: ReservaReporte[]): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let page = pdfDoc.addPage([595, 842]); // A4
    let y = 800;
    let pageNumber = 1;
    const maxRowsPerPage = 38;
    let rowCount = 0;
    
    // Definir anchos de columnas (mejorados para evitar traslapes)
    const colWidths = {
        num: 80,       // Nº Reserva (ej: CHU-2026-0001)
        cliente: 95,   // Cliente
        telefono: 55,   // Teléfono
        sucursal: 70,   // Sucursal
        fecha: 60,      // Fecha
        hora: 40,       // Hora
        personas: 30,   // Pers.
        estado: 60      // Estado
    };
    
    // Calcular posición X para cada columna
    let xPos = 48;
    const colPositions: Record<string, number> = {};
    Object.keys(colWidths).forEach(key => {
        colPositions[key] = xPos;
        xPos += colWidths[key as keyof typeof colWidths];
    });
    
    function addNewPage() {
        page = pdfDoc.addPage([595, 842]);
        y = 800;
        pageNumber++;
        rowCount = 0;
        drawHeader();
        drawTableHeaders();
        y -= 15;
    }
    
    function drawHeader() {
        // Título principal
        page.drawText('BRASARGENT', {
            x: 48,
            y: y,
            size: 18,
            font: fontBold,
            color: rgb(0.13, 0.13, 0.13),
        });
        y -= 20;
        
        // Subtítulo
        page.drawText('Reporte Oficial de Reservas', {
            x: 48,
            y: y,
            size: 12,
            font: fontBold,
            color: rgb(0.4, 0.4, 0.4),
        });
        y -= 15;
        
        // Fecha de generación
        const fechaGen = new Date().toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        page.drawText(`Generado el: ${sanitizeWinAnsi(fechaGen)}`, {
            x: 48,
            y: y,
            size: 9,
            font: font,
            color: rgb(0.6, 0.6, 0.6),
        });
        y -= 12;
        
        // Total de reservas
        page.drawText(`Total de reservas: ${reservas.length}`, {
            x: 48,
            y: y,
            size: 9,
            font: fontBold,
            color: rgb(0.2, 0.2, 0.2),
        });
        y -= 10;
        
        // Línea separadora
        page.drawLine({
            start: { x: 48, y: y },
            end: { x: 547, y: y },
            thickness: 1,
            color: rgb(0.8, 0.8, 0.8),
        });
        y -= 15;
        
        // Resumen de estadísticas
        const confirmadas = reservas.filter(r => r.estado === 'confirmada').length;
        const pendientes = reservas.filter(r => r.estado === 'pendiente').length;
        const rechazadas = reservas.filter(r => r.estado === 'rechazada').length;
        const canceladas = reservas.filter(r => r.estado === 'cancelada').length;
        
        const stats = [
            `Confirmadas: ${confirmadas}`,
            `Pendientes: ${pendientes}`,
            `Rechazadas: ${rechazadas}`,
            `Canceladas: ${canceladas}`
        ];
        
        let statsX = 48;
        stats.forEach((stat, i) => {
            page.drawText(stat, {
                x: statsX,
                y: y,
                size: 8,
                font: fontBold,
                color: i === 0 ? rgb(0.06, 0.73, 0.51) :
                       i === 1 ? rgb(0.96, 0.62, 0.04) :
                       i === 2 ? rgb(0.94, 0.27, 0.27) :
                       rgb(0.42, 0.45, 0.50),
            });
            statsX += 110;
        });
        y -= 15;
        
        // Línea separadora
        page.drawLine({
            start: { x: 48, y: y },
            end: { x: 547, y: y },
            thickness: 1,
            color: rgb(0.8, 0.8, 0.8),
        });
        y -= 10;
    }
    
    function drawTableHeaders() {
        const headers = [
            { key: 'num', text: 'Nro. Reserva' },
            { key: 'cliente', text: 'Cliente' },
            { key: 'telefono', text: 'Telefono' },
            { key: 'sucursal', text: 'Sucursal' },
            { key: 'fecha', text: 'Fecha' },
            { key: 'hora', text: 'Hora' },
            { key: 'personas', text: 'Pers.' },
            { key: 'estado', text: 'Estado' }
        ];
        
        // Fondo gris para encabezados
        page.drawRectangle({
            x: 46,
            y: y - 4,
            width: 502,
            height: 16,
            color: rgb(0.95, 0.95, 0.95),
        });
        
        headers.forEach(h => {
            const x = colPositions[h.key];
            page.drawText(h.text, {
                x: x,
                y: y,
                size: 8,
                font: fontBold,
                color: rgb(0.2, 0.2, 0.2),
            });
        });
    }
    
    // Dibujar cabecera inicial
    drawHeader();
    drawTableHeaders();
    y -= 15;
    
    // DATOS
    for (const reserva of reservas) {
        // Verificar si necesitamos nueva página
        if (y < 60 || rowCount >= maxRowsPerPage) {
            addNewPage();
        }
        
        // Alternar color de fondo para filas
        const rowColor = rowCount % 2 === 0 ? rgb(1, 1, 1) : rgb(0.98, 0.98, 0.98);
        page.drawRectangle({
            x: 46,
            y: y - 4,
            width: 502,
            height: 14,
            color: rowColor,
        });
        
        const fechaStr = reserva.fecha ? new Date(reserva.fecha).toLocaleDateString('es-ES') : '-';
        const horaStr = reserva.hora ? String(reserva.hora).substring(0, 5) : '-';
        
        const rowData = [
            { key: 'num', text: reserva.numero_reserva || `RES-${reserva.id}` },
            { key: 'cliente', text: reserva.nombre_cliente || '' },
            { key: 'telefono', text: reserva.telefono || '' },
            { key: 'sucursal', text: reserva.sucursal || '' },
            { key: 'fecha', text: fechaStr },
            { key: 'hora', text: horaStr },
            { key: 'personas', text: String(reserva.total_personas || 0) },
            { 
                key: 'estado', 
                text: reserva.estado === 'confirmada' ? 'Confirmada' :
                       reserva.estado === 'pendiente' ? 'Pendiente' :
                       reserva.estado === 'rechazada' ? 'Rechazada' : 'Cancelada',
                color: reserva.estado === 'confirmada' ? rgb(0.06, 0.73, 0.51) :
                       reserva.estado === 'pendiente' ? rgb(0.96, 0.62, 0.04) :
                       reserva.estado === 'rechazada' ? rgb(0.94, 0.27, 0.27) :
                       rgb(0.42, 0.45, 0.50)
            }
        ];
        
        rowData.forEach((data) => {
            const x = colPositions[data.key as keyof typeof colPositions];
            const color = data.color || rgb(0.2, 0.2, 0.2);
            
            let text = sanitizeWinAnsi(data.text);
            if (data.key === 'cliente' && text.length > 18) {
                text = text.substring(0, 16) + '...';
            }
            if (data.key === 'sucursal' && text.length > 14) {
                text = text.substring(0, 12) + '...';
            }
            
            page.drawText(text, {
                x: x,
                y: y,
                size: 7,
                font: font,
                color: color,
            });
        });
        
        // Si hay motivo de rechazo, agregar como nota al final
        if (reserva.motivo_rechazo && reserva.estado === 'rechazada') {
            y -= 8;
            page.drawText(sanitizeWinAnsi(`Motivo: ${reserva.motivo_rechazo}`), {
                x: colPositions['cliente'],
                y: y,
                size: 6,
                font: font,
                color: rgb(0.6, 0.6, 0.6),
            });
            y -= 6;
        }
        
        y -= 14;
        rowCount++;
    }
    
    // FOOTER
    y -= 10;
    page.drawLine({
        start: { x: 48, y: y },
        end: { x: 547, y: y },
        thickness: 1,
        color: rgb(0.8, 0.8, 0.8),
    });
    y -= 12;
    
    // Número de página
    page.drawText(`Pagina ${pageNumber} de ${pdfDoc.getPageCount()}`, {
        x: 48,
        y: y,
        size: 8,
        font: font,
        color: rgb(0.6, 0.6, 0.6),
    });
    
    // Pie de página
    page.drawText('BRASARGENT - Santa Cruz - Bolivia', {
        x: 350,
        y: y,
        size: 8,
        font: font,
        color: rgb(0.6, 0.6, 0.6),
    });
    
    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}
