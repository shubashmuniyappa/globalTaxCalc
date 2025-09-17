# GlobalTaxCalc.com

> Enterprise microservices tax calculator platform for global tax computation and compliance.

[![CI/CD Pipeline](https://github.com/shubashmuniyappa/globalTaxCalc/actions/workflows/ci.yml/badge.svg)](https://github.com/shubashmuniyappa/globalTaxCalc/actions/workflows/ci.yml)
[![Security Scan](https://github.com/shubashmuniyappa/globalTaxCalc/actions/workflows/security.yml/badge.svg)](https://github.com/shubashmuniyappa/globalTaxCalc/actions/workflows/security.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🏗️ Architecture Overview

GlobalTaxCalc is a comprehensive microservices-based tax calculation platform designed for enterprise use. The system is built with scalability, maintainability, and global compliance in mind.

### 🎯 Core Services

| Service | Technology | Port | Description |
|---------|------------|------|-------------|
| **API Gateway** | Node.js | 3000 | Request routing, authentication, rate limiting |
| **Auth Service** | Node.js | 3001 | User authentication, JWT management |
| **Tax Engine** | Python | 8000 | Core tax calculation algorithms |
| **Geolocation Service** | Node.js | 3002 | Location-based tax rate determination |
| **AI Service** | Python | 8001 | AI-powered tax optimization |
| **Content Service** | Node.js | 3003 | CMS, blogs, documentation |
| **Analytics Service** | Node.js | 3004 | User behavior tracking, metrics |
| **Notification Service** | Node.js | 3005 | Email/SMS notifications |
| **Ad Service** | Node.js | 3006 | Advertisement management |
| **File Service** | Node.js | 3007 | File uploads, document processing |
| **Report Service** | Python | 8002 | PDF/Excel report generation |
| **Monitoring Service** | Node.js | 3008 | Health checks, system monitoring |
| **Frontend** | Next.js | 3009 | Web application interface |

### 🗄️ Data Storage

- **PostgreSQL**: Primary database for transactional data
- **MongoDB**: Document storage for content and files
- **Redis**: Caching and session management

## 🚀 Quick Start

### Prerequisites

- **Docker & Docker Compose**: Latest version
- **Node.js**: v18+ (for local development)
- **Python**: v3.11+ (for local development)
- **Git**: Latest version

### 1. Clone the Repository

```bash
git clone https://github.com/shubashmuniyappa/globalTaxCalc.git
cd globalTaxCalc
```

### 2. Environment Setup

Copy environment files and configure:

```bash
# Run the setup script
./scripts/setup.sh

# Or manually:
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start Development Environment

```bash
# Start all services with Docker Compose
docker-compose up -d

# Or start specific services
docker-compose up api-gateway auth-service tax-engine
```

### 4. Verify Installation

```bash
# Check all services are running
docker-compose ps

# Test API Gateway
curl http://localhost:3000/health

# View logs
docker-compose logs -f api-gateway
```

## 🛠️ Development

### Local Development Setup

1. **Install Dependencies**

```bash
# Node.js services
cd api-gateway && npm install
cd ../auth-service && npm install
# ... repeat for all Node.js services

# Python services
cd tax-engine && pip install -r requirements.txt
cd ../ai-service && pip install -r requirements.txt
cd ../report-service && pip install -r requirements.txt
```

2. **Database Setup**

```bash
# Start databases only
docker-compose up -d postgres mongodb redis

# Run migrations
cd auth-service && npm run migrate
```

3. **Start Services Individually**

```bash
# Start API Gateway
cd api-gateway && npm run dev

# Start Tax Engine
cd tax-engine && uvicorn main:app --reload --port 8000

# Start Frontend
cd frontend && npm run dev
```

### Testing

```bash
# Run all tests
npm test

# Test specific service
cd auth-service && npm test

# Python tests
cd tax-engine && pytest

# Integration tests
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

### Code Quality

```bash
# Linting
npm run lint        # Node.js services
flake8 .           # Python services

# Formatting
npm run lint:fix    # Node.js services
black .            # Python services

# Type checking
npm run type-check  # TypeScript services
mypy .             # Python services
```

## 📂 Project Structure

```
globalTaxCalc/
├── api-gateway/              # API Gateway service
├── auth-service/             # Authentication service
├── tax-engine/               # Core tax calculation (Python)
├── geolocation-service/      # Location services
├── ai-service/               # AI/ML services (Python)
├── content-service/          # Content management
├── analytics-service/        # Analytics and metrics
├── notification-service/     # Notifications
├── ad-service/              # Advertisement management
├── file-service/            # File handling
├── report-service/          # Report generation (Python)
├── monitoring-service/      # System monitoring
├── frontend/                # Next.js web application
├── shared/                  # Shared utilities
│   ├── database/           # Database connections
│   ├── middleware/         # Common middleware
│   ├── utils/             # Utility functions
│   ├── schemas/           # API schemas
│   └── config/            # Configuration
├── .github/workflows/      # CI/CD pipelines
├── scripts/               # Setup and utility scripts
└── docs/                  # Documentation
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```bash
# Database URLs
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/globaltaxcalc
MONGODB_URL=mongodb://mongo:mongo@localhost:27017/globaltaxcalc
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# API Keys
OPENAI_API_KEY=your-openai-api-key
GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# Email Configuration
SENDGRID_API_KEY=your-sendgrid-api-key
EMAIL_FROM=noreply@globaltaxcalc.com

# AWS Configuration
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_S3_BUCKET=globaltaxcalc-files

# External Services
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token

# Environment
NODE_ENV=development
LOG_LEVEL=info
```

### Service-Specific Configuration

Each service has its own configuration files:

- `api-gateway/config/`
- `auth-service/config/`
- etc.

## 🚀 Deployment

### Railway.app Deployment

1. **Connect Repository**
   - Connect your GitHub repository to Railway.app
   - Each service will be deployed separately

2. **Configure Environment Variables**
   - Set production environment variables in Railway dashboard
   - Use Railway's managed databases

3. **Deploy**
   ```bash
   # Automatic deployment on push to main branch
   git push origin main
   ```

### Manual Deployment

1. **Build Docker Images**
   ```bash
   # Build all services
   docker-compose -f docker-compose.prod.yml build

   # Push to registry
   docker-compose -f docker-compose.prod.yml push
   ```

2. **Deploy to Production**
   ```bash
   # Deploy with production configuration
   docker-compose -f docker-compose.prod.yml up -d
   ```

## 📊 Monitoring & Health Checks

### Health Check Endpoints

- **API Gateway**: `GET /health`
- **All Services**: `GET /health`

### Monitoring Dashboard

Access monitoring dashboard at: `http://localhost:3008/dashboard`

### Logs

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f auth-service

# View logs in production
railway logs --service=auth-service
```

## 🔒 Security

### Authentication Flow

1. User login → Auth Service
2. JWT token generation
3. Token validation via API Gateway
4. Service-to-service communication

### Security Features

- JWT-based authentication
- Rate limiting
- CORS protection
- Input validation
- SQL injection protection
- XSS protection
- HTTPS enforcement (production)

## 📚 API Documentation

### API Gateway Routes

- **Auth**: `/api/auth/*` → Auth Service
- **Tax**: `/api/tax/*` → Tax Engine
- **Location**: `/api/location/*` → Geolocation Service
- **AI**: `/api/ai/*` → AI Service
- **Content**: `/api/content/*` → Content Service
- **Analytics**: `/api/analytics/*` → Analytics Service
- **Files**: `/api/files/*` → File Service
- **Reports**: `/api/reports/*` → Report Service

### Service Documentation

- Swagger/OpenAPI docs available at: `http://localhost:PORT/docs`
- Postman collection: `docs/api/GlobalTaxCalc.postman_collection.json`

## 🧪 Testing Strategy

### Test Types

1. **Unit Tests**: Individual function/method testing
2. **Integration Tests**: Service interaction testing
3. **End-to-End Tests**: Full workflow testing
4. **Load Tests**: Performance and scalability testing

### Running Tests

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Load tests
npm run test:load
```

## 🤝 Contributing

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/new-feature`
3. **Make changes and test**: `npm test`
4. **Commit changes**: `git commit -m "Add new feature"`
5. **Push to branch**: `git push origin feature/new-feature`
6. **Create Pull Request**

### Development Guidelines

- Follow ESLint/Prettier configurations
- Write tests for new features
- Update documentation
- Use conventional commit messages
- Ensure all CI checks pass

## 🐛 Troubleshooting

### Common Issues

1. **Port Conflicts**
   ```bash
   # Check what's using the port
   lsof -i :3000

   # Kill process
   kill -9 <PID>
   ```

2. **Database Connection Issues**
   ```bash
   # Reset databases
   docker-compose down -v
   docker-compose up -d postgres mongodb redis
   ```

3. **Service Not Starting**
   ```bash
   # Check logs
   docker-compose logs service-name

   # Rebuild service
   docker-compose build service-name
   ```

### Getting Help

- **Issues**: Create GitHub issue
- **Discussions**: Use GitHub discussions
- **Email**: support@globaltaxcalc.com

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **Website**: [https://globaltaxcalc.com](https://globaltaxcalc.com)
- **Documentation**: [https://docs.globaltaxcalc.com](https://docs.globaltaxcalc.com)
- **API Status**: [https://status.globaltaxcalc.com](https://status.globaltaxcalc.com)

---

**Built with ❤️ by the GlobalTaxCalc Team**