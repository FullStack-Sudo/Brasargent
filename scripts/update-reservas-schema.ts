import pool from '../src/lib/db';

async function updateReservasSchema() {
    try {
        console.log("Iniciando actualización del esquema de la tabla 'reservas'...");
        
        // Ejecutar un script para modificar o agregar las columnas que falten
        const q1 = `
            ALTER TABLE reservas 
            MODIFY estado ENUM('pendiente', 'confirmada', 'rechazada', 'cancelada', 'completada') DEFAULT 'pendiente',
            ADD COLUMN IF NOT EXISTS fecha_solicitud TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ADD COLUMN IF NOT EXISTS fecha_confirmacion TIMESTAMP NULL,
            ADD COLUMN IF NOT EXISTS fecha_rechazo TIMESTAMP NULL,
            ADD COLUMN IF NOT EXISTS confirmado_por INT NULL,
            ADD COLUMN IF NOT EXISTS mensaje_admin TEXT,
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            ADD CONSTRAINT fk_confirmado_por FOREIGN KEY IF NOT EXISTS (confirmado_por) REFERENCES usuarios(id) ON DELETE SET NULL;
        `;
        
        // Algunos motores MySQL viejos o configuraciones no soportan ADD COLUMN IF NOT EXISTS
        // Lo haremos paso a paso manejando errores si la columna ya existe
        
        const alterStatements = [
            "ALTER TABLE reservas MODIFY estado ENUM('pendiente', 'confirmada', 'rechazada', 'cancelada', 'completada') DEFAULT 'pendiente';",
            "ALTER TABLE reservas ADD COLUMN fecha_solicitud TIMESTAMP DEFAULT CURRENT_TIMESTAMP;",
            "ALTER TABLE reservas ADD COLUMN fecha_confirmacion TIMESTAMP NULL;",
            "ALTER TABLE reservas ADD COLUMN fecha_rechazo TIMESTAMP NULL;",
            "ALTER TABLE reservas ADD COLUMN confirmado_por INT NULL;",
            "ALTER TABLE reservas ADD COLUMN mensaje_admin TEXT;",
            "ALTER TABLE reservas ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;",
            "ALTER TABLE reservas ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;",
            "ALTER TABLE reservas ADD CONSTRAINT fk_confirmado_por FOREIGN KEY (confirmado_por) REFERENCES usuarios(id) ON DELETE SET NULL;"
        ];
        
        for (const statement of alterStatements) {
            try {
                await pool.query(statement);
                console.log(`Ejecutado con éxito: ${statement.substring(0, 50)}...`);
            } catch (err: any) {
                if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
                    console.log(`Saltado (ya existe): ${statement.substring(0, 50)}...`);
                } else {
                    console.error(`Error en statement: ${statement}`, err);
                }
            }
        }
        
        console.log("Esquema actualizado correctamente.");
        process.exit(0);
    } catch (error) {
        console.error("Error global en la actualización:", error);
        process.exit(1);
    }
}

updateReservasSchema();
