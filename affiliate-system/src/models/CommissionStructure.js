const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

class CommissionStructure {
  constructor(data = {}) {
    Object.assign(this, data);
  }

  /**
   * Create a new commission structure
   */
  static async create(structureData) {
    const {
      name,
      description,
      type = 'percentage',
      baseRate,
      fixedAmount,
      currency = 'USD',
      applicableProducts = [],
      excludedProducts = [],
      minimumOrderValue,
      maximumOrderValue,
      tierStructure = [],
      tierBased = false,
      effectiveFrom,
      effectiveUntil,
      cookieDurationDays = 30,
      recurringCommissions = false,
      recurringMonths,
      bonusStructure = {},
      volumeBonusThreshold,
      volumeBonusRate,
      geoRestrictions = [],
      trafficRestrictions = [],
      newCustomersOnly = false,
      excludeRefunds = true,
      isActive = true,
      isDefault = false,
      priority = 0
    } = structureData;

    // Validate structure data
    this.validateStructureData(structureData);

    const structure = await db('commission_structures')
      .insert({
        name,
        description,
        type,
        base_rate: baseRate,
        fixed_amount: fixedAmount,
        currency,
        applicable_products: JSON.stringify(applicableProducts),
        excluded_products: JSON.stringify(excludedProducts),
        minimum_order_value: minimumOrderValue,
        maximum_order_value: maximumOrderValue,
        tier_structure: JSON.stringify(tierStructure),
        tier_based: tierBased,
        effective_from: effectiveFrom,
        effective_until: effectiveUntil,
        cookie_duration_days: cookieDurationDays,
        recurring_commissions: recurringCommissions,
        recurring_months: recurringMonths,
        bonus_structure: JSON.stringify(bonusStructure),
        volume_bonus_threshold: volumeBonusThreshold,
        volume_bonus_rate: volumeBonusRate,
        geo_restrictions: JSON.stringify(geoRestrictions),
        traffic_restrictions: JSON.stringify(trafficRestrictions),
        new_customers_only: newCustomersOnly,
        exclude_refunds: excludeRefunds,
        is_active: isActive,
        is_default: isDefault,
        priority
      })
      .returning('*');

    // If this is set as default, unset other defaults
    if (isDefault) {
      await this.updateDefaultStructure(structure[0].id);
    }

    return new CommissionStructure(structure[0]);
  }

  /**
   * Find commission structure by ID
   */
  static async findById(id) {
    const structure = await db('commission_structures')
      .where({ id, deleted_at: null })
      .first();

    return structure ? new CommissionStructure(structure) : null;
  }

  /**
   * Get all commission structures with filtering
   */
  static async getAll(filters = {}, pagination = {}) {
    const {
      type,
      isActive,
      isDefault,
      search,
      sortBy = 'priority',
      sortOrder = 'desc'
    } = filters;

    const {
      page = 1,
      limit = 50
    } = pagination;

    let query = db('commission_structures')
      .where({ deleted_at: null });

    // Apply filters
    if (type) {
      query = query.where('type', type);
    }

    if (typeof isActive === 'boolean') {
      query = query.where('is_active', isActive);
    }

    if (typeof isDefault === 'boolean') {
      query = query.where('is_default', isDefault);
    }

    if (search) {
      query = query.where(builder => {
        builder
          .where('name', 'ilike', `%${search}%`)
          .orWhere('description', 'ilike', `%${search}%`);
      });
    }

    // Get total count
    const totalQuery = query.clone();
    const total = await totalQuery.count('* as count').first();

    // Apply sorting and pagination
    const structures = await query
      .orderBy(sortBy, sortOrder)
      .limit(limit)
      .offset((page - 1) * limit);

    return {
      structures: structures.map(structure => new CommissionStructure(structure)),
      pagination: {
        page,
        limit,
        total: parseInt(total.count),
        pages: Math.ceil(total.count / limit)
      }
    };
  }

  /**
   * Find applicable commission structure for criteria
   */
  static async findApplicable(criteria) {
    const {
      affiliateId,
      productId,
      productCategory,
      orderValue,
      currency = 'USD',
      customerCountry,
      trafficSource,
      isNewCustomer = false
    } = criteria;

    // Get affiliate performance tier
    const affiliate = await db('affiliates')
      .where({ id: affiliateId })
      .select('performance_tier', 'country')
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
      })
      .whereNot(builder => {
        builder.whereJsonSupersetOf('excluded_products', [productId]);
      });
    }

    // Filter by product category if specified
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

    // Filter by geographic restrictions
    if (customerCountry) {
      query = query.where(builder => {
        builder
          .whereJsonLength('geo_restrictions', 0)
          .orWhereJsonSupersetOf('geo_restrictions', [customerCountry]);
      });
    }

    // Filter by traffic restrictions
    if (trafficSource) {
      query = query.where(builder => {
        builder
          .whereJsonLength('traffic_restrictions', 0)
          .orWhereJsonSupersetOf('traffic_restrictions', [trafficSource]);
      });
    }

    // Filter by customer type
    query = query.where(builder => {
      builder
        .where('new_customers_only', false)
        .orWhere('new_customers_only', isNewCustomer);
    });

    const structures = await query.limit(10);

    // Return the highest priority applicable structure
    return structures.length > 0 ? new CommissionStructure(structures[0]) : null;
  }

  /**
   * Calculate commission amount
   */
  calculateCommission(orderValue, affiliatePerformanceTier = 1) {
    switch (this.type) {
      case 'percentage':
        return this.calculatePercentageCommission(orderValue, affiliatePerformanceTier);

      case 'fixed':
        return this.calculateFixedCommission(affiliatePerformanceTier);

      case 'tiered':
        return this.calculateTieredCommission(orderValue, affiliatePerformanceTier);

      case 'hybrid':
        return this.calculateHybridCommission(orderValue, affiliatePerformanceTier);

      default:
        return 0;
    }
  }

  /**
   * Calculate percentage-based commission
   */
  calculatePercentageCommission(orderValue, performanceTier) {
    let rate = this.base_rate;

    // Apply tier multiplier if tier-based
    if (this.tier_based && this.tier_structure) {
      const tierStructure = typeof this.tier_structure === 'string'
        ? JSON.parse(this.tier_structure)
        : this.tier_structure;

      const tierConfig = tierStructure.find(tier => tier.tier === performanceTier);
      if (tierConfig && tierConfig.multiplier) {
        rate = rate * tierConfig.multiplier;
      }
    }

    return orderValue * (rate / 100);
  }

  /**
   * Calculate fixed commission
   */
  calculateFixedCommission(performanceTier) {
    let amount = this.fixed_amount;

    // Apply tier multiplier if tier-based
    if (this.tier_based && this.tier_structure) {
      const tierStructure = typeof this.tier_structure === 'string'
        ? JSON.parse(this.tier_structure)
        : this.tier_structure;

      const tierConfig = tierStructure.find(tier => tier.tier === performanceTier);
      if (tierConfig && tierConfig.multiplier) {
        amount = amount * tierConfig.multiplier;
      }
    }

    return amount;
  }

  /**
   * Calculate tiered commission
   */
  calculateTieredCommission(orderValue, performanceTier) {
    const tierStructure = typeof this.tier_structure === 'string'
      ? JSON.parse(this.tier_structure)
      : this.tier_structure;

    if (!tierStructure || !Array.isArray(tierStructure)) {
      return 0;
    }

    // Sort tiers by threshold descending
    const sortedTiers = tierStructure.sort((a, b) => b.threshold - a.threshold);

    for (const tier of sortedTiers) {
      if (orderValue >= tier.threshold) {
        if (tier.type === 'percentage') {
          return orderValue * (tier.rate / 100);
        } else if (tier.type === 'fixed') {
          return tier.amount;
        }
      }
    }

    return 0;
  }

  /**
   * Calculate hybrid commission
   */
  calculateHybridCommission(orderValue, performanceTier) {
    const percentageAmount = this.calculatePercentageCommission(orderValue, performanceTier);
    const fixedAmount = this.calculateFixedCommission(performanceTier);

    return percentageAmount + fixedAmount;
  }

  /**
   * Calculate bonus commission
   */
  calculateBonus(totalVolume, conversionCount) {
    const bonusStructure = typeof this.bonus_structure === 'string'
      ? JSON.parse(this.bonus_structure)
      : this.bonus_structure;

    let bonus = 0;

    // Volume bonus
    if (this.volume_bonus_threshold && this.volume_bonus_rate && totalVolume >= this.volume_bonus_threshold) {
      bonus += totalVolume * (this.volume_bonus_rate / 100);
    }

    // Other bonus types from bonus structure
    if (bonusStructure && bonusStructure.types) {
      bonusStructure.types.forEach(bonusType => {
        switch (bonusType.type) {
          case 'conversion_milestone':
            if (conversionCount >= bonusType.threshold) {
              bonus += bonusType.amount;
            }
            break;

          case 'progressive_volume':
            if (totalVolume >= bonusType.threshold) {
              bonus += totalVolume * (bonusType.rate / 100);
            }
            break;
        }
      });
    }

    return bonus;
  }

  /**
   * Update commission structure
   */
  async update(updateData) {
    const allowedFields = [
      'name', 'description', 'type', 'base_rate', 'fixed_amount', 'currency',
      'applicable_products', 'excluded_products', 'minimum_order_value',
      'maximum_order_value', 'tier_structure', 'tier_based', 'effective_from',
      'effective_until', 'cookie_duration_days', 'recurring_commissions',
      'recurring_months', 'bonus_structure', 'volume_bonus_threshold',
      'volume_bonus_rate', 'geo_restrictions', 'traffic_restrictions',
      'new_customers_only', 'exclude_refunds', 'is_active', 'is_default', 'priority'
    ];

    const filteredData = {};
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredData[key] = updateData[key];
      }
    });

    // Handle JSON fields
    ['applicable_products', 'excluded_products', 'tier_structure', 'bonus_structure',
     'geo_restrictions', 'traffic_restrictions'].forEach(field => {
      if (filteredData[field]) {
        filteredData[field] = JSON.stringify(filteredData[field]);
      }
    });

    // Validate updated data
    CommissionStructure.validateStructureData(filteredData);

    filteredData.updated_at = new Date();

    await db('commission_structures')
      .where({ id: this.id })
      .update(filteredData);

    // If this is set as default, unset other defaults
    if (filteredData.is_default) {
      await CommissionStructure.updateDefaultStructure(this.id);
    }

    Object.assign(this, filteredData);
    return this;
  }

  /**
   * Validate commission structure data
   */
  static validateStructureData(data) {
    const { type, baseRate, fixedAmount, tierStructure, tierBased } = data;

    if (!['percentage', 'fixed', 'tiered', 'hybrid'].includes(type)) {
      throw new Error('Invalid commission type');
    }

    if (type === 'percentage' && (!baseRate || baseRate <= 0 || baseRate > 100)) {
      throw new Error('Invalid base rate for percentage commission');
    }

    if (type === 'fixed' && (!fixedAmount || fixedAmount <= 0)) {
      throw new Error('Invalid fixed amount for fixed commission');
    }

    if (type === 'tiered' && (!tierStructure || !Array.isArray(tierStructure) || tierStructure.length === 0)) {
      throw new Error('Invalid tier structure for tiered commission');
    }

    if (tierBased && (!tierStructure || !Array.isArray(tierStructure))) {
      throw new Error('Tier structure required for tier-based commission');
    }
  }

  /**
   * Update default structure (unset other defaults)
   */
  static async updateDefaultStructure(newDefaultId) {
    await db('commission_structures')
      .whereNot({ id: newDefaultId })
      .update({ is_default: false });
  }

  /**
   * Get commission statistics
   */
  async getStatistics(dateRange = {}) {
    const { startDate, endDate } = dateRange;

    let query = db('commissions')
      .where('commission_structure_id', this.id);

    if (startDate) {
      query = query.where('created_at', '>=', startDate);
    }

    if (endDate) {
      query = query.where('created_at', '<=', endDate);
    }

    const [
      totalCommissions,
      totalAmount,
      avgCommission,
      topAffiliates
    ] = await Promise.all([
      query.clone().count('* as count').first(),
      query.clone().sum('commission_amount as total').first(),
      query.clone().avg('commission_amount as avg').first(),
      query.clone()
        .select('affiliate_id')
        .sum('commission_amount as total')
        .count('* as count')
        .groupBy('affiliate_id')
        .orderBy('total', 'desc')
        .limit(10)
    ]);

    return {
      totalCommissions: parseInt(totalCommissions.count) || 0,
      totalAmount: parseFloat(totalAmount.total) || 0,
      averageCommission: parseFloat(avgCommission.avg) || 0,
      topAffiliates: topAffiliates
    };
  }

  /**
   * Soft delete commission structure
   */
  async delete() {
    // Check if structure is being used
    const activeCommissions = await db('commissions')
      .where('commission_structure_id', this.id)
      .where('status', 'pending')
      .count('* as count')
      .first();

    if (parseInt(activeCommissions.count) > 0) {
      throw new Error('Cannot delete commission structure with active commissions');
    }

    await db('commission_structures')
      .where({ id: this.id })
      .update({
        deleted_at: new Date(),
        is_active: false,
        is_default: false
      });

    this.deleted_at = new Date();
    this.is_active = false;
    this.is_default = false;
    return this;
  }

  /**
   * Convert to JSON
   */
  toJSON() {
    return {
      ...this,
      applicableProducts: typeof this.applicable_products === 'string'
        ? JSON.parse(this.applicable_products)
        : this.applicable_products,
      excludedProducts: typeof this.excluded_products === 'string'
        ? JSON.parse(this.excluded_products)
        : this.excluded_products,
      tierStructure: typeof this.tier_structure === 'string'
        ? JSON.parse(this.tier_structure)
        : this.tier_structure,
      bonusStructure: typeof this.bonus_structure === 'string'
        ? JSON.parse(this.bonus_structure)
        : this.bonus_structure,
      geoRestrictions: typeof this.geo_restrictions === 'string'
        ? JSON.parse(this.geo_restrictions)
        : this.geo_restrictions,
      trafficRestrictions: typeof this.traffic_restrictions === 'string'
        ? JSON.parse(this.traffic_restrictions)
        : this.traffic_restrictions
    };
  }
}

module.exports = CommissionStructure;