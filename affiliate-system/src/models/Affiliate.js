const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

class Affiliate {
  constructor(data = {}) {
    Object.assign(this, data);
  }

  /**
   * Create a new affiliate account
   */
  static async create(affiliateData) {
    const {
      email,
      password,
      firstName,
      lastName,
      companyName,
      website,
      phone,
      bio,
      socialMediaLinks = {},
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country = 'US',
      taxId,
      taxClassification = 'individual'
    } = affiliateData;

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate unique affiliate code
    const affiliateCode = await this.generateUniqueAffiliateCode();

    // Generate API key
    const apiKey = this.generateAPIKey();

    const affiliate = await db('affiliates')
      .insert({
        email: email.toLowerCase(),
        password_hash: passwordHash,
        first_name: firstName,
        last_name: lastName,
        company_name: companyName,
        website,
        phone,
        bio,
        social_media_links: JSON.stringify(socialMediaLinks),
        address_line1: addressLine1,
        address_line2: addressLine2,
        city,
        state,
        postal_code: postalCode,
        country,
        tax_id: taxId,
        tax_classification: taxClassification,
        affiliate_code: affiliateCode,
        api_key: apiKey,
        status: 'pending',
        terms_accepted: true,
        terms_accepted_at: new Date(),
        terms_version: '1.0'
      })
      .returning('*');

    return new Affiliate(affiliate[0]);
  }

  /**
   * Find affiliate by ID
   */
  static async findById(id) {
    const affiliate = await db('affiliates')
      .where({ id, deleted_at: null })
      .first();

    return affiliate ? new Affiliate(affiliate) : null;
  }

  /**
   * Find affiliate by email
   */
  static async findByEmail(email) {
    const affiliate = await db('affiliates')
      .where({ email: email.toLowerCase(), deleted_at: null })
      .first();

    return affiliate ? new Affiliate(affiliate) : null;
  }

  /**
   * Find affiliate by affiliate code
   */
  static async findByAffiliateCode(code) {
    const affiliate = await db('affiliates')
      .where({ affiliate_code: code, deleted_at: null })
      .first();

    return affiliate ? new Affiliate(affiliate) : null;
  }

  /**
   * Find affiliate by API key
   */
  static async findByAPIKey(apiKey) {
    const affiliate = await db('affiliates')
      .where({ api_key: apiKey, deleted_at: null })
      .first();

    return affiliate ? new Affiliate(affiliate) : null;
  }

  /**
   * Authenticate affiliate
   */
  static async authenticate(email, password) {
    const affiliate = await this.findByEmail(email);
    if (!affiliate) {
      return null;
    }

    const isValidPassword = await bcrypt.compare(password, affiliate.password_hash);
    if (!isValidPassword) {
      return null;
    }

    // Update last login
    await affiliate.updateLastLogin();

    return affiliate;
  }

  /**
   * Get all affiliates with filtering and pagination
   */
  static async getAll(filters = {}, pagination = {}) {
    const {
      status,
      performanceTier,
      country,
      search,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = filters;

    const {
      page = 1,
      limit = 50
    } = pagination;

    let query = db('affiliates')
      .where({ deleted_at: null });

    // Apply filters
    if (status) {
      query = query.where('status', status);
    }

    if (performanceTier) {
      query = query.where('performance_tier', performanceTier);
    }

    if (country) {
      query = query.where('country', country);
    }

    if (search) {
      query = query.where(builder => {
        builder
          .where('first_name', 'ilike', `%${search}%`)
          .orWhere('last_name', 'ilike', `%${search}%`)
          .orWhere('email', 'ilike', `%${search}%`)
          .orWhere('company_name', 'ilike', `%${search}%`);
      });
    }

    // Get total count
    const totalQuery = query.clone();
    const total = await totalQuery.count('* as count').first();

    // Apply sorting and pagination
    const affiliates = await query
      .orderBy(sortBy, sortOrder)
      .limit(limit)
      .offset((page - 1) * limit);

    return {
      affiliates: affiliates.map(affiliate => new Affiliate(affiliate)),
      pagination: {
        page,
        limit,
        total: parseInt(total.count),
        pages: Math.ceil(total.count / limit)
      }
    };
  }

  /**
   * Update affiliate profile
   */
  async update(updateData) {
    const allowedFields = [
      'first_name', 'last_name', 'company_name', 'website', 'phone',
      'bio', 'social_media_links', 'address_line1', 'address_line2',
      'city', 'state', 'postal_code', 'country', 'payment_methods',
      'payment_threshold', 'metadata'
    ];

    const filteredData = {};
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredData[key] = updateData[key];
      }
    });

    if (filteredData.social_media_links) {
      filteredData.social_media_links = JSON.stringify(filteredData.social_media_links);
    }

    if (filteredData.payment_methods) {
      filteredData.payment_methods = JSON.stringify(filteredData.payment_methods);
    }

    if (filteredData.metadata) {
      filteredData.metadata = JSON.stringify(filteredData.metadata);
    }

    filteredData.updated_at = new Date();

    await db('affiliates')
      .where({ id: this.id })
      .update(filteredData);

    Object.assign(this, filteredData);
    return this;
  }

  /**
   * Update affiliate status
   */
  async updateStatus(status, reason = null, approvedBy = null) {
    const updateData = {
      status,
      updated_at: new Date()
    };

    if (status === 'approved' && this.status !== 'approved') {
      updateData.approved_at = new Date();
      updateData.approved_by = approvedBy;
    }

    if (status === 'rejected' && reason) {
      updateData.rejection_reason = reason;
    }

    await db('affiliates')
      .where({ id: this.id })
      .update(updateData);

    Object.assign(this, updateData);
    return this;
  }

  /**
   * Update last login information
   */
  async updateLastLogin(ipAddress = null) {
    const updateData = {
      last_login_at: new Date(),
      updated_at: new Date()
    };

    if (ipAddress) {
      updateData.last_login_ip = ipAddress;
    }

    await db('affiliates')
      .where({ id: this.id })
      .update(updateData);

    Object.assign(this, updateData);
    return this;
  }

  /**
   * Update performance metrics
   */
  async updatePerformanceMetrics(metrics) {
    const {
      totalClicks,
      totalConversions,
      lifetimeEarnings
    } = metrics;

    const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) : 0;
    const newTier = this.calculatePerformanceTier(lifetimeEarnings, conversionRate);

    const updateData = {
      total_clicks: totalClicks,
      total_conversions: totalConversions,
      lifetime_earnings: lifetimeEarnings,
      conversion_rate: conversionRate,
      performance_tier: newTier,
      updated_at: new Date()
    };

    await db('affiliates')
      .where({ id: this.id })
      .update(updateData);

    Object.assign(this, updateData);
    return this;
  }

  /**
   * Calculate performance tier based on metrics
   */
  calculatePerformanceTier(lifetimeEarnings, conversionRate) {
    if (lifetimeEarnings >= 10000 && conversionRate >= 0.05) {
      return 5; // Elite
    } else if (lifetimeEarnings >= 5000 && conversionRate >= 0.03) {
      return 4; // Gold
    } else if (lifetimeEarnings >= 1000 && conversionRate >= 0.02) {
      return 3; // Silver
    } else if (lifetimeEarnings >= 100 && conversionRate >= 0.01) {
      return 2; // Bronze
    }
    return 1; // Starter
  }

  /**
   * Generate unique affiliate code
   */
  static async generateUniqueAffiliateCode() {
    let code;
    let exists = true;

    while (exists) {
      code = crypto.randomBytes(4).toString('hex').toUpperCase();
      const existing = await db('affiliates')
        .where('affiliate_code', code)
        .first();
      exists = !!existing;
    }

    return code;
  }

  /**
   * Generate API key
   */
  static generateAPIKey() {
    return `ak_${crypto.randomBytes(32).toString('hex')}`;
  }

  /**
   * Soft delete affiliate
   */
  async delete() {
    await db('affiliates')
      .where({ id: this.id })
      .update({
        deleted_at: new Date(),
        status: 'terminated'
      });

    this.deleted_at = new Date();
    this.status = 'terminated';
    return this;
  }

  /**
   * Get affiliate statistics
   */
  async getStatistics(dateRange = {}) {
    const { startDate, endDate } = dateRange;

    let clickQuery = db('click_tracking')
      .where('affiliate_id', this.id);

    let commissionQuery = db('commissions')
      .where('affiliate_id', this.id);

    if (startDate) {
      clickQuery = clickQuery.where('clicked_at', '>=', startDate);
      commissionQuery = commissionQuery.where('created_at', '>=', startDate);
    }

    if (endDate) {
      clickQuery = clickQuery.where('clicked_at', '<=', endDate);
      commissionQuery = commissionQuery.where('created_at', '<=', endDate);
    }

    const [
      totalClicks,
      uniqueClicks,
      conversions,
      pendingCommissions,
      paidCommissions
    ] = await Promise.all([
      clickQuery.clone().count('* as count').first(),
      clickQuery.clone().countDistinct('visitor_id as count').first(),
      clickQuery.clone().where('converted', true).count('* as count').first(),
      commissionQuery.clone().where('status', 'pending').sum('commission_amount as total').first(),
      commissionQuery.clone().where('status', 'paid').sum('commission_amount as total').first()
    ]);

    return {
      totalClicks: parseInt(totalClicks.count) || 0,
      uniqueClicks: parseInt(uniqueClicks.count) || 0,
      conversions: parseInt(conversions.count) || 0,
      conversionRate: totalClicks.count > 0 ? (conversions.count / totalClicks.count) : 0,
      pendingEarnings: parseFloat(pendingCommissions.total) || 0,
      paidEarnings: parseFloat(paidCommissions.total) || 0,
      totalEarnings: (parseFloat(pendingCommissions.total) || 0) + (parseFloat(paidCommissions.total) || 0)
    };
  }

  /**
   * Convert to JSON (remove sensitive data)
   */
  toJSON() {
    const {
      password_hash,
      api_key,
      login_sessions,
      ...publicData
    } = this;

    return {
      ...publicData,
      socialMediaLinks: typeof this.social_media_links === 'string'
        ? JSON.parse(this.social_media_links)
        : this.social_media_links,
      paymentMethods: typeof this.payment_methods === 'string'
        ? JSON.parse(this.payment_methods)
        : this.payment_methods,
      metadata: typeof this.metadata === 'string'
        ? JSON.parse(this.metadata)
        : this.metadata
    };
  }
}

module.exports = Affiliate;