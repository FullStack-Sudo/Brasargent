// ============================================
// CLIENTE OPENWA PARA WHATSAPP
// ============================================

import { query } from '../db';

interface OpenWAMessage {
    to: string;
    text: string;
    session?: string;
    quoted?: string;
}

interface OpenWAResponse {
    success: boolean;
    messageId?: string;
    error?: string;
}

function getEnv(key: string): string | undefined {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env?.[key] !== undefined) {
        // @ts-ignore
        return import.meta.env[key];
    }
    return process.env[key];
}

class OpenWAClient {
    private apiUrl: string;
    private apiKey: string;
    private defaultSession: string;

    constructor() {
        this.apiUrl = getEnv('OPENWA_API_URL') || 'http://localhost:2785/api';
        this.apiKey = getEnv('OPENWA_API_KEY') || 'owa_k1_a7424af6e46cc9dbb8b8dffa789ae56897d11c736bdb7f7bb80a3d140edbc58b';
        this.defaultSession = getEnv('OPENWA_DEFAULT_SESSION') || 'brasargent';
    }
    private getHeaders() {
        const apiKey = getEnv('OPENWA_API_KEY') || this.apiKey;
        return {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json'
        };
    }

    // ============================================
    // OBTENER O CREAR SESIÓN EN OPENWA
    // ============================================

    private async getSession(sessionName?: string): Promise<{ id: string; name: string; status: string; phone?: string | null; pushName?: string | null } | null> {
        try {
            const name = sessionName || this.defaultSession;
            const res = await fetch(`${this.apiUrl}/sessions`, {
                headers: this.getHeaders()
            });

            if (!res.ok) {
                console.error(`❌ OpenWA getSession error: HTTP ${res.status}`);
                return null;
            }

            const sessions: any[] = await res.json();
            if (Array.isArray(sessions)) {
                const found = sessions.find(s => s.name === name || s.id === name);
                if (found) return found;
            }

            // Si no existe, crear la sesión en OpenWA
            const createRes = await fetch(`${this.apiUrl}/sessions`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ name: name })
            });

            if (createRes.ok) {
                const newSession = await createRes.json();
                return newSession;
            }
            return null;
        } catch (error) {
            console.error('❌ Error obteniendo sesión de OpenWA:', error);
            return null;
        }
    }

    // ============================================
    // VERIFICAR CONEXIÓN
    // ============================================

    async checkConnection(sessionName?: string): Promise<boolean> {
        try {
            const session = await this.getSession(sessionName);
            if (!session) return false;
            
            const status = String(session.status || '').toLowerCase();
            // Si la sesión requiere escanear QR, está desconectada o detenida, NO está lista
            if (['qr_ready', 'scan_qr', 'disconnected', 'stopped', 'unpaired', 'error', 'starting'].includes(status)) {
                return false;
            }
            return status === 'ready' || status === 'connected' || status === 'working' || status === 'authenticated' || status === 'inchat';
        } catch (error) {
            console.error('❌ Error verificando conexión:', error);
            return false;
        }
    }

    async getSessionInfo(sessionName?: string): Promise<{ connected: boolean; session: string; phone?: string | null; pushName?: string | null }> {
        try {
            const session = await this.getSession(sessionName);
            if (!session) return { connected: false, session: sessionName || this.defaultSession };

            const isConnected = await this.checkConnection(sessionName);

            return {
                connected: isConnected,
                session: session.name || this.defaultSession,
                phone: isConnected ? (session.phone || null) : null,
                pushName: isConnected ? (session.pushName || null) : null
            };
        } catch (error) {
            console.error('❌ Error obteniendo info de sesión:', error);
            return { connected: false, session: sessionName || this.defaultSession };
        }
    }

    // Alias para compatibilidad con código existente
    async checkSession(sessionName?: string): Promise<boolean> {
        return this.checkConnection(sessionName);
    }

    // ============================================
    // ENVIAR MENSAJE DE TEXTO
    // ============================================

    async sendMessage(data: OpenWAMessage): Promise<OpenWAResponse> {
        try {
            // Validar que OpenWA esté conectado
            const isConnected = await this.checkConnection(data.session);
            if (!isConnected) {
                const errorMsg = 'La sesión de WhatsApp no está conectada. Escanea el código QR en el panel (/admin/whatsapp).';
                await this.logError(data.to, data.text, errorMsg);
                return {
                    success: false,
                    error: errorMsg
                };
            }

            const session = await this.getSession(data.session);
            if (!session) {
                const errorMsg = 'No se encontró la sesión de WhatsApp en OpenWA.';
                await this.logError(data.to, data.text, errorMsg);
                return { success: false, error: errorMsg };
            }

            // Formatear chatId (ej: 59164930068@c.us)
            const rawDigits = data.to.replace(/\D/g, '');
            const chatId = data.to.includes('@') ? data.to : `${rawDigits.startsWith('591') || rawDigits.length > 8 ? rawDigits : '591' + rawDigits}@c.us`;

            const response = await fetch(`${this.apiUrl}/sessions/${session.id}/messages/send-text`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    chatId: chatId,
                    text: data.text
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorMsg = `OpenWA API Error (${response.status}): ${errorText}`;
                if (response.status === 409 || errorText.includes('Session is not connected')) {
                    errorMsg = 'La sesión de WhatsApp se desconectó. Por favor, vuelve a vincular el código QR en /admin/whatsapp.';
                }
                throw new Error(errorMsg);
            }

            const result = await response.json();
            const messageId = result.messageId || result.id || 'unknown';
            
            // Registrar en logs
            await this.logMessage(data.to, data.text, messageId);
            
            return {
                success: true,
                messageId: messageId
            };

        } catch (error: any) {
            console.error('❌ Error enviando mensaje con OpenWA:', error);
            
            // Registrar error en logs
            await this.logError(data.to, data.text, error.message || 'Error al enviar mensaje');
            
            return {
                success: false,
                error: error.message || 'Error al enviar mensaje'
            };
        }
    }

    // ============================================
    // OBTENER QR PARA CONEXIÓN
    // ============================================

    async getQR(sessionName?: string): Promise<string | null> {
        try {
            const session = await this.getSession(sessionName);
            if (!session) return null;

            const response = await fetch(`${this.apiUrl}/sessions/${session.id}/qr`, {
                headers: this.getHeaders()
            });

            if (!response.ok) return null;

            const data = await response.json();
            return data?.qrCode || data?.qr || null;
        } catch (error) {
            console.error('❌ Error obteniendo QR:', error);
            return null;
        }
    }

    // ============================================
    // INICIAR O REINICIAR SESIÓN
    // ============================================

    async startSession(sessionName?: string): Promise<{ success: boolean; qr?: string; error?: string }> {
        try {
            const session = await this.getSession(sessionName);
            if (!session) {
                return { success: false, error: 'No se pudo crear u obtener la sesión en OpenWA' };
            }

            try {
                await fetch(`${this.apiUrl}/sessions/${session.id}/start`, {
                    method: 'POST',
                    headers: this.getHeaders()
                });
            } catch (e) {
                // ignorar si ya estaba iniciada
            }

            const qr = await this.getQR(sessionName);
            return { 
                success: true, 
                qr: qr || undefined 
            };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    async restartSession(sessionName?: string): Promise<{ success: boolean; qr?: string; error?: string }> {
        try {
            const session = await this.getSession(sessionName);
            if (session) {
                try {
                    await fetch(`${this.apiUrl}/sessions/${session.id}/logout`, {
                        method: 'POST',
                        headers: this.getHeaders()
                    });
                } catch (e) {}
                try {
                    await fetch(`${this.apiUrl}/sessions/${session.id}/start`, {
                        method: 'POST',
                        headers: this.getHeaders()
                    });
                } catch (e) {}
            }

            const qr = await this.getQR(sessionName);
            return {
                success: true,
                qr: qr || undefined
            };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    // ============================================
    // CERRAR SESIÓN (LOGOUT)
    // ============================================

    async logout(sessionName?: string): Promise<{ success: boolean; error?: string }> {
        try {
            const session = await this.getSession(sessionName);
            if (!session) {
                return { success: true };
            }

            // Si la sesión ya está desconectada o el motor no está cargado, detener la sesión limpiamente
            if (session.status === 'disconnected' || session.engineLoaded === false) {
                try {
                    await fetch(`${this.apiUrl}/sessions/${session.id}/stop`, {
                        method: 'POST',
                        headers: this.getHeaders()
                    });
                } catch (e) {}
                return { success: true };
            }

            const response = await fetch(`${this.apiUrl}/sessions/${session.id}/logout`, {
                method: 'POST',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                const errorText = await response.text();
                // Si la sesión no estaba iniciada, llamar a /stop y retornar éxito (ya está desconectado)
                if (response.status === 400 || errorText.includes('Session is not started') || errorText.includes('not started')) {
                    try {
                        await fetch(`${this.apiUrl}/sessions/${session.id}/stop`, {
                            method: 'POST',
                            headers: this.getHeaders()
                        });
                    } catch (e) {}
                    return { success: true };
                }
                return { success: false, error: errorText };
            }

            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    // ============================================
    // OBTENER ESTADO DE LA SESIÓN
    // ============================================

    async getSessionStatus(sessionName?: string): Promise<{ 
        connected: boolean; 
        phone?: string | null; 
        name?: string | null 
    }> {
        try {
            const info = await this.getSessionInfo(sessionName);
            return {
                connected: info.connected,
                phone: info.phone || null,
                name: info.pushName || null
            };
        } catch (error) {
            return { connected: false };
        }
    }

    // ============================================
    // REGISTRAR MENSAJE EN LOGS
    // ============================================

    private async logMessage(to: string, text: string, messageId: string): Promise<void> {
        try {
            await query(
                `INSERT INTO logs_whatsapp 
                 (destinatario, mensaje, message_id, estado, fecha_envio) 
                 VALUES (?, ?, ?, 'enviado', NOW())`,
                [to, text, messageId]
            );
            console.log(`✅ Mensaje registrado: ${messageId}`);
        } catch (error) {
            console.error('❌ Error registrando mensaje:', error);
        }
    }

    // ============================================
    // REGISTRAR ERROR EN LOGS
    // ============================================

    private async logError(to: string, text: string, error: string): Promise<void> {
        try {
            await query(
                `INSERT INTO logs_whatsapp 
                 (destinatario, mensaje, estado, error, fecha_envio) 
                 VALUES (?, ?, 'error', ?, NOW())`,
                [to, text, error]
            );
        } catch (err) {
            console.error('❌ Error registrando error:', err);
        }
    }
}

export const openwa = new OpenWAClient();
