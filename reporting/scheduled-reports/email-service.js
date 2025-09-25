class EmailService {
    constructor() {
        this.providers = new Map();
        this.templates = new Map();
        this.defaultProvider = null;
        this.retryConfig = {
            maxRetries: 3,
            retryDelay: 1000,
            backoffFactor: 2
        };
        this.initializeTemplates();
    }

    initializeTemplates() {
        // Default email templates for scheduled reports
        this.templates.set('report-delivery', {
            name: 'Report Delivery',
            subject: '{reportName} - {date}',
            htmlTemplate: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>{reportName}</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: #2c3e50; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
                        .content { background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; }
                        .footer { background: #6c757d; color: white; padding: 15px; border-radius: 0 0 5px 5px; text-align: center; font-size: 12px; }
                        .summary-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                        .summary-table th, .summary-table td { border: 1px solid #dee2e6; padding: 8px; text-align: left; }
                        .summary-table th { background: #e9ecef; }
                        .attachment-info { background: #e7f3ff; padding: 10px; border-radius: 3px; margin: 10px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>{reportName}</h1>
                            <p>Generated on {date} at {time}</p>
                        </div>
                        <div class="content">
                            <p>Dear {recipientName},</p>
                            <p>Please find your scheduled report attached to this email.</p>

                            {reportSummary}

                            <div class="attachment-info">
                                <strong>📎 Attachments:</strong>
                                <ul>
                                    {attachmentList}
                                </ul>
                            </div>

                            <p>If you have any questions about this report, please contact our support team.</p>
                        </div>
                        <div class="footer">
                            <p>This is an automated message from GlobalTaxCalc Reporting System</p>
                            <p>© 2023 GlobalTaxCalc. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            textTemplate: `
{reportName}
Generated on {date} at {time}

Dear {recipientName},

Please find your scheduled report attached to this email.

{reportSummaryText}

Attachments:
{attachmentListText}

If you have any questions about this report, please contact our support team.

---
This is an automated message from GlobalTaxCalc Reporting System
© 2023 GlobalTaxCalc. All rights reserved.
            `
        });

        this.templates.set('report-failure', {
            name: 'Report Generation Failed',
            subject: 'Report Generation Failed - {reportName}',
            htmlTemplate: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Report Generation Failed</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: #dc3545; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
                        .content { background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; }
                        .footer { background: #6c757d; color: white; padding: 15px; border-radius: 0 0 5px 5px; text-align: center; font-size: 12px; }
                        .error-box { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 10px; border-radius: 3px; margin: 10px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>⚠️ Report Generation Failed</h1>
                            <p>{reportName}</p>
                        </div>
                        <div class="content">
                            <p>We encountered an issue while generating your scheduled report.</p>

                            <div class="error-box">
                                <strong>Error Details:</strong><br>
                                {errorMessage}
                            </div>

                            <p><strong>Scheduled Time:</strong> {scheduledTime}</p>
                            <p><strong>Failure Time:</strong> {failureTime}</p>

                            <p>Our team has been notified and will investigate this issue. We will attempt to generate the report again at the next scheduled time.</p>

                            <p>If this problem persists, please contact our support team.</p>
                        </div>
                        <div class="footer">
                            <p>GlobalTaxCalc Reporting System</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        });

        this.templates.set('schedule-created', {
            name: 'Schedule Created Confirmation',
            subject: 'Report Schedule Created - {reportName}',
            htmlTemplate: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Schedule Created</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: #28a745; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
                        .content { background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; }
                        .footer { background: #6c757d; color: white; padding: 15px; border-radius: 0 0 5px 5px; text-align: center; font-size: 12px; }
                        .schedule-details { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 3px; margin: 15px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>✅ Report Schedule Created</h1>
                        </div>
                        <div class="content">
                            <p>Your report schedule has been successfully created.</p>

                            <div class="schedule-details">
                                <h3>Schedule Details:</h3>
                                <p><strong>Report Name:</strong> {reportName}</p>
                                <p><strong>Schedule Type:</strong> {scheduleType}</p>
                                <p><strong>Next Run:</strong> {nextRun}</p>
                                <p><strong>Recipients:</strong> {recipients}</p>
                            </div>

                            <p>You will receive reports according to this schedule. You can modify or disable this schedule at any time through your dashboard.</p>
                        </div>
                        <div class="footer">
                            <p>GlobalTaxCalc Reporting System</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        });
    }

    addProvider(name, providerConfig) {
        const provider = {
            name,
            type: providerConfig.type,
            config: providerConfig.config,
            isDefault: providerConfig.isDefault || false,
            isActive: providerConfig.isActive !== false
        };

        this.providers.set(name, provider);

        if (provider.isDefault || this.providers.size === 1) {
            this.defaultProvider = name;
        }

        return provider;
    }

    // SMTP Provider
    addSMTPProvider(name, smtpConfig) {
        return this.addProvider(name, {
            type: 'smtp',
            config: {
                host: smtpConfig.host,
                port: smtpConfig.port || 587,
                secure: smtpConfig.secure || false,
                auth: {
                    user: smtpConfig.user,
                    pass: smtpConfig.password
                },
                from: smtpConfig.from
            },
            isDefault: smtpConfig.isDefault
        });
    }

    // SendGrid Provider
    addSendGridProvider(name, sendGridConfig) {
        return this.addProvider(name, {
            type: 'sendgrid',
            config: {
                apiKey: sendGridConfig.apiKey,
                from: sendGridConfig.from
            },
            isDefault: sendGridConfig.isDefault
        });
    }

    // AWS SES Provider
    addAWSProvider(name, awsConfig) {
        return this.addProvider(name, {
            type: 'aws-ses',
            config: {
                region: awsConfig.region,
                accessKeyId: awsConfig.accessKeyId,
                secretAccessKey: awsConfig.secretAccessKey,
                from: awsConfig.from
            },
            isDefault: awsConfig.isDefault
        });
    }

    async sendEmail(emailData, providerName = null) {
        const provider = this.getProvider(providerName);
        if (!provider) {
            throw new Error(`Email provider not found: ${providerName || this.defaultProvider}`);
        }

        const processedEmail = this.processEmailData(emailData);

        let attempt = 0;
        let lastError;

        while (attempt < this.retryConfig.maxRetries) {
            try {
                const result = await this.sendWithProvider(provider, processedEmail);
                return {
                    success: true,
                    messageId: result.messageId,
                    provider: provider.name,
                    attempt: attempt + 1
                };
            } catch (error) {
                lastError = error;
                attempt++;

                if (attempt < this.retryConfig.maxRetries) {
                    const delay = this.retryConfig.retryDelay * Math.pow(this.retryConfig.backoffFactor, attempt - 1);
                    await this.delay(delay);
                }
            }
        }

        throw new Error(`Failed to send email after ${this.retryConfig.maxRetries} attempts: ${lastError.message}`);
    }

    processEmailData(emailData) {
        const processed = { ...emailData };

        // Process template if specified
        if (emailData.template) {
            const template = this.templates.get(emailData.template);
            if (template) {
                processed.subject = this.processTemplate(template.subject, emailData.templateData || {});
                processed.html = this.processTemplate(template.htmlTemplate, emailData.templateData || {});
                processed.text = this.processTemplate(template.textTemplate, emailData.templateData || {});
            }
        }

        // Ensure required fields
        if (!processed.subject) {
            processed.subject = 'Report from GlobalTaxCalc';
        }

        if (!processed.html && !processed.text) {
            processed.text = 'Please find your report attached.';
        }

        return processed;
    }

    processTemplate(template, data) {
        if (!template) return '';

        let processed = template;

        // Replace placeholders with actual data
        for (const [key, value] of Object.entries(data)) {
            const placeholder = `{${key}}`;
            processed = processed.replace(new RegExp(placeholder, 'g'), value || '');
        }

        // Process special placeholders
        processed = processed.replace(/{date}/g, new Date().toLocaleDateString());
        processed = processed.replace(/{time}/g, new Date().toLocaleTimeString());
        processed = processed.replace(/{datetime}/g, new Date().toLocaleString());

        return processed;
    }

    async sendWithProvider(provider, emailData) {
        switch (provider.type) {
            case 'smtp':
                return await this.sendWithSMTP(provider, emailData);
            case 'sendgrid':
                return await this.sendWithSendGrid(provider, emailData);
            case 'aws-ses':
                return await this.sendWithAWS(provider, emailData);
            default:
                throw new Error(`Unsupported email provider type: ${provider.type}`);
        }
    }

    async sendWithSMTP(provider, emailData) {
        // This would use nodemailer in a real implementation
        const nodemailer = require('nodemailer');

        const transporter = nodemailer.createTransporter({
            host: provider.config.host,
            port: provider.config.port,
            secure: provider.config.secure,
            auth: provider.config.auth
        });

        const mailOptions = {
            from: provider.config.from,
            to: Array.isArray(emailData.to) ? emailData.to.join(', ') : emailData.to,
            cc: emailData.cc,
            bcc: emailData.bcc,
            subject: emailData.subject,
            text: emailData.text,
            html: emailData.html,
            attachments: emailData.attachments
        };

        const result = await transporter.sendMail(mailOptions);
        return { messageId: result.messageId };
    }

    async sendWithSendGrid(provider, emailData) {
        // This would use SendGrid API in a real implementation
        const sgMail = require('@sendgrid/mail');
        sgMail.setApiKey(provider.config.apiKey);

        const msg = {
            from: provider.config.from,
            to: emailData.to,
            cc: emailData.cc,
            bcc: emailData.bcc,
            subject: emailData.subject,
            text: emailData.text,
            html: emailData.html,
            attachments: emailData.attachments?.map(att => ({
                content: att.content,
                filename: att.filename,
                type: att.contentType,
                disposition: 'attachment'
            }))
        };

        const result = await sgMail.send(msg);
        return { messageId: result[0].headers['x-message-id'] };
    }

    async sendWithAWS(provider, emailData) {
        // This would use AWS SDK in a real implementation
        const AWS = require('aws-sdk');

        const ses = new AWS.SES({
            region: provider.config.region,
            accessKeyId: provider.config.accessKeyId,
            secretAccessKey: provider.config.secretAccessKey
        });

        const params = {
            Source: provider.config.from,
            Destination: {
                ToAddresses: Array.isArray(emailData.to) ? emailData.to : [emailData.to],
                CcAddresses: emailData.cc ? (Array.isArray(emailData.cc) ? emailData.cc : [emailData.cc]) : [],
                BccAddresses: emailData.bcc ? (Array.isArray(emailData.bcc) ? emailData.bcc : [emailData.bcc]) : []
            },
            Message: {
                Subject: { Data: emailData.subject },
                Body: {}
            }
        };

        if (emailData.text) {
            params.Message.Body.Text = { Data: emailData.text };
        }

        if (emailData.html) {
            params.Message.Body.Html = { Data: emailData.html };
        }

        const result = await ses.sendEmail(params).promise();
        return { messageId: result.MessageId };
    }

    getProvider(providerName) {
        const name = providerName || this.defaultProvider;
        const provider = this.providers.get(name);

        if (!provider) {
            return null;
        }

        if (!provider.isActive) {
            throw new Error(`Email provider ${name} is inactive`);
        }

        return provider;
    }

    addTemplate(templateId, templateData) {
        const template = {
            name: templateData.name,
            subject: templateData.subject,
            htmlTemplate: templateData.htmlTemplate,
            textTemplate: templateData.textTemplate,
            createdAt: new Date().toISOString()
        };

        this.templates.set(templateId, template);
        return template;
    }

    getTemplate(templateId) {
        return this.templates.get(templateId);
    }

    getAllTemplates() {
        return Array.from(this.templates.entries()).map(([id, template]) => ({
            id,
            ...template
        }));
    }

    updateTemplate(templateId, updates) {
        const template = this.templates.get(templateId);
        if (!template) {
            throw new Error('Template not found');
        }

        Object.assign(template, updates, {
            updatedAt: new Date().toISOString()
        });

        return template;
    }

    deleteTemplate(templateId) {
        return this.templates.delete(templateId);
    }

    async testProvider(providerName) {
        const provider = this.getProvider(providerName);
        if (!provider) {
            throw new Error(`Provider not found: ${providerName}`);
        }

        try {
            const testEmail = {
                to: 'test@example.com',
                subject: 'Test Email from GlobalTaxCalc',
                text: 'This is a test email to verify email provider configuration.',
                html: '<p>This is a test email to verify email provider configuration.</p>'
            };

            // Don't actually send, just validate configuration
            await this.validateProviderConfig(provider);

            return {
                success: true,
                provider: provider.name,
                message: 'Provider configuration is valid'
            };
        } catch (error) {
            return {
                success: false,
                provider: provider.name,
                error: error.message
            };
        }
    }

    async validateProviderConfig(provider) {
        switch (provider.type) {
            case 'smtp':
                if (!provider.config.host || !provider.config.auth.user || !provider.config.auth.pass) {
                    throw new Error('SMTP configuration incomplete');
                }
                break;
            case 'sendgrid':
                if (!provider.config.apiKey) {
                    throw new Error('SendGrid API key missing');
                }
                break;
            case 'aws-ses':
                if (!provider.config.region || !provider.config.accessKeyId || !provider.config.secretAccessKey) {
                    throw new Error('AWS SES configuration incomplete');
                }
                break;
        }
    }

    getProviderStats() {
        return {
            totalProviders: this.providers.size,
            activeProviders: Array.from(this.providers.values()).filter(p => p.isActive).length,
            defaultProvider: this.defaultProvider,
            providers: Array.from(this.providers.entries()).map(([name, provider]) => ({
                name,
                type: provider.type,
                isActive: provider.isActive,
                isDefault: name === this.defaultProvider
            }))
        };
    }

    enableProvider(providerName) {
        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new Error('Provider not found');
        }

        provider.isActive = true;
        return provider;
    }

    disableProvider(providerName) {
        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new Error('Provider not found');
        }

        if (providerName === this.defaultProvider) {
            throw new Error('Cannot disable default provider');
        }

        provider.isActive = false;
        return provider;
    }

    setDefaultProvider(providerName) {
        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new Error('Provider not found');
        }

        if (!provider.isActive) {
            throw new Error('Cannot set inactive provider as default');
        }

        this.defaultProvider = providerName;
        return provider;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Utility method to create report delivery emails
    createReportDeliveryEmail(schedule, report, recipients) {
        const attachmentList = report.attachments?.map(att => `<li>${att.filename} (${this.formatFileSize(att.size)})</li>`).join('') || '<li>No attachments</li>';
        const attachmentListText = report.attachments?.map(att => `- ${att.filename} (${this.formatFileSize(att.size)})`).join('\n') || 'No attachments';

        const templateData = {
            reportName: schedule.name,
            recipientName: 'User',
            reportSummary: report.summary ? `<div class="summary-section">${report.summary}</div>` : '',
            reportSummaryText: report.summaryText || '',
            attachmentList,
            attachmentListText
        };

        return {
            to: recipients.map(r => r.email),
            template: 'report-delivery',
            templateData,
            attachments: report.attachments
        };
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EmailService;
}