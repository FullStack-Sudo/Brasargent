import pool from './src/lib/db.js';

async function updateSucursales() {
    try {
        await pool.query(`
            ALTER TABLE sucursales 
            ADD COLUMN IF NOT EXISTS concepto VARCHAR(100),
            ADD COLUMN IF NOT EXISTS rating DECIMAL(3,1) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS resenas INT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS horarios JSON;
        `);
        console.log("Columnas agregadas a sucursales");

        // Set default horarios if null
        await pool.query(`
            UPDATE sucursales 
            SET horarios = '{"lunes": {"activo": true, "bloques": [{"inicio": "11:30", "fin": "15:00"}, {"inicio": "18:30", "fin": "22:00"}]}, "martes": {"activo": true, "bloques": [{"inicio": "11:30", "fin": "15:00"}, {"inicio": "18:30", "fin": "22:00"}]}, "miercoles": {"activo": true, "bloques": [{"inicio": "11:30", "fin": "15:00"}, {"inicio": "18:30", "fin": "22:00"}]}, "jueves": {"activo": true, "bloques": [{"inicio": "11:30", "fin": "15:00"}, {"inicio": "18:30", "fin": "22:00"}]}, "viernes": {"activo": true, "bloques": [{"inicio": "11:30", "fin": "15:00"}, {"inicio": "18:30", "fin": "22:00"}]}, "sabado": {"activo": true, "bloques": [{"inicio": "11:30", "fin": "15:00"}, {"inicio": "18:30", "fin": "22:00"}]}, "domingo": {"activo": true, "bloques": [{"inicio": "11:30", "fin": "15:00"}]}}'
            WHERE horarios IS NULL;
        `);
        console.log("Horarios por defecto asignados");

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
updateSucursales();
