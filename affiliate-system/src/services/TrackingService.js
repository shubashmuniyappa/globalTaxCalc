const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');
const db = require('../config/database');
const FraudDetectionService = require('./FraudDetectionService');
const AttributionService = require('./AttributionService');

class TrackingService {
  constructor() {
    this.fraudDetection = new FraudDetectionService();
    this.attribution = new AttributionService();
  }

  /**
   * Process click tracking
   */
  async processClick(linkCode, requestData) {
    try {
      const {
        req,
        ipAddress,
        userAgent,
        referer,
        customData = {}
      } = requestData;

      // Find the affiliate link
      const link = await db('affiliate_links')
        .where({ link_code: linkCode, is_active: true, deleted_at: null })
        .first();

      if (!link) {
        throw new Error('Invalid or inactive affiliate link');
      }

      // Check if link is valid for tracking
      const linkValidation = this.validateLinkForTracking(link);
      if (!linkValidation.valid) {
        throw new Error(linkValidation.reason);
      }

      // Generate unique click ID
      const clickId = uuidv4();

      // Parse user agent
      const parser = new UAParser(userAgent);
      const uaResult = parser.getResult();

      // Get geographic information
      const geoData = geoip.lookup(ipAddress) || {};

      // Generate or retrieve visitor ID
      const visitorId = this.generateVisitorId(req, ipAddress, userAgent);

      // Check for fraud indicators
      const fraudAnalysis = await this.fraudDetection.analyzeClick({
        linkId: link.id,
        affiliateId: link.affiliate_id,
        ipAddress,
        userAgent,
        referer,
        visitorId,
        geoData
      });

      // Prepare click data
      const clickData = {
        id: clickId,
        affiliate_id: link.affiliate_id,
        link_id: link.id,
        click_id: clickId,
        visitor_id: visitorId,
        session_id: req.session?.id || uuidv4(),
        user_id: req.user?.id || null,
        ip_address: ipAddress,
        user_agent: userAgent,
        referer: referer || null,
        browser: uaResult.browser.name,
        browser_version: uaResult.browser.version,
        operating_system: uaResult.os.name,
        device_type: this.getDeviceType(uaResult),
        is_mobile: uaResult.device.type === 'mobile',
        is_bot: this.isBot(userAgent),
        country: geoData.country || null,
        region: geoData.region || null,
        city: geoData.city || null,
        latitude: geoData.ll ? geoData.ll[0] : null,
        longitude: geoData.ll ? geoData.ll[1] : null,
        timezone: geoData.timezone || null,
        attribution_model: 'last_click',
        is_suspicious: fraudAnalysis.isSuspicious,
        fraud_signals: JSON.stringify(fraudAnalysis.signals),
        fraud_score: fraudAnalysis.score,
        custom_data: JSON.stringify(customData),
        clicked_at: new Date()
      };

      // Check for attribution data
      const attributionData = await this.attribution.processClick({
        affiliateId: link.affiliate_id,
        linkId: link.id,
        visitorId,
        clickId
      });

      if (attributionData) {
        clickData.touchpoint_data = JSON.stringify(attributionData.touchpoints);
        clickData.days_since_first_click = attributionData.daysSinceFirstClick;
        clickData.total_touchpoints = attributionData.totalTouchpoints;
      }

      // Store click data
      await db('click_tracking').insert(clickData);

      // Update link metrics (atomic operation)
      await this.updateLinkMetrics(link.id, fraudAnalysis.isSuspicious);

      // Check click velocity for fraud prevention
      await this.checkClickVelocity(link.id, ipAddress);

      return {
        clickId,
        success: true,
        redirectUrl: link.original_url,
        fraudScore: fraudAnalysis.score,
        blocked: fraudAnalysis.isSuspicious && fraudAnalysis.shouldBlock
      };

    } catch (error) {
      console.error('Error processing click:', error);
      throw error;
    }
  }

  /**
   * Process conversion tracking
   */
  async processConversion(conversionData) {
    try {
      const {
        clickId,
        orderId,
        customerId,
        orderValue,
        currency = 'USD',
        productId,
        productName,
        productCategory,
        conversionType = 'purchase'
      } = conversionData;

      // Find the click record
      const click = await db('click_tracking')
        .where({ click_id: clickId })
        .first();

      if (!click) {
        throw new Error('Click not found');
      }

      // Check if already converted
      if (click.converted) {
        throw new Error('Conversion already recorded for this click');
      }

      // Validate conversion timing (not too old)
      const maxConversionDays = 90;
      const daysSinceClick = Math.floor((new Date() - new Date(click.clicked_at)) / (1000 * 60 * 60 * 24));

      if (daysSinceClick > maxConversionDays) {
        throw new Error('Conversion window expired');
      }

      // Fraud check for conversion
      const conversionFraudCheck = await this.fraudDetection.analyzeConversion({
        clickId,
        orderId,
        customerId,
        orderValue,
        timeSinceClick: daysSinceClick,
        ipAddress: click.ip_address
      });

      if (conversionFraudCheck.shouldBlock) {
        throw new Error('Conversion blocked due to fraud detection');
      }

      // Update click record with conversion data
      await db('click_tracking')
        .where({ click_id: clickId })
        .update({
          converted: true,
          converted_at: new Date(),
          conversion_value: orderValue,
          conversion_type: conversionType,
          time_on_site: null, // Will be calculated if available
          pages_viewed: null, // Will be calculated if available
          bounced: false,
          updated_at: new Date()
        });

      // Process commission calculation
      await this.processCommissionCalculation({
        affiliateId: click.affiliate_id,
        linkId: click.link_id,
        clickId,
        orderId,
        customerId,
        orderValue,
        currency,
        productId,
        productName,
        productCategory,
        conversionType,
        fraudScore: conversionFraudCheck.score
      });

      // Update link conversion metrics
      await this.updateLinkConversionMetrics(click.link_id, orderValue);

      return {
        success: true,
        conversionId: clickId,
        commissionCalculated: true
      };

    } catch (error) {
      console.error('Error processing conversion:', error);
      throw error;
    }
  }

  /**
   * Calculate and create commission
   */
  async processCommissionCalculation(conversionData) {
    const {
      affiliateId,
      linkId,
      clickId,
      orderId,
      customerId,
      orderValue,
      currency,
      productId,
      productName,
      productCategory,
      conversionType,
      fraudScore
    } = conversionData;

    // Find applicable commission structure
    const commissionStructure = await this.findApplicableCommissionStructure({
      affiliateId,
      productId,
      productCategory,
      orderValue,
      currency
    });

    if (!commissionStructure) {
      console.warn('No applicable commission structure found');
      return null;
    }

    // Calculate commission amount
    const commissionAmount = this.calculateCommissionAmount(
      orderValue,
      commissionStructure
    );

    // Create commission record
    const commission = await db('commissions').insert({
      affiliate_id: affiliateId,
      link_id: linkId,
      click_id: clickId,
      commission_structure_id: commissionStructure.id,
      transaction_id: `txn_${uuidv4()}`,
      order_id: orderId,
      customer_id: customerId,
      order_value: orderValue,
      currency,
      commission_rate: commissionStructure.base_rate,
      commission_amount: commissionAmount,
      commission_type: commissionStructure.type,
      calculation_method: 'automatic',
      product_id: productId,
      product_name: productName,
      product_category: productCategory,
      status: fraudScore > 0.7 ? 'pending' : 'approved',
      attribution_model: 'last_click',
      days_to_conversion: Math.floor((new Date() - new Date()) / (1000 * 60 * 60 * 24)),
      is_quality_traffic: fraudScore < 0.3,
      fraud_score: fraudScore,
      transaction_date: new Date()
    }).returning('*');

    return commission[0];
  }

  /**
   * Find applicable commission structure
   */
  async findApplicableCommissionStructure(criteria) {
    const {
      affiliateId,
      productId,
      productCategory,
      orderValue,
      currency
    } = criteria;

    // Get affiliate performance tier
    const affiliate = await db('affiliates')
      .where({ id: affiliateId })
      .select('performance_tier')
      .first();

    let query = db('commission_structures')
      .where({ is_active: true })
      .where('effective_from', '<=', new Date())
      .where(builder => {
        builder
          .whereNull('effective_until')
          .orWhere('effective_until', '>=', new Date());
      })
      .orderBy('priority', 'desc');

    // Filter by product if specified
    if (productId) {
      query = query.where(builder => {
        builder
          .whereJsonSupersetOf('applicable_products', [productId])
          .orWhereJsonLength('applicable_products', 0);
      });
    }

    // Filter by category if specified
    if (productCategory) {
      query = query.where(builder => {
        builder
          .whereJsonSupersetOf('applicable_products', [productCategory])
          .orWhereJsonLength('applicable_products', 0);
      });
    }

    // Filter by order value
    if (orderValue) {
      query = query.where(builder => {
        builder
          .where(subBuilder => {
            subBuilder
              .whereNull('minimum_order_value')
              .orWhere('minimum_order_value', '<=', orderValue);
          })
          .where(subBuilder => {
            subBuilder
              .whereNull('maximum_order_value')
              .orWhere('maximum_order_value', '>=', orderValue);
          });
      });
    }

    const structures = await query.limit(10);

    // Return the highest priority applicable structure
    return structures[0] || null;
  }

  /**
   * Calculate commission amount based on structure
   */
  calculateCommissionAmount(orderValue, structure) {
    switch (structure.type) {
      case 'percentage':
        return orderValue * (structure.base_rate / 100);

      case 'fixed':
        return structure.fixed_amount;

      case 'tiered':
        return this.calculateTieredCommission(orderValue, structure);

      case 'hybrid':
        const percentageAmount = orderValue * (structure.base_rate / 100);
        return percentageAmount + (structure.fixed_amount || 0);

      default:
        return 0;
    }
  }

  /**
   * Calculate tiered commission
   */
  calculateTieredCommission(orderValue, structure) {
    const tiers = structure.tier_structure || [];

    for (const tier of tiers.sort((a, b) => b.threshold - a.threshold)) {
      if (orderValue >= tier.threshold) {
        return tier.type === 'percentage'
          ? orderValue * (tier.rate / 100)
          : tier.amount;
      }
    }

    return 0;
  }

  /**
   * Validate link for tracking
   */
  validateLinkForTracking(link) {
    // Check if link is active
    if (!link.is_active) {
      return { valid: false, reason: 'Link is inactive' };
    }

    // Check expiration
    if (link.expires_at && new Date() > new Date(link.expires_at)) {
      return { valid: false, reason: 'Link has expired' };
    }

    // Check click limit
    if (link.click_limit && link.clicks >= link.click_limit) {
      return { valid: false, reason: 'Click limit reached' };
    }

    return { valid: true };
  }

  /**
   * Generate or retrieve visitor ID
   */
  generateVisitorId(req, ipAddress, userAgent) {
    // Try to get existing visitor ID from cookie
    if (req.cookies && req.cookies.visitor_id) {
      return req.cookies.visitor_id;
    }

    // Generate new visitor ID based on IP and user agent
    const hash = crypto.createHash('sha256');
    hash.update(ipAddress + userAgent + Date.now().toString());
    return hash.digest('hex').substring(0, 32);
  }

  /**
   * Get device type from user agent
   */
  getDeviceType(uaResult) {
    if (uaResult.device.type === 'mobile') return 'mobile';
    if (uaResult.device.type === 'tablet') return 'tablet';
    return 'desktop';
  }

  /**
   * Check if user agent is a bot
   */
  isBot(userAgent) {
    const botPatterns = [
      /bot/i, /crawler/i, /spider/i, /scraper/i,
      /googlebot/i, /bingbot/i, /slurp/i, /duckduckbot/i,
      /facebookexternalhit/i, /twitterbot/i, /linkedinbot/i
    ];

    return botPatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * Update link metrics atomically
   */
  async updateLinkMetrics(linkId, isSuspicious = false) {
    const incrementField = isSuspicious ? 'clicks' : 'clicks, unique_clicks';

    await db('affiliate_links')
      .where({ id: linkId })
      .increment('clicks', 1)
      .increment('unique_clicks', isSuspicious ? 0 : 1);
  }

  /**
   * Update link conversion metrics
   */
  async updateLinkConversionMetrics(linkId, conversionValue) {
    await db('affiliate_links')
      .where({ id: linkId })
      .increment('conversions', 1)
      .increment('conversion_value', conversionValue);
  }

  /**
   * Check click velocity for fraud prevention
   */
  async checkClickVelocity(linkId, ipAddress) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const recentClicks = await db('click_tracking')
      .where({
        link_id: linkId,
        ip_address: ipAddress
      })
      .where('clicked_at', '>=', oneHourAgo)
      .count('* as count')
      .first();

    const link = await db('affiliate_links')
      .where({ id: linkId })
      .select('click_velocity_limit')
      .first();

    if (parseInt(recentClicks.count) > (link.click_velocity_limit || 100)) {
      // Block IP temporarily
      await this.fraudDetection.blockIpTemporarily(ipAddress, linkId);
      throw new Error('Click velocity limit exceeded');
    }
  }

  /**
   * Get tracking analytics for affiliate
   */
  async getTrackingAnalytics(affiliateId, dateRange = {}) {
    const { startDate, endDate } = dateRange;

    let query = db('click_tracking')
      .where('affiliate_id', affiliateId);

    if (startDate) {
      query = query.where('clicked_at', '>=', startDate);
    }

    if (endDate) {
      query = query.where('clicked_at', '<=', endDate);
    }

    const [
      totalClicks,
      uniqueClicks,
      conversions,
      suspiciousClicks,
      avgFraudScore,
      topCountries,
      deviceStats,
      hourlyStats
    ] = await Promise.all([
      query.clone().count('* as count').first(),
      query.clone().countDistinct('visitor_id as count').first(),
      query.clone().where('converted', true).count('* as count').first(),
      query.clone().where('is_suspicious', true).count('* as count').first(),
      query.clone().avg('fraud_score as score').first(),
      query.clone().select('country').count('* as count').groupBy('country').orderBy('count', 'desc').limit(5),
      query.clone().select('device_type').count('* as count').groupBy('device_type'),
      query.clone()
        .select(db.raw('EXTRACT(hour from clicked_at) as hour'))
        .count('* as count')
        .groupBy(db.raw('EXTRACT(hour from clicked_at)'))
        .orderBy('hour')
    ]);

    return {
      totalClicks: parseInt(totalClicks.count) || 0,
      uniqueClicks: parseInt(uniqueClicks.count) || 0,
      conversions: parseInt(conversions.count) || 0,
      conversionRate: totalClicks.count > 0 ? (conversions.count / totalClicks.count) : 0,
      suspiciousClicks: parseInt(suspiciousClicks.count) || 0,
      fraudRate: totalClicks.count > 0 ? (suspiciousClicks.count / totalClicks.count) : 0,
      avgFraudScore: parseFloat(avgFraudScore.score) || 0,
      topCountries: topCountries,
      deviceStats: deviceStats,
      hourlyStats: hourlyStats
    };
  }
}

module.exports = TrackingService;