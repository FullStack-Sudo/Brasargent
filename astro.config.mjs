// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  security: {
    checkOrigin: false
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      watch: {
        // Carpetas que cambian constantemente (Docker/OpenWA, logs, DB)
        // y provocaban recargas infinitas del navegador
        ignored: [
          '**/openwa-data/**',
          '**/logs/**',
          '**/database/**',
          '**/nginx/**',
          '**/.git/**'
        ]
      }
    }
  }
});