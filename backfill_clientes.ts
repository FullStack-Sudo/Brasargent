import pool from './src/lib/db.ts';

async function backfill() {
    try {
        console.log("Iniciando sincronización de clientes antiguos...");
        
        // Obtenemos los clientes únicos desde reservas
        const [rows] = await pool.query(`
            SELECT 
                nombre_cliente, 
                telefono, 
                codigo_pais, 
                telefono_completo,
                MAX(fecha) as ultima_reserva,
                COUNT(id) as total_reservas
            FROM reservas
            GROUP BY telefono, codigo_pais
        `) as any[];
        
        let agregados = 0;
        let actualizados = 0;
        
        for (const row of rows) {
            const { 
                nombre_cliente, 
                telefono, 
                codigo_pais, 
                telefono_completo, 
                ultima_reserva, 
                total_reservas 
            } = row;
            
            // Verificamos si existe
            const [existing] = await pool.query(
                `SELECT id FROM clientes WHERE telefono = ? AND codigo_pais = ?`,
                [telefono, codigo_pais]
            ) as any[];
            
            if (existing.length === 0) {
                // Insertamos
                await pool.query(
                    `INSERT INTO clientes (nombre, telefono, codigo_pais, telefono_completo, ultima_reserva, total_reservas) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [nombre_cliente, telefono, codigo_pais, telefono_completo, ultima_reserva, total_reservas]
                );
                agregados++;
            } else {
                // Actualizamos
                await pool.query(
                    `UPDATE clientes SET nombre = ?, ultima_reserva = ?, total_reservas = ? WHERE id = ?`,
                    [nombre_cliente, ultima_reserva, total_reservas, existing[0].id]
                );
                actualizados++;
            }
        }
        
        console.log(`Sincronización completada. Agregados: ${agregados}, Actualizados: ${actualizados}`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
backfill();
