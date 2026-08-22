import { query } from './src/lib/db.ts';

async function setupWhatsAppLogsTable() {
    try {
        console.log('🔄 Creando tabla logs_whatsapp...');
        await query(`
            CREATE TABLE IF NOT EXISTS logs_whatsapp (
                id INT AUTO_INCREMENT PRIMARY KEY,
                destinatario VARCHAR(20) NOT NULL,
                mensaje TEXT NOT NULL,
                message_id VARCHAR(100),
                estado ENUM('enviado', 'entregado', 'leido', 'error', 'pendiente') DEFAULT 'pendiente',
                error TEXT,
                fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_destinatario (destinatario),
                INDEX idx_estado (estado),
                INDEX idx_fecha (fecha_envio)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ Tabla logs_whatsapp creada exitosamente');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error al crear la tabla logs_whatsapp:', error);
        process.exit(1);
    }
}

setupWhatsAppLogsTable();
