import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    for (const line of envConfig.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=');
            const val = valueParts.join('=').trim();
            if (key && val !== undefined) {
                process.env[key.trim()] = val.replace(/^["']|["']$/g, '');
            }
        }
    }
}

async function fixTriggerCollation() {
    try {
        const { query } = await import('../src/lib/db.ts');
        console.log('Actualizando trigger trg_generar_numero_reserva con soporte de Collation...');

        await query(`DROP TRIGGER IF EXISTS trg_generar_numero_reserva`);
        await query(`
            CREATE TRIGGER trg_generar_numero_reserva
            BEFORE INSERT ON reservas
            FOR EACH ROW
            BEGIN
                DECLARE next_num INT DEFAULT 0;
                DECLARE year_prefix VARCHAR(4);
                
                SET year_prefix = CAST(YEAR(CURDATE()) AS CHAR);
                
                SELECT COALESCE(MAX(CAST(SUBSTRING(numero_reserva, 9) AS UNSIGNED)), 0) + 1 
                INTO next_num
                FROM reservas 
                WHERE numero_reserva LIKE CONCAT('BR-', year_prefix, '-%') COLLATE utf8mb4_unicode_ci;
                
                IF NEW.numero_reserva IS NULL OR NEW.numero_reserva = '' THEN
                    SET NEW.numero_reserva = CONCAT(
                        'BR-', 
                        year_prefix, 
                        '-', 
                        LPAD(next_num, 4, '0')
                    );
                END IF;
            END;
        `);
        console.log('✅ Trigger trg_generar_numero_reserva actualizado sin conflictos de collation.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error actualizando trigger:', err);
        process.exit(1);
    }
}

fixTriggerCollation();
