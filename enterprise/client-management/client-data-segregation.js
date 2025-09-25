/**
 * Client Data Segregation System
 * Ensures strict data isolation and access control for client information
 */

const crypto = require('crypto');

class ClientDataSegregation {
    constructor() {
        this.accessPolicies = new Map();
        this.dataClassifications = new Map();
        this.auditLog = new Map();
        this.setupDefaultClassifications();
        this.setupDefaultPolicies();
    }

    setupDefaultClassifications() {
        const classifications = [
            {
                id: 'public',
                name: 'Public',
                level: 0,
                description: 'Information that can be freely shared',
                examples: ['Company name', 'Business type']
            },
            {
                id: 'internal',
                name: 'Internal',
                level: 1,
                description: 'Information for internal use only',
                examples: ['Contact information', 'Preferences']
            },
            {
                id: 'confidential',
                name: 'Confidential',
                level: 2,
                description: 'Sensitive information requiring protection',
                examples: ['Financial data', 'Tax calculations']
            },
            {
                id: 'restricted',
                name: 'Restricted',
                level: 3,
                description: 'Highly sensitive information with strict access controls',
                examples: ['SSN', 'Bank account numbers', 'Tax returns']
            },
            {
                id: 'top_secret',
                name: 'Top Secret',
                level: 4,
                description: 'Most sensitive information requiring highest security',
                examples: ['Investigation details', 'Legal matters']
            }
        ];

        classifications.forEach(classification => {
            this.dataClassifications.set(classification.id, classification);
        });
    }

    setupDefaultPolicies() {
        const policies = [
            {
                id: 'client_isolation',
                name: 'Client Data Isolation',
                rules: [
                    'Users can only access data for clients they are assigned to',
                    'Cross-client data access is strictly prohibited',
                    'All data access must be logged and audited'
                ]
            },
            {
                id: 'role_based_access',
                name: 'Role-Based Data Access',
                rules: [
                    'Data access is determined by user role and permissions',
                    'Higher classified data requires higher authorization levels',
                    'Temporary access must be explicitly granted and time-limited'
                ]
            },
            {
                id: 'need_to_know',
                name: 'Need-to-Know Basis',
                rules: [
                    'Users only access data necessary for their job function',
                    'Administrative access requires business justification',
                    'Bulk data access requires special approval'
                ]
            }
        ];

        policies.forEach(policy => {
            this.accessPolicies.set(policy.id, policy);
        });
    }

    /**
     * Data Classification and Tagging
     */
    async classifyClientData(tenantId, clientId, dataItem, suggestedClassification) {
        try {
            const classification = await this.determineDataClassification(dataItem, suggestedClassification);

            const classifiedData = {
                id: this.generateDataId(),
                tenantId: tenantId,
                clientId: clientId,
                dataType: dataItem.type,
                fieldName: dataItem.fieldName,
                classification: classification.id,
                classificationLevel: classification.level,
                tags: this.generateDataTags(dataItem),
                accessRequirements: this.getAccessRequirements(classification),
                retentionPolicy: this.getRetentionPolicy(dataItem.type),
                encryptionRequired: classification.level >= 2,
                auditRequired: classification.level >= 1,
                createdAt: new Date(),
                classifiedBy: 'system'
            };

            await this.saveClassifiedData(classifiedData);

            console.log(`Data classified: ${dataItem.fieldName} as ${classification.name}`);
            return classifiedData;

        } catch (error) {
            console.error('Error classifying client data:', error);
            throw error;
        }
    }

    async determineDataClassification(dataItem, suggestedClassification) {
        // Auto-classification based on field names and patterns
        const fieldName = dataItem.fieldName.toLowerCase();
        const dataType = dataItem.type;

        // High-sensitivity patterns
        if (this.isHighSensitivityField(fieldName)) {
            return this.dataClassifications.get('restricted');
        }

        // Financial data patterns
        if (this.isFinancialField(fieldName) || dataType === 'financial') {
            return this.dataClassifications.get('confidential');
        }

        // PII patterns
        if (this.isPIIField(fieldName)) {
            return this.dataClassifications.get('confidential');
        }

        // Contact information
        if (this.isContactField(fieldName)) {
            return this.dataClassifications.get('internal');
        }

        // Use suggested classification if provided
        if (suggestedClassification && this.dataClassifications.has(suggestedClassification)) {
            return this.dataClassifications.get(suggestedClassification);
        }

        // Default to internal
        return this.dataClassifications.get('internal');
    }

    isHighSensitivityField(fieldName) {
        const patterns = [
            'ssn', 'social_security', 'tax_id', 'ein',
            'bank_account', 'routing_number', 'account_number',
            'password', 'secret', 'key'
        ];
        return patterns.some(pattern => fieldName.includes(pattern));
    }

    isFinancialField(fieldName) {
        const patterns = [
            'income', 'salary', 'wages', 'revenue', 'profit',
            'tax', 'deduction', 'credit', 'refund',
            'investment', 'capital', 'dividend', 'interest'
        ];
        return patterns.some(pattern => fieldName.includes(pattern));
    }

    isPIIField(fieldName) {
        const patterns = [
            'first_name', 'last_name', 'full_name', 'email',
            'phone', 'address', 'street', 'city', 'zip',
            'date_of_birth', 'birth_date', 'age'
        ];
        return patterns.some(pattern => fieldName.includes(pattern));
    }

    isContactField(fieldName) {
        const patterns = [
            'phone', 'email', 'address', 'contact',
            'emergency_contact', 'next_of_kin'
        ];
        return patterns.some(pattern => fieldName.includes(pattern));
    }

    generateDataTags(dataItem) {
        const tags = [];

        if (dataItem.type) {
            tags.push(`type:${dataItem.type}`);
        }

        if (dataItem.source) {
            tags.push(`source:${dataItem.source}`);
        }

        if (dataItem.category) {
            tags.push(`category:${dataItem.category}`);
        }

        return tags;
    }

    getAccessRequirements(classification) {
        const requirements = {
            minimumRole: 'user',
            additionalPermissions: [],
            approvalRequired: false,
            auditRequired: false,
            encryptionRequired: false
        };

        switch (classification.level) {
            case 4: // Top Secret
                requirements.minimumRole = 'admin';
                requirements.additionalPermissions = ['top_secret_access'];
                requirements.approvalRequired = true;
                requirements.auditRequired = true;
                requirements.encryptionRequired = true;
                break;
            case 3: // Restricted
                requirements.minimumRole = 'manager';
                requirements.additionalPermissions = ['restricted_access'];
                requirements.approvalRequired = true;
                requirements.auditRequired = true;
                requirements.encryptionRequired = true;
                break;
            case 2: // Confidential
                requirements.minimumRole = 'user';
                requirements.additionalPermissions = ['confidential_access'];
                requirements.auditRequired = true;
                requirements.encryptionRequired = true;
                break;
            case 1: // Internal
                requirements.auditRequired = true;
                break;
        }

        return requirements;
    }

    getRetentionPolicy(dataType) {
        const policies = {
            'tax_return': { years: 7, reason: 'IRS requirement' },
            'financial_statement': { years: 7, reason: 'Business requirement' },
            'supporting_document': { years: 7, reason: 'Tax support' },
            'communication': { years: 3, reason: 'Business communication' },
            'calculation': { years: 7, reason: 'Tax calculation support' },
            'default': { years: 5, reason: 'General business record' }
        };

        return policies[dataType] || policies['default'];
    }

    /**
     * Access Control and Validation
     */
    async validateDataAccess(userId, tenantId, clientId, dataItem, operation = 'read') {
        try {
            const accessRequest = {
                userId: userId,
                tenantId: tenantId,
                clientId: clientId,
                dataId: dataItem.id,
                dataClassification: dataItem.classification,
                operation: operation,
                timestamp: new Date()
            };

            // Check basic tenant and client access
            const hasClientAccess = await this.checkClientAccess(userId, tenantId, clientId);
            if (!hasClientAccess) {
                await this.logAccessDenial(accessRequest, 'No client access');
                return { allowed: false, reason: 'User not assigned to client' };
            }

            // Check role-based permissions
            const hasRolePermission = await this.checkRolePermissions(userId, dataItem, operation);
            if (!hasRolePermission) {
                await this.logAccessDenial(accessRequest, 'Insufficient role permissions');
                return { allowed: false, reason: 'Insufficient permissions for data classification' };
            }

            // Check specific data permissions
            const hasDataPermission = await this.checkDataPermissions(userId, dataItem, operation);
            if (!hasDataPermission) {
                await this.logAccessDenial(accessRequest, 'Insufficient data permissions');
                return { allowed: false, reason: 'Insufficient permissions for operation' };
            }

            // Check business hours and location restrictions
            const passesContextualChecks = await this.checkContextualRestrictions(userId, dataItem);
            if (!passesContextualChecks) {
                await this.logAccessDenial(accessRequest, 'Contextual restrictions');
                return { allowed: false, reason: 'Access restricted by time or location policy' };
            }

            // Log successful access
            await this.logDataAccess(accessRequest, 'granted');

            return { allowed: true, conditions: await this.getAccessConditions(dataItem) };

        } catch (error) {
            console.error('Error validating data access:', error);
            await this.logAccessDenial(accessRequest, `Validation error: ${error.message}`);
            return { allowed: false, reason: 'Access validation failed' };
        }
    }

    async checkClientAccess(userId, tenantId, clientId) {
        // Check if user is assigned to the client
        const userAssignments = await this.getUserClientAssignments(userId, tenantId);
        return userAssignments.includes(clientId);
    }

    async checkRolePermissions(userId, dataItem, operation) {
        const userRoles = await this.getUserRoles(userId);
        const requiredLevel = this.dataClassifications.get(dataItem.classification)?.level || 0;

        // Check if user has sufficient role level for data classification
        for (const role of userRoles) {
            const roleLevel = await this.getRoleAccessLevel(role);
            if (roleLevel >= requiredLevel) {
                // Check specific operation permissions
                const hasOperationPermission = await this.checkOperationPermission(role, operation);
                if (hasOperationPermission) {
                    return true;
                }
            }
        }

        return false;
    }

    async checkDataPermissions(userId, dataItem, operation) {
        const permissions = await this.getUserDataPermissions(userId);
        const requiredPermission = `${dataItem.dataType}:${operation}`;

        return permissions.includes(requiredPermission) || permissions.includes('*');
    }

    async checkContextualRestrictions(userId, dataItem) {
        const classification = this.dataClassifications.get(dataItem.classification);

        // For highly classified data, check additional restrictions
        if (classification.level >= 3) {
            // Check business hours
            const isBusinessHours = this.isBusinessHours();
            if (!isBusinessHours) {
                return false;
            }

            // Check IP restrictions
            const isAllowedIP = await this.checkIPRestrictions(userId);
            if (!isAllowedIP) {
                return false;
            }
        }

        return true;
    }

    isBusinessHours() {
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay(); // 0 = Sunday, 6 = Saturday

        // Business hours: Monday-Friday, 8 AM - 6 PM
        return day >= 1 && day <= 5 && hour >= 8 && hour < 18;
    }

    async getAccessConditions(dataItem) {
        const classification = this.dataClassifications.get(dataItem.classification);
        const conditions = [];

        if (classification.level >= 2) {
            conditions.push('audit_required');
        }

        if (classification.level >= 3) {
            conditions.push('session_recording');
            conditions.push('time_limited_access');
        }

        if (dataItem.encryptionRequired) {
            conditions.push('encrypted_transmission');
        }

        return conditions;
    }

    /**
     * Data Masking and Filtering
     */
    async maskSensitiveData(data, userAccessLevel, clientId) {
        try {
            const maskedData = { ...data };

            for (const [field, value] of Object.entries(data)) {
                const classification = await this.getFieldClassification(field, clientId);

                if (classification && classification.level > userAccessLevel) {
                    maskedData[field] = this.maskFieldValue(value, classification.level);
                }
            }

            return maskedData;

        } catch (error) {
            console.error('Error masking sensitive data:', error);
            throw error;
        }
    }

    maskFieldValue(value, classificationLevel) {
        if (!value) return value;

        const stringValue = String(value);

        switch (classificationLevel) {
            case 4: // Top Secret - Full masking
                return '*'.repeat(Math.min(stringValue.length, 10));

            case 3: // Restricted - Partial masking
                if (stringValue.length <= 4) {
                    return '*'.repeat(stringValue.length);
                }
                return stringValue.substring(0, 2) + '*'.repeat(stringValue.length - 4) + stringValue.substring(stringValue.length - 2);

            case 2: // Confidential - Light masking
                if (stringValue.length <= 6) {
                    return stringValue.substring(0, 1) + '*'.repeat(stringValue.length - 1);
                }
                return stringValue.substring(0, 3) + '*'.repeat(stringValue.length - 6) + stringValue.substring(stringValue.length - 3);

            default:
                return value;
        }
    }

    async filterDataByAccess(dataSet, userId, tenantId, clientId) {
        const filteredData = [];

        for (const dataItem of dataSet) {
            const accessResult = await this.validateDataAccess(userId, tenantId, clientId, dataItem, 'read');

            if (accessResult.allowed) {
                const userAccessLevel = await this.getUserAccessLevel(userId);
                const maskedItem = await this.maskSensitiveData(dataItem, userAccessLevel, clientId);
                filteredData.push(maskedItem);
            }
        }

        return filteredData;
    }

    /**
     * Audit and Compliance
     */
    async logDataAccess(accessRequest, result) {
        const auditEntry = {
            id: this.generateAuditId(),
            timestamp: new Date(),
            userId: accessRequest.userId,
            tenantId: accessRequest.tenantId,
            clientId: accessRequest.clientId,
            dataId: accessRequest.dataId,
            operation: accessRequest.operation,
            result: result,
            ipAddress: accessRequest.ipAddress,
            userAgent: accessRequest.userAgent,
            sessionId: accessRequest.sessionId
        };

        await this.saveAuditEntry(auditEntry);

        // Real-time alerting for sensitive data access
        if (accessRequest.dataClassification === 'restricted' || accessRequest.dataClassification === 'top_secret') {
            await this.sendSecurityAlert(auditEntry);
        }
    }

    async logAccessDenial(accessRequest, reason) {
        const auditEntry = {
            id: this.generateAuditId(),
            timestamp: new Date(),
            userId: accessRequest.userId,
            tenantId: accessRequest.tenantId,
            clientId: accessRequest.clientId,
            dataId: accessRequest.dataId,
            operation: accessRequest.operation,
            result: 'denied',
            reason: reason,
            ipAddress: accessRequest.ipAddress,
            userAgent: accessRequest.userAgent
        };

        await this.saveAuditEntry(auditEntry);

        // Alert on repeated access denials
        const recentDenials = await this.getRecentAccessDenials(accessRequest.userId, 60000); // 1 minute
        if (recentDenials.length >= 5) {
            await this.sendSecurityAlert({
                type: 'repeated_access_denials',
                userId: accessRequest.userId,
                count: recentDenials.length
            });
        }
    }

    async generateComplianceReport(tenantId, clientId, timeframe) {
        try {
            const report = {
                tenantId: tenantId,
                clientId: clientId,
                timeframe: timeframe,
                generatedAt: new Date(),
                dataClassificationSummary: await this.getDataClassificationSummary(tenantId, clientId),
                accessSummary: await this.getAccessSummary(tenantId, clientId, timeframe),
                securityEvents: await this.getSecurityEvents(tenantId, clientId, timeframe),
                complianceStatus: await this.checkComplianceStatus(tenantId, clientId),
                recommendations: await this.generateComplianceRecommendations(tenantId, clientId)
            };

            return report;

        } catch (error) {
            console.error('Error generating compliance report:', error);
            throw error;
        }
    }

    /**
     * Data Lifecycle Management
     */
    async scheduleDataRetention(tenantId, clientId) {
        try {
            const clientData = await this.getClientDataItems(tenantId, clientId);
            const retentionSchedule = [];

            for (const dataItem of clientData) {
                const retentionPolicy = dataItem.retentionPolicy;
                const retentionDate = new Date(dataItem.createdAt);
                retentionDate.setFullYear(retentionDate.getFullYear() + retentionPolicy.years);

                if (retentionDate <= new Date()) {
                    retentionSchedule.push({
                        dataId: dataItem.id,
                        action: 'delete',
                        scheduledDate: retentionDate,
                        reason: retentionPolicy.reason
                    });
                }
            }

            await this.saveRetentionSchedule(tenantId, clientId, retentionSchedule);

            console.log(`Retention schedule created for client ${clientId}: ${retentionSchedule.length} items`);
            return retentionSchedule;

        } catch (error) {
            console.error('Error scheduling data retention:', error);
            throw error;
        }
    }

    async executeDataPurge(tenantId, clientId, purgeItems) {
        try {
            const purgeResults = [];

            for (const item of purgeItems) {
                try {
                    // Create backup before deletion
                    await this.createDataBackup(item.dataId);

                    // Secure deletion
                    await this.secureDeleteData(item.dataId);

                    // Log purge action
                    await this.logDataPurge(tenantId, clientId, item);

                    purgeResults.push({
                        dataId: item.dataId,
                        status: 'success',
                        purgedAt: new Date()
                    });

                } catch (error) {
                    purgeResults.push({
                        dataId: item.dataId,
                        status: 'failed',
                        error: error.message
                    });
                }
            }

            console.log(`Data purge completed for client ${clientId}: ${purgeResults.length} items processed`);
            return purgeResults;

        } catch (error) {
            console.error('Error executing data purge:', error);
            throw error;
        }
    }

    /**
     * Utility Methods
     */
    generateDataId() {
        return 'data_' + crypto.randomBytes(16).toString('hex');
    }

    generateAuditId() {
        return 'audit_' + crypto.randomBytes(16).toString('hex');
    }

    /**
     * Placeholder methods for database and external system operations
     */
    async saveClassifiedData(data) {
        console.log(`Saving classified data: ${data.id}`);
    }

    async getUserClientAssignments(userId, tenantId) {
        console.log(`Getting client assignments for user: ${userId}`);
        return [];
    }

    async getUserRoles(userId) {
        console.log(`Getting roles for user: ${userId}`);
        return ['user'];
    }

    async getRoleAccessLevel(role) {
        console.log(`Getting access level for role: ${role}`);
        return 1;
    }

    async checkOperationPermission(role, operation) {
        console.log(`Checking operation permission: ${role} - ${operation}`);
        return true;
    }

    async getUserDataPermissions(userId) {
        console.log(`Getting data permissions for user: ${userId}`);
        return ['*'];
    }

    async checkIPRestrictions(userId) {
        console.log(`Checking IP restrictions for user: ${userId}`);
        return true;
    }

    async getFieldClassification(field, clientId) {
        console.log(`Getting field classification: ${field} for client ${clientId}`);
        return this.dataClassifications.get('internal');
    }

    async getUserAccessLevel(userId) {
        console.log(`Getting access level for user: ${userId}`);
        return 2;
    }

    async saveAuditEntry(entry) {
        console.log(`Saving audit entry: ${entry.id}`);
        this.auditLog.set(entry.id, entry);
    }

    async sendSecurityAlert(alert) {
        console.log('Sending security alert:', alert);
    }

    async getRecentAccessDenials(userId, timeWindow) {
        console.log(`Getting recent access denials for user: ${userId}`);
        return [];
    }
}

module.exports = ClientDataSegregation;