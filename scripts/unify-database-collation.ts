import pool from '../src/lib/db';

async function unifyDatabaseCollation() {
    try {
        console.log("🌐 Unificando la colación de toda la base de datos a utf8mb4_unicode_ci...");

        // 1. Cambiar colación por defecto de la base de datos
        await pool.query("ALTER DATABASE brasargent CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");

        // 2. Obtener todas las tablas de la base de datos
        const [tables]: any = await pool.query("SHOW TABLES");
        const tableKey = Object.keys(tables[0])[0];
        
        for (const row of tables) {
            const tableName = row[tableKey];
            console.log(`Converting table '${tableName}' to utf8mb4_unicode_ci...`);
            try {
                await pool.query(`ALTER TABLE \`${tableName}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
            } catch (err: any) {
                console.warn(`Warning converting '${tableName}':`, err.message);
            }
        }

        console.log("✅ Todas las tablas unificadas a utf8mb4_unicode_ci");

        // 3. Eliminar triggers antiguos/conflictivos
        await pool.query("DROP TRIGGER IF EXISTS trg_generar_numero_reserva;");
        await pool.query("DROP TRIGGER IF EXISTS trg_generar_numero_reserva_personalizado;");

        // 4. Recrear el trigger con utf8mb4_unicode_ci
        await pool.query(`
            CREATE TRIGGER trg_generar_numero_reserva_personalizado
            BEFORE INSERT ON reservas
            FOR EACH ROW
            BEGIN
                DECLARE next_num INT DEFAULT 0;
                DECLARE year_prefix VARCHAR(4) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
                DECLARE sucursal_prefijo VARCHAR(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
                DECLARE prefix_pattern VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
                
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
                    WHERE numero_reserva LIKE CONCAT(prefix_pattern, '%');
                    
                    SET NEW.numero_reserva = CONCAT(
                        prefix_pattern, 
                        LPAD(next_num, 4, '0')
                    );
                END IF;
            END;
        `);
        console.log("✅ Trigger 'trg_generar_numero_reserva_personalizado' recreado exitosamente");

        // 5. Probar inserción simulada
        console.log("🧪 Probando inserción simulada de reserva...");
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const [result]: any = await conn.query(
                `INSERT INTO reservas 
                 (sucursal_id, nombre_cliente, telefono, codigo_pais, telefono_completo, fecha, hora, numero_personas, cantidad_ninos, cubiertos_reservados, estado) 
                 VALUES (1, 'Cliente Test Unificado', '70000000', '591', '59170000000', CURDATE(), '19:00:00', 2, 0, 2, 'pendiente')`
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

        console.log("\n✨ ¡Toda la base de datos fue unificada y reparada exitosamente!");
        process.exit(0);
    } catch (error: any) {
        console.error("❌ Error al unificar la base de datos:", error);
        process.exit(1);
    }
}

unifyDatabaseCollation();
