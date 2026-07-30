export interface PrecioCubierto {
    id: number;
    sucursal_id: number;
    dia_semana: 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo';
    horario: 'mañana' | 'tarde' | 'noche' | 'todo';
    precio_adulto: number;
    precio_nino: number;
    edad_minima_nino: number;
    edad_maxima_nino: number;
    activo: boolean;
}

export interface DiaFestivo {
    id: number;
    sucursal_id: number;
    fecha: string;
    descripcion: string;
    sin_reservas: boolean;
}
