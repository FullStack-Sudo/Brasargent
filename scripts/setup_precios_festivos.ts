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

async function setupPreciosYFestivos() {
    try {
        const { query } = await import('../src/lib/db.ts');
        console.log('Iniciando configuración de tablas precios_cubiertos y dias_festivos...');

        // 1. Tabla precios_cubiertos
        await query(`
            CREATE TABLE IF NOT EXISTS precios_cubiertos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sucursal_id INT NOT NULL,
                dia_semana ENUM('lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo') NOT NULL,
                horario ENUM('mañana', 'tarde', 'noche', 'todo') DEFAULT 'todo',
                precio_adulto DECIMAL(10, 2) NOT NULL,
                precio_nino DECIMAL(10, 2) NOT NULL,
                edad_minima_nino INT DEFAULT 5,
                edad_maxima_nino INT DEFAULT 10,
                activo BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (sucursal_id) REFERENCES sucursales(id) ON DELETE CASCADE,
                UNIQUE KEY unique_precio (sucursal_id, dia_semana, horario),
                INDEX idx_sucursal (sucursal_id),
                INDEX idx_dia (dia_semana)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ Tabla precios_cubiertos lista.');

        // 2. Tabla dias_festivos
        await query(`
            CREATE TABLE IF NOT EXISTS dias_festivos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sucursal_id INT NOT NULL,
                fecha DATE NOT NULL,
                descripcion VARCHAR(100),
                sin_reservas BOOLEAN DEFAULT TRUE,
                creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sucursal_id) REFERENCES sucursales(id) ON DELETE CASCADE,
                UNIQUE KEY unique_fecha (sucursal_id, fecha),
                INDEX idx_fecha (fecha)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ Tabla dias_festivos lista.');

        // 3. Obtener sucursales
        const [sucursales] = await query(`SELECT id, nombre FROM sucursales`) as any[];
        if (!sucursales || sucursales.length === 0) {
            console.log('⚠️ No hay sucursales registradas.');
            process.exit(0);
        }

        // Insertar datos iniciales para cada sucursal (especialmente Churrasquería)
        for (const s of sucursales) {
            console.log(`Insertando precios iniciales para sucursal: ${s.nombre} (ID: ${s.id})...`);

            const preciosIniciales = [
                { dia: 'lunes', horario: 'todo', adulto: 190.00, nino: 80.00 },
                { dia: 'martes', horario: 'todo', adulto: 190.00, nino: 80.00 },
                { dia: 'miercoles', horario: 'todo', adulto: 190.00, nino: 80.00 },
                { dia: 'jueves', horario: 'todo', adulto: 190.00, nino: 80.00 },
                { dia: 'viernes', horario: 'todo', adulto: 190.00, nino: 80.00 },
                { dia: 'sabado', horario: 'mañana', adulto: 210.00, nino: 80.00 },
                { dia: 'sabado', horario: 'noche', adulto: 190.00, nino: 80.00 },
                { dia: 'domingo', horario: 'todo', adulto: 210.00, nino: 80.00 }
            ];

            for (const p of preciosIniciales) {
                await query(`
                    INSERT INTO precios_cubiertos 
                    (sucursal_id, dia_semana, horario, precio_adulto, precio_nino) 
                    VALUES (?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE 
                    precio_adulto = VALUES(precio_adulto), 
                    precio_nino = VALUES(precio_nino);
                `, [s.id, p.dia, p.horario, p.adulto, p.nino]);
            }

            // Días festivos de ejemplo para 2026
            const festivos2026 = [
                { fecha: '2026-01-01', desc: 'Año Nuevo' },
                { fecha: '2026-02-02', desc: 'Carnaval' },
                { fecha: '2026-02-03', desc: 'Carnaval' },
                { fecha: '2026-02-04', desc: 'Carnaval' },
                { fecha: '2026-04-02', desc: 'Jueves Santo' },
                { fecha: '2026-04-03', desc: 'Viernes Santo' },
                { fecha: '2026-05-01', desc: 'Día del Trabajador' },
                { fecha: '2026-06-04', desc: 'Corpus Christi' },
                { fecha: '2026-08-06', desc: 'Día de la Independencia' },
                { fecha: '2026-09-24', desc: 'Día de la Virgen' },
                { fecha: '2026-11-02', desc: 'Día de los Difuntos' },
                { fecha: '2026-12-25', desc: 'Navidad' }
            ];

            for (const f of festivos2026) {
                await query(`
                    INSERT INTO dias_festivos 
                    (sucursal_id, fecha, descripcion, sin_reservas) 
                    VALUES (?, ?, ?, TRUE)
                    ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion);
                `, [s.id, f.fecha, f.desc]);
            }
        }

        console.log('🚀 Tablas y datos iniciales de precios y días festivos creados exitosamente.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error configurando tablas de precios/festivos:', err);
        process.exit(1);
    }
}

setupPreciosYFestivos();
