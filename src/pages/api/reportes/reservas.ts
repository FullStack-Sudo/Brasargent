import type { APIRoute } from 'astro';
import { getDatosReporte, generarExcel, generarPDF } from '../../../lib/reportes';

export const GET: APIRoute = async ({ url, cookies }) => {
    try {
        // Verificar sesión admin
        const session = cookies.get('session');
        if (!session || session.value !== 'authenticated') {
            return new Response(JSON.stringify({
                success: false,
                error: 'No autorizado'
            }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }

        const formato = url.searchParams.get('formato') || 'excel';
        const fechaInicio = url.searchParams.get('fecha_inicio') || undefined;
        const fechaFin = url.searchParams.get('fecha_fin') || undefined;
        const sucursalId = url.searchParams.get('sucursal_id') ? parseInt(url.searchParams.get('sucursal_id')!) : undefined;

        // Obtener datos
        const reservas = await getDatosReporte(fechaInicio, fechaFin, sucursalId);

        if (reservas.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: 'No hay reservas para los filtros seleccionados'
            }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }

        const filenameDate = new Date().toISOString().split('T')[0];

        if (formato === 'excel') {
            const buffer = generarExcel(reservas);
            return new Response(Buffer.from(buffer), {
                status: 200,
                headers: {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition': `attachment; filename="reservas_brasargent_${filenameDate}.xlsx"`
                }
            });
        } else if (formato === 'pdf') {
            const pdfBytes = await generarPDF(reservas);
            return new Response(Buffer.from(pdfBytes), {
                status: 200,
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="reservas_brasargent_${filenameDate}.pdf"`
                }
            });
        }

        return new Response(JSON.stringify({
            success: false,
            error: 'Formato no soportado'
        }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    } catch (error: any) {
        console.error('Error generando reporte:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Error al generar reporte'
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
};
