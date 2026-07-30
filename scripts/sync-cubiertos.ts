import { query } from '../src/lib/db.js';

async function syncCubiertos() {
    console.log('🔄 Sincronizando cubiertos con reservas confirmadas...');

    try {
        // Obtener todas las sucursales
        const [sucursales] = await query('SELECT id, capacidad_total FROM sucursales') as any[];

        for (const sucursal of sucursales) {
            // Calcular cubiertos ocupados desde reservas confirmadas
            const [result] = await query(
                `SELECT COALESCE(SUM(cubiertos_reservados), 0) as total
                 FROM reservas 
                 WHERE sucursal_id = ? 
                 AND estado = 'confirmada'`,
                [sucursal.id]
            ) as any[];

            const ocupados = result[0]?.total || 0;
            const disponibles = sucursal.capacidad_total - ocupados;

            // Actualizar sucursal
            await query(
                `UPDATE sucursales 
                 SET cubiertos_ocupados = ?, 
                     cubiertos_disponibles = ? 
                 WHERE id = ?`,
                [ocupados, disponibles, sucursal.id]
            );

            console.log(`✅ Sucursal ID ${sucursal.id}: ${ocupados} ocupados, ${disponibles} disponibles`);
        }

        console.log('✅ Sincronización completada');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

syncCubiertos();
