# Incident Response Procedures - GlobalTaxCalc.com

## Overview
This document outlines the incident response procedures for GlobalTaxCalc.com, including escalation paths, communication protocols, and recovery procedures.

## Incident Classification

### Severity Levels

#### P1 - Critical (Response: 5 minutes)
**Impact**: Complete service outage, data loss, security breach
**Examples**:
- Website completely inaccessible
- Database corruption or data loss
- Security breach with user data exposure
- Payment system compromise
- Error rate >50%

**Response Team**: All hands on deck
**Communication**: Immediate notification to all stakeholders

#### P2 - High (Response: 15 minutes)
**Impact**: Major functionality impaired, significant user impact
**Examples**:
- Authentication system down
- Tax calculation engine failure
- File upload system unavailable
- Major performance degradation
- Error rate 10-50%

**Response Team**: On-call engineer + manager
**Communication**: Stakeholder notification within 30 minutes

#### P3 - Medium (Response: 30 minutes)
**Impact**: Partial functionality affected, moderate user impact
**Examples**:
- Single microservice degraded
- Report generation delays
- Non-critical API endpoints failing
- Performance issues on specific features
- Error rate 5-10%

**Response Team**: On-call engineer
**Communication**: Internal team notification

#### P4 - Low (Response: 2 hours)
**Impact**: Minor issues, minimal user impact
**Examples**:
- Cosmetic UI issues
- Minor performance degradation
- Logging or monitoring issues
- Documentation problems
- Error rate <5%

**Response Team**: Regular business hours support
**Communication**: Optional stakeholder notification

## Incident Response Team

### Core Team Roles

#### Incident Commander (IC)
**Responsibilities**:
- Overall incident coordination
- Decision making authority
- External communication
- Resource allocation

**Primary**: Senior Engineering Manager
**Backup**: Engineering Director

#### Technical Lead
**Responsibilities**:
- Technical investigation and resolution
- Coordinate technical team efforts
- Implement fixes and workarounds

**Primary**: Senior Backend Engineer
**Backup**: DevOps Engineer

#### Communications Lead
**Responsibilities**:
- Stakeholder communication
- Status page updates
- Customer communication
- Documentation

**Primary**: Product Manager
**Backup**: Customer Success Manager

#### Subject Matter Experts (SMEs)
- **Database**: Database Administrator
- **Security**: Security Engineer
- **Frontend**: Frontend Team Lead
- **Infrastructure**: DevOps Engineer

## Incident Response Process

### Phase 1: Detection and Assessment (0-5 minutes)

#### 1. Alert Receipt
- Monitor receives automated alert or user report
- On-call engineer acknowledges alert
- Initial severity assessment

#### 2. Immediate Triage
```bash
# Quick system health check
railway ps
curl -f https://globaltaxcalc.com/health
railway logs --tail 50

# Check metrics dashboard
# Review recent deployments
railway deployments --limit 5
```

#### 3. Severity Determination
- Assess user impact
- Determine affected services
- Classify incident severity
- Page appropriate responders

### Phase 2: Mobilization (5-15 minutes)

#### 1. Team Assembly
- Incident Commander takes control
- Technical Lead begins investigation
- Communications Lead prepares messaging
- SMEs join as needed

#### 2. Communication Setup
```bash
# Create incident Slack channel
# Format: #incident-YYYY-MM-DD-brief-description

# Initial stakeholder notification
# Status page update (if P1 or P2)
```

#### 3. Initial Investigation
```bash
# Gather system information
railway status
railway metrics
railway logs --since 30m

# Check external dependencies
curl -f https://api.stripe.com/v1/status  # Payment processing
curl -f https://api.sendgrid.com/v3/stats  # Email service

# Review recent changes
git log --oneline --since="2 hours ago"
```

### Phase 3: Investigation and Mitigation (15-60 minutes)

#### 1. Root Cause Analysis
```bash
# Detailed log analysis
railway logs --service [affected-service] --since 2h | grep -i error

# Database investigation
railway run psql $DATABASE_URL -c "
  SELECT query, mean_time, calls, total_time
  FROM pg_stat_statements
  WHERE mean_time > 1000
  ORDER BY total_time DESC LIMIT 10;
"

# Performance analysis
railway metrics --service [affected-service]

# Recent deployment analysis
railway deployments --detailed
```

#### 2. Immediate Mitigation
**Option A: Quick Fix**
```bash
# Apply hot fix
git checkout main
git cherry-pick [fix-commit]
railway up --detach
```

**Option B: Rollback**
```bash
# Rollback to previous version
railway rollback

# Verify rollback success
curl -f https://globaltaxcalc.com/health
```

**Option C: Service Isolation**
```bash
# Isolate problematic service
railway pause [service-name]

# Route traffic around failed service
# Update load balancer configuration
```

#### 3. Validation
```bash
# Verify fix effectiveness
curl -f https://globaltaxcalc.com/health
curl -f https://api.globaltaxcalc.com/health

# Run critical path tests
cd tests
npm run test:critical-path

# Monitor metrics for improvement
```

### Phase 4: Recovery and Monitoring (60+ minutes)

#### 1. Full Service Restoration
```bash
# Gradually restore all services
railway resume [service-name]

# Full system health check
./deployment/scripts/health-check.sh

# Performance validation
npm run test:load
```

#### 2. Extended Monitoring
- Monitor system for 2x the incident duration
- Watch for secondary failures
- Verify all metrics return to baseline
- Confirm user reports resolved

#### 3. Communication Updates
```
✅ RESOLVED: [Incident Description]
Resolution: [Technical fix implemented]
Duration: [Total incident time]
Impact: [User impact summary]
Next Steps: Post-incident review scheduled for [date/time]
```

## Communication Protocols

### Internal Communication

#### Slack Channels
- **#incident-response**: Real-time incident coordination
- **#critical-alerts**: Automated critical alerts
- **#engineering**: Engineering team updates
- **#leadership**: Executive briefings

#### Incident Channel Template
```
📍 INCIDENT ROOM: #incident-YYYY-MM-DD-description

🚨 Severity: P[1-4]
⏰ Started: [timestamp]
👤 IC: @[incident-commander]
🔧 Tech Lead: @[technical-lead]
📢 Comms: @[communications-lead]

📋 Status: [Investigating/Identified/Mitigating/Resolved]
🎯 Impact: [Description of user impact]
🔍 Summary: [Brief problem description]
🛠️ Actions: [Current actions being taken]
📈 Next Update: [timestamp]
```

### External Communication

#### Status Page Updates
**Initial Update**:
```
We are currently investigating reports of [issue description].
We will provide updates as more information becomes available.
```

**Progress Update**:
```
We have identified the issue with [component] and are working on a fix.
We estimate resolution within [timeframe].
```

**Resolution**:
```
The issue has been resolved. All services are operating normally.
We apologize for any inconvenience this may have caused.
```

#### Customer Communication
- **Email**: For incidents affecting >10% of users
- **In-app notifications**: For feature-specific issues
- **Social media**: For major outages only

### Escalation Matrix

#### P1 Incidents
| Time | Action | Notification |
|------|--------|-------------|
| 0-5 min | On-call engineer response | Slack alerts |
| 5-15 min | Manager escalation | Phone + email |
| 15-30 min | Director notification | All channels |
| 30-60 min | Executive briefing | Direct contact |

#### P2 Incidents
| Time | Action | Notification |
|------|--------|-------------|
| 0-15 min | On-call engineer response | Slack alerts |
| 15-45 min | Manager notification | Email + Slack |
| 45-90 min | Director briefing | As needed |

## Specific Incident Types

### Database Incidents

#### Database Connection Issues
```bash
# Immediate checks
railway run psql $DATABASE_URL -c "SELECT 1;"

# Connection pool analysis
railway run psql $DATABASE_URL -c "
  SELECT count(*) as connections, state
  FROM pg_stat_activity
  GROUP BY state;
"

# Restart database connections
railway restart api-gateway
railway restart auth-service
```

#### Database Performance Issues
```bash
# Identify slow queries
railway run psql $DATABASE_URL -c "
  SELECT query, mean_time, calls
  FROM pg_stat_statements
  WHERE mean_time > 1000
  ORDER BY mean_time DESC LIMIT 5;
"

# Check for locks
railway run psql $DATABASE_URL -c "
  SELECT blocked_locks.pid AS blocked_pid,
         blocking_locks.pid AS blocking_pid
  FROM pg_catalog.pg_locks blocked_locks
  JOIN pg_catalog.pg_locks blocking_locks
    ON blocking_locks.locktype = blocked_locks.locktype
  WHERE NOT blocked_locks.granted;
"

# Emergency query termination (last resort)
railway run psql $DATABASE_URL -c "SELECT pg_terminate_backend([pid]);"
```

### Security Incidents

#### Potential Data Breach
1. **Immediate Response**
   ```bash
   # Isolate affected systems
   railway pause [affected-services]

   # Preserve evidence
   railway logs --since 24h > incident-logs.json

   # Rotate secrets
   railway variables set JWT_SECRET=$(openssl rand -base64 64)
   ```

2. **Investigation**
   - Review access logs
   - Check for unauthorized database access
   - Analyze API request patterns
   - Coordinate with security team

3. **Notification Requirements**
   - Legal team (immediate)
   - Compliance officer (within 1 hour)
   - Affected users (within 72 hours if confirmed breach)

#### DDoS Attack
```bash
# Check request patterns
railway logs | grep -E "GET|POST" | awk '{print $1}' | sort | uniq -c | sort -nr | head -20

# Enable rate limiting
railway variables set RATE_LIMIT_ENABLED=true
railway variables set RATE_LIMIT_MAX_REQUESTS=50

# Block suspicious IPs (if using Cloudflare)
# Use Cloudflare dashboard or API
```

### Payment System Incidents

#### Payment Processing Failures
1. **Immediate Actions**
   ```bash
   # Check payment service status
   curl -f https://api.stripe.com/v1/charges/test

   # Review payment-related logs
   railway logs | grep -i payment

   # Verify webhook endpoints
   curl -f https://api.globaltaxcalc.com/api/webhooks/stripe
   ```

2. **User Communication**
   - Immediate notification for failed payments
   - Clear instructions for retrying
   - Alternative payment methods if available

## Recovery Procedures

### Service Recovery

#### Single Service Failure
```bash
# Restart individual service
railway restart [service-name]

# Verify health
curl -f https://api.globaltaxcalc.com/api/[service]/health

# Monitor for stability
watch -n 30 "curl -s https://api.globaltaxcalc.com/api/[service]/health"
```

#### Multiple Service Failure
```bash
# Restart all services in dependency order
railway restart postgresql
sleep 30
railway restart redis
sleep 30
railway restart auth-service
railway restart tax-engine
railway restart api-gateway
```

### Data Recovery

#### Database Recovery
```bash
# List available backups
railway backups list

# Restore from latest backup
railway backups restore [backup-id]

# Verify data integrity
railway run npm run db:verify

# Run data consistency checks
railway run npm run db:consistency-check
```

#### File Recovery
```bash
# Check S3 backup availability
aws s3 ls s3://globaltaxcalc-backups/

# Restore files from backup
aws s3 sync s3://globaltaxcalc-backups/[date]/ ./restore/

# Verify file integrity
find ./restore -name "*.pdf" -exec file {} \;
```

## Post-Incident Activities

### Immediate Post-Incident (Within 24 hours)

1. **Service Verification**
   - All services healthy
   - Performance metrics normalized
   - User reports resolved

2. **Initial Documentation**
   - Timeline of events
   - Actions taken
   - Immediate lessons learned

3. **Stakeholder Communication**
   - Final status update
   - Preliminary cause identification
   - Post-incident review scheduling

### Post-Incident Review (Within 5 days)

#### Review Agenda
1. **Timeline Review** (30 minutes)
   - Detailed incident timeline
   - Response time analysis
   - Communication effectiveness

2. **Root Cause Analysis** (45 minutes)
   - Technical root cause
   - Contributing factors
   - Process gaps identified

3. **Action Items** (30 minutes)
   - Technical improvements
   - Process improvements
   - Monitoring enhancements

#### Review Template
```
# Post-Incident Review: [Incident Description]

## Incident Summary
- **Date**: [Date]
- **Duration**: [Duration]
- **Severity**: P[1-4]
- **Services Affected**: [List]
- **User Impact**: [Description]

## Timeline
| Time | Event | Action Taken |
|------|-------|-------------|
| [HH:MM] | [Event] | [Action] |

## Root Cause
[Detailed technical explanation]

## Contributing Factors
- [Factor 1]
- [Factor 2]

## What Went Well
- [Positive aspect 1]
- [Positive aspect 2]

## What Could Be Improved
- [Improvement area 1]
- [Improvement area 2]

## Action Items
| Action | Owner | Due Date | Priority |
|--------|-------|----------|----------|
| [Action] | [Owner] | [Date] | [P1-P4] |

## Lessons Learned
[Key takeaways for future incidents]
```

### Follow-up Actions

#### Technical Improvements
- Code fixes and patches
- Infrastructure enhancements
- Monitoring improvements
- Automated testing additions

#### Process Improvements
- Response procedure updates
- Communication protocol refinements
- Training requirements
- Documentation updates

## Training and Preparedness

### Regular Drills
- **Monthly**: Incident response simulation
- **Quarterly**: Full disaster recovery test
- **Annually**: Tabletop exercises with leadership

### Training Requirements
- All engineers: Incident response basics
- On-call engineers: Advanced troubleshooting
- Managers: Communication and coordination
- Leadership: Decision making under pressure

### Documentation Maintenance
- **Monthly**: Review and update procedures
- **Quarterly**: Update contact information
- **Annually**: Complete procedure overhaul

## Emergency Contacts

### Internal Escalation
| Role | Primary | Secondary | Phone |
|------|---------|-----------|--------|
| On-Call Engineer | [Name] | [Name] | [Phone] |
| Engineering Manager | [Name] | [Name] | [Phone] |
| Engineering Director | [Name] | [Name] | [Phone] |
| CTO | [Name] | [Name] | [Phone] |

### External Contacts
| Service | Contact | Phone | Email |
|---------|---------|--------|--------|
| Railway Support | Support Team | N/A | support@railway.app |
| DNS Provider | [Provider] | [Phone] | [Email] |
| Payment Processor | Stripe | [Phone] | [Email] |
| Legal Counsel | [Firm] | [Phone] | [Email] |

### Critical Information
- **Railway Project ID**: [Your project ID]
- **Domain Registrar**: [Provider and account info]
- **SSL Certificate Provider**: [Provider info]
- **CDN Provider**: Cloudflare [account info]

---

**Document Version**: 1.0
**Last Updated**: [Current Date]
**Next Review**: [Date + 6 months]
**Document Owner**: Engineering Manager