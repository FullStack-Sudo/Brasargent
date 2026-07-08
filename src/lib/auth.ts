import bcrypt from 'bcryptjs';
import pool from './db';

// Función para hashear contraseña
export async function hashPassword(password: string): Promise<string> {
    try {
        const salt = await bcrypt.genSalt(10);
        return await bcrypt.hash(password, salt);
    } catch (error) {
        console.error('Error al hashear contraseña:', error);
        throw new Error('Error al procesar la contraseña');
    }
}

// Función para verificar contraseña
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    try {
        return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
        console.error('Error al verificar contraseña:', error);
        return false;
    }
}

// Credenciales por defecto
export const DEFAULT_CREDENTIALS = {
    email: 'admin@brasargent.com',
    password: 'brasargent2026'
};

// Función para crear admin por defecto
export async function createDefaultAdmin() {
    try {
        const hashedPassword = await hashPassword(DEFAULT_CREDENTIALS.password);
        await pool.query(
            `INSERT INTO usuarios (email, password, nombre, rol) 
             VALUES (?, ?, ?, 'admin') 
             ON DUPLICATE KEY UPDATE password = VALUES(password)`,
            [DEFAULT_CREDENTIALS.email, hashedPassword, 'Administrador']
        );
        return true;
    } catch (error) {
        console.error('Error al crear admin:', error);
        return false;
    }
}
