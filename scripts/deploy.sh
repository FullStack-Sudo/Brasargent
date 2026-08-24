#!/bin/bash
# ============================================
# DEPLOY SCRIPT - BRASARGENT
# ============================================

set -e

echo "🚀 Desplegando BRASARGENT..."

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Verificar Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker no está instalado${NC}"
    exit 1
fi

# Verificar Docker Compose (Soporta 'docker-compose' y 'docker compose')
COMPOSE_CMD=""
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    echo -e "${RED}❌ Docker Compose no está instalado${NC}"
    exit 1
fi

# 1. Construir imagen
echo -e "${GREEN}📦 Construyendo imagen Docker...${NC}"
$COMPOSE_CMD build

# 2. Detener contenedores existentes
echo -e "${GREEN}🛑 Deteniendo contenedores existentes...${NC}"
$COMPOSE_CMD down || true

# 3. Iniciar servicios
echo -e "${GREEN}🚀 Iniciando servicios...${NC}"
$COMPOSE_CMD up -d

# 4. Verificar estado
echo -e "${GREEN}✅ Verificando estado...${NC}"
sleep 5

# Verificar contenedores
if $COMPOSE_CMD ps | grep -q -E "Up|running"; then
    echo -e "${GREEN}✅ BRASARGENT desplegado exitosamente${NC}"
    echo -e "${GREEN}🌐 App: http://localhost:4321${NC}"
    echo -e "${GREEN}📱 OpenWA: http://localhost:2785${NC}"
else
    echo -e "${RED}❌ Error en el despliegue${NC}"
    $COMPOSE_CMD logs
    exit 1
fi
