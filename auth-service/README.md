# GlobalTaxCalc Authentication Service

A comprehensive authentication and authorization microservice built with Node.js, Express, PostgreSQL, and JWT tokens. This service provides secure user management, session handling, OAuth integration, and advanced security features for the GlobalTaxCalc platform.

## Features

### 🔐 Authentication & Authorization
- **User Registration & Login**: Email/password authentication with secure password hashing
- **JWT Token Management**: Access and refresh token system with automatic rotation
- **Session Management**: Support for both guest and authenticated user sessions
- **Two-Factor Authentication**: TOTP-based 2FA with backup codes
- **Password Reset**: Secure token-based password reset flow
- **Email Verification**: Account verification via email tokens

### 🔗 OAuth Integration
- **Google Sign-In**: Complete Google OAuth 2.0 integration
- **Apple Sign-In**: Apple ID authentication support
- **Provider Linking**: Link/unlink OAuth providers to existing accounts
- **Automatic Account Creation**: Seamless registration via OAuth providers

### 🛡️ Security Features
- **Account Lockout**: Automatic lockout after failed login attempts
- **Rate Limiting**: Comprehensive rate limiting with Redis backing
- **Suspicious Activity Detection**: Pattern-based threat detection
- **Device Fingerprinting**: Device tracking and trusted device management
- **Audit Logging**: Complete security event logging with risk scoring
- **CSRF Protection**: Cross-site request forgery protection
- **Input Sanitization**: XSS and injection attack prevention

### 📊 Monitoring & Health
- **Health Checks**: Comprehensive health monitoring for Kubernetes/Railway
- **Metrics Collection**: Real-time performance and security metrics
- **Structured Logging**: Winston-based logging with multiple transports
- **Error Handling**: Centralized error handling with detailed reporting

### 🔄 Subscription Management
- **Tier Management**: Free, Premium, and Enterprise subscription tiers
- **Usage Tracking**: API usage limits and tracking per subscription
- **Upgrade/Downgrade**: Seamless subscription management

## Tech Stack

- **Runtime**: Node.js 18+ with Express.js
- **Database**: PostgreSQL with Sequelize ORM
- **Cache**: Redis for sessions and rate limiting
- **Authentication**: JWT tokens with bcrypt password hashing
- **Email**: SendGrid or SMTP with HTML templates
- **Monitoring**: Winston logging with custom metrics
- **Deployment**: Docker containers for Railway.app

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Redis 7+ (optional, for production features)

### Installation

1. **Clone and install dependencies**:
```bash
cd auth-service
npm install
```

2. **Set up environment variables**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Set up the database**:
```bash
# Create database
createdb globaltaxcalc_dev

# Run migrations
npm run migrate

# Seed data (optional)
npm run seed
```

4. **Start the development server**:
```bash
npm run dev
```

The service will be available at `http://localhost:3001`

### Environment Variables

#### Required
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/globaltaxcalc_dev
# OR individual database config:
DB_HOST=localhost
DB_PORT=5432
DB_NAME=globaltaxcalc_dev
DB_USERNAME=postgres
DB_PASSWORD=postgres

# Security
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
SESSION_SECRET=your-super-secret-session-key-min-32-chars
```

#### Optional
```env
# Redis (for production features)
REDIS_URL=redis://localhost:6379

# Email Service
SENDGRID_API_KEY=your-sendgrid-api-key
# OR SMTP configuration:
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# OAuth Providers
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
APPLE_CLIENT_ID=your-apple-client-id
APPLE_TEAM_ID=your-apple-team-id
APPLE_KEY_ID=your-apple-key-id
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# Frontend URLs
FRONTEND_URL=http://localhost:3009
CORS_ORIGIN=http://localhost:3009
```

## API Documentation

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "gdprConsent": true,
  "marketingConsent": false
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "rememberMe": false,
  "deviceInfo": {
    "deviceType": "desktop",
    "browserName": "Chrome",
    "os": "Windows"
  }
}
```

#### OAuth Login
```http
POST /api/oauth/google/login
Content-Type: application/json

{
  "idToken": "google-id-token",
  "deviceInfo": {
    "deviceType": "mobile",
    "browserName": "Safari",
    "os": "iOS"
  }
}
```

### User Management Endpoints

#### Get Profile
```http
GET /api/users/profile
Authorization: Bearer your-access-token
```

#### Update Profile
```http
PATCH /api/users/profile
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "firstName": "Jane",
  "lastName": "Smith",
  "marketingConsent": true
}
```

#### Setup Two-Factor Authentication
```http
POST /api/users/2fa/setup
Authorization: Bearer your-access-token
```

### Health & Monitoring

#### Health Check
```http
GET /health
```

#### Detailed Health
```http
GET /health/detailed
```

#### Metrics
```http
GET /health/metrics
```

## Database Schema

### Users Table
- `id` (UUID, Primary Key)
- `email` (String, Unique)
- `password_hash` (String)
- `first_name` (String)
- `last_name` (String)
- `role` (Enum: user, premium, admin)
- `subscription_status` (Enum: free, premium, enterprise)
- `email_verified` (Boolean)
- `two_factor_enabled` (Boolean)
- `is_active` (Boolean)
- Security and GDPR fields
- Timestamps

### Sessions Table
- `id` (UUID, Primary Key)
- `session_id` (String, Unique)
- `user_id` (UUID, Foreign Key)
- `session_type` (Enum: guest, authenticated)
- `device_info` (JSON)
- `ip_address` (String)
- `expires_at` (Date)
- Timestamps

### Audit Logs Table
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key)
- `event_type` (String)
- `ip_address` (String)
- `user_agent` (String)
- `details` (JSON)
- `risk_score` (Integer)
- Timestamps

## Deployment

### Docker Deployment

1. **Build the Docker image**:
```bash
docker build -t globaltaxcalc-auth .
```

2. **Run with Docker Compose**:
```bash
docker-compose up -d
```

### Railway.app Deployment

1. **Connect your GitHub repository to Railway**

2. **Set environment variables in Railway dashboard**:
   - `DATABASE_URL` (PostgreSQL connection string)
   - `JWT_SECRET`
   - `SESSION_SECRET`
   - `SENDGRID_API_KEY`
   - OAuth provider credentials
   - `FRONTEND_URL`

3. **Deploy**:
   Railway will automatically build and deploy using the included `railway.toml` configuration.

### Environment-Specific Settings

#### Development
- Database: Local PostgreSQL
- Redis: Optional (memory fallback)
- Email: Ethereal test emails
- Logging: Console with debug level

#### Production
- Database: Railway PostgreSQL
- Redis: Railway Redis
- Email: SendGrid
- Logging: File + Console with info level
- Security: All features enabled

## Security Considerations

### Password Security
- bcrypt with 12 salt rounds
- Password strength requirements
- Common password blacklist
- Password history tracking

### Session Security
- Secure HTTP-only cookies
- CSRF token validation
- Session rotation on privilege escalation
- Device fingerprint validation

### API Security
- Rate limiting per IP and user
- Input sanitization and validation
- SQL injection prevention
- XSS protection headers

### Monitoring
- Failed login attempt tracking
- Suspicious activity detection
- Real-time security alerts
- Comprehensive audit logging

## Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:security

# Generate coverage report
npm run test:coverage
```

## Development

### Database Migrations

```bash
# Create new migration
npm run migration:create -- --name add-new-column

# Run migrations
npm run migrate

# Rollback migration
npm run migrate:rollback
```

### Adding New Features

1. **Create database migration** (if needed)
2. **Update Sequelize models**
3. **Add service layer logic**
4. **Create controller methods**
5. **Add routes with validation**
6. **Update tests**
7. **Update documentation**

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check PostgreSQL is running
   - Verify connection string
   - Check firewall settings

2. **JWT Token Invalid**
   - Verify JWT_SECRET is set
   - Check token expiration
   - Ensure clock synchronization

3. **Email Not Sending**
   - Verify SendGrid API key
   - Check SMTP credentials
   - Review email service logs

4. **OAuth Errors**
   - Verify OAuth provider credentials
   - Check redirect URLs
   - Review OAuth consent screens

### Logging

Logs are structured using Winston:

```bash
# View application logs
tail -f logs/combined.log

# View error logs only
tail -f logs/error.log

# Development console logs
npm run dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement changes with tests
4. Update documentation
5. Submit a pull request

## License

This project is proprietary to GlobalTaxCalc.com. All rights reserved.

## Support

For technical support or questions:
- Email: tech@globaltaxcalc.com
- Documentation: https://docs.globaltaxcalc.com/auth
- Status Page: https://status.globaltaxcalc.com