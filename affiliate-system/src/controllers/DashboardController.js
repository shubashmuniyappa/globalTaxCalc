const Affiliate = require('../models/Affiliate');
const AffiliateLink = require('../models/AffiliateLink');
const TrackingService = require('../services/TrackingService');
const ReportingService = require('../services/ReportingService');
const NotificationService = require('../services/NotificationService');
const db = require('../config/database');

class DashboardController {
  constructor() {
    this.trackingService = new TrackingService();
    this.reportingService = new ReportingService();
    this.notificationService = new NotificationService();
  }

  /**
   * Get main dashboard overview
   */
  async getDashboardOverview(req, res) {
    try {
      const affiliateId = req.user.id;
      const { period = '30d' } = req.query;

      const dateRange = this.getDateRange(period);

      // Get core metrics in parallel
      const [
        performanceMetrics,
        earningsMetrics,
        linkMetrics,
        recentActivity,
        topPerformingLinks,
        comparisonData,
        notifications
      ] = await Promise.all([
        this.getPerformanceMetrics(affiliateId, dateRange),
        this.getEarningsMetrics(affiliateId, dateRange),
        this.getLinkMetrics(affiliateId, dateRange),
        this.getRecentActivity(affiliateId, 10),
        this.getTopPerformingLinks(affiliateId, dateRange, 5),
        this.getComparisonData(affiliateId, dateRange),
        this.notificationService.getUnreadNotifications(affiliateId, 5)
      ]);

      res.json({
        success: true,
        data: {
          overview: {
            performance: performanceMetrics,
            earnings: earningsMetrics,
            links: linkMetrics,
            comparison: comparisonData
          },
          topLinks: topPerformingLinks,
          recentActivity: recentActivity,
          notifications: notifications,
          period: period,
          lastUpdated: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error getting dashboard overview:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load dashboard overview'
      });
    }
  }

  /**
   * Get detailed performance analytics
   */
  async getPerformanceAnalytics(req, res) {
    try {
      const affiliateId = req.user.id;
      const {
        period = '30d',
        granularity = 'day',
        metric = 'clicks'
      } = req.query;

      const dateRange = this.getDateRange(period);

      const analytics = await this.reportingService.getPerformanceAnalytics({
        affiliateId,
        dateRange,
        granularity,
        metric
      });

      res.json({
        success: true,
        data: analytics
      });

    } catch (error) {
      console.error('Error getting performance analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load performance analytics'
      });
    }
  }

  /**
   * Get earnings breakdown
   */
  async getEarningsBreakdown(req, res) {
    try {
      const affiliateId = req.user.id;
      const { period = '30d' } = req.query;

      const dateRange = this.getDateRange(period);

      const [
        earningsByStatus,
        earningsByProduct,
        earningsByLink,
        paymentHistory,
        projectedEarnings
      ] = await Promise.all([
        this.getEarningsByStatus(affiliateId, dateRange),
        this.getEarningsByProduct(affiliateId, dateRange),
        this.getEarningsByLink(affiliateId, dateRange),
        this.getRecentPayments(affiliateId, 10),
        this.getProjectedEarnings(affiliateId)
      ]);

      res.json({
        success: true,
        data: {
          breakdown: {
            byStatus: earningsByStatus,
            byProduct: earningsByProduct,
            byLink: earningsByLink
          },
          paymentHistory: paymentHistory,
          projectedEarnings: projectedEarnings
        }
      });

    } catch (error) {
      console.error('Error getting earnings breakdown:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load earnings breakdown'
      });
    }
  }

  /**
   * Get link performance details
   */
  async getLinkPerformance(req, res) {
    try {
      const affiliateId = req.user.id;
      const { period = '30d', sortBy = 'clicks', sortOrder = 'desc' } = req.query;

      const dateRange = this.getDateRange(period);

      // Get all links with performance data
      const links = await this.getLinkPerformanceData(affiliateId, dateRange, {
        sortBy,
        sortOrder
      });

      res.json({
        success: true,
        data: {
          links: links,
          period: period
        }
      });

    } catch (error) {
      console.error('Error getting link performance:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load link performance'
      });
    }
  }

  /**
   * Get real-time statistics
   */
  async getRealTimeStats(req, res) {
    try {
      const affiliateId = req.user.id;

      // Get stats for the last 24 hours
      const last24Hours = {
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate: new Date()
      };

      const [
        realtimeClicks,
        realtimeConversions,
        activeLinks,
        recentConversions
      ] = await Promise.all([
        this.getRealtimeClicks(affiliateId, last24Hours),
        this.getRealtimeConversions(affiliateId, last24Hours),
        this.getActiveLinksCount(affiliateId),
        this.getRecentConversions(affiliateId, 5)
      ]);

      res.json({
        success: true,
        data: {
          realtime: {
            clicks: realtimeClicks,
            conversions: realtimeConversions,
            activeLinks: activeLinks
          },
          recent: {
            conversions: recentConversions
          },
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error getting real-time stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load real-time statistics'
      });
    }
  }

  /**
   * Get traffic analytics
   */
  async getTrafficAnalytics(req, res) {
    try {
      const affiliateId = req.user.id;
      const { period = '30d' } = req.query;

      const dateRange = this.getDateRange(period);

      const [
        trafficSources,
        geographicData,
        deviceBreakdown,
        browserData,
        hourlyTraffic
      ] = await Promise.all([
        this.getTrafficSources(affiliateId, dateRange),
        this.getGeographicData(affiliateId, dateRange),
        this.getDeviceBreakdown(affiliateId, dateRange),
        this.getBrowserData(affiliateId, dateRange),
        this.getHourlyTraffic(affiliateId, dateRange)
      ]);

      res.json({
        success: true,
        data: {
          sources: trafficSources,
          geographic: geographicData,
          devices: deviceBreakdown,
          browsers: browserData,
          hourly: hourlyTraffic
        }
      });

    } catch (error) {
      console.error('Error getting traffic analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load traffic analytics'
      });
    }
  }

  /**
   * Get conversion funnel data
   */
  async getConversionFunnel(req, res) {
    try {
      const affiliateId = req.user.id;
      const { period = '30d', linkId } = req.query;

      const dateRange = this.getDateRange(period);

      const funnelData = await this.getConversionFunnelData(affiliateId, dateRange, linkId);

      res.json({
        success: true,
        data: funnelData
      });

    } catch (error) {
      console.error('Error getting conversion funnel:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load conversion funnel'
      });
    }
  }

  // Helper methods

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(affiliateId, dateRange) {
    const query = db('click_tracking')
      .where('affiliate_id', affiliateId)
      .where('clicked_at', '>=', dateRange.startDate)
      .where('clicked_at', '<=', dateRange.endDate);

    const [
      totalClicks,
      uniqueClicks,
      conversions,
      conversionValue
    ] = await Promise.all([
      query.clone().count('* as count').first(),
      query.clone().countDistinct('visitor_id as count').first(),
      query.clone().where('converted', true).count('* as count').first(),
      query.clone().where('converted', true).sum('conversion_value as total').first()
    ]);

    const clickCount = parseInt(totalClicks.count) || 0;
    const conversionCount = parseInt(conversions.count) || 0;

    return {
      totalClicks: clickCount,
      uniqueClicks: parseInt(uniqueClicks.count) || 0,
      conversions: conversionCount,
      conversionRate: clickCount > 0 ? (conversionCount / clickCount) : 0,
      averageOrderValue: conversionCount > 0 ? (parseFloat(conversionValue.total) || 0) / conversionCount : 0
    };
  }

  /**
   * Get earnings metrics
   */
  async getEarningsMetrics(affiliateId, dateRange) {
    const query = db('commissions')
      .where('affiliate_id', affiliateId)
      .where('created_at', '>=', dateRange.startDate)
      .where('created_at', '<=', dateRange.endDate);

    const [
      pendingEarnings,
      approvedEarnings,
      paidEarnings,
      totalCommissions
    ] = await Promise.all([
      query.clone().where('status', 'pending').sum('commission_amount as total').first(),
      query.clone().where('status', 'approved').sum('commission_amount as total').first(),
      query.clone().where('status', 'paid').sum('commission_amount as total').first(),
      query.clone().count('* as count').first()
    ]);

    const pending = parseFloat(pendingEarnings.total) || 0;
    const approved = parseFloat(approvedEarnings.total) || 0;
    const paid = parseFloat(paidEarnings.total) || 0;

    return {
      pendingEarnings: pending,
      approvedEarnings: approved,
      paidEarnings: paid,
      totalEarnings: pending + approved + paid,
      totalCommissions: parseInt(totalCommissions.count) || 0
    };
  }

  /**
   * Get link metrics
   */
  async getLinkMetrics(affiliateId, dateRange) {
    const [
      totalLinks,
      activeLinks,
      topPerformingLink
    ] = await Promise.all([
      db('affiliate_links')
        .where('affiliate_id', affiliateId)
        .where('deleted_at', null)
        .count('* as count')
        .first(),

      db('affiliate_links')
        .where('affiliate_id', affiliateId)
        .where('is_active', true)
        .where('deleted_at', null)
        .count('* as count')
        .first(),

      db('affiliate_links')
        .select('campaign_name', 'clicks', 'conversions')
        .where('affiliate_id', affiliateId)
        .where('deleted_at', null)
        .orderBy('clicks', 'desc')
        .first()
    ]);

    return {
      totalLinks: parseInt(totalLinks.count) || 0,
      activeLinks: parseInt(activeLinks.count) || 0,
      topPerforming: topPerformingLink
    };
  }

  /**
   * Get top performing links
   */
  async getTopPerformingLinks(affiliateId, dateRange, limit = 5) {
    return await db('affiliate_links as al')
      .select([
        'al.id',
        'al.campaign_name',
        'al.campaign_type',
        'al.created_at',
        db.raw('COUNT(ct.id) as clicks'),
        db.raw('COUNT(CASE WHEN ct.converted = true THEN 1 END) as conversions'),
        db.raw('SUM(CASE WHEN ct.converted = true THEN ct.conversion_value ELSE 0 END) as conversion_value'),
        db.raw('SUM(c.commission_amount) as commission_earned')
      ])
      .leftJoin('click_tracking as ct', function() {
        this.on('al.id', '=', 'ct.link_id')
          .andOn('ct.clicked_at', '>=', db.raw('?', [dateRange.startDate]))
          .andOn('ct.clicked_at', '<=', db.raw('?', [dateRange.endDate]));
      })
      .leftJoin('commissions as c', 'ct.click_id', 'c.click_id')
      .where('al.affiliate_id', affiliateId)
      .where('al.deleted_at', null)
      .groupBy('al.id', 'al.campaign_name', 'al.campaign_type', 'al.created_at')
      .orderBy('clicks', 'desc')
      .limit(limit);
  }

  /**
   * Get comparison data (vs previous period)
   */
  async getComparisonData(affiliateId, dateRange) {
    const periodLength = dateRange.endDate - dateRange.startDate;
    const previousPeriod = {
      startDate: new Date(dateRange.startDate - periodLength),
      endDate: dateRange.startDate
    };

    const [currentMetrics, previousMetrics] = await Promise.all([
      this.getPerformanceMetrics(affiliateId, dateRange),
      this.getPerformanceMetrics(affiliateId, previousPeriod)
    ]);

    return {
      clicks: this.calculateGrowth(currentMetrics.totalClicks, previousMetrics.totalClicks),
      conversions: this.calculateGrowth(currentMetrics.conversions, previousMetrics.conversions),
      conversionRate: this.calculateGrowth(currentMetrics.conversionRate, previousMetrics.conversionRate)
    };
  }

  /**
   * Calculate growth percentage
   */
  calculateGrowth(current, previous) {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return ((current - previous) / previous) * 100;
  }

  /**
   * Get date range based on period
   */
  getDateRange(period) {
    const endDate = new Date();
    let startDate;

    switch (period) {
      case '1d':
        startDate = new Date(endDate - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(endDate - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(endDate - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(endDate - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(endDate - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(endDate - 30 * 24 * 60 * 60 * 1000);
    }

    return { startDate, endDate };
  }

  /**
   * Get recent activity
   */
  async getRecentActivity(affiliateId, limit = 10) {
    return await db('click_tracking')
      .select([
        'clicked_at as timestamp',
        'converted',
        'conversion_value',
        'country',
        'device_type',
        db.raw("'click' as type")
      ])
      .where('affiliate_id', affiliateId)
      .union([
        db('commissions')
          .select([
            'created_at as timestamp',
            db.raw('true as converted'),
            'commission_amount as conversion_value',
            db.raw('null as country'),
            db.raw('null as device_type'),
            db.raw("'commission' as type")
          ])
          .where('affiliate_id', affiliateId)
      ])
      .orderBy('timestamp', 'desc')
      .limit(limit);
  }

  /**
   * Get earnings by status
   */
  async getEarningsByStatus(affiliateId, dateRange) {
    return await db('commissions')
      .select('status')
      .sum('commission_amount as total')
      .count('* as count')
      .where('affiliate_id', affiliateId)
      .where('created_at', '>=', dateRange.startDate)
      .where('created_at', '<=', dateRange.endDate)
      .groupBy('status');
  }

  /**
   * Get earnings by product
   */
  async getEarningsByProduct(affiliateId, dateRange) {
    return await db('commissions')
      .select('product_name')
      .sum('commission_amount as total')
      .count('* as count')
      .where('affiliate_id', affiliateId)
      .where('created_at', '>=', dateRange.startDate)
      .where('created_at', '<=', dateRange.endDate)
      .whereNotNull('product_name')
      .groupBy('product_name')
      .orderBy('total', 'desc')
      .limit(10);
  }

  /**
   * Get traffic sources
   */
  async getTrafficSources(affiliateId, dateRange) {
    return await db('click_tracking')
      .select('referer')
      .count('* as clicks')
      .where('affiliate_id', affiliateId)
      .where('clicked_at', '>=', dateRange.startDate)
      .where('clicked_at', '<=', dateRange.endDate)
      .whereNotNull('referer')
      .groupBy('referer')
      .orderBy('clicks', 'desc')
      .limit(10);
  }

  /**
   * Get geographic data
   */
  async getGeographicData(affiliateId, dateRange) {
    return await db('click_tracking')
      .select('country')
      .count('* as clicks')
      .countDistinct('visitor_id as unique_visitors')
      .where('affiliate_id', affiliateId)
      .where('clicked_at', '>=', dateRange.startDate)
      .where('clicked_at', '<=', dateRange.endDate)
      .whereNotNull('country')
      .groupBy('country')
      .orderBy('clicks', 'desc')
      .limit(20);
  }

  /**
   * Get device breakdown
   */
  async getDeviceBreakdown(affiliateId, dateRange) {
    return await db('click_tracking')
      .select('device_type')
      .count('* as clicks')
      .where('affiliate_id', affiliateId)
      .where('clicked_at', '>=', dateRange.startDate)
      .where('clicked_at', '<=', dateRange.endDate)
      .groupBy('device_type')
      .orderBy('clicks', 'desc');
  }

  /**
   * Get realtime clicks
   */
  async getRealtimeClicks(affiliateId, dateRange) {
    return await db('click_tracking')
      .select(db.raw('EXTRACT(hour from clicked_at) as hour'))
      .count('* as clicks')
      .where('affiliate_id', affiliateId)
      .where('clicked_at', '>=', dateRange.startDate)
      .where('clicked_at', '<=', dateRange.endDate)
      .groupBy(db.raw('EXTRACT(hour from clicked_at)'))
      .orderBy('hour');
  }

  /**
   * Get active links count
   */
  async getActiveLinksCount(affiliateId) {
    const result = await db('affiliate_links')
      .where('affiliate_id', affiliateId)
      .where('is_active', true)
      .where('deleted_at', null)
      .count('* as count')
      .first();

    return parseInt(result.count) || 0;
  }
}

module.exports = DashboardController;