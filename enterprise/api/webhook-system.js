/**
 * Webhook System
 * Handles webhook registrations, deliveries, and retries for enterprise integrations
 */

const crypto = require('crypto');
const axios = require('axios');
const EventEmitter = require('events');

class WebhookSystem extends EventEmitter {
    constructor() {
        super();
        this.webhooks = new Map();
        this.deliveryQueue = [];
        this.isProcessing = false;
        this.maxRetries = 5;
        this.retryDelays = [1000, 5000, 15000, 60000, 300000]; // 1s, 5s, 15s, 1m, 5m
        this.timeout = 30000; // 30 seconds
        this.startDeliveryProcessor();
    }

    /**
     * Webhook Registration
     */
    async registerWebhook(tenantId, webhookData) {
        try {
            const webhook = {
                id: this.generateWebhookId(),
                tenantId: tenantId,
                url: webhookData.url,
                events: webhookData.events || ['*'], // Default to all events
                secret: webhookData.secret || this.generateSecret(),
                active: webhookData.active !== false,
                description: webhookData.description || '',
                headers: webhookData.headers || {},
                timeout: webhookData.timeout || this.timeout,
                retryPolicy: {
                    maxRetries: webhookData.maxRetries || this.maxRetries,
                    retryDelays: webhookData.retryDelays || this.retryDelays
                },
                filters: webhookData.filters || {},
                security: {
                    verifySSL: webhookData.verifySSL !== false,
                    allowedIPs: webhookData.allowedIPs || [],
                    signatureHeader: webhookData.signatureHeader || 'X-Webhook-Signature'
                },
                stats: {
                    totalDeliveries: 0,
                    successfulDeliveries: 0,
                    failedDeliveries: 0,
                    lastDelivery: null,
                    lastSuccess: null,
                    lastFailure: null
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Validate webhook URL
            await this.validateWebhookUrl(webhook.url);

            // Save webhook
            await this.saveWebhook(webhook);

            // Test webhook if requested
            if (webhookData.testOnCreate) {
                await this.testWebhook(webhook.id);
            }

            console.log(`Webhook registered: ${webhook.id} for tenant ${tenantId}`);
            return webhook;

        } catch (error) {
            console.error('Error registering webhook:', error);
            throw error;
        }
    }

    async updateWebhook(webhookId, updates) {
        try {
            const webhook = await this.getWebhook(webhookId);
            if (!webhook) {
                throw new Error('Webhook not found');
            }

            // Validate URL if being updated
            if (updates.url && updates.url !== webhook.url) {
                await this.validateWebhookUrl(updates.url);
            }

            const updatedWebhook = {
                ...webhook,
                ...updates,
                updatedAt: new Date()
            };

            await this.saveWebhook(updatedWebhook);

            console.log(`Webhook updated: ${webhookId}`);
            return updatedWebhook;

        } catch (error) {
            console.error('Error updating webhook:', error);
            throw error;
        }
    }

    async deleteWebhook(webhookId) {
        try {
            const webhook = await this.getWebhook(webhookId);
            if (!webhook) {
                throw new Error('Webhook not found');
            }

            await this.removeWebhook(webhookId);

            console.log(`Webhook deleted: ${webhookId}`);
            return true;

        } catch (error) {
            console.error('Error deleting webhook:', error);
            throw error;
        }
    }

    async validateWebhookUrl(url) {
        try {
            const urlObj = new URL(url);

            // Check protocol
            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                throw new Error('Invalid protocol. Only HTTP and HTTPS are allowed.');
            }

            // Check if URL is reachable
            const response = await axios.head(url, {
                timeout: 5000,
                validateStatus: () => true // Accept any status for validation
            });

            if (response.status >= 500) {
                throw new Error('Webhook URL returned server error');
            }

            return true;

        } catch (error) {
            if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                throw new Error('Webhook URL is not reachable');
            }
            throw error;
        }
    }

    /**
     * Event Triggering
     */
    async triggerWebhooks(tenantId, eventType, eventData, metadata = {}) {
        try {
            // Get webhooks for tenant
            const webhooks = await this.getWebhooksForTenant(tenantId);

            // Filter webhooks by event type and active status
            const applicableWebhooks = webhooks.filter(webhook => {
                return webhook.active && this.isEventMatched(eventType, webhook.events);
            });

            if (applicableWebhooks.length === 0) {
                console.log(`No webhooks found for event ${eventType} in tenant ${tenantId}`);
                return [];
            }

            const deliveries = [];

            for (const webhook of applicableWebhooks) {
                // Apply filters if any
                if (webhook.filters && Object.keys(webhook.filters).length > 0) {
                    if (!this.applyFilters(eventData, webhook.filters)) {
                        continue;
                    }
                }

                // Create delivery
                const delivery = await this.createDelivery(webhook, eventType, eventData, metadata);
                deliveries.push(delivery);

                // Queue for delivery
                this.queueDelivery(delivery);
            }

            console.log(`Triggered ${deliveries.length} webhooks for event ${eventType}`);
            return deliveries;

        } catch (error) {
            console.error('Error triggering webhooks:', error);
            throw error;
        }
    }

    isEventMatched(eventType, subscribedEvents) {
        // Check for wildcard subscription
        if (subscribedEvents.includes('*')) {
            return true;
        }

        // Check for exact match
        if (subscribedEvents.includes(eventType)) {
            return true;
        }

        // Check for pattern match (e.g., 'calculation.*' matches 'calculation.completed')
        return subscribedEvents.some(pattern => {
            if (pattern.endsWith('*')) {
                const prefix = pattern.slice(0, -1);
                return eventType.startsWith(prefix);
            }
            return false;
        });
    }

    applyFilters(eventData, filters) {
        for (const [field, condition] of Object.entries(filters)) {
            const value = this.getNestedValue(eventData, field);

            if (!this.evaluateCondition(value, condition)) {
                return false;
            }
        }
        return true;
    }

    evaluateCondition(value, condition) {
        if (typeof condition === 'string' || typeof condition === 'number') {
            return value === condition;
        }

        if (typeof condition === 'object') {
            for (const [operator, operand] of Object.entries(condition)) {
                switch (operator) {
                    case '$eq':
                        return value === operand;
                    case '$ne':
                        return value !== operand;
                    case '$gt':
                        return value > operand;
                    case '$gte':
                        return value >= operand;
                    case '$lt':
                        return value < operand;
                    case '$lte':
                        return value <= operand;
                    case '$in':
                        return Array.isArray(operand) && operand.includes(value);
                    case '$nin':
                        return Array.isArray(operand) && !operand.includes(value);
                    case '$regex':
                        return new RegExp(operand).test(value);
                    case '$exists':
                        return operand ? value !== undefined : value === undefined;
                    default:
                        return false;
                }
            }
        }

        return false;
    }

    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    /**
     * Delivery Management
     */
    async createDelivery(webhook, eventType, eventData, metadata) {
        const delivery = {
            id: this.generateDeliveryId(),
            webhookId: webhook.id,
            tenantId: webhook.tenantId,
            eventType: eventType,
            payload: {
                id: delivery?.id || this.generateEventId(),
                event: eventType,
                data: eventData,
                timestamp: new Date().toISOString(),
                webhook: {
                    id: webhook.id,
                    tenant_id: webhook.tenantId
                },
                metadata: metadata
            },
            url: webhook.url,
            headers: this.buildHeaders(webhook),
            timeout: webhook.timeout,
            retryPolicy: webhook.retryPolicy,
            status: 'pending',
            attempts: 0,
            maxAttempts: webhook.retryPolicy.maxRetries + 1, // Include initial attempt
            createdAt: new Date(),
            nextAttemptAt: new Date(),
            lastAttemptAt: null,
            response: null,
            error: null
        };

        // Generate signature
        delivery.signature = this.generateSignature(webhook.secret, delivery.payload);

        await this.saveDelivery(delivery);
        return delivery;
    }

    buildHeaders(webhook) {
        const headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'GlobalTaxCalc-Webhook/1.0',
            ...webhook.headers
        };

        // Add signature header
        if (webhook.secret) {
            headers[webhook.security.signatureHeader] = `sha256={signature}`;
        }

        return headers;
    }

    generateSignature(secret, payload) {
        if (!secret) return null;

        const payloadString = JSON.stringify(payload);
        return crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
    }

    queueDelivery(delivery) {
        this.deliveryQueue.push(delivery);
        this.processDeliveryQueue();
    }

    async processDeliveryQueue() {
        if (this.isProcessing || this.deliveryQueue.length === 0) {
            return;
        }

        this.isProcessing = true;

        while (this.deliveryQueue.length > 0) {
            const delivery = this.deliveryQueue.shift();

            // Check if it's time to attempt delivery
            if (delivery.nextAttemptAt > new Date()) {
                // Re-queue for later
                this.deliveryQueue.push(delivery);
                continue;
            }

            try {
                await this.attemptDelivery(delivery);
            } catch (error) {
                console.error(`Delivery attempt failed for ${delivery.id}:`, error);
            }

            // Add small delay between deliveries
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        this.isProcessing = false;
    }

    async attemptDelivery(delivery) {
        try {
            delivery.attempts++;
            delivery.lastAttemptAt = new Date();

            console.log(`Attempting webhook delivery ${delivery.id} (attempt ${delivery.attempts})`);

            // Prepare headers with signature
            const headers = { ...delivery.headers };
            if (delivery.signature) {
                const signatureHeader = headers['X-Webhook-Signature'] || 'X-Webhook-Signature';
                headers[signatureHeader] = `sha256=${delivery.signature}`;
            }

            // Make HTTP request
            const response = await axios.post(delivery.url, delivery.payload, {
                headers: headers,
                timeout: delivery.timeout,
                validateStatus: () => true // Don't throw on HTTP error status
            });

            // Update delivery with response
            delivery.response = {
                status: response.status,
                headers: response.headers,
                body: response.data,
                duration: Date.now() - delivery.lastAttemptAt.getTime()
            };

            if (response.status >= 200 && response.status < 300) {
                // Success
                delivery.status = 'delivered';
                await this.updateWebhookStats(delivery.webhookId, 'success');
                this.emit('deliverySuccess', delivery);

                console.log(`Webhook delivered successfully: ${delivery.id}`);

            } else {
                // HTTP error
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

        } catch (error) {
            delivery.error = {
                message: error.message,
                code: error.code,
                timestamp: new Date()
            };

            if (delivery.attempts >= delivery.maxAttempts) {
                // Max attempts reached
                delivery.status = 'failed';
                await this.updateWebhookStats(delivery.webhookId, 'failure');
                this.emit('deliveryFailed', delivery);

                console.log(`Webhook delivery failed permanently: ${delivery.id}`);

            } else {
                // Schedule retry
                const delay = delivery.retryPolicy.retryDelays[delivery.attempts - 1] || 300000; // 5 min default
                delivery.nextAttemptAt = new Date(Date.now() + delay);
                delivery.status = 'retrying';

                // Re-queue for retry
                this.queueDelivery(delivery);

                console.log(`Webhook delivery will retry in ${delay}ms: ${delivery.id}`);
            }

            this.emit('deliveryError', delivery, error);
        }

        await this.saveDelivery(delivery);
    }

    startDeliveryProcessor() {
        // Process delivery queue every 5 seconds
        setInterval(() => {
            this.processDeliveryQueue();
        }, 5000);
    }

    /**
     * Webhook Testing
     */
    async testWebhook(webhookId, eventType = 'webhook.test') {
        try {
            const webhook = await this.getWebhook(webhookId);
            if (!webhook) {
                throw new Error('Webhook not found');
            }

            const testData = {
                message: 'This is a test webhook delivery',
                timestamp: new Date().toISOString(),
                webhook_id: webhookId
            };

            const delivery = await this.createDelivery(webhook, eventType, testData, { test: true });
            await this.attemptDelivery(delivery);

            return {
                success: delivery.status === 'delivered',
                delivery: delivery
            };

        } catch (error) {
            console.error('Error testing webhook:', error);
            throw error;
        }
    }

    /**
     * Webhook Analytics and Monitoring
     */
    async getWebhookStats(webhookId, timeframe = '24h') {
        try {
            const webhook = await this.getWebhook(webhookId);
            if (!webhook) {
                throw new Error('Webhook not found');
            }

            const stats = await this.calculateWebhookStats(webhookId, timeframe);

            return {
                webhookId: webhookId,
                timeframe: timeframe,
                stats: stats,
                overall: webhook.stats
            };

        } catch (error) {
            console.error('Error getting webhook stats:', error);
            throw error;
        }
    }

    async getDeliveryHistory(webhookId, options = {}) {
        try {
            const {
                limit = 50,
                offset = 0,
                status = null,
                eventType = null,
                startDate = null,
                endDate = null
            } = options;

            const deliveries = await this.getDeliveries(webhookId, {
                limit, offset, status, eventType, startDate, endDate
            });

            return deliveries;

        } catch (error) {
            console.error('Error getting delivery history:', error);
            throw error;
        }
    }

    /**
     * Utility Methods
     */
    generateWebhookId() {
        return 'wh_' + crypto.randomBytes(16).toString('hex');
    }

    generateDeliveryId() {
        return 'del_' + crypto.randomBytes(16).toString('hex');
    }

    generateEventId() {
        return 'evt_' + crypto.randomBytes(16).toString('hex');
    }

    generateSecret() {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Placeholder methods for database operations
     */
    async saveWebhook(webhook) {
        console.log(`Saving webhook: ${webhook.id}`);
        this.webhooks.set(webhook.id, webhook);
    }

    async getWebhook(webhookId) {
        console.log(`Getting webhook: ${webhookId}`);
        return this.webhooks.get(webhookId);
    }

    async removeWebhook(webhookId) {
        console.log(`Removing webhook: ${webhookId}`);
        this.webhooks.delete(webhookId);
    }

    async getWebhooksForTenant(tenantId) {
        console.log(`Getting webhooks for tenant: ${tenantId}`);
        return Array.from(this.webhooks.values()).filter(w => w.tenantId === tenantId);
    }

    async saveDelivery(delivery) {
        console.log(`Saving delivery: ${delivery.id}`);
    }

    async updateWebhookStats(webhookId, type) {
        console.log(`Updating webhook stats: ${webhookId} - ${type}`);
    }

    async calculateWebhookStats(webhookId, timeframe) {
        console.log(`Calculating stats for webhook: ${webhookId} (${timeframe})`);
        return {
            totalDeliveries: 0,
            successfulDeliveries: 0,
            failedDeliveries: 0,
            averageResponseTime: 0,
            successRate: 0
        };
    }

    async getDeliveries(webhookId, options) {
        console.log(`Getting deliveries for webhook: ${webhookId}`);
        return [];
    }
}

module.exports = WebhookSystem;