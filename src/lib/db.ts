import mysql from 'mysql2/promise';

// Configuración del Pool de conexiones
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'brasargent',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

export default pool;
