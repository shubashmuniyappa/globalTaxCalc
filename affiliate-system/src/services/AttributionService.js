const crypto = require('crypto');
const db = require('../config/database');

class AttributionService {
  constructor() {
    this.attributionModels = {
      'first_click': this.firstClickAttribution.bind(this),
      'last_click': this.lastClickAttribution.bind(this),
      'linear': this.linearAttribution.bind(this),
      'time_decay': this.timeDecayAttribution.bind(this),
      'position_based': this.positionBasedAttribution.bind(this)
    };

    this.cookieDuration = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
  }

  /**
   * Process click for attribution tracking
   */
  async processClick(clickData) {
    const {
      affiliateId,
      linkId,
      visitorId,
      clickId
    } = clickData;

    try {
      // Get existing touchpoints for this visitor
      const existingTouchpoints = await this.getVisitorTouchpoints(visitorId);

      // Create new touchpoint
      const touchpoint = {
        clickId,
        affiliateId,
        linkId,
        timestamp: new Date(),
        visitorId
      };

      // Store touchpoint
      await this.storeTouchpoint(touchpoint);

      // Calculate attribution data
      const attributionData = this.calculateAttributionData(existingTouchpoints, touchpoint);

      return attributionData;

    } catch (error) {
      console.error('Error processing attribution click:', error);
      return null;
    }
  }

  /**
   * Get visitor touchpoints within attribution window
   */
  async getVisitorTouchpoints(visitorId) {
    const attributionWindow = new Date(Date.now() - this.cookieDuration);

    const touchpoints = await db('attribution_touchpoints')
      .where('visitor_id', visitorId)
      .where('timestamp', '>=', attributionWindow)
      .orderBy('timestamp', 'asc');

    return touchpoints;
  }

  /**
   * Store attribution touchpoint
   */
  async storeTouchpoint(touchpoint) {
    await db('attribution_touchpoints')
      .insert({
        click_id: touchpoint.clickId,
        affiliate_id: touchpoint.affiliateId,
        link_id: touchpoint.linkId,
        visitor_id: touchpoint.visitorId,
        timestamp: touchpoint.timestamp
      });
  }

  /**
   * Calculate attribution data
   */
  calculateAttributionData(existingTouchpoints, newTouchpoint) {
    const allTouchpoints = [...existingTouchpoints, newTouchpoint];

    const firstTouchpoint = allTouchpoints[0];
    const daysSinceFirstClick = Math.floor(
      (newTouchpoint.timestamp - new Date(firstTouchpoint.timestamp)) / (1000 * 60 * 60 * 24)
    );

    return {
      touchpoints: allTouchpoints,
      totalTouchpoints: allTouchpoints.length,
      daysSinceFirstClick,
      firstClickAffiliate: firstTouchpoint.affiliateId,
      lastClickAffiliate: newTouchpoint.affiliateId
    };
  }

  /**
   * Process conversion attribution
   */
  async processConversion(conversionData) {
    const {
      clickId,
      orderId,
      orderValue,
      conversionType = 'purchase'
    } = conversionData;

    try {
      // Get the click that led to conversion
      const convertingClick = await db('click_tracking')
        .where('click_id', clickId)
        .first();

      if (!convertingClick) {
        throw new Error('Converting click not found');
      }

      // Get all touchpoints for this visitor
      const touchpoints = await this.getVisitorTouchpoints(convertingClick.visitor_id);

      // Calculate attribution for each model
      const attributions = {};
      for (const [model, calculator] of Object.entries(this.attributionModels)) {
        attributions[model] = calculator(touchpoints, orderValue);
      }

      // Store attribution results
      await this.storeAttributionResults({
        clickId,
        orderId,
        orderValue,
        conversionType,
        touchpoints,
        attributions
      });

      return attributions;

    } catch (error) {
      console.error('Error processing conversion attribution:', error);
      throw error;
    }
  }

  /**
   * First-click attribution model
   */
  firstClickAttribution(touchpoints, orderValue) {
    if (touchpoints.length === 0) return {};

    const firstTouchpoint = touchpoints[0];
    return {
      [firstTouchpoint.affiliate_id]: {
        credit: 1.0,
        value: orderValue
      }
    };
  }

  /**
   * Last-click attribution model
   */
  lastClickAttribution(touchpoints, orderValue) {
    if (touchpoints.length === 0) return {};

    const lastTouchpoint = touchpoints[touchpoints.length - 1];
    return {
      [lastTouchpoint.affiliate_id]: {
        credit: 1.0,
        value: orderValue
      }
    };
  }

  /**
   * Linear attribution model
   */
  linearAttribution(touchpoints, orderValue) {
    if (touchpoints.length === 0) return {};

    const creditPerTouchpoint = 1.0 / touchpoints.length;
    const valuePerTouchpoint = orderValue / touchpoints.length;

    const attribution = {};
    for (const touchpoint of touchpoints) {
      if (!attribution[touchpoint.affiliate_id]) {
        attribution[touchpoint.affiliate_id] = {
          credit: 0,
          value: 0
        };
      }

      attribution[touchpoint.affiliate_id].credit += creditPerTouchpoint;
      attribution[touchpoint.affiliate_id].value += valuePerTouchpoint;
    }

    return attribution;
  }

  /**
   * Time-decay attribution model
   */
  timeDecayAttribution(touchpoints, orderValue) {
    if (touchpoints.length === 0) return {};

    const conversionTime = new Date();
    const halfLife = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

    // Calculate weights for each touchpoint
    const weights = touchpoints.map(touchpoint => {
      const timeDiff = conversionTime - new Date(touchpoint.timestamp);
      return Math.exp(-timeDiff / halfLife);
    });

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

    const attribution = {};
    touchpoints.forEach((touchpoint, index) => {
      const credit = weights[index] / totalWeight;
      const value = orderValue * credit;

      if (!attribution[touchpoint.affiliate_id]) {
        attribution[touchpoint.affiliate_id] = {
          credit: 0,
          value: 0
        };
      }

      attribution[touchpoint.affiliate_id].credit += credit;
      attribution[touchpoint.affiliate_id].value += value;
    });

    return attribution;
  }

  /**
   * Position-based attribution model (40% first, 40% last, 20% middle)
   */
  positionBasedAttribution(touchpoints, orderValue) {
    if (touchpoints.length === 0) return {};

    if (touchpoints.length === 1) {
      return this.firstClickAttribution(touchpoints, orderValue);
    }

    const attribution = {};
    const firstTouchpoint = touchpoints[0];
    const lastTouchpoint = touchpoints[touchpoints.length - 1];

    // First touchpoint gets 40%
    if (!attribution[firstTouchpoint.affiliate_id]) {
      attribution[firstTouchpoint.affiliate_id] = { credit: 0, value: 0 };
    }
    attribution[firstTouchpoint.affiliate_id].credit += 0.4;
    attribution[firstTouchpoint.affiliate_id].value += orderValue * 0.4;

    // Last touchpoint gets 40%
    if (!attribution[lastTouchpoint.affiliate_id]) {
      attribution[lastTouchpoint.affiliate_id] = { credit: 0, value: 0 };
    }
    attribution[lastTouchpoint.affiliate_id].credit += 0.4;
    attribution[lastTouchpoint.affiliate_id].value += orderValue * 0.4;

    // Middle touchpoints share 20%
    if (touchpoints.length > 2) {
      const middleTouchpoints = touchpoints.slice(1, -1);
      const creditPerMiddle = 0.2 / middleTouchpoints.length;
      const valuePerMiddle = (orderValue * 0.2) / middleTouchpoints.length;

      middleTouchpoints.forEach(touchpoint => {
        if (!attribution[touchpoint.affiliate_id]) {
          attribution[touchpoint.affiliate_id] = { credit: 0, value: 0 };
        }
        attribution[touchpoint.affiliate_id].credit += creditPerMiddle;
        attribution[touchpoint.affiliate_id].value += valuePerMiddle;
      });
    }

    return attribution;
  }

  /**
   * Store attribution results
   */
  async storeAttributionResults(data) {
    const {
      clickId,
      orderId,
      orderValue,
      conversionType,
      touchpoints,
      attributions
    } = data;

    // Store overall attribution record
    const attributionRecord = await db('conversion_attributions')
      .insert({
        click_id: clickId,
        order_id: orderId,
        order_value: orderValue,
        conversion_type: conversionType,
        touchpoint_count: touchpoints.length,
        attribution_models: JSON.stringify(attributions),
        created_at: new Date()
      })
      .returning('*');

    // Store individual affiliate credits for each model
    for (const [model, modelAttributions] of Object.entries(attributions)) {
      for (const [affiliateId, credit] of Object.entries(modelAttributions)) {
        await db('attribution_credits')
          .insert({
            attribution_id: attributionRecord[0].id,
            affiliate_id: affiliateId,
            attribution_model: model,
            credit_percentage: credit.credit,
            credit_value: credit.value,
            created_at: new Date()
          });
      }
    }
  }

  /**
   * Get attribution analysis for affiliate
   */
  async getAttributionAnalysis(affiliateId, dateRange = {}) {
    const { startDate, endDate } = dateRange;

    let query = db('attribution_credits as ac')
      .join('conversion_attributions as ca', 'ac.attribution_id', 'ca.id')
      .where('ac.affiliate_id', affiliateId);

    if (startDate) {
      query = query.where('ca.created_at', '>=', startDate);
    }

    if (endDate) {
      query = query.where('ca.created_at', '<=', endDate);
    }

    const [
      modelBreakdown,
      creditDistribution,
      totalCredits
    ] = await Promise.all([
      query.clone()
        .select('ac.attribution_model')
        .sum('ac.credit_value as total_value')
        .count('* as conversion_count')
        .groupBy('ac.attribution_model'),

      query.clone()
        .select(db.raw('ROUND(ac.credit_percentage, 2) as credit_range'))
        .count('* as count')
        .groupBy(db.raw('ROUND(ac.credit_percentage, 2)'))
        .orderBy('credit_range'),

      query.clone()
        .sum('ac.credit_value as total')
        .first()
    ]);

    return {
      modelBreakdown: modelBreakdown,
      creditDistribution: creditDistribution,
      totalAttributedValue: parseFloat(totalCredits.total) || 0
    };
  }

  /**
   * Get cross-device attribution insights
   */
  async getCrossDeviceInsights(affiliateId, dateRange = {}) {
    const { startDate, endDate } = dateRange;

    // This would require more sophisticated cross-device tracking
    // For now, provide basic device transition analysis

    let query = db('click_tracking as ct1')
      .join('click_tracking as ct2', 'ct1.visitor_id', 'ct2.visitor_id')
      .where('ct1.affiliate_id', affiliateId)
      .where('ct1.device_type', '!=', db.raw('ct2.device_type'))
      .where('ct2.converted', true);

    if (startDate) {
      query = query.where('ct1.clicked_at', '>=', startDate);
    }

    if (endDate) {
      query = query.where('ct1.clicked_at', '<=', endDate);
    }

    const deviceTransitions = await query
      .select([
        'ct1.device_type as initial_device',
        'ct2.device_type as conversion_device',
        db.raw('COUNT(*) as transition_count'),
        db.raw('SUM(ct2.conversion_value) as total_value')
      ])
      .groupBy('ct1.device_type', 'ct2.device_type')
      .orderBy('transition_count', 'desc');

    return {
      deviceTransitions: deviceTransitions
    };
  }

  /**
   * Clean up old attribution data
   */
  async cleanupOldData(daysToKeep = 90) {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    try {
      // Delete old touchpoints
      const deletedTouchpoints = await db('attribution_touchpoints')
        .where('timestamp', '<', cutoffDate)
        .del();

      // Delete old attribution records
      const deletedAttributions = await db('conversion_attributions')
        .where('created_at', '<', cutoffDate)
        .del();

      console.log(`Cleaned up ${deletedTouchpoints} touchpoints and ${deletedAttributions} attribution records`);

      return {
        deletedTouchpoints,
        deletedAttributions
      };

    } catch (error) {
      console.error('Error cleaning up attribution data:', error);
      throw error;
    }
  }

  /**
   * Get attribution model comparison
   */
  async getModelComparison(affiliateId, dateRange = {}) {
    const { startDate, endDate } = dateRange;

    let query = db('attribution_credits as ac')
      .join('conversion_attributions as ca', 'ac.attribution_id', 'ca.id')
      .where('ac.affiliate_id', affiliateId);

    if (startDate) {
      query = query.where('ca.created_at', '>=', startDate);
    }

    if (endDate) {
      query = query.where('ca.created_at', '<=', endDate);
    }

    const modelComparison = await query
      .select([
        'ac.attribution_model',
        db.raw('SUM(ac.credit_value) as total_value'),
        db.raw('COUNT(DISTINCT ca.id) as conversion_count'),
        db.raw('AVG(ac.credit_percentage) as avg_credit_percentage')
      ])
      .groupBy('ac.attribution_model')
      .orderBy('total_value', 'desc');

    return modelComparison;
  }
}

module.exports = AttributionService;