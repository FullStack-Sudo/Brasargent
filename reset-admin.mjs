import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
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
        const email = 'admin@brasargent.com';
        const rawPassword = 'brasargent2026';
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(rawPassword, salt);
        
        // Try to update first
        const [updateResult] = await pool.query(
            `UPDATE usuarios SET password = ?, es_super_admin = 1, activo = 1 WHERE email = ?`,
            [hashedPassword, email]
        );
        
        if (updateResult.affectedRows === 0) {
            // Insert if not found
            await pool.query(
                `INSERT INTO usuarios (email, password, nombre, apellido, rol, es_super_admin, activo) 
                 VALUES (?, ?, ?, ?, ?, 1, 1)`,
                [email, hashedPassword, 'Super', 'Admin', 'admin']
            );
            console.log("Super admin user inserted.");
        } else {
            console.log("Super admin user updated.");
        }
        
    } catch (e) {
        console.error("Error setting super admin:", e);
    }
    process.exit();
}
run();
