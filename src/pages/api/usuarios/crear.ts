import type { APIRoute } from 'astro';
import pool from '../../../lib/db';
import { hashPassword } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        console.log('1. Iniciando creación de usuario...');
        
        // Verificar sesión admin
        const session = cookies.get('session');
        if (!session || session.value !== 'authenticated') {
            console.log('2. Sesión no autorizada');
            return new Response(JSON.stringify({
                success: false,
                error: 'No autorizado'
            }), { status: 401 });
        }
        
        console.log('2. Sesión validada');
        
        // Obtener datos
        const data = await request.json();
        console.log('3. Datos recibidos:', data);
        
        const { 
            nombre, 
            apellido, 
            email, 
            telefono, 
            password, 
            rol, 
            sucursal_id 
        } = data;
        
        // Validar campos obligatorios
        if (!nombre || !email || !password || !rol) {
            console.log('4. Campos faltantes');
            return new Response(JSON.stringify({
                success: false,
                error: 'Todos los campos obligatorios deben ser completados'
            }), { status: 400 });
        }
        
        console.log('4. Validación aprobada');
        
        // Validar email único
        const [existenteData] = await pool.query(
            'SELECT id FROM usuarios WHERE email = ?',
            [email]
        ) as any[];
        
        if (existenteData.length > 0) {
            console.log('5. Email ya existe:', email);
            return new Response(JSON.stringify({
                success: false,
                error: 'El email ya está registrado'
            }), { status: 409 });
        }
        
        console.log('5. Email disponible');
        
        // Hash de la contraseña
        let hashedPassword: string;
        try {
            hashedPassword = await hashPassword(password);
            console.log('6. Contraseña hasheada correctamente');
        } catch (hashError) {
            console.error('Error al hashear contraseña:', hashError);
            return new Response(JSON.stringify({
                success: false,
                error: 'Error al procesar la contraseña'
            }), { status: 500 });
        }
        
        // Insertar usuario
        try {
            console.log('7. Insertando usuario...');
            // Parsear sucursal_id de string a número o dejarlo null
            const sucursalIdParsed = sucursal_id ? parseInt(sucursal_id, 10) : null;
            
            const [result] = await pool.query(
                `INSERT INTO usuarios 
                 (nombre, apellido, email, telefono, password, rol, sucursal_id) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    nombre, 
                    apellido || null, 
                    email, 
                    telefono || null, 
                    hashedPassword, 
                    rol, 
                    sucursalIdParsed
                ]
            ) as any[];
            console.log('8. Usuario creado con ID:', result.insertId);
            
            return new Response(JSON.stringify({
                success: true,
                mensaje: 'Usuario creado exitosamente',
                id: result.insertId
            }), { status: 201 });
            
        } catch (dbError: any) {
            console.error('Error en la base de datos:', dbError);
            return new Response(JSON.stringify({
                success: false,
                error: `Error en la base de datos: ${dbError.message || 'Error desconocido'}`
            }), { status: 500 });
        }
        
    } catch (error: any) {
        console.error('Error general:', error);
        return new Response(JSON.stringify({
            success: false,
            error: `Error interno: ${error.message || 'Error desconocido'}`
        }), { status: 500 });
    }
};
