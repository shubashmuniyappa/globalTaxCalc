# GlobalTaxCalc Analytics Platform - Deployment Guide

This guide provides comprehensive instructions for deploying the GlobalTaxCalc Analytics Platform in production environments.

## 🏗️ Deployment Architecture

### Production Infrastructure

```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer (Nginx)                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Superset  │  │   Grafana   │  │  Analytics  │         │
│  │   (Port 8088)│  │ (Port 3001) │  │Orchestrator │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ ClickHouse  │  │    Redis    │  │  Celery     │         │
│  │ (Port 9000) │  │ (Port 6379) │  │  Workers    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ PostgreSQL  │  │ Prometheus  │  │   Jupyter   │         │
│  │ (Port 5432) │  │ (Port 9090) │  │ (Port 8889) │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Prerequisites

### System Requirements

**Minimum Production Requirements:**
- CPU: 8 cores (16 recommended)
- RAM: 16GB (32GB recommended)
- Storage: 500GB SSD (1TB+ recommended)
- Network: 1Gbps connection

**Software Requirements:**
- Docker Engine 20.10+
- Docker Compose 2.0+
- Python 3.9+
- Git
- SSL certificates (for HTTPS)

### Network Requirements

**Ports to Open:**
- 80/443: HTTP/HTTPS (Load Balancer)
- 8088: Superset (Internal)
- 9000: ClickHouse (Internal)
- 6379: Redis (Internal)
- 5432: PostgreSQL (Internal)
- 3001: Grafana (Internal)
- 9090: Prometheus (Internal)

## 📋 Pre-deployment Checklist

### Security Preparation

- [ ] Generate SSL certificates
- [ ] Create secure passwords for all services
- [ ] Set up firewall rules
- [ ] Configure VPN access if required
- [ ] Review security policies

### Environment Preparation

- [ ] Set up monitoring infrastructure
- [ ] Configure backup systems
- [ ] Set up log aggregation
- [ ] Prepare disaster recovery plan
- [ ] Test network connectivity

### Configuration Preparation

- [ ] Create production environment files
- [ ] Configure database connection strings
- [ ] Set up notification endpoints
- [ ] Configure external API keys
- [ ] Prepare data migration scripts

## 🚀 Step-by-Step Deployment

### Step 1: Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER

# Install Python and dependencies
sudo apt install python3.9 python3-pip python3-venv -y
```

### Step 2: Application Deployment

```bash
# Clone repository
git clone https://github.com/globaltaxcalc/analytics-platform.git
cd analytics-platform/analytics

# Create production environment file
cp .env.example .env.production

# Edit production configuration
nano .env.production
```

### Step 3: Environment Configuration

Create `.env.production`:

```env
# Environment
ENVIRONMENT=production
DEBUG=false

# Database Configuration
CLICKHOUSE_HOST=clickhouse
CLICKHOUSE_PORT=9000
CLICKHOUSE_DB=analytics
CLICKHOUSE_USER=analytics_user
CLICKHOUSE_PASSWORD=secure_password_here

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=secure_redis_password

# PostgreSQL (for Superset)
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=superset
POSTGRES_USER=superset
POSTGRES_PASSWORD=secure_postgres_password

# Superset Configuration
SUPERSET_SECRET_KEY=your_very_long_secret_key_here
SUPERSET_LOAD_EXAMPLES=false

# Security
SSL_ENABLED=true
SSL_CERT_PATH=/etc/ssl/certs/globaltaxcalc.crt
SSL_KEY_PATH=/etc/ssl/private/globaltaxcalc.key

# Monitoring
PROMETHEUS_ENABLED=true
GRAFANA_ADMIN_PASSWORD=secure_grafana_password

# Notifications
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=alerts@globaltaxcalc.com
SMTP_PASSWORD=smtp_password
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK

# External APIs
GOOGLE_TRENDS_API_KEY=your_api_key
NEWS_API_KEY=your_news_api_key

# Performance
WORKER_PROCESSES=4
CELERY_WORKERS=8
MAX_CONNECTIONS=100
```

### Step 4: SSL Certificate Setup

```bash
# Create SSL directory
sudo mkdir -p /etc/ssl/certs /etc/ssl/private

# Copy SSL certificates
sudo cp your_certificate.crt /etc/ssl/certs/globaltaxcalc.crt
sudo cp your_private_key.key /etc/ssl/private/globaltaxcalc.key

# Set proper permissions
sudo chmod 644 /etc/ssl/certs/globaltaxcalc.crt
sudo chmod 600 /etc/ssl/private/globaltaxcalc.key
```

### Step 5: Production Docker Compose

Create `docker-compose.production.yml`:

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./config/nginx/nginx.conf:/etc/nginx/nginx.conf
      - /etc/ssl/certs:/etc/ssl/certs:ro
      - /etc/ssl/private:/etc/ssl/private:ro
    depends_on:
      - superset
      - grafana
    restart: unless-stopped
    networks:
      - analytics-network

  clickhouse:
    image: clickhouse/clickhouse-server:latest
    environment:
      CLICKHOUSE_DB: ${CLICKHOUSE_DB}
      CLICKHOUSE_USER: ${CLICKHOUSE_USER}
      CLICKHOUSE_PASSWORD: ${CLICKHOUSE_PASSWORD}
    volumes:
      - clickhouse_data:/var/lib/clickhouse
      - ./config/clickhouse/users.xml:/etc/clickhouse-server/users.xml
      - ./scripts/clickhouse:/docker-entrypoint-initdb.d
    ports:
      - "9000:9000"
      - "8123:8123"
    restart: unless-stopped
    networks:
      - analytics-network

  redis:
    image: redis:alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    restart: unless-stopped
    networks:
      - analytics-network

  postgres:
    image: postgres:13
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped
    networks:
      - analytics-network

  superset:
    build:
      context: .
      dockerfile: Dockerfile.superset
    environment:
      SUPERSET_SECRET_KEY: ${SUPERSET_SECRET_KEY}
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379/0
    volumes:
      - ./config/superset:/app/superset_home
    ports:
      - "8088:8088"
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    networks:
      - analytics-network

  analytics-orchestrator:
    build:
      context: .
      dockerfile: Dockerfile.analytics
    environment:
      CLICKHOUSE_HOST: ${CLICKHOUSE_HOST}
      CLICKHOUSE_USER: ${CLICKHOUSE_USER}
      CLICKHOUSE_PASSWORD: ${CLICKHOUSE_PASSWORD}
      REDIS_HOST: ${REDIS_HOST}
      REDIS_PASSWORD: ${REDIS_PASSWORD}
    volumes:
      - ./logs:/app/logs
      - ./models:/app/models
    depends_on:
      - clickhouse
      - redis
    restart: unless-stopped
    networks:
      - analytics-network

  celery-worker:
    build:
      context: .
      dockerfile: Dockerfile.analytics
    command: celery -A analytics worker --loglevel=info --concurrency=${CELERY_WORKERS}
    environment:
      CLICKHOUSE_HOST: ${CLICKHOUSE_HOST}
      CLICKHOUSE_USER: ${CLICKHOUSE_USER}
      CLICKHOUSE_PASSWORD: ${CLICKHOUSE_PASSWORD}
      REDIS_HOST: ${REDIS_HOST}
      REDIS_PASSWORD: ${REDIS_PASSWORD}
    volumes:
      - ./logs:/app/logs
      - ./models:/app/models
    depends_on:
      - clickhouse
      - redis
    restart: unless-stopped
    networks:
      - analytics-network

  prometheus:
    image: prom/prometheus:latest
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
    volumes:
      - ./config/prometheus:/etc/prometheus
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    restart: unless-stopped
    networks:
      - analytics-network

  grafana:
    image: grafana/grafana:latest
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD}
      GF_USERS_ALLOW_SIGN_UP: false
    volumes:
      - grafana_data:/var/lib/grafana
      - ./config/grafana:/etc/grafana/provisioning
    ports:
      - "3001:3000"
    depends_on:
      - prometheus
    restart: unless-stopped
    networks:
      - analytics-network

volumes:
  clickhouse_data:
  redis_data:
  postgres_data:
  prometheus_data:
  grafana_data:

networks:
  analytics-network:
    driver: bridge
```

### Step 6: Nginx Configuration

Create `config/nginx/nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream superset {
        server superset:8088;
    }

    upstream grafana {
        server grafana:3000;
    }

    # HTTP to HTTPS redirect
    server {
        listen 80;
        server_name analytics.globaltaxcalc.com;
        return 301 https://$server_name$request_uri;
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name analytics.globaltaxcalc.com;

        ssl_certificate /etc/ssl/certs/globaltaxcalc.crt;
        ssl_certificate_key /etc/ssl/private/globaltaxcalc.key;

        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";

        # Superset
        location / {
            proxy_pass http://superset;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Grafana
        location /grafana/ {
            proxy_pass http://grafana/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

### Step 7: Deploy Services

```bash
# Build and start services
docker-compose -f docker-compose.production.yml up -d

# Check service status
docker-compose -f docker-compose.production.yml ps

# View logs
docker-compose -f docker-compose.production.yml logs -f
```

### Step 8: Initialize Database

```bash
# Initialize ClickHouse database
docker exec -it analytics_clickhouse_1 clickhouse-client --query="$(cat scripts/clickhouse/init.sql)"

# Initialize Superset database
docker exec -it analytics_superset_1 superset db upgrade
docker exec -it analytics_superset_1 superset fab create-admin \
    --username admin \
    --firstname Admin \
    --lastname User \
    --email admin@globaltaxcalc.com \
    --password admin_password

docker exec -it analytics_superset_1 superset init
```

### Step 9: Configure Monitoring

```bash
# Import Grafana dashboards
curl -X POST \
  http://admin:${GRAFANA_ADMIN_PASSWORD}@localhost:3001/api/dashboards/db \
  -H 'Content-Type: application/json' \
  -d @config/grafana/dashboards/analytics-overview.json

# Set up Prometheus targets
# Edit config/prometheus/prometheus.yml to add targets
```

## 🔍 Post-Deployment Verification

### Health Checks

```bash
# Check service health
curl -f http://localhost:8088/health || echo "Superset failed"
curl -f http://localhost:3001/api/health || echo "Grafana failed"
curl -f http://localhost:8123/ping || echo "ClickHouse failed"

# Check database connectivity
docker exec analytics_clickhouse_1 clickhouse-client --query="SELECT 1"

# Check Redis connectivity
docker exec analytics_redis_1 redis-cli -a $REDIS_PASSWORD ping
```

### Functional Tests

```bash
# Run analytics pipeline test
python tests/integration/test_full_pipeline.py

# Check data ingestion
python scripts/verify_data_ingestion.py

# Test dashboard access
curl -f https://analytics.globaltaxcalc.com/dashboard/executive
```

## 📊 Monitoring Setup

### Prometheus Metrics

Key metrics to monitor:
- `analytics_requests_total`: Total requests to analytics APIs
- `analytics_response_time_seconds`: Response time metrics
- `analytics_errors_total`: Error count
- `clickhouse_queries_total`: Database query metrics
- `redis_operations_total`: Cache operation metrics

### Grafana Dashboards

Pre-configured dashboards:
1. **Analytics Overview**: High-level system metrics
2. **Database Performance**: ClickHouse performance metrics
3. **Application Metrics**: Analytics application metrics
4. **Infrastructure Monitoring**: System resource usage

### Alert Rules

Configure alerts for:
- High error rates (>5%)
- Slow response times (>2s)
- Database connection failures
- High memory usage (>80%)
- Disk space usage (>90%)

## 🔄 Backup and Recovery

### Automated Backup Script

Create `scripts/backup.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/opt/backups/analytics"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR/$DATE"

# Backup ClickHouse data
docker exec analytics_clickhouse_1 clickhouse-client --query="BACKUP DATABASE analytics TO Disk('backup', '$DATE/clickhouse/')"

# Backup PostgreSQL
docker exec analytics_postgres_1 pg_dump -U $POSTGRES_USER $POSTGRES_DB > "$BACKUP_DIR/$DATE/postgres_superset.sql"

# Backup configuration files
cp -r config/ "$BACKUP_DIR/$DATE/config/"

# Backup models
cp -r models/ "$BACKUP_DIR/$DATE/models/"

# Compress backup
tar -czf "$BACKUP_DIR/analytics_backup_$DATE.tar.gz" -C "$BACKUP_DIR" "$DATE"

# Clean up
rm -rf "$BACKUP_DIR/$DATE"

# Retention policy (keep last 30 days)
find "$BACKUP_DIR" -name "analytics_backup_*.tar.gz" -mtime +30 -delete

echo "Backup completed: analytics_backup_$DATE.tar.gz"
```

### Recovery Procedure

```bash
#!/bin/bash

BACKUP_FILE="$1"
RESTORE_DIR="/tmp/analytics_restore"

# Extract backup
tar -xzf "$BACKUP_FILE" -C "$RESTORE_DIR"

# Stop services
docker-compose -f docker-compose.production.yml down

# Restore ClickHouse
docker exec analytics_clickhouse_1 clickhouse-client --query="RESTORE DATABASE analytics FROM Disk('backup', 'restore/')"

# Restore PostgreSQL
docker exec -i analytics_postgres_1 psql -U $POSTGRES_USER $POSTGRES_DB < "$RESTORE_DIR/postgres_superset.sql"

# Restore configuration
cp -r "$RESTORE_DIR/config/" ./

# Restore models
cp -r "$RESTORE_DIR/models/" ./

# Start services
docker-compose -f docker-compose.production.yml up -d

echo "Recovery completed"
```

## 🔒 Security Hardening

### Container Security

```bash
# Run containers as non-root user
# Add to Dockerfile:
RUN adduser --disabled-password --gecos '' analytics
USER analytics

# Use read-only file systems where possible
# Add to docker-compose.yml:
read_only: true
tmpfs:
  - /tmp
  - /var/tmp
```

### Network Security

```bash
# Configure firewall
sudo ufw enable
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS

# Deny access to internal ports from external networks
sudo ufw deny 9000  # ClickHouse
sudo ufw deny 6379  # Redis
sudo ufw deny 5432  # PostgreSQL
```

### Access Control

```yaml
# Configure Superset security
SUPERSET_CONFIG_PATH: /app/superset_home/superset_config.py

# superset_config.py content:
AUTH_TYPE = AUTH_OAUTH
OAUTH_PROVIDERS = [
    {
        'name': 'globaltaxcalc',
        'token_key': 'access_token',
        'icon': 'fa-google',
        'remote_app': {
            'client_id': 'your_client_id',
            'client_secret': 'your_client_secret',
            'server_metadata_url': 'https://accounts.google.com/.well-known/openid_configuration',
            'client_kwargs': {
                'scope': 'openid email profile'
            }
        }
    }
]
```

## 📈 Performance Optimization

### Database Optimization

```sql
-- ClickHouse optimizations
-- Create materialized views for common queries
CREATE MATERIALIZED VIEW analytics.daily_metrics
ENGINE = SummingMergeTree()
ORDER BY (date, metric_name)
AS SELECT
    toDate(timestamp) as date,
    metric_name,
    count() as value
FROM analytics.user_events
GROUP BY date, metric_name;

-- Optimize table settings
ALTER TABLE analytics.user_events MODIFY SETTING
    merge_with_ttl_timeout = 3600,
    ttl_only_drop_parts = 1;
```

### Application Optimization

```python
# Configure connection pooling
CLICKHOUSE_POOL_SIZE = 20
REDIS_POOL_SIZE = 50

# Enable query caching
QUERY_CACHE_TTL = 300  # 5 minutes

# Configure async processing
CELERY_TASK_ROUTES = {
    'analytics.insights.generate': {'queue': 'insights'},
    'analytics.monitoring.check': {'queue': 'monitoring'},
    'analytics.competitive.scrape': {'queue': 'competitive'}
}
```

## 🚨 Troubleshooting

### Common Issues

**Issue: ClickHouse connection timeout**
```bash
# Check ClickHouse logs
docker logs analytics_clickhouse_1

# Check network connectivity
docker exec analytics_orchestrator_1 nc -zv clickhouse 9000

# Restart ClickHouse
docker restart analytics_clickhouse_1
```

**Issue: Superset not loading**
```bash
# Check Superset logs
docker logs analytics_superset_1

# Check database connection
docker exec analytics_superset_1 superset db check

# Restart Superset
docker restart analytics_superset_1
```

**Issue: High memory usage**
```bash
# Check memory usage by container
docker stats

# Reduce worker processes
# Edit .env.production:
WORKER_PROCESSES=2
CELERY_WORKERS=4
```

### Log Analysis

```bash
# Centralized logging with ELK stack (optional)
# View application logs
docker logs -f analytics_orchestrator_1

# View specific service logs
docker-compose -f docker-compose.production.yml logs -f superset

# Check system logs
sudo journalctl -u docker.service -f
```

## 🔄 Maintenance Procedures

### Regular Maintenance Tasks

**Daily:**
- Check service health status
- Review error logs
- Monitor disk space usage
- Verify backup completion

**Weekly:**
- Update security patches
- Review performance metrics
- Check database optimization opportunities
- Validate monitoring alerts

**Monthly:**
- Security vulnerability assessment
- Performance optimization review
- Capacity planning analysis
- Disaster recovery testing

### Update Procedures

```bash
# Update application
git pull origin main

# Build new images
docker-compose -f docker-compose.production.yml build

# Rolling update (zero downtime)
docker-compose -f docker-compose.production.yml up -d --no-deps superset
docker-compose -f docker-compose.production.yml up -d --no-deps analytics-orchestrator

# Verify update
curl -f https://analytics.globaltaxcalc.com/health
```

This deployment guide provides a comprehensive foundation for deploying the GlobalTaxCalc Analytics Platform in a production environment with proper security, monitoring, and maintenance procedures.