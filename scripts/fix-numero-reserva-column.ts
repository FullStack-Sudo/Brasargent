import pool from '../src/lib/db';

async function fixColumn() {
    try {
        console.log("Checking schema for column 'numero_reserva' in table 'reservas'...");
        
        const [rows]: any = await pool.query(`SHOW COLUMNS FROM reservas LIKE 'numero_reserva'`);
        console.log("Current column spec:", rows);

        console.log("Modifying column 'numero_reserva' to VARCHAR(30)...");
        await pool.query(`ALTER TABLE reservas MODIFY COLUMN numero_reserva VARCHAR(30) DEFAULT NULL`);

        const [updatedRows]: any = await pool.query(`SHOW COLUMNS FROM reservas LIKE 'numero_reserva'`);
        console.log("Updated column spec:", updatedRows);

        console.log("✅ Column 'numero_reserva' updated successfully to VARCHAR(30)");
        process.exit(0);
    } catch (err: any) {
        console.error("❌ Error modifying column:", err);
        process.exit(1);
    }
}

fixColumn();
