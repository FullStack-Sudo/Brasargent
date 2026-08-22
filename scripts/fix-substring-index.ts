import pool from '../src/lib/db';

async function fixSubstringIndex() {
    try {
        console.log("🛠️ Corrigiendo cálculo de secuencia y datos...");

        // 1. Eliminar o corregir la reserva 65 corrupta
        await pool.query("DELETE FROM reservas WHERE id = 65 OR numero_reserva LIKE '%18446744%';");
        console.log("✅ Reserva con número corrupto eliminada");

        // 2. Recrear Trigger con CHAR_LENGTH(prefix_pattern) + 1 (empezando en el carácter 10)
        await pool.query("DROP TRIGGER IF EXISTS trg_generar_numero_reserva;");
        await pool.query("DROP TRIGGER IF EXISTS trg_generar_numero_reserva_personalizado;");

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
        console.log("✅ Trigger MySQL corregido con índice exacto (carácter 10)");

        // 3. Verificar estado actual de reservas
        const [rows]: any = await pool.query("SELECT id, sucursal_id, nombre_cliente, numero_reserva FROM reservas");
        console.table(rows);

        process.exit(0);
    } catch (err: any) {
        console.error("❌ Error al corregir:", err);
        process.exit(1);
    }
}

fixSubstringIndex();
