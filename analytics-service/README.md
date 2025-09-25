# Analytics & Tracking Service

A comprehensive analytics and tracking service for GlobalTaxCalc.com built with Node.js, ClickHouse, Redis, and GDPR compliance features.

## 🚀 Features

### Analytics & Tracking
- **Real-time Event Tracking**: Page views, calculator usage, user interactions, conversions, errors, and performance metrics
- **Session Management**: Anonymous user sessions with bot detection and timeout handling
- **User Behavior Analytics**: Complete user journey tracking with session stitching across devices
- **Performance Monitoring**: Page load times, DOM ready events, and error tracking

### A/B Testing Framework
- **Experiment Management**: Create, start, pause, and end A/B tests with statistical analysis
- **Variant Assignment**: Consistent user assignment using hashing algorithms
- **Statistical Analysis**: Automatic significance testing with confidence intervals
- **Conversion Tracking**: Track conversions and calculate lift with proper attribution

### Conversion Funnel Analysis
- **Multi-step Funnels**: Define and analyze complex conversion funnels
- **Drop-off Analysis**: Identify where users leave your conversion process
- **Cohort Analysis**: Track user behavior over time periods
- **Attribution Modeling**: Understand which touchpoints drive conversions

### Real-time Dashboards
- **Live Metrics**: Real-time visitor counts, popular pages, and conversion rates
- **Historical Analysis**: Trends and patterns over time with customizable date ranges
- **Segmentation**: Analyze data by country, device type, traffic source, and custom segments
- **Performance Insights**: Monitor site performance and error rates

### Privacy & GDPR Compliance
- **Consent Management**: Cookie consent tracking with granular permissions
- **Data Deletion**: GDPR Article 17 compliance with verification workflow
- **Data Export**: GDPR Article 20 data portability rights
- **Anonymization**: IP address hashing and user ID anonymization
- **Opt-out Support**: Complete opt-out mechanisms for privacy-conscious users

## 📋 Prerequisites

- Node.js 18+ and npm
- ClickHouse 22+ (for analytics database)
- Redis 6+ (for session management and caching)
- Docker (optional, for containerized deployment)

## 🛠️ Installation

1. **Clone and setup**:
   ```bash
   cd analytics-service
   npm install
   ```

2. **Environment Configuration**:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your configuration:
   ```env
   # Server
   PORT=3006
   NODE_ENV=development

   # ClickHouse
   CLICKHOUSE_URL=http://localhost:8123
   CLICKHOUSE_USERNAME=default
   CLICKHOUSE_PASSWORD=
   CLICKHOUSE_DATABASE=analytics

   # Redis
   REDIS_URL=redis://localhost:6379
   REDIS_HOST=localhost
   REDIS_PORT=6379

   # Analytics
   SESSION_TIMEOUT=1800
   EVENTS_RETENTION_DAYS=730
   SESSIONS_RETENTION_DAYS=730
   CONVERSIONS_RETENTION_DAYS=1825

   # A/B Testing
   AB_TEST_DEFAULT_DURATION=30
   AB_TEST_MIN_SAMPLE_SIZE=1000
   AB_TEST_CONFIDENCE_LEVEL=0.95

   # Privacy
   DELETION_BATCH_SIZE=1000
   DELETION_RETRY_ATTEMPTS=3

   # Security
   API_KEY=your-secure-api-key-here
   ```

3. **Database Setup**:
   ```bash
   # Set up ClickHouse tables
   npm run setup-clickhouse
   ```

4. **Start Development**:
   ```bash
   npm run dev
   ```

## 🎯 API Endpoints

### Event Tracking

#### Page View Tracking
```javascript
POST /track/page-view
{
  "page_url": "https://globaltaxcalc.com/calculator",
  "referrer": "https://google.com/search",
  "properties": {
    "title": "Tax Calculator",
    "category": "calculator"
  }
}
```

#### Calculator Events
```javascript
POST /track/calculator
{
  "type": "start", // start, step, complete, abandon
  "calculator_type": "income_tax",
  "step": "income_input",
  "properties": {
    "country": "US",
    "state": "CA"
  }
}
```

#### Conversion Tracking
```javascript
POST /track/conversion
{
  "conversion_type": "calculator_complete",
  "value": 1.0,
  "currency": "USD",
  "calculator_type": "income_tax",
  "properties": {
    "result_type": "detailed"
  }
}
```

#### User Interactions
```javascript
POST /track/interaction
{
  "type": "click", // click, scroll, form_submit, download, search
  "element": "cta_button",
  "properties": {
    "button_text": "Calculate Now",
    "position": "header"
  }
}
```

### Analytics Data

#### Real-time Dashboard
```javascript
GET /analytics/dashboard
Headers: X-API-Key: your-api-key

Response:
{
  "success": true,
  "data": {
    "real_time": {
      "active_sessions": 1250,
      "page_views": 3420,
      "conversions": 85,
      "timeline": [...]
    },
    "popular_content": [...],
    "traffic_sources": [...],
    "conversion_metrics": [...]
  }
}
```

#### Funnel Analysis
```javascript
GET /analytics/funnel/tax_calculator_conversion?start_date=2024-01-01&end_date=2024-01-31
Headers: X-API-Key: your-api-key

Response:
{
  "success": true,
  "data": {
    "funnel_name": "Tax Calculator Conversion",
    "steps": [
      {
        "step_name": "calculator_start",
        "users": 10000,
        "conversion_rate": 100
      },
      {
        "step_name": "calculator_complete",
        "users": 7500,
        "conversion_rate": 75
      }
    ],
    "overall_conversion_rate": 75,
    "drop_off_analysis": [...]
  }
}
```

### A/B Testing

#### Get Experiment Assignment
```javascript
GET /ab-test/homepage_cta_test?user_id=user123&country=US&device_type=desktop

Response:
{
  "success": true,
  "experiment_id": "homepage_cta_test",
  "assignment": {
    "variant": "variant_b",
    "variant_data": {
      "id": "variant_b",
      "name": "Green Button",
      "config": {
        "button_color": "#28a745",
        "button_text": "Start Calculating"
      }
    }
  }
}
```

#### Track A/B Test Conversion
```javascript
POST /ab-test/homepage_cta_test/conversion
{
  "user_id": "user123",
  "value": 1.0,
  "properties": {
    "conversion_type": "calculator_start"
  }
}
```

#### Get Experiment Results
```javascript
GET /ab-test/homepage_cta_test/results
Headers: X-API-Key: your-api-key

Response:
{
  "success": true,
  "data": {
    "experiment": {...},
    "variants": [
      {
        "variant": "control",
        "users": 5000,
        "conversions": 750,
        "conversion_rate": 15.0
      },
      {
        "variant": "variant_b",
        "users": 5000,
        "conversions": 900,
        "conversion_rate": 18.0
      }
    ],
    "statistical_analysis": {
      "control_variant": "control",
      "test_variants": [
        {
          "variant_id": "variant_b",
          "lift": 20.0,
          "confidence": 95.2,
          "is_significant": true
        }
      ]
    }
  }
}
```

### Privacy & Consent

#### Record Consent
```javascript
POST /consent
{
  "analytics": true,
  "marketing": false,
  "personalization": true,
  "method": "banner",
  "version": "1.0"
}
```

#### Request Data Deletion
```javascript
POST /privacy/delete
{
  "user_id": "user123",
  "email": "user@example.com",
  "reason": "user_request"
}

Response:
{
  "success": true,
  "data": {
    "request_id": "del_abc123",
    "verification_token": "verify_xyz789",
    "status": "pending"
  },
  "message": "Verification email sent"
}
```

#### Export User Data
```javascript
POST /privacy/export
{
  "user_id": "user123",
  "email": "user@example.com"
}

Response:
{
  "success": true,
  "data": {
    "export_date": "2024-01-15T10:30:00Z",
    "user_id": "user123",
    "data": {
      "events": [...],
      "sessions": [...],
      "conversions": [...],
      "experiments": [...],
      "consent_records": [...]
    }
  }
}
```

## 🌐 Client-Side Integration

### JavaScript Tracking Library
```html
<!-- Include tracking script -->
<script src="https://analytics.globaltaxcalc.com/track.js"></script>

<script>
// Initialize tracking
window.gtcAnalytics = window.gtcAnalytics || [];

// Track page view
gtcAnalytics.push(['track', 'page_view', {
  page_url: window.location.href,
  title: document.title
}]);

// Track calculator start
gtcAnalytics.push(['track', 'calculator', {
  type: 'start',
  calculator_type: 'income_tax',
  country: 'US'
}]);

// Track conversion
gtcAnalytics.push(['track', 'conversion', {
  conversion_type: 'calculator_complete',
  value: 1.0,
  calculator_type: 'income_tax'
}]);

// A/B Test integration
gtcAnalytics.push(['ab_test', 'homepage_cta_test'], function(assignment) {
  if (assignment && assignment.variant === 'variant_b') {
    // Apply variant B styling
    document.getElementById('cta-button').style.backgroundColor = '#28a745';
    document.getElementById('cta-button').textContent = 'Start Calculating';
  }
});
</script>
```

### React Integration
```jsx
import { useAnalytics, useABTest } from '@globaltaxcalc/analytics';

function CalculatorPage() {
  const analytics = useAnalytics();
  const ctaTest = useABTest('homepage_cta_test');

  useEffect(() => {
    analytics.track('page_view', {
      page_url: window.location.href,
      page_type: 'calculator'
    });
  }, []);

  const handleCalculatorStart = () => {
    analytics.track('calculator', {
      type: 'start',
      calculator_type: 'income_tax'
    });
  };

  const handleCalculatorComplete = (result) => {
    analytics.track('conversion', {
      conversion_type: 'calculator_complete',
      value: 1.0,
      properties: { result_type: result.type }
    });
  };

  return (
    <div>
      <button
        onClick={handleCalculatorStart}
        style={{
          backgroundColor: ctaTest?.variant_data?.config?.button_color || '#007bff'
        }}
      >
        {ctaTest?.variant_data?.config?.button_text || 'Calculate Taxes'}
      </button>
    </div>
  );
}
```

## 🔧 Configuration

### Funnel Definitions
```javascript
// Create custom funnel
POST /analytics/funnel
{
  "name": "Premium Signup Funnel",
  "description": "Users who sign up for premium features",
  "steps": [
    {
      "name": "landing_page",
      "event_type": "page_view",
      "condition": "page_url LIKE '%/premium%'"
    },
    {
      "name": "signup_start",
      "event_type": "click",
      "condition": "event_type = 'click' AND JSON_EXTRACT_STRING(properties, 'element') = 'signup_button'"
    },
    {
      "name": "signup_complete",
      "event_type": "conversion",
      "condition": "conversion_type = 'premium_signup'"
    }
  ],
  "attribution_window": 86400,
  "conversion_window": 3600,
  "filters": {
    "exclude_bots": true,
    "countries": ["US", "CA", "GB"]
  }
}
```

### A/B Test Configuration
```javascript
// Create A/B test
POST /ab-test
{
  "name": "Calculator Input Design Test",
  "description": "Test different input field designs",
  "variants": [
    {
      "id": "control",
      "name": "Original Design",
      "weight": 0.5,
      "config": {
        "input_style": "standard",
        "colors": {"primary": "#007bff"}
      }
    },
    {
      "id": "variant_a",
      "name": "Rounded Inputs",
      "weight": 0.5,
      "config": {
        "input_style": "rounded",
        "colors": {"primary": "#28a745"}
      }
    }
  ],
  "targeting": {
    "countries": ["US", "CA"],
    "device_types": ["desktop", "mobile"],
    "user_type": "new"
  },
  "goals": ["calculator_complete"],
  "traffic_allocation": 0.8,
  "statistical_significance": 0.95,
  "min_sample_size": 1000
}
```

## 📊 Data Schema

### Events Table
```sql
CREATE TABLE events (
  event_id String,
  timestamp DateTime64(3),
  event_type LowCardinality(String),
  user_id Nullable(String),
  session_id String,
  page_url String,
  referrer Nullable(String),
  user_agent String,
  ip_address IPv4,
  country LowCardinality(String),
  region Nullable(String),
  city Nullable(String),
  device_type LowCardinality(String),
  browser LowCardinality(String),
  os LowCardinality(String),
  properties String, -- JSON
  created_at DateTime DEFAULT now()
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (event_type, timestamp, session_id)
TTL timestamp + INTERVAL 2 YEAR
```

### Sessions Table
```sql
CREATE TABLE sessions (
  session_id String,
  user_id Nullable(String),
  start_time DateTime64(3),
  end_time Nullable(DateTime64(3)),
  page_views UInt32,
  duration UInt32,
  bounce Boolean,
  conversion Boolean,
  conversion_value Nullable(Float64),
  traffic_source LowCardinality(String),
  campaign Nullable(String),
  country LowCardinality(String),
  device_type LowCardinality(String),
  is_bot Boolean,
  created_at DateTime DEFAULT now()
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(start_time)
ORDER BY (start_time, session_id)
TTL start_time + INTERVAL 2 YEAR
```

## 🚀 Deployment

### Docker Deployment
```bash
# Build image
docker build -t globaltaxcalc/analytics-service .

# Run with docker-compose
docker-compose up -d
```

### Environment Variables for Production
```env
NODE_ENV=production
PORT=3006
HOST=0.0.0.0

# ClickHouse (production cluster)
CLICKHOUSE_URL=https://clickhouse.globaltaxcalc.com:8443
CLICKHOUSE_USERNAME=analytics_user
CLICKHOUSE_PASSWORD=secure_password
CLICKHOUSE_DATABASE=analytics_prod

# Redis (production cluster)
REDIS_URL=redis://redis.globaltaxcalc.com:6379
REDIS_PASSWORD=secure_redis_password

# Security
API_KEY=your-production-api-key

# Monitoring
LOG_LEVEL=info
HEALTH_CHECK_INTERVAL=30000
METRICS_ENABLED=true
```

### Health Monitoring
```bash
# Check service health
curl https://analytics.globaltaxcalc.com/analytics/health

# Check compliance status
curl -H "X-API-Key: your-api-key" \
  https://analytics.globaltaxcalc.com/analytics/privacy/compliance-status
```

## 🔒 Security & Privacy

### Data Protection
- IP address anonymization with SHA-256 hashing
- User ID hashing for privacy protection
- Configurable data retention periods
- Automatic data cleanup with TTL policies

### GDPR Compliance
- Granular consent management (essential, analytics, marketing, personalization)
- Data subject access requests (DSAR)
- Right to erasure with verification workflow
- Data portability with complete export functionality
- Anonymization options as alternative to deletion

### Security Features
- API key authentication for sensitive endpoints
- Rate limiting on all endpoints
- CORS protection with configurable origins
- Helmet.js security headers
- Input validation with Joi schemas

## 📚 Documentation

- [API Reference](./docs/api.md)
- [Privacy Policy Integration](./docs/privacy.md)
- [A/B Testing Guide](./docs/ab-testing.md)
- [Funnel Analysis Guide](./docs/funnels.md)
- [Deployment Guide](./docs/deployment.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Contact the development team at analytics@globaltaxcalc.com

---

**GlobalTaxCalc Analytics Service** - Powering data-driven decisions with privacy-first analytics.