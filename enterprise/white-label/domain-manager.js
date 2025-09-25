/**
 * Custom Domain Manager
 * Handles custom domain setup, SSL certificates, and DNS management
 */

const AWS = require('aws-sdk');
const dns = require('dns').promises;
const crypto = require('crypto');

class DomainManager {
    constructor() {
        this.route53 = new AWS.Route53({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION || 'us-east-1'
        });

        this.acm = new AWS.ACM({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION || 'us-east-1'
        });

        this.cloudfront = new AWS.CloudFront({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION || 'us-east-1'
        });

        this.hostedZoneId = process.env.ROUTE53_HOSTED_ZONE_ID;
        this.cloudFrontDistributionId = process.env.CLOUDFRONT_DISTRIBUTION_ID;
        this.baseDomain = process.env.BASE_DOMAIN || 'globaltaxcalc.com';
    }

    /**
     * Custom Domain Setup
     */
    async setupCustomDomain(tenantId, domain, options = {}) {
        try {
            console.log(`Setting up custom domain ${domain} for tenant ${tenantId}`);

            // Validate domain
            await this.validateDomain(domain);

            // Check domain availability
            const isAvailable = await this.checkDomainAvailability(domain);
            if (!isAvailable) {
                throw new Error(`Domain ${domain} is already in use`);
            }

            // Request SSL certificate
            const certificate = await this.requestSSLCertificate(domain, tenantId);

            // Create DNS records
            await this.createDNSRecords(domain, tenantId);

            // Update CloudFront distribution
            await this.updateCloudFrontDistribution(domain, certificate.CertificateArn);

            // Create domain configuration
            const domainConfig = {
                tenantId: tenantId,
                domain: domain,
                status: 'pending_verification',
                certificateArn: certificate.CertificateArn,
                dnsRecords: await this.getDNSRecords(domain),
                cloudFrontDistribution: this.cloudFrontDistributionId,
                setupDate: new Date(),
                verificationToken: this.generateVerificationToken(),
                options: {
                    forcehttps: options.forceHttps !== false,
                    hsts: options.hsts !== false,
                    ...options
                }
            };

            // Save configuration
            await this.saveDomainConfig(domainConfig);

            // Start verification process
            const verification = await this.startDomainVerification(domainConfig);

            console.log(`Custom domain setup initiated for ${domain}`);

            return {
                domain: domain,
                status: 'pending_verification',
                verification: verification,
                certificate: certificate,
                estimatedSetupTime: '15-45 minutes'
            };

        } catch (error) {
            console.error('Error setting up custom domain:', error);
            throw error;
        }
    }

    async validateDomain(domain) {
        // Basic domain format validation
        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
        if (!domainRegex.test(domain)) {
            throw new Error('Invalid domain format');
        }

        // Check if domain is not a subdomain of our base domain
        if (domain.endsWith(this.baseDomain)) {
            throw new Error('Cannot use subdomain of base domain as custom domain');
        }

        // Check domain length
        if (domain.length > 253) {
            throw new Error('Domain name too long');
        }

        return true;
    }

    async checkDomainAvailability(domain) {
        try {
            // Check if domain is already configured
            const existingConfig = await this.getDomainConfig(domain);
            if (existingConfig) {
                return false;
            }

            // Try to resolve domain
            try {
                await dns.lookup(domain);
                // Domain exists, check if it points to our service
                const records = await dns.resolve(domain, 'CNAME');
                const pointsToUs = records.some(record =>
                    record.includes('cloudfront.net') ||
                    record.includes(this.baseDomain)
                );

                return pointsToUs;
            } catch (error) {
                // Domain doesn't resolve, it's available
                return true;
            }

        } catch (error) {
            console.error('Error checking domain availability:', error);
            return false;
        }
    }

    /**
     * SSL Certificate Management
     */
    async requestSSLCertificate(domain, tenantId) {
        try {
            const params = {
                DomainName: domain,
                SubjectAlternativeNames: [`www.${domain}`],
                ValidationMethod: 'DNS',
                Tags: [
                    {
                        Key: 'TenantId',
                        Value: tenantId
                    },
                    {
                        Key: 'Service',
                        Value: 'GlobalTaxCalc'
                    },
                    {
                        Key: 'Domain',
                        Value: domain
                    }
                ]
            };

            const result = await this.acm.requestCertificate(params).promise();

            console.log(`SSL certificate requested for ${domain}: ${result.CertificateArn}`);

            // Wait for certificate details
            await this.waitForCertificateDetails(result.CertificateArn);

            return {
                CertificateArn: result.CertificateArn,
                Domain: domain,
                Status: 'PENDING_VALIDATION'
            };

        } catch (error) {
            console.error('Error requesting SSL certificate:', error);
            throw error;
        }
    }

    async waitForCertificateDetails(certificateArn, maxAttempts = 10) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const result = await this.acm.describeCertificate({
                    CertificateArn: certificateArn
                }).promise();

                if (result.Certificate.DomainValidationOptions) {
                    return result.Certificate;
                }

                // Wait before next attempt
                await new Promise(resolve => setTimeout(resolve, 5000));
            } catch (error) {
                if (attempt === maxAttempts) {
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }

        throw new Error('Timeout waiting for certificate details');
    }

    async checkCertificateStatus(certificateArn) {
        try {
            const result = await this.acm.describeCertificate({
                CertificateArn: certificateArn
            }).promise();

            return {
                status: result.Certificate.Status,
                domainValidationOptions: result.Certificate.DomainValidationOptions,
                issuedAt: result.Certificate.IssuedAt,
                notAfter: result.Certificate.NotAfter
            };

        } catch (error) {
            console.error('Error checking certificate status:', error);
            throw error;
        }
    }

    /**
     * DNS Management
     */
    async createDNSRecords(domain, tenantId) {
        try {
            const records = [
                {
                    Name: domain,
                    Type: 'CNAME',
                    Value: `${tenantId}.${this.baseDomain}`,
                    TTL: 300
                },
                {
                    Name: `www.${domain}`,
                    Type: 'CNAME',
                    Value: domain,
                    TTL: 300
                }
            ];

            // Create verification record
            const verificationRecord = {
                Name: `_globaltaxcalc-verification.${domain}`,
                Type: 'TXT',
                Value: `"globaltaxcalc-verification=${this.generateVerificationToken()}"`,
                TTL: 300
            };

            records.push(verificationRecord);

            // Save DNS configuration
            await this.saveDNSConfig(domain, records);

            console.log(`DNS records configured for ${domain}`);
            return records;

        } catch (error) {
            console.error('Error creating DNS records:', error);
            throw error;
        }
    }

    async createRoute53Records(domain, records) {
        if (!this.hostedZoneId) {
            console.log('Route53 not configured, DNS records must be created manually');
            return records;
        }

        try {
            const changeSet = {
                HostedZoneId: this.hostedZoneId,
                ChangeBatch: {
                    Comment: `DNS records for custom domain ${domain}`,
                    Changes: records.map(record => ({
                        Action: 'CREATE',
                        ResourceRecordSet: {
                            Name: record.Name,
                            Type: record.Type,
                            TTL: record.TTL,
                            ResourceRecords: [{
                                Value: record.Value
                            }]
                        }
                    }))
                }
            };

            const result = await this.route53.changeResourceRecordSets(changeSet).promise();

            console.log(`Route53 records created for ${domain}: ${result.ChangeInfo.Id}`);
            return result;

        } catch (error) {
            console.error('Error creating Route53 records:', error);
            throw error;
        }
    }

    async getDNSRecords(domain) {
        try {
            const records = {};

            // Get A records
            try {
                const aRecords = await dns.resolve4(domain);
                records.A = aRecords;
            } catch (error) {
                records.A = [];
            }

            // Get CNAME records
            try {
                const cnameRecords = await dns.resolveCname(domain);
                records.CNAME = cnameRecords;
            } catch (error) {
                records.CNAME = [];
            }

            // Get TXT records
            try {
                const txtRecords = await dns.resolveTxt(domain);
                records.TXT = txtRecords.map(record => record.join(''));
            } catch (error) {
                records.TXT = [];
            }

            return records;

        } catch (error) {
            console.error('Error getting DNS records:', error);
            return {};
        }
    }

    /**
     * CloudFront Distribution Management
     */
    async updateCloudFrontDistribution(domain, certificateArn) {
        try {
            // Get current distribution config
            const distribution = await this.cloudfront.getDistribution({
                Id: this.cloudFrontDistributionId
            }).promise();

            const config = distribution.Distribution.DistributionConfig;

            // Add custom domain to aliases
            if (!config.Aliases.Items.includes(domain)) {
                config.Aliases.Items.push(domain);
                config.Aliases.Items.push(`www.${domain}`);
                config.Aliases.Quantity = config.Aliases.Items.length;
            }

            // Update SSL certificate
            config.ViewerCertificate = {
                ACMCertificateArn: certificateArn,
                SSLSupportMethod: 'sni-only',
                MinimumProtocolVersion: 'TLSv1.2_2021',
                CertificateSource: 'acm'
            };

            // Update distribution
            const updateParams = {
                Id: this.cloudFrontDistributionId,
                DistributionConfig: config,
                IfMatch: distribution.ETag
            };

            const result = await this.cloudfront.updateDistribution(updateParams).promise();

            console.log(`CloudFront distribution updated for ${domain}`);
            return result;

        } catch (error) {
            console.error('Error updating CloudFront distribution:', error);
            throw error;
        }
    }

    /**
     * Domain Verification
     */
    async startDomainVerification(domainConfig) {
        try {
            const verification = {
                domain: domainConfig.domain,
                method: 'dns',
                token: domainConfig.verificationToken,
                status: 'pending',
                steps: [
                    {
                        step: 1,
                        description: 'Create DNS records',
                        records: domainConfig.dnsRecords,
                        status: 'pending'
                    },
                    {
                        step: 2,
                        description: 'Verify domain ownership',
                        status: 'pending'
                    },
                    {
                        step: 3,
                        description: 'SSL certificate validation',
                        status: 'pending'
                    },
                    {
                        step: 4,
                        description: 'CloudFront distribution setup',
                        status: 'pending'
                    }
                ],
                estimatedCompletion: new Date(Date.now() + 45 * 60 * 1000) // 45 minutes
            };

            // Start verification process
            this.scheduleVerificationCheck(domainConfig.domain);

            return verification;

        } catch (error) {
            console.error('Error starting domain verification:', error);
            throw error;
        }
    }

    async verifyDomainOwnership(domain) {
        try {
            // Check for verification TXT record
            const txtRecords = await dns.resolveTxt(`_globaltaxcalc-verification.${domain}`);
            const verificationRecord = txtRecords.find(record =>
                record.join('').includes('globaltaxcalc-verification=')
            );

            if (verificationRecord) {
                const token = verificationRecord.join('').match(/globaltaxcalc-verification=([^"]+)/);
                if (token && token[1]) {
                    // Verify token matches
                    const domainConfig = await this.getDomainConfig(domain);
                    if (domainConfig && domainConfig.verificationToken === token[1]) {
                        await this.updateDomainStatus(domain, 'verified');
                        return true;
                    }
                }
            }

            return false;

        } catch (error) {
            console.error('Error verifying domain ownership:', error);
            return false;
        }
    }

    scheduleVerificationCheck(domain) {
        // Schedule periodic verification checks
        const checkInterval = setInterval(async () => {
            try {
                const verified = await this.verifyDomainOwnership(domain);
                if (verified) {
                    clearInterval(checkInterval);
                    await this.completeDomainSetup(domain);
                }
            } catch (error) {
                console.error('Verification check error:', error);
            }
        }, 60000); // Check every minute

        // Stop checking after 2 hours
        setTimeout(() => {
            clearInterval(checkInterval);
        }, 2 * 60 * 60 * 1000);
    }

    async completeDomainSetup(domain) {
        try {
            console.log(`Completing domain setup for ${domain}`);

            // Update domain status
            await this.updateDomainStatus(domain, 'active');

            // Invalidate CloudFront cache
            await this.invalidateCloudFrontCache(domain);

            // Send notification
            await this.sendDomainSetupNotification(domain);

            console.log(`Domain setup completed for ${domain}`);

        } catch (error) {
            console.error('Error completing domain setup:', error);
            throw error;
        }
    }

    /**
     * Utility Methods
     */
    generateVerificationToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    async invalidateCloudFrontCache(domain) {
        try {
            const params = {
                DistributionId: this.cloudFrontDistributionId,
                InvalidationBatch: {
                    Paths: {
                        Quantity: 1,
                        Items: ['/*']
                    },
                    CallerReference: `domain-setup-${domain}-${Date.now()}`
                }
            };

            const result = await this.cloudfront.createInvalidation(params).promise();
            console.log(`CloudFront cache invalidated for ${domain}`);
            return result;

        } catch (error) {
            console.error('Error invalidating CloudFront cache:', error);
            throw error;
        }
    }

    async sendDomainSetupNotification(domain) {
        try {
            // Send notification to tenant about domain setup completion
            console.log(`Domain setup notification sent for ${domain}`);
        } catch (error) {
            console.error('Error sending notification:', error);
        }
    }

    // Placeholder methods for database operations
    async saveDomainConfig(config) {
        console.log('Saving domain config:', config.domain);
    }

    async getDomainConfig(domain) {
        console.log('Getting domain config:', domain);
        return null;
    }

    async updateDomainStatus(domain, status) {
        console.log(`Updating domain ${domain} status to ${status}`);
    }

    async saveDNSConfig(domain, records) {
        console.log('Saving DNS config for:', domain);
    }
}

module.exports = DomainManager;