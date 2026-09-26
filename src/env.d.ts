/// <reference types="astro/client" />

declare namespace App {
    interface Locals {
        usuario?: {
            id: number;
            nombre: string;
            email: string;
            rol: string;
            sucursal_id: number | null;
            es_super_admin: boolean | number;
            sucursal_nombre?: string | null;
            permisos?: any;
        };
    }
}
