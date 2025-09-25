const crypto = require('crypto');
const db = require('../config/database');

class ComplianceService {
  constructor() {
    this.ftcRequirements = {
      // FTC disclosure requirements
      disclosureText: {
        short: '#ad',
        medium: 'Affiliate link',
        full: 'This post contains affiliate links. I may earn a commission if you make a purchase through these links at no additional cost to you.'
      },

      // Required disclosure placements
      placementRules: {
        socialMedia: 'beginning_of_post',
        email: 'near_links',
        blog: 'above_fold',
        video: 'beginning_and_description'
      },

      // Compliance monitoring rules
      monitoringRules: {
        disclosurePresent: true,
        disclosureClear: true,
        disclosureProximate: true,
        materialConnectionDisclosed: true
      }
    };

    this.gdprRequirements = {
      // GDPR compliance for EU affiliates
      dataProcessingBasis: 'legitimate_interest',
      retentionPeriod: '7_years',
      userRights: ['access', 'rectification', 'erasure', 'portability', 'restriction'],
      cookieConsent: true
    };

    this.auditTrail = {
      trackingEnabled: true,
      retentionPeriod: 90 * 24 * 60 * 60 * 1000, // 90 days
      requiredEvents: [
        'affiliate_registration',
        'link_creation',
        'click_tracking',
        'conversion_tracking',
        'payment_processing',
        'data_access',
        'data_modification'
      ]
    };
  }

  /**
   * Validate affiliate content for compliance
   */
  async validateContent(contentData) {
    const {
      content,
      type, // 'social_post', 'blog_post', 'email', 'video'
      affiliateId,
      targetAudience = 'general',
      jurisdiction = 'US'
    } = contentData;

    const validationResults = {
      isCompliant: true,
      violations: [],
      warnings: [],
      recommendations: [],
      disclosureStatus: {}
    };

    try {
      // Check FTC disclosure requirements
      const ftcValidation = await this.validateFTCCompliance(content, type);
      validationResults.disclosureStatus = ftcValidation;

      if (!ftcValidation.isCompliant) {
        validationResults.isCompliant = false;
        validationResults.violations.push(...ftcValidation.violations);
      }

      // Check content guidelines
      const contentValidation = this.validateContentGuidelines(content, type);
      if (!contentValidation.isCompliant) {
        validationResults.warnings.push(...contentValidation.warnings);
      }

      // Check jurisdiction-specific requirements
      const jurisdictionValidation = await this.validateJurisdictionRequirements(
        content,
        jurisdiction,
        targetAudience
      );

      if (!jurisdictionValidation.isCompliant) {
        validationResults.violations.push(...jurisdictionValidation.violations);
        validationResults.isCompliant = false;
      }

      // Generate recommendations
      validationResults.recommendations = this.generateComplianceRecommendations(
        validationResults,
        type
      );

      // Log compliance check
      await this.logComplianceCheck({
        affiliateId,
        contentType: type,
        validationResults,
        content: content.substring(0, 500) // First 500 chars for audit
      });

      return validationResults;

    } catch (error) {
      console.error('Error validating content compliance:', error);
      throw error;
    }
  }

  /**
   * Validate FTC compliance
   */
  async validateFTCCompliance(content, type) {
    const validation = {
      isCompliant: true,
      violations: [],
      disclosureFound: false,
      disclosurePlacement: null,
      disclosureClarity: null
    };

    // Check if disclosure is present
    const disclosurePatterns = [
      /#ad\b/i,
      /#affiliate/i,
      /#sponsored/i,
      /affiliate link/i,
      /sponsored/i,
      /paid partnership/i,
      /commission/i,
      /\[ad\]/i
    ];

    const disclosureFound = disclosurePatterns.some(pattern => pattern.test(content));
    validation.disclosureFound = disclosureFound;

    if (!disclosureFound) {
      validation.isCompliant = false;
      validation.violations.push({
        type: 'missing_disclosure',
        severity: 'high',
        message: 'FTC requires clear disclosure of affiliate relationships',
        suggestion: 'Add disclosure such as "#ad", "affiliate link", or full disclosure statement'
      });
    } else {
      // Check disclosure placement
      const placementValidation = this.validateDisclosurePlacement(content, type);
      validation.disclosurePlacement = placementValidation;

      if (!placementValidation.isValid) {
        validation.violations.push({
          type: 'disclosure_placement',
          severity: 'medium',
          message: 'Disclosure should be prominently placed and easily noticeable',
          suggestion: placementValidation.suggestion
        });
      }

      // Check disclosure clarity
      const clarityValidation = this.validateDisclosureClarity(content);
      validation.disclosureClarity = clarityValidation;

      if (!clarityValidation.isValid) {
        validation.violations.push({
          type: 'disclosure_clarity',
          severity: 'medium',
          message: 'Disclosure should be clear and unambiguous',
          suggestion: clarityValidation.suggestion
        });
      }
    }

    return validation;
  }

  /**
   * Validate disclosure placement
   */
  validateDisclosurePlacement(content, type) {
    const contentLength = content.length;
    const disclosurePosition = this.findDisclosurePosition(content);

    const placementRules = {
      social_post: {
        maxPosition: 50, // Within first 50 characters
        message: 'Place disclosure at the beginning of social media posts'
      },
      email: {
        maxPosition: contentLength * 0.1, // Within first 10%
        message: 'Place disclosure near the beginning of email content'
      },
      blog_post: {
        maxPosition: 300, // Within first 300 characters
        message: 'Place disclosure above the fold in blog posts'
      },
      video: {
        maxPosition: 100, // Within first 100 characters of description
        message: 'Include disclosure at the beginning of video description'
      }
    };

    const rule = placementRules[type] || placementRules.blog_post;

    return {
      isValid: disclosurePosition <= rule.maxPosition,
      position: disclosurePosition,
      suggestion: rule.message
    };
  }

  /**
   * Validate disclosure clarity
   */
  validateDisclosureClarity(content) {
    // Check for clear, unambiguous disclosure
    const clearDisclosures = [
      /#ad\b/i,
      /affiliate link/i,
      /sponsored content/i,
      /paid partnership/i,
      /\[ad\]/i,
      /this post contains affiliate links/i
    ];

    const ambiguousPatterns = [
      /thanks to .+ for sponsoring/i,
      /in partnership with/i,
      /working with/i
    ];

    const hasClearDisclosure = clearDisclosures.some(pattern => pattern.test(content));
    const hasAmbiguousOnly = ambiguousPatterns.some(pattern => pattern.test(content)) && !hasClearDisclosure;

    return {
      isValid: hasClearDisclosure,
      hasClear: hasClearDisclosure,
      hasAmbiguous: hasAmbiguousOnly,
      suggestion: hasAmbiguousOnly
        ? 'Use clearer disclosure language like "#ad" or "affiliate link"'
        : 'Add clear disclosure of affiliate relationship'
    };
  }

  /**
   * Find disclosure position in content
   */
  findDisclosurePosition(content) {
    const disclosurePatterns = [
      /#ad\b/i,
      /#affiliate/i,
      /affiliate link/i,
      /sponsored/i,
      /\[ad\]/i
    ];

    for (const pattern of disclosurePatterns) {
      const match = content.match(pattern);
      if (match) {
        return match.index;
      }
    }

    return content.length; // No disclosure found
  }

  /**
   * Validate content guidelines
   */
  validateContentGuidelines(content, type) {
    const validation = {
      isCompliant: true,
      warnings: []
    };

    // Check for prohibited content
    const prohibitedPatterns = [
      /guaranteed income/i,
      /get rich quick/i,
      /no risk/i,
      /instant money/i,
      /100% guarantee/i
    ];

    for (const pattern of prohibitedPatterns) {
      if (pattern.test(content)) {
        validation.warnings.push({
          type: 'misleading_claims',
          message: 'Avoid making unrealistic income or guarantee claims',
          suggestion: 'Focus on factual benefits and realistic expectations'
        });
        break;
      }
    }

    // Check for required disclaimers
    if (content.includes('income') || content.includes('earn') || content.includes('money')) {
      if (!content.includes('results may vary') && !content.includes('not guaranteed')) {
        validation.warnings.push({
          type: 'missing_disclaimer',
          message: 'Income-related claims should include appropriate disclaimers',
          suggestion: 'Add disclaimer such as "Results may vary" or "Income not guaranteed"'
        });
      }
    }

    return validation;
  }

  /**
   * Validate jurisdiction-specific requirements
   */
  async validateJurisdictionRequirements(content, jurisdiction, targetAudience) {
    const validation = {
      isCompliant: true,
      violations: []
    };

    switch (jurisdiction) {
      case 'EU':
        // GDPR compliance checks
        if (content.includes('track') || content.includes('cookie')) {
          if (!content.includes('consent') && !content.includes('privacy policy')) {
            validation.violations.push({
              type: 'gdpr_violation',
              severity: 'high',
              message: 'GDPR requires explicit consent for tracking',
              suggestion: 'Include privacy policy link and consent mechanism'
            });
            validation.isCompliant = false;
          }
        }
        break;

      case 'CA':
        // Canadian requirements
        if (!content.includes('affiliate') && !content.includes('#ad')) {
          validation.violations.push({
            type: 'canadian_disclosure',
            severity: 'medium',
            message: 'Canadian regulations require clear affiliate disclosure',
            suggestion: 'Add clear affiliate relationship disclosure'
          });
        }
        break;

      case 'AU':
        // Australian requirements
        if (content.includes('medical') || content.includes('health')) {
          validation.violations.push({
            type: 'health_claims',
            severity: 'high',
            message: 'Health claims require specific disclaimers in Australia',
            suggestion: 'Add appropriate health disclaimer or remove health claims'
          });
          validation.isCompliant = false;
        }
        break;
    }

    return validation;
  }

  /**
   * Generate compliance recommendations
   */
  generateComplianceRecommendations(validationResults, type) {
    const recommendations = [];

    if (!validationResults.disclosureStatus.disclosureFound) {
      const typeSpecificDisclosure = this.getTypeSpecificDisclosure(type);
      recommendations.push({
        priority: 'high',
        category: 'disclosure',
        title: 'Add FTC-compliant disclosure',
        description: `Add clear disclosure of affiliate relationship: ${typeSpecificDisclosure}`,
        implementation: `Include "${typeSpecificDisclosure}" at the beginning of your content`
      });
    }

    if (validationResults.violations.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'compliance',
        title: 'Fix compliance violations',
        description: 'Address all compliance violations before publishing',
        implementation: 'Review and fix each violation listed in the compliance report'
      });
    }

    // Performance optimization recommendations
    recommendations.push({
      priority: 'medium',
      category: 'optimization',
      title: 'Optimize for conversions',
      description: 'Include clear value proposition and call-to-action',
      implementation: 'Add compelling benefits and clear next steps for readers'
    });

    return recommendations;
  }

  /**
   * Get type-specific disclosure text
   */
  getTypeSpecificDisclosure(type) {
    const disclosures = {
      social_post: '#ad',
      email: 'This email contains affiliate links.',
      blog_post: 'This post contains affiliate links. I may earn a commission if you make a purchase through these links at no additional cost to you.',
      video: '#ad - This video contains affiliate links.'
    };

    return disclosures[type] || disclosures.blog_post;
  }

  /**
   * Auto-add compliance disclosures
   */
  async autoAddDisclosures(content, type, placement = 'beginning') {
    const disclosure = this.getTypeSpecificDisclosure(type);

    switch (placement) {
      case 'beginning':
        return `${disclosure}\n\n${content}`;

      case 'end':
        return `${content}\n\n${disclosure}`;

      case 'near_links':
        // Find affiliate links and add disclosure nearby
        const linkPattern = /(https?:\/\/[^\s]+)/gi;
        return content.replace(linkPattern, `${disclosure} $1`);

      default:
        return `${disclosure}\n\n${content}`;
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(affiliateId, dateRange = {}) {
    const { startDate, endDate } = dateRange;

    try {
      // Get compliance checks
      let checksQuery = db('compliance_checks')
        .where('affiliate_id', affiliateId);

      if (startDate) {
        checksQuery = checksQuery.where('created_at', '>=', startDate);
      }

      if (endDate) {
        checksQuery = checksQuery.where('created_at', '<=', endDate);
      }

      const complianceChecks = await checksQuery.orderBy('created_at', 'desc');

      // Calculate compliance metrics
      const totalChecks = complianceChecks.length;
      const compliantChecks = complianceChecks.filter(check =>
        JSON.parse(check.validation_results).isCompliant
      ).length;

      const complianceRate = totalChecks > 0 ? (compliantChecks / totalChecks) * 100 : 0;

      // Get violation breakdown
      const violations = [];
      complianceChecks.forEach(check => {
        const results = JSON.parse(check.validation_results);
        violations.push(...(results.violations || []));
      });

      const violationCounts = violations.reduce((acc, violation) => {
        acc[violation.type] = (acc[violation.type] || 0) + 1;
        return acc;
      }, {});

      // Get audit trail
      const auditEvents = await db('audit_trail')
        .where('affiliate_id', affiliateId)
        .where('created_at', '>=', startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
        .where('created_at', '<=', endDate || new Date())
        .orderBy('created_at', 'desc')
        .limit(100);

      return {
        summary: {
          totalChecks,
          compliantChecks,
          complianceRate: Math.round(complianceRate * 100) / 100,
          violationCount: violations.length
        },
        violations: {
          breakdown: violationCounts,
          recent: violations.slice(0, 10)
        },
        auditTrail: auditEvents,
        recommendations: this.generateReportRecommendations(violationCounts, complianceRate)
      };

    } catch (error) {
      console.error('Error generating compliance report:', error);
      throw error;
    }
  }

  /**
   * Generate report recommendations
   */
  generateReportRecommendations(violationCounts, complianceRate) {
    const recommendations = [];

    if (complianceRate < 80) {
      recommendations.push({
        priority: 'high',
        title: 'Improve compliance rate',
        description: 'Your compliance rate is below 80%. Focus on adding proper disclosures.',
        action: 'Review content creation guidelines and use compliance tools'
      });
    }

    if (violationCounts.missing_disclosure > 0) {
      recommendations.push({
        priority: 'high',
        title: 'Add FTC disclosures',
        description: `${violationCounts.missing_disclosure} pieces of content missing required disclosures.`,
        action: 'Always include "#ad" or "affiliate link" in promotional content'
      });
    }

    if (violationCounts.disclosure_placement > 0) {
      recommendations.push({
        priority: 'medium',
        title: 'Improve disclosure placement',
        description: 'Place disclosures at the beginning of content for better visibility.',
        action: 'Move disclosures to the start of posts and emails'
      });
    }

    return recommendations;
  }

  /**
   * Log compliance check
   */
  async logComplianceCheck(checkData) {
    const {
      affiliateId,
      contentType,
      validationResults,
      content
    } = checkData;

    await db('compliance_checks').insert({
      affiliate_id: affiliateId,
      content_type: contentType,
      validation_results: JSON.stringify(validationResults),
      content_sample: content,
      is_compliant: validationResults.isCompliant,
      violation_count: validationResults.violations.length,
      created_at: new Date()
    });

    // Log to audit trail
    await this.logAuditEvent({
      affiliateId,
      eventType: 'compliance_check',
      eventData: {
        contentType,
        isCompliant: validationResults.isCompliant,
        violationCount: validationResults.violations.length
      }
    });
  }

  /**
   * Log audit event
   */
  async logAuditEvent(eventData) {
    const {
      affiliateId,
      eventType,
      eventData: data,
      ipAddress,
      userAgent
    } = eventData;

    await db('audit_trail').insert({
      affiliate_id: affiliateId,
      event_type: eventType,
      event_data: JSON.stringify(data),
      ip_address: ipAddress,
      user_agent: userAgent,
      created_at: new Date()
    });
  }

  /**
   * Get affiliate compliance status
   */
  async getAffiliateComplianceStatus(affiliateId) {
    try {
      // Get recent compliance checks
      const recentChecks = await db('compliance_checks')
        .where('affiliate_id', affiliateId)
        .where('created_at', '>=', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
        .orderBy('created_at', 'desc');

      const totalChecks = recentChecks.length;
      const compliantChecks = recentChecks.filter(check => check.is_compliant).length;
      const complianceRate = totalChecks > 0 ? (compliantChecks / totalChecks) * 100 : 100;

      // Determine compliance level
      let complianceLevel = 'excellent';
      if (complianceRate < 60) {
        complianceLevel = 'poor';
      } else if (complianceRate < 80) {
        complianceLevel = 'needs_improvement';
      } else if (complianceRate < 95) {
        complianceLevel = 'good';
      }

      // Get recent violations
      const recentViolations = recentChecks
        .filter(check => !check.is_compliant)
        .slice(0, 5)
        .map(check => ({
          date: check.created_at,
          contentType: check.content_type,
          violations: JSON.parse(check.validation_results).violations
        }));

      return {
        complianceRate: Math.round(complianceRate * 100) / 100,
        complianceLevel,
        totalChecks,
        compliantChecks,
        recentViolations,
        lastCheckDate: recentChecks.length > 0 ? recentChecks[0].created_at : null
      };

    } catch (error) {
      console.error('Error getting compliance status:', error);
      throw error;
    }
  }

  /**
   * Clean up old compliance data
   */
  async cleanupOldData(retentionDays = 365) {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    try {
      const [deletedChecks, deletedAudit] = await Promise.all([
        db('compliance_checks')
          .where('created_at', '<', cutoffDate)
          .del(),

        db('audit_trail')
          .where('created_at', '<', cutoffDate)
          .del()
      ]);

      console.log(`Cleaned up ${deletedChecks} compliance checks and ${deletedAudit} audit events`);

      return {
        deletedChecks,
        deletedAudit
      };

    } catch (error) {
      console.error('Error cleaning up compliance data:', error);
      throw error;
    }
  }
}

module.exports = ComplianceService;