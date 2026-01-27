#!/bin/bash

# GodNotes Production Deployment Script

set -e

echo "🚀 Starting GodNotes production deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running on the target server
if [[ "$HOSTNAME" != "89.208.14.253" ]]; then
    echo -e "${YELLOW}⚠️  Warning: This script should be run on the production server (89.208.14.253)${NC}"
fi

# Load environment variables
if [ -f ".env.production" ]; then
    export $(cat .env.production | xargs)
    echo -e "${GREEN}✅ Environment variables loaded${NC}"
else
    echo -e "${RED}❌ .env.production file not found${NC}"
    exit 1
fi

# Create necessary directories
mkdir -p backups
mkdir -p logs

echo -e "${YELLOW}📦 Pulling latest changes from GitHub...${NC}"
git pull origin main

echo -e "${YELLOW}🐳 Deploying with Docker Compose...${NC}"
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d

# Wait for PostgreSQL to be ready
echo -e "${YELLOW}⏳ Waiting for PostgreSQL to be ready...${NC}"
sleep 10

# Check if containers are running
if docker ps | grep -q "godnotes-postgres"; then
    echo -e "${GREEN}✅ PostgreSQL container is running${NC}"
else
    echo -e "${RED}❌ PostgreSQL container failed to start${NC}"
    docker logs godnotes-postgres
    exit 1
fi

# Initialize database schema
echo -e "${YELLOW}📋 Initializing database schema...${NC}"
npm run db:push || echo -e "${YELLOW}⚠️  Database initialization skipped or already exists${NC}"

# Show connection info
echo -e "\n${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "\n🔗 Connection Information:"
echo -e "   PostgreSQL: postgresql://postgres:${POSTGRES_PASSWORD}@89.208.14.253:5433/godnotes"
echo -e "   PgAdmin: http://89.208.14.253:5050"
echo -e "   Login: ${PGADMIN_EMAIL}"
echo -e "   Password: ${PGADMIN_PASSWORD}"
echo -e "\n📊 Container Status:"
docker-compose -f docker-compose.prod.yml ps