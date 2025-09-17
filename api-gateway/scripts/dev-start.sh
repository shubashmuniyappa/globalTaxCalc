#!/bin/bash

# GlobalTaxCalc API Gateway Development Startup Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=================================================="
echo -e "     GlobalTaxCalc API Gateway - Dev Start"
echo -e "==================================================${NC}"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Warning: .env file not found. Creating from template...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✓ Created .env file from template${NC}"
    echo -e "${YELLOW}Please edit .env file with your configuration before continuing.${NC}"
    echo ""
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo -e "${BLUE}Installing dependencies...${NC}"
    npm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
    echo ""
fi

# Check if Redis is running
echo -e "${BLUE}Checking Redis connection...${NC}"
if redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Redis is running${NC}"
else
    echo -e "${YELLOW}Warning: Redis not accessible. Starting with Docker Compose...${NC}"
    docker-compose up -d redis

    # Wait for Redis to be ready
    echo -e "${BLUE}Waiting for Redis to be ready...${NC}"
    timeout=30
    while [ $timeout -gt 0 ]; do
        if redis-cli ping > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Redis is ready${NC}"
            break
        fi
        echo -n "."
        sleep 1
        timeout=$((timeout-1))
    done

    if [ $timeout -eq 0 ]; then
        echo -e "${RED}✗ Redis failed to start${NC}"
        exit 1
    fi
fi

echo ""

# Run linting
echo -e "${BLUE}Running code linting...${NC}"
if npm run lint > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Code linting passed${NC}"
else
    echo -e "${YELLOW}Warning: Linting issues found. Run 'npm run lint:fix' to auto-fix.${NC}"
fi

echo ""

# Display startup information
echo -e "${GREEN}🚀 Starting API Gateway...${NC}"
echo ""
echo -e "${BLUE}Available endpoints:${NC}"
echo -e "  📊 Health Check:     http://localhost:3000/health"
echo -e "  📚 API Docs:         http://localhost:3000/api-docs"
echo -e "  🔍 Detailed Health:  http://localhost:3000/health/detailed"
echo -e "  📈 Metrics:          http://localhost:3000/health/metrics"
echo ""
echo -e "${BLUE}Development tools:${NC}"
echo -e "  🔄 Auto-restart:     Enabled (nodemon)"
echo -e "  📝 Logs:             Structured logging enabled"
echo -e "  🔒 Security:         Development mode"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop the server${NC}"
echo ""

# Start the development server
npm run dev