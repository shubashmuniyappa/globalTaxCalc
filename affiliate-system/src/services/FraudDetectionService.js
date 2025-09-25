const crypto = require('crypto');
const db = require('../config/database');

class FraudDetectionService {
  constructor() {
    this.fraudRules = {
      // IP-based rules
      maxClicksPerIpPerHour: 10,
      maxClicksPerIpPerDay: 100,
      suspiciousIpPatterns: [
        /^10\./, // Private networks
        /^172\.1[6-9]\./, /^172\.2[0-9]\./, /^172\.3[0-1]\./,
        /^192\.168\./,
        /^127\./ // Localhost
      ],

      // User agent rules
      suspiciousUserAgents: [
        /curl/i, /wget/i, /python/i, /java/i, /ruby/i,
        /perl/i, /php/i, /bot/i, /crawler/i, /spider/i
      ],

      // Timing rules
      minTimeBetweenClicks: 1000, // 1 second
      maxSessionDuration: 24 * 60 * 60 * 1000, // 24 hours

      // Geographic rules
      maxDistanceJump: 1000, // km

      // Conversion rules
      maxConversionsPerIpPerDay: 3,
      minTimeToConversion: 30 * 1000, // 30 seconds
      maxTimeToConversion: 30 * 24 * 60 * 60 * 1000 // 30 days
    };

    this.blockedIps = new Set();
    this.suspiciousPatterns = new Map();
  }

  /**
   * Analyze click for fraud indicators
   */
  async analyzeClick(clickData) {
    const {
      linkId,
      affiliateId,
      ipAddress,
      userAgent,
      referer,
      visitorId,
      geoData
    } = clickData;

    const signals = [];
    let score = 0;

    try {
      // Check IP-based fraud
      const ipAnalysis = await this.analyzeIpAddress(ipAddress, linkId);
      signals.push(...ipAnalysis.signals);
      score += ipAnalysis.score;

      // Check user agent
      const uaAnalysis = this.analyzeUserAgent(userAgent);
      signals.push(...uaAnalysis.signals);
      score += uaAnalysis.score;

      // Check referer
      const refererAnalysis = this.analyzeReferer(referer);
      signals.push(...refererAnalysis.signals);
      score += refererAnalysis.score;

      // Check click patterns
      const patternAnalysis = await this.analyzeClickPatterns(affiliateId, linkId, visitorId);
      signals.push(...patternAnalysis.signals);
      score += patternAnalysis.score;

      // Check geographic patterns
      const geoAnalysis = await this.analyzeGeographic(ipAddress, geoData, visitorId);
      signals.push(...geoAnalysis.signals);
      score += geoAnalysis.score;

      // Check timing patterns
      const timingAnalysis = await this.analyzeTimingPatterns(ipAddress, linkId);
      signals.push(...timingAnalysis.signals);
      score += timingAnalysis.score;

      // Normalize score to 0-1 range
      score = Math.min(score / 100, 1);

      const isSuspicious = score > 0.5;
      const shouldBlock = score > 0.8;

      // Store fraud analysis
      await this.storeFraudAnalysis({
        linkId,
        affiliateId,
        ipAddress,
        userAgent,
        signals,
        score,
        isSuspicious,
        shouldBlock
      });

      return {
        score,
        signals,
        isSuspicious,
        shouldBlock
      };

    } catch (error) {
      console.error('Error in fraud analysis:', error);
      return {
        score: 0,
        signals: ['error_in_analysis'],
        isSuspicious: false,
        shouldBlock: false
      };
    }
  }

  /**
   * Analyze IP address for fraud indicators
   */
  async analyzeIpAddress(ipAddress, linkId) {
    const signals = [];
    let score = 0;

    // Check if IP is in blocklist
    if (this.blockedIps.has(ipAddress)) {
      signals.push('blocked_ip');
      score += 50;
    }

    // Check for suspicious IP patterns
    const isSuspiciousIp = this.fraudRules.suspiciousIpPatterns.some(pattern =>
      pattern.test(ipAddress)
    );

    if (isSuspiciousIp) {
      signals.push('suspicious_ip_pattern');
      score += 30;
    }

    // Check click frequency from this IP
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [hourlyClicks, dailyClicks] = await Promise.all([
      db('click_tracking')
        .where({ ip_address: ipAddress })
        .where('clicked_at', '>=', oneHourAgo)
        .count('* as count')
        .first(),

      db('click_tracking')
        .where({ ip_address: ipAddress })
        .where('clicked_at', '>=', oneDayAgo)
        .count('* as count')
        .first()
    ]);

    if (parseInt(hourlyClicks.count) > this.fraudRules.maxClicksPerIpPerHour) {
      signals.push('excessive_hourly_clicks');
      score += 40;
    }

    if (parseInt(dailyClicks.count) > this.fraudRules.maxClicksPerIpPerDay) {
      signals.push('excessive_daily_clicks');
      score += 25;
    }

    // Check if IP has multiple affiliate associations
    const affiliateCount = await db('click_tracking')
      .where({ ip_address: ipAddress })
      .where('clicked_at', '>=', oneDayAgo)
      .countDistinct('affiliate_id as count')
      .first();

    if (parseInt(affiliateCount.count) > 5) {
      signals.push('multiple_affiliate_clicks');
      score += 20;
    }

    return { signals, score };
  }

  /**
   * Analyze user agent for fraud indicators
   */
  analyzeUserAgent(userAgent) {
    const signals = [];
    let score = 0;

    if (!userAgent || userAgent.length < 10) {
      signals.push('missing_or_short_user_agent');
      score += 30;
      return { signals, score };
    }

    // Check for suspicious user agent patterns
    const isSuspiciousUA = this.fraudRules.suspiciousUserAgents.some(pattern =>
      pattern.test(userAgent)
    );

    if (isSuspiciousUA) {
      signals.push('suspicious_user_agent');
      score += 40;
    }

    // Check for very generic user agents
    const genericPatterns = [
      /^Mozilla\/5\.0$/,
      /^User-Agent$/,
      /^Python/,
      /^curl/
    ];

    if (genericPatterns.some(pattern => pattern.test(userAgent))) {
      signals.push('generic_user_agent');
      score += 25;
    }

    return { signals, score };
  }

  /**
   * Analyze referer for fraud indicators
   */
  analyzeReferer(referer) {
    const signals = [];
    let score = 0;

    if (!referer) {
      signals.push('missing_referer');
      score += 10;
      return { signals, score };
    }

    // Check for suspicious referer patterns
    const suspiciousReferers = [
      /localhost/i,
      /127\.0\.0\.1/,
      /192\.168\./,
      /10\./,
      /file:\/\//,
      /data:/
    ];

    if (suspiciousReferers.some(pattern => pattern.test(referer))) {
      signals.push('suspicious_referer');
      score += 20;
    }

    return { signals, score };
  }

  /**
   * Analyze click patterns for fraud
   */
  async analyzeClickPatterns(affiliateId, linkId, visitorId) {
    const signals = [];
    let score = 0;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Check for rapid successive clicks from same visitor
    const recentClicks = await db('click_tracking')
      .where({
        visitor_id: visitorId,
        affiliate_id: affiliateId
      })
      .where('clicked_at', '>=', oneHourAgo)
      .orderBy('clicked_at', 'desc')
      .limit(10);

    if (recentClicks.length > 5) {
      signals.push('rapid_successive_clicks');
      score += 30;

      // Check timing between clicks
      for (let i = 1; i < recentClicks.length; i++) {
        const timeDiff = new Date(recentClicks[i - 1].clicked_at) - new Date(recentClicks[i].clicked_at);
        if (timeDiff < this.fraudRules.minTimeBetweenClicks) {
          signals.push('clicks_too_fast');
          score += 20;
          break;
        }
      }
    }

    // Check for same visitor clicking multiple links from same affiliate
    const linkVariation = await db('click_tracking')
      .where({
        visitor_id: visitorId,
        affiliate_id: affiliateId
      })
      .where('clicked_at', '>=', oneHourAgo)
      .countDistinct('link_id as count')
      .first();

    if (parseInt(linkVariation.count) > 3) {
      signals.push('multiple_link_clicks');
      score += 15;
    }

    return { signals, score };
  }

  /**
   * Analyze geographic patterns
   */
  async analyzeGeographic(ipAddress, geoData, visitorId) {
    const signals = [];
    let score = 0;

    if (!geoData.country) {
      signals.push('missing_geo_data');
      score += 5;
      return { signals, score };
    }

    // Check for impossible geographic jumps
    const recentClicks = await db('click_tracking')
      .where({ visitor_id: visitorId })
      .whereNotNull('latitude')
      .whereNotNull('longitude')
      .orderBy('clicked_at', 'desc')
      .limit(2);

    if (recentClicks.length === 2) {
      const [current, previous] = recentClicks;
      const distance = this.calculateDistance(
        parseFloat(previous.latitude),
        parseFloat(previous.longitude),
        geoData.ll[0],
        geoData.ll[1]
      );

      const timeDiff = (new Date() - new Date(previous.clicked_at)) / (1000 * 60 * 60); // hours

      // Check if travel speed is humanly possible (assuming max 1000 km/h)
      if (distance > 0 && timeDiff > 0) {
        const speed = distance / timeDiff;
        if (speed > 1000) {
          signals.push('impossible_geographic_jump');
          score += 35;
        }
      }
    }

    // Check for high-risk countries (configurable)
    const highRiskCountries = process.env.HIGH_RISK_COUNTRIES?.split(',') || [];
    if (highRiskCountries.includes(geoData.country)) {
      signals.push('high_risk_country');
      score += 10;
    }

    return { signals, score };
  }

  /**
   * Analyze timing patterns
   */
  async analyzeTimingPatterns(ipAddress, linkId) {
    const signals = [];
    let score = 0;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Check for clicks at suspicious times (e.g., all at exact same minute)
    const recentClicks = await db('click_tracking')
      .where({ ip_address: ipAddress })
      .where('clicked_at', '>=', oneHourAgo)
      .select(db.raw('EXTRACT(minute from clicked_at) as minute'))
      .groupBy(db.raw('EXTRACT(minute from clicked_at)'))
      .having(db.raw('count(*) > ?'), [3]);

    if (recentClicks.length > 0) {
      signals.push('clustered_timing');
      score += 20;
    }

    // Check for robotic timing patterns (exactly same intervals)
    const timingClicks = await db('click_tracking')
      .where({ ip_address: ipAddress })
      .where('clicked_at', '>=', oneHourAgo)
      .orderBy('clicked_at', 'asc')
      .select('clicked_at');

    if (timingClicks.length >= 3) {
      const intervals = [];
      for (let i = 1; i < timingClicks.length; i++) {
        const interval = new Date(timingClicks[i].clicked_at) - new Date(timingClicks[i - 1].clicked_at);
        intervals.push(interval);
      }

      // Check if intervals are suspiciously similar
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((acc, interval) => acc + Math.pow(interval - avgInterval, 2), 0) / intervals.length;

      if (variance < 1000) { // Very low variance suggests robotic behavior
        signals.push('robotic_timing');
        score += 25;
      }
    }

    return { signals, score };
  }

  /**
   * Analyze conversion for fraud
   */
  async analyzeConversion(conversionData) {
    const {
      clickId,
      orderId,
      customerId,
      orderValue,
      timeSinceClick,
      ipAddress
    } = conversionData;

    const signals = [];
    let score = 0;

    // Check conversion timing
    if (timeSinceClick < this.fraudRules.minTimeToConversion / 1000) {
      signals.push('conversion_too_fast');
      score += 40;
    }

    if (timeSinceClick > this.fraudRules.maxTimeToConversion / 1000) {
      signals.push('conversion_too_slow');
      score += 20;
    }

    // Check for multiple conversions from same IP
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const ipConversions = await db('click_tracking')
      .join('commissions', 'click_tracking.click_id', 'commissions.click_id')
      .where('click_tracking.ip_address', ipAddress)
      .where('commissions.created_at', '>=', oneDayAgo)
      .count('* as count')
      .first();

    if (parseInt(ipConversions.count) > this.fraudRules.maxConversionsPerIpPerDay) {
      signals.push('excessive_conversions_per_ip');
      score += 30;
    }

    // Check for suspicious order values
    if (orderValue <= 0) {
      signals.push('invalid_order_value');
      score += 50;
    }

    // Check for round number bias (suspicious if always round numbers)
    if (orderValue % 1 === 0 && orderValue % 10 === 0 && orderValue > 100) {
      signals.push('round_number_bias');
      score += 10;
    }

    // Check for duplicate order IDs
    if (orderId) {
      const duplicateOrder = await db('commissions')
        .where({ order_id: orderId })
        .first();

      if (duplicateOrder) {
        signals.push('duplicate_order_id');
        score += 60;
      }
    }

    const shouldBlock = score > 50;

    return {
      score: Math.min(score / 100, 1),
      signals,
      shouldBlock
    };
  }

  /**
   * Block IP temporarily
   */
  async blockIpTemporarily(ipAddress, linkId, duration = 24 * 60 * 60 * 1000) {
    this.blockedIps.add(ipAddress);

    // Store in database for persistence
    await db('fraud_blocks').insert({
      ip_address: ipAddress,
      link_id: linkId,
      block_type: 'temporary',
      blocked_until: new Date(Date.now() + duration),
      reason: 'excessive_click_velocity',
      created_at: new Date()
    }).onConflict(['ip_address', 'link_id']).merge();

    // Remove from memory after duration
    setTimeout(() => {
      this.blockedIps.delete(ipAddress);
    }, duration);
  }

  /**
   * Store fraud analysis results
   */
  async storeFraudAnalysis(analysisData) {
    const {
      linkId,
      affiliateId,
      ipAddress,
      userAgent,
      signals,
      score,
      isSuspicious,
      shouldBlock
    } = analysisData;

    try {
      await db('fraud_analysis').insert({
        link_id: linkId,
        affiliate_id: affiliateId,
        ip_address: ipAddress,
        user_agent: userAgent,
        fraud_signals: JSON.stringify(signals),
        fraud_score: score,
        is_suspicious: isSuspicious,
        should_block: shouldBlock,
        analyzed_at: new Date()
      });
    } catch (error) {
      console.error('Error storing fraud analysis:', error);
    }
  }

  /**
   * Calculate distance between two geographic points
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get fraud statistics for affiliate
   */
  async getFraudStatistics(affiliateId, dateRange = {}) {
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
      suspiciousClicks,
      blockedClicks,
      avgFraudScore
    ] = await Promise.all([
      query.clone().count('* as count').first(),
      query.clone().where('is_suspicious', true).count('* as count').first(),
      query.clone().where('fraud_score', '>', 0.8).count('* as count').first(),
      query.clone().avg('fraud_score as score').first()
    ]);

    return {
      totalClicks: parseInt(totalClicks.count) || 0,
      suspiciousClicks: parseInt(suspiciousClicks.count) || 0,
      blockedClicks: parseInt(blockedClicks.count) || 0,
      fraudRate: totalClicks.count > 0 ? (suspiciousClicks.count / totalClicks.count) : 0,
      averageFraudScore: parseFloat(avgFraudScore.score) || 0
    };
  }
}

module.exports = FraudDetectionService;