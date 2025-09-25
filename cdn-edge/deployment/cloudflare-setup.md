# Cloudflare Setup Guide for GlobalTaxCalc Edge Platform

This guide walks you through setting up the complete Cloudflare infrastructure for the GlobalTaxCalc CDN & Edge Computing platform.

## 🎯 Prerequisites

- Cloudflare account (Pro plan or higher recommended)
- Domain registered and using Cloudflare DNS
- Wrangler CLI installed (`npm install -g wrangler`)
- Node.js 16+ and npm

## 🚀 Step-by-Step Setup

### 1. Initial Cloudflare Configuration

#### A. Authenticate Wrangler
```bash
wrangler login
```

#### B. Verify Account Access
```bash
wrangler whoami
```

### 2. Domain and DNS Setup

#### A. Add Domain to Cloudflare
1. Go to Cloudflare Dashboard
2. Click "Add Site"
3. Enter your domain (e.g., `globaltaxcalc.com`)
4. Select plan (Pro recommended for advanced features)
5. Update nameservers at your registrar

#### B. Configure DNS Records
```bash
# Main domain
A globaltaxcalc.com 192.0.2.1 (proxied)
CNAME www globaltaxcalc.com (proxied)

# API subdomain
CNAME api globaltaxcalc.com (proxied)

# CDN subdomain
CNAME cdn globaltaxcalc.com (proxied)

# Regional subdomains (optional)
CNAME us globaltaxcalc.com (proxied)
CNAME eu globaltaxcalc.com (proxied)
CNAME asia globaltaxcalc.com (proxied)
```

### 3. SSL/TLS Configuration

#### A. SSL Settings
```bash
# Set SSL mode to Full (strict)
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/{zone_id}/settings/ssl" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{"value":"full"}'
```

#### B. Security Headers
```bash
# Enable HSTS
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/{zone_id}/settings/security_header" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{"value":{"strict_transport_security":{"enabled":true,"max_age":31536000,"include_subdomains":true,"preload":true}}}'
```

### 4. Create KV Namespaces

#### A. Cache Storage
```bash
# Production
wrangler kv:namespace create "CACHE_KV"
wrangler kv:namespace create "CACHE_KV" --preview

# Note the IDs returned and update wrangler.toml
```

#### B. Configuration Storage
```bash
# Production
wrangler kv:namespace create "CONFIG_KV"
wrangler kv:namespace create "CONFIG_KV" --preview
```

#### C. Analytics Storage
```bash
# Production
wrangler kv:namespace create "ANALYTICS_KV"
wrangler kv:namespace create "ANALYTICS_KV" --preview
```

#### D. Update wrangler.toml
```toml
[[kv_namespaces]]
binding = "CACHE_KV"
id = "your-cache-kv-id"
preview_id = "your-cache-kv-preview-id"

[[kv_namespaces]]
binding = "CONFIG_KV"
id = "your-config-kv-id"
preview_id = "your-config-kv-preview-id"

[[kv_namespaces]]
binding = "ANALYTICS_KV"
id = "your-analytics-kv-id"
preview_id = "your-analytics-kv-preview-id"
```

### 5. Create R2 Bucket for Static Assets

#### A. Create Bucket
```bash
wrangler r2 bucket create globaltaxcalc-assets
```

#### B. Update wrangler.toml
```toml
[[r2_buckets]]
binding = "ASSETS_BUCKET"
bucket_name = "globaltaxcalc-assets"
```

### 6. Setup Analytics Engine

#### A. Create Dataset
```bash
# Note: Analytics Engine is automatically available
# Update wrangler.toml with binding
```

#### B. Update wrangler.toml
```toml
[[analytics_engine_datasets]]
binding = "EDGE_ANALYTICS"
```

### 7. Configure Page Rules and Cache Settings

#### A. Cache Rules (via Dashboard or API)
```javascript
// Static assets - Cache everything
{
  "targets": [
    {
      "target": "url",
      "constraint": {
        "operator": "matches",
        "value": "globaltaxcalc.com/*.{css,js,png,jpg,jpeg,gif,ico,svg,woff,woff2,ttf,eot}"
      }
    }
  ],
  "actions": [
    {
      "id": "cache_level",
      "value": "cache_everything"
    },
    {
      "id": "edge_cache_ttl",
      "value": 31536000
    }
  ]
}
```

#### B. API Cache Rules
```javascript
// API responses - Custom cache
{
  "targets": [
    {
      "target": "url",
      "constraint": {
        "operator": "matches",
        "value": "globaltaxcalc.com/api/*"
      }
    }
  ],
  "actions": [
    {
      "id": "cache_level",
      "value": "cache_everything"
    },
    {
      "id": "edge_cache_ttl",
      "value": 300
    }
  ]
}
```

### 8. Security Configuration

#### A. WAF Rules
```bash
# Create custom WAF rule for tax calculator
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/firewall/rules" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{
    "filter": {
      "expression": "(http.request.uri.path contains \"/api/calculate\" and http.request.method eq \"POST\" and rate(5m) > 10)",
      "paused": false
    },
    "action": "challenge",
    "description": "Rate limit calculator API"
  }'
```

#### B. Bot Fight Mode
```bash
# Enable bot fight mode
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/{zone_id}/settings/bot_fight_mode" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{"value":"on"}'
```

### 9. Performance Optimization

#### A. Enable Argo Smart Routing
```bash
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/{zone_id}/argo/smart_routing" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{"value":"on"}'
```

#### B. Enable Rocket Loader
```bash
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/{zone_id}/settings/rocket_loader" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{"value":"on"}'
```

#### C. Enable Auto Minify
```bash
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/{zone_id}/settings/minify" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{"value":{"css":"on","html":"on","js":"on"}}'
```

### 10. Configure Load Balancing (Optional)

#### A. Create Load Balancer
```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/load_balancers" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{
    "name": "globaltaxcalc-api",
    "fallback_pool": "primary-pool-id",
    "default_pools": ["primary-pool-id", "backup-pool-id"],
    "description": "GlobalTaxCalc API Load Balancer",
    "ttl": 30,
    "steering_policy": "dynamic_latency"
  }'
```

### 11. Deploy Workers

#### A. Deploy Edge Worker
```bash
# Deploy to staging first
wrangler publish --env staging

# Test staging deployment
curl https://staging-globaltaxcalc.workers.dev/health

# Deploy to production
wrangler publish --env production
```

#### B. Configure Custom Domains
```bash
# Add route to wrangler.toml
[env.production]
routes = [
    "globaltaxcalc.com/*",
    "www.globaltaxcalc.com/*",
    "api.globaltaxcalc.com/*"
]
```

### 12. Setup Monitoring and Alerts

#### A. Create Notification Policy
```bash
curl -X POST "https://api.cloudflare.com/client/v4/accounts/{account_id}/alerting/policies" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{
    "name": "Worker Error Rate Alert",
    "description": "Alert when worker error rate exceeds 5%",
    "enabled": true,
    "alert_type": "workers_alert",
    "mechanisms": {
      "email": [{"id": "your-email@globaltaxcalc.com"}]
    },
    "filters": {
      "zones": ["{zone_id}"],
      "services": ["workers"]
    },
    "conditions": {
      "threshold": 5,
      "threshold_type": "percentage"
    }
  }'
```

### 13. Initialize Configuration Data

#### A. Upload Initial Cache Configuration
```bash
# Create cache config
echo '{
  "version": "1.0.0",
  "cacheStrategies": {
    "static": {"ttl": 31536000},
    "api": {"ttl": 300},
    "html": {"ttl": 3600}
  },
  "featureFlags": {
    "enableCompression": true,
    "enablePersonalization": true,
    "enableAnalytics": true
  }
}' | wrangler kv:key put --binding=CONFIG_KV "cache_config"
```

#### B. Upload Security Configuration
```bash
echo '{
  "rateLimits": {
    "api": {"requests": 100, "window": 60},
    "calculator": {"requests": 50, "window": 60}
  },
  "securityRules": {
    "enableWAF": true,
    "enableBotProtection": true,
    "enableGeoBlocking": false
  }
}' | wrangler kv:key put --binding=CONFIG_KV "security_config"
```

### 14. Upload Static Assets to R2

#### A. Upload Common Assets
```bash
# Upload CSS
wrangler r2 object put globaltaxcalc-assets/css/main.css --file ./assets/css/main.css

# Upload JavaScript
wrangler r2 object put globaltaxcalc-assets/js/app.js --file ./assets/js/app.js

# Upload Images
wrangler r2 object put globaltaxcalc-assets/images/logo.png --file ./assets/images/logo.png
```

### 15. Validation and Testing

#### A. Test Worker Endpoints
```bash
# Health check
curl https://globaltaxcalc.com/health

# Edge info
curl https://globaltaxcalc.com/edge-info

# Cache test
curl -H "Cache-Control: no-cache" https://globaltaxcalc.com/

# API test
curl https://globaltaxcalc.com/api/test
```

#### B. Performance Testing
```bash
# Load test with curl
for i in {1..100}; do
  curl -w "%{time_total}\n" -o /dev/null -s https://globaltaxcalc.com/
done

# Cache hit rate test
curl -I https://globaltaxcalc.com/assets/css/main.css
# Should show X-Cache: HIT after first request
```

#### C. Security Testing
```bash
# Rate limit test
for i in {1..200}; do
  curl https://globaltaxcalc.com/api/calculate -X POST
done
# Should receive 429 status after limit

# WAF test
curl "https://globaltaxcalc.com/?test=<script>alert('xss')</script>"
# Should be blocked
```

## 🔧 Environment-Specific Configuration

### Development Environment
```toml
[env.development.vars]
ENVIRONMENT = "development"
API_BASE_URL = "http://localhost:3000"
CACHE_TTL = "300"
ENABLE_DEBUG = "true"
```

### Staging Environment
```toml
[env.staging.vars]
ENVIRONMENT = "staging"
API_BASE_URL = "https://api-staging.globaltaxcalc.com"
CACHE_TTL = "1800"
ENABLE_ANALYTICS = "true"
```

### Production Environment
```toml
[env.production.vars]
ENVIRONMENT = "production"
API_BASE_URL = "https://api.globaltaxcalc.com"
CACHE_TTL = "3600"
ENABLE_ANALYTICS = "true"
ENABLE_SECURITY = "true"
```

## 📊 Monitoring Setup

### Analytics Dashboard
1. Go to Cloudflare Dashboard > Analytics
2. Enable Real User Monitoring (RUM)
3. Configure custom events for:
   - Calculator usage
   - API performance
   - Error tracking
   - User engagement

### Log Forwarding (Optional)
```bash
# Setup Logpush to external service
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/logpush/jobs" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{
    "dataset": "http_requests",
    "destination_conf": "s3://your-bucket/logs?region=us-east-1",
    "enabled": true,
    "logpull_options": "fields=ClientIP,EdgeStartTimestamp,EdgeEndTimestamp,RayID"
  }'
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Worker Not Deploying
```bash
# Check wrangler configuration
wrangler whoami
wrangler config list

# Verify zone ID
wrangler zones list
```

#### 2. KV Namespace Issues
```bash
# List all namespaces
wrangler kv:namespace list

# Test KV access
wrangler kv:key put --binding=CACHE_KV "test" "value"
wrangler kv:key get --binding=CACHE_KV "test"
```

#### 3. Route Conflicts
```bash
# Check existing routes
wrangler route list

# Delete conflicting routes
wrangler route delete {route_id}
```

#### 4. SSL Issues
```bash
# Check SSL status
curl -I https://globaltaxcalc.com/

# Verify certificate
openssl s_client -connect globaltaxcalc.com:443 -servername globaltaxcalc.com
```

### Debug Commands
```bash
# View worker logs in real-time
wrangler tail

# View specific worker version
wrangler deployments list

# Rollback if needed
wrangler rollback {deployment_id}
```

## 📋 Post-Setup Checklist

- [ ] Domain DNS properly configured
- [ ] SSL/TLS certificates active
- [ ] All KV namespaces created and configured
- [ ] R2 bucket created and assets uploaded
- [ ] Workers deployed to production
- [ ] Custom routes configured
- [ ] Security rules activated
- [ ] Performance optimizations enabled
- [ ] Monitoring and alerts configured
- [ ] Load testing completed
- [ ] Documentation updated

## 🔗 Useful Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [KV Storage Documentation](https://developers.cloudflare.com/workers/learning/how-kv-works/)
- [R2 Object Storage](https://developers.cloudflare.com/r2/)
- [Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/)

## 📞 Support

For issues with this setup:
1. Check the troubleshooting section above
2. Review Cloudflare dashboard for errors
3. Check worker logs with `wrangler tail`
4. Contact Cloudflare support for platform issues
5. Open an issue in the project repository

---

**Setup complete! Your GlobalTaxCalc edge platform is now ready for lightning-fast global performance.**