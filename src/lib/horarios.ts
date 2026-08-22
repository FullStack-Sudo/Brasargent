// ============================================
// CONFIGURACIÓN DE HORARIOS POR TURNO
// ============================================

export interface TurnoConfig {
    label: string;
    icono: string;
    hora_apertura: string;
    hora_cierre: string;
    hora_limite_reserva: string;
    paso_minutos: number;
    descripcion: string;
}

export const CONFIG_TURNOS: Record<string, TurnoConfig> = {
    'manana': {
        label: 'Turno Mañana',
        icono: '☀️',
        hora_apertura: '11:30',
        hora_cierre: '15:00',
        hora_limite_reserva: '14:30',
        paso_minutos: 30,
        descripcion: '11:30 AM - 2:30 PM'
    },
    'tarde': {
        label: 'Turno Tarde',
        icono: '🌙',
        hora_apertura: '18:30',
        hora_cierre: '22:00',
        hora_limite_reserva: '21:30',
        paso_minutos: 30,
        descripcion: '6:30 PM - 9:30 PM'
    }
};

// ============================================
// GENERAR HORAS DISPONIBLES POR TURNO
// ============================================

export function generarHorasTurno(turnoKey: string): string[] {
    const config = CONFIG_TURNOS[turnoKey];
    if (!config) return [];

    const inicio = new Date(`2000-01-01T${config.hora_apertura}`);
    const fin = new Date(`2000-01-01T${config.hora_limite_reserva}`);
    const paso = config.paso_minutos;
    
    const horas: string[] = [];
    let actual = new Date(inicio);
    
    while (actual <= fin) {
        horas.push(actual.toTimeString().substring(0, 5));
        actual.setMinutes(actual.getMinutes() + paso);
    }
    
    return horas;
}

// ============================================
// VALIDAR SI UNA HORA ES VÁLIDA PARA UN TURNO
// ============================================

export function validarHoraTurno(turnoKey: string, hora: string): boolean {
    const config = CONFIG_TURNOS[turnoKey];
    if (!config) return false;

    // Normalizar a formato HH:mm (ej: '11:30:00' -> '11:30')
    const horaLimpia = typeof hora === 'string' ? hora.substring(0, 5) : '';
    if (!horaLimpia) return false;

    const horaDate = new Date(`2000-01-01T${horaLimpia}`);
    const apertura = new Date(`2000-01-01T${config.hora_apertura}`);
    const limite = new Date(`2000-01-01T${config.hora_limite_reserva}`);
    
    return horaDate >= apertura && horaDate <= limite;
}

// ============================================
// OBTENER RANGO DE HORAS PARA MOSTRAR
// ============================================

export function getRangoHorario(turnoKey: string): string {
    const config = CONFIG_TURNOS[turnoKey];
    if (!config) return '';
    return `${config.hora_apertura} - ${config.hora_limite_reserva}`;
}

// ============================================
// AGRUPAR HORARIOS PARA TARJETAS DE SUCURSAL
// ============================================

export function agruparHorarios(horarios: any): string[] {
    if (!horarios) return ["Horario no configurado"];
    
    try {
        const h = typeof horarios === 'string' ? JSON.parse(horarios) : horarios;
        const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
        const diasNombres: Record<string, string> = { 
            lunes: 'Lunes', 
            martes: 'Martes', 
            miercoles: 'Miércoles', 
            jueves: 'Jueves', 
            viernes: 'Viernes', 
            sabado: 'Sábado', 
            domingo: 'Domingo' 
        };

        const listaDias = dias.map(d => {
            const info = h[d];
            let schedule = 'Cerrado';
            if (info && info.activo && info.bloques && info.bloques.length > 0) {
                schedule = info.bloques.map((b: any) => `${b.inicio} - ${b.fin}`).join(' y ');
            }
            return { dia: d, nombre: diasNombres[d], schedule };
        });

        const partes: string[] = [];
        let i = 0;

        while (i < listaDias.length) {
            const start = i;
            const currentSchedule = listaDias[start].schedule;

            while (i + 1 < listaDias.length && listaDias[i + 1].schedule === currentSchedule) {
                i++;
            }
            const end = i;

            let labelDia = '';
            if (start === end) {
                labelDia = `${listaDias[start].nombre}`;
            } else if (end === start + 1) {
                labelDia = `${listaDias[start].nombre} y ${listaDias[end].nombre}`;
            } else {
                labelDia = `${listaDias[start].nombre} a ${listaDias[end].nombre}`;
            }

            if (currentSchedule === 'Cerrado') {
                partes.push(`${labelDia}: Cerrado`);
            } else {
                partes.push(`${labelDia} : ${currentSchedule}.`);
            }

            i++;
        }

        return partes.length > 0 ? partes : ["Horario no configurado"];
    } catch (e) {
        return ["Horario no configurado"];
    }
}
