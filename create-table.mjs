import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'brasargent',
        port: Number(process.env.DB_PORT) || 3306,
    });
    
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS eventos_tiempo_real (
                id INT AUTO_INCREMENT PRIMARY KEY,
                tipo VARCHAR(50) NOT NULL,
                sucursal_id INT,
                datos JSON,
                leido BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sucursal_id) REFERENCES sucursales(id) ON DELETE CASCADE,
                INDEX idx_sucursal (sucursal_id),
                INDEX idx_tipo (tipo),
                INDEX idx_created_at (created_at),
                INDEX idx_leido (leido)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log("Table eventos_tiempo_real created successfully.");
    } catch (e) {
        console.error("Error creating table:", e);
    }
    process.exit();
}
run();
