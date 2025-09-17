# GlobalTaxCalc API Gateway

> Production-ready API Gateway for GlobalTaxCalc microservices platform

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](https://www.docker.com/)
[![Railway](https://img.shields.io/badge/railway-deployable-purple.svg)](https://railway.app/)

## 🚀 Features

### Core Functionality
- **Request Routing**: Intelligent routing to 12 microservices
- **Load Balancing**: Automatic failover and health monitoring
- **Authentication**: JWT-based auth with Redis session management
- **Rate Limiting**: Configurable rate limits per endpoint type
- **Security**: Comprehensive security headers and input validation

### Production Ready
- **Service Discovery**: Dynamic service registration and health checks
- **Monitoring**: Health checks, metrics, and structured logging
- **Documentation**: OpenAPI/Swagger documentation
- **Deployment**: Docker containers with Railway.app support
- **SSL/TLS**: NGINX reverse proxy with SSL termination

## 📁 Architecture

```
api-gateway/
├── server.js              # Main Express application
├── config/                # Configuration management
├── middleware/            # Custom middleware
│   ├── auth.js           # Authentication & authorization
│   ├── validation.js     # Input validation & sanitization
│   └── errorHandler.js   # Error handling
├── routes/               # Route handlers
│   └── health.js         # Health check endpoints
├── services/             # Business services
│   └── serviceRegistry.js # Service discovery
├── utils/                # Utilities
│   ├── logger.js         # Winston logger
│   └── redis.js          # Redis client
├── nginx/                # NGINX reverse proxy
└── test/                 # Test suites
```

## 🛠️ Installation

### Prerequisites
- Node.js 18+
- Redis
- Docker (optional)

### Local Development

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit environment variables
nano .env

# Start development server
npm run dev
```

### Docker Development

```bash
# Build and start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f api-gateway

# Stop services
docker-compose down
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production) | `development` |
| `PORT` | Server port | `3000` |
| `JWT_SECRET` | JWT secret key | Required |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `RATE_LIMIT_WINDOW` | Rate limit window (ms) | `900000` |
| `RATE_LIMIT_MAX` | Max requests per window | `100` |
| `CORS_ORIGIN` | Allowed CORS origins | `http://localhost:3009` |

### Service URLs

All microservice URLs are configurable:

```bash
AUTH_SERVICE_URL=http://localhost:3001
TAX_ENGINE_URL=http://localhost:8000
GEOLOCATION_SERVICE_URL=http://localhost:3002
AI_SERVICE_URL=http://localhost:8001
CONTENT_SERVICE_URL=http://localhost:3003
ANALYTICS_SERVICE_URL=http://localhost:3004
NOTIFICATION_SERVICE_URL=http://localhost:3005
AD_SERVICE_URL=http://localhost:3006
FILE_SERVICE_URL=http://localhost:3007
REPORT_SERVICE_URL=http://localhost:8002
MONITORING_SERVICE_URL=http://localhost:3008
```

## 📊 API Routes

### Core Routes

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| `GET` | `/` | API Gateway info | ❌ |
| `GET` | `/health` | Basic health check | ❌ |
| `GET` | `/health/detailed` | Detailed health info | ❌ |
| `GET` | `/api-docs` | Swagger documentation | ❌ |

### Service Routes

| Path Pattern | Target Service | Auth Required | Rate Limit |
|--------------|----------------|---------------|------------|
| `/api/auth/*` | Auth Service | ❌ | Strict |
| `/api/tax/*` | Tax Engine | ✅ | Premium |
| `/api/location/*` | Geolocation | ✅ | Standard |
| `/api/ai/*` | AI Service | ✅ | Premium |
| `/api/content/*` | Content Service | ❌ | Standard |
| `/api/analytics/*` | Analytics | ✅ | Standard |
| `/api/notifications/*` | Notifications | ✅ | Standard |
| `/api/ads/*` | Ad Service | ❌ | Standard |
| `/api/files/*` | File Service | ✅ | Standard |
| `/api/reports/*` | Report Service | ✅ | Premium |
| `/api/monitoring/*` | Monitoring | ✅ | Standard |

## 🔒 Security Features

### Authentication
- JWT token validation
- Redis-based session management
- API key authentication for server-to-server
- Token blacklisting support

### Rate Limiting
- IP-based rate limiting
- User-based rate limiting for authenticated users
- Different limits for different endpoint types
- Premium user higher limits

### Input Validation
- Request sanitization
- XSS protection
- SQL injection prevention
- Request size limiting
- Content type validation

### Security Headers
- Helmet.js security headers
- CORS configuration
- Content Security Policy
- HSTS in production

## 📈 Monitoring

### Health Checks

```bash
# Basic health check
curl http://localhost:3000/health

# Detailed health with dependencies
curl http://localhost:3000/health/detailed

# Service-specific health
curl http://localhost:3000/health/services/auth-service

# Kubernetes readiness probe
curl http://localhost:3000/health/ready

# Kubernetes liveness probe
curl http://localhost:3000/health/live

# System metrics
curl http://localhost:3000/health/metrics
```

### Logging

Structured logging with Winston:

- **Console**: Development environment
- **Files**: Production logging to files
- **Levels**: error, warn, info, http, debug

### Service Discovery

Automatic service health monitoring:

- Periodic health checks (30s intervals)
- Automatic failover
- Circuit breaker pattern
- Service recovery detection

## 🚀 Deployment

### Railway.app Deployment

1. **Connect Repository**
   ```bash
   # Railway will automatically detect railway.json
   railway login
   railway link
   railway up
   ```

2. **Environment Variables**
   Set in Railway dashboard:
   - `JWT_SECRET`
   - `REDIS_URL` (provided by Railway Redis)
   - Service URLs (provided by Railway)

3. **Custom Domain**
   - Configure custom domain in Railway
   - SSL certificates managed automatically

### Docker Production

```bash
# Build production image
docker build --target production -t api-gateway:prod .

# Run production container
docker run -d \
  --name api-gateway \
  -p 3000:3000 \
  --env-file .env.production \
  api-gateway:prod
```

### NGINX Reverse Proxy

```bash
# Build NGINX container
cd nginx && docker build -t api-gateway-nginx .

# Run with SSL certificates
docker run -d \
  --name nginx-proxy \
  -p 80:80 -p 443:443 \
  -v /path/to/certs:/etc/nginx/ssl \
  api-gateway-nginx
```

## 🧪 Testing

### Running Tests

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Linting
npm run lint

# Fix linting issues
npm run lint:fix
```

### Test Structure

```bash
test/
├── setup.js           # Test configuration
├── health.test.js     # Health endpoint tests
└── middleware.test.js # Middleware tests
```

## 📚 API Documentation

Interactive API documentation available at:
- **Development**: http://localhost:3000/api-docs
- **Production**: https://yourdomain.com/api-docs

OpenAPI specification: `/api-docs.json`

## 🔄 Development Workflow

### Adding New Services

1. **Register Service**
   ```javascript
   // In config/index.js
   SERVICES: {
     'new-service': process.env.NEW_SERVICE_URL || 'http://localhost:3010'
   }
   ```

2. **Add Route**
   ```javascript
   // In server.js serviceRoutes array
   {
     path: '/api/new-service',
     target: 'new-service',
     auth: true,
     rateLimit: 'standard'
   }
   ```

3. **Update Documentation**
   ```javascript
   // In swagger.js
   // Add new tag and paths
   ```

### Middleware Development

Custom middleware should:
- Handle errors gracefully
- Add appropriate logging
- Follow authentication patterns
- Include proper validation

## 🚨 Troubleshooting

### Common Issues

1. **Service Connection Errors**
   ```bash
   # Check service health
   curl http://localhost:3000/health/services

   # Check specific service
   curl http://localhost:3000/health/services/auth-service
   ```

2. **Rate Limiting Issues**
   ```bash
   # Check rate limit headers
   curl -I http://localhost:3000/api/some-endpoint
   ```

3. **Authentication Problems**
   ```bash
   # Verify JWT token
   # Check Redis connection
   # Validate environment variables
   ```

### Monitoring Commands

```bash
# View logs
docker-compose logs -f api-gateway

# Check Redis connection
redis-cli ping

# Monitor resource usage
docker stats api-gateway
```

## 🤝 Contributing

1. **Development Setup**
   ```bash
   git clone <repository>
   cd api-gateway
   npm install
   cp .env.example .env
   npm run dev
   ```

2. **Code Standards**
   - ESLint configuration enforced
   - Test coverage required
   - Documentation updates required

3. **Pull Request Process**
   - Run tests: `npm test`
   - Check linting: `npm run lint`
   - Update documentation
   - Add appropriate tests

## 📄 License

MIT License - see LICENSE file for details.

---

**Built with ❤️ for GlobalTaxCalc.com**