import pool from './src/lib/db.ts';

async function setup() {
    try {
        await pool.query(`
        CREATE TABLE IF NOT EXISTS clientes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nombre VARCHAR(100) NOT NULL,
            telefono VARCHAR(20) NOT NULL,
            codigo_pais VARCHAR(10) DEFAULT '591',
            telefono_completo VARCHAR(50),
            email VARCHAR(100),
            fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ultima_reserva DATE,
            total_reservas INT DEFAULT 0,
            notas TEXT,
            activo BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_telefono (telefono),
            INDEX idx_nombre (nombre),
            UNIQUE KEY unique_telefono (telefono_completo)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log("Tabla clientes creada");

        await pool.query(`DROP TRIGGER IF EXISTS trg_reserva_cliente;`);
        
        await pool.query(`
        CREATE TRIGGER trg_reserva_cliente
        AFTER INSERT ON reservas
        FOR EACH ROW
        BEGIN
            DECLARE cliente_existe INT DEFAULT 0;
            
            SELECT COUNT(*) INTO cliente_existe 
            FROM clientes 
            WHERE telefono = NEW.telefono AND codigo_pais = NEW.codigo_pais;
            
            IF cliente_existe > 0 THEN
                UPDATE clientes 
                SET 
                    nombre = NEW.nombre_cliente,
                    ultima_reserva = NEW.fecha,
                    total_reservas = total_reservas + 1,
                    updated_at = NOW()
                WHERE telefono = NEW.telefono AND codigo_pais = NEW.codigo_pais;
            ELSE
                INSERT INTO clientes (
                    nombre, 
                    telefono, 
                    codigo_pais, 
                    telefono_completo,
                    ultima_reserva,
                    total_reservas
                ) VALUES (
                    NEW.nombre_cliente,
                    NEW.telefono,
                    NEW.codigo_pais,
                    NEW.telefono_completo,
                    NEW.fecha,
                    1
                );
            END IF;
        END;
        `);
        console.log("Trigger creado");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
setup();
