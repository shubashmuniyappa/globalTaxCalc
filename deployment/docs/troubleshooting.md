# Troubleshooting Guide - GlobalTaxCalc.com

## Quick Diagnosis Commands

### System Health Check
```bash
# Check all services status
railway ps

# View recent logs
railway logs --tail 100

# Check health endpoints
curl -f https://globaltaxcalc.com/health
curl -f https://api.globaltaxcalc.com/health
```

### Database Connectivity
```bash
# Test database connection
railway connect postgresql

# Check database status
railway run psql $DATABASE_URL -c "SELECT version();"

# View active connections
railway run psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity;"
```

### Redis Connectivity
```bash
# Test Redis connection
railway connect redis

# Check Redis info
railway run redis-cli info

# Test Redis operations
railway run redis-cli ping
```

## Common Issues and Solutions

### 1. Application Won't Start

#### Symptoms
- Service shows as "Failed" in Railway dashboard
- Health checks failing
- 502/503 errors on frontend

#### Diagnosis
```bash
# Check service logs
railway logs --service api-gateway

# Check environment variables
railway variables

# Verify build process
railway logs --deployment [deployment-id]
```

#### Common Causes & Solutions

**Missing Environment Variables**
```bash
# Check for required variables
railway variables | grep -E "(DATABASE_URL|JWT_SECRET|NODE_ENV)"

# Set missing variables
railway variables set JWT_SECRET="your-secure-secret"
```

**Port Configuration Issues**
```bash
# Ensure PORT is set correctly
railway variables set PORT=3000

# Check Dockerfile EXPOSE directive
grep EXPOSE */Dockerfile
```

**Database Connection Issues**
```bash
# Test database connectivity
railway run npm run db:check

# Run database migrations
railway run npm run migrate

# Check database logs
railway logs --service postgresql
```

### 2. High Response Times

#### Symptoms
- API responses taking >2 seconds
- Frontend loading slowly
- User complaints about performance

#### Diagnosis
```bash
# Check response times
curl -w "%{time_total}\n" -o /dev/null -s https://api.globaltaxcalc.com/health

# Monitor resource usage
railway metrics

# Check database performance
railway run psql $DATABASE_URL -c "SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

#### Solutions

**Database Query Optimization**
```bash
# Identify slow queries
railway run psql $DATABASE_URL -c "
  SELECT query, mean_time, calls, total_time
  FROM pg_stat_statements
  WHERE mean_time > 1000
  ORDER BY mean_time DESC;
"

# Add database indexes
railway run npm run db:optimize
```

**Memory Issues**
```bash
# Check memory usage
railway metrics --service api-gateway

# Increase memory allocation in Railway dashboard
# Or optimize application memory usage
```

**Redis Cache Issues**
```bash
# Check Redis memory usage
railway run redis-cli info memory

# Clear cache if needed
railway run redis-cli flushdb

# Check cache hit rates
railway run redis-cli info stats
```

### 3. Authentication Problems

#### Symptoms
- Users cannot log in
- JWT token validation failures
- Session management issues

#### Diagnosis
```bash
# Check auth service logs
railway logs --service auth-service

# Test authentication endpoint
curl -X POST https://api.globaltaxcalc.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass"}'

# Verify JWT secret
railway variables | grep JWT_SECRET
```

#### Solutions

**JWT Configuration Issues**
```bash
# Regenerate JWT secret
railway variables set JWT_SECRET=$(openssl rand -base64 64)

# Check JWT expiration settings
railway variables | grep JWT_EXPIRES
```

**Database User Issues**
```bash
# Check user table
railway run psql $DATABASE_URL -c "SELECT id, email, created_at FROM users LIMIT 5;"

# Reset user password (if needed)
railway run npm run user:reset-password -- user@example.com
```

### 4. File Upload Issues

#### Symptoms
- File uploads failing
- Large file upload timeouts
- File processing errors

#### Diagnosis
```bash
# Check file service logs
railway logs --service file-processing-service

# Test file upload endpoint
curl -X POST https://api.globaltaxcalc.com/api/files/upload \
  -F "file=@test.pdf" \
  -H "Authorization: Bearer your-jwt-token"

# Check file storage configuration
railway variables | grep -E "(AWS_|FILE_)"
```

#### Solutions

**File Size Limits**
```bash
# Check file size limits
railway variables | grep FILE_UPLOAD_MAX_SIZE

# Increase limit if needed
railway variables set FILE_UPLOAD_MAX_SIZE=20971520  # 20MB
```

**Storage Configuration**
```bash
# Verify S3 credentials
railway variables set AWS_ACCESS_KEY_ID="your-key"
railway variables set AWS_SECRET_ACCESS_KEY="your-secret"

# Test S3 connectivity
railway run npm run storage:test
```

### 5. Email Delivery Issues

#### Symptoms
- Users not receiving emails
- SMTP authentication failures
- Email delivery delays

#### Diagnosis
```bash
# Test email configuration
railway run npm run email:test

# Check SMTP settings
railway variables | grep SMTP

# Check email service logs
railway logs | grep -i email
```

#### Solutions

**SMTP Configuration**
```bash
# Update SMTP settings
railway variables set SMTP_HOST=smtp.sendgrid.net
railway variables set SMTP_PORT=587
railway variables set SMTP_USER=apikey
railway variables set SMTP_PASSWORD="your-api-key"
```

**Email Queue Issues**
```bash
# Check email queue status
railway run redis-cli llen email_queue

# Clear stuck emails
railway run npm run email:queue:clear
```

### 6. Database Connection Errors

#### Symptoms
- "Connection terminated unexpectedly"
- "Too many connections"
- Database timeouts

#### Diagnosis
```bash
# Check connection pool
railway run psql $DATABASE_URL -c "
  SELECT count(*) as total_connections,
         state
  FROM pg_stat_activity
  GROUP BY state;
"

# Check connection limits
railway run psql $DATABASE_URL -c "SHOW max_connections;"
```

#### Solutions

**Connection Pool Configuration**
```bash
# Optimize connection pool
railway variables set DATABASE_POOL_SIZE=10
railway variables set DATABASE_CONNECTION_TIMEOUT=30000
railway variables set DATABASE_IDLE_TIMEOUT=10000
```

**Database Performance**
```bash
# Check database locks
railway run psql $DATABASE_URL -c "
  SELECT blocked_locks.pid AS blocked_pid,
         blocking_locks.pid AS blocking_pid,
         blocked_activity.query AS blocked_statement
  FROM pg_catalog.pg_locks blocked_locks
  JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
  JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
  WHERE NOT blocked_locks.granted;
"
```

### 7. API Gateway Routing Issues

#### Symptoms
- 404 errors for valid endpoints
- Requests routing to wrong services
- Load balancing problems

#### Diagnosis
```bash
# Check API gateway logs
railway logs --service api-gateway

# Test routing configuration
curl -H "Accept: application/json" https://api.globaltaxcalc.com/api/auth/health
curl -H "Accept: application/json" https://api.globaltaxcalc.com/api/tax/health
```

#### Solutions

**Service Discovery Issues**
```bash
# Check service registration
railway ps

# Restart API gateway
railway restart api-gateway

# Verify service URLs
railway variables | grep -E "_URL|_HOST"
```

### 8. Memory and Resource Issues

#### Symptoms
- Out of memory errors
- CPU usage spikes
- Service crashes

#### Diagnosis
```bash
# Check resource usage
railway metrics

# Monitor memory usage over time
railway logs | grep -i "memory\|oom"

# Check for memory leaks
railway run npm run memory:analysis
```

#### Solutions

**Memory Optimization**
```bash
# Increase memory limits in Railway dashboard
# Or optimize application code

# Check Node.js memory usage
railway variables set NODE_OPTIONS="--max-old-space-size=1024"

# Enable garbage collection monitoring
railway variables set NODE_ENV=production
railway variables set DEBUG=gc
```

### 9. SSL/TLS Certificate Issues

#### Symptoms
- SSL certificate warnings
- HTTPS not working
- Mixed content errors

#### Diagnosis
```bash
# Check SSL certificate
openssl s_client -connect globaltaxcalc.com:443 -servername globaltaxcalc.com

# Verify domain configuration
railway domain list

# Check certificate expiration
curl -vI https://globaltaxcalc.com 2>&1 | grep -i "expire\|valid"
```

#### Solutions

**Certificate Renewal**
```bash
# Railway handles SSL automatically
# If issues persist, remove and re-add domain
railway domain remove globaltaxcalc.com
railway domain add globaltaxcalc.com
```

### 10. Monitoring and Alerting Issues

#### Symptoms
- No monitoring data
- Alerts not firing
- Dashboard not updating

#### Diagnosis
```bash
# Check monitoring service
railway logs --service monitoring-health-service

# Test metrics endpoints
curl https://api.globaltaxcalc.com/metrics

# Verify monitoring configuration
railway variables | grep -E "(DATADOG|SENTRY|PROMETHEUS)"
```

#### Solutions

**Monitoring Configuration**
```bash
# Update monitoring API keys
railway variables set DATADOG_API_KEY="your-api-key"
railway variables set SENTRY_DSN="your-sentry-dsn"

# Restart monitoring service
railway restart monitoring-health-service
```

## Emergency Procedures

### Complete System Outage

1. **Immediate Response**
```bash
# Check Railway status
curl -s https://status.railway.app/api/v2/status.json

# Check all services
railway ps

# Quick restart all services
railway restart
```

2. **Rollback Procedure**
```bash
# Rollback to previous deployment
railway rollback

# Verify rollback
curl -f https://globaltaxcalc.com/health
```

3. **Communication**
- Update status page
- Notify users via email/social media
- Inform stakeholders

### Database Corruption

1. **Immediate Actions**
```bash
# Stop application to prevent further damage
railway pause

# Check database integrity
railway run psql $DATABASE_URL -c "SELECT pg_database_size(current_database());"
```

2. **Recovery**
```bash
# Restore from latest backup
railway run pg_restore --clean --if-exists -d $DATABASE_URL latest_backup.sql

# Verify data integrity
railway run npm run db:verify
```

### Security Incident

1. **Immediate Response**
```bash
# Rotate all secrets
railway variables set JWT_SECRET=$(openssl rand -base64 64)
railway variables set SESSION_SECRET=$(openssl rand -base64 64)

# Check for unauthorized access
railway logs | grep -i "unauthorized\|failed\|invalid"
```

2. **Investigation**
```bash
# Export logs for analysis
railway logs --json > incident_logs.json

# Check recent deployments
railway deployments
```

## Performance Optimization

### Database Optimization
```sql
-- Check slow queries
SELECT query, mean_time, calls
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Check index usage
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE tablename = 'your_table_name';

-- Analyze table statistics
ANALYZE;
```

### Application Optimization
```bash
# Enable Node.js profiling
railway variables set NODE_OPTIONS="--prof"

# Monitor garbage collection
railway variables set NODE_OPTIONS="--trace-gc"

# Optimize memory usage
railway variables set NODE_OPTIONS="--max-old-space-size=1024"
```

## Monitoring Commands

### Real-time Monitoring
```bash
# Stream logs
railway logs --follow

# Monitor resource usage
watch -n 5 "railway metrics"

# Check service health continuously
watch -n 30 "curl -s https://globaltaxcalc.com/health | jq ."
```

### Log Analysis
```bash
# Search for errors
railway logs | grep -i error

# Count error types
railway logs | grep -i error | awk '{print $5}' | sort | uniq -c

# Monitor response times
railway logs | grep -o '"responseTime":[0-9]*' | cut -d: -f2 | sort -n
```

## Recovery Procedures

### Service Recovery
```bash
# Restart individual service
railway restart api-gateway

# Restart all services
railway restart

# Redeploy from latest commit
railway up --detach
```

### Data Recovery
```bash
# List available backups
railway backups list

# Restore from specific backup
railway backups restore backup-id

# Verify restore
railway run npm run db:verify
```

## Contact Information

### Emergency Contacts
- **DevOps On-call**: oncall@globaltaxcalc.com
- **Engineering Manager**: eng-manager@globaltaxcalc.com
- **Product Manager**: product@globaltaxcalc.com

### External Support
- **Railway Support**: https://railway.app/help
- **DNS Provider**: [Your DNS provider support]
- **Monitoring Service**: [Your monitoring provider support]

### Internal Resources
- **Runbook Repository**: `deployment/docs/`
- **Monitoring Dashboard**: https://railway.app/project/your-project-id
- **Error Tracking**: [Your Sentry/error tracking URL]
- **Status Page**: https://status.globaltaxcalc.com