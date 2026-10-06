// src/pages/api/eventos/stream.ts
// API para polling de eventos en tiempo real

import type { APIRoute } from 'astro';
import { query } from '../../../lib/db';

export const GET: APIRoute = async ({ cookies, url }) => {
    try {
        const session = cookies.get('session');
        if (!session || session.value !== 'authenticated') {
            return new Response(JSON.stringify({
                success: false,
                error: 'No autorizado'
            }), { status: 401 });
        }
        
        const esSuperAdmin = cookies.get('es_super_admin')?.value === 'true';
        const userSucursalId = cookies.get('user_sucursal')?.value;
        
        // Obtener timestamp del ultimo evento consultado
        const ultimoTimestamp = url.searchParams.get('desde') || '1970-01-01 00:00:00';
        
        let sql = '';
        let params: any[] = [];
        
        if (esSuperAdmin) {
            sql = 'SELECT * FROM eventos_tiempo_real WHERE created_at > ? ORDER BY created_at ASC LIMIT 50';
            params = [ultimoTimestamp];
        } else {
            const sucursalIdNum = parseInt(String(userSucursalId || '0'), 10);
            sql = 'SELECT * FROM eventos_tiempo_real WHERE created_at > ? AND sucursal_id = ? ORDER BY created_at ASC LIMIT 50';
            params = [ultimoTimestamp, sucursalIdNum];
        }
        
        const eventos = await query(sql, params) as any[];
        
        // Parsear datos JSON
        const eventosParsed = eventos.map(function(e) {
            return {
                id: e.id,
                tipo: e.tipo,
                sucursal_id: e.sucursal_id,
                datos: typeof e.datos === 'string' ? JSON.parse(e.datos) : e.datos,
                created_at: e.created_at
            };
        });
        
        return new Response(JSON.stringify({
            success: true,
            eventos: eventosParsed,
            timestamp: new Date().toISOString().slice(0, 19).replace('T', ' ')
        }), { status: 200 });
        
    } catch (error: any) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), { status: 500 });
    }
};
