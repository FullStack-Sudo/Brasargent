// ============================================
// LISTA DE DÍAS FERIADOS Y SIN RESERVAS
// ============================================

export const DIAS_FERIADOS: Record<string, string> = {
    '2026-01-01': 'Año Nuevo',
    '2026-02-02': 'Carnaval',
    '2026-02-03': 'Carnaval',
    '2026-02-04': 'Carnaval',
    '2026-04-02': 'Jueves Santo',
    '2026-04-03': 'Viernes Santo',
    '2026-05-01': 'Día del Trabajador',
    '2026-06-04': 'Corpus Christi',
    '2026-08-06': 'Día de la Independencia',
    '2026-09-24': 'Aniversario de Santa Cruz',
    '2026-11-02': 'Día de los Difuntos',
    '2026-12-25': 'Navidad'
};

// ============================================
// VERIFICAR SI ES DÍA SIN RESERVAS
// ============================================

export function esDiaSinReservas(fecha: string): { 
    esSinReservas: boolean; 
    motivo?: string;
} {
    if (!fecha) return { esSinReservas: false };

    const fechaLimpia = fecha.split('T')[0];
    const fechaObj = new Date(`${fechaLimpia}T12:00:00`);
    const diaSemana = fechaObj.getDay(); // 0 = Domingo
    
    // 1. Verificar si es domingo
    if (diaSemana === 0) {
        return { esSinReservas: true, motivo: 'Domingo' };
    }
    
    // 2. Verificar si es feriado
    if (DIAS_FERIADOS[fechaLimpia]) {
        return { 
            esSinReservas: true, 
            motivo: DIAS_FERIADOS[fechaLimpia] 
        };
    }
    
    return { esSinReservas: false };
}

// ============================================
// OBTENER MENSAJE PARA DÍA SIN RESERVAS
// ============================================

export function getMensajeDiaSinReservas(motivo: string): string {
    return `📋 Día Sin Reservas\n\nLos ${motivo.toLowerCase()}s trabajamos por orden de llegada (SIN reservas).\nTe esperamos con la mejor atención.`;
}
