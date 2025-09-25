# Environment Setup Guide - GlobalTaxCalc.com

## Overview
This guide covers the complete setup of production and staging environments for GlobalTaxCalc.com on Railway.app.

## Prerequisites

### Required Accounts
- **Railway.app Account**: Sign up at https://railway.app
- **GitHub Account**: For repository access and CI/CD
- **Domain Registrar**: For `globaltaxcalc.com` domain
- **Cloudflare Account**: For CDN and DNS management
- **Monitoring Services**: Datadog, New Relic, or similar

### Required Tools
```bash
# Install Railway CLI
npm install -g @railway/cli

# Install Docker
# Follow platform-specific instructions at https://docker.com

# Install Node.js 18+
# Download from https://nodejs.org

# Verify installations
railway --version
docker --version
node --version
npm --version
```

## Railway.app Environment Setup

### 1. Initial Project Setup
```bash
# Login to Railway
railway login

# Create new project
railway init globaltaxcalc

# Connect to GitHub repository
railway connect
```

### 2. Environment Configuration

#### Production Environment
```bash
# Set environment to production
railway environment production

# Configure environment variables
railway variables set NODE_ENV=production
railway variables set PORT=3000
railway variables set DOMAIN=globaltaxcalc.com
```

#### Staging Environment
```bash
# Create staging environment
railway environment new staging

# Configure staging variables
railway variables set NODE_ENV=staging
railway variables set PORT=3000
railway variables set DOMAIN=staging.globaltaxcalc.com
```

### 3. Database Setup

#### PostgreSQL Configuration
```bash
# Add PostgreSQL service
railway add postgresql

# Get database URL
railway variables

# Set database configuration
railway variables set DATABASE_SSL=true
railway variables set DATABASE_POOL_SIZE=20
railway variables set DATABASE_CONNECTION_TIMEOUT=60000
```

#### Redis Configuration
```bash
# Add Redis service
railway add redis

# Configure Redis settings
railway variables set REDIS_TTL=3600
railway variables set REDIS_MAX_CONNECTIONS=10
```

## Environment Variables Configuration

### Core Application Variables
```bash
# Application settings
railway variables set NODE_ENV=production
railway variables set PORT=3000
railway variables set DOMAIN=globaltaxcalc.com
railway variables set APP_URL=https://globaltaxcalc.com
railway variables set API_URL=https://api.globaltaxcalc.com

# Security settings
railway variables set JWT_SECRET="your-super-secure-jwt-secret-here"
railway variables set JWT_EXPIRES_IN=7d
railway variables set BCRYPT_ROUNDS=12
railway variables set SESSION_SECRET="your-session-secret-here"

# Rate limiting
railway variables set RATE_LIMIT_ENABLED=true
railway variables set RATE_LIMIT_WINDOW_MS=900000
railway variables set RATE_LIMIT_MAX_REQUESTS=100
```

### Database Configuration
```bash
# PostgreSQL (automatically set by Railway)
# DATABASE_URL=postgresql://username:password@host:port/database

# Additional database settings
railway variables set DATABASE_SSL=true
railway variables set DATABASE_POOL_SIZE=20
railway variables set DATABASE_CONNECTION_TIMEOUT=60000
railway variables set DATABASE_IDLE_TIMEOUT=30000
```

### Cache Configuration
```bash
# Redis (automatically set by Railway)
# REDIS_URL=redis://username:password@host:port

# Additional Redis settings
railway variables set REDIS_TTL=3600
railway variables set REDIS_MAX_CONNECTIONS=10
railway variables set REDIS_RETRY_ATTEMPTS=3
```

### Email Configuration
```bash
# SMTP settings
railway variables set SMTP_HOST=smtp.sendgrid.net
railway variables set SMTP_PORT=587
railway variables set SMTP_SECURE=false
railway variables set SMTP_USER=apikey
railway variables set SMTP_PASSWORD="your-sendgrid-api-key"
railway variables set SMTP_FROM_EMAIL=noreply@globaltaxcalc.com
railway variables set SMTP_FROM_NAME="GlobalTaxCalc"
```

### File Storage Configuration
```bash
# AWS S3 or Railway file storage
railway variables set FILE_STORAGE_TYPE=s3
railway variables set AWS_ACCESS_KEY_ID="your-aws-access-key"
railway variables set AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
railway variables set AWS_REGION=us-east-1
railway variables set AWS_S3_BUCKET=globaltaxcalc-files
railway variables set FILE_UPLOAD_MAX_SIZE=10485760
railway variables set FILE_ALLOWED_TYPES="pdf,csv,xlsx,txt"
```

### External API Configuration
```bash
# Tax calculation APIs
railway variables set TAX_API_ENABLED=true
railway variables set TAX_API_TIMEOUT=30000

# Monitoring and analytics
railway variables set SENTRY_DSN="your-sentry-dsn"
railway variables set GOOGLE_ANALYTICS_ID="your-ga-id"
railway variables set HOTJAR_ID="your-hotjar-id"
```

### Security and Compliance
```bash
# Security headers
railway variables set HELMET_ENABLED=true
railway variables set CORS_ORIGIN=https://globaltaxcalc.com
railway variables set TRUST_PROXY=true

# Data protection
railway variables set GDPR_COMPLIANCE=true
railway variables set DATA_RETENTION_DAYS=2555
railway variables set COOKIE_SECURE=true
railway variables set COOKIE_SAME_SITE=strict
```

## Service Configuration

### API Gateway Configuration
```yaml
# Railway service configuration
services:
  api-gateway:
    build:
      context: .
      dockerfile: api-gateway/Dockerfile
    environment:
      - NODE_ENV=production
      - PORT=3000
    healthcheck:
      path: /health
      interval: 30s
      timeout: 10s
      retries: 3
```

### Microservices Configuration
```bash
# Auth Service
railway variables set AUTH_SERVICE_PORT=3001
railway variables set AUTH_JWT_SECRET="auth-service-secret"

# Tax Engine
railway variables set TAX_ENGINE_PORT=3002
railway variables set TAX_CALCULATION_TIMEOUT=10000

# Report Service
railway variables set REPORT_SERVICE_PORT=3003
railway variables set REPORT_GENERATION_TIMEOUT=30000

# File Service
railway variables set FILE_SERVICE_PORT=3004
railway variables set FILE_PROCESSING_TIMEOUT=60000

# Monitoring Service
railway variables set MONITORING_SERVICE_PORT=3005
railway variables set METRICS_COLLECTION_INTERVAL=15000
```

## Domain and SSL Setup

### Domain Configuration
```bash
# Add custom domains
railway domain add globaltaxcalc.com
railway domain add www.globaltaxcalc.com
railway domain add app.globaltaxcalc.com
railway domain add api.globaltaxcalc.com

# Get domain configuration
railway domain list
```

### DNS Configuration (Cloudflare)
```
# A Records
@ -> [Railway IP]
www -> [Railway IP]
app -> [Railway IP]
api -> [Railway IP]

# CNAME Records (if using Railway subdomain)
@ -> globaltaxcalc.up.railway.app
www -> globaltaxcalc.up.railway.app
app -> globaltaxcalc.up.railway.app
api -> globaltaxcalc.up.railway.app
```

### SSL Certificate Setup
```bash
# SSL is automatically provisioned by Railway
# Verify SSL configuration
curl -I https://globaltaxcalc.com
```

## Monitoring and Logging Setup

### Application Monitoring
```bash
# Sentry for error tracking
railway variables set SENTRY_DSN="your-sentry-dsn"
railway variables set SENTRY_ENVIRONMENT=production

# Performance monitoring
railway variables set DATADOG_API_KEY="your-datadog-api-key"
railway variables set NEW_RELIC_LICENSE_KEY="your-newrelic-key"
```

### Log Configuration
```bash
# Log levels and formats
railway variables set LOG_LEVEL=info
railway variables set LOG_FORMAT=json
railway variables set LOG_TIMESTAMP=true

# Log aggregation
railway variables set LOKI_URL="your-loki-endpoint"
railway variables set ELASTICSEARCH_URL="your-elasticsearch-url"
```

## Backup and Recovery

### Database Backup Configuration
```bash
# Automated backups (Railway handles this)
railway variables set BACKUP_ENABLED=true
railway variables set BACKUP_FREQUENCY=daily
railway variables set BACKUP_RETENTION_DAYS=30

# Manual backup commands
railway run pg_dump $DATABASE_URL > backup.sql
```

### File Storage Backup
```bash
# S3 backup configuration
railway variables set S3_BACKUP_ENABLED=true
railway variables set S3_BACKUP_BUCKET=globaltaxcalc-backups
railway variables set S3_BACKUP_SCHEDULE="0 2 * * *"
```

## Health Checks and Readiness

### Service Health Endpoints
```bash
# Verify all health endpoints
curl -f https://globaltaxcalc.com/health
curl -f https://api.globaltaxcalc.com/health
curl -f https://api.globaltaxcalc.com/api/auth/health
curl -f https://api.globaltaxcalc.com/api/tax/health
curl -f https://api.globaltaxcalc.com/api/reports/health
curl -f https://api.globaltaxcalc.com/api/files/health
curl -f https://api.globaltaxcalc.com/api/monitoring/health
```

### Readiness Checks
```bash
# Database connectivity
railway run npm run db:check

# Redis connectivity
railway run npm run redis:check

# External API connectivity
railway run npm run apis:check
```

## CI/CD Integration

### GitHub Secrets Configuration
```bash
# Railway deployment
RAILWAY_TOKEN="your-railway-token"

# Environment URLs
STAGING_URL="https://staging.globaltaxcalc.com"
PRODUCTION_URL="https://globaltaxcalc.com"

# Monitoring
DATADOG_API_KEY="your-datadog-key"
SLACK_WEBHOOK="your-slack-webhook"

# Testing
TEST_USER_EMAIL="test@globaltaxcalc.com"
TEST_USER_PASSWORD="secure-test-password"
```

### Automated Deployment
```bash
# Trigger deployment via GitHub Actions
# Pushes to main branch automatically deploy to staging
# Releases automatically deploy to production
```

## Security Considerations

### Network Security
- All communication over HTTPS
- Rate limiting enabled
- CORS properly configured
- Security headers enforced

### Data Security
- Database encryption at rest
- JWT tokens with short expiration
- Secure cookie configuration
- Input validation and sanitization

### Access Control
- Railway team member permissions
- GitHub repository access controls
- Environment variable encryption
- Service-to-service authentication

## Troubleshooting Common Issues

### Deployment Issues
```bash
# Check deployment status
railway status

# View deployment logs
railway logs

# Check service health
railway ps
```

### Database Issues
```bash
# Check database connection
railway connect postgresql

# Run database migrations
railway run npm run migrate

# Check database status
railway run npm run db:status
```

### Performance Issues
```bash
# Check resource usage
railway metrics

# Monitor response times
curl -w "%{time_total}" https://api.globaltaxcalc.com/health

# Check error rates
railway logs --filter error
```

## Environment Validation Checklist

- [ ] Railway CLI installed and authenticated
- [ ] Project created and connected to GitHub
- [ ] Environment variables configured
- [ ] Database and Redis services added
- [ ] Domain names configured
- [ ] SSL certificates provisioned
- [ ] Health checks passing
- [ ] Monitoring and logging configured
- [ ] Backup strategy implemented
- [ ] CI/CD pipeline operational

## Support Resources

- **Railway Documentation**: https://docs.railway.app
- **Railway Community**: https://railway.app/discord
- **Project Repository**: https://github.com/your-org/globaltaxcalc
- **Monitoring Dashboard**: https://railway.app/project/your-project-id
- **Status Page**: https://status.globaltaxcalc.com