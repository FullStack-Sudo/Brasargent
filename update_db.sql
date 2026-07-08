-- =============================================
-- ACTUALIZACIÓN DE BASE DE DATOS
-- SISTEMA DE RESERVAS INTELIGENTES
-- =============================================

-- 2. AGREGAR CAMPOS FALTANTES A RESERVAS (Ignorando errores si ya existen, por eso en bloques)
-- Nota: ya existen algunas columnas así que agregamos solo las nuevas si se puede
-- En MySQL estándar, si la columna ya existe, esto tirará error pero el script continuará si lo ejecutamos con -f
ALTER TABLE reservas ADD COLUMN fecha_confirmacion TIMESTAMP NULL;
ALTER TABLE reservas ADD COLUMN alerta_enviada BOOLEAN DEFAULT FALSE;

-- 3. CREAR TABLA CONFIGURACION_RESERVAS
CREATE TABLE IF NOT EXISTS configuracion_reservas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sucursal_id INT NOT NULL,
    capacidad_maxima INT DEFAULT 120,
    tiempo_alerta INT DEFAULT 10,
    tiempo_cancelacion_automatica INT DEFAULT 15,
    mensaje_recordatorio TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (sucursal_id) REFERENCES sucursales(id) ON DELETE CASCADE,
    UNIQUE KEY unique_sucursal (sucursal_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. INSERTAR CONFIGURACIÓN INICIAL
INSERT IGNORE INTO configuracion_reservas (sucursal_id, capacidad_maxima, tiempo_alerta, mensaje_recordatorio) VALUES 
(1, 120, 10, '¡Hola! Tu reserva en BRASARGENT está próxima. Te esperamos en 10 minutos.'),
(2, 80, 10, '¡Hola! Tu reserva en BRASARGENT está próxima. Te esperamos en 10 minutos.'),
(3, 100, 10, '¡Hola! Tu reserva en BRASARGENT está próxima. Te esperamos en 10 minutos.');

-- 5. ACTUALIZAR SUCURSALES CON CAPACIDAD INICIAL
UPDATE sucursales SET capacidad_total = 120, capacidad_actual = 0 WHERE id = 1;
UPDATE sucursales SET capacidad_total = 80, capacidad_actual = 0 WHERE id = 2;
UPDATE sucursales SET capacidad_total = 100, capacidad_actual = 0 WHERE id = 3;

-- 6. PROCEDIMIENTO PARA VERIFICAR DISPONIBILIDAD
DROP PROCEDURE IF EXISTS verificar_disponibilidad_reserva;
DELIMITER $$
CREATE PROCEDURE verificar_disponibilidad_reserva(
    IN p_sucursal_id INT,
    IN p_fecha DATE,
    IN p_hora TIME,
    IN p_personas INT,
    OUT p_disponible BOOLEAN,
    OUT p_capacidad_actual INT,
    OUT p_capacidad_maxima INT
)
BEGIN
    DECLARE v_capacidad_actual INT DEFAULT 0;
    DECLARE v_capacidad_maxima INT DEFAULT 0;
    
    -- Obtener capacidad actual de la sucursal
    SELECT capacidad_actual, capacidad_total 
    INTO v_capacidad_actual, v_capacidad_maxima
    FROM sucursales 
    WHERE id = p_sucursal_id;
    
    -- Calcular reservas confirmadas para ese día y hora
    SELECT COALESCE(SUM(numero_personas), 0) INTO v_capacidad_actual
    FROM reservas
    WHERE sucursal_id = p_sucursal_id
    AND fecha = p_fecha
    AND hora BETWEEN ADDTIME(p_hora, '-01:00:00') AND ADDTIME(p_hora, '01:00:00')
    AND estado = 'confirmada';
    
    -- Verificar si hay capacidad
    SET p_capacidad_actual = v_capacidad_actual;
    SET p_capacidad_maxima = v_capacidad_maxima;
    SET p_disponible = (v_capacidad_actual + p_personas) <= v_capacidad_maxima;
END$$
DELIMITER ;

-- 7. TRIGGER PARA ACTUALIZAR CAPACIDAD
DROP TRIGGER IF EXISTS trg_reservas_confirmadas;
DELIMITER $$
CREATE TRIGGER trg_reservas_confirmadas
AFTER UPDATE ON reservas
FOR EACH ROW
BEGIN
    IF NEW.estado = 'confirmada' AND OLD.estado != 'confirmada' THEN
        UPDATE sucursales 
        SET capacidad_actual = capacidad_actual + NEW.numero_personas
        WHERE id = NEW.sucursal_id;
    END IF;
    
    IF NEW.estado = 'cancelada' AND OLD.estado != 'cancelada' THEN
        UPDATE sucursales 
        SET capacidad_actual = capacidad_actual - NEW.numero_personas
        WHERE id = NEW.sucursal_id;
    END IF;
END$$
DELIMITER ;
