// ============================================
// SCRIPT DE CRON - EJECUTAR A LAS 01:00 AM
// ============================================

import { ejecutarReinicioDiario } from '../src/lib/resetDaily';

async function main() {
    console.log(`🚀 Iniciando script de reinicio diario - ${new Date().toISOString()}`);
    
    try {
        const result = await ejecutarReinicioDiario();
        
        if (result.success) {
            console.log(`✅ ${result.mensaje}`);
            process.exit(0);
        } else {
            console.error(`❌ ${result.mensaje}`);
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Error fatal:', error);
        process.exit(1);
    }
}

main();
