# ============================================
# ETAPA 1: Instalar dependencias
# ============================================
FROM node:20-alpine AS deps
WORKDIR /app

# Copiar archivos de dependencias
COPY package.json package-lock.json ./
RUN npm ci

# ============================================
# ETAPA 2: Construir la aplicación
# ============================================
FROM node:20-alpine AS builder
WORKDIR /app

# Copiar dependencias y código fuente
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Construir la aplicación
RUN npm run build

# ============================================
# ETAPA 3: Ejecutar en producción
# ============================================
FROM node:20-alpine AS runtime
WORKDIR /app

# Variables de entorno
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

# Crear usuario no-root
RUN addgroup --system astro && adduser --system astro --ingroup astro

# Copiar archivos construidos
COPY --from=builder --chown=astro:astro /app/dist ./dist
COPY --from=deps --chown=astro:astro /app/node_modules ./node_modules

# ✅ AGREGAR: copiar public/ (uploads, favicon, etc.)
COPY --from=builder --chown=astro:astro /app/public ./public

# ⚠️ Importante: dar permisos de escritura al usuario astro en uploads
RUN mkdir -p /app/public/uploads/platos && \
    chown -R astro:astro /app/public

# Cambiar a usuario no-root
USER astro

# Puerto expuesto
EXPOSE 4321

# Comando de inicio
CMD ["node", "./dist/server/entry.mjs"]
