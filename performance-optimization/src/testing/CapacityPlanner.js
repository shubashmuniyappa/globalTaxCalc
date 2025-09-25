class CapacityPlanner {
  constructor(options = {}) {
    this.config = {
      targetGrowthRate: options.targetGrowthRate || 0.25,
      planningHorizon: options.planningHorizon || 12,
      safetyMargin: options.safetyMargin || 0.2,
      costThresholds: options.costThresholds || {
        low: 1000,
        medium: 5000,
        high: 15000
      },
      performanceTargets: {
        responseTime: options.performanceTargets?.responseTime || 500,
        throughput: options.performanceTargets?.throughput || 1000,
        errorRate: options.performanceTargets?.errorRate || 0.01,
        ...options.performanceTargets
      },
      ...options
    };

    this.historicalData = [];
    this.loadPatterns = {};
    this.resourceUtilization = {};
    this.projections = {};
  }

  addHistoricalData(data) {
    const entry = {
      timestamp: data.timestamp || Date.now(),
      metrics: {
        requests: data.requests || 0,
        responseTime: data.responseTime || 0,
        errorRate: data.errorRate || 0,
        cpuUsage: data.cpuUsage || 0,
        memoryUsage: data.memoryUsage || 0,
        activeUsers: data.activeUsers || 0,
        throughput: data.throughput || 0
      },
      resources: {
        servers: data.servers || 1,
        cpuCores: data.cpuCores || 4,
        memoryGB: data.memoryGB || 8,
        storageGB: data.storageGB || 100
      },
      costs: {
        infrastructure: data.costs?.infrastructure || 0,
        bandwidth: data.costs?.bandwidth || 0,
        storage: data.costs?.storage || 0,
        total: data.costs?.total || 0
      }
    };

    this.historicalData.push(entry);
    this.analyzeLoadPatterns();
    this.calculateResourceUtilization();
  }

  analyzeLoadPatterns() {
    if (this.historicalData.length < 7) return;

    const recentData = this.historicalData.slice(-168);

    this.loadPatterns = {
      hourly: this.analyzeHourlyPattern(recentData),
      daily: this.analyzeDailyPattern(recentData),
      weekly: this.analyzeWeeklyPattern(recentData),
      seasonal: this.analyzeSeasonalPattern(recentData),
      growth: this.analyzeGrowthPattern(recentData)
    };
  }

  analyzeHourlyPattern(data) {
    const hourlyAverages = Array(24).fill(0);
    const hourlyCounts = Array(24).fill(0);

    data.forEach(entry => {
      const hour = new Date(entry.timestamp).getHours();
      hourlyAverages[hour] += entry.metrics.requests;
      hourlyCounts[hour]++;
    });

    return hourlyAverages.map((sum, index) => ({
      hour: index,
      avgRequests: hourlyCounts[index] > 0 ? sum / hourlyCounts[index] : 0,
      peakMultiplier: this.calculatePeakMultiplier(hourlyAverages, index)
    }));
  }

  analyzeDailyPattern(data) {
    const dailyAverages = Array(7).fill(0);
    const dailyCounts = Array(7).fill(0);

    data.forEach(entry => {
      const day = new Date(entry.timestamp).getDay();
      dailyAverages[day] += entry.metrics.requests;
      dailyCounts[day]++;
    });

    return dailyAverages.map((sum, index) => ({
      day: index,
      avgRequests: dailyCounts[index] > 0 ? sum / dailyCounts[index] : 0,
      peakMultiplier: this.calculatePeakMultiplier(dailyAverages, index)
    }));
  }

  analyzeWeeklyPattern(data) {
    const weeklyData = this.groupByWeek(data);
    const weeklyGrowth = this.calculateWeeklyGrowth(weeklyData);

    return {
      averageWeeklyRequests: this.average(weeklyData.map(w => w.totalRequests)),
      growthRate: weeklyGrowth,
      volatility: this.calculateVolatility(weeklyData.map(w => w.totalRequests))
    };
  }

  analyzeSeasonalPattern(data) {
    const monthlyData = this.groupByMonth(data);

    return {
      monthlyAverages: monthlyData,
      seasonalMultipliers: this.calculateSeasonalMultipliers(monthlyData),
      yearOverYearGrowth: this.calculateYearOverYearGrowth(monthlyData)
    };
  }

  analyzeGrowthPattern(data) {
    const sortedData = data.sort((a, b) => a.timestamp - b.timestamp);

    if (sortedData.length < 30) {
      return { pattern: 'insufficient_data' };
    }

    const growth = this.calculateGrowthTrend(sortedData);
    const acceleration = this.calculateGrowthAcceleration(sortedData);

    return {
      pattern: this.classifyGrowthPattern(growth, acceleration),
      monthlyGrowthRate: growth.monthlyRate,
      acceleration: acceleration,
      predictability: this.calculatePredictability(sortedData),
      inflectionPoints: this.findInflectionPoints(sortedData)
    };
  }

  calculateResourceUtilization() {
    if (this.historicalData.length === 0) return;

    const recent = this.historicalData.slice(-24);

    this.resourceUtilization = {
      cpu: {
        average: this.average(recent.map(d => d.metrics.cpuUsage)),
        peak: Math.max(...recent.map(d => d.metrics.cpuUsage)),
        utilization: this.calculateResourceEfficiency('cpu', recent)
      },
      memory: {
        average: this.average(recent.map(d => d.metrics.memoryUsage)),
        peak: Math.max(...recent.map(d => d.metrics.memoryUsage)),
        utilization: this.calculateResourceEfficiency('memory', recent)
      },
      throughput: {
        average: this.average(recent.map(d => d.metrics.throughput)),
        peak: Math.max(...recent.map(d => d.metrics.throughput)),
        capacity: this.calculateThroughputCapacity(recent)
      }
    };
  }

  generateCapacityPlan() {
    console.log('📊 Generating capacity plan...');

    const projections = this.projectFutureLoad();
    const resourceRequirements = this.calculateResourceRequirements(projections);
    const costProjections = this.calculateCostProjections(resourceRequirements);
    const recommendations = this.generateRecommendations(projections, resourceRequirements);

    const plan = {
      summary: {
        planningHorizon: this.config.planningHorizon,
        projectedGrowth: projections.growth,
        resourceIncrease: resourceRequirements.summary,
        totalCostIncrease: costProjections.summary.totalIncrease,
        recommendedActions: recommendations.priority.length
      },
      projections: projections,
      resourceRequirements: resourceRequirements,
      costProjections: costProjections,
      recommendations: recommendations,
      scenarios: this.generateScenarios(),
      timeline: this.generateImplementationTimeline(recommendations),
      risks: this.identifyCapacityRisks(),
      timestamp: Date.now()
    };

    return plan;
  }

  projectFutureLoad() {
    const baseLoad = this.calculateBaselineLoad();
    const growthRate = this.loadPatterns.growth?.monthlyGrowthRate || this.config.targetGrowthRate;
    const seasonality = this.loadPatterns.seasonal?.seasonalMultipliers || {};

    const monthlyProjections = [];

    for (let month = 1; month <= this.config.planningHorizon; month++) {
      const growthMultiplier = Math.pow(1 + growthRate, month);
      const seasonalMultiplier = seasonality[month % 12] || 1;
      const safetyMultiplier = 1 + this.config.safetyMargin;

      const projection = {
        month: month,
        baseLoad: baseLoad,
        projectedLoad: baseLoad * growthMultiplier * seasonalMultiplier,
        safeCapacity: baseLoad * growthMultiplier * seasonalMultiplier * safetyMultiplier,
        confidence: this.calculateProjectionConfidence(month)
      };

      monthlyProjections.push(projection);
    }

    return {
      baseline: baseLoad,
      growth: growthRate,
      monthlyProjections: monthlyProjections,
      peakLoad: Math.max(...monthlyProjections.map(p => p.safeCapacity)),
      methodology: 'compound_growth_with_seasonality'
    };
  }

  calculateResourceRequirements(projections) {
    const currentCapacity = this.getCurrentCapacity();
    const peakLoad = projections.peakLoad;

    const requirements = {
      compute: this.calculateComputeRequirements(peakLoad, currentCapacity),
      memory: this.calculateMemoryRequirements(peakLoad, currentCapacity),
      storage: this.calculateStorageRequirements(peakLoad, currentCapacity),
      network: this.calculateNetworkRequirements(peakLoad, currentCapacity)
    };

    const summary = {
      serversNeeded: Math.ceil(requirements.compute.totalCores / 8),
      additionalServers: Math.max(0, Math.ceil(requirements.compute.totalCores / 8) - currentCapacity.servers),
      capacityIncrease: ((peakLoad / currentCapacity.throughput) - 1) * 100,
      estimatedCost: this.estimateInfrastructureCost(requirements)
    };

    return {
      current: currentCapacity,
      required: requirements,
      summary: summary,
      timeline: this.generateResourceTimeline(projections, requirements)
    };
  }

  calculateCostProjections(resourceRequirements) {
    const currentCosts = this.getCurrentCosts();
    const monthlyProjections = [];

    for (let month = 1; month <= this.config.planningHorizon; month++) {
      const scaleFactor = this.getScaleFactorForMonth(month);

      const projection = {
        month: month,
        infrastructure: currentCosts.infrastructure * scaleFactor,
        bandwidth: currentCosts.bandwidth * scaleFactor * 1.1,
        storage: currentCosts.storage * Math.pow(scaleFactor, 0.8),
        total: 0
      };

      projection.total = projection.infrastructure + projection.bandwidth + projection.storage;
      monthlyProjections.push(projection);
    }

    const summary = {
      currentMonthly: currentCosts.total,
      projectedMonthly: monthlyProjections[monthlyProjections.length - 1].total,
      totalIncrease: monthlyProjections[monthlyProjections.length - 1].total - currentCosts.total,
      totalCostOverPeriod: monthlyProjections.reduce((sum, p) => sum + p.total, 0)
    };

    return {
      current: currentCosts,
      monthlyProjections: monthlyProjections,
      summary: summary,
      costOptimizationOpportunities: this.identifyCostOptimizations()
    };
  }

  generateRecommendations(projections, resourceRequirements) {
    const recommendations = {
      immediate: [],
      shortTerm: [],
      longTerm: [],
      priority: []
    };

    if (resourceRequirements.summary.additionalServers > 0) {
      recommendations.immediate.push({
        type: 'scaling',
        priority: 'high',
        title: 'Increase Server Capacity',
        description: `Add ${resourceRequirements.summary.additionalServers} servers to handle projected load`,
        estimatedCost: resourceRequirements.summary.estimatedCost,
        timeline: '1-2 weeks',
        impact: 'Prevents capacity bottlenecks'
      });
    }

    if (this.resourceUtilization.cpu.average > 70) {
      recommendations.shortTerm.push({
        type: 'optimization',
        priority: 'medium',
        title: 'CPU Optimization',
        description: 'Optimize CPU-intensive operations to improve efficiency',
        estimatedCost: 0,
        timeline: '2-4 weeks',
        impact: 'Reduces CPU utilization by 15-25%'
      });
    }

    if (projections.growth > 0.5) {
      recommendations.longTerm.push({
        type: 'architecture',
        priority: 'high',
        title: 'Implement Auto-scaling',
        description: 'Deploy auto-scaling infrastructure to handle variable load',
        estimatedCost: this.config.costThresholds.medium,
        timeline: '2-3 months',
        impact: 'Dynamic capacity adjustment'
      });
    }

    recommendations.priority = [
      ...recommendations.immediate.filter(r => r.priority === 'high'),
      ...recommendations.shortTerm.filter(r => r.priority === 'high'),
      ...recommendations.longTerm.filter(r => r.priority === 'high')
    ];

    return recommendations;
  }

  generateScenarios() {
    const baseProjection = this.projections;

    return {
      conservative: this.generateScenario(0.1, 'Conservative growth with safety margins'),
      expected: this.generateScenario(this.config.targetGrowthRate, 'Expected growth based on historical data'),
      aggressive: this.generateScenario(this.config.targetGrowthRate * 2, 'Aggressive growth scenario'),
      recession: this.generateScenario(-0.1, 'Economic downturn scenario')
    };
  }

  generateScenario(growthRate, description) {
    return {
      description: description,
      growthRate: growthRate,
      projectedLoad: this.calculateScenarioLoad(growthRate),
      resourceRequirements: this.calculateScenarioResources(growthRate),
      estimatedCost: this.calculateScenarioCost(growthRate),
      risks: this.identifyScenarioRisks(growthRate)
    };
  }

  calculateBaselineLoad() {
    if (this.historicalData.length === 0) return 1000;

    const recent = this.historicalData.slice(-30);
    return this.average(recent.map(d => d.metrics.throughput));
  }

  getCurrentCapacity() {
    if (this.historicalData.length === 0) {
      return {
        servers: 1,
        cpuCores: 4,
        memoryGB: 8,
        throughput: 1000
      };
    }

    const latest = this.historicalData[this.historicalData.length - 1];
    return latest.resources;
  }

  getCurrentCosts() {
    if (this.historicalData.length === 0) {
      return {
        infrastructure: 500,
        bandwidth: 100,
        storage: 50,
        total: 650
      };
    }

    const latest = this.historicalData[this.historicalData.length - 1];
    return latest.costs;
  }

  identifyCapacityRisks() {
    return [
      {
        type: 'demand_surge',
        probability: 'medium',
        impact: 'high',
        description: 'Unexpected traffic surge could overwhelm capacity',
        mitigation: 'Implement auto-scaling and load balancing'
      },
      {
        type: 'resource_constraints',
        probability: 'low',
        impact: 'critical',
        description: 'Cloud provider resource limitations during peak demand',
        mitigation: 'Multi-cloud strategy and reserved capacity'
      },
      {
        type: 'budget_overrun',
        probability: 'medium',
        impact: 'medium',
        description: 'Infrastructure costs may exceed budget projections',
        mitigation: 'Cost monitoring and optimization strategies'
      }
    ];
  }

  average(arr) {
    return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }

  calculatePeakMultiplier(values, index) {
    const max = Math.max(...values);
    return max > 0 ? values[index] / max : 0;
  }

  groupByWeek(data) {
    const weeks = {};

    data.forEach(entry => {
      const week = this.getWeekNumber(new Date(entry.timestamp));
      if (!weeks[week]) {
        weeks[week] = { totalRequests: 0, count: 0 };
      }
      weeks[week].totalRequests += entry.metrics.requests;
      weeks[week].count++;
    });

    return Object.values(weeks);
  }

  getWeekNumber(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }
}

module.exports = CapacityPlanner;