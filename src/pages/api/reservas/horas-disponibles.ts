import type { APIRoute } from 'astro';
import pool from '../../../lib/db';

// Clasifica un bloque en turno según su hora de inicio (sin hardcode de sucursal)
function clasificarTurno(horaInicio: string): { tipo: string; label: string } {
    const [h] = horaInicio.split(':').map(Number);
    if (h >= 6 && h < 17)  return { tipo: 'manana', label: 'Turno Mañana' };
    if (h >= 17 && h < 20) return { tipo: 'tarde',  label: 'Turno Tarde'  };
    return                          { tipo: 'noche',  label: 'Turno Noche'  };
}

// Obtiene la fecha en Bolivia (America/La_Paz) YYYY-MM-DD
function obtenerFechaBolivia(date: Date): string {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/La_Paz',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const parts = formatter.formatToParts(date);
    const y = parts.find(p => p.type === 'year')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const d = parts.find(p => p.type === 'day')?.value;
    return `${y}-${m}-${d}`;
}

// Obtiene la hora en Bolivia (America/La_Paz) HH:mm
function obtenerHoraBolivia(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/La_Paz',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(date);
}

// Calcula la próxima fecha disponible (con horas disponibles en el futuro en intervalos de 15 min)
function calcularProximaFechaDisponible(horarios: any, dateNow: Date): string {
    // Revisar los próximos 14 días
    for (let i = 0; i < 14; i++) {
        const testDate = new Date(dateNow.getTime() + i * 24 * 60 * 60 * 1000);
        const dateStr = obtenerFechaBolivia(testDate);
        
        const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
        const testDateObj = new Date(dateStr + 'T12:00:00');
        const diaSemana = diasSemana[testDateObj.getDay()];
        const horarioDia = horarios[diaSemana] || { activo: false, bloques: [] };
        
        if (!horarioDia.activo || !horarioDia.bloques || horarioDia.bloques.length === 0) {
            continue;
        }
        
        let hasHours = false;
        // Si es hoy (i === 0), la hora debe ser al menos 30 min en el futuro
        const limitTime = i === 0 
            ? obtenerHoraBolivia(new Date(dateNow.getTime() + 30 * 60 * 1000))
            : '00:00';
            
        for (const bloque of horarioDia.bloques) {
            if (bloque.fin > limitTime) {
                const inicio = new Date(`2000-01-01T${bloque.inicio}`);
                const fin = new Date(`2000-01-01T${bloque.fin}`);
                let cur = new Date(inicio);
                while (cur < fin) {
                    const horaStr = cur.toTimeString().substring(0, 5);
                    if (horaStr >= limitTime) {
                        hasHours = true;
                        break;
                    }
                    cur.setMinutes(cur.getMinutes() + 15);
                }
            }
            if (hasHours) break;
        }
        
        if (hasHours) {
            return dateStr;
        }
    }
    return obtenerFechaBolivia(dateNow);
}

export const GET: APIRoute = async ({ url }) => {
    try {
        const sucursalId = url.searchParams.get('sucursal_id');
        const fecha = url.searchParams.get('fecha') || new Date().toISOString().split('T')[0];

        if (!sucursalId) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Sucursal requerida'
            }), { status: 400 });
        }

        // Obtener datos completos de la sucursal
        const [rows] = await pool.query(
            `SELECT
                nombre,
                horarios,
                permite_reservas,
                capacidad_total,
                (SELECT COALESCE(SUM(numero_personas), 0)
                 FROM reservas
                 WHERE sucursal_id = ?
                 AND fecha = ?
                 AND estado IN ('pendiente', 'confirmada')) AS ocupados_hoy
             FROM sucursales
             WHERE id = ?`,
            [sucursalId, fecha, sucursalId]
        ) as any[];

        const sucursal = rows[0];

        if (!sucursal) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Sucursal no encontrada'
            }), { status: 404 });
        }

        // Parsear horarios configurados por el Admin
        let horarios: any = {};
        try {
            horarios = typeof sucursal.horarios === 'string'
                ? JSON.parse(sucursal.horarios)
                : sucursal.horarios || {};
        } catch {
            horarios = {};
        }

        const now = new Date();
        const hoyBolivia = obtenerFechaBolivia(now);
        const proximaFecha = calcularProximaFechaDisponible(horarios, now);

        // Verificar si permite reservas
        if (!sucursal.permite_reservas) {
            return new Response(JSON.stringify({
                success: true,
                data: {
                    disponible: false,
                    permite_reservas: false,
                    mensaje: 'Esta sucursal no acepta reservas en este momento',
                    horas: [],
                    turnos: [],
                    proxima_fecha_disponible: proximaFecha
                }
            }));
        }

        // Si es fecha pasada
        if (fecha < hoyBolivia) {
            return new Response(JSON.stringify({
                success: true,
                data: {
                    sucursal_nombre: sucursal.nombre,
                    fecha,
                    dia: '',
                    disponible: false,
                    permite_reservas: true,
                    mensaje: 'No se pueden realizar reservas para fechas pasadas',
                    horas: [],
                    turnos: [],
                    capacidad_total: sucursal.capacidad_total || 120,
                    disponibles_hoy: 0,
                    proxima_fecha_disponible: proximaFecha
                }
            }));
        }

        // Obtener el día de la semana (con T12:00 para evitar problemas de timezone)
        const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
        const diasLabel  = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const fechaObj   = new Date(fecha + 'T12:00:00');
        const diaIdx     = fechaObj.getDay();
        const diaSemana  = diasSemana[diaIdx];
        const diaLabel   = diasLabel[diaIdx];

        // Verificar si el día está activo
        const horarioDia = horarios[diaSemana] || { activo: false, bloques: [] };
        const bloques    = horarioDia.activo ? (horarioDia.bloques || []) : [];

        if (bloques.length === 0 || !horarioDia.activo) {
            return new Response(JSON.stringify({
                success: true,
                data: {
                    sucursal_nombre: sucursal.nombre,
                    fecha,
                    dia: diaLabel,
                    disponible: false,
                    permite_reservas: true,
                    mensaje: `La sucursal está cerrada los ${diaLabel}`,
                    horas: [],
                    turnos: [],
                    capacidad_total: sucursal.capacidad_total || 120,
                    disponibles_hoy: 0,
                    proxima_fecha_disponible: proximaFecha
                }
            }));
        }

        const capacidadTotal = sucursal.capacidad_total || 120;
        const ocupadosHoy    = sucursal.ocupados_hoy || 0;

        // Hora límite de hoy (hora actual + 30 min)
        const limitTimeStr = fecha === hoyBolivia 
            ? obtenerHoraBolivia(new Date(now.getTime() + 30 * 60 * 1000))
            : '00:00';

        // Construir turnos: para cada bloque del admin, generar horas en intervalos de 15 minutos
        const horasFlat: any[] = [];
        const turnosMap: Map<string, any> = new Map();
        let turnoCounter = 1;

        for (const bloque of bloques) {
            // Clasificar según la hora de inicio configurada por el admin
            const { tipo, label } = clasificarTurno(bloque.inicio);

            // Solo procesar si el bloque termina después del límite de tiempo
            if (bloque.fin <= limitTimeStr) {
                continue;
            }

            // Inicializar turno si no existe aún
            if (!turnosMap.has(tipo)) {
                turnosMap.set(tipo, {
                    id: turnoCounter++,
                    tipo,
                    label,
                    inicio: bloque.inicio,
                    fin:    bloque.fin,
                    horas:  [],
                    disponibilidad: 0,
                    disponible: false
                });
            } else {
                const t = turnosMap.get(tipo);
                if (bloque.fin > t.fin) t.fin = bloque.fin;
            }

            const inicio = new Date(`2000-01-01T${bloque.inicio}`);
            const fin    = new Date(`2000-01-01T${bloque.fin}`);
            let cur      = new Date(inicio);

            while (cur < fin) {
                const horaStr = cur.toTimeString().substring(0, 5);

                // Si es hoy, saltar horas en el pasado
                if (horaStr < limitTimeStr) {
                    cur.setMinutes(cur.getMinutes() + 15);
                    continue;
                }

                // Consulta de ocupación por hora específica
                const [reservasEnHora] = await pool.query(
                    `SELECT COALESCE(SUM(numero_personas), 0) as total
                     FROM reservas
                     WHERE sucursal_id = ?
                     AND fecha = ?
                     AND hora = ?
                     AND estado IN ('pendiente', 'confirmada')`,
                    [sucursalId, fecha, horaStr]
                ) as any[];

                const ocupadosEnHora  = (reservasEnHora as any)[0]?.total || 0;
                const disponibleHora  = Math.max(0, capacidadTotal - ocupadosEnHora);
                const isReservable    = disponibleHora > 0;

                const horaObj = {
                    hora: horaStr,
                    disponible: isReservable,
                    disponibles: disponibleHora,
                    isReservable
                };

                horasFlat.push(horaObj);
                turnosMap.get(tipo)!.horas.push(horaObj);

                cur.setMinutes(cur.getMinutes() + 15);
            }
        }

        // Calcular disponibilidad por turno
        const turnos: any[] = [];
        for (const [, turno] of turnosMap) {
            const totalHoras        = turno.horas.length;
            // Si el turno quedó sin horas hábiles para hoy, no lo incluimos
            if (totalHoras === 0) continue;
            
            const horasDisponibles  = turno.horas.filter((h: any) => h.isReservable).length;
            turno.disponibilidad    = totalHoras > 0 ? Math.round((horasDisponibles / totalHoras) * 100) : 0;
            turno.disponible        = horasDisponibles > 0;
            turnos.push(turno);
        }

        const disponible = horasFlat.some(h => h.isReservable);
        const disponibles_hoy = Math.max(0, capacidadTotal - ocupadosHoy);

        return new Response(JSON.stringify({
            success: true,
            data: {
                sucursal_nombre: sucursal.nombre,
                fecha,
                dia: diaLabel,
                disponible,
                permite_reservas: true,
                mensaje: disponible
                    ? 'Horas disponibles para reservar'
                    : (fecha === hoyBolivia ? 'Ya no hay horarios disponibles para hoy, elegí otra fecha' : 'No hay cupos disponibles para este día'),
                horas: horasFlat,
                turnos,
                capacidad_total: capacidadTotal,
                ocupados_hoy: ocupadosHoy,
                disponibles_hoy,
                proxima_fecha_disponible: proximaFecha
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('Error al obtener horas disponibles:', error);
        let errorMsg = error.message || 'Error al obtener horas disponibles';
        if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('connect')) {
            errorMsg = 'El servicio de reservas no está disponible en este momento';
        }
        return new Response(JSON.stringify({
            success: false,
            error: errorMsg
        }), { status: 500 });
    }
};
