# GlobalTaxCalc Notification Service

A comprehensive notification service for the GlobalTaxCalc platform, handling email communications, push notifications, tax deadline reminders, and marketing campaigns with full compliance support.

## Features

### 📧 Email Service
- **SendGrid Integration**: Professional email delivery with high deliverability
- **Responsive Templates**: MJML-based templates optimized for all devices
- **Personalization**: Dynamic content with Handlebars templating
- **Bulk Sending**: Efficient processing of large email campaigns
- **Deliverability Optimization**: ISP-specific optimizations and reputation monitoring

### 📱 Push Notifications
- **Firebase Cloud Messaging**: Cross-platform push notifications (iOS, Android, Web)
- **Topic Management**: Broadcast messages to user segments
- **Device Registration**: Token management and validation
- **Rich Notifications**: Support for images, actions, and deep linking

### ⏰ Scheduled Notifications
- **Tax Deadline Reminders**: Automated reminders for multiple countries
- **Campaign Scheduling**: Time-based marketing campaign delivery
- **Recurring Notifications**: Support for weekly/monthly newsletters
- **Smart Timing**: Timezone-aware delivery optimization

### 🎯 Campaign Management
- **A/B Testing**: Statistical testing framework for campaign optimization
- **Audience Segmentation**: Target specific user groups based on criteria
- **Performance Analytics**: Open rates, click-through rates, conversion tracking
- **Template Management**: Centralized template library with version control

### 🔒 Compliance & Privacy
- **CAN-SPAM Compliance**: US anti-spam law compliance
- **GDPR Compliance**: EU data protection regulation support
- **Unsubscribe Management**: One-click unsubscribe with preference center
- **Suppression Lists**: Automatic bounce and complaint handling

## Quick Start

### Prerequisites
- Node.js 16+
- MongoDB 4.4+
- Redis 6.0+
- SendGrid Account
- Firebase Project (for push notifications)

### Installation

1. **Clone and install dependencies**
```bash
cd notification-service
npm install
```

2. **Environment Setup**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Required Environment Variables**
```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/globaltaxcalc

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# SendGrid
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@globaltaxcalc.com
SENDGRID_FROM_NAME=GlobalTaxCalc

# Firebase (optional, for push notifications)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_PRIVATE_KEY=your_private_key

# Authentication
JWT_SECRET=your_jwt_secret
API_KEY=your_api_key
```

4. **Start the service**
```bash
npm start
```

The service will be available at `http://localhost:3000`

## API Endpoints

### Send Notification
```http
POST /api/notifications/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "email",
  "recipients": ["user@example.com"],
  "template": "welcome",
  "subject": "Welcome to GlobalTaxCalc!",
  "data": {
    "firstName": "John",
    "country": "US"
  }
}
```

### Schedule Notification
```http
POST /api/notifications/schedule
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "email",
  "recipients": ["user@example.com"],
  "template": "tax_reminder",
  "scheduledAt": "2024-04-15T09:00:00Z",
  "data": {
    "deadline": "April 15, 2024",
    "daysLeft": 7
  }
}
```

### User Preferences
```http
GET /api/notifications/preferences/:userId
PUT /api/notifications/preferences/:userId
Authorization: Bearer <token>
```

### Unsubscribe
```http
POST /api/notifications/unsubscribe
Content-Type: application/json

{
  "token": "unsubscribe_token",
  "type": "marketing"
}
```

### Campaign Management
```http
POST /api/notifications/campaign
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Tax Season 2024",
  "type": "email",
  "template": "premium",
  "subject": "Upgrade for Tax Season",
  "audience": {
    "segment": "free_users",
    "country": "US"
  },
  "abTest": {
    "enabled": true,
    "variants": ["subject_a", "subject_b"]
  }
}
```

## Template System

### Available Templates
- `welcome` - New user welcome email
- `tax_reminder` - Tax deadline reminders
- `premium` - Premium upgrade promotions
- `newsletter` - Weekly tax updates
- `abandoned_calculation` - Re-engagement emails

### Template Data
Templates support dynamic data injection:
```javascript
{
  firstName: "John",
  lastName: "Doe",
  country: "United States",
  deadline: "April 15, 2024",
  daysLeft: 7,
  calculationsUsed: 5
}
```

### Custom Templates
Create new MJML templates in `/templates/` directory:
```xml
<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text>Hello {{firstName}}!</mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
```

## Tax Calendar Configuration

The service includes comprehensive tax calendars for multiple countries:

```javascript
// US Tax Calendar
{
  country: 'US',
  deadlines: [
    {
      name: 'Individual Tax Return',
      date: 'April 15',
      type: 'filing',
      reminders: [30, 14, 7, 1] // days before
    }
  ]
}
```

Supported countries: US, CA, UK, AU, DE, FR, JP, IN

## Monitoring & Health Checks

### Health Check
```http
GET /health
```

Returns service status and health of all components:
```json
{
  "status": "healthy",
  "services": {
    "email": { "status": "healthy" },
    "push": { "status": "healthy" },
    "scheduler": { "status": "healthy" }
  }
}
```

### Metrics
- Email delivery rates
- Push notification success rates
- Campaign performance metrics
- Template rendering performance
- API response times

## Development

### Project Structure
```
notification-service/
├── app.js                 # Express application
├── server.js             # Application entry point
├── config/               # Configuration files
├── services/             # Core service modules
├── routes/               # API route handlers
├── middleware/           # Authentication & rate limiting
├── templates/            # Email templates (MJML)
├── locales/             # Internationalization
└── tests/               # Test suites
```

### Running Tests
```bash
npm test                  # Run all tests
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm run test:coverage    # Coverage report
```

### Development Commands
```bash
npm run dev              # Start with nodemon
npm run lint             # ESLint checking
npm run lint:fix         # Auto-fix linting issues
npm run build:templates  # Compile MJML templates
```

## Deployment

### Docker
```bash
docker build -t notification-service .
docker run -p 3000:3000 notification-service
```

### Environment-specific Configuration
- **Development**: Full logging, template hot-reload
- **Staging**: Production-like with debug enabled
- **Production**: Optimized performance, minimal logging

## Security

### Authentication
- JWT token-based authentication
- API key validation for service-to-service
- Role-based access control

### Rate Limiting
- Strict: 10 requests per 15 minutes (sensitive operations)
- Moderate: 100 requests per 15 minutes (general API)
- Email-specific: 50 emails per hour per user

### Data Protection
- Email content encryption in transit
- No storage of personal data beyond preferences
- Automatic PII detection and redaction

## Compliance

### CAN-SPAM Act
- Accurate sender identification
- Clear subject lines
- Physical address inclusion
- One-click unsubscribe
- Suppression list management

### GDPR
- Explicit consent tracking
- Data minimization
- Right to be forgotten
- Consent withdrawal
- Data processing transparency

## Troubleshooting

### Common Issues

**SendGrid API Errors**
- Verify API key permissions
- Check sender authentication
- Review domain verification

**Template Rendering Issues**
- Validate MJML syntax
- Check template data format
- Review Handlebars helpers

**Scheduling Problems**
- Verify Redis connectivity
- Check cron job syntax
- Review timezone configuration

### Logs
```bash
# View application logs
docker logs notification-service

# Follow logs in real-time
docker logs -f notification-service
```

### Support
For technical support or questions:
- Create GitHub issue
- Check API documentation at `/api/docs`
- Review health check endpoint `/health`

## License

Copyright (c) 2024 GlobalTaxCalc. All rights reserved.