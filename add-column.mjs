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
            ALTER TABLE reservas 
            ADD COLUMN IF NOT EXISTS fecha_cancelacion DATETIME NULL;
        `);
        console.log("Column fecha_cancelacion ensured.");
    } catch (e) {
        console.error("Error adding column:", e);
    }
    process.exit();
}
run();
