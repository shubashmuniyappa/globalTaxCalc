#!/bin/bash

# GlobalTaxCalc Development Environment Setup Script
# This script sets up the complete development environment

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    local missing_deps=()

    if ! command_exists docker; then
        missing_deps+=("docker")
    fi

    if ! command_exists docker-compose; then
        missing_deps+=("docker-compose")
    fi

    if ! command_exists git; then
        missing_deps+=("git")
    fi

    if ! command_exists node; then
        missing_deps+=("node")
    else
        node_version=$(node --version | sed 's/v//')
        if [[ "$(printf '%s\n' "18.0.0" "$node_version" | sort -V | head -n1)" != "18.0.0" ]]; then
            log_warning "Node.js version $node_version found, but v18+ is recommended"
        fi
    fi

    if ! command_exists python3; then
        missing_deps+=("python3")
    else
        python_version=$(python3 --version | awk '{print $2}')
        if [[ "$(printf '%s\n' "3.11.0" "$python_version" | sort -V | head -n1)" != "3.11.0" ]]; then
            log_warning "Python version $python_version found, but v3.11+ is recommended"
        fi
    fi

    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Missing required dependencies: ${missing_deps[*]}"
        log_info "Please install the missing dependencies and run this script again."
        exit 1
    fi

    log_success "All prerequisites met!"
}

# Create environment files
setup_environment() {
    log_info "Setting up environment files..."

    # Create main .env file
    if [ ! -f .env ]; then
        cat > .env << EOF
# Database URLs
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/globaltaxcalc
MONGODB_URL=mongodb://mongo:mongo@localhost:27017/globaltaxcalc
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=7d
JWT_COOKIE_EXPIRES_IN=7

# Environment
NODE_ENV=development
PYTHON_ENV=development
LOG_LEVEL=info

# API Keys (Add your keys here)
OPENAI_API_KEY=your-openai-api-key-here
GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here

# Email Configuration
EMAIL_FROM=noreply@globaltaxcalc.com
SENDGRID_API_KEY=your-sendgrid-api-key-here

# AWS Configuration
AWS_ACCESS_KEY_ID=your-aws-access-key-here
AWS_SECRET_ACCESS_KEY=your-aws-secret-key-here
AWS_REGION=us-east-1
AWS_S3_BUCKET=globaltaxcalc-files

# SMS Configuration
TWILIO_ACCOUNT_SID=your-twilio-sid-here
TWILIO_AUTH_TOKEN=your-twilio-token-here

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# Service URLs
API_GATEWAY_URL=http://localhost:3000
AUTH_SERVICE_URL=http://localhost:3001
TAX_ENGINE_URL=http://localhost:8000
GEOLOCATION_SERVICE_URL=http://localhost:3002
AI_SERVICE_URL=http://localhost:8001

# CORS
CORS_ORIGIN=http://localhost:3009

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3000
EOF
        log_success "Created .env file"
    else
        log_warning ".env file already exists, skipping..."
    fi
}

# Install Node.js dependencies
install_node_dependencies() {
    log_info "Installing Node.js dependencies..."

    local node_services=(
        "api-gateway"
        "auth-service"
        "geolocation-service"
        "content-service"
        "analytics-service"
        "notification-service"
        "ad-service"
        "file-service"
        "monitoring-service"
        "frontend"
    )

    for service in "${node_services[@]}"; do
        if [ -d "$service" ] && [ -f "$service/package.json" ]; then
            log_info "Installing dependencies for $service..."
            cd "$service"
            npm install
            cd ..
            log_success "Dependencies installed for $service"
        else
            log_warning "Skipping $service (directory or package.json not found)"
        fi
    done
}

# Install Python dependencies
install_python_dependencies() {
    log_info "Installing Python dependencies..."

    local python_services=(
        "tax-engine"
        "ai-service"
        "report-service"
    )

    for service in "${python_services[@]}"; do
        if [ -d "$service" ] && [ -f "$service/requirements.txt" ]; then
            log_info "Installing dependencies for $service..."
            cd "$service"

            # Create virtual environment if it doesn't exist
            if [ ! -d "venv" ]; then
                python3 -m venv venv
            fi

            # Activate virtual environment and install dependencies
            source venv/bin/activate
            pip install --upgrade pip
            pip install -r requirements.txt
            deactivate

            cd ..
            log_success "Dependencies installed for $service"
        else
            log_warning "Skipping $service (directory or requirements.txt not found)"
        fi
    done
}

# Create log directories
create_log_directories() {
    log_info "Creating log directories..."

    local services=(
        "api-gateway" "auth-service" "tax-engine" "geolocation-service"
        "ai-service" "content-service" "analytics-service" "notification-service"
        "ad-service" "file-service" "report-service" "monitoring-service"
    )

    for service in "${services[@]}"; do
        if [ -d "$service" ]; then
            mkdir -p "$service/logs"
        fi
    done

    log_success "Log directories created"
}

# Setup databases with Docker
setup_databases() {
    log_info "Setting up databases with Docker..."

    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi

    # Start only database services
    docker-compose up -d postgres mongodb redis

    log_info "Waiting for databases to be ready..."
    sleep 10

    # Check if databases are ready
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if docker-compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
            log_success "PostgreSQL is ready"
            break
        fi

        log_info "Waiting for PostgreSQL... (attempt $attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done

    if [ $attempt -gt $max_attempts ]; then
        log_error "PostgreSQL failed to start after $max_attempts attempts"
        exit 1
    fi

    log_success "Databases are ready!"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."

    # Run migrations for services that have them
    if [ -d "auth-service" ] && [ -f "auth-service/package.json" ]; then
        cd auth-service
        if npm run migrate 2>/dev/null; then
            log_success "Auth service migrations completed"
        else
            log_warning "Auth service migrations not available or failed"
        fi
        cd ..
    fi

    log_success "Database migrations completed"
}

# Create development scripts
create_dev_scripts() {
    log_info "Creating development scripts..."

    # Create start script
    cat > scripts/start-dev.sh << 'EOF'
#!/bin/bash
echo "Starting GlobalTaxCalc development environment..."

# Start databases first
docker-compose up -d postgres mongodb redis

echo "Waiting for databases..."
sleep 5

# Start all services
docker-compose up api-gateway auth-service tax-engine geolocation-service ai-service content-service analytics-service notification-service ad-service file-service report-service monitoring-service frontend
EOF

    # Create stop script
    cat > scripts/stop-dev.sh << 'EOF'
#!/bin/bash
echo "Stopping GlobalTaxCalc development environment..."
docker-compose down
EOF

    # Create test script
    cat > scripts/test.sh << 'EOF'
#!/bin/bash
echo "Running tests for all services..."

# Node.js services
for service in api-gateway auth-service geolocation-service content-service analytics-service notification-service ad-service file-service monitoring-service frontend; do
    if [ -d "$service" ]; then
        echo "Testing $service..."
        cd "$service"
        npm test
        cd ..
    fi
done

# Python services
for service in tax-engine ai-service report-service; do
    if [ -d "$service" ]; then
        echo "Testing $service..."
        cd "$service"
        if [ -d "venv" ]; then
            source venv/bin/activate
            pytest
            deactivate
        fi
        cd ..
    fi
done
EOF

    chmod +x scripts/start-dev.sh scripts/stop-dev.sh scripts/test.sh
    log_success "Development scripts created"
}

# Main setup function
main() {
    echo "=================================================="
    echo "    GlobalTaxCalc Development Environment Setup"
    echo "=================================================="
    echo ""

    check_prerequisites
    setup_environment
    create_log_directories
    install_node_dependencies
    install_python_dependencies
    setup_databases
    run_migrations
    create_dev_scripts

    echo ""
    echo "=================================================="
    log_success "Setup completed successfully!"
    echo "=================================================="
    echo ""
    echo "Next steps:"
    echo "1. Edit .env file with your API keys and configuration"
    echo "2. Start the development environment:"
    echo "   ./scripts/start-dev.sh"
    echo ""
    echo "3. Access the application:"
    echo "   - Frontend: http://localhost:3009"
    echo "   - API Gateway: http://localhost:3000"
    echo "   - Monitoring: http://localhost:3008"
    echo ""
    echo "4. Run tests:"
    echo "   ./scripts/test.sh"
    echo ""
    echo "5. Stop the environment:"
    echo "   ./scripts/stop-dev.sh"
    echo ""
    echo "For more information, see README.md"
    echo "=================================================="
}

# Run main function
main "$@"