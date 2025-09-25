const config = require('../config');
const Redis = require('ioredis');
const axios = require('axios');

class ContentFilteringService {
  constructor() {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.cacheDb
    });

    this.filterRules = new Map();
    this.brandSafetyCategories = new Map();
    this.blockedDomains = new Set();
    this.allowedCategories = new Set();
    this.qualityScores = new Map();

    this.init();
  }

  async init() {
    await this.loadFilterRules();
    await this.loadBrandSafetyCategories();
    await this.loadBlockedDomains();
    await this.loadAllowedCategories();
    await this.initializeQualityScoring();
  }

  async loadFilterRules() {
    const rules = [
      {
        id: 'adult_content_filter',
        name: 'Adult Content Filter',
        enabled: config.contentFiltering.adultContentFilter,
        priority: 1,
        type: 'category',
        filter: (ad) => this.filterAdultContent(ad),
        action: 'block'
      },
      {
        id: 'competitor_blocking',
        name: 'Competitor Blocking',
        enabled: config.contentFiltering.competitorBlocking,
        priority: 2,
        type: 'domain',
        filter: (ad) => this.filterCompetitors(ad),
        action: 'block'
      },
      {
        id: 'quality_score_filter',
        name: 'Quality Score Filter',
        enabled: true,
        priority: 3,
        type: 'quality',
        filter: (ad) => this.filterByQualityScore(ad),
        action: 'block'
      },
      {
        id: 'brand_safety_filter',
        name: 'Brand Safety Filter',
        enabled: config.contentFiltering.brandSafetyEnabled,
        priority: 4,
        type: 'safety',
        filter: (ad) => this.filterBrandSafety(ad),
        action: 'block'
      },
      {
        id: 'contextual_relevance',
        name: 'Contextual Relevance Filter',
        enabled: true,
        priority: 5,
        type: 'relevance',
        filter: (ad, context) => this.filterContextualRelevance(ad, context),
        action: 'deprioritize'
      },
      {
        id: 'geographic_compliance',
        name: 'Geographic Compliance Filter',
        enabled: true,
        priority: 6,
        type: 'compliance',
        filter: (ad, context) => this.filterGeographicCompliance(ad, context),
        action: 'block'
      }
    ];

    for (const rule of rules) {
      this.filterRules.set(rule.id, rule);
    }
  }

  async loadBrandSafetyCategories() {
    const categories = {
      'adult': {
        keywords: ['adult', 'porn', 'sex', 'xxx', 'nude', 'explicit', 'erotic'],
        severity: 'high',
        description: 'Adult and sexually explicit content'
      },
      'gambling': {
        keywords: ['casino', 'betting', 'poker', 'lottery', 'gambling', 'wager'],
        severity: 'high',
        description: 'Gambling and betting content'
      },
      'weapons': {
        keywords: ['gun', 'weapon', 'firearm', 'ammunition', 'rifle', 'pistol'],
        severity: 'high',
        description: 'Weapons and firearms'
      },
      'illegal_drugs': {
        keywords: ['drugs', 'marijuana', 'cocaine', 'heroin', 'methamphetamine'],
        severity: 'high',
        description: 'Illegal drugs and substances'
      },
      'tobacco': {
        keywords: ['tobacco', 'cigarette', 'smoking', 'vaping', 'nicotine'],
        severity: 'medium',
        description: 'Tobacco and smoking products'
      },
      'alcohol_abuse': {
        keywords: ['alcoholism', 'drinking problem', 'alcohol abuse', 'rehab'],
        severity: 'medium',
        description: 'Alcohol abuse and addiction'
      },
      'violence': {
        keywords: ['violence', 'murder', 'terrorism', 'extremism', 'hate'],
        severity: 'high',
        description: 'Violence and extremist content'
      },
      'fraudulent': {
        keywords: ['scam', 'fraud', 'fake', 'counterfeit', 'ponzi', 'pyramid'],
        severity: 'high',
        description: 'Fraudulent and scam content'
      }
    };

    for (const [category, data] of Object.entries(categories)) {
      this.brandSafetyCategories.set(category, data);
    }
  }

  async loadBlockedDomains() {
    const blocked = [
      ...config.contentFiltering.blockedDomains,
      // Add competitor domains
      'competitor1.com',
      'competitor2.com',
      'freetaxusa.com',
      'turbotax.com',
      'hrblock.com',
      // Add known problematic domains
      'spam-ads.com',
      'fake-offers.net',
      'scam-site.org'
    ];

    for (const domain of blocked) {
      this.blockedDomains.add(domain.toLowerCase());
    }
  }

  async loadAllowedCategories() {
    const allowed = [
      ...config.contentFiltering.allowedCategories,
      'tax_services',
      'accounting',
      'financial_planning',
      'insurance',
      'investment',
      'retirement_planning',
      'small_business',
      'legal_services',
      'software',
      'education'
    ];

    for (const category of allowed) {
      this.allowedCategories.add(category.toLowerCase());
    }
  }

  async initializeQualityScoring() {
    // Initialize quality scoring weights
    this.qualityWeights = {
      brandReputation: 0.3,
      clickThroughRate: 0.25,
      conversionRate: 0.2,
      userFeedback: 0.15,
      technicalQuality: 0.1
    };
  }

  async filterAd(ad, context = {}) {
    const filterResult = {
      allowed: true,
      blocked: false,
      score: 10, // Start with perfect score
      reasons: [],
      warnings: [],
      modifications: []
    };

    try {
      // Apply each filter rule
      for (const rule of this.filterRules.values()) {
        if (!rule.enabled) continue;

        const ruleResult = await this.applyFilterRule(rule, ad, context);

        if (ruleResult.action === 'block') {
          filterResult.allowed = false;
          filterResult.blocked = true;
          filterResult.reasons.push({
            rule: rule.name,
            reason: ruleResult.reason,
            severity: ruleResult.severity || 'medium'
          });
        } else if (ruleResult.action === 'warn') {
          filterResult.warnings.push({
            rule: rule.name,
            warning: ruleResult.reason,
            severity: ruleResult.severity || 'low'
          });
        } else if (ruleResult.action === 'modify') {
          filterResult.modifications.push({
            rule: rule.name,
            modification: ruleResult.modification
          });
        }

        // Adjust quality score
        filterResult.score -= ruleResult.scoreDeduction || 0;
      }

      // Final quality check
      if (filterResult.score < config.contentFiltering.minQualityScore) {
        filterResult.allowed = false;
        filterResult.blocked = true;
        filterResult.reasons.push({
          rule: 'Quality Score',
          reason: `Quality score ${filterResult.score} below minimum threshold ${config.contentFiltering.minQualityScore}`,
          severity: 'medium'
        });
      }

      // Log filtering decision
      await this.logFilteringDecision(ad, context, filterResult);

      return filterResult;

    } catch (error) {
      console.error('Error filtering ad:', error);

      // Default to blocking on error for safety
      return {
        allowed: false,
        blocked: true,
        score: 0,
        reasons: [{ rule: 'Error', reason: 'Filtering error occurred', severity: 'high' }],
        warnings: [],
        modifications: []
      };
    }
  }

  async applyFilterRule(rule, ad, context) {
    const result = {
      action: 'allow',
      reason: '',
      severity: 'low',
      scoreDeduction: 0
    };

    try {
      const filterPassed = await rule.filter(ad, context);

      if (!filterPassed) {
        result.action = rule.action;
        result.reason = `Failed ${rule.name} check`;
        result.severity = this.getRuleSeverity(rule);
        result.scoreDeduction = this.getRuleScoreDeduction(rule);
      }

    } catch (error) {
      console.error(`Error applying filter rule ${rule.id}:`, error);
      result.action = 'warn';
      result.reason = `Filter rule error: ${error.message}`;
      result.severity = 'medium';
    }

    return result;
  }

  filterAdultContent(ad) {
    const adultCategory = this.brandSafetyCategories.get('adult');
    return !this.containsKeywords(ad, adultCategory.keywords);
  }

  filterCompetitors(ad) {
    // Check if ad domain is in blocked list
    if (ad.domain) {
      const domain = ad.domain.toLowerCase();
      if (this.blockedDomains.has(domain)) {
        return false;
      }
    }

    // Check if ad URL contains competitor domains
    if (ad.targetUrl) {
      const url = ad.targetUrl.toLowerCase();
      for (const blockedDomain of this.blockedDomains) {
        if (url.includes(blockedDomain)) {
          return false;
        }
      }
    }

    // Check for competitor keywords in ad content
    const competitorKeywords = [
      'turbo tax', 'turbotax', 'h&r block', 'hrblock',
      'free tax usa', 'freetaxusa', 'taxact', 'tax act'
    ];

    return !this.containsKeywords(ad, competitorKeywords);
  }

  async filterByQualityScore(ad) {
    const qualityScore = await this.calculateQualityScore(ad);
    return qualityScore >= config.contentFiltering.minQualityScore;
  }

  filterBrandSafety(ad) {
    // Check against all brand safety categories
    for (const [category, data] of this.brandSafetyCategories.entries()) {
      if (data.severity === 'high' && this.containsKeywords(ad, data.keywords)) {
        return false;
      }
    }

    return true;
  }

  filterContextualRelevance(ad, context) {
    if (!context.calculatorType || !ad.categories) {
      return true; // Allow if no context or categories available
    }

    const calculatorType = context.calculatorType;
    const relevantCategories = this.getRelevantCategories(calculatorType);

    // Check if ad categories overlap with relevant categories
    const adCategories = Array.isArray(ad.categories) ? ad.categories : [ad.categories];
    const hasRelevantCategory = adCategories.some(cat =>
      relevantCategories.includes(cat.toLowerCase())
    );

    return hasRelevantCategory;
  }

  filterGeographicCompliance(ad, context) {
    if (!context.country || !ad.restrictions) {
      return true; // Allow if no geographic restrictions
    }

    const country = context.country;
    const restrictions = ad.restrictions;

    // Check if ad is restricted in this country
    if (restrictions.blockedCountries && restrictions.blockedCountries.includes(country)) {
      return false;
    }

    // Check if ad is only allowed in specific countries
    if (restrictions.allowedCountries && !restrictions.allowedCountries.includes(country)) {
      return false;
    }

    // Check for specific compliance requirements
    return this.checkComplianceRequirements(ad, country);
  }

  containsKeywords(ad, keywords) {
    const searchableText = this.getSearchableText(ad).toLowerCase();

    return keywords.some(keyword =>
      searchableText.includes(keyword.toLowerCase())
    );
  }

  getSearchableText(ad) {
    const texts = [];

    if (ad.title) texts.push(ad.title);
    if (ad.description) texts.push(ad.description);
    if (ad.content) texts.push(ad.content);
    if (ad.domain) texts.push(ad.domain);
    if (ad.targetUrl) texts.push(ad.targetUrl);

    return texts.join(' ');
  }

  getRelevantCategories(calculatorType) {
    const relevantMap = {
      'income_tax': ['finance', 'tax_services', 'accounting', 'software'],
      'business_tax': ['business', 'accounting', 'legal_services', 'software'],
      'sales_tax': ['business', 'ecommerce', 'retail', 'software'],
      'property_tax': ['real_estate', 'insurance', 'legal_services']
    };

    return relevantMap[calculatorType] || ['finance', 'business'];
  }

  checkComplianceRequirements(ad, country) {
    // Country-specific compliance checks
    switch (country) {
      case 'US':
        return this.checkUSCompliance(ad);
      case 'CA':
        return this.checkCanadaCompliance(ad);
      case 'UK':
        return this.checkUKCompliance(ad);
      case 'DE':
        return this.checkGermanyCompliance(ad);
      default:
        return true; // Allow by default for other countries
    }
  }

  checkUSCompliance(ad) {
    // Check for US-specific requirements
    const prohibitedClaims = [
      'guaranteed income', 'risk-free investment', 'instant wealth'
    ];

    return !this.containsKeywords(ad, prohibitedClaims);
  }

  checkCanadaCompliance(ad) {
    // Canadian advertising standards
    const prohibitedTerms = [
      'tax evasion', 'hide income', 'avoid taxes illegally'
    ];

    return !this.containsKeywords(ad, prohibitedTerms);
  }

  checkUKCompliance(ad) {
    // UK ASA (Advertising Standards Authority) compliance
    const prohibitedClaims = [
      'tax avoidance scheme', 'offshore tax haven'
    ];

    return !this.containsKeywords(ad, prohibitedClaims);
  }

  checkGermanyCompliance(ad) {
    // German advertising regulations
    const prohibitedTerms = [
      'steuerhinterziehung', 'steuerumgehung' // tax evasion, tax avoidance
    ];

    return !this.containsKeywords(ad, prohibitedTerms);
  }

  async calculateQualityScore(ad) {
    let score = 10; // Start with perfect score

    try {
      // Get cached quality score if available
      const cacheKey = `quality_score:${ad.id || ad.advertiser}`;
      const cached = await this.redis.get(cacheKey);

      if (cached) {
        return parseFloat(cached);
      }

      // Brand reputation (check if advertiser is known and trusted)
      const brandScore = await this.getBrandReputationScore(ad.advertiser);
      score = score * (brandScore * this.qualityWeights.brandReputation);

      // Historical performance (CTR, conversion rate)
      const performanceScore = await this.getPerformanceScore(ad);
      score += performanceScore * this.qualityWeights.clickThroughRate;

      // User feedback and complaints
      const feedbackScore = await this.getUserFeedbackScore(ad);
      score += feedbackScore * this.qualityWeights.userFeedback;

      // Technical quality (loading speed, mobile optimization)
      const technicalScore = await this.getTechnicalQualityScore(ad);
      score += technicalScore * this.qualityWeights.technicalQuality;

      // Ensure score is within bounds
      score = Math.max(0, Math.min(10, score));

      // Cache the score for 1 hour
      await this.redis.setex(cacheKey, 3600, score.toString());

      return score;

    } catch (error) {
      console.error('Error calculating quality score:', error);
      return 5; // Return neutral score on error
    }
  }

  async getBrandReputationScore(advertiser) {
    if (!advertiser) return 0.5; // Neutral score for unknown advertisers

    // Check whitelist of trusted advertisers
    const trustedAdvertisers = [
      'google', 'microsoft', 'apple', 'amazon', 'intuit',
      'h&r block', 'turbotax', 'quickbooks', 'sage'
    ];

    const advertiserLower = advertiser.toLowerCase();
    if (trustedAdvertisers.some(trusted => advertiserLower.includes(trusted))) {
      return 1.0; // High trust score
    }

    // Check for warning signs
    const warningSignals = [
      'get rich quick', 'guaranteed', 'instant', 'miracle',
      'free money', 'work from home'
    ];

    if (warningSignals.some(signal => advertiserLower.includes(signal))) {
      return 0.1; // Very low trust score
    }

    return 0.7; // Default moderate trust score
  }

  async getPerformanceScore(ad) {
    // Get historical CTR and conversion data
    const performanceKey = `performance:${ad.advertiser || 'unknown'}`;
    const performance = await this.redis.hgetall(performanceKey);

    if (Object.keys(performance).length === 0) {
      return 0.5; // Neutral score for new advertisers
    }

    const ctr = parseFloat(performance.ctr || 0);
    const conversionRate = parseFloat(performance.conversion_rate || 0);

    // Score based on industry benchmarks
    let score = 0;

    // CTR scoring (industry average ~0.5-2%)
    if (ctr >= 0.02) score += 0.5; // Excellent CTR
    else if (ctr >= 0.01) score += 0.3; // Good CTR
    else if (ctr >= 0.005) score += 0.1; // Average CTR
    // Below 0.005% gets 0 points

    // Conversion rate scoring
    if (conversionRate >= 0.05) score += 0.5; // Excellent conversion
    else if (conversionRate >= 0.02) score += 0.3; // Good conversion
    else if (conversionRate >= 0.01) score += 0.1; // Average conversion

    return Math.min(1.0, score);
  }

  async getUserFeedbackScore(ad) {
    const feedbackKey = `feedback:${ad.advertiser || 'unknown'}`;
    const feedback = await this.redis.hgetall(feedbackKey);

    if (Object.keys(feedback).length === 0) {
      return 0.7; // Default neutral-positive score
    }

    const totalFeedback = parseInt(feedback.total || 0);
    const positiveFeedback = parseInt(feedback.positive || 0);
    const negativeFeedback = parseInt(feedback.negative || 0);

    if (totalFeedback === 0) return 0.7;

    const positiveRatio = positiveFeedback / totalFeedback;
    const negativeRatio = negativeFeedback / totalFeedback;

    // Score based on feedback ratio
    if (positiveRatio >= 0.8) return 1.0;
    if (positiveRatio >= 0.6) return 0.8;
    if (positiveRatio >= 0.4) return 0.6;
    if (negativeRatio >= 0.5) return 0.2;

    return 0.5;
  }

  async getTechnicalQualityScore(ad) {
    // Check technical aspects of the ad
    let score = 1.0;

    // Check if ad has proper mobile optimization
    if (!ad.mobileOptimized) {
      score -= 0.3;
    }

    // Check loading speed (if available)
    if (ad.loadTime && ad.loadTime > 3000) { // 3 seconds
      score -= 0.2;
    }

    // Check for proper SSL
    if (ad.targetUrl && !ad.targetUrl.startsWith('https://')) {
      score -= 0.2;
    }

    // Check for valid landing page
    if (ad.landingPageScore && ad.landingPageScore < 70) {
      score -= 0.3;
    }

    return Math.max(0, score);
  }

  async updateAdvertiserPerformance(advertiser, metrics) {
    const performanceKey = `performance:${advertiser}`;

    await this.redis.hmset(performanceKey, {
      ctr: metrics.ctr || 0,
      conversion_rate: metrics.conversionRate || 0,
      last_updated: Date.now()
    });

    await this.redis.expire(performanceKey, 86400 * 30); // Keep for 30 days
  }

  async updateUserFeedback(advertiser, feedback) {
    const feedbackKey = `feedback:${advertiser}`;

    if (feedback.type === 'positive') {
      await this.redis.hincrby(feedbackKey, 'positive', 1);
    } else if (feedback.type === 'negative') {
      await this.redis.hincrby(feedbackKey, 'negative', 1);
    }

    await this.redis.hincrby(feedbackKey, 'total', 1);
    await this.redis.expire(feedbackKey, 86400 * 30);
  }

  async logFilteringDecision(ad, context, result) {
    const logEntry = {
      timestamp: Date.now(),
      adId: ad.id,
      advertiser: ad.advertiser,
      decision: result.allowed ? 'allowed' : 'blocked',
      score: result.score,
      reasons: result.reasons,
      warnings: result.warnings,
      context: {
        country: context.country,
        device: context.device,
        calculatorType: context.calculatorType
      }
    };

    // Store in Redis list for recent filtering decisions
    await this.redis.lpush('filtering_log', JSON.stringify(logEntry));
    await this.redis.ltrim('filtering_log', 0, 999); // Keep last 1000 entries
    await this.redis.expire('filtering_log', 86400 * 7); // 7 days

    // Update filtering metrics
    await this.updateFilteringMetrics(result);
  }

  async updateFilteringMetrics(result) {
    const date = new Date().toISOString().split('T')[0];
    const metricsKey = `filtering_metrics:${date}`;

    await this.redis.hincrby(metricsKey, 'total_ads', 1);

    if (result.allowed) {
      await this.redis.hincrby(metricsKey, 'allowed_ads', 1);
    } else {
      await this.redis.hincrby(metricsKey, 'blocked_ads', 1);

      // Track blocking reasons
      for (const reason of result.reasons) {
        await this.redis.hincrby(metricsKey, `blocked_by_${reason.rule.replace(/\s+/g, '_').toLowerCase()}`, 1);
      }
    }

    await this.redis.expire(metricsKey, 86400 * 30); // Keep for 30 days
  }

  getRuleSeverity(rule) {
    const severityMap = {
      'adult_content_filter': 'high',
      'competitor_blocking': 'low',
      'quality_score_filter': 'medium',
      'brand_safety_filter': 'high',
      'contextual_relevance': 'low',
      'geographic_compliance': 'high'
    };

    return severityMap[rule.id] || 'medium';
  }

  getRuleScoreDeduction(rule) {
    const deductionMap = {
      'adult_content_filter': 10, // Complete failure
      'competitor_blocking': 8,
      'quality_score_filter': 5,
      'brand_safety_filter': 9,
      'contextual_relevance': 2,
      'geographic_compliance': 10
    };

    return deductionMap[rule.id] || 3;
  }

  async getFilteringReport(timeRange = '7d') {
    const report = {
      timeRange,
      totalAds: 0,
      allowedAds: 0,
      blockedAds: 0,
      blockingReasons: {},
      qualityScoreDistribution: {},
      topBlockedAdvertisers: [],
      filteringTrends: {}
    };

    try {
      const dates = this.getDateRange(timeRange);

      for (const date of dates) {
        const metricsKey = `filtering_metrics:${date}`;
        const metrics = await this.redis.hgetall(metricsKey);

        if (Object.keys(metrics).length > 0) {
          report.totalAds += parseInt(metrics.total_ads || 0);
          report.allowedAds += parseInt(metrics.allowed_ads || 0);
          report.blockedAds += parseInt(metrics.blocked_ads || 0);

          // Aggregate blocking reasons
          for (const [key, value] of Object.entries(metrics)) {
            if (key.startsWith('blocked_by_')) {
              const reason = key.replace('blocked_by_', '').replace(/_/g, ' ');
              report.blockingReasons[reason] = (report.blockingReasons[reason] || 0) + parseInt(value);
            }
          }
        }
      }

      // Calculate percentages
      if (report.totalAds > 0) {
        report.allowedPercentage = (report.allowedAds / report.totalAds * 100).toFixed(2);
        report.blockedPercentage = (report.blockedAds / report.totalAds * 100).toFixed(2);
      }

      // Sort blocking reasons
      report.blockingReasons = Object.fromEntries(
        Object.entries(report.blockingReasons).sort(([,a], [,b]) => b - a)
      );

    } catch (error) {
      console.error('Error generating filtering report:', error);
    }

    return report;
  }

  getDateRange(timeRange) {
    const dates = [];
    const endDate = new Date();
    const startDate = new Date();

    switch (timeRange) {
      case '24h':
        dates.push(endDate.toISOString().split('T')[0]);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      default:
        dates.push(endDate.toISOString().split('T')[0]);
        return dates;
    }

    if (timeRange !== '24h') {
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        dates.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    return dates;
  }

  async healthCheck() {
    try {
      await this.redis.ping();

      const logSize = await this.redis.llen('filtering_log');

      return {
        status: 'healthy',
        filterRules: this.filterRules.size,
        brandSafetyCategories: this.brandSafetyCategories.size,
        blockedDomains: this.blockedDomains.size,
        allowedCategories: this.allowedCategories.size,
        recentFilteringDecisions: logSize,
        adultContentFilterEnabled: config.contentFiltering.adultContentFilter,
        competitorBlockingEnabled: config.contentFiltering.competitorBlocking,
        brandSafetyEnabled: config.contentFiltering.brandSafetyEnabled
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

module.exports = new ContentFilteringService();