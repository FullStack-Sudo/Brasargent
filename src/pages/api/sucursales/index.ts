import type { APIRoute } from 'astro';
import pool from '../../../lib/db';

export const GET: APIRoute = async ({ request }) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
          id,
          nombre,
          concepto,
          rating,
          resenas,
          direccion,
          horarios,
          telefono,
          capacidad_total as capacidadTotal,
          COALESCE(cubiertos_disponibles, capacidad_total) AS cubiertosDisponibles,
          COALESCE(cubiertos_ocupados, 0) AS cubiertosOcupados,
          permite_reservas as permiteReservas,
          permite_cubiertos as permiteCubiertos,
          activo
      FROM sucursales
      WHERE activo = 1
      ORDER BY nombre
    `) as any[];

    // Parse schedules strings if they are JSON, etc.
    const sucursales = rows.map((s: any) => {
      let latitud = 0;
      let longitud = 0;
      
      if (s.nombre.includes('Churrasquería')) {
        latitud = -17.7444324;
        longitud = -63.1670063;
      } else if (s.nombre.includes('Fast Grill')) {
        latitud = -17.7715901;
        longitud = -63.2037068;
      } else if (s.nombre.includes('Rodizio')) {
        latitud = -17.7718554;
        longitud = -63.2035540;
      }

      return {
        id: s.id,
        nombre: s.nombre,
        concepto: s.concepto || 'Restaurante',
        direccion: s.direccion || '',
        telefono: s.telefono || '',
        rating: s.rating || 4.5,
        resenas: s.resenas || 0,
        capacidadTotal: s.capacidadTotal || 0,
        cubiertosDisponibles: s.cubiertosDisponibles || 0,
        cubiertosOcupados: s.cubiertosOcupados || 0,
        permiteReservas: s.permiteReservas === 1,
        permiteCubiertos: s.permiteCubiertos === 1,
        activo: s.activo === 1,
        latitud: latitud,
        longitud: longitud
      };
    });

    return new Response(JSON.stringify(sucursales), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in GET /api/sucursales:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};
