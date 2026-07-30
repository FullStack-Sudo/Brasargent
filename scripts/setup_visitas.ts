import fs from 'fs';
import path from 'path';

// Parse .env file if process.env variables are missing
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    for (const line of envConfig.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=');
            const val = valueParts.join('=').trim();
            if (key && val !== undefined) {
                process.env[key.trim()] = val.replace(/^["']|["']$/g, '');
            }
        }
    }
}

async function setupVisitasTable() {
    try {
        const { query } = await import('../src/lib/db.ts');
        console.log('Creando tabla visitas_ip si no existe...');
        await query(`
            CREATE TABLE IF NOT EXISTS visitas_ip (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ip_address VARCHAR(45) NOT NULL,
                user_agent TEXT,
                fecha_visita TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_ip (ip_address),
                INDEX idx_fecha (fecha_visita)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ Tabla visitas_ip creada o verificada exitosamente.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error al crear la tabla visitas_ip:', error);
        process.exit(1);
    }
}

setupVisitasTable();
