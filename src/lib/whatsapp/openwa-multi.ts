// ============================================
// SERVICIO OPENWA - MULTI-SESIÓN POR SUCURSAL
// ============================================

import { query } from '../db';

interface OpenWASession {
    id: number;
    sucursal_id: number;
    session_name: string;
    status: string;
    qr_code: string | null;
    telefono: string | null;
    push_name: string | null;
}

function getEnv(key: string): string | undefined {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env?.[key] !== undefined) {
        // @ts-ignore
        return import.meta.env[key];
    }
    return process.env[key];
}

class OpenWAMultiClient {
    private apiUrl: string;
    private apiKey: string;

    constructor() {
        this.apiUrl = getEnv('OPENWA_API_URL') || 'http://localhost:2785/api';
        this.apiKey = getEnv('OPENWA_API_KEY') || 'owa_k1_a7424af6e46cc9dbb8b8dffa789ae56897d11c736bdb7f7bb80a3d140edbc58b';
    }

    private getHeaders() {
        const key = getEnv('OPENWA_API_KEY') || this.apiKey;
        return {
            'X-API-Key': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json'
        };
    }

    // ============================================
    // OBTENER SESIÓN DE UNA SUCURSAL
    // ============================================

    async getSessionBySucursal(sucursalId: number): Promise<OpenWASession | null> {
        const [rows] = await query(
            'SELECT * FROM openwa_sesiones WHERE sucursal_id = ?',
            [sucursalId]
        ) as any[];
        const sessions = Array.isArray(rows) ? rows : [];
        return sessions[0] || null;
    }

    // ============================================
    // CREAR/OBTENER SESIÓN EN OPENWA
    // ============================================

    async createOrGetSession(sucursalId: number): Promise<{
        success: boolean;
        session?: string;
        qr?: string;
        error?: string;
    }> {
        try {
            // Obtener datos de la sucursal
            const [sucursalRows] = await query(
                'SELECT id, nombre, telefono FROM sucursales WHERE id = ?',
                [sucursalId]
            ) as any[];
            const sucursales = Array.isArray(sucursalRows) ? sucursalRows : [];
            const sucursal = sucursales[0];

            if (!sucursal) {
                return { success: false, error: 'Sucursal no encontrada' };
            }

            // Generar nombre de sesión único
            const sessionName = this.generarSessionName(sucursal.nombre);

            // Verificar si ya existe en OpenWA
            const existingSession = await this.getOpenWASession(sessionName);
            
            if (existingSession && (existingSession.status === 'connected' || existingSession.status === 'ready' || existingSession.status === 'authenticated' || existingSession.status === 'working')) {
                // Ya está conectada
                await this.updateSessionStatus(sucursalId, 'connected', existingSession.phone || existingSession.me?.user, existingSession.pushName || existingSession.me?.pushname);
                return { 
                    success: true, 
                    session: sessionName,
                    already_connected: true,
                    error: undefined
                };
            }

            // La sesión NO está conectada: descartar cualquier número vinculado antes
            // (credenciales guardadas) para que OpenWA muestre un QR nuevo y se pueda
            // vincular cualquier otro número.
            let qrCodeStr: string | null = null;
            let openwaSessionId: string | null = null;

            if (existingSession) {
                await this.deleteOpenWASession(existingSession.id);
            }
            await query(
                'UPDATE openwa_sesiones SET telefono = NULL, push_name = NULL, qr_code = NULL WHERE sucursal_id = ?',
                [sucursalId]
            );

            try {
                const response = await fetch(`${this.apiUrl}/sessions`, {
                    method: 'POST',
                    headers: this.getHeaders(),
                    body: JSON.stringify({ name: sessionName })
                });

                if (response.ok) {
                    const created = await response.json();
                    openwaSessionId = created.id;
                } else {
                    const detail = await response.text().catch(() => '');
                    console.error('OpenWA create session error:', response.status, detail);
                    return { success: false, error: `El servidor de OpenWA devolvió un error (${response.status}): ${detail.slice(0, 200)}` };
                }
            } catch (err: any) {
                console.error('OpenWA API not reachable:', err.message);
                return { success: false, error: 'El servicio de OpenWA no está accesible en el puerto 2785. Verifica que el contenedor esté corriendo.' };
            }

            if (openwaSessionId) {
                try {
                    const startResponse = await fetch(`${this.apiUrl}/sessions/${openwaSessionId}/start`, {
                        method: 'POST',
                        headers: this.getHeaders()
                    });
                    if (startResponse.ok) {
                        const startData = await startResponse.json().catch(() => ({}));
                        qrCodeStr = startData.qr || startData.qrCode || null;
                    }
                } catch (err: any) {
                    console.warn('OpenWA start session call warning:', err.message);
                }

                // El QR tarda unos segundos en generarse tras iniciar el motor
                if (!qrCodeStr) {
                    qrCodeStr = await this.fetchQr(openwaSessionId, 30);
                }
            }

            // Guardar en base de datos
            await query(
                `INSERT INTO openwa_sesiones 
                 (sucursal_id, session_name, status, qr_code) 
                 VALUES (?, ?, 'qr_pending', ?)
                 ON DUPLICATE KEY UPDATE 
                 status = 'qr_pending',
                 qr_code = VALUES(qr_code),
                 session_name = VALUES(session_name)`,
                [sucursalId, sessionName, qrCodeStr || null]
            );

            return {
                success: true,
                session: sessionName,
                qr: qrCodeStr || undefined
            };

        } catch (error: any) {
            console.error('Error creando sesión:', error);
            return { success: false, error: error.message };
        }
    }

    // ============================================
    // OBTENER QR DE UNA SESIÓN
    // ============================================

    async getQR(sucursalId: number): Promise<{
        success: boolean;
        qr?: string;
        status?: string;
        error?: string;
    }> {
        try {
            const session = await this.getSessionBySucursal(sucursalId);
            
            if (!session) {
                return { success: false, error: 'Sesión no encontrada' };
            }

            // Obtener estado actual de OpenWA
            const openwaSession = await this.getOpenWASession(session.session_name);
            
            if (openwaSession) {
                const statusStr = String(openwaSession.status || '').toLowerCase();
                const isConnected = ['ready', 'connected', 'authenticated', 'working', 'inchat'].includes(statusStr);
                const dbStatus = isConnected ? 'connected' : (statusStr.includes('qr') ? 'qr_pending' : 'disconnected');

                // Actualizar estado en BD
                await this.updateSessionStatus(
                    sucursalId, 
                    dbStatus,
                    openwaSession.phone || openwaSession.me?.user,
                    openwaSession.pushName || openwaSession.me?.pushname
                );

                if (isConnected) {
                    return {
                        success: true,
                        status: 'connected'
                    };
                }

                const fetchedQr = openwaSession.qr || openwaSession.qrCode
                    || (statusStr.includes('qr') ? await this.fetchQr(openwaSession.id, 1) : null);
                if (fetchedQr) {
                    return {
                        success: true,
                        qr: fetchedQr,
                        status: 'qr_pending'
                    };
                }
            }

            return {
                success: true,
                qr: session.qr_code || undefined,
                status: session.status
            };

        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    // ============================================
    // ENVIAR MENSAJE USANDO LA SESIÓN DE LA SUCURSAL
    // ============================================

    async sendMessage(
        sucursalId: number,
        telefono: string,
        mensaje: string
    ): Promise<{ success: boolean; messageId?: string; error?: string }> {
        try {
            const session = await this.getSessionBySucursal(sucursalId);
            
            if (!session) {
                return { success: false, error: 'Sesión no configurada para esta sucursal' };
            }

            // Verificar el estado REAL en OpenWA (el valor en BD puede estar desactualizado)
            const liveSession = await this.getOpenWASession(session.session_name);
            const liveStatus = String(liveSession?.status || '').toLowerCase();
            const liveConnected = ['ready', 'connected', 'authenticated', 'working', 'inchat'].includes(liveStatus);

            if (liveSession) {
                await this.updateSessionStatus(
                    sucursalId,
                    liveConnected ? 'connected' : 'disconnected',
                    liveSession.phone || liveSession.me?.user,
                    liveSession.pushName || liveSession.me?.pushname
                );
            }

            if (!liveConnected) {
                return { success: false, error: 'La sesión de WhatsApp de esta sucursal no está conectada. Vincula el QR en /admin/openwa.' };
            }

            const rawDigits = telefono.replace(/\D/g, '');
            const chatId = telefono.includes('@') ? telefono : `${rawDigits.startsWith('591') || rawDigits.length > 8 ? rawDigits : '591' + rawDigits}@c.us`;

            const response = await fetch(`${this.apiUrl}/messages`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    session: session.session_name,
                    to: chatId,
                    text: mensaje
                })
            });

            if (!response.ok) {
                const openwaSession = await this.getOpenWASession(session.session_name);
                const sessionId = openwaSession ? openwaSession.id : session.session_name;

                // Fallback endpoint si la API usa /sessions/:id/messages/send-text
                const fallbackRes = await fetch(`${this.apiUrl}/sessions/${sessionId}/messages/send-text`, {
                    method: 'POST',
                    headers: this.getHeaders(),
                    body: JSON.stringify({
                        chatId: chatId,
                        text: mensaje
                    })
                });

                if (!fallbackRes.ok) {
                    const error = await fallbackRes.text();
                    await this.logMessage(telefono, mensaje, 'error', error, session.session_name);
                    return { success: false, error };
                }

                const fbResult = await fallbackRes.json();
                const msgId = fbResult.messageId || fbResult.id || 'unknown';
                await this.logMessage(telefono, mensaje, 'enviado', null, session.session_name, msgId);
                return { success: true, messageId: msgId };
            }

            const result = await response.json();
            const msgId = result.id || result.messageId || 'unknown';

            // Registrar en logs
            await this.logMessage(telefono, mensaje, 'enviado', null, session.session_name, msgId);

            return { success: true, messageId: msgId };

        } catch (error: any) {
            console.error('Error enviando mensaje WhatsApp por sucursal:', error);
            return { success: false, error: error.message };
        }
    }

    // ============================================
    // DESCONECTAR SESIÓN
    // ============================================

    async disconnect(sucursalId: number): Promise<{ success: boolean; error?: string }> {
        try {
            const session = await this.getSessionBySucursal(sucursalId);
            
            if (!session) {
                return { success: false, error: 'Sesión no encontrada' };
            }

            try {
                const openwaSession = await this.getOpenWASession(session.session_name);
                const sessionId = openwaSession ? openwaSession.id : session.session_name;
                await fetch(
                    `${this.apiUrl}/sessions/${sessionId}/logout`,
                    {
                        method: 'POST',
                        headers: this.getHeaders()
                    }
                );
            } catch (e) {}

            // Eliminar la sesión en OpenWA (borra las credenciales) y olvidar el número
            try {
                const openwaSession = await this.getOpenWASession(session.session_name);
                if (openwaSession) await this.deleteOpenWASession(openwaSession.id);
            } catch (e) {}

            await query(
                `UPDATE openwa_sesiones SET status = 'disconnected', telefono = NULL, push_name = NULL, qr_code = NULL WHERE sucursal_id = ?`,
                [sucursalId]
            );

            return { success: true };

        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    // ============================================
    // FUNCIONES AUXILIARES
    // ============================================

    private generarSessionName(nombreSucursal: string): string {
        return nombreSucursal
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
    }

    private async fetchQr(openwaSessionId: string, attempts: number): Promise<string | null> {
        for (let i = 0; i < attempts; i++) {
            try {
                const res = await fetch(`${this.apiUrl}/sessions/${openwaSessionId}/qr`, {
                    headers: this.getHeaders()
                });
                if (res.ok) {
                    const data = await res.json();
                    const qr = data.qr || data.qrCode;
                    if (qr) return qr;
                }
            } catch {}
            if (i < attempts - 1) await new Promise(r => setTimeout(r, 1000));
        }
        return null;
    }

    private async deleteOpenWASession(openwaSessionId: string): Promise<void> {
        try {
            await fetch(`${this.apiUrl}/sessions/${openwaSessionId}/stop`, { method: 'POST', headers: this.getHeaders() }).catch(() => {});
            await fetch(`${this.apiUrl}/sessions/${openwaSessionId}`, { method: 'DELETE', headers: this.getHeaders() });
        } catch (e) {
            console.warn('No se pudo eliminar la sesión previa en OpenWA:', e);
        }
    }

    private async getOpenWASession(sessionName: string): Promise<any> {
        try {
            const response = await fetch(
                `${this.apiUrl}/sessions`,
                {
                    headers: this.getHeaders()
                }
            );

            if (!response.ok) return null;
            const sessions = await response.json();
            return sessions.find((s: any) => s.name === sessionName) || null;
        } catch {
            return null;
        }
    }

    private async updateSessionStatus(
        sucursalId: number,
        status: string,
        telefono?: string,
        pushName?: string
    ): Promise<void> {
        await query(
            `UPDATE openwa_sesiones 
             SET status = ?, telefono = COALESCE(?, telefono), push_name = COALESCE(?, push_name),
                 ultima_conexion = CASE WHEN ? = 'connected' THEN NOW() ELSE ultima_conexion END
             WHERE sucursal_id = ?`,
            [status, telefono || null, pushName || null, status, sucursalId]
        );
    }

    private async logMessage(to: string, text: string, estado: string, error?: string | null, sessionName?: string, messageId?: string): Promise<void> {
        try {
            await query(
                `INSERT INTO logs_whatsapp 
                 (destinatario, mensaje, estado, error, message_id, fecha_envio) 
                 VALUES (?, ?, ?, ?, ?, NOW())`,
                [to, text, estado, error || null, messageId || sessionName || null]
            );
        } catch (err) {
            console.error('Error registrando log whatsapp:', err);
        }
    }
}

export const openwaMulti = new OpenWAMultiClient();
