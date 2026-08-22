import pool from '../src/lib/db';

async function cleanup() {
    await pool.query("DELETE FROM reservas WHERE id IN (66, 67)");
    console.log("✅ Reservas de prueba eliminadas");
    process.exit(0);
}

cleanup();
