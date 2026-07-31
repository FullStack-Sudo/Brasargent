import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

// Cargar .env manualmente
try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        envContent.split('\n').forEach(line => {
            const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
            if (match) {
                const key = match[1];
                let value = match[2] || '';
                if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
                    value = value.replace(/^"|"$/g, '');
                }
                process.env[key] = value.trim();
            }
        });
    }
} catch (e) {}

async function updateFeriados() {
    console.log('🗓️ Actualizando días feriados sin reserva en la base de datos...');

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'brasargent',
        port: parseInt(process.env.DB_PORT || '3306')
    });

    const feriados = [
        { fecha: '2026-01-01', descripcion: 'Año Nuevo' },
        { fecha: '2026-02-02', descripcion: 'Carnaval' },
        { fecha: '2026-02-03', descripcion: 'Carnaval' },
        { fecha: '2026-02-04', descripcion: 'Carnaval' },
        { fecha: '2026-04-02', descripcion: 'Jueves Santo' },
        { fecha: '2026-04-03', descripcion: 'Viernes Santo' },
        { fecha: '2026-05-01', descripcion: 'Día del Trabajador' },
        { fecha: '2026-06-04', descripcion: 'Corpus Christi' },
        { fecha: '2026-08-06', descripcion: 'Día de la Independencia' },
        { fecha: '2026-09-24', descripcion: 'Día de la Virgen' },
        { fecha: '2026-11-02', descripcion: 'Día de los Difuntos' },
        { fecha: '2026-12-25', descripcion: 'Navidad' },
    ];

    for (const feriado of feriados) {
        try {
            await connection.execute(
                `INSERT INTO dias_festivos (sucursal_id, fecha, descripcion, sin_reservas) 
                 VALUES (1, ?, ?, TRUE) 
                 ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion), sin_reservas = TRUE`,
                [feriado.fecha, feriado.descripcion]
            );
        } catch (e: any) {
            console.error(`Error insertando feriado ${feriado.fecha}:`, e.message);
        }
    }

    console.log('✅ Días feriados actualizados exitosamente');
    await connection.end();
}

updateFeriados().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
