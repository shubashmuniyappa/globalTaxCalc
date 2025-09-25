#!/bin/bash

# GlobalTaxCalc.com Railway.app Deployment Script
# This script handles the complete deployment process to Railway.app

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="globaltaxcalc"
DOMAIN="globaltaxcalc.com"
ENVIRONMENT="production"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Railway CLI is installed
check_railway_cli() {
    if ! command -v railway &> /dev/null; then
        print_error "Railway CLI is not installed. Please install it first:"
        echo "npm install -g @railway/cli"
        exit 1
    fi
    print_success "Railway CLI is installed"
}

# Function to check if user is logged in to Railway
check_railway_auth() {
    if ! railway whoami &> /dev/null; then
        print_error "Not logged in to Railway. Please login first:"
        echo "railway login"
        exit 1
    fi
    print_success "Authenticated with Railway"
}

# Function to validate environment variables
validate_env_vars() {
    print_status "Validating environment variables..."

    # Check if .env file exists
    if [ ! -f "deployment/railway/production.env" ]; then
        print_error "production.env file not found. Please create it first."
        exit 1
    fi

    # Check for required variables
    required_vars=(
        "JWT_SECRET"
        "DATABASE_URL"
        "REDIS_URL"
        "SMTP_HOST"
        "SMTP_USER"
        "SMTP_PASSWORD"
    )

    missing_vars=()
    while IFS= read -r line; do
        if [[ $line =~ ^([A-Z_]+)= ]]; then
            var_name="${BASH_REMATCH[1]}"
            var_value="${line#*=}"
            if [[ -z "$var_value" && " ${required_vars[@]} " =~ " $var_name " ]]; then
                missing_vars+=("$var_name")
            fi
        fi
    done < "deployment/railway/production.env"

    if [ ${#missing_vars[@]} -ne 0 ]; then
        print_error "Missing required environment variables:"
        printf '%s\n' "${missing_vars[@]}"
        exit 1
    fi

    print_success "Environment variables validated"
}

# Function to run tests before deployment
run_tests() {
    print_status "Running tests before deployment..."

    cd tests

    # Install test dependencies
    if [ ! -d "node_modules" ]; then
        print_status "Installing test dependencies..."
        npm install
    fi

    # Run integration tests
    print_status "Running integration tests..."
    npm run test:integration

    # Run security tests
    print_status "Running security tests..."
    npm run test:security:custom

    cd ..
    print_success "All tests passed"
}

# Function to build Docker images
build_images() {
    print_status "Building Docker images..."

    services=(
        "api-gateway"
        "auth-service"
        "tax-engine"
        "report-export-service"
        "file-processing-service"
        "monitoring-health-service"
        "frontend"
    )

    for service in "${services[@]}"; do
        print_status "Building $service..."
        if [ -f "$service/Dockerfile" ]; then
            docker build -t "globaltaxcalc-$service:latest" -f "$service/Dockerfile" .
            print_success "$service image built"
        else
            print_warning "Dockerfile not found for $service, skipping..."
        fi
    done
}

# Function to create Railway project if it doesn't exist
create_railway_project() {
    print_status "Setting up Railway project..."

    # Check if project exists
    if ! railway status &> /dev/null; then
        print_status "Creating new Railway project..."
        railway init "$PROJECT_NAME"
        print_success "Railway project created"
    else
        print_success "Railway project already exists"
    fi
}

# Function to set up environment variables
setup_environment_variables() {
    print_status "Setting up environment variables..."

    # Read environment variables from file and set them in Railway
    while IFS= read -r line; do
        # Skip comments and empty lines
        if [[ $line =~ ^#.*$ ]] || [[ -z "$line" ]]; then
            continue
        fi

        if [[ $line =~ ^([A-Z_]+)=(.*)$ ]]; then
            var_name="${BASH_REMATCH[1]}"
            var_value="${BASH_REMATCH[2]}"

            # Skip empty values for optional variables
            if [[ -z "$var_value" ]]; then
                continue
            fi

            print_status "Setting $var_name..."
            railway variables set "$var_name=$var_value"
        fi
    done < "deployment/railway/production.env"

    print_success "Environment variables configured"
}

# Function to deploy database
deploy_database() {
    print_status "Setting up database..."

    # Add PostgreSQL service
    railway add postgresql

    # Wait for database to be ready
    print_status "Waiting for database to be ready..."
    sleep 30

    # Run database migrations
    print_status "Running database migrations..."
    railway run npm run migrate

    print_success "Database setup completed"
}

# Function to deploy Redis
deploy_redis() {
    print_status "Setting up Redis..."

    # Add Redis service
    railway add redis

    print_success "Redis setup completed"
}

# Function to deploy services
deploy_services() {
    print_status "Deploying services to Railway..."

    # Deploy main application
    railway up --detach

    print_success "Services deployed successfully"
}

# Function to setup custom domain
setup_custom_domain() {
    print_status "Setting up custom domain..."

    # Add custom domain
    railway domain add "$DOMAIN"
    railway domain add "www.$DOMAIN"
    railway domain add "app.$DOMAIN"
    railway domain add "api.$DOMAIN"

    print_success "Custom domains configured"
    print_warning "Please update your DNS records to point to Railway:"
    railway domain list
}

# Function to setup SSL certificates
setup_ssl() {
    print_status "Setting up SSL certificates..."

    # Railway handles SSL automatically for custom domains
    print_status "SSL certificates will be automatically provisioned by Railway"
    print_success "SSL setup completed"
}

# Function to setup monitoring
setup_monitoring() {
    print_status "Setting up monitoring..."

    # Deploy monitoring service
    railway up monitoring-health-service --detach

    # Setup health checks
    print_status "Configuring health checks..."
    railway variables set HEALTH_CHECK_ENABLED=true
    railway variables set HEALTH_CHECK_INTERVAL=30000

    print_success "Monitoring setup completed"
}

# Function to setup CDN with Cloudflare
setup_cdn() {
    print_status "Setting up CDN with Cloudflare..."

    print_warning "Please manually configure Cloudflare:"
    echo "1. Add your domain to Cloudflare"
    echo "2. Update nameservers"
    echo "3. Enable proxy for www and @ records"
    echo "4. Set up Page Rules for static assets"
    echo "5. Enable Auto Minify (CSS, JS, HTML)"
    echo "6. Enable Brotli compression"

    print_success "CDN setup instructions provided"
}

# Function to run post-deployment tests
run_post_deployment_tests() {
    print_status "Running post-deployment tests..."

    # Get the deployed URL
    APP_URL=$(railway url)

    if [ -z "$APP_URL" ]; then
        print_error "Could not get application URL"
        return 1
    fi

    print_status "Testing deployed application at $APP_URL"

    # Test health endpoint
    if curl -f "$APP_URL/health" > /dev/null 2>&1; then
        print_success "Health check passed"
    else
        print_error "Health check failed"
        return 1
    fi

    # Test API endpoints
    cd tests
    BASE_URL="$APP_URL" npm run test:e2e
    cd ..

    print_success "Post-deployment tests passed"
}

# Function to setup backup strategy
setup_backups() {
    print_status "Setting up backup strategy..."

    # Setup database backups
    railway variables set BACKUP_ENABLED=true
    railway variables set BACKUP_FREQUENCY=daily
    railway variables set BACKUP_RETENTION_DAYS=30

    print_success "Backup strategy configured"
    print_warning "Please verify backup configuration in Railway dashboard"
}

# Function to cleanup old deployments
cleanup_old_deployments() {
    print_status "Cleaning up old deployments..."

    # Railway handles this automatically, but we can clean up local Docker images
    docker image prune -f
    docker system prune -f

    print_success "Cleanup completed"
}

# Function to generate deployment report
generate_deployment_report() {
    print_status "Generating deployment report..."

    REPORT_FILE="deployment/reports/deployment-$(date +%Y%m%d-%H%M%S).txt"
    mkdir -p "deployment/reports"

    {
        echo "GlobalTaxCalc.com Deployment Report"
        echo "=================================="
        echo "Date: $(date)"
        echo "Environment: $ENVIRONMENT"
        echo "Domain: $DOMAIN"
        echo ""
        echo "Services Deployed:"
        railway ps
        echo ""
        echo "Environment Variables:"
        railway variables
        echo ""
        echo "Domain Configuration:"
        railway domain list
        echo ""
        echo "Deployment Status: SUCCESS"
    } > "$REPORT_FILE"

    print_success "Deployment report generated: $REPORT_FILE"
}

# Main deployment function
main() {
    print_status "Starting GlobalTaxCalc.com deployment to Railway.app"

    # Pre-deployment checks
    check_railway_cli
    check_railway_auth
    validate_env_vars

    # Run tests
    if [[ "${SKIP_TESTS:-false}" != "true" ]]; then
        run_tests
    else
        print_warning "Skipping tests (SKIP_TESTS=true)"
    fi

    # Build and deploy
    create_railway_project
    setup_environment_variables

    # Infrastructure
    deploy_database
    deploy_redis

    # Application services
    deploy_services

    # Domain and SSL
    setup_custom_domain
    setup_ssl

    # Additional services
    setup_monitoring
    setup_cdn
    setup_backups

    # Post-deployment
    if [[ "${SKIP_POST_TESTS:-false}" != "true" ]]; then
        run_post_deployment_tests
    else
        print_warning "Skipping post-deployment tests (SKIP_POST_TESTS=true)"
    fi

    cleanup_old_deployments
    generate_deployment_report

    print_success "🎉 GlobalTaxCalc.com successfully deployed to Railway.app!"
    print_status "Application URL: $(railway url)"
    print_status "Custom Domain: https://$DOMAIN"
    print_status "Monitoring Dashboard: https://railway.app/project/$(railway status | grep 'Project ID' | awk '{print $3}')"

    print_warning "Next steps:"
    echo "1. Update DNS records for custom domain"
    echo "2. Configure Cloudflare CDN"
    echo "3. Set up monitoring alerts"
    echo "4. Run load tests"
    echo "5. Update documentation"
}

# Handle command line arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "test")
        run_tests
        ;;
    "domain")
        setup_custom_domain
        ;;
    "ssl")
        setup_ssl
        ;;
    "monitoring")
        setup_monitoring
        ;;
    "backup")
        setup_backups
        ;;
    "cleanup")
        cleanup_old_deployments
        ;;
    "status")
        railway status
        railway ps
        railway domain list
        ;;
    "logs")
        railway logs
        ;;
    "rollback")
        print_status "Rolling back to previous deployment..."
        railway rollback
        print_success "Rollback completed"
        ;;
    "help")
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  deploy     - Full deployment (default)"
        echo "  test       - Run tests only"
        echo "  domain     - Setup custom domain"
        echo "  ssl        - Setup SSL certificates"
        echo "  monitoring - Setup monitoring"
        echo "  backup     - Setup backups"
        echo "  cleanup    - Cleanup old deployments"
        echo "  status     - Show deployment status"
        echo "  logs       - Show application logs"
        echo "  rollback   - Rollback to previous deployment"
        echo "  help       - Show this help message"
        ;;
    *)
        print_error "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac