const clickhouse = require('../utils/clickhouse');
const redis = require('../utils/redis');
const config = require('../config');
const logger = require('../utils/logger');

class FunnelAnalysisService {
  constructor() {
    this.funnelDefinitions = new Map();
    this.loadFunnelDefinitions();
  }

  // Create a new funnel definition
  async createFunnel(funnelConfig) {
    const funnelId = funnelConfig.id || this.generateFunnelId(funnelConfig.name);

    const funnel = {
      id: funnelId,
      name: funnelConfig.name,
      description: funnelConfig.description || '',
      steps: funnelConfig.steps, // Array of step definitions
      attribution_window: funnelConfig.attribution_window || 86400, // 24 hours default
      conversion_window: funnelConfig.conversion_window || 604800, // 7 days default
      filters: funnelConfig.filters || {}, // Global filters for the funnel
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Validate funnel configuration
    this.validateFunnelConfig(funnel);

    // Store funnel definition
    await redis.setCache(`funnel:definition:${funnelId}`, funnel, 86400 * 365); // 1 year
    this.funnelDefinitions.set(funnelId, funnel);

    logger.info(`Created funnel definition: ${funnelId} - ${funnel.name}`);
    return funnel;
  }

  // Analyze funnel performance
  async analyzeFunnel(funnelId, options = {}) {
    const funnel = await this.getFunnelDefinition(funnelId);
    if (!funnel) {
      throw new Error(`Funnel not found: ${funnelId}`);
    }

    const {
      start_date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
      end_date = new Date().toISOString(),
      segment_by = null, // e.g., 'country', 'device_type', 'traffic_source'
      cohort_period = null // e.g., 'daily', 'weekly', 'monthly'
    } = options;

    const analysis = {
      funnel_id: funnelId,
      funnel_name: funnel.name,
      period: { start_date, end_date },
      steps: [],
      overall_conversion_rate: 0,
      total_users: 0,
      segments: segment_by ? [] : null,
      cohorts: cohort_period ? [] : null,
      drop_off_analysis: [],
      attribution_analysis: {}
    };

    // Analyze each step
    for (let i = 0; i < funnel.steps.length; i++) {
      const step = funnel.steps[i];
      const stepAnalysis = await this.analyzeStep(funnel, i, start_date, end_date);
      analysis.steps.push(stepAnalysis);
    }

    // Calculate overall metrics
    if (analysis.steps.length > 0) {
      analysis.total_users = analysis.steps[0].users;
      analysis.overall_conversion_rate = analysis.steps.length > 1
        ? (analysis.steps[analysis.steps.length - 1].users / analysis.total_users) * 100
        : 0;
    }

    // Analyze drop-offs between steps
    analysis.drop_off_analysis = this.calculateDropOffs(analysis.steps);

    // Segment analysis if requested
    if (segment_by) {
      analysis.segments = await this.analyzeBySegment(funnel, segment_by, start_date, end_date);
    }

    // Cohort analysis if requested
    if (cohort_period) {
      analysis.cohorts = await this.analyzeByCohort(funnel, cohort_period, start_date, end_date);
    }

    // Attribution analysis
    analysis.attribution_analysis = await this.analyzeAttribution(funnel, start_date, end_date);

    return analysis;
  }

  // Analyze a specific funnel step
  async analyzeStep(funnel, stepIndex, startDate, endDate) {
    const step = funnel.steps[stepIndex];
    const isFirstStep = stepIndex === 0;

    let query;
    if (isFirstStep) {
      // For first step, count all users who performed the action
      query = `
        SELECT
          count(DISTINCT session_id) as users,
          count() as events,
          toStartOfDay(timestamp) as date,
          countIf(timestamp <= timestamp + INTERVAL ${funnel.conversion_window} SECOND) as within_window
        FROM events
        WHERE ${this.buildStepCondition(step)}
          AND timestamp >= '${startDate}'
          AND timestamp <= '${endDate}'
          ${this.buildGlobalFilters(funnel.filters)}
        GROUP BY date
        ORDER BY date
      `;
    } else {
      // For subsequent steps, only count users who completed previous steps
      const previousSteps = funnel.steps.slice(0, stepIndex);
      query = `
        WITH previous_users AS (
          ${this.buildPreviousStepsQuery(previousSteps, startDate, endDate, funnel)}
        )
        SELECT
          count(DISTINCT e.session_id) as users,
          count() as events,
          toStartOfDay(e.timestamp) as date
        FROM events e
        INNER JOIN previous_users pu ON e.session_id = pu.session_id
        WHERE ${this.buildStepCondition(step)}
          AND e.timestamp >= '${startDate}'
          AND e.timestamp <= '${endDate}'
          AND e.timestamp >= pu.first_step_time
          AND e.timestamp <= pu.first_step_time + INTERVAL ${funnel.conversion_window} SECOND
          ${this.buildGlobalFilters(funnel.filters)}
        GROUP BY date
        ORDER BY date
      `;
    }

    try {
      const results = await clickhouse.query(query);
      const totalUsers = results.reduce((sum, row) => sum + (row.users || 0), 0);
      const totalEvents = results.reduce((sum, row) => sum + (row.events || 0), 0);

      return {
        step_index: stepIndex,
        step_name: step.name,
        step_condition: step.condition,
        users: totalUsers,
        events: totalEvents,
        conversion_rate: stepIndex > 0 ? this.calculateStepConversionRate(funnel, stepIndex, startDate, endDate) : 100,
        daily_breakdown: results
      };
    } catch (error) {
      logger.error(`Error analyzing step ${stepIndex}:`, error);
      throw error;
    }
  }

  // Calculate conversion rate for a specific step
  async calculateStepConversionRate(funnel, stepIndex, startDate, endDate) {
    if (stepIndex === 0) return 100;

    const currentStepUsers = await this.getStepUsers(funnel, stepIndex, startDate, endDate);
    const previousStepUsers = await this.getStepUsers(funnel, stepIndex - 1, startDate, endDate);

    return previousStepUsers > 0 ? (currentStepUsers / previousStepUsers) * 100 : 0;
  }

  // Get user count for a specific step
  async getStepUsers(funnel, stepIndex, startDate, endDate) {
    const step = funnel.steps[stepIndex];

    if (stepIndex === 0) {
      const query = `
        SELECT count(DISTINCT session_id) as users
        FROM events
        WHERE ${this.buildStepCondition(step)}
          AND timestamp >= '${startDate}'
          AND timestamp <= '${endDate}'
          ${this.buildGlobalFilters(funnel.filters)}
      `;

      const result = await clickhouse.query(query);
      return result[0]?.users || 0;
    } else {
      // Build query for users who completed all previous steps
      const previousSteps = funnel.steps.slice(0, stepIndex + 1);
      const query = this.buildSequentialFunnelQuery(previousSteps, startDate, endDate, funnel);

      const result = await clickhouse.query(query);
      return result[0]?.users || 0;
    }
  }

  // Build query for users who completed sequential steps
  buildSequentialFunnelQuery(steps, startDate, endDate, funnel) {
    const stepQueries = steps.map((step, index) => `
      step_${index} AS (
        SELECT DISTINCT session_id, min(timestamp) as step_time
        FROM events
        WHERE ${this.buildStepCondition(step)}
          AND timestamp >= '${startDate}'
          AND timestamp <= '${endDate}'
          ${this.buildGlobalFilters(funnel.filters)}
        GROUP BY session_id
      )
    `);

    const joinConditions = steps.slice(1).map((_, index) => {
      const currentIndex = index + 1;
      const previousIndex = index;
      return `
        INNER JOIN step_${currentIndex} s${currentIndex}
        ON s${previousIndex}.session_id = s${currentIndex}.session_id
        AND s${currentIndex}.step_time >= s${previousIndex}.step_time
        AND s${currentIndex}.step_time <= s${previousIndex}.step_time + INTERVAL ${funnel.conversion_window} SECOND
      `;
    }).join('');

    return `
      WITH ${stepQueries.join(', ')}
      SELECT count(DISTINCT s0.session_id) as users
      FROM step_0 s0
      ${joinConditions}
    `;
  }

  // Analyze funnel by segments
  async analyzeBySegment(funnel, segmentBy, startDate, endDate) {
    const segmentField = this.getSegmentField(segmentBy);
    const segments = [];

    // Get all unique segment values
    const segmentValuesQuery = `
      SELECT DISTINCT ${segmentField} as segment_value
      FROM events
      WHERE timestamp >= '${startDate}'
        AND timestamp <= '${endDate}'
        ${this.buildGlobalFilters(funnel.filters)}
      ORDER BY segment_value
    `;

    const segmentValues = await clickhouse.query(segmentValuesQuery);

    for (const segmentRow of segmentValues) {
      const segmentValue = segmentRow.segment_value;
      const segmentFilter = `AND ${segmentField} = '${segmentValue}'`;

      const segmentAnalysis = {
        segment_value: segmentValue,
        steps: []
      };

      // Analyze each step for this segment
      for (let i = 0; i < funnel.steps.length; i++) {
        const stepUsers = await this.getStepUsersWithFilter(funnel, i, startDate, endDate, segmentFilter);
        const conversionRate = i > 0
          ? await this.getStepConversionRateWithFilter(funnel, i, startDate, endDate, segmentFilter)
          : 100;

        segmentAnalysis.steps.push({
          step_index: i,
          users: stepUsers,
          conversion_rate: conversionRate
        });
      }

      // Calculate segment overall conversion rate
      if (segmentAnalysis.steps.length > 0) {
        const firstStepUsers = segmentAnalysis.steps[0].users;
        const lastStepUsers = segmentAnalysis.steps[segmentAnalysis.steps.length - 1].users;
        segmentAnalysis.overall_conversion_rate = firstStepUsers > 0
          ? (lastStepUsers / firstStepUsers) * 100
          : 0;
      }

      segments.push(segmentAnalysis);
    }

    return segments;
  }

  // Analyze funnel by cohorts
  async analyzeByCohort(funnel, cohortPeriod, startDate, endDate) {
    const dateFormat = this.getCohortDateFormat(cohortPeriod);
    const cohorts = [];

    const cohortQuery = `
      SELECT DISTINCT ${dateFormat}(timestamp) as cohort_date
      FROM events
      WHERE timestamp >= '${startDate}'
        AND timestamp <= '${endDate}'
        ${this.buildGlobalFilters(funnel.filters)}
      ORDER BY cohort_date
    `;

    const cohortDates = await clickhouse.query(cohortQuery);

    for (const cohortRow of cohortDates) {
      const cohortDate = cohortRow.cohort_date;
      const cohortStart = this.getCohortStartDate(cohortDate, cohortPeriod);
      const cohortEnd = this.getCohortEndDate(cohortDate, cohortPeriod);

      const cohortAnalysis = {
        cohort_date: cohortDate,
        period: cohortPeriod,
        steps: []
      };

      // Analyze each step for this cohort
      for (let i = 0; i < funnel.steps.length; i++) {
        const stepUsers = await this.getStepUsers(funnel, i, cohortStart, cohortEnd);
        const conversionRate = i > 0
          ? await this.calculateStepConversionRate(funnel, i, cohortStart, cohortEnd)
          : 100;

        cohortAnalysis.steps.push({
          step_index: i,
          users: stepUsers,
          conversion_rate: conversionRate
        });
      }

      cohorts.push(cohortAnalysis);
    }

    return cohorts;
  }

  // Analyze attribution
  async analyzeAttribution(funnel, startDate, endDate) {
    const attributionQuery = `
      WITH conversions AS (
        SELECT
          session_id,
          user_id,
          timestamp as conversion_time
        FROM events
        WHERE ${this.buildStepCondition(funnel.steps[funnel.steps.length - 1])}
          AND timestamp >= '${startDate}'
          AND timestamp <= '${endDate}'
          ${this.buildGlobalFilters(funnel.filters)}
      ),
      touchpoints AS (
        SELECT
          e.session_id,
          e.user_id,
          e.timestamp,
          e.page_url,
          s.traffic_source,
          s.campaign,
          s.medium
        FROM events e
        INNER JOIN sessions s ON e.session_id = s.session_id
        INNER JOIN conversions c ON e.session_id = c.session_id
        WHERE e.timestamp <= c.conversion_time
          AND e.timestamp >= c.conversion_time - INTERVAL ${funnel.attribution_window} SECOND
      )
      SELECT
        traffic_source,
        campaign,
        medium,
        count(DISTINCT session_id) as attributed_conversions,
        count(DISTINCT user_id) as attributed_users
      FROM touchpoints
      GROUP BY traffic_source, campaign, medium
      ORDER BY attributed_conversions DESC
    `;

    const attributionResults = await clickhouse.query(attributionQuery);

    return {
      attribution_window: funnel.attribution_window,
      touchpoints: attributionResults,
      total_attributed_conversions: attributionResults.reduce((sum, row) => sum + row.attributed_conversions, 0)
    };
  }

  // Calculate drop-offs between steps
  calculateDropOffs(steps) {
    const dropOffs = [];

    for (let i = 1; i < steps.length; i++) {
      const previousStep = steps[i - 1];
      const currentStep = steps[i];

      const dropOffUsers = previousStep.users - currentStep.users;
      const dropOffRate = previousStep.users > 0 ? (dropOffUsers / previousStep.users) * 100 : 0;

      dropOffs.push({
        from_step: i - 1,
        to_step: i,
        from_step_name: previousStep.step_name,
        to_step_name: currentStep.step_name,
        drop_off_users: dropOffUsers,
        drop_off_rate: dropOffRate,
        conversion_rate: currentStep.conversion_rate
      });
    }

    return dropOffs;
  }

  // Real-time funnel tracking
  async trackFunnelEvent(funnelId, sessionId, stepName, eventData = {}) {
    const funnel = await this.getFunnelDefinition(funnelId);
    if (!funnel) {
      return false;
    }

    const step = funnel.steps.find(s => s.name === stepName);
    if (!step) {
      return false;
    }

    const stepIndex = funnel.steps.indexOf(step);

    // Store funnel progress in Redis for real-time tracking
    const progressKey = `funnel:progress:${sessionId}:${funnelId}`;
    const progress = await redis.getCache(progressKey) || {
      funnel_id: funnelId,
      session_id: sessionId,
      steps_completed: [],
      current_step: -1,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Update progress
    if (!progress.steps_completed.includes(stepIndex)) {
      progress.steps_completed.push(stepIndex);
      progress.steps_completed.sort((a, b) => a - b);
      progress.current_step = Math.max(...progress.steps_completed);
      progress.updated_at = new Date().toISOString();

      // Store progress
      await redis.setCache(progressKey, progress, funnel.conversion_window);

      logger.debug(`Funnel progress updated: ${sessionId} reached step ${stepIndex} in funnel ${funnelId}`);
      return true;
    }

    return false;
  }

  // Get funnel progress for session
  async getFunnelProgress(sessionId, funnelId) {
    const progressKey = `funnel:progress:${sessionId}:${funnelId}`;
    return await redis.getCache(progressKey);
  }

  // Utility functions
  getFunnelDefinition(funnelId) {
    if (this.funnelDefinitions.has(funnelId)) {
      return this.funnelDefinitions.get(funnelId);
    }
    return null;
  }

  generateFunnelId(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  validateFunnelConfig(funnel) {
    if (!funnel.name) {
      throw new Error('Funnel name is required');
    }

    if (!funnel.steps || !Array.isArray(funnel.steps) || funnel.steps.length < 2) {
      throw new Error('At least 2 steps are required');
    }

    for (const step of funnel.steps) {
      if (!step.name || !step.condition) {
        throw new Error('Step must have name and condition');
      }
    }
  }

  buildStepCondition(step) {
    const conditions = [];

    if (step.event_type) {
      conditions.push(`event_type = '${step.event_type}'`);
    }

    if (step.page_url) {
      if (step.page_url.includes('*')) {
        conditions.push(`page_url LIKE '${step.page_url.replace('*', '%')}'`);
      } else {
        conditions.push(`page_url = '${step.page_url}'`);
      }
    }

    if (step.custom_condition) {
      conditions.push(step.custom_condition);
    }

    return conditions.length > 0 ? conditions.join(' AND ') : '1=1';
  }

  buildGlobalFilters(filters) {
    const conditions = [];

    if (filters.exclude_bots) {
      conditions.push('is_bot = 0');
    }

    if (filters.countries && filters.countries.length > 0) {
      const countryList = filters.countries.map(c => `'${c}'`).join(',');
      conditions.push(`country IN (${countryList})`);
    }

    if (filters.device_types && filters.device_types.length > 0) {
      const deviceList = filters.device_types.map(d => `'${d}'`).join(',');
      conditions.push(`device_type IN (${deviceList})`);
    }

    return conditions.length > 0 ? ` AND ${conditions.join(' AND ')}` : '';
  }

  buildPreviousStepsQuery(steps, startDate, endDate, funnel) {
    if (steps.length === 1) {
      return `
        SELECT DISTINCT session_id, min(timestamp) as first_step_time
        FROM events
        WHERE ${this.buildStepCondition(steps[0])}
          AND timestamp >= '${startDate}'
          AND timestamp <= '${endDate}'
          ${this.buildGlobalFilters(funnel.filters)}
        GROUP BY session_id
      `;
    }

    return this.buildSequentialFunnelQuery(steps, startDate, endDate, funnel);
  }

  getSegmentField(segmentBy) {
    const fieldMap = {
      'country': 'country',
      'device_type': 'device_type',
      'browser': 'browser',
      'os': 'os',
      'traffic_source': 'traffic_source'
    };

    return fieldMap[segmentBy] || segmentBy;
  }

  getCohortDateFormat(period) {
    const formatMap = {
      'daily': 'toStartOfDay',
      'weekly': 'toStartOfWeek',
      'monthly': 'toStartOfMonth'
    };

    return formatMap[period] || 'toStartOfDay';
  }

  getCohortStartDate(cohortDate, period) {
    // Implementation depends on the specific date format returned by ClickHouse
    return cohortDate;
  }

  getCohortEndDate(cohortDate, period) {
    const date = new Date(cohortDate);
    switch (period) {
      case 'daily':
        date.setDate(date.getDate() + 1);
        break;
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
    }
    return date.toISOString();
  }

  async getStepUsersWithFilter(funnel, stepIndex, startDate, endDate, additionalFilter) {
    const step = funnel.steps[stepIndex];

    const query = `
      SELECT count(DISTINCT session_id) as users
      FROM events
      WHERE ${this.buildStepCondition(step)}
        AND timestamp >= '${startDate}'
        AND timestamp <= '${endDate}'
        ${this.buildGlobalFilters(funnel.filters)}
        ${additionalFilter}
    `;

    const result = await clickhouse.query(query);
    return result[0]?.users || 0;
  }

  async getStepConversionRateWithFilter(funnel, stepIndex, startDate, endDate, additionalFilter) {
    if (stepIndex === 0) return 100;

    const currentStepUsers = await this.getStepUsersWithFilter(funnel, stepIndex, startDate, endDate, additionalFilter);
    const previousStepUsers = await this.getStepUsersWithFilter(funnel, stepIndex - 1, startDate, endDate, additionalFilter);

    return previousStepUsers > 0 ? (currentStepUsers / previousStepUsers) * 100 : 0;
  }

  async loadFunnelDefinitions() {
    // Load predefined funnels
    const defaultFunnels = [
      {
        id: 'tax_calculator_conversion',
        name: 'Tax Calculator Conversion',
        description: 'Users who complete tax calculation process',
        steps: [
          {
            name: 'calculator_start',
            event_type: 'calculator_start',
            condition: 'event_type = "calculator_start"'
          },
          {
            name: 'calculator_input',
            event_type: 'calculator_step',
            condition: 'event_type = "calculator_step"'
          },
          {
            name: 'calculator_complete',
            event_type: 'calculator_complete',
            condition: 'event_type = "calculator_complete"'
          }
        ],
        attribution_window: 3600, // 1 hour
        conversion_window: 1800, // 30 minutes
        filters: { exclude_bots: true }
      },
      {
        id: 'ad_click_conversion',
        name: 'Ad Click Conversion',
        description: 'Users who click ads and complete actions',
        steps: [
          {
            name: 'page_view',
            event_type: 'page_view',
            condition: 'event_type = "page_view"'
          },
          {
            name: 'ad_click',
            event_type: 'click',
            condition: 'event_type = "click" AND JSON_EXTRACT_STRING(properties, "element_type") = "ad"'
          },
          {
            name: 'conversion',
            event_type: 'conversion',
            condition: 'event_type = "conversion"'
          }
        ],
        attribution_window: 86400, // 24 hours
        conversion_window: 3600, // 1 hour
        filters: { exclude_bots: true }
      }
    ];

    for (const funnel of defaultFunnels) {
      this.funnelDefinitions.set(funnel.id, funnel);
      await redis.setCache(`funnel:definition:${funnel.id}`, funnel, 86400 * 365);
    }

    logger.info(`Loaded ${defaultFunnels.length} default funnel definitions`);
  }
}

module.exports = new FunnelAnalysisService();