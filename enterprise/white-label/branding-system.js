/**
 * White-Label Branding System
 * Handles custom branding, themes, and visual customization
 */

const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const AWS = require('aws-sdk');

class BrandingSystem {
    constructor() {
        this.s3 = new AWS.S3({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION || 'us-east-1'
        });

        this.bucket = process.env.BRANDING_BUCKET || 'globaltaxcalc-branding';
        this.cdnBase = process.env.CDN_BASE_URL || 'https://cdn.globaltaxcalc.com';

        this.defaultTheme = this.getDefaultTheme();
    }

    /**
     * Custom Theme Management
     */
    async createCustomTheme(tenantId, themeData) {
        try {
            const theme = {
                tenantId: tenantId,
                name: themeData.name || `${tenantId}-custom`,
                colors: {
                    primary: themeData.primary || '#1976d2',
                    secondary: themeData.secondary || '#424242',
                    accent: themeData.accent || '#ff4081',
                    background: themeData.background || '#fafafa',
                    surface: themeData.surface || '#ffffff',
                    text: {
                        primary: themeData.textPrimary || '#212121',
                        secondary: themeData.textSecondary || '#757575',
                        disabled: themeData.textDisabled || '#bdbdbd'
                    },
                    success: themeData.success || '#4caf50',
                    warning: themeData.warning || '#ff9800',
                    error: themeData.error || '#f44336',
                    info: themeData.info || '#2196f3'
                },
                typography: {
                    fontFamily: themeData.fontFamily || '"Roboto", "Helvetica", "Arial", sans-serif',
                    fontSizes: {
                        xs: '0.75rem',
                        sm: '0.875rem',
                        base: '1rem',
                        lg: '1.125rem',
                        xl: '1.25rem',
                        '2xl': '1.5rem',
                        '3xl': '1.875rem',
                        '4xl': '2.25rem'
                    },
                    fontWeights: {
                        light: 300,
                        normal: 400,
                        medium: 500,
                        semibold: 600,
                        bold: 700
                    }
                },
                spacing: {
                    xs: '0.25rem',
                    sm: '0.5rem',
                    md: '1rem',
                    lg: '1.5rem',
                    xl: '3rem'
                },
                borderRadius: {
                    none: '0',
                    sm: '0.125rem',
                    base: '0.25rem',
                    md: '0.375rem',
                    lg: '0.5rem',
                    xl: '0.75rem',
                    full: '9999px'
                },
                shadows: {
                    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                    base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                },
                components: themeData.components || {}
            };

            // Generate CSS from theme
            const css = await this.generateThemeCSS(theme);

            // Save theme CSS to S3
            const cssKey = `themes/${tenantId}/theme.css`;
            await this.uploadToS3(cssKey, css, 'text/css');

            // Save theme configuration
            const themeKey = `themes/${tenantId}/theme.json`;
            await this.uploadToS3(themeKey, JSON.stringify(theme, null, 2), 'application/json');

            console.log(`Custom theme created for tenant ${tenantId}`);
            return {
                theme: theme,
                cssUrl: `${this.cdnBase}/${cssKey}`,
                configUrl: `${this.cdnBase}/${themeKey}`
            };

        } catch (error) {
            console.error('Error creating custom theme:', error);
            throw error;
        }
    }

    async generateThemeCSS(theme) {
        const css = `
        /* Custom Theme for ${theme.tenantId} */
        :root {
            /* Colors */
            --color-primary: ${theme.colors.primary};
            --color-secondary: ${theme.colors.secondary};
            --color-accent: ${theme.colors.accent};
            --color-background: ${theme.colors.background};
            --color-surface: ${theme.colors.surface};
            --color-text-primary: ${theme.colors.text.primary};
            --color-text-secondary: ${theme.colors.text.secondary};
            --color-text-disabled: ${theme.colors.text.disabled};
            --color-success: ${theme.colors.success};
            --color-warning: ${theme.colors.warning};
            --color-error: ${theme.colors.error};
            --color-info: ${theme.colors.info};

            /* Typography */
            --font-family: ${theme.typography.fontFamily};
            --font-size-xs: ${theme.typography.fontSizes.xs};
            --font-size-sm: ${theme.typography.fontSizes.sm};
            --font-size-base: ${theme.typography.fontSizes.base};
            --font-size-lg: ${theme.typography.fontSizes.lg};
            --font-size-xl: ${theme.typography.fontSizes.xl};
            --font-size-2xl: ${theme.typography.fontSizes['2xl']};
            --font-size-3xl: ${theme.typography.fontSizes['3xl']};
            --font-size-4xl: ${theme.typography.fontSizes['4xl']};

            /* Font Weights */
            --font-weight-light: ${theme.typography.fontWeights.light};
            --font-weight-normal: ${theme.typography.fontWeights.normal};
            --font-weight-medium: ${theme.typography.fontWeights.medium};
            --font-weight-semibold: ${theme.typography.fontWeights.semibold};
            --font-weight-bold: ${theme.typography.fontWeights.bold};

            /* Spacing */
            --spacing-xs: ${theme.spacing.xs};
            --spacing-sm: ${theme.spacing.sm};
            --spacing-md: ${theme.spacing.md};
            --spacing-lg: ${theme.spacing.lg};
            --spacing-xl: ${theme.spacing.xl};

            /* Border Radius */
            --border-radius-none: ${theme.borderRadius.none};
            --border-radius-sm: ${theme.borderRadius.sm};
            --border-radius-base: ${theme.borderRadius.base};
            --border-radius-md: ${theme.borderRadius.md};
            --border-radius-lg: ${theme.borderRadius.lg};
            --border-radius-xl: ${theme.borderRadius.xl};
            --border-radius-full: ${theme.borderRadius.full};

            /* Shadows */
            --shadow-sm: ${theme.shadows.sm};
            --shadow-base: ${theme.shadows.base};
            --shadow-md: ${theme.shadows.md};
            --shadow-lg: ${theme.shadows.lg};
        }

        /* Base Styles */
        body {
            font-family: var(--font-family);
            background-color: var(--color-background);
            color: var(--color-text-primary);
        }

        /* Primary Button */
        .btn-primary {
            background-color: var(--color-primary);
            border-color: var(--color-primary);
            color: white;
            border-radius: var(--border-radius-base);
            box-shadow: var(--shadow-base);
        }

        .btn-primary:hover {
            background-color: color-mix(in srgb, var(--color-primary) 85%, black);
            border-color: color-mix(in srgb, var(--color-primary) 85%, black);
        }

        /* Secondary Button */
        .btn-secondary {
            background-color: var(--color-secondary);
            border-color: var(--color-secondary);
            color: white;
            border-radius: var(--border-radius-base);
        }

        /* Cards */
        .card {
            background-color: var(--color-surface);
            border-radius: var(--border-radius-lg);
            box-shadow: var(--shadow-base);
            border: 1px solid color-mix(in srgb, var(--color-text-primary) 10%, transparent);
        }

        /* Navigation */
        .navbar {
            background-color: var(--color-primary);
            box-shadow: var(--shadow-md);
        }

        .navbar-brand {
            color: white !important;
            font-weight: var(--font-weight-bold);
        }

        /* Form Controls */
        .form-control {
            border-radius: var(--border-radius-base);
            border-color: color-mix(in srgb, var(--color-text-primary) 20%, transparent);
        }

        .form-control:focus {
            border-color: var(--color-primary);
            box-shadow: 0 0 0 0.2rem color-mix(in srgb, var(--color-primary) 25%, transparent);
        }

        /* Alerts */
        .alert-success {
            background-color: color-mix(in srgb, var(--color-success) 10%, white);
            border-color: var(--color-success);
            color: var(--color-success);
        }

        .alert-warning {
            background-color: color-mix(in srgb, var(--color-warning) 10%, white);
            border-color: var(--color-warning);
            color: var(--color-warning);
        }

        .alert-error {
            background-color: color-mix(in srgb, var(--color-error) 10%, white);
            border-color: var(--color-error);
            color: var(--color-error);
        }

        .alert-info {
            background-color: color-mix(in srgb, var(--color-info) 10%, white);
            border-color: var(--color-info);
            color: var(--color-info);
        }

        /* Tables */
        .table {
            background-color: var(--color-surface);
        }

        .table th {
            background-color: color-mix(in srgb, var(--color-primary) 10%, white);
            color: var(--color-text-primary);
        }

        /* Custom Component Styles */
        ${this.generateComponentCSS(theme.components)}
        `;

        return css.trim();
    }

    generateComponentCSS(components) {
        let css = '';

        for (const [component, styles] of Object.entries(components)) {
            css += `\n/* ${component} Component */\n`;
            for (const [selector, rules] of Object.entries(styles)) {
                css += `.${component}-${selector} {\n`;
                for (const [property, value] of Object.entries(rules)) {
                    css += `  ${property}: ${value};\n`;
                }
                css += '}\n';
            }
        }

        return css;
    }

    /**
     * Logo and Asset Management
     */
    async uploadLogo(tenantId, logoFile, type = 'primary') {
        try {
            // Validate file type
            const allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml'];
            if (!allowedTypes.includes(logoFile.mimetype)) {
                throw new Error('Invalid file type. Only JPEG, PNG, and SVG are allowed.');
            }

            // Process image if not SVG
            let processedBuffer = logoFile.buffer;

            if (logoFile.mimetype !== 'image/svg+xml') {
                // Resize and optimize
                processedBuffer = await sharp(logoFile.buffer)
                    .resize({ width: 300, height: 100, fit: 'inside', withoutEnlargement: true })
                    .png({ quality: 90 })
                    .toBuffer();
            }

            // Upload to S3
            const key = `logos/${tenantId}/${type}-logo.${this.getFileExtension(logoFile.mimetype)}`;
            await this.uploadToS3(key, processedBuffer, logoFile.mimetype);

            // Generate different sizes for responsive design
            const variants = await this.generateLogoVariants(tenantId, processedBuffer, type);

            const logoUrl = `${this.cdnBase}/${key}`;

            console.log(`Logo uploaded for tenant ${tenantId}: ${logoUrl}`);

            return {
                url: logoUrl,
                variants: variants,
                type: type
            };

        } catch (error) {
            console.error('Error uploading logo:', error);
            throw error;
        }
    }

    async generateLogoVariants(tenantId, logoBuffer, type) {
        const variants = {};
        const sizes = [
            { name: 'small', width: 100 },
            { name: 'medium', width: 200 },
            { name: 'large', width: 400 }
        ];

        for (const size of sizes) {
            try {
                const resizedBuffer = await sharp(logoBuffer)
                    .resize({ width: size.width, withoutEnlargement: true })
                    .png({ quality: 90 })
                    .toBuffer();

                const key = `logos/${tenantId}/${type}-logo-${size.name}.png`;
                await this.uploadToS3(key, resizedBuffer, 'image/png');

                variants[size.name] = `${this.cdnBase}/${key}`;
            } catch (error) {
                console.error(`Error generating ${size.name} variant:`, error);
            }
        }

        return variants;
    }

    async uploadFavicon(tenantId, faviconFile) {
        try {
            // Generate multiple favicon sizes
            const sizes = [16, 32, 48, 64, 128, 256];
            const favicons = {};

            for (const size of sizes) {
                const resizedBuffer = await sharp(faviconFile.buffer)
                    .resize(size, size)
                    .png()
                    .toBuffer();

                const key = `favicons/${tenantId}/favicon-${size}x${size}.png`;
                await this.uploadToS3(key, resizedBuffer, 'image/png');

                favicons[`${size}x${size}`] = `${this.cdnBase}/${key}`;
            }

            // Generate ICO file
            const icoBuffer = await sharp(faviconFile.buffer)
                .resize(32, 32)
                .png()
                .toBuffer();

            const icoKey = `favicons/${tenantId}/favicon.ico`;
            await this.uploadToS3(icoKey, icoBuffer, 'image/x-icon');
            favicons.ico = `${this.cdnBase}/${icoKey}`;

            console.log(`Favicons generated for tenant ${tenantId}`);
            return favicons;

        } catch (error) {
            console.error('Error uploading favicon:', error);
            throw error;
        }
    }

    /**
     * Custom CSS Management
     */
    async saveCustomCSS(tenantId, css) {
        try {
            // Validate CSS (basic security check)
            const sanitizedCSS = this.sanitizeCSS(css);

            // Save to S3
            const key = `custom-css/${tenantId}/custom.css`;
            await this.uploadToS3(key, sanitizedCSS, 'text/css');

            const cssUrl = `${this.cdnBase}/${key}`;

            console.log(`Custom CSS saved for tenant ${tenantId}`);
            return cssUrl;

        } catch (error) {
            console.error('Error saving custom CSS:', error);
            throw error;
        }
    }

    sanitizeCSS(css) {
        // Remove potentially dangerous CSS
        const dangerous = [
            /@import/gi,
            /javascript:/gi,
            /expression\(/gi,
            /behavior:/gi,
            /binding:/gi,
            /-moz-binding/gi
        ];

        let sanitized = css;
        dangerous.forEach(pattern => {
            sanitized = sanitized.replace(pattern, '');
        });

        return sanitized;
    }

    /**
     * Email Template Customization
     */
    async createEmailTemplate(tenantId, templateType, templateData) {
        try {
            const template = {
                type: templateType,
                subject: templateData.subject,
                htmlBody: templateData.htmlBody,
                textBody: templateData.textBody,
                variables: templateData.variables || [],
                styles: {
                    primaryColor: templateData.primaryColor,
                    secondaryColor: templateData.secondaryColor,
                    fontFamily: templateData.fontFamily,
                    logoUrl: templateData.logoUrl
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Process template with branding
            const processedTemplate = await this.processEmailTemplate(tenantId, template);

            // Save template
            const key = `email-templates/${tenantId}/${templateType}.json`;
            await this.uploadToS3(key, JSON.stringify(processedTemplate, null, 2), 'application/json');

            console.log(`Email template ${templateType} created for tenant ${tenantId}`);
            return processedTemplate;

        } catch (error) {
            console.error('Error creating email template:', error);
            throw error;
        }
    }

    async processEmailTemplate(tenantId, template) {
        // Add tenant branding to email template
        const brandedTemplate = {
            ...template,
            htmlBody: template.htmlBody.replace(/{{LOGO_URL}}/g, template.styles.logoUrl || '')
                                     .replace(/{{PRIMARY_COLOR}}/g, template.styles.primaryColor || '#1976d2')
                                     .replace(/{{SECONDARY_COLOR}}/g, template.styles.secondaryColor || '#424242')
                                     .replace(/{{FONT_FAMILY}}/g, template.styles.fontFamily || 'Arial, sans-serif')
        };

        return brandedTemplate;
    }

    /**
     * Footer and Header Customization
     */
    async updateCustomContent(tenantId, contentType, content) {
        try {
            const customContent = {
                type: contentType,
                content: content,
                updatedAt: new Date()
            };

            const key = `custom-content/${tenantId}/${contentType}.json`;
            await this.uploadToS3(key, JSON.stringify(customContent, null, 2), 'application/json');

            console.log(`Custom ${contentType} updated for tenant ${tenantId}`);
            return customContent;

        } catch (error) {
            console.error(`Error updating custom ${contentType}:`, error);
            throw error;
        }
    }

    /**
     * Utility Methods
     */
    async uploadToS3(key, data, contentType) {
        const params = {
            Bucket: this.bucket,
            Key: key,
            Body: data,
            ContentType: contentType,
            CacheControl: 'public, max-age=31536000', // 1 year cache
            ACL: 'public-read'
        };

        await this.s3.upload(params).promise();
    }

    getFileExtension(mimetype) {
        const extensions = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/svg+xml': 'svg',
            'image/x-icon': 'ico'
        };
        return extensions[mimetype] || 'bin';
    }

    getDefaultTheme() {
        return {
            colors: {
                primary: '#1976d2',
                secondary: '#424242',
                accent: '#ff4081',
                background: '#fafafa',
                surface: '#ffffff',
                text: {
                    primary: '#212121',
                    secondary: '#757575',
                    disabled: '#bdbdbd'
                },
                success: '#4caf50',
                warning: '#ff9800',
                error: '#f44336',
                info: '#2196f3'
            },
            typography: {
                fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif'
            }
        };
    }

    /**
     * Theme Validation
     */
    validateTheme(theme) {
        const required = ['colors', 'typography'];
        const missing = required.filter(field => !theme[field]);

        if (missing.length > 0) {
            throw new Error(`Missing required theme fields: ${missing.join(', ')}`);
        }

        // Validate color formats
        if (theme.colors) {
            const colorFields = ['primary', 'secondary', 'background', 'surface'];
            for (const field of colorFields) {
                if (theme.colors[field] && !this.isValidColor(theme.colors[field])) {
                    throw new Error(`Invalid color format for ${field}: ${theme.colors[field]}`);
                }
            }
        }

        return true;
    }

    isValidColor(color) {
        // Basic color validation (hex, rgb, rgba, hsl, hsla)
        const colorRegex = /^(#[0-9A-Fa-f]{3,8}|rgb\(.*\)|rgba\(.*\)|hsl\(.*\)|hsla\(.*\))$/;
        return colorRegex.test(color);
    }
}

module.exports = BrandingSystem;