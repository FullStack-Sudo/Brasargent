import pool from '../src/lib/db';

async function fixTriggers() {
    try {
        console.log("🛠️ Ajustando colaciones de columnas y triggers...");

        // 1. Asegurar la misma colación utf8mb4_general_ci en las columnas
        await pool.query("ALTER TABLE sucursales CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;");
        await pool.query("ALTER TABLE reservas CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;");
        await pool.query("ALTER TABLE reservas MODIFY COLUMN numero_reserva VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL;");
        await pool.query("ALTER TABLE sucursales MODIFY COLUMN prefijo_reserva VARCHAR(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'BR';");
        
        console.log("✅ Colaciones unificadas a utf8mb4_general_ci");

        // 2. Eliminar trigger antiguo conflictivo
        await pool.query("DROP TRIGGER IF EXISTS trg_generar_numero_reserva;");
        await pool.query("DROP TRIGGER IF EXISTS trg_generar_numero_reserva_personalizado;");

        // 3. Recrear el trigger especificando la colación de las variables y del LIKE
        await pool.query(`
            CREATE TRIGGER trg_generar_numero_reserva_personalizado
            BEFORE INSERT ON reservas
            FOR EACH ROW
            BEGIN
                DECLARE next_num INT DEFAULT 0;
                DECLARE year_prefix VARCHAR(4) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
                DECLARE sucursal_prefijo VARCHAR(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
                DECLARE prefix_pattern VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
                
                IF NEW.numero_reserva IS NULL OR NEW.numero_reserva = '' OR NEW.numero_reserva LIKE 'BR-%' THEN
                    SELECT COALESCE(prefijo_reserva, 'BR') INTO sucursal_prefijo
                    FROM sucursales 
                    WHERE id = NEW.sucursal_id;
                    
                    IF sucursal_prefijo IS NULL OR sucursal_prefijo = '' THEN
                        SET sucursal_prefijo = 'BR';
                    END IF;
                    
                    SET year_prefix = CAST(YEAR(CURDATE()) AS CHAR);
                    SET prefix_pattern = CONCAT(sucursal_prefijo, '-', year_prefix, '-');
                    
                    SELECT COALESCE(MAX(CAST(SUBSTRING(numero_reserva, CHAR_LENGTH(prefix_pattern) + 1) AS UNSIGNED)), 0) + 1 
                    INTO next_num
                    FROM reservas 
                    WHERE numero_reserva LIKE CONCAT(prefix_pattern, '%') COLLATE utf8mb4_general_ci;
                    
                    SET NEW.numero_reserva = CONCAT(
                        prefix_pattern, 
                        LPAD(next_num, 4, '0')
                    );
                END IF;
            END;
        `);
        console.log("✅ Trigger 'trg_generar_numero_reserva_personalizado' actualizado con colación uniforme");

        // 4. Probar inserción simulada
        console.log("🧪 Probando inserción simulada de reserva...");
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const [result]: any = await conn.query(
                `INSERT INTO reservas 
                 (sucursal_id, nombre_cliente, telefono, codigo_pais, telefono_completo, fecha, hora, numero_personas, cantidad_ninos, cubiertos_reservados, estado) 
                 VALUES (1, 'Cliente Test Colation', '70000000', '591', '59170000000', CURDATE(), '19:00:00', 2, 0, 2, 'pendiente')`
            );

            const insertedId = result.insertId;
            const [rows]: any = await conn.query("SELECT id, sucursal_id, nombre_cliente, numero_reserva FROM reservas WHERE id = ?", [insertedId]);
            console.log("🎉 Reserva de prueba creada exitosamente:", rows[0]);

            await conn.rollback();
            console.log("✅ Rollback completado (la base de datos se mantiene limpia)");
        } catch (err: any) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }

        console.log("\n✨ ¡Reparación completada! Ya se pueden crear reservas sin ningún error.");
        process.exit(0);
    } catch (error: any) {
        console.error("❌ Error en la reparación:", error);
        process.exit(1);
    }
}

fixTriggers();
