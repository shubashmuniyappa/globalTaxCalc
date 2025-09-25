/**
 * User Provisioning System
 * Handles automated user provisioning, de-provisioning, and lifecycle management
 */

const crypto = require('crypto');
const nodemailer = require('nodemailer');

class UserProvisioning {
    constructor() {
        this.provisioningRules = new Map();
        this.workflows = new Map();
        this.approvalQueues = new Map();
        this.emailTransporter = this.setupEmailTransporter();
        this.initializeDefaultWorkflows();
    }

    setupEmailTransporter() {
        return nodemailer.createTransporter({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }

    initializeDefaultWorkflows() {
        // Default provisioning workflow
        this.workflows.set('standard_provisioning', {
            id: 'standard_provisioning',
            name: 'Standard User Provisioning',
            steps: [
                { id: 'validate_request', name: 'Validate Request', automated: true },
                { id: 'check_compliance', name: 'Check Compliance', automated: true },
                { id: 'manager_approval', name: 'Manager Approval', automated: false, approver: 'manager' },
                { id: 'create_account', name: 'Create Account', automated: true },
                { id: 'assign_roles', name: 'Assign Roles', automated: true },
                { id: 'setup_integrations', name: 'Setup Integrations', automated: true },
                { id: 'send_welcome', name: 'Send Welcome Email', automated: true },
                { id: 'notify_stakeholders', name: 'Notify Stakeholders', automated: true }
            ]
        });

        // Privileged user workflow
        this.workflows.set('privileged_provisioning', {
            id: 'privileged_provisioning',
            name: 'Privileged User Provisioning',
            steps: [
                { id: 'validate_request', name: 'Validate Request', automated: true },
                { id: 'security_review', name: 'Security Review', automated: false, approver: 'security_team' },
                { id: 'admin_approval', name: 'Admin Approval', automated: false, approver: 'admin' },
                { id: 'background_check', name: 'Background Check', automated: false, approver: 'hr' },
                { id: 'create_account', name: 'Create Account', automated: true },
                { id: 'assign_roles', name: 'Assign Roles', automated: true },
                { id: 'setup_mfa', name: 'Setup MFA', automated: true },
                { id: 'setup_integrations', name: 'Setup Integrations', automated: true },
                { id: 'send_welcome', name: 'Send Welcome Email', automated: true },
                { id: 'schedule_review', name: 'Schedule Access Review', automated: true }
            ]
        });
    }

    /**
     * Provisioning Request Management
     */
    async createProvisioningRequest(tenantId, requestData) {
        try {
            const request = {
                id: this.generateRequestId(),
                tenantId: tenantId,
                type: requestData.type || 'provision', // provision, deprovision, modify
                requestedBy: requestData.requestedBy,
                requestedFor: requestData.requestedFor,
                userData: {
                    email: requestData.email,
                    firstName: requestData.firstName,
                    lastName: requestData.lastName,
                    department: requestData.department,
                    title: requestData.title,
                    manager: requestData.manager,
                    startDate: requestData.startDate,
                    endDate: requestData.endDate,
                    accessLevel: requestData.accessLevel || 'standard',
                    roles: requestData.roles || [],
                    groups: requestData.groups || [],
                    integrations: requestData.integrations || []
                },
                workflow: this.determineWorkflow(requestData),
                status: 'pending',
                currentStep: 0,
                approvals: [],
                history: [{
                    action: 'created',
                    timestamp: new Date(),
                    performedBy: requestData.requestedBy,
                    details: 'Provisioning request created'
                }],
                priority: requestData.priority || 'normal',
                businessJustification: requestData.businessJustification,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Save request
            await this.saveProvisioningRequest(request);

            // Start workflow
            await this.processWorkflowStep(request);

            console.log(`Provisioning request created: ${request.id} for ${request.userData.email}`);
            return request;

        } catch (error) {
            console.error('Error creating provisioning request:', error);
            throw error;
        }
    }

    determineWorkflow(requestData) {
        // Determine workflow based on access level and roles
        if (requestData.accessLevel === 'privileged' ||
            (requestData.roles && requestData.roles.some(role =>
                ['admin', 'super_admin', 'manager'].includes(role)))) {
            return 'privileged_provisioning';
        }

        return 'standard_provisioning';
    }

    async processWorkflowStep(request) {
        try {
            const workflow = this.workflows.get(request.workflow);
            if (!workflow || request.currentStep >= workflow.steps.length) {
                await this.completeRequest(request);
                return;
            }

            const step = workflow.steps[request.currentStep];

            if (step.automated) {
                // Process automated step
                await this.executeAutomatedStep(request, step);
            } else {
                // Process manual approval step
                await this.initiateApprovalStep(request, step);
            }

        } catch (error) {
            console.error('Error processing workflow step:', error);
            await this.handleWorkflowError(request, error);
        }
    }

    async executeAutomatedStep(request, step) {
        try {
            console.log(`Executing automated step: ${step.name} for request ${request.id}`);

            let success = false;

            switch (step.id) {
                case 'validate_request':
                    success = await this.validateProvisioningRequest(request);
                    break;
                case 'check_compliance':
                    success = await this.checkComplianceRequirements(request);
                    break;
                case 'create_account':
                    success = await this.createUserAccount(request);
                    break;
                case 'assign_roles':
                    success = await this.assignUserRoles(request);
                    break;
                case 'setup_integrations':
                    success = await this.setupUserIntegrations(request);
                    break;
                case 'setup_mfa':
                    success = await this.setupMultiFactorAuth(request);
                    break;
                case 'send_welcome':
                    success = await this.sendWelcomeEmail(request);
                    break;
                case 'notify_stakeholders':
                    success = await this.notifyStakeholders(request);
                    break;
                case 'schedule_review':
                    success = await this.scheduleAccessReview(request);
                    break;
                default:
                    success = true;
            }

            if (success) {
                await this.advanceWorkflow(request, `Automated step ${step.name} completed`);
            } else {
                throw new Error(`Automated step ${step.name} failed`);
            }

        } catch (error) {
            console.error(`Error executing automated step ${step.name}:`, error);
            throw error;
        }
    }

    async initiateApprovalStep(request, step) {
        try {
            console.log(`Initiating approval step: ${step.name} for request ${request.id}`);

            const approvers = await this.getApprovers(request, step.approver);
            if (!approvers || approvers.length === 0) {
                throw new Error(`No approvers found for ${step.approver}`);
            }

            const approval = {
                stepId: step.id,
                stepName: step.name,
                approvers: approvers,
                status: 'pending',
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
            };

            request.approvals.push(approval);
            request.status = 'pending_approval';

            await this.saveProvisioningRequest(request);

            // Send approval notifications
            await this.sendApprovalNotifications(request, approval);

            console.log(`Approval step initiated for ${step.name}`);

        } catch (error) {
            console.error(`Error initiating approval step ${step.name}:`, error);
            throw error;
        }
    }

    async processApproval(requestId, stepId, approverId, decision, comments) {
        try {
            const request = await this.getProvisioningRequest(requestId);
            if (!request) {
                throw new Error('Provisioning request not found');
            }

            const approval = request.approvals.find(a => a.stepId === stepId && a.status === 'pending');
            if (!approval) {
                throw new Error('Approval step not found or already processed');
            }

            // Check if approver is authorized
            if (!approval.approvers.includes(approverId)) {
                throw new Error('User not authorized to approve this request');
            }

            // Record approval decision
            approval.status = decision;
            approval.approverId = approverId;
            approval.approvedAt = new Date();
            approval.comments = comments;

            request.history.push({
                action: decision,
                timestamp: new Date(),
                performedBy: approverId,
                details: `${decision} approval for ${approval.stepName}: ${comments || 'No comments'}`
            });

            if (decision === 'approved') {
                // Advance to next step
                await this.advanceWorkflow(request, `Approval step ${approval.stepName} approved by ${approverId}`);
            } else {
                // Reject the request
                request.status = 'rejected';
                await this.saveProvisioningRequest(request);
                await this.notifyRequestRejection(request, approval);
            }

            console.log(`Approval processed: ${decision} for request ${requestId} by ${approverId}`);
            return request;

        } catch (error) {
            console.error('Error processing approval:', error);
            throw error;
        }
    }

    async advanceWorkflow(request, message) {
        request.currentStep++;
        request.status = 'in_progress';
        request.updatedAt = new Date();

        request.history.push({
            action: 'advanced',
            timestamp: new Date(),
            performedBy: 'system',
            details: message
        });

        await this.saveProvisioningRequest(request);
        await this.processWorkflowStep(request);
    }

    async completeRequest(request) {
        request.status = 'completed';
        request.completedAt = new Date();

        request.history.push({
            action: 'completed',
            timestamp: new Date(),
            performedBy: 'system',
            details: 'Provisioning request completed successfully'
        });

        await this.saveProvisioningRequest(request);

        // Send completion notifications
        await this.notifyRequestCompletion(request);

        console.log(`Provisioning request completed: ${request.id}`);
    }

    /**
     * Automated Step Implementations
     */
    async validateProvisioningRequest(request) {
        try {
            const userData = request.userData;

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(userData.email)) {
                throw new Error('Invalid email format');
            }

            // Check for duplicate users
            const existingUser = await this.getUserByEmail(request.tenantId, userData.email);
            if (existingUser) {
                throw new Error('User with this email already exists');
            }

            // Validate required fields
            const requiredFields = ['firstName', 'lastName', 'department'];
            for (const field of requiredFields) {
                if (!userData[field]) {
                    throw new Error(`Missing required field: ${field}`);
                }
            }

            // Validate start date
            if (userData.startDate && new Date(userData.startDate) > new Date()) {
                // Future start date - schedule for later
                await this.scheduleProvisioningRequest(request, userData.startDate);
            }

            return true;

        } catch (error) {
            console.error('Validation failed:', error);
            return false;
        }
    }

    async checkComplianceRequirements(request) {
        try {
            const tenantSettings = await this.getTenantSettings(request.tenantId);

            // Check password policy compliance
            if (tenantSettings.security?.passwordPolicy) {
                // Ensure user will be required to set compliant password
                request.userData.requirePasswordSetup = true;
            }

            // Check MFA requirements
            if (tenantSettings.security?.mfaRequired) {
                request.userData.requireMfaSetup = true;
            }

            // Check role assignment compliance
            for (const role of request.userData.roles) {
                const roleCompliance = await this.checkRoleCompliance(request.tenantId, role);
                if (!roleCompliance.allowed) {
                    throw new Error(`Role ${role} not allowed: ${roleCompliance.reason}`);
                }
            }

            return true;

        } catch (error) {
            console.error('Compliance check failed:', error);
            return false;
        }
    }

    async createUserAccount(request) {
        try {
            const userData = request.userData;

            const user = {
                id: this.generateUserId(),
                tenantId: request.tenantId,
                email: userData.email,
                firstName: userData.firstName,
                lastName: userData.lastName,
                displayName: `${userData.firstName} ${userData.lastName}`,
                department: userData.department,
                title: userData.title,
                manager: userData.manager,
                status: 'active',
                isProvisioned: true,
                provisioningRequestId: request.id,
                requirePasswordSetup: userData.requirePasswordSetup || true,
                requireMfaSetup: userData.requireMfaSetup || false,
                lastLogin: null,
                loginCount: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Generate temporary password
            user.temporaryPassword = this.generateTemporaryPassword();
            user.passwordResetToken = this.generatePasswordResetToken();
            user.passwordResetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

            await this.saveUser(request.tenantId, user);

            // Store user ID in request for subsequent steps
            request.userId = user.id;

            console.log(`User account created: ${user.email} (${user.id})`);
            return true;

        } catch (error) {
            console.error('Error creating user account:', error);
            return false;
        }
    }

    async assignUserRoles(request) {
        try {
            const roles = request.userData.roles || [];

            for (const roleId of roles) {
                await this.assignRoleToUser(request.tenantId, request.userId, roleId, 'system');
            }

            console.log(`Roles assigned to user ${request.userId}: ${roles.join(', ')}`);
            return true;

        } catch (error) {
            console.error('Error assigning user roles:', error);
            return false;
        }
    }

    async setupUserIntegrations(request) {
        try {
            const integrations = request.userData.integrations || [];

            for (const integration of integrations) {
                await this.provisionUserIntegration(request.tenantId, request.userId, integration);
            }

            console.log(`Integrations setup for user ${request.userId}: ${integrations.join(', ')}`);
            return true;

        } catch (error) {
            console.error('Error setting up user integrations:', error);
            return false;
        }
    }

    async setupMultiFactorAuth(request) {
        try {
            if (!request.userData.requireMfaSetup) {
                return true;
            }

            // Create MFA setup record
            await this.createMfaSetupRecord(request.tenantId, request.userId);

            console.log(`MFA setup initiated for user ${request.userId}`);
            return true;

        } catch (error) {
            console.error('Error setting up MFA:', error);
            return false;
        }
    }

    async sendWelcomeEmail(request) {
        try {
            const user = await this.getUser(request.tenantId, request.userId);
            const tenant = await this.getTenant(request.tenantId);

            const emailTemplate = await this.getEmailTemplate(request.tenantId, 'welcome');

            const emailData = {
                to: user.email,
                subject: `Welcome to ${tenant.name}`,
                html: this.processEmailTemplate(emailTemplate, {
                    firstName: user.firstName,
                    lastName: user.lastName,
                    companyName: tenant.name,
                    loginUrl: `${process.env.BASE_URL}/login`,
                    passwordResetUrl: `${process.env.BASE_URL}/reset-password?token=${user.passwordResetToken}`,
                    supportEmail: tenant.support?.supportEmail || 'support@globaltaxcalc.com'
                })
            };

            await this.emailTransporter.sendMail(emailData);

            console.log(`Welcome email sent to ${user.email}`);
            return true;

        } catch (error) {
            console.error('Error sending welcome email:', error);
            return false;
        }
    }

    /**
     * Approval Management
     */
    async getApprovers(request, approverType) {
        try {
            switch (approverType) {
                case 'manager':
                    if (request.userData.manager) {
                        return [request.userData.manager];
                    }
                    // Fallback to department manager
                    return await this.getDepartmentManagers(request.tenantId, request.userData.department);

                case 'admin':
                    return await this.getTenantAdmins(request.tenantId);

                case 'security_team':
                    return await this.getSecurityTeamMembers(request.tenantId);

                case 'hr':
                    return await this.getHRTeamMembers(request.tenantId);

                default:
                    return [];
            }

        } catch (error) {
            console.error('Error getting approvers:', error);
            return [];
        }
    }

    async sendApprovalNotifications(request, approval) {
        try {
            for (const approverId of approval.approvers) {
                const approver = await this.getUser(request.tenantId, approverId);
                if (!approver) continue;

                const emailData = {
                    to: approver.email,
                    subject: `Approval Required: User Provisioning Request`,
                    html: this.generateApprovalEmail(request, approval, approver)
                };

                await this.emailTransporter.sendMail(emailData);
            }

            console.log(`Approval notifications sent for request ${request.id}`);

        } catch (error) {
            console.error('Error sending approval notifications:', error);
        }
    }

    generateApprovalEmail(request, approval, approver) {
        return `
        <h2>Approval Required</h2>
        <p>Dear ${approver.firstName},</p>
        <p>A user provisioning request requires your approval:</p>
        <ul>
            <li><strong>Request ID:</strong> ${request.id}</li>
            <li><strong>User:</strong> ${request.userData.firstName} ${request.userData.lastName}</li>
            <li><strong>Email:</strong> ${request.userData.email}</li>
            <li><strong>Department:</strong> ${request.userData.department}</li>
            <li><strong>Access Level:</strong> ${request.userData.accessLevel}</li>
            <li><strong>Requested By:</strong> ${request.requestedBy}</li>
        </ul>
        <p><strong>Business Justification:</strong> ${request.businessJustification || 'None provided'}</p>
        <p>Please review and approve or reject this request:</p>
        <p><a href="${process.env.BASE_URL}/admin/provisioning/${request.id}">Review Request</a></p>
        <p>This approval expires on ${approval.expiresAt.toLocaleDateString()}.</p>
        `;
    }

    /**
     * Utility Methods
     */
    generateRequestId() {
        return 'PR' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }

    generateUserId() {
        return crypto.randomBytes(16).toString('hex');
    }

    generateTemporaryPassword() {
        return crypto.randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substr(0, 12);
    }

    generatePasswordResetToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    processEmailTemplate(template, data) {
        let html = template.htmlBody || template;
        for (const [key, value] of Object.entries(data)) {
            html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
        }
        return html;
    }

    /**
     * Placeholder methods for database and external system operations
     */
    async saveProvisioningRequest(request) {
        console.log(`Saving provisioning request: ${request.id}`);
    }

    async getProvisioningRequest(requestId) {
        console.log(`Getting provisioning request: ${requestId}`);
        return null;
    }

    async getUserByEmail(tenantId, email) {
        console.log(`Checking for existing user: ${email}`);
        return null;
    }

    async saveUser(tenantId, user) {
        console.log(`Saving user: ${user.email}`);
    }

    async getUser(tenantId, userId) {
        console.log(`Getting user: ${userId}`);
        return null;
    }

    async getTenant(tenantId) {
        console.log(`Getting tenant: ${tenantId}`);
        return { name: 'Sample Tenant' };
    }

    async getTenantSettings(tenantId) {
        console.log(`Getting tenant settings: ${tenantId}`);
        return {};
    }

    async assignRoleToUser(tenantId, userId, roleId, assignedBy) {
        console.log(`Assigning role ${roleId} to user ${userId}`);
    }

    async getDepartmentManagers(tenantId, department) {
        console.log(`Getting managers for department: ${department}`);
        return [];
    }

    async getTenantAdmins(tenantId) {
        console.log(`Getting tenant admins: ${tenantId}`);
        return [];
    }
}

module.exports = UserProvisioning;