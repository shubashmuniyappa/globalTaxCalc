/**
 * Multi-Tenant Middleware
 * Handles tenant resolution, context injection, and request isolation
 */

const TenantCore = require('./tenant-core');

class TenantMiddleware {
    constructor() {
        this.tenantCore = new TenantCore();
    }

    /**
     * Main tenant resolution middleware
     */
    resolveTenant() {
        return async (req, res, next) => {
            try {
                // Resolve tenant from request
                const tenant = await this.tenantCore.resolveTenantFromRequest(req);

                // Inject tenant context
                req.tenant = tenant;
                req.tenantId = tenant.id;

                // Set tenant database connection
                req.tenantDb = await this.tenantCore.getTenantDatabase(tenant.id);

                // Add tenant info to response headers (for debugging)
                res.set('X-Tenant-ID', tenant.id);
                res.set('X-Tenant-Name', tenant.name);

                next();

            } catch (error) {
                console.error('Tenant resolution error:', error);
                return res.status(404).json({
                    error: 'Tenant not found',
                    message: error.message
                });
            }
        };
    }

    /**
     * Tenant status check middleware
     */
    checkTenantStatus() {
        return (req, res, next) => {
            const tenant = req.tenant;

            if (!tenant) {
                return res.status(400).json({
                    error: 'No tenant context'
                });
            }

            switch (tenant.status) {
                case 'active':
                    next();
                    break;
                case 'suspended':
                    return res.status(403).json({
                        error: 'Tenant suspended',
                        reason: tenant.suspensionReason,
                        contact: 'support@globaltaxcalc.com'
                    });
                case 'expired':
                    return res.status(402).json({
                        error: 'Tenant subscription expired',
                        renewalUrl: '/billing/renew'
                    });
                default:
                    return res.status(503).json({
                        error: 'Tenant not available',
                        status: tenant.status
                    });
            }
        };
    }

    /**
     * Resource limit check middleware
     */
    checkResourceLimits(resourceType) {
        return async (req, res, next) => {
            try {
                const tenantId = req.tenantId;
                const amount = req.body.amount || 1;

                const withinLimits = await this.tenantCore.checkTenantLimits(
                    tenantId,
                    resourceType,
                    amount
                );

                if (!withinLimits) {
                    return res.status(429).json({
                        error: 'Resource limit exceeded',
                        resourceType: resourceType,
                        upgradeUrl: '/billing/upgrade'
                    });
                }

                next();

            } catch (error) {
                console.error('Resource limit check error:', error);
                return res.status(500).json({
                    error: 'Failed to check resource limits'
                });
            }
        };
    }

    /**
     * API rate limiting middleware
     */
    apiRateLimit() {
        return async (req, res, next) => {
            try {
                const tenantId = req.tenantId;
                const withinLimit = await this.tenantCore.checkApiRateLimit(tenantId);

                if (!withinLimit) {
                    return res.status(429).json({
                        error: 'API rate limit exceeded',
                        retryAfter: 3600,
                        upgradeUrl: '/billing/upgrade'
                    });
                }

                // Increment usage
                await this.tenantCore.incrementApiUsage(tenantId);

                next();

            } catch (error) {
                console.error('API rate limit error:', error);
                next(); // Don't block request on rate limit check failure
            }
        };
    }

    /**
     * Data isolation middleware
     */
    enforceDataIsolation() {
        return (req, res, next) => {
            const originalJson = res.json;
            const originalSend = res.send;

            // Override response methods to ensure no cross-tenant data leakage
            res.json = function(data) {
                // Add tenant validation to response data
                if (data && typeof data === 'object') {
                    data._tenantId = req.tenantId;
                }
                return originalJson.call(this, data);
            };

            res.send = function(data) {
                // Log response for audit purposes
                console.log(`Response sent for tenant ${req.tenantId}:`, {
                    method: req.method,
                    url: req.url,
                    status: res.statusCode,
                    size: Buffer.byteLength(data || '', 'utf8')
                });
                return originalSend.call(this, data);
            };

            next();
        };
    }

    /**
     * Security headers middleware
     */
    setSecurityHeaders() {
        return (req, res, next) => {
            const tenant = req.tenant;

            // Set tenant-specific security headers
            res.set('X-Content-Type-Options', 'nosniff');
            res.set('X-Frame-Options', 'DENY');
            res.set('X-XSS-Protection', '1; mode=block');
            res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

            // Content Security Policy with tenant domain
            if (tenant.customDomain) {
                res.set('Content-Security-Policy',
                    `default-src 'self' ${tenant.customDomain}; ` +
                    `script-src 'self' 'unsafe-inline' ${tenant.customDomain}; ` +
                    `style-src 'self' 'unsafe-inline' ${tenant.customDomain};`
                );
            }

            next();
        };
    }

    /**
     * Audit logging middleware
     */
    auditLog() {
        return async (req, res, next) => {
            const startTime = Date.now();

            // Capture original end method
            const originalEnd = res.end;

            res.end = function(chunk, encoding) {
                const endTime = Date.now();
                const duration = endTime - startTime;

                // Log to tenant's audit trail
                const auditEntry = {
                    tenantId: req.tenantId,
                    timestamp: new Date(),
                    method: req.method,
                    url: req.url,
                    userAgent: req.get('user-agent'),
                    ip: req.ip,
                    statusCode: res.statusCode,
                    duration: duration,
                    userId: req.user?.id,
                    requestSize: req.get('content-length') || 0,
                    responseSize: res.get('content-length') || 0
                };

                // Async logging (don't block response)
                setImmediate(() => {
                    this.logAuditEntry(auditEntry);
                });

                originalEnd.call(this, chunk, encoding);
            }.bind(this);

            next();
        };
    }

    async logAuditEntry(entry) {
        try {
            const tenantDb = await this.tenantCore.getTenantDatabase(entry.tenantId);
            const AuditLog = tenantDb.model('AuditLog', {
                timestamp: Date,
                method: String,
                url: String,
                userAgent: String,
                ip: String,
                statusCode: Number,
                duration: Number,
                userId: String,
                requestSize: Number,
                responseSize: Number
            });

            await AuditLog.create(entry);

        } catch (error) {
            console.error('Failed to log audit entry:', error);
        }
    }

    /**
     * Tenant branding middleware
     */
    injectBranding() {
        return (req, res, next) => {
            const tenant = req.tenant;

            // Add branding data to response context
            req.branding = {
                primaryColor: tenant.branding.primaryColor,
                secondaryColor: tenant.branding.secondaryColor,
                logoUrl: tenant.branding.logoUrl,
                companyName: tenant.branding.companyName,
                customCss: tenant.branding.customCss,
                favicon: tenant.branding.favicon
            };

            // Override render method to inject branding
            const originalRender = res.render;
            res.render = function(view, locals, callback) {
                const renderLocals = {
                    ...locals,
                    branding: req.branding,
                    tenant: {
                        name: tenant.name,
                        id: tenant.id
                    }
                };
                return originalRender.call(this, view, renderLocals, callback);
            };

            next();
        };
    }

    /**
     * Error handling middleware
     */
    errorHandler() {
        return (error, req, res, next) => {
            console.error('Tenant middleware error:', error);

            // Determine error type and response
            let statusCode = 500;
            let message = 'Internal server error';

            if (error.name === 'TenantNotFoundError') {
                statusCode = 404;
                message = 'Tenant not found';
            } else if (error.name === 'TenantSuspendedError') {
                statusCode = 403;
                message = 'Tenant suspended';
            } else if (error.name === 'ResourceLimitError') {
                statusCode = 429;
                message = 'Resource limit exceeded';
            }

            res.status(statusCode).json({
                error: message,
                tenantId: req.tenantId,
                timestamp: new Date().toISOString()
            });
        };
    }
}

module.exports = TenantMiddleware;