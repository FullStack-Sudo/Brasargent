import pool from './src/lib/db.js';

async function updateSucursalesFeatures() {
    try {
        await pool.query(`
            ALTER TABLE sucursales 
            ADD COLUMN IF NOT EXISTS permite_reservas BOOLEAN DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS permite_cubiertos BOOLEAN DEFAULT TRUE;
        `);
        console.log("Columnas permite_reservas y permite_cubiertos agregadas a sucursales");

        await pool.query(`
            UPDATE sucursales SET permite_reservas = 1, permite_cubiertos = 1;
        `);
        console.log("Datos de sucursales actualizados a true por defecto");

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
updateSucursalesFeatures();
