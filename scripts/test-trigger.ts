import pool from '../src/lib/db';

async function test() {
    try {
        console.log("Setting up test condition...");
        await pool.query("UPDATE sucursales SET cubiertos_disponibles = 120, cubiertos_ocupados = 0 WHERE id = 1");
        
        // Find a pending reservation or create one
        let [reservas]: any = await pool.query("SELECT * FROM reservas LIMIT 1");
        if (reservas.length > 0) {
            let res = reservas[0];
            await pool.query(`UPDATE reservas SET estado = 'pendiente', cubiertos_reservados = 0, numero_personas = 5, sucursal_id = 1 WHERE id = ?`, [res.id]);
            
            console.log("Confirming reservation...");
            await pool.query(`UPDATE reservas SET estado = 'confirmada', cubiertos_reservados = 5 WHERE id = ?`, [res.id]);
            
            const [sucursales]: any = await pool.query("SELECT * FROM sucursales WHERE id = 1");
            console.log("Sucursal 1 after confirm:", sucursales[0]);
            
            const [logs]: any = await pool.query("SELECT * FROM logs_actividad ORDER BY id DESC LIMIT 1");
            console.log("Latest log:", logs[0]);
        }
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
test();
