import mysql from 'mysql2/promise';

// ============================================
// CARGA DE VARIABLES DE ENTORNO
// ============================================
// En Astro SSR (adapter Node), las variables del .env se acceden
// vía import.meta.env.* — Astro las carga automáticamente.
//
// Para scripts standalone (tsx), import.meta.env puede no existir,
// así que se usa process.env como fallback.

function getEnv(key: string): string | undefined {
    // @ts-ignore — import.meta.env existe en Astro pero no en tsx
    if (typeof import.meta !== 'undefined' && import.meta.env?.[key] !== undefined) {
        // @ts-ignore
        return import.meta.env[key];
    }
    return process.env[key];
}

const DB_HOST     = getEnv('DB_HOST');
const DB_PORT     = parseInt(getEnv('DB_PORT') || '3306', 10);
const DB_USER     = getEnv('DB_USER');
const DB_PASSWORD = getEnv('DB_PASSWORD') ?? '';
const DB_NAME     = getEnv('DB_NAME');

// ============================================
// VALIDACIÓN FAIL-FAST
// ============================================
// Si falta alguna variable crítica, el servidor falla de inmediato
// con un mensaje claro — no espera al primer request para explotar.

const missingVars: string[] = [];
if (!DB_HOST) missingVars.push('DB_HOST');
if (!DB_USER) missingVars.push('DB_USER');
if (!DB_NAME) missingVars.push('DB_NAME');
// DB_PASSWORD puede ser cadena vacía (root sin contraseña en dev local)

if (missingVars.length > 0) {
    const msg = `\n❌ Faltan variables de entorno requeridas para la base de datos: ${missingVars.join(', ')}\n` +
                `   Crea un archivo .env en la raíz del proyecto con estas variables.\n` +
                `   Usa .env.example como referencia.\n`;
    console.error(msg);
    throw new Error(msg);
}

// ============================================
// POOL DE CONEXIONES
// ============================================

const pool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// ============================================
// VERIFICACIÓN INICIAL DE CONEXIÓN
// ============================================
// Intenta conectar al arrancar para detectar errores temprano.
// No bloquea el arranque — solo loguea el resultado.

(async () => {
    try {
        const connection = await pool.getConnection();
        console.log(`✅ Conexión a MySQL establecida → ${DB_HOST}:${DB_PORT}/${DB_NAME}`);
        connection.release();
    } catch (error: any) {
        const code = error.code || '';

        if (code === 'ECONNREFUSED') {
            console.error(`❌ MySQL no está corriendo en ${DB_HOST}:${DB_PORT}`);
            console.error(`   Solución: inicia el servicio → sudo systemctl start mysql`);
        } else if (code === 'ER_ACCESS_DENIED_ERROR') {
            console.error(`❌ Credenciales inválidas: usuario "${DB_USER}" rechazado por MySQL`);
            console.error(`   Verifica DB_USER y DB_PASSWORD en tu archivo .env`);
        } else if (code === 'ER_BAD_DB_ERROR') {
            console.error(`❌ La base de datos "${DB_NAME}" no existe en MySQL`);
            console.error(`   Créala con: mysql -u root -h ${DB_HOST} -e "CREATE DATABASE ${DB_NAME};"`);
        } else if (code === 'ENOTFOUND') {
            console.error(`❌ No se puede resolver el host "${DB_HOST}"`);
            console.error(`   Verifica DB_HOST en tu archivo .env`);
        } else {
            console.error(`❌ Error de conexión a MySQL [${code}]:`, error.message);
        }
    }
})();

export default pool;
