# GlobalTaxCalc API Gateway

Enterprise-grade API Gateway for GlobalTaxCalc.com with advanced features including sophisticated rate limiting, API versioning, request/response transformation, comprehensive security, and intelligent load balancing.

## 🚀 Features

### Core Capabilities

- **Advanced Rate Limiting**: User-tier based, IP-based, and endpoint-specific rate limiting with Redis backing
- **API Versioning**: URL-based, header-based versioning with backward compatibility
- **Request/Response Transformation**: Data normalization, format conversion, and legacy API support
- **Comprehensive Security**: API key management, JWT validation, request signing, and DDoS protection
- **Intelligent Caching**: Multi-layer caching with TTL, invalidation, and CDN integration
- **Load Balancing**: Multiple algorithms with health checks, circuit breakers, and failover
- **Real-time Monitoring**: Prometheus metrics, correlation IDs, and performance tracking
- **Auto Documentation**: OpenAPI spec generation, interactive docs, and SDK generation

### Performance & Scalability

- **< 50ms Gateway Overhead**: Optimized request processing pipeline
- **10,000+ RPS Capacity**: Horizontal scaling with Redis clustering
- **Circuit Breaker Protection**: Automatic failover and recovery
- **Intelligent Caching**: Multi-layer caching strategy reducing backend load
- **Connection Pooling**: Optimized database and service connections

## 📋 Quick Start

### Prerequisites

- Node.js 18+
- Redis 6+
- Docker & Docker Compose (optional)

### Installation

1. **Clone and setup**
   ```bash
   git clone <repository>
   cd api-gateway
   npm install
   ```

2. **Environment setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start dependencies**
   ```bash
   # Option 1: Docker Compose (recommended)
   docker-compose up -d redis prometheus grafana

   # Option 2: Local Redis
   redis-server
   ```

4. **Start the gateway**
   ```bash
   # Development
   npm run dev

   # Production
   npm start
   ```

### Docker Deployment

```bash
# Start entire stack
docker-compose up -d

# Start only gateway with dependencies
docker-compose up -d api-gateway redis prometheus
```

## 🔧 Configuration

### Environment Variables

Key configuration options in `.env`:

```env
# Core Settings
NODE_ENV=development
PORT=3000
REDIS_HOST=localhost

# Security
JWT_SECRET=your-secret-key
API_KEY_SECRET=your-api-key-secret

# Features
ENABLE_RATE_LIMITING=true
ENABLE_CACHING=true
ENABLE_MONITORING=true
```

### Rate Limiting Tiers

```javascript
const userTiers = {
  free: { points: 100, duration: 3600 },      // 100 req/hour
  basic: { points: 500, duration: 3600 },     // 500 req/hour
  premium: { points: 2000, duration: 3600 },  // 2000 req/hour
  enterprise: { points: 10000, duration: 3600 } // 10k req/hour
}
```

## 📊 API Usage

### Authentication

**API Key Authentication**
```bash
curl -H "X-API-Key: your-api-key" \
     https://api.globaltaxcalc.com/api/v2/calculate
```

**JWT Authentication**
```bash
curl -H "Authorization: Bearer your-jwt-token" \
     https://api.globaltaxcalc.com/api/v2/users/profile
```

### API Versioning

**URL-based versioning**
```bash
GET /api/v1/calculate  # Version 1.0
GET /api/v2/calculate  # Version 2.0
```

**Header-based versioning**
```bash
curl -H "X-API-Version: 2.0" \
     -H "Accept: application/vnd.globaltaxcalc.v2+json" \
     https://api.globaltaxcalc.com/api/calculate
```

### Example API Calls

**Tax Calculation**
```bash
curl -X POST https://api.globaltaxcalc.com/api/v2/calculate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "income": 50000,
    "filingStatus": "single",
    "taxYear": 2024
  }'
```

**User Management**
```bash
# Get user profile
curl -H "Authorization: Bearer jwt-token" \
     https://api.globaltaxcalc.com/api/v2/users/profile

# Update user
curl -X PUT https://api.globaltaxcalc.com/api/v2/users/profile \
  -H "Authorization: Bearer jwt-token" \
  -H "Content-Type: application/json" \
  -d '{"firstName": "John", "lastName": "Doe"}'
```

## 🛠️ Management & Monitoring

### Health Checks

```bash
# Gateway health
GET /health

# Service status
GET /management/load-balancer/status

# Cache statistics
GET /management/cache/stats
```

### Prometheus Metrics

Available at `/metrics`:

- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request duration histogram
- `rate_limit_hits_total` - Rate limit violations
- `cache_hits_total` - Cache hit/miss ratios
- `circuit_breaker_state` - Circuit breaker status

### Management Endpoints

**Rate Limiter Management**
```bash
# Reset rate limit
POST /management/rate-limiter/reset
{
  "key": "user:123",
  "type": "user_premium"
}

# Get rate limit status
GET /management/rate-limiter/status?key=user:123
```

**Cache Management**
```bash
# Flush all caches
POST /management/cache/flush

# Invalidate by pattern
POST /management/cache/invalidate
{
  "pattern": "/api/v*/users/*"
}
```

**Load Balancer Management**
```bash
# Change algorithm
POST /management/load-balancer/algorithm
{
  "algorithm": "least-connections"
}

# Set instance health
POST /management/load-balancer/instance/health
{
  "serviceName": "calculation-service",
  "instanceId": "calc-1",
  "healthy": false
}
```

## 📚 Documentation

### Interactive API Documentation

- **Swagger UI**: http://localhost:3000/docs
- **API Spec**: http://localhost:3000/api-spec/v2
- **Postman Collection**: http://localhost:3000/postman/v2

### SDK Generation

Download auto-generated SDKs:

```bash
# JavaScript SDK
GET /sdk/javascript/v2

# Python SDK
GET /sdk/python/v2

# PHP SDK
GET /sdk/php/v2
```

### Code Examples

**JavaScript**
```javascript
const client = new GlobalTaxCalcClient('your-api-key');

const result = await client.calculate({
  income: 50000,
  filingStatus: 'single',
  taxYear: 2024
});
```

**Python**
```python
from globaltaxcalc import Client

client = Client('your-api-key')
result = client.calculate(
    income=50000,
    filing_status='single',
    tax_year=2024
)
```

## 🔍 Monitoring & Observability

### Grafana Dashboards

Access monitoring dashboards at http://localhost:3001 (admin/admin123):

- **API Gateway Overview**: Request rates, response times, error rates
- **Rate Limiting**: Tier usage, violations, trending
- **Caching Performance**: Hit ratios, invalidations, memory usage
- **Load Balancer Health**: Service status, response times, circuit breakers
- **Security Metrics**: Authentication failures, blocked requests

### Log Analysis

Structured JSON logs with correlation IDs:

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "info",
  "message": "Request completed successfully",
  "correlationId": "req-123-456",
  "method": "POST",
  "url": "/api/v2/calculate",
  "statusCode": 200,
  "responseTime": 45,
  "userId": "user-789",
  "apiKeyId": "key-abc"
}
```

### Alerting

Built-in alerts for:

- High error rates (>5%)
- Slow response times (>2s)
- Rate limit violations
- Service health failures
- High memory usage (>80%)

## 🚀 Load Testing

### Built-in Load Testing

```bash
# Install artillery
npm install -g artillery

# Run load tests
npm run test:load

# Custom load test
artillery run tests/load/stress-test.yml
```

### Performance Benchmarks

- **Baseline**: 50ms median response time
- **Throughput**: 10,000+ requests/second
- **Concurrent Users**: 1,000+
- **Memory Usage**: <512MB under load
- **CPU Usage**: <70% under normal load

## 🔒 Security Features

### Request Validation

- Input sanitization (XSS, SQL injection prevention)
- Request size limits
- Schema validation
- Rate limiting per endpoint

### Headers & Protection

Automatic security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security`
- `Content-Security-Policy`

### API Key Management

```bash
# Generate new API key
POST /management/api-keys/generate
{
  "name": "mobile-app",
  "scopes": ["read", "calculate"],
  "tier": "premium",
  "expiresAt": "2024-12-31T23:59:59Z"
}

# Revoke API key
DELETE /management/api-keys/{keyId}
```

## 🐳 Production Deployment

### Docker Production

```bash
# Build production image
docker build -t globaltaxcalc/api-gateway .

# Run with production config
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e REDIS_HOST=redis.prod \
  -e JWT_SECRET=prod-secret \
  globaltaxcalc/api-gateway
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-gateway
  template:
    metadata:
      labels:
        app: api-gateway
    spec:
      containers:
      - name: api-gateway
        image: globaltaxcalc/api-gateway:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: REDIS_HOST
          value: "redis-service"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### Scaling Considerations

**Horizontal Scaling**
- Stateless design enables easy horizontal scaling
- Redis clustering for distributed rate limiting
- Load balancer health checks for automatic failover

**Performance Tuning**
- Adjust Node.js cluster workers: `UV_THREADPOOL_SIZE=16`
- Tune Redis memory: `maxmemory 2gb`
- Configure rate limit windows for traffic patterns

## 🔧 Troubleshooting

### Common Issues

**High Memory Usage**
```bash
# Check cache statistics
GET /management/cache/stats

# Clear caches if needed
POST /management/cache/flush
```

**Rate Limit Issues**
```bash
# Check current rate limit status
GET /management/rate-limiter/status?key=user:123

# Reset if needed
POST /management/rate-limiter/reset
```

**Service Connectivity**
```bash
# Check load balancer health
GET /management/load-balancer/status

# View service logs
docker-compose logs calculation-service
```

### Debug Mode

Enable debug logging:
```env
LOG_LEVEL=debug
DEBUG_MODE=true
```

### Health Monitoring

All services expose health endpoints:
- Gateway: `GET /health`
- Redis: `redis-cli ping`
- Microservices: `GET /health`

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

### Development Setup

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run with hot reload
npm run dev

# Lint code
npm run lint
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [API Docs](http://localhost:3000/docs)
- **Issues**: [GitHub Issues](https://github.com/globaltaxcalc/api-gateway/issues)
- **Email**: api-support@globaltaxcalc.com

---

**GlobalTaxCalc API Gateway** - Enterprise-grade API management for tax calculation services.