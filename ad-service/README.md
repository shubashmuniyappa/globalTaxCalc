# GlobalTaxCalc Ad Management Service

A comprehensive ad management service for GlobalTaxCalc with intelligent placement optimization, revenue tracking, A/B testing, and multi-network integration.

## 🎯 Features

### 📍 Dynamic Ad Placement Management
- **Intelligent Targeting**: Context-aware ad placement based on calculator type, geography, and user behavior
- **Multi-Location Support**: Header, sidebar, content (top/middle/bottom), footer, and mobile-sticky placements
- **Device Optimization**: Responsive ad sizing and placement for desktop, tablet, and mobile
- **Fallback System**: Automatic fallback to house ads when network ads fail

### 🌐 Multi-Network Integration
- **Google AdSense**: Full integration with AdSense API and optimized ad serving
- **Media.net**: Header bidding setup with contextual advertising
- **Direct Advertisers**: Premium direct partnership management
- **Performance-Based Switching**: Automatic network selection based on fill rates and RPM

### 🧪 A/B Testing Framework
- **Placement Testing**: Test different ad positions and densities
- **Format Testing**: Compare banner vs native ad performance
- **Statistical Analysis**: Automated statistical significance testing
- **Winner Selection**: Automatic implementation of winning variants

### 💰 Revenue Optimization
- **Real-Time RPM Tracking**: Revenue per mille monitoring across networks
- **Fill Rate Analysis**: Network performance comparison and optimization
- **Geographic Optimization**: Country-specific revenue strategies
- **Auto-Network Switching**: Performance-based network prioritization

### ⚡ Loading Performance Optimization
- **Lazy Loading**: Below-the-fold ads load only when needed
- **Core Web Vitals**: CLS, LCP, and FID optimization for ad placements
- **Progressive Enhancement**: Graceful degradation for slow connections
- **Async Loading**: Non-blocking ad delivery with timeout handling

### 📊 Comprehensive Analytics
- **Real-Time Metrics**: Live impression, click, and revenue tracking
- **Performance Reports**: Detailed analytics with breakdowns by network, geo, device
- **Viewability Tracking**: Industry-standard viewability measurement
- **Ad Blocker Detection**: Monitor ad blocker usage and impact

### 🛡️ Content Filtering & Brand Safety
- **Adult Content Filter**: Automatic blocking of inappropriate content
- **Competitor Blocking**: Prevent competitor ads from appearing
- **Quality Scoring**: Multi-factor quality assessment for advertisers
- **Geographic Compliance**: Country-specific advertising regulation compliance

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- MongoDB 4.4+
- Redis 6.0+
- Google AdSense account (optional)
- Media.net account (optional)

### Installation

1. **Clone and install dependencies**
```bash
cd ad-service
npm install
```

2. **Environment Configuration**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Required Environment Variables**
```env
# Core Configuration
PORT=3006
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/globaltaxcalc_ads
REDIS_HOST=localhost
JWT_SECRET=your_jwt_secret

# Google AdSense (Optional)
GOOGLE_ADSENSE_CLIENT_ID=ca-pub-your-client-id
GOOGLE_ADSENSE_API_KEY=your_api_key

# Media.net (Optional)
MEDIANET_SITE_ID=your_site_id
MEDIANET_CUSTOMER_ID=your_customer_id

# Performance Settings
MIN_VIEWABILITY_THRESHOLD=0.5
MIN_RPM_THRESHOLD=1.0
LAZY_LOADING_ENABLED=true
```

4. **Start the service**
```bash
npm start
```

The service will be available at `http://localhost:3006`

## 📡 API Endpoints

### Ad Placement
```http
GET /api/ads/placement/{location}
```
Get optimized ad for specific placement location with dynamic targeting.

**Parameters:**
- `location`: header|sidebar|content_top|content_middle|content_bottom|footer|mobile_sticky
- `country`: 2-letter country code (optional)
- `device`: desktop|tablet|mobile (optional)
- `calculatorType`: income_tax|business_tax|sales_tax|property_tax (optional)

**Response:**
```json
{
  "success": true,
  "placement": {
    "id": "uuid",
    "location": "header",
    "size": {"width": 728, "height": 90},
    "code": "<script>...</script>",
    "loadingStrategy": "async_loading"
  },
  "metadata": {
    "network": "adsense",
    "qualityScore": 8.5
  }
}
```

### Analytics Tracking
```http
POST /api/ads/impression
POST /api/ads/click
POST /api/ads/viewability
POST /api/ads/revenue
```

Track various ad events for analytics and optimization.

### Performance Reports
```http
GET /api/ads/performance?timeRange=24h
GET /api/ads/revenue-report?timeRange=7d
GET /api/ads/loading-performance
```

Get comprehensive performance analytics and optimization insights.

### A/B Testing
```http
POST /api/ads/ab-test
GET /api/ads/ab-test/{testId}/results
POST /api/ads/ab-test/{testId}/end
```

Create and manage A/B tests for ad placement optimization.

## 🏗️ Architecture

### Service Components

```
ad-service/
├── services/
│   ├── placementService.js      # Ad placement logic and targeting
│   ├── adNetworkService.js      # Multi-network integration
│   ├── abTestService.js         # A/B testing framework
│   ├── revenueOptimizationService.js  # Revenue optimization
│   ├── loadingOptimizationService.js  # Performance optimization
│   ├── analyticsService.js      # Analytics and tracking
│   └── contentFilteringService.js     # Content filtering
├── routes/
│   └── ads.js                   # API endpoints
├── middleware/
│   ├── auth.js                  # Authentication
│   └── rateLimit.js            # Rate limiting
├── config/
│   └── index.js                # Configuration management
└── app.js                      # Express application
```

### Data Flow

1. **Ad Request** → Placement service determines optimal ad unit
2. **Network Selection** → Best performing network chosen
3. **Content Filtering** → Ad quality and safety validation
4. **A/B Testing** → Variant assignment and tracking
5. **Code Generation** → Optimized loading code creation
6. **Analytics** → Event tracking and performance measurement

## 🎨 Ad Unit Types

### Banner Ads
- **Leaderboard**: 728x90 (header/footer)
- **Medium Rectangle**: 300x250 (sidebar/content)
- **Skyscraper**: 160x600 or 300x600 (sidebar)

### Mobile Ads
- **Mobile Banner**: 320x50 (mobile sticky)
- **Large Mobile Banner**: 320x100
- **Mobile Rectangle**: 300x250

### Native Ads
- **Content Native**: Responsive size, contextual integration
- **In-Feed**: Seamless content integration

## 📈 Revenue Optimization

### Automatic Optimization Rules
1. **Low Fill Rate Switch**: Automatically switch networks when fill rate < 50%
2. **RPM Optimization**: Enable premium networks when RPM < threshold
3. **Geographic Targeting**: Optimize based on country-specific performance
4. **Time-Based Optimization**: Prioritize high-performing networks during peak hours

### Performance Metrics
- **RPM (Revenue Per Mille)**: Revenue per 1000 impressions
- **Fill Rate**: Percentage of ad requests filled
- **CTR (Click-Through Rate)**: Clicks per impression
- **Viewability Score**: Percentage of viewable impressions

## 🧪 A/B Testing

### Test Types
- **Placement Tests**: Different ad positions
- **Density Tests**: Number of ads per page
- **Format Tests**: Banner vs native ads
- **Design Tests**: Different ad creative styles

### Statistical Analysis
- **Sample Size Calculation**: Automatic sample size determination
- **Confidence Intervals**: 95% confidence level testing
- **Early Winner Detection**: Stop tests early when significance reached
- **Performance Tracking**: Continuous monitoring and analysis

## 🔒 Security & Privacy

### Content Filtering
- **Brand Safety**: Automatic inappropriate content detection
- **Competitor Blocking**: Prevent competitor ads
- **Quality Scoring**: Multi-factor advertiser assessment
- **Geographic Compliance**: Country-specific regulation adherence

### Privacy Protection
- **IP Anonymization**: Remove last octet from IP addresses
- **No PII Storage**: No personally identifiable information stored
- **GDPR Compliance**: EU privacy regulation compliance
- **Consent Management**: User consent tracking and management

## 📊 Monitoring & Health Checks

### Health Check Endpoints
```http
GET /health                    # Overall service health
GET /api/ads/health           # Detailed component health
```

### Monitoring Metrics
- **Service Uptime**: Continuous availability monitoring
- **Response Times**: API endpoint performance
- **Error Rates**: Failed request tracking
- **Network Status**: Ad network connectivity

### Alerting
- **High Error Rates**: Alert when error rate > 1%
- **Low Fill Rates**: Alert when fill rate < 60%
- **Performance Degradation**: Alert on slow response times
- **Revenue Drops**: Alert on significant revenue decreases

## 🔧 Configuration

### Ad Placement Configuration
```javascript
{
  id: 'header_leaderboard',
  type: 'banner',
  location: 'header',
  size: {width: 728, height: 90},
  networks: ['adsense', 'medianet', 'direct'],
  targeting: {
    devices: ['desktop', 'tablet'],
    countries: ['US', 'CA', 'UK'],
    calculatorTypes: ['income_tax', 'business_tax']
  }
}
```

### Revenue Optimization Settings
```javascript
{
  minViewabilityThreshold: 0.5,
  minRpmThreshold: 1.0,
  autoNetworkSwitching: true,
  performanceWindow: 24 * 60 * 60 * 1000, // 24 hours
  optimizationInterval: 60 * 60 * 1000    // 1 hour
}
```

## 🚀 Deployment

### Production Deployment
```bash
# Build and start
npm run build
npm start

# Docker deployment
docker build -t ad-service .
docker run -p 3006:3006 ad-service
```

### Environment Configuration
- **Development**: Full logging, debug mode
- **Staging**: Production-like with debug enabled
- **Production**: Optimized performance, minimal logging

## 📝 API Documentation

### Authentication
- **Bearer Token**: JWT authentication for admin endpoints
- **API Key**: Service-to-service authentication
- **Optional Auth**: Public endpoints allow anonymous access

### Rate Limiting
- **Strict**: 100 requests/15min (sensitive operations)
- **Moderate**: 500 requests/15min (general API)
- **Lenient**: 1000 requests/15min (public endpoints)

### Error Handling
```json
{
  "success": false,
  "message": "Error description",
  "errors": ["Detailed error messages"],
  "retryAfter": "15 minutes"
}
```

## 🤝 Integration

### Frontend Integration
```javascript
// Get ad placement
const response = await fetch('/api/ads/placement/header?device=desktop');
const {placement} = await response.json();

// Insert ad code
document.getElementById('ad-container').innerHTML = placement.code;

// Track impression
await fetch('/api/ads/impression', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    placementId: placement.id,
    networkName: placement.metadata.network
  })
});
```

### Analytics Integration
```javascript
// Track viewability
const observer = new IntersectionObserver((entries) => {
  entries.forEach(async (entry) => {
    if (entry.isIntersecting) {
      await fetch('/api/ads/viewability', {
        method: 'POST',
        body: JSON.stringify({
          placementId: 'ad-id',
          networkName: 'adsense',
          viewabilityData: {
            score: entry.intersectionRatio,
            timeInView: Date.now() - startTime
          }
        })
      });
    }
  });
});
```

## 🔍 Troubleshooting

### Common Issues

**No Ads Showing**
- Check network configuration in environment variables
- Verify ad unit IDs are correct
- Check content filtering logs for blocking reasons

**Low Fill Rates**
- Review targeting settings (too restrictive)
- Check geographic restrictions
- Verify network account status

**Performance Issues**
- Enable lazy loading for below-fold ads
- Check Core Web Vitals impact
- Review loading timeout settings

### Debug Tools
```bash
# View logs
docker logs ad-service

# Check Redis connectivity
redis-cli ping

# Monitor performance
curl http://localhost:3006/api/ads/health
```

## 📞 Support

For technical support or questions:
- Check health endpoints: `/health` and `/api/ads/health`
- Review API documentation: `/api/docs`
- Monitor performance metrics and alerts

## 📄 License

Copyright (c) 2024 GlobalTaxCalc. All rights reserved.

---

The GlobalTaxCalc Ad Management Service provides enterprise-grade ad placement optimization with comprehensive analytics, multi-network integration, and advanced revenue optimization features designed to maximize ad revenue while maintaining excellent user experience.