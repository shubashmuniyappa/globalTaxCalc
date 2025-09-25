# GlobalTaxCalc.com Production Deployment Checklist

## Pre-Deployment Requirements

### Environment Setup
- [ ] Railway.app account created and configured
- [ ] Domain `globaltaxcalc.com` registered and DNS configured
- [ ] SSL certificates provisioned through Railway/Cloudflare
- [ ] Environment variables configured in `production.env`
- [ ] GitHub repository secrets configured
- [ ] Monitoring tools (Datadog/New Relic) accounts set up

### Code Quality Gates
- [ ] All unit tests passing (100% test suite)
- [ ] Integration tests completed successfully
- [ ] Load testing performance benchmarks met
- [ ] Security scans (SAST/DAST) passed
- [ ] Code coverage >85%
- [ ] ESLint and Prettier checks passed
- [ ] Dependency vulnerability scans clean

### Infrastructure Verification
- [ ] PostgreSQL database configured and accessible
- [ ] Redis cache configured and accessible
- [ ] SMTP email service configured
- [ ] File storage (AWS S3/Railway) configured
- [ ] CDN (Cloudflare) configured
- [ ] Load balancer health checks configured

## Deployment Process

### 1. Pre-Deployment Testing
```bash
# Run comprehensive test suite
npm run test:all

# Run security scans
npm run test:security

# Run load tests
npm run test:load

# Verify Docker builds
docker-compose -f docker-compose.test.yml build
```

### 2. Railway.app Deployment
```bash
# Navigate to deployment directory
cd deployment/railway

# Run deployment script
./deploy.sh

# Or deploy specific components
./deploy.sh domain     # Setup domain only
./deploy.sh ssl        # Setup SSL only
./deploy.sh monitoring # Setup monitoring only
```

### 3. Service Health Verification
- [ ] API Gateway: `curl -f https://api.globaltaxcalc.com/health`
- [ ] Auth Service: `curl -f https://api.globaltaxcalc.com/api/auth/health`
- [ ] Tax Engine: `curl -f https://api.globaltaxcalc.com/api/tax/health`
- [ ] Report Service: `curl -f https://api.globaltaxcalc.com/api/reports/health`
- [ ] File Service: `curl -f https://api.globaltaxcalc.com/api/files/health`
- [ ] Monitoring Service: `curl -f https://api.globaltaxcalc.com/api/monitoring/health`

### 4. Database Migration
```bash
# Run database migrations
railway run npm run migrate

# Verify database schema
railway run npm run db:verify

# Seed production data if needed
railway run npm run db:seed:production
```

### 5. Performance Validation
- [ ] Response times <2s for 95th percentile
- [ ] System handles 1000+ concurrent users
- [ ] Memory usage <80% under normal load
- [ ] CPU usage <70% under normal load
- [ ] Database connections <80% of max
- [ ] Redis memory usage <75%

### 6. Security Verification
- [ ] HTTPS enforced across all domains
- [ ] Security headers configured (HSTS, CSP, etc.)
- [ ] Rate limiting active
- [ ] Input validation working
- [ ] Authentication/authorization functional
- [ ] API keys and secrets secured
- [ ] SQL injection protection active
- [ ] XSS protection enabled

### 7. Monitoring Setup
- [ ] Prometheus metrics collection active
- [ ] Grafana dashboards accessible
- [ ] Alertmanager notifications configured
- [ ] Log aggregation (Loki) working
- [ ] Error tracking (Sentry) configured
- [ ] Uptime monitoring (Pingdom) active
- [ ] Business metrics tracking enabled

### 8. Business Logic Validation
- [ ] User registration flow working
- [ ] Tax calculation engine accurate
- [ ] Multi-country calculations correct
- [ ] Report generation functional
- [ ] File upload/processing working
- [ ] Email notifications sending
- [ ] Payment processing (if applicable)

## Post-Deployment Verification

### Smoke Tests
```bash
# Run production smoke tests
cd tests
BASE_URL=https://api.globaltaxcalc.com npm run test:smoke

# Test critical user journeys
npm run test:e2e:production
```

### Performance Monitoring
- [ ] Set up continuous performance monitoring
- [ ] Configure alert thresholds
- [ ] Enable synthetic monitoring
- [ ] Set up error rate tracking

### Business Metrics
- [ ] Daily active users tracking
- [ ] Tax calculations per day
- [ ] Revenue tracking (if applicable)
- [ ] Conversion rate monitoring
- [ ] Average response time tracking

## Rollback Plan

### Immediate Rollback (< 5 minutes)
```bash
# Quick rollback using Railway
railway rollback

# Verify rollback
curl -f https://globaltaxcalc.com/health
```

### Database Rollback (if needed)
```bash
# Restore from backup
railway run npm run db:restore:latest

# Verify data integrity
railway run npm run db:verify
```

### DNS Rollback (if needed)
- [ ] Update DNS records to previous version
- [ ] Clear CDN cache
- [ ] Verify propagation

## Sign-off Requirements

### Technical Team
- [ ] DevOps Engineer: Infrastructure validated
- [ ] Backend Engineer: API functionality verified
- [ ] Frontend Engineer: UI/UX working correctly
- [ ] QA Engineer: Test results approved
- [ ] Security Engineer: Security scans passed

### Business Team
- [ ] Product Manager: Business requirements met
- [ ] Finance Team: Payment flows tested (if applicable)
- [ ] Customer Support: Documentation updated
- [ ] Legal Team: Compliance requirements met

## Emergency Contacts

| Role | Contact | Phone | Email |
|------|---------|--------|-------|
| DevOps Lead | [Name] | [Phone] | ops@globaltaxcalc.com |
| Backend Lead | [Name] | [Phone] | backend@globaltaxcalc.com |
| Product Manager | [Name] | [Phone] | product@globaltaxcalc.com |
| On-call Engineer | [Name] | [Phone] | oncall@globaltaxcalc.com |

## Documentation Links

- [Environment Setup Guide](./environment-setup.md)
- [Troubleshooting Guide](./troubleshooting.md)
- [Monitoring Runbook](./monitoring-runbook.md)
- [Incident Response Procedures](./incident-response.md)
- [API Documentation](https://api.globaltaxcalc.com/docs)
- [Railway Dashboard](https://railway.app/dashboard)
- [Monitoring Dashboard](https://monitoring.globaltaxcalc.com)

---

**Deployment Date:** ___________
**Deployed By:** ___________
**Approved By:** ___________
**Version:** ___________