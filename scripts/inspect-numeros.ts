import pool from '../src/lib/db';

async function inspect() {
    const [rows]: any = await pool.query("SELECT id, sucursal_id, numero_reserva FROM reservas");
    console.table(rows);
    process.exit(0);
}

inspect();
