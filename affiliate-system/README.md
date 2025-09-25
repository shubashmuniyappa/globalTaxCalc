# GlobalTaxCalc Affiliate System

Enterprise-grade affiliate management system for GlobalTaxCalc.com with advanced tracking, commission management, fraud prevention, and automated payment processing.

## 🚀 Features

### Core Functionality

- **Affiliate Management**: Complete registration, approval, and profile management system
- **Advanced Tracking**: Click tracking with fraud detection and attribution modeling
- **Commission Management**: Flexible commission structures with tiered rates and bonuses
- **Automated Payments**: Multi-method payment processing with tax form generation
- **Real-time Dashboard**: Comprehensive analytics and performance metrics
- **Fraud Prevention**: Advanced algorithms for click fraud and pattern detection
- **Compliance Management**: FTC disclosure automation and audit trail maintenance

### Performance & Security

- **High Performance**: Handles 10,000+ requests/second with Redis caching
- **Fraud Detection**: Multi-layered fraud prevention with machine learning algorithms
- **Compliance Ready**: FTC, GDPR, and jurisdiction-specific compliance features
- **Secure Architecture**: JWT authentication, API key management, and encrypted data
- **Real-time Analytics**: Live performance tracking and reporting

## 📋 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 12+
- Redis 6+
- Docker & Docker Compose (optional)

### Installation

1. **Clone and setup**
   ```bash
   git clone <repository>
   cd affiliate-system
   npm install
   ```

2. **Environment setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Database setup**
   ```bash
   # Create database
   createdb affiliate_system

   # Run migrations
   npm run db:migrate

   # Seed initial data (optional)
   npm run db:seed
   ```

4. **Start dependencies**
   ```bash
   # Option 1: Docker Compose (recommended)
   docker-compose up -d redis postgres

   # Option 2: Local services
   redis-server
   # Start PostgreSQL service
   ```

5. **Start the application**
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

# Start only core services
docker-compose up -d affiliate-system redis postgres
```

## 🔧 Configuration

### Environment Variables

Key configuration options in `.env`:

```env
# Core Settings
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:pass@localhost:5432/affiliate_system

# Security
JWT_SECRET=your-secret-key
API_KEY_SECRET=your-api-key-secret

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Payment Processing
PAYPAL_CLIENT_ID=your-paypal-client-id
STRIPE_SECRET_KEY=your-stripe-secret-key
MINIMUM_PAYOUT_THRESHOLD=50.00

# Fraud Prevention
FRAUD_SCORE_THRESHOLD=0.7
BLOCK_SCORE_THRESHOLD=0.8
```

### Commission Structures

Configure flexible commission rates:

```javascript
const commissionStructure = {
  type: 'percentage', // percentage, fixed, tiered, hybrid
  baseRate: 5.0,      // 5% commission
  tierBased: true,
  tierStructure: [
    { tier: 1, multiplier: 1.0 },   // 5%
    { tier: 2, multiplier: 1.2 },   // 6%
    { tier: 3, multiplier: 1.5 },   // 7.5%
    { tier: 4, multiplier: 2.0 },   // 10%
    { tier: 5, multiplier: 2.5 }    // 12.5%
  ]
};
```

## 📊 API Usage

### Authentication

**JWT Authentication**
```bash
curl -H "Authorization: Bearer your-jwt-token" \
     https://api.globaltaxcalc.com/api/dashboard
```

**API Key Authentication**
```bash
curl -H "X-API-Key: your-api-key" \
     https://api.globaltaxcalc.com/api/links
```

### Core Endpoints

**Affiliate Registration**
```bash
curl -X POST https://api.globaltaxcalc.com/api/affiliates/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "affiliate@example.com",
    "password": "securepassword",
    "firstName": "John",
    "lastName": "Doe",
    "companyName": "Marketing Co"
  }'
```

**Create Tracking Link**
```bash
curl -X POST https://api.globaltaxcalc.com/api/links \
  -H "Authorization: Bearer jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "originalUrl": "https://globaltaxcalc.com/calculator",
    "campaignName": "Q4 Tax Season",
    "campaignType": "email"
  }'
```

**Track Click**
```bash
# Automatic redirect to original URL
GET https://api.globaltaxcalc.com/click/{linkCode}
```

**Process Conversion**
```bash
curl -X POST https://api.globaltaxcalc.com/webhook/conversion \
  -H "Content-Type: application/json" \
  -d '{
    "clickId": "click-uuid",
    "orderId": "order-123",
    "orderValue": 99.99,
    "productId": "tax-calc-pro"
  }'
```

## 📈 Dashboard & Analytics

### Core Metrics

- **Performance**: Clicks, conversions, conversion rates, earnings
- **Geographic**: Country-wise traffic distribution and performance
- **Device**: Desktop vs mobile performance analytics
- **Traffic Sources**: Referrer analysis and attribution
- **Fraud Detection**: Suspicious activity monitoring

### Real-time Features

- Live click tracking
- Instant conversion notifications
- Performance alerts
- Payment status updates

## 💰 Payment Processing

### Supported Methods

- **PayPal**: Automated payouts via PayPal API
- **Stripe**: Direct bank transfers and cards
- **Bank Transfer**: ACH and wire transfers
- **Check**: Physical check processing

### Payment Features

- Automated threshold-based payments
- Tax form generation (1099-NEC)
- Multiple payment schedules
- Currency conversion support
- Failed payment retry logic

### Tax Compliance

- Automatic 1099 generation for $600+ payments
- Tax classification tracking
- Withholding calculations
- Audit trail maintenance

## 🛡️ Fraud Prevention

### Detection Methods

- **IP Analysis**: Suspicious IP patterns and geolocation jumps
- **Click Patterns**: Velocity, timing, and behavioral analysis
- **Device Fingerprinting**: Browser and device consistency checks
- **Attribution Validation**: Cross-device and multi-touch analysis

### Fraud Scoring

```javascript
const fraudFactors = {
  ipSuspicious: 0.3,
  rapidClicks: 0.4,
  botUserAgent: 0.5,
  geoInconsistency: 0.6,
  patternMatching: 0.3
};
// Combined score determines action (monitor, flag, block)
```

## ⚖️ Compliance Features

### FTC Compliance

- Automatic disclosure detection
- Placement validation
- Content compliance checking
- Audit trail maintenance

### GDPR Compliance

- Data processing consent
- Right to erasure
- Data portability
- Retention management

### Audit Trail

All system activities are logged:
- Affiliate registrations and modifications
- Link creation and updates
- Click and conversion tracking
- Payment processing
- Compliance checks

## 🔍 Monitoring & Observability

### Health Checks

```bash
# System health
GET /health

# Service status
GET /api/admin/status

# Performance metrics
GET /metrics (Prometheus format)
```

### Key Metrics

- Request/response times
- Fraud detection rates
- Payment success rates
- Commission calculations
- Database performance

### Alerting

Built-in alerts for:
- High fraud scores
- Payment failures
- System errors
- Performance degradation

## 🚀 Production Deployment

### Docker Production

```bash
# Build production image
docker build -t globaltaxcalc/affiliate-system .

# Run with production config
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL=postgresql://prod-db \
  -e REDIS_HOST=redis.prod \
  globaltaxcalc/affiliate-system
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: affiliate-system
spec:
  replicas: 3
  selector:
    matchLabels:
      app: affiliate-system
  template:
    metadata:
      labels:
        app: affiliate-system
    spec:
      containers:
      - name: affiliate-system
        image: globaltaxcalc/affiliate-system:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
```

### Scaling Considerations

**Horizontal Scaling**
- Stateless design enables easy horizontal scaling
- Redis clustering for distributed caching
- Load balancer health checks

**Performance Tuning**
- Database connection pooling
- Redis memory optimization
- Query optimization and indexing
- CDN integration for static assets

## 🔧 Development

### Project Structure

```
src/
├── config/           # Database and Redis configuration
├── controllers/      # Request handlers and business logic
├── middleware/       # Authentication, validation, error handling
├── models/          # Database models and ORM
├── routes/          # API route definitions
├── services/        # Business logic and external integrations
├── utils/           # Helper functions and utilities
├── database/
│   ├── migrations/  # Database schema migrations
│   └── seeds/       # Initial data seeding
└── templates/       # Email and notification templates
```

### Available Scripts

```bash
npm start          # Start production server
npm run dev        # Start development server with hot reload
npm test           # Run test suite
npm run test:coverage  # Run tests with coverage
npm run lint       # Lint code
npm run lint:fix   # Fix linting issues
npm run db:migrate # Run database migrations
npm run db:seed    # Seed database with initial data
npm run db:rollback # Rollback last migration
```

### Database Migrations

```bash
# Create new migration
npx knex migrate:make migration_name

# Run migrations
npm run db:migrate

# Rollback last migration
npm run db:rollback
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

### Development Guidelines

- Follow ESLint configuration
- Write tests for new features
- Update documentation
- Maintain backward compatibility
- Follow security best practices

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [API Docs](http://localhost:3000/docs)
- **Issues**: [GitHub Issues](https://github.com/globaltaxcalc/affiliate-system/issues)
- **Email**: affiliate-support@globaltaxcalc.com

---

**GlobalTaxCalc Affiliate System** - Enterprise-grade affiliate management for tax calculation services.