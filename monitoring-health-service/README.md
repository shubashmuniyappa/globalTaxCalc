# GlobalTaxCalc Monitoring & Health Service

A comprehensive monitoring, health checking, and alerting service for the GlobalTaxCalc.com microservices architecture. This service provides real-time visibility into system health, performance metrics, error tracking, and automated alerting.

## 🚀 Features

### Core Monitoring Capabilities
- **Prometheus Metrics Collection**: Custom metrics for HTTP requests, database queries, business events, and system resources
- **Health Check System**: Comprehensive health monitoring for services, databases, and external dependencies
- **Grafana Dashboards**: Pre-configured dashboards for system overview and service-specific monitoring
- **Winston Logging**: Structured logging with log aggregation and analysis
- **Sentry Error Tracking**: Intelligent error categorization and tracking
- **Multi-Channel Alerting**: Email, Slack, PagerDuty, and SMS notifications with escalation
- **APM Monitoring**: Application performance monitoring with resource utilization tracking
- **RESTful API**: Complete API for health checks, metrics, and alert management

### Advanced Features
- Circuit breaker patterns for resilient service communication
- Performance budgets with P95/P99 monitoring
- Business metrics tracking (revenue, conversions, user activity)
- On-call rotation and escalation policies
- Log aggregation with time-series analysis
- Security event monitoring and alerting
- Rate limiting and API key authentication

## 📊 Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Prometheus    │    │    Grafana      │    │   Elasticsearch │
│   (Metrics)     │    │  (Dashboards)   │    │    (Logs)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
┌─────────────────────────────────────────────────────────────────┐
│                Monitoring & Health Service                      │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Metrics    │  │    Health    │  │   Logging    │         │
│  │  Collection  │  │   Checking   │  │ Aggregation  │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │    Sentry    │  │   Alerting   │  │     APM      │         │
│  │    Error     │  │    System    │  │ Performance  │         │
│  │   Tracking   │  │              │  │  Monitoring  │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Tax Calc      │    │   Comparison    │    │    Report       │
│   Service       │    │    Service      │    │   Service       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 18+
- Prometheus server
- Grafana instance
- Redis (optional, for caching)
- MySQL/PostgreSQL (for health checks)
- Elasticsearch (optional, for log aggregation)

### Installation

1. **Clone and install dependencies:**
```bash
cd monitoring-health-service
npm install
```

2. **Configure environment variables:**
```bash
cp .env.example .env
# Edit .env with your specific configuration
```

3. **Create required directories:**
```bash
mkdir -p logs temp reports dashboards alerts
```

4. **Start the service:**
```bash
# Development
npm run dev

# Production
npm start

# Docker
npm run docker:build
npm run docker:run
```

## 🔧 Configuration

### Environment Variables

The service is configured through environment variables. Key sections include:

#### Core Service Settings
```env
PORT=3004
NODE_ENV=production
SERVICE_NAME=monitoring-health-service
SERVICE_VERSION=1.0.0
```

#### Prometheus Configuration
```env
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090
METRICS_PREFIX=globaltaxcalc
COLLECT_DEFAULT_METRICS=true
```

#### Health Check Settings
```env
HEALTH_CHECK_INTERVAL=30000
HEALTH_CHECK_TIMEOUT=5000
HEALTH_CHECK_RETRIES=3
DEPENDENCY_CHECK_ENABLED=true
```

#### Alerting Configuration
```env
ALERTING_ENABLED=true
ALERT_EMAIL_ENABLED=true
ALERT_SLACK_ENABLED=true
SMTP_HOST=smtp.gmail.com
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
```

## 📈 API Endpoints

### Health Check Endpoints
- `GET /health` - Overall system health
- `GET /health/liveness` - Kubernetes liveness probe
- `GET /health/readiness` - Kubernetes readiness probe
- `GET /health/startup` - Kubernetes startup probe
- `GET /health/detailed` - Detailed health information (requires API key)

### Metrics Endpoints
- `GET /metrics` - Prometheus metrics (text format)
- `GET /metrics/summary` - JSON metrics summary (requires API key)

### Performance Monitoring
- `GET /performance` - APM performance data (requires API key)

### Log Analytics
- `GET /logs/aggregations/:period` - Log aggregations by time period
- `GET /logs/metrics` - Log-based metrics summary

### Alert Management
- `GET /alerts` - List alerts (with status filtering)
- `POST /alerts` - Send custom alert
- `POST /alerts/:id/acknowledge` - Acknowledge alert
- `POST /alerts/:id/resolve` - Resolve alert
- `POST /alerts/test` - Test all alert channels

### System Information
- `GET /status` - Service status and feature availability
- `GET /config` - Configuration summary (requires API key)

## 📊 Dashboards

### System Overview Dashboard
- Service health status indicators
- HTTP request rates and response times
- Error rates and system resource usage
- Business metrics (calculations, revenue, conversions)
- Database connection pool status

### Service-Specific Dashboard
- Detailed HTTP metrics by status code and route
- Response time distributions and heatmaps
- Database query performance analysis
- Memory usage and garbage collection metrics
- Event loop lag monitoring
- Business calculation success rates

## 🚨 Alerting

### Alert Channels
- **Email**: SMTP-based email notifications
- **Slack**: Webhook-based Slack messages with rich formatting
- **PagerDuty**: Integration for incident management
- **SMS**: Twilio-based SMS for critical alerts

### Alert Types
- **Critical**: Service down, high error rates, system failures
- **Warning**: Performance degradation, threshold breaches
- **Info**: Service starts/stops, configuration changes

### Escalation Policies
- Primary on-call receives initial alerts
- Automatic escalation to secondary after configurable timeout
- Alert suppression to prevent notification fatigue

## 🔍 Monitoring Capabilities

### Metrics Collected
- **HTTP Metrics**: Request rates, response times, status codes
- **Database Metrics**: Query performance, connection pool status
- **System Metrics**: CPU, memory, disk usage, event loop lag
- **Business Metrics**: Tax calculations, revenue, user conversions
- **Error Metrics**: Error rates, categorized error tracking

### Health Checks
- **Service Dependencies**: External API health verification
- **Database Connectivity**: Connection and query validation
- **System Resources**: Memory, disk, and CPU threshold monitoring
- **Runtime Health**: Node.js version, event loop performance

## 🔒 Security

### Authentication
- API key-based authentication for sensitive endpoints
- Rate limiting to prevent abuse
- Request logging for security auditing

### Security Monitoring
- Failed authentication attempts tracking
- Suspicious request pattern detection
- Security event alerting

## 🚀 Deployment

### Docker Deployment
```bash
# Build image
docker build -t globaltaxcalc-monitoring .

# Run container
docker run -d \
  --name monitoring-service \
  -p 3004:3004 \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/.env:/app/.env \
  globaltaxcalc-monitoring
```

### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: monitoring-health-service
spec:
  replicas: 2
  selector:
    matchLabels:
      app: monitoring-health-service
  template:
    metadata:
      labels:
        app: monitoring-health-service
    spec:
      containers:
      - name: monitoring-service
        image: globaltaxcalc-monitoring:latest
        ports:
        - containerPort: 3004
        env:
        - name: NODE_ENV
          value: "production"
        livenessProbe:
          httpGet:
            path: /health/liveness
            port: 3004
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/readiness
            port: 3004
          initialDelaySeconds: 5
          periodSeconds: 5
```

## 🧪 Testing

### Health Check Testing
```bash
# Basic health check
curl http://localhost:3004/health

# Detailed health information
curl -H "X-API-Key: your-api-key" http://localhost:3004/health/detailed
```

### Metrics Testing
```bash
# Prometheus metrics
curl http://localhost:3004/metrics

# JSON metrics summary
curl -H "X-API-Key: your-api-key" http://localhost:3004/metrics/summary
```

### Alert Testing
```bash
# Test all alert channels
curl -X POST -H "X-API-Key: your-api-key" http://localhost:3004/alerts/test

# Send custom alert
curl -X POST -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Alert","description":"Testing alert system","severity":"info"}' \
  http://localhost:3004/alerts
```

## 📝 Logging

### Log Levels
- **Error**: System errors, failures, exceptions
- **Warn**: Performance issues, threshold breaches
- **Info**: Service events, business transactions
- **Debug**: Detailed debugging information

### Log Aggregation
- Automatic log rotation and archiving
- Time-based aggregation (1m, 5m, 15m, 1h, 24h intervals)
- Performance and business metrics extraction
- Error pattern analysis and alerting

## 🔧 Maintenance

### Regular Tasks
- Review and adjust alert thresholds
- Monitor dashboard performance
- Analyze log aggregation reports
- Update Grafana dashboards
- Review security events

### Troubleshooting
- Check service logs: `tail -f logs/application-*.log`
- Verify configuration: `curl localhost:3004/config`
- Test health checks: `curl localhost:3004/health/detailed`
- Monitor resource usage: `curl localhost:3004/performance`

## 📚 Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Dashboard Guide](https://grafana.com/docs/)
- [Winston Logging Best Practices](https://github.com/winstonjs/winston)
- [Sentry Error Tracking](https://docs.sentry.io/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 📞 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation and troubleshooting guides

---

**GlobalTaxCalc Monitoring & Health Service** - Comprehensive monitoring solution for microservices architecture.