/**
 * Multi-Tenant Database Models
 * Defines schemas for tenant data with proper isolation
 */

const mongoose = require('mongoose');

// Master tenant schema (stored in main database)
const TenantSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    subdomain: {
        type: String,
        unique: true,
        sparse: true,
        index: true
    },
    customDomain: {
        type: String,
        unique: true,
        sparse: true,
        index: true
    },
    encryptionKey: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'suspended', 'expired', 'trial'],
        default: 'active',
        index: true
    },
    plan: {
        type: String,
        enum: ['starter', 'professional', 'enterprise', 'custom'],
        default: 'enterprise'
    },
    settings: {
        maxUsers: { type: Number, default: 100 },
        maxClients: { type: Number, default: 1000 },
        apiRateLimit: { type: Number, default: 10000 },
        storageLimit: { type: String, default: '100GB' },
        features: {
            calculations: { type: Boolean, default: true },
            reporting: { type: Boolean, default: true },
            integrations: { type: Boolean, default: true },
            whiteLabel: { type: Boolean, default: true },
            sso: { type: Boolean, default: true },
            api: { type: Boolean, default: true },
            bulkProcessing: { type: Boolean, default: true },
            customBranding: { type: Boolean, default: true },
            clientPortal: { type: Boolean, default: true },
            auditLogs: { type: Boolean, default: true }
        }
    },
    branding: {
        primaryColor: { type: String, default: '#1976d2' },
        secondaryColor: { type: String, default: '#424242' },
        logoUrl: String,
        companyName: { type: String, default: 'Tax Calculator' },
        favicon: String,
        customCss: String,
        emailTemplates: {
            welcome: String,
            passwordReset: String,
            invitation: String,
            notification: String
        },
        footer: {
            text: { type: String, default: 'Powered by GlobalTaxCalc' },
            links: [{
                text: String,
                url: String
            }]
        }
    },
    database: {
        name: String,
        connectionString: String,
        isolated: { type: Boolean, default: true }
    },
    security: {
        ssoEnabled: { type: Boolean, default: false },
        ssoProvider: String,
        ssoConfig: mongoose.Schema.Types.Mixed,
        mfaRequired: { type: Boolean, default: false },
        ipWhitelist: [String],
        sessionTimeout: { type: Number, default: 8 * 60 * 60 * 1000 }
    },
    billing: {
        model: {
            type: String,
            enum: ['usage', 'flat', 'tiered', 'custom'],
            default: 'usage'
        },
        contractStart: Date,
        contractEnd: Date,
        lastBilled: Date,
        usage: {
            calculations: { type: Number, default: 0 },
            apiCalls: { type: Number, default: 0 },
            storage: { type: Number, default: 0 },
            users: { type: Number, default: 0 },
            clients: { type: Number, default: 0 }
        },
        costs: {
            setup: Number,
            monthly: Number,
            perUser: Number,
            perCalculation: Number,
            perApiCall: Number
        }
    },
    support: {
        tier: {
            type: String,
            enum: ['standard', 'priority', 'premium', 'dedicated'],
            default: 'priority'
        },
        accountManager: String,
        supportEmail: String,
        supportPhone: String,
        sla: {
            responseTime: Number, // hours
            resolutionTime: Number, // hours
            uptime: Number // percentage
        }
    },
    suspensionReason: String,
    suspendedAt: Date,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

// Indexes for performance
TenantSchema.index({ status: 1, createdAt: -1 });
TenantSchema.index({ 'billing.contractEnd': 1 });
TenantSchema.index({ 'billing.lastBilled': 1 });

// Tenant-specific schemas (stored in tenant databases)

// Tenant User Schema
const TenantUserSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    firstName: String,
    lastName: String,
    role: {
        type: String,
        enum: ['admin', 'manager', 'user', 'client'],
        default: 'user'
    },
    permissions: [{
        resource: String,
        actions: [String]
    }],
    status: {
        type: String,
        enum: ['active', 'inactive', 'suspended'],
        default: 'active'
    },
    lastLogin: Date,
    loginCount: { type: Number, default: 0 },
    preferences: {
        theme: String,
        notifications: Boolean,
        language: String
    },
    ssoId: String,
    mfaEnabled: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

// Tenant Client Schema
const TenantClientSchema = new mongoose.Schema({
    clientId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    name: String,
    email: String,
    phone: String,
    company: String,
    address: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: String
    },
    taxInformation: {
        ein: String,
        ssn: String,
        filingStatus: String,
        previousYear: {
            agi: Number,
            totalTax: Number,
            refund: Number
        }
    },
    assignedUsers: [String], // User IDs
    status: {
        type: String,
        enum: ['active', 'inactive', 'archived'],
        default: 'active'
    },
    portalAccess: {
        enabled: { type: Boolean, default: false },
        lastAccess: Date,
        loginCredentials: {
            username: String,
            passwordHash: String
        }
    },
    documents: [{
        type: String,
        name: String,
        url: String,
        uploadedAt: Date,
        uploadedBy: String
    }],
    calculations: [{
        calculationId: String,
        type: String,
        year: Number,
        createdAt: Date,
        status: String
    }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

// Tenant Calculation Schema
const TenantCalculationSchema = new mongoose.Schema({
    calculationId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    clientId: {
        type: String,
        required: true,
        index: true
    },
    userId: {
        type: String,
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['individual', 'business', 'estate', 'gift', 'payroll'],
        required: true
    },
    taxYear: {
        type: Number,
        required: true,
        index: true
    },
    inputData: mongoose.Schema.Types.Mixed,
    results: mongoose.Schema.Types.Mixed,
    status: {
        type: String,
        enum: ['pending', 'calculating', 'completed', 'error'],
        default: 'pending',
        index: true
    },
    processingTime: Number, // milliseconds
    version: String,
    notes: String,
    tags: [String],
    shared: {
        enabled: { type: Boolean, default: false },
        sharedWith: [String], // User IDs
        shareToken: String,
        expiresAt: Date
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

// Tenant Integration Schema
const TenantIntegrationSchema = new mongoose.Schema({
    integrationId: {
        type: String,
        required: true,
        unique: true
    },
    name: String,
    type: {
        type: String,
        enum: ['accounting', 'payroll', 'crm', 'document', 'banking'],
        required: true
    },
    provider: String, // QuickBooks, Sage, ADP, etc.
    status: {
        type: String,
        enum: ['active', 'inactive', 'error', 'configuring'],
        default: 'configuring'
    },
    configuration: {
        apiKey: String,
        clientId: String,
        clientSecret: String,
        redirectUri: String,
        scopes: [String],
        accessToken: String,
        refreshToken: String,
        expiresAt: Date
    },
    dataMapping: {
        clients: mongoose.Schema.Types.Mixed,
        transactions: mongoose.Schema.Types.Mixed,
        accounts: mongoose.Schema.Types.Mixed
    },
    lastSync: Date,
    syncFrequency: String, // daily, weekly, monthly
    errorLog: [{
        timestamp: Date,
        error: String,
        resolved: Boolean
    }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

// Tenant Configuration Schema
const TenantConfigurationSchema = new mongoose.Schema({
    configId: {
        type: String,
        required: true,
        unique: true
    },
    category: String,
    settings: mongoose.Schema.Types.Mixed,
    isDefault: { type: Boolean, default: false },
    validFrom: Date,
    validTo: Date,
    createdBy: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

// Tenant Audit Log Schema
const TenantAuditLogSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now, index: true },
    userId: { type: String, index: true },
    action: { type: String, required: true },
    resource: String,
    resourceId: String,
    details: mongoose.Schema.Types.Mixed,
    ip: String,
    userAgent: String,
    sessionId: String,
    method: String,
    url: String,
    statusCode: Number,
    duration: Number,
    requestSize: Number,
    responseSize: Number
}, {
    timestamps: false,
    capped: { size: 100000000, max: 1000000 } // 100MB cap, 1M documents max
});

// Export models
const models = {
    Tenant: mongoose.model('Tenant', TenantSchema),

    // Factory function to create tenant-specific models
    createTenantModels: (connection) => {
        return {
            User: connection.model('User', TenantUserSchema),
            Client: connection.model('Client', TenantClientSchema),
            Calculation: connection.model('Calculation', TenantCalculationSchema),
            Integration: connection.model('Integration', TenantIntegrationSchema),
            Configuration: connection.model('Configuration', TenantConfigurationSchema),
            AuditLog: connection.model('AuditLog', TenantAuditLogSchema)
        };
    }
};

module.exports = models;