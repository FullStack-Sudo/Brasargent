-- =============================================
-- INICIALIZACIÓN DE BASE DE DATOS - BRASARGENT
-- =============================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. TABLA SUCURSALES
CREATE TABLE IF NOT EXISTS sucursales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    direccion TEXT,
    telefono VARCHAR(20),
    prefijo_reserva VARCHAR(10) DEFAULT 'BR',
    capacidad_total INT DEFAULT 100,
    capacidad_actual INT DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar sucursales por defecto si no existen
INSERT IGNORE INTO sucursales (id, nombre, direccion, telefono, prefijo_reserva, capacidad_total, capacidad_actual) VALUES 
(1, 'Churrasquería BRASARGENT', 'Av. San Martín #123', '70000001', 'CHU', 120, 0),
(2, 'Fast Grill BRASARGENT', 'Calle Comercial #456', '70000002', 'FAS', 80, 0),
(3, 'Rodizio BRASARGENT', 'Av. Principal #789', '70000003', 'ROD', 100, 0);

-- 2. TABLA CONFIGURACION_RESERVAS
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

INSERT IGNORE INTO configuracion_reservas (sucursal_id, capacidad_maxima, tiempo_alerta, mensaje_recordatorio) VALUES 
(1, 120, 10, '¡Hola! Tu reserva en BRASARGENT está próxima. Te esperamos en 10 minutos.'),
(2, 80, 10, '¡Hola! Tu reserva en BRASARGENT está próxima. Te esperamos en 10 minutos.'),
(3, 100, 10, '¡Hola! Tu reserva en BRASARGENT está próxima. Te esperamos en 10 minutos.');

-- 3. TABLA CONFIGURACION_SISTEMA
CREATE TABLE IF NOT EXISTS configuracion_sistema (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clave VARCHAR(50) NOT NULL UNIQUE,
    valor VARCHAR(50) NOT NULL,
    tipo ENUM('boolean', 'text', 'number') DEFAULT 'boolean',
    descripcion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_clave (clave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO configuracion_sistema (clave, valor, tipo, descripcion) VALUES 
('modulo_reservas', 'true', 'boolean', 'Sistema de reservas completo'),
('modulo_cocina', 'false', 'boolean', 'Sistema de pedidos mesero → cocina'),
('modulo_menu', 'true', 'boolean', 'Gestión de menú por sucursal'),
('modulo_clientes', 'true', 'boolean', 'Gestión de clientes e historial');

-- 4. TABLA CLIENTES
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

-- 5. TABLA RESERVAS
CREATE TABLE IF NOT EXISTS reservas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    numero_reserva VARCHAR(50),
    sucursal_id INT NOT NULL,
    nombre_cliente VARCHAR(100) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    codigo_pais VARCHAR(10) DEFAULT '591',
    telefono_completo VARCHAR(50),
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    numero_personas INT NOT NULL DEFAULT 1,
    estado ENUM('pendiente', 'confirmada', 'cancelada', 'completada') DEFAULT 'pendiente',
    notas TEXT,
    fecha_confirmacion TIMESTAMP NULL,
    alerta_enviada BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (sucursal_id) REFERENCES sucursales(id) ON DELETE CASCADE,
    INDEX idx_sucursal_fecha (sucursal_id, fecha),
    INDEX idx_estado (estado),
    INDEX idx_numero_reserva (numero_reserva)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. TABLA USUARIOS (ADMIN / DASHBOARD)
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    rol ENUM('admin', 'operador', 'cocina') DEFAULT 'operador',
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar usuario administrador por defecto ($2a$10$... es bcrypt hash para 'admin123' o similar)
INSERT IGNORE INTO usuarios (id, usuario, password, nombre, rol) VALUES 
(1, 'admin', '$2a$10$7R.gI6rL8W6GgY/z9t48aeZ4pZ/wzQ1R.a70K2n91pW/v43R84i8.', 'Administrador', 'admin');

-- 7. TABLA LOGS_WHATSAPP
CREATE TABLE IF NOT EXISTS logs_whatsapp (
    id INT AUTO_INCREMENT PRIMARY KEY,
    destinatario VARCHAR(20) NOT NULL,
    mensaje TEXT NOT NULL,
    message_id VARCHAR(100),
    estado ENUM('enviado', 'entregado', 'leido', 'error', 'pendiente') DEFAULT 'pendiente',
    error TEXT,
    fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_destinatario (destinatario),
    INDEX idx_estado (estado),
    INDEX idx_fecha (fecha_envio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. TABLA PRECIOS_CUBIERTOS
CREATE TABLE IF NOT EXISTS precios_cubiertos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sucursal_id INT NOT NULL,
    dia_semana ENUM('lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo') NOT NULL,
    horario ENUM('mañana', 'tarde', 'noche', 'todo') DEFAULT 'todo',
    precio_adulto DECIMAL(10, 2) NOT NULL,
    precio_nino DECIMAL(10, 2) NOT NULL,
    edad_minima_nino INT DEFAULT 5,
    edad_maxima_nino INT DEFAULT 10,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (sucursal_id) REFERENCES sucursales(id) ON DELETE CASCADE,
    UNIQUE KEY unique_precio (sucursal_id, dia_semana, horario),
    INDEX idx_sucursal (sucursal_id),
    INDEX idx_dia (dia_semana)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. TABLA DIAS_FESTIVOS
CREATE TABLE IF NOT EXISTS dias_festivos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sucursal_id INT NOT NULL,
    fecha DATE NOT NULL,
    descripcion VARCHAR(100),
    sin_reservas BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sucursal_id) REFERENCES sucursales(id) ON DELETE CASCADE,
    UNIQUE KEY unique_fecha (sucursal_id, fecha),
    INDEX idx_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. TABLA VISITAS_IP
CREATE TABLE IF NOT EXISTS visitas_ip (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    fecha_visita TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ip (ip_address),
    INDEX idx_fecha (fecha_visita)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================
-- PROCEDIMIENTOS ALMACENADOS Y TRIGGERS
-- =============================================

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
    
    SELECT capacidad_actual, capacidad_total 
    INTO v_capacidad_actual, v_capacidad_maxima
    FROM sucursales 
    WHERE id = p_sucursal_id;
    
    SELECT COALESCE(SUM(numero_personas), 0) INTO v_capacidad_actual
    FROM reservas
    WHERE sucursal_id = p_sucursal_id
    AND fecha = p_fecha
    AND hora BETWEEN ADDTIME(p_hora, '-01:00:00') AND ADDTIME(p_hora, '01:00:00')
    AND estado = 'confirmada';
    
    SET p_capacidad_actual = v_capacidad_actual;
    SET p_capacidad_maxima = v_capacidad_maxima;
    SET p_disponible = (v_capacidad_actual + p_personas) <= v_capacidad_maxima;
END$$
DELIMITER ;

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

DROP TRIGGER IF EXISTS trg_reserva_cliente;
DELIMITER $$
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
END$$
DELIMITER ;
