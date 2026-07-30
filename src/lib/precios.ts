import { query } from './db';

// ============================================
// OBTENER PRECIO PARA UNA FECHA Y HORA
// ============================================

export async function getPrecioCubierto(
    sucursalId: number,
    fecha: string,
    hora: string
): Promise<{ precio_adulto: number; precio_nino: number; edad_minima: number; edad_maxima: number } | null> {
    const dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const fechaObj = new Date(fecha.includes('T') ? fecha : `${fecha}T12:00:00`);
    const diaSemana = dias[fechaObj.getDay()];
    
    // Determinar horario
    const horaNum = parseInt(hora.split(':')[0]);
    let horario = 'todo';
    if (horaNum >= 6 && horaNum < 12) horario = 'mañana';
    else if (horaNum >= 12 && horaNum < 18) horario = 'tarde';
    else if (horaNum >= 18 && horaNum < 24) horario = 'noche';
    
    // Buscar precio específico de horario o 'todo'
    const [precios] = await query(
        `SELECT precio_adulto, precio_nino, edad_minima_nino, edad_maxima_nino 
         FROM precios_cubiertos 
         WHERE sucursal_id = ? 
         AND dia_semana = ? 
         AND (horario = ? OR horario = 'todo')
         AND activo = TRUE
         ORDER BY horario = ? DESC, horario = 'todo' DESC
         LIMIT 1`,
        [sucursalId, diaSemana, horario, horario]
    ) as any[];

    const precio = precios?.[0];
    if (!precio) return null;

    return {
        precio_adulto: parseFloat(precio.precio_adulto),
        precio_nino: parseFloat(precio.precio_nino),
        edad_minima: precio.edad_minima_nino || 5,
        edad_maxima: precio.edad_maxima_nino || 10
    };
}

// ============================================
// VERIFICAR SI UN DÍA ES FESTIVO/FERIADO
// ============================================

export async function esDiaFestivo(sucursalId: number, fecha: string): Promise<{ esFestivo: boolean; descripcion?: string } | boolean> {
    const fechaLimpia = fecha.split('T')[0];
    const [rows] = await query(
        'SELECT id, descripcion, sin_reservas FROM dias_festivos WHERE sucursal_id = ? AND fecha = ? AND sin_reservas = TRUE',
        [sucursalId, fechaLimpia]
    ) as any[];
    const result = rows?.[0];
    if (result) {
        return { esFestivo: true, descripcion: result.descripcion };
    }
    return false;
}

// ============================================
// VERIFICAR SI SE PERMITEN RESERVAS
// ============================================

export async function permiteReservas(sucursalId: number, fecha: string): Promise<{ permite: boolean; motivo?: string }> {
    const dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const fechaLimpia = fecha.split('T')[0];
    const fechaObj = new Date(`${fechaLimpia}T12:00:00`);
    const diaSemana = dias[fechaObj.getDay()];
    
    // 1. Verificar si es domingo
    if (diaSemana === 'domingo') {
        return {
            permite: false,
            motivo: 'Los domingos trabajamos atendiendo por orden de llegada (SIN reservas).'
        };
    }
    
    // 2. Verificar si es día festivo/feriado
    const festivoCheck = await esDiaFestivo(sucursalId, fechaLimpia);
    if (typeof festivoCheck === 'object' && festivoCheck.esFestivo) {
        return {
            permite: false,
            motivo: `El día ${fechaLimpia} es feriado/festivo (${festivoCheck.descripcion || 'Día especial'}). Trabajamos atendiendo por orden de llegada (SIN reservas).`
        };
    }
    
    return { permite: true };
}

// ============================================
// OBTENER MENSAJE DE PRECIOS PARA MOSTRAR
// ============================================

export async function getMensajePrecios(sucursalId: number): Promise<string> {
    const [preciosRows] = await query(
        `SELECT dia_semana, horario, precio_adulto, precio_nino 
         FROM precios_cubiertos 
         WHERE sucursal_id = ? AND activo = TRUE
         ORDER BY 
           FIELD(dia_semana, 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'),
           FIELD(horario, 'mañana', 'tarde', 'noche', 'todo')`,
        [sucursalId]
    ) as any[];

    if (!preciosRows || preciosRows.length === 0) {
        return 'Consulte precios directamente con la sucursal.';
    }

    const diasMap: Record<string, any[]> = {};
    preciosRows.forEach((p: any) => {
        if (!diasMap[p.dia_semana]) diasMap[p.dia_semana] = [];
        diasMap[p.dia_semana].push(p);
    });

    let mensaje = `Te compartimos nuestros precios de cubierto por persona:\n\n`;
    
    // Lunes a Viernes
    mensaje += `De Lunes a Viernes:\n`;
    const laborables = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
    let precioLabAdulto = 190;
    let precioLabNino = 80;
    for (const dia of laborables) {
        if (diasMap[dia]?.[0]) {
            precioLabAdulto = parseFloat(diasMap[dia][0].precio_adulto);
            precioLabNino = parseFloat(diasMap[dia][0].precio_nino);
            break;
        }
    }
    mensaje += `• ${precioLabAdulto} Bs Adultos\n`;
    mensaje += `• ${precioLabNino} Bs Niños de 5 a 10 años.\n\n`;

    // Sábado
    if (diasMap['sabado']) {
        const sabado = diasMap['sabado'];
        sabado.forEach(p => {
            const horarioStr = p.horario === 'mañana' ? '(por la mañana)' : p.horario === 'noche' ? '(por la noche)' : '';
            mensaje += `Sábado ${horarioStr}:\n`;
            mensaje += `• ${parseFloat(p.precio_adulto)} Bs Adultos\n`;
            mensaje += `• ${parseFloat(p.precio_nino)} Bs Niños de 5 a 10 años.\n\n`;
        });
    }

    // Domingo
    if (diasMap['domingo']) {
        const p = diasMap['domingo'][0];
        mensaje += `Domingos, Feriados y días Festivos:\n`;
        mensaje += `• ${parseFloat(p.precio_adulto)} Bs Adultos\n`;
        mensaje += `• ${parseFloat(p.precio_nino)} Bs Niños de 5 a 10 años.\n\n`;
    }

    mensaje += `🔔 Le recordamos que DOMINGOS, DÍAS FESTIVOS Y FERIADOS trabajamos SIN reservas.`;

    return mensaje;
}
