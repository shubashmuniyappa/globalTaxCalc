/**
 * Multi-Tenant Core Architecture
 * Handles tenant isolation, data security, and tenant lifecycle management
 */

const crypto = require('crypto');
const mongoose = require('mongoose');
const Redis = require('redis');

class TenantCore {
    constructor() {
        this.tenantCache = new Map();
        this.redisClient = null;
        this.tenantConnections = new Map();
        this.initializeRedis();
    }

    async initializeRedis() {
        this.redisClient = Redis.createClient({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD
        });

        this.redisClient.on('error', (err) => {
            console.error('Redis error:', err);
        });

        await this.redisClient.connect();
    }

    /**
     * Tenant Management
     */
    async createTenant(tenantData) {
        try {
            const tenantId = this.generateTenantId();
            const encryptionKey = this.generateEncryptionKey();

            const tenant = {
                id: tenantId,
                name: tenantData.name,
                slug: tenantData.slug || this.generateSlug(tenantData.name),
                subdomain: tenantData.subdomain,
                customDomain: tenantData.customDomain || null,
                encryptionKey: encryptionKey,
                status: 'active',
                plan: tenantData.plan || 'enterprise',
                settings: {
                    maxUsers: tenantData.maxUsers || 100,
                    maxClients: tenantData.maxClients || 1000,
                    apiRateLimit: tenantData.apiRateLimit || 10000,
                    storageLimit: tenantData.storageLimit || '100GB',
                    features: tenantData.features || this.getDefaultFeatures(),
                    ...tenantData.settings
                },
                branding: this.getDefaultBranding(),
                database: {
                    name: `tenant_${tenantId}`,
                    connectionString: this.generateDatabaseConnection(tenantId),
                    isolated: true
                },
                security: {
                    ssoEnabled: tenantData.ssoEnabled || false,
                    mfaRequired: tenantData.mfaRequired || false,
                    ipWhitelist: tenantData.ipWhitelist || [],
                    sessionTimeout: tenantData.sessionTimeout || 8 * 60 * 60 * 1000 // 8 hours
                },
                billing: {
                    model: tenantData.billingModel || 'usage',
                    contractStart: new Date(),
                    contractEnd: null,
                    lastBilled: null,
                    usage: {
                        calculations: 0,
                        apiCalls: 0,
                        storage: 0,
                        users: 0
                    }
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Save to master database
            await this.saveTenant(tenant);

            // Create tenant database
            await this.createTenantDatabase(tenant);

            // Cache tenant data
            await this.cacheTenant(tenant);

            console.log(`Tenant created: ${tenant.name} (${tenant.id})`);
            return tenant;

        } catch (error) {
            console.error('Error creating tenant:', error);
            throw error;
        }
    }

    async getTenant(identifier) {
        try {
            // Try cache first
            let tenant = this.tenantCache.get(identifier);
            if (tenant) return tenant;

            // Try Redis cache
            const cached = await this.redisClient.get(`tenant:${identifier}`);
            if (cached) {
                tenant = JSON.parse(cached);
                this.tenantCache.set(identifier, tenant);
                return tenant;
            }

            // Query database
            tenant = await this.queryTenant(identifier);
            if (tenant) {
                await this.cacheTenant(tenant);
                return tenant;
            }

            return null;

        } catch (error) {
            console.error('Error getting tenant:', error);
            throw error;
        }
    }

    async updateTenant(tenantId, updates) {
        try {
            const tenant = await this.getTenant(tenantId);
            if (!tenant) {
                throw new Error('Tenant not found');
            }

            const updatedTenant = {
                ...tenant,
                ...updates,
                updatedAt: new Date()
            };

            await this.saveTenant(updatedTenant);
            await this.cacheTenant(updatedTenant);

            console.log(`Tenant updated: ${tenant.name} (${tenantId})`);
            return updatedTenant;

        } catch (error) {
            console.error('Error updating tenant:', error);
            throw error;
        }
    }

    async suspendTenant(tenantId, reason) {
        try {
            const tenant = await this.updateTenant(tenantId, {
                status: 'suspended',
                suspensionReason: reason,
                suspendedAt: new Date()
            });

            // Revoke all active sessions
            await this.revokeAllSessions(tenantId);

            console.log(`Tenant suspended: ${tenant.name} (${tenantId}) - ${reason}`);
            return tenant;

        } catch (error) {
            console.error('Error suspending tenant:', error);
            throw error;
        }
    }

    /**
     * Data Isolation
     */
    async getTenantDatabase(tenantId) {
        if (this.tenantConnections.has(tenantId)) {
            return this.tenantConnections.get(tenantId);
        }

        const tenant = await this.getTenant(tenantId);
        if (!tenant) {
            throw new Error('Tenant not found');
        }

        const connection = mongoose.createConnection(tenant.database.connectionString, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000
        });

        this.tenantConnections.set(tenantId, connection);
        return connection;
    }

    async encryptTenantData(tenantId, data) {
        const tenant = await this.getTenant(tenantId);
        const cipher = crypto.createCipher('aes-256-cbc', tenant.encryptionKey);
        let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    }

    async decryptTenantData(tenantId, encryptedData) {
        const tenant = await this.getTenant(tenantId);
        const decipher = crypto.createDecipher('aes-256-cbc', tenant.encryptionKey);
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
    }

    /**
     * Domain and Routing
     */
    async resolveTenantFromRequest(req) {
        const host = req.get('host');
        const subdomain = this.extractSubdomain(host);

        // Try custom domain first
        let tenant = await this.getTenantByCustomDomain(host);

        if (!tenant && subdomain) {
            // Try subdomain
            tenant = await this.getTenantBySubdomain(subdomain);
        }

        if (!tenant) {
            throw new Error('Tenant not found for domain: ' + host);
        }

        // Check tenant status
        if (tenant.status !== 'active') {
            throw new Error(`Tenant is ${tenant.status}`);
        }

        return tenant;
    }

    extractSubdomain(host) {
        const parts = host.split('.');
        if (parts.length > 2) {
            return parts[0];
        }
        return null;
    }

    async getTenantByCustomDomain(domain) {
        const query = { customDomain: domain };
        return await this.queryTenant(query);
    }

    async getTenantBySubdomain(subdomain) {
        const query = { subdomain: subdomain };
        return await this.queryTenant(query);
    }

    /**
     * Resource Management
     */
    async checkTenantLimits(tenantId, resourceType, amount) {
        const tenant = await this.getTenant(tenantId);
        const limits = tenant.settings;

        switch (resourceType) {
            case 'users':
                return tenant.billing.usage.users + amount <= limits.maxUsers;
            case 'clients':
                return tenant.billing.usage.clients <= limits.maxClients;
            case 'apiCalls':
                return await this.checkApiRateLimit(tenantId);
            case 'storage':
                return await this.checkStorageLimit(tenantId, amount);
            default:
                return true;
        }
    }

    async checkApiRateLimit(tenantId) {
        const key = `api_rate_limit:${tenantId}`;
        const current = await this.redisClient.get(key) || 0;
        const tenant = await this.getTenant(tenantId);

        return parseInt(current) < tenant.settings.apiRateLimit;
    }

    async incrementApiUsage(tenantId) {
        const key = `api_rate_limit:${tenantId}`;
        const current = await this.redisClient.incr(key);

        if (current === 1) {
            await this.redisClient.expire(key, 3600); // 1 hour window
        }

        // Update tenant usage
        await this.updateTenantUsage(tenantId, 'apiCalls', 1);
        return current;
    }

    async updateTenantUsage(tenantId, type, amount) {
        const tenant = await this.getTenant(tenantId);
        tenant.billing.usage[type] = (tenant.billing.usage[type] || 0) + amount;
        await this.saveTenant(tenant);
        await this.cacheTenant(tenant);
    }

    /**
     * Utility Methods
     */
    generateTenantId() {
        return crypto.randomBytes(16).toString('hex');
    }

    generateEncryptionKey() {
        return crypto.randomBytes(32).toString('hex');
    }

    generateSlug(name) {
        return name.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
    }

    generateDatabaseConnection(tenantId) {
        const dbHost = process.env.TENANT_DB_HOST || 'localhost';
        const dbPort = process.env.TENANT_DB_PORT || 27017;
        const dbName = `tenant_${tenantId}`;
        return `mongodb://${dbHost}:${dbPort}/${dbName}`;
    }

    getDefaultFeatures() {
        return {
            calculations: true,
            reporting: true,
            integrations: true,
            whiteLabel: true,
            sso: true,
            api: true,
            bulkProcessing: true,
            customBranding: true,
            clientPortal: true,
            auditLogs: true
        };
    }

    getDefaultBranding() {
        return {
            primaryColor: '#1976d2',
            secondaryColor: '#424242',
            logoUrl: null,
            companyName: 'Tax Calculator',
            favicon: null,
            customCss: '',
            emailTemplates: {},
            footer: {
                text: 'Powered by GlobalTaxCalc',
                links: []
            }
        };
    }

    async cacheTenant(tenant) {
        this.tenantCache.set(tenant.id, tenant);
        this.tenantCache.set(tenant.slug, tenant);
        if (tenant.subdomain) {
            this.tenantCache.set(tenant.subdomain, tenant);
        }
        if (tenant.customDomain) {
            this.tenantCache.set(tenant.customDomain, tenant);
        }

        // Cache in Redis for 1 hour
        await this.redisClient.setEx(`tenant:${tenant.id}`, 3600, JSON.stringify(tenant));
    }

    async saveTenant(tenant) {
        // Implementation depends on your database choice
        // This is a placeholder for the actual database save operation
        console.log('Saving tenant to database:', tenant.id);
    }

    async queryTenant(identifier) {
        // Implementation depends on your database choice
        // This is a placeholder for the actual database query operation
        console.log('Querying tenant from database:', identifier);
        return null;
    }

    async createTenantDatabase(tenant) {
        // Create dedicated database for tenant
        console.log('Creating tenant database:', tenant.database.name);

        // Initialize schemas and default data
        const connection = await this.getTenantDatabase(tenant.id);

        // Create collections with proper indexes
        const collections = [
            'users', 'clients', 'calculations', 'reports',
            'integrations', 'auditlogs', 'configurations'
        ];

        for (const collectionName of collections) {
            await connection.db.createCollection(collectionName);
        }

        console.log('Tenant database created successfully');
    }

    async revokeAllSessions(tenantId) {
        // Revoke all active sessions for tenant
        const pattern = `session:${tenantId}:*`;
        const keys = await this.redisClient.keys(pattern);

        if (keys.length > 0) {
            await this.redisClient.del(keys);
        }

        console.log(`Revoked ${keys.length} sessions for tenant ${tenantId}`);
    }
}

module.exports = TenantCore;