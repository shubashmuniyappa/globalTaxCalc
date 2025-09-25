/**
 * White-Label Controller
 * REST API endpoints for white-label management
 */

const express = require('express');
const multer = require('multer');
const BrandingSystem = require('./branding-system');
const DomainManager = require('./domain-manager');

class WhiteLabelController {
    constructor() {
        this.router = express.Router();
        this.brandingSystem = new BrandingSystem();
        this.domainManager = new DomainManager();

        // Configure multer for file uploads
        this.upload = multer({
            storage: multer.memoryStorage(),
            limits: {
                fileSize: 5 * 1024 * 1024, // 5MB limit
                files: 5
            },
            fileFilter: this.fileFilter
        });

        this.setupRoutes();
    }

    fileFilter(req, file, cb) {
        const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/svg+xml',
            'image/x-icon',
            'image/vnd.microsoft.icon'
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only images are allowed.'), false);
        }
    }

    setupRoutes() {
        // Theme Management
        this.router.post('/themes', this.createTheme.bind(this));
        this.router.get('/themes/current', this.getCurrentTheme.bind(this));
        this.router.put('/themes/current', this.updateTheme.bind(this));
        this.router.delete('/themes/current', this.resetTheme.bind(this));
        this.router.get('/themes/preview', this.previewTheme.bind(this));

        // Logo Management
        this.router.post('/logos', this.upload.single('logo'), this.uploadLogo.bind(this));
        this.router.post('/logos/favicon', this.upload.single('favicon'), this.uploadFavicon.bind(this));
        this.router.get('/logos', this.getLogos.bind(this));
        this.router.delete('/logos/:type', this.deleteLogo.bind(this));

        // Custom CSS
        this.router.post('/css', this.saveCustomCSS.bind(this));
        this.router.get('/css', this.getCustomCSS.bind(this));
        this.router.delete('/css', this.deleteCustomCSS.bind(this));

        // Email Templates
        this.router.post('/email-templates', this.createEmailTemplate.bind(this));
        this.router.get('/email-templates', this.getEmailTemplates.bind(this));
        this.router.get('/email-templates/:type', this.getEmailTemplate.bind(this));
        this.router.put('/email-templates/:type', this.updateEmailTemplate.bind(this));
        this.router.delete('/email-templates/:type', this.deleteEmailTemplate.bind(this));
        this.router.post('/email-templates/:type/preview', this.previewEmailTemplate.bind(this));

        // Custom Content
        this.router.post('/content/header', this.updateHeaderContent.bind(this));
        this.router.post('/content/footer', this.updateFooterContent.bind(this));
        this.router.get('/content/:type', this.getCustomContent.bind(this));

        // Domain Management
        this.router.post('/domains', this.setupCustomDomain.bind(this));
        this.router.get('/domains', this.getCustomDomains.bind(this));
        this.router.get('/domains/:domain/status', this.getDomainStatus.bind(this));
        this.router.post('/domains/:domain/verify', this.verifyDomain.bind(this));
        this.router.delete('/domains/:domain', this.removeCustomDomain.bind(this));

        // Branding Package
        this.router.get('/package', this.getBrandingPackage.bind(this));
        this.router.post('/package/export', this.exportBrandingPackage.bind(this));
        this.router.post('/package/import', this.upload.single('package'), this.importBrandingPackage.bind(this));

        // Preview and Testing
        this.router.get('/preview', this.previewBranding.bind(this));
        this.router.post('/test', this.testBrandingConfiguration.bind(this));
    }

    /**
     * Theme Management Endpoints
     */
    async createTheme(req, res) {
        try {
            const tenantId = req.tenantId;
            const themeData = req.body;

            // Validate theme data
            this.brandingSystem.validateTheme(themeData);

            // Create custom theme
            const result = await this.brandingSystem.createCustomTheme(tenantId, themeData);

            res.json({
                success: true,
                message: 'Custom theme created successfully',
                data: result
            });

        } catch (error) {
            console.error('Error creating theme:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async getCurrentTheme(req, res) {
        try {
            const tenant = req.tenant;
            const currentTheme = tenant.branding || this.brandingSystem.defaultTheme;

            res.json({
                success: true,
                data: currentTheme
            });

        } catch (error) {
            console.error('Error getting current theme:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get current theme'
            });
        }
    }

    async updateTheme(req, res) {
        try {
            const tenantId = req.tenantId;
            const updates = req.body;

            // Validate updates
            if (updates.colors) {
                this.brandingSystem.validateTheme({ colors: updates.colors, typography: {} });
            }

            // Update theme
            const result = await this.brandingSystem.createCustomTheme(tenantId, updates);

            // Update tenant branding
            await this.updateTenantBranding(tenantId, updates);

            res.json({
                success: true,
                message: 'Theme updated successfully',
                data: result
            });

        } catch (error) {
            console.error('Error updating theme:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async resetTheme(req, res) {
        try {
            const tenantId = req.tenantId;
            const defaultTheme = this.brandingSystem.getDefaultTheme();

            // Reset to default theme
            await this.updateTenantBranding(tenantId, defaultTheme);

            res.json({
                success: true,
                message: 'Theme reset to default successfully',
                data: defaultTheme
            });

        } catch (error) {
            console.error('Error resetting theme:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to reset theme'
            });
        }
    }

    async previewTheme(req, res) {
        try {
            const themeData = req.body;

            // Generate preview CSS
            const css = await this.brandingSystem.generateThemeCSS(themeData);

            res.set('Content-Type', 'text/css');
            res.send(css);

        } catch (error) {
            console.error('Error generating theme preview:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Logo Management Endpoints
     */
    async uploadLogo(req, res) {
        try {
            const tenantId = req.tenantId;
            const logoFile = req.file;
            const logoType = req.body.type || 'primary';

            if (!logoFile) {
                return res.status(400).json({
                    success: false,
                    message: 'No logo file provided'
                });
            }

            // Upload logo
            const result = await this.brandingSystem.uploadLogo(tenantId, logoFile, logoType);

            // Update tenant branding
            await this.updateTenantBranding(tenantId, {
                logoUrl: result.url,
                logoVariants: result.variants
            });

            res.json({
                success: true,
                message: 'Logo uploaded successfully',
                data: result
            });

        } catch (error) {
            console.error('Error uploading logo:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async uploadFavicon(req, res) {
        try {
            const tenantId = req.tenantId;
            const faviconFile = req.file;

            if (!faviconFile) {
                return res.status(400).json({
                    success: false,
                    message: 'No favicon file provided'
                });
            }

            // Upload favicon
            const favicons = await this.brandingSystem.uploadFavicon(tenantId, faviconFile);

            // Update tenant branding
            await this.updateTenantBranding(tenantId, {
                favicon: favicons.ico,
                faviconVariants: favicons
            });

            res.json({
                success: true,
                message: 'Favicon uploaded successfully',
                data: favicons
            });

        } catch (error) {
            console.error('Error uploading favicon:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async getLogos(req, res) {
        try {
            const tenant = req.tenant;

            const logos = {
                primary: {
                    url: tenant.branding?.logoUrl,
                    variants: tenant.branding?.logoVariants
                },
                favicon: {
                    url: tenant.branding?.favicon,
                    variants: tenant.branding?.faviconVariants
                }
            };

            res.json({
                success: true,
                data: logos
            });

        } catch (error) {
            console.error('Error getting logos:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get logos'
            });
        }
    }

    async deleteLogo(req, res) {
        try {
            const tenantId = req.tenantId;
            const logoType = req.params.type;

            // Remove logo from tenant branding
            const updates = {};
            if (logoType === 'primary') {
                updates.logoUrl = null;
                updates.logoVariants = null;
            } else if (logoType === 'favicon') {
                updates.favicon = null;
                updates.faviconVariants = null;
            }

            await this.updateTenantBranding(tenantId, updates);

            res.json({
                success: true,
                message: `${logoType} logo deleted successfully`
            });

        } catch (error) {
            console.error('Error deleting logo:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete logo'
            });
        }
    }

    /**
     * Custom CSS Endpoints
     */
    async saveCustomCSS(req, res) {
        try {
            const tenantId = req.tenantId;
            const { css } = req.body;

            if (!css) {
                return res.status(400).json({
                    success: false,
                    message: 'CSS content is required'
                });
            }

            // Save custom CSS
            const cssUrl = await this.brandingSystem.saveCustomCSS(tenantId, css);

            // Update tenant branding
            await this.updateTenantBranding(tenantId, {
                customCss: css,
                customCssUrl: cssUrl
            });

            res.json({
                success: true,
                message: 'Custom CSS saved successfully',
                data: { cssUrl: cssUrl }
            });

        } catch (error) {
            console.error('Error saving custom CSS:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async getCustomCSS(req, res) {
        try {
            const tenant = req.tenant;

            res.json({
                success: true,
                data: {
                    css: tenant.branding?.customCss || '',
                    cssUrl: tenant.branding?.customCssUrl
                }
            });

        } catch (error) {
            console.error('Error getting custom CSS:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get custom CSS'
            });
        }
    }

    async deleteCustomCSS(req, res) {
        try {
            const tenantId = req.tenantId;

            // Remove custom CSS
            await this.updateTenantBranding(tenantId, {
                customCss: '',
                customCssUrl: null
            });

            res.json({
                success: true,
                message: 'Custom CSS deleted successfully'
            });

        } catch (error) {
            console.error('Error deleting custom CSS:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete custom CSS'
            });
        }
    }

    /**
     * Email Template Endpoints
     */
    async createEmailTemplate(req, res) {
        try {
            const tenantId = req.tenantId;
            const { type, subject, htmlBody, textBody, variables } = req.body;

            const templateData = {
                subject,
                htmlBody,
                textBody,
                variables,
                primaryColor: req.tenant.branding?.primaryColor,
                secondaryColor: req.tenant.branding?.secondaryColor,
                logoUrl: req.tenant.branding?.logoUrl
            };

            const template = await this.brandingSystem.createEmailTemplate(tenantId, type, templateData);

            res.json({
                success: true,
                message: 'Email template created successfully',
                data: template
            });

        } catch (error) {
            console.error('Error creating email template:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async getEmailTemplates(req, res) {
        try {
            const tenant = req.tenant;
            const templates = tenant.branding?.emailTemplates || {};

            res.json({
                success: true,
                data: templates
            });

        } catch (error) {
            console.error('Error getting email templates:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get email templates'
            });
        }
    }

    async previewEmailTemplate(req, res) {
        try {
            const tenantId = req.tenantId;
            const templateType = req.params.type;
            const sampleData = req.body;

            // Get template
            const template = req.tenant.branding?.emailTemplates?.[templateType];
            if (!template) {
                return res.status(404).json({
                    success: false,
                    message: 'Template not found'
                });
            }

            // Generate preview with sample data
            let preview = template.htmlBody;
            for (const [key, value] of Object.entries(sampleData)) {
                preview = preview.replace(new RegExp(`{{${key}}}`, 'g'), value);
            }

            res.set('Content-Type', 'text/html');
            res.send(preview);

        } catch (error) {
            console.error('Error previewing email template:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to preview email template'
            });
        }
    }

    /**
     * Domain Management Endpoints
     */
    async setupCustomDomain(req, res) {
        try {
            const tenantId = req.tenantId;
            const { domain, options } = req.body;

            if (!domain) {
                return res.status(400).json({
                    success: false,
                    message: 'Domain is required'
                });
            }

            // Setup custom domain
            const result = await this.domainManager.setupCustomDomain(tenantId, domain, options);

            res.json({
                success: true,
                message: 'Custom domain setup initiated',
                data: result
            });

        } catch (error) {
            console.error('Error setting up custom domain:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async getDomainStatus(req, res) {
        try {
            const domain = req.params.domain;

            // Get domain status (placeholder)
            const status = {
                domain: domain,
                status: 'active',
                verificationStatus: 'verified',
                sslStatus: 'issued',
                lastChecked: new Date()
            };

            res.json({
                success: true,
                data: status
            });

        } catch (error) {
            console.error('Error getting domain status:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get domain status'
            });
        }
    }

    /**
     * Branding Package Endpoints
     */
    async getBrandingPackage(req, res) {
        try {
            const tenant = req.tenant;

            const brandingPackage = {
                tenantId: tenant.id,
                name: tenant.name,
                branding: tenant.branding,
                exportedAt: new Date(),
                version: '1.0'
            };

            res.json({
                success: true,
                data: brandingPackage
            });

        } catch (error) {
            console.error('Error getting branding package:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get branding package'
            });
        }
    }

    /**
     * Utility Methods
     */
    async updateTenantBranding(tenantId, updates) {
        // This would update the tenant branding in the database
        console.log(`Updating tenant ${tenantId} branding:`, updates);
    }
}

module.exports = WhiteLabelController;