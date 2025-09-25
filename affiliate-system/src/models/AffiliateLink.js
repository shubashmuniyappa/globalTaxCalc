const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

class AffiliateLink {
  constructor(data = {}) {
    Object.assign(this, data);
  }

  /**
   * Create a new affiliate link
   */
  static async create(linkData) {
    const {
      affiliateId,
      originalUrl,
      campaignName,
      campaignType = 'general',
      utmParameters = {},
      customParameters = {},
      targetProduct,
      targetAudience,
      placementLocation,
      expiresAt,
      clickLimit,
      conversionLimit,
      allowedDomains = [],
      requireUniqueClicks = true,
      clickVelocityLimit = 100
    } = linkData;

    // Generate unique link code
    const linkCode = await this.generateUniqueLinkCode();

    // Build tracking URL
    const trackingUrl = this.buildTrackingUrl(linkCode, originalUrl, utmParameters, customParameters);

    const link = await db('affiliate_links')
      .insert({
        affiliate_id: affiliateId,
        link_code: linkCode,
        original_url: originalUrl,
        tracking_url: trackingUrl,
        campaign_name: campaignName,
        campaign_type: campaignType,
        utm_parameters: JSON.stringify(utmParameters),
        custom_parameters: JSON.stringify(customParameters),
        target_product: targetProduct,
        target_audience: targetAudience,
        placement_location: placementLocation,
        expires_at: expiresAt,
        click_limit: clickLimit,
        conversion_limit: conversionLimit,
        allowed_domains: JSON.stringify(allowedDomains),
        require_unique_clicks: requireUniqueClicks,
        click_velocity_limit: clickVelocityLimit
      })
      .returning('*');

    return new AffiliateLink(link[0]);
  }

  /**
   * Find link by ID
   */
  static async findById(id) {
    const link = await db('affiliate_links')
      .where({ id, deleted_at: null })
      .first();

    return link ? new AffiliateLink(link) : null;
  }

  /**
   * Find link by link code
   */
  static async findByLinkCode(linkCode) {
    const link = await db('affiliate_links')
      .where({ link_code: linkCode, deleted_at: null })
      .first();

    return link ? new AffiliateLink(link) : null;
  }

  /**
   * Get links for affiliate with filtering
   */
  static async getByAffiliate(affiliateId, filters = {}, pagination = {}) {
    const {
      campaignType,
      isActive,
      search,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = filters;

    const {
      page = 1,
      limit = 50
    } = pagination;

    let query = db('affiliate_links')
      .where({ affiliate_id: affiliateId, deleted_at: null });

    // Apply filters
    if (campaignType) {
      query = query.where('campaign_type', campaignType);
    }

    if (typeof isActive === 'boolean') {
      query = query.where('is_active', isActive);
    }

    if (search) {
      query = query.where(builder => {
        builder
          .where('campaign_name', 'ilike', `%${search}%`)
          .orWhere('target_product', 'ilike', `%${search}%`)
          .orWhere('original_url', 'ilike', `%${search}%`);
      });
    }

    // Get total count
    const totalQuery = query.clone();
    const total = await totalQuery.count('* as count').first();

    // Apply sorting and pagination
    const links = await query
      .orderBy(sortBy, sortOrder)
      .limit(limit)
      .offset((page - 1) * limit);

    return {
      links: links.map(link => new AffiliateLink(link)),
      pagination: {
        page,
        limit,
        total: parseInt(total.count),
        pages: Math.ceil(total.count / limit)
      }
    };
  }

  /**
   * Update link
   */
  async update(updateData) {
    const allowedFields = [
      'campaign_name', 'campaign_type', 'utm_parameters', 'custom_parameters',
      'target_product', 'target_audience', 'placement_location', 'is_active',
      'expires_at', 'click_limit', 'conversion_limit', 'allowed_domains',
      'require_unique_clicks', 'click_velocity_limit'
    ];

    const filteredData = {};
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredData[key] = updateData[key];
      }
    });

    // Handle JSON fields
    ['utm_parameters', 'custom_parameters', 'allowed_domains'].forEach(field => {
      if (filteredData[field]) {
        filteredData[field] = JSON.stringify(filteredData[field]);
      }
    });

    // Rebuild tracking URL if parameters changed
    if (filteredData.utm_parameters || filteredData.custom_parameters) {
      const utmParams = filteredData.utm_parameters ?
        JSON.parse(filteredData.utm_parameters) :
        JSON.parse(this.utm_parameters || '{}');

      const customParams = filteredData.custom_parameters ?
        JSON.parse(filteredData.custom_parameters) :
        JSON.parse(this.custom_parameters || '{}');

      filteredData.tracking_url = AffiliateLink.buildTrackingUrl(
        this.link_code,
        this.original_url,
        utmParams,
        customParams
      );
    }

    filteredData.updated_at = new Date();

    await db('affiliate_links')
      .where({ id: this.id })
      .update(filteredData);

    Object.assign(this, filteredData);
    return this;
  }

  /**
   * Update performance metrics
   */
  async updateMetrics(metrics) {
    const {
      clicks,
      uniqueClicks,
      conversions,
      conversionValue,
      commissionEarned
    } = metrics;

    const updateData = {
      clicks: clicks || this.clicks,
      unique_clicks: uniqueClicks || this.unique_clicks,
      conversions: conversions || this.conversions,
      conversion_value: conversionValue || this.conversion_value,
      commission_earned: commissionEarned || this.commission_earned,
      updated_at: new Date()
    };

    await db('affiliate_links')
      .where({ id: this.id })
      .update(updateData);

    Object.assign(this, updateData);
    return this;
  }

  /**
   * Check if link is valid for tracking
   */
  isValidForTracking() {
    // Check if link is active
    if (!this.is_active) {
      return { valid: false, reason: 'Link is inactive' };
    }

    // Check expiration
    if (this.expires_at && new Date() > new Date(this.expires_at)) {
      return { valid: false, reason: 'Link has expired' };
    }

    // Check click limit
    if (this.click_limit && this.clicks >= this.click_limit) {
      return { valid: false, reason: 'Click limit reached' };
    }

    // Check conversion limit
    if (this.conversion_limit && this.conversion_value >= this.conversion_limit) {
      return { valid: false, reason: 'Conversion limit reached' };
    }

    return { valid: true };
  }

  /**
   * Generate unique link code
   */
  static async generateUniqueLinkCode() {
    let code;
    let exists = true;

    while (exists) {
      code = crypto.randomBytes(8).toString('base64url');
      const existing = await db('affiliate_links')
        .where('link_code', code)
        .first();
      exists = !!existing;
    }

    return code;
  }

  /**
   * Build tracking URL with parameters
   */
  static buildTrackingUrl(linkCode, originalUrl, utmParameters = {}, customParameters = {}) {
    const baseUrl = process.env.TRACKING_BASE_URL || 'https://track.globaltaxcalc.com';
    const trackingUrl = new URL(`${baseUrl}/click/${linkCode}`);

    // Add UTM parameters
    Object.entries(utmParameters).forEach(([key, value]) => {
      if (value) {
        trackingUrl.searchParams.set(`utm_${key}`, value);
      }
    });

    // Add custom parameters
    Object.entries(customParameters).forEach(([key, value]) => {
      if (value) {
        trackingUrl.searchParams.set(key, value);
      }
    });

    // Add original URL as redirect parameter
    trackingUrl.searchParams.set('redirect', encodeURIComponent(originalUrl));

    return trackingUrl.toString();
  }

  /**
   * Get link performance analytics
   */
  async getAnalytics(dateRange = {}) {
    const { startDate, endDate } = dateRange;

    let query = db('click_tracking')
      .where('link_id', this.id);

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
      countries,
      devices,
      referrers
    ] = await Promise.all([
      query.clone().count('* as count').first(),
      query.clone().countDistinct('visitor_id as count').first(),
      query.clone().where('converted', true).count('* as count').first(),
      query.clone().select('country').count('* as count').groupBy('country').orderBy('count', 'desc').limit(10),
      query.clone().select('device_type').count('* as count').groupBy('device_type').orderBy('count', 'desc'),
      query.clone().select('referer').count('* as count').groupBy('referer').orderBy('count', 'desc').limit(10)
    ]);

    const conversionRate = totalClicks.count > 0 ? (conversions.count / totalClicks.count) : 0;

    return {
      totalClicks: parseInt(totalClicks.count) || 0,
      uniqueClicks: parseInt(uniqueClicks.count) || 0,
      conversions: parseInt(conversions.count) || 0,
      conversionRate: conversionRate,
      topCountries: countries,
      deviceBreakdown: devices,
      topReferrers: referrers
    };
  }

  /**
   * Soft delete link
   */
  async delete() {
    await db('affiliate_links')
      .where({ id: this.id })
      .update({
        deleted_at: new Date(),
        is_active: false
      });

    this.deleted_at = new Date();
    this.is_active = false;
    return this;
  }

  /**
   * Convert to JSON
   */
  toJSON() {
    return {
      ...this,
      utmParameters: typeof this.utm_parameters === 'string'
        ? JSON.parse(this.utm_parameters)
        : this.utm_parameters,
      customParameters: typeof this.custom_parameters === 'string'
        ? JSON.parse(this.custom_parameters)
        : this.custom_parameters,
      allowedDomains: typeof this.allowed_domains === 'string'
        ? JSON.parse(this.allowed_domains)
        : this.allowed_domains
    };
  }
}

module.exports = AffiliateLink;