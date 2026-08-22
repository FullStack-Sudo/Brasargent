import { verificarReservasParaLiberar } from '../src/lib/liberacion-cubiertos';

async function main() {
    console.log(`🚀 Ejecutando liberación automática - ${new Date().toISOString()}`);
    
    try {
        await verificarReservasParaLiberar();
        console.log('✅ Liberación automática completada exitosamente');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error en liberación automática:', error);
        process.exit(1);
    }
}

main();
