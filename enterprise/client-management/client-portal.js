/**
 * Client Portal System
 * Provides secure client access to their tax data and calculations
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

class ClientPortal {
    constructor() {
        this.portals = new Map();
        this.clientSessions = new Map();
        this.accessTokens = new Map();
        this.invitations = new Map();
    }

    /**
     * Portal Configuration
     */
    async createClientPortal(tenantId, clientId, portalConfig) {
        try {
            const portal = {
                id: this.generatePortalId(),
                tenantId: tenantId,
                clientId: clientId,
                subdomain: portalConfig.subdomain || `client-${clientId}`,
                customDomain: portalConfig.customDomain || null,
                enabled: portalConfig.enabled !== false,
                settings: {
                    allowSelfRegistration: portalConfig.allowSelfRegistration || false,
                    requireApproval: portalConfig.requireApproval !== false,
                    sessionTimeout: portalConfig.sessionTimeout || 8 * 60 * 60 * 1000, // 8 hours
                    allowedFeatures: portalConfig.allowedFeatures || [
                        'view_calculations',
                        'download_reports',
                        'upload_documents',
                        'messaging'
                    ],
                    branding: {
                        logoUrl: portalConfig.logoUrl,
                        primaryColor: portalConfig.primaryColor || '#1976d2',
                        secondaryColor: portalConfig.secondaryColor || '#424242',
                        companyName: portalConfig.companyName || 'Tax Portal'
                    },
                    notifications: {
                        email: portalConfig.emailNotifications !== false,
                        sms: portalConfig.smsNotifications || false,
                        inApp: portalConfig.inAppNotifications !== false
                    },
                    security: {
                        mfaRequired: portalConfig.mfaRequired || false,
                        allowedIPs: portalConfig.allowedIPs || [],
                        passwordPolicy: {
                            minLength: 8,
                            requireUppercase: true,
                            requireLowercase: true,
                            requireNumbers: true,
                            requireSpecialChars: true
                        }
                    }
                },
                access: {
                    users: [], // Client users who can access this portal
                    permissions: portalConfig.permissions || [
                        'calculations:read',
                        'reports:read',
                        'documents:read',
                        'documents:upload',
                        'profile:read',
                        'profile:update'
                    ]
                },
                analytics: {
                    totalLogins: 0,
                    lastAccess: null,
                    pageViews: 0,
                    documentsDownloaded: 0,
                    calculationsViewed: 0
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };

            await this.savePortal(portal);

            console.log(`Client portal created: ${portal.id} for client ${clientId}`);
            return portal;

        } catch (error) {
            console.error('Error creating client portal:', error);
            throw error;
        }
    }

    async updatePortalSettings(portalId, updates) {
        try {
            const portal = await this.getPortal(portalId);
            if (!portal) {
                throw new Error('Portal not found');
            }

            const updatedPortal = {
                ...portal,
                settings: {
                    ...portal.settings,
                    ...updates.settings
                },
                access: {
                    ...portal.access,
                    ...updates.access
                },
                updatedAt: new Date()
            };

            await this.savePortal(updatedPortal);

            console.log(`Portal settings updated: ${portalId}`);
            return updatedPortal;

        } catch (error) {
            console.error('Error updating portal settings:', error);
            throw error;
        }
    }

    /**
     * Client User Management
     */
    async inviteClientUser(portalId, invitationData) {
        try {
            const portal = await this.getPortal(portalId);
            if (!portal) {
                throw new Error('Portal not found');
            }

            const invitation = {
                id: this.generateInvitationId(),
                portalId: portalId,
                tenantId: portal.tenantId,
                clientId: portal.clientId,
                email: invitationData.email,
                firstName: invitationData.firstName,
                lastName: invitationData.lastName,
                role: invitationData.role || 'client_user',
                permissions: invitationData.permissions || portal.access.permissions,
                invitedBy: invitationData.invitedBy,
                token: this.generateInvitationToken(),
                status: 'pending',
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                createdAt: new Date()
            };

            await this.saveInvitation(invitation);

            // Send invitation email
            await this.sendInvitationEmail(invitation, portal);

            console.log(`Client user invited: ${invitation.email} to portal ${portalId}`);
            return invitation;

        } catch (error) {
            console.error('Error inviting client user:', error);
            throw error;
        }
    }

    async acceptInvitation(token, userData) {
        try {
            const invitation = await this.getInvitationByToken(token);
            if (!invitation) {
                throw new Error('Invalid invitation token');
            }

            if (invitation.status !== 'pending') {
                throw new Error('Invitation already processed');
            }

            if (invitation.expiresAt < new Date()) {
                throw new Error('Invitation expired');
            }

            // Create client user
            const clientUser = {
                id: this.generateClientUserId(),
                portalId: invitation.portalId,
                tenantId: invitation.tenantId,
                clientId: invitation.clientId,
                email: invitation.email,
                firstName: invitation.firstName,
                lastName: invitation.lastName,
                role: invitation.role,
                permissions: invitation.permissions,
                passwordHash: await this.hashPassword(userData.password),
                status: 'active',
                profile: {
                    phone: userData.phone || '',
                    preferences: {
                        language: userData.language || 'en',
                        timezone: userData.timezone || 'UTC',
                        emailNotifications: true,
                        smsNotifications: false
                    }
                },
                security: {
                    mfaEnabled: false,
                    lastLogin: null,
                    loginCount: 0,
                    failedLoginAttempts: 0,
                    passwordResetRequired: false
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };

            await this.saveClientUser(clientUser);

            // Update invitation status
            invitation.status = 'accepted';
            invitation.acceptedAt = new Date();
            await this.saveInvitation(invitation);

            // Add user to portal
            const portal = await this.getPortal(invitation.portalId);
            portal.access.users.push(clientUser.id);
            await this.savePortal(portal);

            console.log(`Invitation accepted: ${invitation.email}`);
            return clientUser;

        } catch (error) {
            console.error('Error accepting invitation:', error);
            throw error;
        }
    }

    /**
     * Authentication and Session Management
     */
    async authenticateClient(email, password, portalId) {
        try {
            const clientUser = await this.getClientUserByEmail(email, portalId);
            if (!clientUser) {
                throw new Error('Invalid credentials');
            }

            if (clientUser.status !== 'active') {
                throw new Error('Account is not active');
            }

            // Verify password
            const isValidPassword = await this.verifyPassword(password, clientUser.passwordHash);
            if (!isValidPassword) {
                // Track failed login attempt
                await this.trackFailedLogin(clientUser.id);
                throw new Error('Invalid credentials');
            }

            // Check for account lockout
            if (clientUser.security.failedLoginAttempts >= 5) {
                throw new Error('Account locked due to too many failed login attempts');
            }

            // Get portal
            const portal = await this.getPortal(portalId);
            if (!portal || !portal.enabled) {
                throw new Error('Portal not available');
            }

            // Check IP restrictions
            if (portal.settings.security.allowedIPs.length > 0) {
                // IP check would be implemented here
            }

            // Create session
            const session = await this.createClientSession(clientUser, portal);

            // Update login stats
            await this.updateLoginStats(clientUser.id);

            console.log(`Client authenticated: ${clientUser.email}`);
            return {
                user: clientUser,
                session: session,
                portal: portal
            };

        } catch (error) {
            console.error('Client authentication error:', error);
            throw error;
        }
    }

    async createClientSession(clientUser, portal) {
        const session = {
            id: this.generateSessionId(),
            userId: clientUser.id,
            portalId: portal.id,
            tenantId: portal.tenantId,
            clientId: portal.clientId,
            token: jwt.sign(
                {
                    userId: clientUser.id,
                    portalId: portal.id,
                    type: 'client_session'
                },
                process.env.JWT_SECRET,
                { expiresIn: '8h' }
            ),
            expiresAt: new Date(Date.now() + portal.settings.sessionTimeout),
            ipAddress: null, // Would be set from request
            userAgent: null, // Would be set from request
            createdAt: new Date(),
            lastActivity: new Date()
        };

        await this.saveClientSession(session);

        // Clean up expired sessions
        await this.cleanupExpiredSessions(clientUser.id);

        return session;
    }

    async validateClientSession(token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded.type !== 'client_session') {
                throw new Error('Invalid session type');
            }

            const session = await this.getClientSession(decoded.userId, decoded.portalId);
            if (!session || session.expiresAt < new Date()) {
                throw new Error('Session expired');
            }

            // Update last activity
            session.lastActivity = new Date();
            await this.saveClientSession(session);

            return session;

        } catch (error) {
            throw new Error('Invalid session');
        }
    }

    /**
     * Client Data Access
     */
    async getClientCalculations(clientId, portalId, filters = {}) {
        try {
            // Verify portal access
            const portal = await this.getPortal(portalId);
            if (!portal || portal.clientId !== clientId) {
                throw new Error('Access denied');
            }

            const calculations = await this.findClientCalculations(clientId, filters);

            // Filter sensitive data based on portal permissions
            const filteredCalculations = calculations.map(calc => this.filterCalculationData(calc, portal));

            // Track analytics
            await this.trackPortalActivity(portalId, 'calculations_viewed', calculations.length);

            return filteredCalculations;

        } catch (error) {
            console.error('Error getting client calculations:', error);
            throw error;
        }
    }

    async getClientDocuments(clientId, portalId, filters = {}) {
        try {
            const portal = await this.getPortal(portalId);
            if (!portal || portal.clientId !== clientId) {
                throw new Error('Access denied');
            }

            const documents = await this.findClientDocuments(clientId, filters);

            // Filter based on permissions
            const filteredDocuments = documents.filter(doc => {
                return portal.access.permissions.includes('documents:read');
            });

            return filteredDocuments;

        } catch (error) {
            console.error('Error getting client documents:', error);
            throw error;
        }
    }

    async uploadClientDocument(clientId, portalId, documentData, uploadedBy) {
        try {
            const portal = await this.getPortal(portalId);
            if (!portal || portal.clientId !== clientId) {
                throw new Error('Access denied');
            }

            if (!portal.access.permissions.includes('documents:upload')) {
                throw new Error('Upload permission denied');
            }

            const document = {
                id: this.generateDocumentId(),
                clientId: clientId,
                tenantId: portal.tenantId,
                name: documentData.name,
                type: documentData.type,
                size: documentData.size,
                mimeType: documentData.mimeType,
                url: documentData.url,
                uploadedBy: uploadedBy,
                uploadedAt: new Date(),
                tags: documentData.tags || [],
                isClientUploaded: true
            };

            await this.saveClientDocument(document);

            // Send notification to assigned users
            await this.notifyDocumentUpload(document, portal);

            console.log(`Document uploaded by client: ${document.name}`);
            return document;

        } catch (error) {
            console.error('Error uploading client document:', error);
            throw error;
        }
    }

    /**
     * Client Communication
     */
    async sendClientMessage(portalId, messageData) {
        try {
            const portal = await this.getPortal(portalId);
            if (!portal) {
                throw new Error('Portal not found');
            }

            const message = {
                id: this.generateMessageId(),
                portalId: portalId,
                tenantId: portal.tenantId,
                clientId: portal.clientId,
                fromType: messageData.fromType, // 'client' or 'staff'
                fromUserId: messageData.fromUserId,
                toType: messageData.toType,
                toUserId: messageData.toUserId,
                subject: messageData.subject,
                content: messageData.content,
                attachments: messageData.attachments || [],
                priority: messageData.priority || 'normal',
                status: 'sent',
                readAt: null,
                createdAt: new Date()
            };

            await this.saveMessage(message);

            // Send notification
            await this.sendMessageNotification(message, portal);

            console.log(`Message sent in portal ${portalId}`);
            return message;

        } catch (error) {
            console.error('Error sending client message:', error);
            throw error;
        }
    }

    async getClientMessages(portalId, userId, filters = {}) {
        try {
            const portal = await this.getPortal(portalId);
            if (!portal) {
                throw new Error('Portal not found');
            }

            const messages = await this.findPortalMessages(portalId, userId, filters);
            return messages;

        } catch (error) {
            console.error('Error getting client messages:', error);
            throw error;
        }
    }

    /**
     * Portal Analytics
     */
    async getPortalAnalytics(portalId, timeframe = '30d') {
        try {
            const portal = await this.getPortal(portalId);
            if (!portal) {
                throw new Error('Portal not found');
            }

            const analytics = await this.calculatePortalAnalytics(portalId, timeframe);

            return {
                portalId: portalId,
                timeframe: timeframe,
                metrics: analytics,
                generatedAt: new Date()
            };

        } catch (error) {
            console.error('Error getting portal analytics:', error);
            throw error;
        }
    }

    async trackPortalActivity(portalId, activity, count = 1) {
        try {
            const activityLog = {
                portalId: portalId,
                activity: activity,
                count: count,
                timestamp: new Date()
            };

            await this.savePortalActivity(activityLog);

            // Update portal analytics
            const portal = await this.getPortal(portalId);
            if (portal) {
                switch (activity) {
                    case 'login':
                        portal.analytics.totalLogins += count;
                        portal.analytics.lastAccess = new Date();
                        break;
                    case 'page_view':
                        portal.analytics.pageViews += count;
                        break;
                    case 'document_download':
                        portal.analytics.documentsDownloaded += count;
                        break;
                    case 'calculations_viewed':
                        portal.analytics.calculationsViewed += count;
                        break;
                }

                await this.savePortal(portal);
            }

        } catch (error) {
            console.error('Error tracking portal activity:', error);
        }
    }

    /**
     * Utility Methods
     */
    generatePortalId() {
        return 'portal_' + crypto.randomBytes(16).toString('hex');
    }

    generateInvitationId() {
        return 'inv_' + crypto.randomBytes(12).toString('hex');
    }

    generateInvitationToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    generateClientUserId() {
        return 'cuser_' + crypto.randomBytes(16).toString('hex');
    }

    generateSessionId() {
        return 'sess_' + crypto.randomBytes(16).toString('hex');
    }

    generateDocumentId() {
        return 'doc_' + crypto.randomBytes(16).toString('hex');
    }

    generateMessageId() {
        return 'msg_' + crypto.randomBytes(16).toString('hex');
    }

    async hashPassword(password) {
        const bcrypt = require('bcrypt');
        return await bcrypt.hash(password, 12);
    }

    async verifyPassword(password, hash) {
        const bcrypt = require('bcrypt');
        return await bcrypt.compare(password, hash);
    }

    filterCalculationData(calculation, portal) {
        // Filter calculation data based on portal permissions
        const filtered = {
            id: calculation.id,
            type: calculation.type,
            taxYear: calculation.taxYear,
            status: calculation.status,
            createdAt: calculation.createdAt,
            updatedAt: calculation.updatedAt
        };

        if (portal.access.permissions.includes('calculations:details')) {
            filtered.results = calculation.results;
            filtered.inputData = calculation.inputData;
        }

        return filtered;
    }

    /**
     * Notification Methods
     */
    async sendInvitationEmail(invitation, portal) {
        const emailData = {
            to: invitation.email,
            subject: `You're invited to access ${portal.settings.branding.companyName} Tax Portal`,
            template: 'client_invitation',
            data: {
                firstName: invitation.firstName,
                lastName: invitation.lastName,
                companyName: portal.settings.branding.companyName,
                acceptUrl: `${process.env.CLIENT_PORTAL_URL}/accept/${invitation.token}`,
                expiresAt: invitation.expiresAt
            }
        };

        await this.sendEmail(emailData);
    }

    async sendMessageNotification(message, portal) {
        if (portal.settings.notifications.email) {
            // Send email notification
            const emailData = {
                to: message.toType === 'client' ? 'client@email.com' : 'staff@email.com',
                subject: `New message: ${message.subject}`,
                template: 'message_notification',
                data: {
                    subject: message.subject,
                    content: message.content,
                    portalUrl: `${process.env.CLIENT_PORTAL_URL}/portal/${portal.id}`
                }
            };

            await this.sendEmail(emailData);
        }
    }

    async notifyDocumentUpload(document, portal) {
        // Notify assigned staff about document upload
        const assignedUsers = await this.getAssignedUsers(portal.clientId);

        for (const user of assignedUsers) {
            const emailData = {
                to: user.email,
                subject: `New document uploaded by ${portal.settings.branding.companyName}`,
                template: 'document_upload_notification',
                data: {
                    documentName: document.name,
                    clientName: portal.settings.branding.companyName,
                    uploadedAt: document.uploadedAt,
                    viewUrl: `${process.env.BASE_URL}/clients/${portal.clientId}/documents/${document.id}`
                }
            };

            await this.sendEmail(emailData);
        }
    }

    /**
     * Placeholder methods for database operations
     */
    async savePortal(portal) {
        console.log(`Saving portal: ${portal.id}`);
        this.portals.set(portal.id, portal);
    }

    async getPortal(portalId) {
        console.log(`Getting portal: ${portalId}`);
        return this.portals.get(portalId);
    }

    async saveInvitation(invitation) {
        console.log(`Saving invitation: ${invitation.id}`);
        this.invitations.set(invitation.id, invitation);
    }

    async getInvitationByToken(token) {
        console.log(`Getting invitation by token: ${token}`);
        return Array.from(this.invitations.values()).find(inv => inv.token === token);
    }

    async saveClientUser(clientUser) {
        console.log(`Saving client user: ${clientUser.email}`);
    }

    async getClientUserByEmail(email, portalId) {
        console.log(`Getting client user by email: ${email}`);
        return null;
    }

    async saveClientSession(session) {
        console.log(`Saving client session: ${session.id}`);
        this.clientSessions.set(session.id, session);
    }

    async getClientSession(userId, portalId) {
        console.log(`Getting client session for user: ${userId}`);
        return Array.from(this.clientSessions.values()).find(s => s.userId === userId && s.portalId === portalId);
    }

    async findClientCalculations(clientId, filters) {
        console.log(`Finding calculations for client: ${clientId}`);
        return [];
    }

    async findClientDocuments(clientId, filters) {
        console.log(`Finding documents for client: ${clientId}`);
        return [];
    }

    async saveClientDocument(document) {
        console.log(`Saving client document: ${document.name}`);
    }

    async sendEmail(emailData) {
        console.log(`Sending email to: ${emailData.to}`);
    }

    async trackFailedLogin(userId) {
        console.log(`Tracking failed login for user: ${userId}`);
    }

    async updateLoginStats(userId) {
        console.log(`Updating login stats for user: ${userId}`);
    }

    async cleanupExpiredSessions(userId) {
        console.log(`Cleaning up expired sessions for user: ${userId}`);
    }
}

module.exports = ClientPortal;