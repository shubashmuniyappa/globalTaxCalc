class ReportSubscriptionManager {
    constructor() {
        this.subscriptions = new Map();
        this.userSubscriptions = new Map();
        this.subscriptionTypes = new Map();
        this.notifications = new Map();
        this.initializeSubscriptionTypes();
    }

    initializeSubscriptionTypes() {
        // Define available subscription types
        this.subscriptionTypes.set('daily-summary', {
            name: 'Daily Tax Summary',
            description: 'Daily summary of tax calculations and activity',
            category: 'summary',
            defaultSchedule: 'daily',
            defaultTime: '08:00',
            availableFormats: ['email', 'pdf'],
            maxRecipients: 5,
            features: ['basic-charts', 'summary-stats', 'recent-activity']
        });

        this.subscriptionTypes.set('weekly-report', {
            name: 'Weekly Tax Report',
            description: 'Comprehensive weekly tax analysis and trends',
            category: 'analytics',
            defaultSchedule: 'weekly',
            defaultTime: '09:00',
            availableFormats: ['email', 'pdf', 'excel'],
            maxRecipients: 10,
            features: ['advanced-charts', 'trend-analysis', 'comparisons', 'insights']
        });

        this.subscriptionTypes.set('monthly-analysis', {
            name: 'Monthly Tax Analysis',
            description: 'Detailed monthly tax analysis with recommendations',
            category: 'insights',
            defaultSchedule: 'monthly',
            defaultTime: '10:00',
            availableFormats: ['email', 'pdf', 'excel', 'powerpoint'],
            maxRecipients: 15,
            features: ['comprehensive-analysis', 'recommendations', 'forecasting', 'benchmarking']
        });

        this.subscriptionTypes.set('quarterly-business', {
            name: 'Quarterly Business Report',
            description: 'Quarterly business tax overview for enterprises',
            category: 'business',
            defaultSchedule: 'quarterly',
            defaultTime: '11:00',
            availableFormats: ['email', 'pdf', 'excel', 'powerpoint', 'dashboard'],
            maxRecipients: 25,
            features: ['executive-summary', 'detailed-breakdowns', 'compliance-check', 'strategy-recommendations'],
            requiresPremium: true
        });

        this.subscriptionTypes.set('tax-deadline-alerts', {
            name: 'Tax Deadline Alerts',
            description: 'Reminders and alerts for important tax deadlines',
            category: 'alerts',
            defaultSchedule: 'custom',
            availableFormats: ['email', 'sms', 'push'],
            maxRecipients: 3,
            features: ['deadline-tracking', 'reminder-notifications', 'preparation-checklists']
        });

        this.subscriptionTypes.set('compliance-updates', {
            name: 'Tax Compliance Updates',
            description: 'Updates on tax law changes and compliance requirements',
            category: 'compliance',
            defaultSchedule: 'weekly',
            defaultTime: '14:00',
            availableFormats: ['email', 'pdf'],
            maxRecipients: 10,
            features: ['law-changes', 'compliance-alerts', 'impact-analysis']
        });
    }

    createSubscription(subscriptionData) {
        try {
            const validatedData = this.validateSubscriptionData(subscriptionData);
            const subscriptionId = this.generateSubscriptionId();

            const subscription = {
                id: subscriptionId,
                userId: validatedData.userId,
                subscriptionType: validatedData.subscriptionType,
                name: validatedData.name || this.subscriptionTypes.get(validatedData.subscriptionType).name,
                description: validatedData.description,
                schedule: validatedData.schedule,
                recipients: validatedData.recipients || [],
                formats: validatedData.formats || ['email'],
                filters: validatedData.filters || {},
                customization: validatedData.customization || {},
                active: validatedData.active !== false,
                createdAt: new Date().toISOString(),
                createdBy: validatedData.createdBy,
                lastDelivery: null,
                nextDelivery: this.calculateNextDelivery(validatedData.schedule),
                deliveryCount: 0,
                settings: {
                    timezone: validatedData.timezone || 'UTC',
                    includeCharts: validatedData.includeCharts !== false,
                    includeData: validatedData.includeData !== false,
                    language: validatedData.language || 'en'
                }
            };

            this.subscriptions.set(subscriptionId, subscription);
            this.addUserSubscription(validatedData.userId, subscriptionId);

            return {
                success: true,
                subscriptionId,
                subscription
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    validateSubscriptionData(data) {
        if (!data.userId) {
            throw new Error('User ID is required');
        }

        if (!data.subscriptionType || !this.subscriptionTypes.has(data.subscriptionType)) {
            throw new Error('Valid subscription type is required');
        }

        const subscriptionTypeInfo = this.subscriptionTypes.get(data.subscriptionType);

        // Check premium requirements
        if (subscriptionTypeInfo.requiresPremium && !data.isPremiumUser) {
            throw new Error('This subscription type requires a premium account');
        }

        // Validate schedule
        if (!data.schedule || typeof data.schedule !== 'object') {
            throw new Error('Schedule configuration is required');
        }

        // Validate recipients
        if (data.recipients && data.recipients.length > subscriptionTypeInfo.maxRecipients) {
            throw new Error(`Maximum ${subscriptionTypeInfo.maxRecipients} recipients allowed`);
        }

        // Validate formats
        if (data.formats) {
            for (const format of data.formats) {
                if (!subscriptionTypeInfo.availableFormats.includes(format)) {
                    throw new Error(`Format '${format}' not available for this subscription type`);
                }
            }
        }

        return data;
    }

    addUserSubscription(userId, subscriptionId) {
        if (!this.userSubscriptions.has(userId)) {
            this.userSubscriptions.set(userId, new Set());
        }
        this.userSubscriptions.get(userId).add(subscriptionId);
    }

    removeUserSubscription(userId, subscriptionId) {
        if (this.userSubscriptions.has(userId)) {
            this.userSubscriptions.get(userId).delete(subscriptionId);
        }
    }

    getSubscription(subscriptionId) {
        return this.subscriptions.get(subscriptionId);
    }

    getUserSubscriptions(userId) {
        const userSubIds = this.userSubscriptions.get(userId);
        if (!userSubIds) return [];

        return Array.from(userSubIds).map(subId => this.subscriptions.get(subId)).filter(Boolean);
    }

    getAllSubscriptions() {
        return Array.from(this.subscriptions.values());
    }

    getActiveSubscriptions() {
        return this.getAllSubscriptions().filter(sub => sub.active);
    }

    getSubscriptionsByType(subscriptionType) {
        return this.getAllSubscriptions().filter(sub => sub.subscriptionType === subscriptionType);
    }

    updateSubscription(subscriptionId, updates) {
        const subscription = this.subscriptions.get(subscriptionId);
        if (!subscription) {
            throw new Error('Subscription not found');
        }

        // Validate updates
        if (updates.subscriptionType && updates.subscriptionType !== subscription.subscriptionType) {
            throw new Error('Cannot change subscription type. Create a new subscription instead.');
        }

        if (updates.recipients) {
            const subscriptionTypeInfo = this.subscriptionTypes.get(subscription.subscriptionType);
            if (updates.recipients.length > subscriptionTypeInfo.maxRecipients) {
                throw new Error(`Maximum ${subscriptionTypeInfo.maxRecipients} recipients allowed`);
            }
        }

        // Apply updates
        Object.assign(subscription, updates, {
            updatedAt: new Date().toISOString()
        });

        // Recalculate next delivery if schedule changed
        if (updates.schedule) {
            subscription.nextDelivery = this.calculateNextDelivery(subscription.schedule);
        }

        return subscription;
    }

    deleteSubscription(subscriptionId) {
        const subscription = this.subscriptions.get(subscriptionId);
        if (!subscription) {
            throw new Error('Subscription not found');
        }

        // Remove from user subscriptions
        this.removeUserSubscription(subscription.userId, subscriptionId);

        // Delete subscription
        this.subscriptions.delete(subscriptionId);

        return true;
    }

    activateSubscription(subscriptionId) {
        const subscription = this.subscriptions.get(subscriptionId);
        if (!subscription) {
            throw new Error('Subscription not found');
        }

        subscription.active = true;
        subscription.nextDelivery = this.calculateNextDelivery(subscription.schedule);

        return subscription;
    }

    deactivateSubscription(subscriptionId) {
        const subscription = this.subscriptions.get(subscriptionId);
        if (!subscription) {
            throw new Error('Subscription not found');
        }

        subscription.active = false;
        subscription.nextDelivery = null;

        return subscription;
    }

    calculateNextDelivery(schedule) {
        const now = new Date();

        switch (schedule.type) {
            case 'daily':
                const dailyNext = new Date(now);
                const [dHour, dMinute] = (schedule.time || '09:00').split(':').map(Number);
                dailyNext.setDate(dailyNext.getDate() + 1);
                dailyNext.setHours(dHour, dMinute, 0, 0);
                return dailyNext.toISOString();

            case 'weekly':
                const weeklyNext = new Date(now);
                const [wHour, wMinute] = (schedule.time || '09:00').split(':').map(Number);
                const dayOfWeek = schedule.dayOfWeek || 1; // Monday
                const daysUntilNext = (7 - weeklyNext.getDay() + dayOfWeek) % 7 || 7;
                weeklyNext.setDate(weeklyNext.getDate() + daysUntilNext);
                weeklyNext.setHours(wHour, wMinute, 0, 0);
                return weeklyNext.toISOString();

            case 'monthly':
                const monthlyNext = new Date(now);
                const [mHour, mMinute] = (schedule.time || '09:00').split(':').map(Number);
                monthlyNext.setMonth(monthlyNext.getMonth() + 1);
                monthlyNext.setDate(schedule.dayOfMonth || 1);
                monthlyNext.setHours(mHour, mMinute, 0, 0);
                return monthlyNext.toISOString();

            case 'quarterly':
                const quarterlyNext = new Date(now);
                const [qHour, qMinute] = (schedule.time || '09:00').split(':').map(Number);
                quarterlyNext.setMonth(quarterlyNext.getMonth() + 3);
                quarterlyNext.setDate(schedule.dayOfMonth || 1);
                quarterlyNext.setHours(qHour, qMinute, 0, 0);
                return quarterlyNext.toISOString();

            case 'custom':
                // For custom schedules, would use a cron library
                const customNext = new Date(now);
                customNext.setDate(customNext.getDate() + 1);
                return customNext.toISOString();

            default:
                return null;
        }
    }

    getSubscriptionsDueForDelivery() {
        const now = new Date();
        return this.getActiveSubscriptions().filter(subscription => {
            if (!subscription.nextDelivery) return false;
            return new Date(subscription.nextDelivery) <= now;
        });
    }

    markDelivered(subscriptionId, deliveryResult) {
        const subscription = this.subscriptions.get(subscriptionId);
        if (!subscription) return false;

        subscription.lastDelivery = new Date().toISOString();
        subscription.deliveryCount++;
        subscription.nextDelivery = this.calculateNextDelivery(subscription.schedule);

        // Store delivery result
        if (!subscription.deliveryHistory) {
            subscription.deliveryHistory = [];
        }

        subscription.deliveryHistory.push({
            timestamp: subscription.lastDelivery,
            success: deliveryResult.success,
            recipients: deliveryResult.recipients?.length || 0,
            formats: deliveryResult.formats || [],
            error: deliveryResult.error
        });

        // Keep only last 50 delivery records
        if (subscription.deliveryHistory.length > 50) {
            subscription.deliveryHistory = subscription.deliveryHistory.slice(-50);
        }

        return true;
    }

    subscribeUser(userId, subscriptionTypeId, customization = {}) {
        const subscriptionType = this.subscriptionTypes.get(subscriptionTypeId);
        if (!subscriptionType) {
            throw new Error('Invalid subscription type');
        }

        const subscriptionData = {
            userId,
            subscriptionType: subscriptionTypeId,
            schedule: {
                type: subscriptionType.defaultSchedule,
                time: subscriptionType.defaultTime
            },
            formats: customization.formats || [subscriptionType.availableFormats[0]],
            recipients: customization.recipients || [],
            ...customization
        };

        return this.createSubscription(subscriptionData);
    }

    unsubscribeUser(userId, subscriptionId) {
        const subscription = this.getSubscription(subscriptionId);
        if (!subscription) {
            throw new Error('Subscription not found');
        }

        if (subscription.userId !== userId) {
            throw new Error('User not authorized to unsubscribe from this subscription');
        }

        return this.deleteSubscription(subscriptionId);
    }

    getSubscriptionTypes() {
        return Array.from(this.subscriptionTypes.entries()).map(([id, type]) => ({
            id,
            ...type
        }));
    }

    getSubscriptionTypesByCategory(category) {
        return this.getSubscriptionTypes().filter(type => type.category === category);
    }

    getUserSubscriptionPreferences(userId) {
        const userSubs = this.getUserSubscriptions(userId);

        return {
            userId,
            totalSubscriptions: userSubs.length,
            activeSubscriptions: userSubs.filter(s => s.active).length,
            subscriptionsByType: this.groupSubscriptionsByType(userSubs),
            deliveryStats: this.calculateUserDeliveryStats(userSubs),
            preferences: this.getUserPreferences(userId)
        };
    }

    groupSubscriptionsByType(subscriptions) {
        const grouped = {};
        for (const sub of subscriptions) {
            if (!grouped[sub.subscriptionType]) {
                grouped[sub.subscriptionType] = [];
            }
            grouped[sub.subscriptionType].push(sub);
        }
        return grouped;
    }

    calculateUserDeliveryStats(subscriptions) {
        const stats = {
            totalDeliveries: 0,
            successfulDeliveries: 0,
            failedDeliveries: 0,
            averageDeliveryTime: 0
        };

        for (const sub of subscriptions) {
            stats.totalDeliveries += sub.deliveryCount;

            if (sub.deliveryHistory) {
                for (const delivery of sub.deliveryHistory) {
                    if (delivery.success) {
                        stats.successfulDeliveries++;
                    } else {
                        stats.failedDeliveries++;
                    }
                }
            }
        }

        return stats;
    }

    getUserPreferences(userId) {
        // This would typically be stored separately
        return {
            timezone: 'UTC',
            preferredFormat: 'email',
            language: 'en',
            notifications: true
        };
    }

    createNotification(userId, type, message, data = {}) {
        const notificationId = this.generateNotificationId();
        const notification = {
            id: notificationId,
            userId,
            type,
            message,
            data,
            read: false,
            createdAt: new Date().toISOString()
        };

        if (!this.notifications.has(userId)) {
            this.notifications.set(userId, []);
        }

        this.notifications.get(userId).push(notification);
        return notification;
    }

    getUserNotifications(userId, unreadOnly = false) {
        const userNotifications = this.notifications.get(userId) || [];

        if (unreadOnly) {
            return userNotifications.filter(n => !n.read);
        }

        return userNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    markNotificationRead(userId, notificationId) {
        const userNotifications = this.notifications.get(userId) || [];
        const notification = userNotifications.find(n => n.id === notificationId);

        if (notification) {
            notification.read = true;
            notification.readAt = new Date().toISOString();
        }

        return notification;
    }

    generateSubscriptionId() {
        return 'sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    generateNotificationId() {
        return 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    getSubscriptionAnalytics() {
        const subscriptions = this.getAllSubscriptions();
        const activeSubscriptions = this.getActiveSubscriptions();

        const analytics = {
            totalSubscriptions: subscriptions.length,
            activeSubscriptions: activeSubscriptions.length,
            subscriptionsByType: {},
            subscriptionsByCategory: {},
            avgDeliveriesPerSubscription: 0,
            totalDeliveries: 0,
            successRate: 0
        };

        let totalDeliveries = 0;
        let successfulDeliveries = 0;
        let totalDeliveryCount = 0;

        for (const sub of subscriptions) {
            // Group by type
            if (!analytics.subscriptionsByType[sub.subscriptionType]) {
                analytics.subscriptionsByType[sub.subscriptionType] = 0;
            }
            analytics.subscriptionsByType[sub.subscriptionType]++;

            // Group by category
            const typeInfo = this.subscriptionTypes.get(sub.subscriptionType);
            if (typeInfo) {
                if (!analytics.subscriptionsByCategory[typeInfo.category]) {
                    analytics.subscriptionsByCategory[typeInfo.category] = 0;
                }
                analytics.subscriptionsByCategory[typeInfo.category]++;
            }

            // Calculate delivery stats
            totalDeliveryCount += sub.deliveryCount;

            if (sub.deliveryHistory) {
                for (const delivery of sub.deliveryHistory) {
                    totalDeliveries++;
                    if (delivery.success) {
                        successfulDeliveries++;
                    }
                }
            }
        }

        analytics.avgDeliveriesPerSubscription = subscriptions.length > 0 ?
            Math.round(totalDeliveryCount / subscriptions.length * 100) / 100 : 0;
        analytics.totalDeliveries = totalDeliveries;
        analytics.successRate = totalDeliveries > 0 ?
            Math.round(successfulDeliveries / totalDeliveries * 100) : 0;

        return analytics;
    }

    exportSubscriptions(userId = null) {
        const subscriptions = userId ?
            this.getUserSubscriptions(userId) :
            this.getAllSubscriptions();

        return {
            subscriptions: subscriptions.map(sub => ({
                ...sub,
                // Remove sensitive data
                deliveryHistory: undefined
            })),
            exportedAt: new Date().toISOString(),
            exportedBy: userId,
            version: '1.0'
        };
    }

    importSubscriptions(importData, userId) {
        if (!importData.subscriptions || !Array.isArray(importData.subscriptions)) {
            throw new Error('Invalid import data format');
        }

        const imported = [];
        const errors = [];

        for (const subData of importData.subscriptions) {
            try {
                // Ensure user ownership
                subData.userId = userId;

                const result = this.createSubscription(subData);
                if (result.success) {
                    imported.push(result.subscriptionId);
                } else {
                    errors.push({ subscription: subData.name, error: result.error });
                }
            } catch (error) {
                errors.push({ subscription: subData.name, error: error.message });
            }
        }

        return {
            imported: imported.length,
            errors
        };
    }

    cleanup(daysToKeep = 90) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        let cleanedSubscriptions = 0;
        let cleanedNotifications = 0;

        // Clean up old inactive subscriptions
        for (const [subId, subscription] of this.subscriptions) {
            if (!subscription.active && new Date(subscription.createdAt) < cutoffDate) {
                this.deleteSubscription(subId);
                cleanedSubscriptions++;
            }
        }

        // Clean up old notifications
        for (const [userId, userNotifications] of this.notifications) {
            const filtered = userNotifications.filter(n => new Date(n.createdAt) >= cutoffDate);
            cleanedNotifications += userNotifications.length - filtered.length;
            this.notifications.set(userId, filtered);
        }

        return {
            cleanedSubscriptions,
            cleanedNotifications
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReportSubscriptionManager;
}