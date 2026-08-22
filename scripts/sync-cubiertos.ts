import { query } from '../src/lib/db';

async function syncCubiertos() {
    console.log('🔄 Sincronizando cubiertos con reservas confirmadas y en curso...');

    try {
        // Obtener todas las sucursales
        const sucursales = await query('SELECT id, nombre, capacidad_total FROM sucursales') as any[];

        for (const sucursal of sucursales) {
            // Calcular cubiertos ocupados reales desde reservas confirmadas/en_curso
            const [result] = await query(
                `SELECT COALESCE(SUM(cubiertos_reservados), 0) as total
                 FROM reservas 
                 WHERE sucursal_id = ? 
                 AND estado IN ('confirmada', 'en_curso')`,
                [sucursal.id]
            ) as any[];

            const ocupados = parseInt(result?.total || '0', 10);
            const disponibles = Math.max(0, sucursal.capacidad_total - ocupados);

            // Actualizar sucursal en DB
            await query(
                `UPDATE sucursales 
                 SET cubiertos_ocupados = ?, 
                     cubiertos_disponibles = ? 
                 WHERE id = ?`,
                [ocupados, disponibles, sucursal.id]
            );

            console.log(`✅ ${sucursal.nombre} (ID ${sucursal.id}): ${ocupados} ocupados, ${disponibles} disponibles (Capacidad: ${sucursal.capacidad_total})`);
        }

        console.log('✅ Sincronización de cubiertos completada exitosamente');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error al sincronizar cubiertos:', error);
        process.exit(1);
    }
}

syncCubiertos();
