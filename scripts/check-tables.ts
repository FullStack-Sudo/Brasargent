import pool from '../src/lib/db';

async function check() {
    try {
        const [rows] = await pool.query('SHOW TABLES LIKE "logs_actividad"');
        console.log(rows);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
check();
