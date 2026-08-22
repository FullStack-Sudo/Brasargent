import pool from '../src/lib/db';

async function setupPrefijosSucursales() {
    try {
        console.log("🚀 Configurando prefijos de reserva por sucursal...");

        // 1. Agregar columna prefijo_reserva si no existe
        try {
            await pool.query("ALTER TABLE sucursales ADD COLUMN prefijo_reserva VARCHAR(10) DEFAULT 'BR';");
            console.log("✅ Columna prefijo_reserva agregada a sucursales");
        } catch (err: any) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log("ℹ️ La columna prefijo_reserva ya existe en sucursales");
            } else {
                console.error("⚠️ Error al agregar columna:", err.message);
            }
        }

        // 2. Actualizar prefijos de sucursales según el nombre
        const updates = [
            { prefijo: 'CHU', match: '%Churrasquer%'},
            { prefijo: 'FAS', match: '%Fast Grill%' },
            { prefijo: 'ROD', match: '%Rodizio%' }
        ];

        for (const u of updates) {
            const [res] = await pool.query(
                "UPDATE sucursales SET prefijo_reserva = ? WHERE nombre LIKE ?",
                [u.prefijo, u.match]
            ) as any[];
            console.log(`✅ Sucursal (${u.match}) actualizada con prefijo '${u.prefijo}': ${res.affectedRows || 0} filas`);
        }

        // 3. Crear función de generación de reserva en MySQL (opcional/fallback seguro)
        try {
            await pool.query("DROP FUNCTION IF EXISTS generar_numero_reserva_por_sucursal;");
            await pool.query(`
                CREATE FUNCTION generar_numero_reserva_por_sucursal(
                    p_sucursal_id INT
                ) 
                RETURNS VARCHAR(20)
                DETERMINISTIC
                BEGIN
                    DECLARE next_num INT DEFAULT 0;
                    DECLARE year_prefix VARCHAR(4);
                    DECLARE sucursal_prefijo VARCHAR(10);
                    DECLARE numero VARCHAR(20);
                    
                    SELECT prefijo_reserva INTO sucursal_prefijo
                    FROM sucursales 
                    WHERE id = p_sucursal_id;
                    
                    IF sucursal_prefijo IS NULL THEN
                        SET sucursal_prefijo = 'BR';
                    END IF;
                    
                    SET year_prefix = YEAR(CURDATE());
                    
                    SELECT COALESCE(MAX(CAST(SUBSTRING(numero_reserva, 9) AS UNSIGNED)), 0) + 1 
                    INTO next_num
                    FROM reservas 
                    WHERE numero_reserva LIKE CONCAT(sucursal_prefijo, '-', year_prefix, '-%');
                    
                    SET numero = CONCAT(
                        sucursal_prefijo, 
                        '-', 
                        year_prefix, 
                        '-', 
                        LPAD(next_num, 4, '0')
                    );
                    
                    RETURN numero;
                END;
            `);
            console.log("✅ Función MySQL generar_numero_reserva_por_sucursal creada exitosamente");
        } catch (err: any) {
            console.warn("⚠️ No se pudo crear la función MySQL (se usará el generador Node.js en su lugar):", err.message);
        }

        // 4. Crear trigger en MySQL (opcional/fallback seguro)
        try {
            await pool.query("DROP TRIGGER IF EXISTS trg_generar_numero_reserva_personalizado;");
            await pool.query(`
                CREATE TRIGGER trg_generar_numero_reserva_personalizado
                BEFORE INSERT ON reservas
                FOR EACH ROW
                BEGIN
                    DECLARE next_num INT DEFAULT 0;
                    DECLARE year_prefix VARCHAR(4);
                    DECLARE sucursal_prefijo VARCHAR(10);
                    
                    IF NEW.numero_reserva IS NULL OR NEW.numero_reserva = '' OR NEW.numero_reserva LIKE 'BR-%' THEN
                        SELECT prefijo_reserva INTO sucursal_prefijo
                        FROM sucursales 
                        WHERE id = NEW.sucursal_id;
                        
                        IF sucursal_prefijo IS NULL THEN
                            SET sucursal_prefijo = 'BR';
                        END IF;
                        
                        SET year_prefix = YEAR(CURDATE());
                        
                        SELECT COALESCE(MAX(CAST(SUBSTRING(numero_reserva, 9) AS UNSIGNED)), 0) + 1 
                        INTO next_num
                        FROM reservas 
                        WHERE numero_reserva LIKE CONCAT(sucursal_prefijo, '-', year_prefix, '-%');
                        
                        SET NEW.numero_reserva = CONCAT(
                            sucursal_prefijo, 
                            '-', 
                            year_prefix, 
                            '-', 
                            LPAD(next_num, 4, '0')
                        );
                    END IF;
                END;
            `);
            console.log("✅ Trigger MySQL trg_generar_numero_reserva_personalizado creado exitosamente");
        } catch (err: any) {
            console.warn("⚠️ No se pudo crear el trigger MySQL (se usará la lógica Node.js en su lugar):", err.message);
        }

        // 5. Migrar números de reservas existentes que tengan NULL o BR-%
        console.log("🔄 Migrando números de reservas existentes...");
        const [reservas] = await pool.query(
            `SELECT r.id, r.sucursal_id, s.prefijo_reserva
             FROM reservas r
             JOIN sucursales s ON r.sucursal_id = s.id
             WHERE r.numero_reserva IS NULL 
                OR r.numero_reserva = '' 
                OR r.numero_reserva LIKE 'BR-%'
             ORDER BY r.id ASC`
        ) as any[];

        if (Array.isArray(reservas) && reservas.length > 0) {
            const year = new Date().getFullYear();
            const contadores: Record<string, number> = {};

            for (const r of reservas) {
                const prefijo = r.prefijo_reserva || 'BR';
                if (!contadores[prefijo]) {
                    // Obtener el max número actual para este prefijo
                    const [maxRes] = await pool.query(
                        `SELECT MAX(CAST(SUBSTRING(numero_reserva, 9) AS UNSIGNED)) as max_num
                         FROM reservas 
                         WHERE numero_reserva LIKE CONCAT(?, '-', ?, '-%')`,
                        [prefijo, year]
                    ) as any[];
                    contadores[prefijo] = (maxRes && maxRes[0]?.max_num) ? maxRes[0].max_num : 0;
                }

                contadores[prefijo]++;
                const numSecuencia = String(contadores[prefijo]).padStart(4, '0');
                const nuevoCodigo = `${prefijo}-${year}-${numSecuencia}`;

                await pool.query(
                    `UPDATE reservas SET numero_reserva = ? WHERE id = ?`,
                    [nuevoCodigo, r.id]
                );
            }
            console.log(`✅ ${reservas.length} reservas migradas a los nuevos prefijos por sucursal`);
        } else {
            console.log("ℹ️ No hay reservas pendientes de migración");
        }

        // 6. Verificar resultado
        const [sucursalesRes] = await pool.query("SELECT id, nombre, prefijo_reserva FROM sucursales") as any[];
        console.log("\n📋 Sucursales actuales:");
        console.table(sucursalesRes);

        const [reservasSample] = await pool.query("SELECT id, sucursal_id, nombre_cliente, numero_reserva FROM reservas ORDER BY id DESC LIMIT 10") as any[];
        console.log("\n📋 Últimas 10 reservas:");
        console.table(reservasSample);

        console.log("\n✨ Proceso de configuración completado exitosamente.");
        process.exit(0);
    } catch (error: any) {
        console.error("❌ Error en la configuración:", error);
        process.exit(1);
    }
}

setupPrefijosSucursales();
