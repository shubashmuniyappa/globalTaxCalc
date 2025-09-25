# Monitoring and Alerting Runbook - GlobalTaxCalc.com

## Overview
This runbook provides comprehensive monitoring procedures, alert definitions, and response protocols for GlobalTaxCalc.com production environment.

## Monitoring Architecture

### Components
- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **Alertmanager**: Alert routing and notifications
- **Loki**: Log aggregation
- **Blackbox Exporter**: Synthetic monitoring
- **Node Exporter**: System metrics
- **Application Metrics**: Custom business metrics

### Access Information
- **Grafana Dashboard**: https://monitoring.globaltaxcalc.com
- **Prometheus**: http://prometheus.globaltaxcalc.com:9090
- **Alertmanager**: http://alertmanager.globaltaxcalc.com:9093
- **Railway Dashboard**: https://railway.app/project/your-project-id

## Key Performance Indicators (KPIs)

### System Health Metrics
| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Response Time (95th percentile) | <1s | >2s | >5s |
| Error Rate | <1% | >5% | >10% |
| Uptime | >99.9% | <99.5% | <99% |
| Memory Usage | <70% | >80% | >90% |
| CPU Usage | <60% | >75% | >85% |
| Disk Usage | <80% | >90% | >95% |

### Business Metrics
| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Daily Active Users | >100 | <50 | <20 |
| Tax Calculations/Day | >500 | <100 | <50 |
| Conversion Rate | >5% | <3% | <1% |
| Revenue/Day | >$1000 | <$500 | <$200 |

## Alert Definitions and Responses

### Critical Alerts (P1) - Response within 5 minutes

#### 1. Service Down
**Alert**: `globaltaxcalc_service_up == 0`
**Duration**: 1 minute

**Immediate Actions:**
```bash
# Check service status
railway ps

# Check logs for errors
railway logs --service [service-name] --tail 100

# Restart service if needed
railway restart [service-name]

# Verify recovery
curl -f https://globaltaxcalc.com/health
```

**Escalation Path:**
1. On-call engineer (0-5 minutes)
2. Engineering manager (5-15 minutes)
3. CTO (15-30 minutes)

#### 2. Database Down
**Alert**: `pg_up == 0`
**Duration**: 1 minute

**Immediate Actions:**
```bash
# Check database connectivity
railway connect postgresql

# Check database logs
railway logs --service postgresql

# Check connection pool
railway run psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# If needed, restart database service
railway restart postgresql
```

**Recovery Steps:**
1. Verify database backup integrity
2. Restore from backup if corruption detected
3. Run data integrity checks
4. Communicate with stakeholders

#### 3. High Error Rate
**Alert**: `rate(globaltaxcalc_http_requests_total{status_code!~"2.."}[5m]) / rate(globaltaxcalc_http_requests_total[5m]) > 0.1`
**Duration**: 2 minutes

**Investigation Steps:**
```bash
# Check error distribution
railway logs | grep -i error | head -20

# Check specific error codes
railway logs | grep -E "(4[0-9]{2}|5[0-9]{2})" | tail -50

# Monitor error trends
curl -s "http://prometheus:9090/api/v1/query?query=rate(globaltaxcalc_http_requests_total{status_code!~\"2..\"}[5m])"
```

### High Priority Alerts (P2) - Response within 15 minutes

#### 4. High Response Time
**Alert**: `histogram_quantile(0.95, rate(globaltaxcalc_http_request_duration_seconds_bucket[5m])) > 2`
**Duration**: 5 minutes

**Investigation Steps:**
```bash
# Check slow endpoints
railway logs | grep -E "responseTime.*[2-9][0-9]{3}" | head -10

# Check database performance
railway run psql $DATABASE_URL -c "
  SELECT query, mean_time, calls
  FROM pg_stat_statements
  WHERE mean_time > 1000
  ORDER BY mean_time DESC LIMIT 5;
"

# Check memory usage
railway metrics --service api-gateway
```

**Optimization Actions:**
1. Enable query optimization
2. Scale services if needed
3. Clear cache if appropriate
4. Review recent deployments

#### 5. High Memory Usage
**Alert**: `(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 85`
**Duration**: 5 minutes

**Investigation Steps:**
```bash
# Check memory usage by service
railway metrics

# Check for memory leaks
railway logs | grep -i "memory\|heap\|oom"

# Check Node.js memory usage
railway run node -e "console.log(process.memoryUsage())"
```

**Resolution Actions:**
1. Restart memory-intensive services
2. Scale horizontally if needed
3. Optimize application code
4. Adjust memory limits

### Medium Priority Alerts (P3) - Response within 30 minutes

#### 6. High Authentication Failures
**Alert**: `rate(globaltaxcalc_auth_failures_total[5m]) > 10`
**Duration**: 2 minutes

**Investigation Steps:**
```bash
# Check authentication patterns
railway logs --service auth-service | grep -i "failed\|invalid"

# Check for brute force attacks
railway logs | grep -E "401|403" | awk '{print $1}' | sort | uniq -c | sort -nr | head -10

# Monitor authentication rates
curl -s "http://prometheus:9090/api/v1/query?query=rate(globaltaxcalc_auth_failures_total[5m])"
```

#### 7. Disk Space Low
**Alert**: `(1 - (node_filesystem_avail_bytes / node_filesystem_size_bytes)) * 100 > 90`
**Duration**: 5 minutes

**Cleanup Actions:**
```bash
# Check disk usage
railway run df -h

# Clean up logs
railway run find /var/log -name "*.log" -mtime +7 -delete

# Clean up temporary files
railway run find /tmp -mtime +3 -delete

# Check for large files
railway run du -h / | sort -rh | head -20
```

## Dashboard Monitoring

### System Overview Dashboard
**Key Widgets:**
- Service status (all green = healthy)
- Request rate and response times
- Error rate trends
- Resource utilization (CPU, Memory, Disk)
- Database performance metrics

**Monitoring Frequency**: Continuous (auto-refresh every 30 seconds)

### Business Metrics Dashboard
**Key Widgets:**
- Daily/hourly active users
- Tax calculations performed
- Revenue metrics
- Conversion funnel
- Geographic usage patterns

**Monitoring Frequency**: Hourly for operations, daily for business review

### Infrastructure Dashboard
**Key Widgets:**
- Database connections and query performance
- Redis cache hit rates and memory usage
- Network traffic and latency
- File storage usage
- CDN performance metrics

## Log Monitoring Procedures

### Critical Log Patterns to Monitor

#### Error Patterns
```bash
# Application errors
railway logs | grep -E "(ERROR|FATAL|Exception)"

# Database errors
railway logs | grep -E "(connection.*failed|timeout|deadlock)"

# Authentication errors
railway logs | grep -E "(unauthorized|forbidden|invalid.*token)"

# File processing errors
railway logs | grep -E "(upload.*failed|processing.*error)"
```

#### Performance Patterns
```bash
# Slow queries
railway logs | grep -E "responseTime.*[5-9][0-9]{3}"

# Memory warnings
railway logs | grep -E "(memory.*warning|heap.*full)"

# High concurrency
railway logs | grep -E "concurrent.*limit|rate.*limit"
```

### Log Analysis Commands
```bash
# Error frequency analysis
railway logs --since 1h | grep -i error | wc -l

# Top error types
railway logs --since 1h | grep -i error | awk '{print $5}' | sort | uniq -c | sort -nr

# Response time distribution
railway logs --since 1h | grep -o '"responseTime":[0-9]*' | cut -d: -f2 | sort -n | tail -20

# User activity patterns
railway logs --since 1h | grep -o '"userId":"[^"]*"' | sort | uniq -c | sort -nr | head -10
```

## Synthetic Monitoring

### Health Check Endpoints
```bash
# Primary health checks (run every 30 seconds)
curl -f https://globaltaxcalc.com/health
curl -f https://api.globaltaxcalc.com/health
curl -f https://app.globaltaxcalc.com/health

# Service-specific health checks
curl -f https://api.globaltaxcalc.com/api/auth/health
curl -f https://api.globaltaxcalc.com/api/tax/health
curl -f https://api.globaltaxcalc.com/api/reports/health
curl -f https://api.globaltaxcalc.com/api/files/health
```

### Business Process Monitoring
```bash
# User registration flow (run every 5 minutes)
curl -X POST https://api.globaltaxcalc.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"monitor@test.com","password":"TestPass123!"}'

# Tax calculation flow (run every 5 minutes)
curl -X POST https://api.globaltaxcalc.com/api/calculations \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"income":50000,"country":"US","filingStatus":"single"}'
```

## Performance Baselines

### Response Time Baselines
- **Homepage**: <500ms (95th percentile)
- **API Authentication**: <200ms (95th percentile)
- **Tax Calculations**: <1000ms (95th percentile)
- **Report Generation**: <5000ms (95th percentile)
- **File Upload**: <2000ms for 1MB files (95th percentile)

### Throughput Baselines
- **Concurrent Users**: 1000+ simultaneous users
- **Requests per Second**: 500+ RPS sustained
- **Database Queries**: <100ms average response time
- **Cache Hit Rate**: >90% for Redis cache

## Incident Response Procedures

### Severity Levels

#### P1 - Critical (Response: 5 minutes)
- Complete service outage
- Data loss or corruption
- Security breach
- >50% error rate

#### P2 - High (Response: 15 minutes)
- Partial service degradation
- Performance significantly impacted
- Single service failure with workaround
- 10-50% error rate

#### P3 - Medium (Response: 30 minutes)
- Minor performance impact
- Non-critical feature failure
- Warning threshold exceeded
- 5-10% error rate

#### P4 - Low (Response: 2 hours)
- Cosmetic issues
- Minor performance degradation
- Low-priority feature issues
- <5% error rate

### Response Timeline

#### First 5 Minutes
1. Acknowledge alert
2. Assess severity
3. Begin immediate investigation
4. Start incident communication

#### Next 10 Minutes
1. Identify root cause
2. Implement immediate fix or workaround
3. Update stakeholders
4. Document actions taken

#### Next 15 Minutes
1. Verify fix effectiveness
2. Monitor for regression
3. Communicate resolution
4. Plan post-incident review

### Communication Templates

#### Initial Alert
```
🚨 INCIDENT: [P1/P2/P3] - [Brief Description]
Status: Investigating
Impact: [User impact description]
ETA: [Estimated resolution time]
Updates: Every 15 minutes
```

#### Status Update
```
📊 UPDATE: [Incident Description]
Status: [Investigating/Identified/Fixing/Resolved]
Impact: [Current impact]
Actions: [What we've done]
Next: [Next steps]
ETA: [Updated ETA]
```

#### Resolution
```
✅ RESOLVED: [Incident Description]
Resolution: [What fixed it]
Duration: [Total incident time]
Impact: [Final impact summary]
Follow-up: Post-incident review scheduled
```

## Alerting Channels

### Slack Integration
- **#critical-alerts**: P1 incidents
- **#alerts**: P2 and P3 incidents
- **#monitoring**: General monitoring information

### Email Notifications
- **Critical**: admin@globaltaxcalc.com, ops@globaltaxcalc.com
- **Warning**: ops@globaltaxcalc.com
- **Info**: monitoring@globaltaxcalc.com

### PagerDuty Integration
- **High Priority**: Immediate phone call + SMS
- **Medium Priority**: Push notification + email
- **Low Priority**: Email only

## Maintenance Procedures

### Scheduled Maintenance
- **Weekly**: Sundays 2:00-4:00 AM UTC
- **Monthly**: First Sunday 1:00-5:00 AM UTC
- **Emergency**: As needed with 30-minute notice

### Maintenance Checklist
```bash
# Pre-maintenance
1. Notify users via status page
2. Enable maintenance mode
3. Backup critical data
4. Verify rollback procedures

# During maintenance
1. Monitor system metrics
2. Run planned updates/patches
3. Verify functionality
4. Document changes

# Post-maintenance
1. Disable maintenance mode
2. Monitor for issues
3. Update status page
4. Communicate completion
```

## Backup and Recovery Monitoring

### Backup Verification
```bash
# Check database backup status
railway run pg_dump --verbose $DATABASE_URL > /dev/null

# Verify backup integrity
railway run pg_restore --list latest_backup.sql | wc -l

# Check backup age
ls -la backups/ | grep $(date +%Y-%m-%d)
```

### Recovery Testing
- **Monthly**: Test database restore procedure
- **Quarterly**: Full disaster recovery simulation
- **Annually**: Complete environment rebuild test

## Performance Tuning

### Database Optimization
```sql
-- Check query performance
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements
ORDER BY mean_time DESC LIMIT 10;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;

-- Analyze table statistics
ANALYZE VERBOSE;
```

### Application Optimization
```bash
# Memory profiling
railway variables set NODE_OPTIONS="--prof --heap-prof"

# Enable performance monitoring
railway variables set ENABLE_PERFORMANCE_MONITORING=true

# Monitor garbage collection
railway variables set NODE_OPTIONS="--trace-gc"
```

## Contact Information

### On-Call Rotation
- **Primary**: oncall-primary@globaltaxcalc.com
- **Secondary**: oncall-secondary@globaltaxcalc.com
- **Manager**: eng-manager@globaltaxcalc.com

### External Contacts
- **Railway Support**: support@railway.app
- **DNS Provider**: [Provider support contact]
- **Monitoring Service**: [Service support contact]

### Emergency Escalation
1. Engineering On-Call (0-5 minutes)
2. Engineering Manager (5-15 minutes)
3. VP Engineering (15-30 minutes)
4. CTO (30-60 minutes)

---

**Document Version**: 1.0
**Last Updated**: [Current Date]
**Next Review**: [Date + 3 months]