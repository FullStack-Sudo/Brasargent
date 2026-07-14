import pool from './src/lib/db.js';

async function setupConfig() {
    try {
        await pool.query(`
        CREATE TABLE IF NOT EXISTS configuracion_sistema (
            id INT AUTO_INCREMENT PRIMARY KEY,
            clave VARCHAR(50) NOT NULL UNIQUE,
            valor VARCHAR(50) NOT NULL,
            tipo ENUM('boolean', 'text', 'number') DEFAULT 'boolean',
            descripcion TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_clave (clave)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log("Tabla configuracion_sistema creada");

        await pool.query(`
        INSERT IGNORE INTO configuracion_sistema (clave, valor, tipo, descripcion) VALUES 
        ('modulo_reservas', 'true', 'boolean', 'Sistema de reservas completo'),
        ('modulo_cocina', 'false', 'boolean', 'Sistema de pedidos mesero → cocina'),
        ('modulo_menu', 'true', 'boolean', 'Gestión de menú por sucursal'),
        ('modulo_clientes', 'true', 'boolean', 'Gestión de clientes y historial');
        `);
        console.log("Datos de configuración insertados");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
setupConfig();
