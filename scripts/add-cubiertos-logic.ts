import pool from '../src/lib/db';

async function executeMigration() {
    try {
        console.log("Checking DB schema...");
        
        // Check columns in sucursales
        const [sucColumns]: any = await pool.query(`SHOW COLUMNS FROM sucursales`);
        const sucColNames = sucColumns.map((c: any) => c.Field);
        
        if (!sucColNames.includes('capacidad_total')) {
            await pool.query(`ALTER TABLE sucursales ADD COLUMN capacidad_total INT DEFAULT 120`);
        }
        if (!sucColNames.includes('cubiertos_disponibles')) {
            await pool.query(`ALTER TABLE sucursales ADD COLUMN cubiertos_disponibles INT DEFAULT 120`);
        }
        if (!sucColNames.includes('cubiertos_ocupados')) {
            await pool.query(`ALTER TABLE sucursales ADD COLUMN cubiertos_ocupados INT DEFAULT 0`);
        }

        console.log("Updating sucursales data...");
        await pool.query(`
            UPDATE sucursales SET 
                capacidad_total = 120,
                cubiertos_disponibles = 120,
                cubiertos_ocupados = 0
            WHERE id IN (1, 2, 3)
        `);

        // Check columns in reservas
        const [resColumns]: any = await pool.query(`SHOW COLUMNS FROM reservas`);
        const resColNames = resColumns.map((c: any) => c.Field);

        if (!resColNames.includes('cubiertos_reservados')) {
            await pool.query(`ALTER TABLE reservas ADD COLUMN cubiertos_reservados INT DEFAULT 0`);
        }
        if (!resColNames.includes('fecha_aprobacion')) {
            await pool.query(`ALTER TABLE reservas ADD COLUMN fecha_aprobacion TIMESTAMP NULL`);
        }
        if (!resColNames.includes('fecha_cancelacion')) {
            await pool.query(`ALTER TABLE reservas ADD COLUMN fecha_cancelacion TIMESTAMP NULL`);
        }
        if (!resColNames.includes('cancelado_por')) {
            await pool.query(`ALTER TABLE reservas ADD COLUMN cancelado_por INT NULL`);
        }

        console.log("Adding indexes...");
        try {
            await pool.query(`CREATE INDEX idx_cubiertos ON reservas(cubiertos_reservados)`);
            console.log("Index idx_cubiertos added");
        } catch(e: any) {
            if (!e.message.includes("Duplicate key name")) console.error(e.message);
        }

        try {
            await pool.query(`CREATE INDEX idx_estado_fecha ON reservas(estado, fecha)`);
            console.log("Index idx_estado_fecha added");
        } catch(e: any) {
            if (!e.message.includes("Duplicate key name")) console.error(e.message);
        }

        console.log("Recreating trigger...");
        await pool.query(`DROP TRIGGER IF EXISTS trg_reserva_aprobar`);
        
        await pool.query(`
        CREATE TRIGGER trg_reserva_aprobar
        AFTER UPDATE ON reservas
        FOR EACH ROW
        BEGIN
            -- Si la reserva cambia de pendiente a confirmada
            IF NEW.estado = 'confirmada' AND OLD.estado = 'pendiente' THEN
                -- Restar cubiertos de la sucursal
                UPDATE sucursales 
                SET 
                    cubiertos_ocupados = cubiertos_ocupados + NEW.cubiertos_reservados,
                    cubiertos_disponibles = cubiertos_disponibles - NEW.cubiertos_reservados
                WHERE id = NEW.sucursal_id;
                
                -- Registrar en logs
                INSERT INTO logs_actividad (usuario_id, accion, tabla_afectada, registro_id, detalles)
                VALUES (1, 'RESERVA_APROBADA', 'reservas', NEW.id, 
                        JSON_OBJECT('cubiertos', NEW.cubiertos_reservados, 
                                   'sucursal', NEW.sucursal_id));
            END IF;
            
            -- Si la reserva se cancela (estado = cancelada)
            IF NEW.estado = 'cancelada' AND OLD.estado != 'cancelada' THEN
                -- Liberar cubiertos
                UPDATE sucursales 
                SET 
                    cubiertos_ocupados = GREATEST(0, cubiertos_ocupados - OLD.cubiertos_reservados),
                    cubiertos_disponibles = LEAST(capacidad_total, cubiertos_disponibles + OLD.cubiertos_reservados)
                WHERE id = NEW.sucursal_id;
                
                -- Registrar en logs
                INSERT INTO logs_actividad (usuario_id, accion, tabla_afectada, registro_id, detalles)
                VALUES (1, 'RESERVA_CANCELADA', 'reservas', NEW.id,
                        JSON_OBJECT('cubiertos', OLD.cubiertos_reservados,
                                   'sucursal', NEW.sucursal_id));
            END IF;
            
            -- Si la reserva es rechazada
            IF NEW.estado = 'rechazada' AND OLD.estado = 'pendiente' THEN
                -- No se restan cubiertos porque nunca fueron ocupados
                INSERT INTO logs_actividad (usuario_id, accion, tabla_afectada, registro_id, detalles)
                VALUES (1, 'RESERVA_RECHAZADA', 'reservas', NEW.id,
                        JSON_OBJECT('motivo', NEW.mensaje_admin));
            END IF;
        END;
        `);

        console.log("Migration completed successfully!");
        process.exit(0);
    } catch (e) {
        console.error("Migration failed:", e);
        process.exit(1);
    }
}

executeMigration();
