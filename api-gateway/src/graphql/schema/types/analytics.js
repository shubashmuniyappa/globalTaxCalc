/**
 * Analytics GraphQL Type Definitions
 * Analytics, reporting, and data insights types
 */

const { gql } = require('graphql-tag');

const analyticsTypeDefs = gql`
  extend type Query {
    # Overview Analytics
    getAnalyticsOverview(
      period: AnalyticsPeriod!
      filters: [AnalyticsFilterInput!]
    ): AnalyticsOverview! @auth(role: USER)

    # User Analytics
    getUserAnalytics(
      userId: ID
      period: AnalyticsPeriod!
    ): UserAnalytics! @auth(role: USER)

    # Tax Calculation Analytics
    getTaxCalculationAnalytics(
      period: AnalyticsPeriod!
      filters: [AnalyticsFilterInput!]
    ): TaxCalculationAnalytics! @auth(role: USER)

    # API Analytics
    getAPIAnalytics(
      period: AnalyticsPeriod!
      filters: [AnalyticsFilterInput!]
    ): APIAnalytics! @auth(role: USER)

    # Performance Analytics
    getPerformanceAnalytics(
      period: AnalyticsPeriod!
    ): PerformanceAnalytics! @auth(role: USER)

    # Business Intelligence
    getBusinessIntelligence(
      period: AnalyticsPeriod!
      metrics: [BusinessMetric!]!
    ): BusinessIntelligence! @auth(role: BUSINESS)

    # Custom Reports
    getCustomReports(
      pagination: PaginationInput
    ): CustomReportConnection! @auth(role: USER)

    getCustomReport(id: ID!): CustomReport! @auth(role: USER)

    # Scheduled Reports
    getScheduledReports(
      pagination: PaginationInput
    ): ScheduledReportConnection! @auth(role: USER)

    # Real-time Analytics
    getRealTimeAnalytics: RealTimeAnalytics! @auth(role: USER)

    # Comparative Analytics
    getComparativeAnalytics(
      input: ComparativeAnalyticsInput!
    ): ComparativeAnalytics! @auth(role: USER)

    # Predictive Analytics
    getPredictiveAnalytics(
      input: PredictiveAnalyticsInput!
    ): PredictiveAnalytics! @auth(role: PREMIUM)

    # Benchmarking
    getBenchmarkAnalytics(
      input: BenchmarkAnalyticsInput!
    ): BenchmarkAnalytics! @auth(role: BUSINESS)

    # Admin Analytics
    getSystemAnalytics(
      period: AnalyticsPeriod!
    ): SystemAnalytics! @auth(role: ADMIN)

    getRevenueAnalytics(
      period: AnalyticsPeriod!
    ): RevenueAnalytics! @auth(role: ADMIN)

    getUserBehaviorAnalytics(
      period: AnalyticsPeriod!
    ): UserBehaviorAnalytics! @auth(role: ADMIN)
  }

  extend type Mutation {
    # Custom Reports
    createCustomReport(input: CreateCustomReportInput!): CustomReport! @auth(role: USER)
    updateCustomReport(id: ID!, input: UpdateCustomReportInput!): CustomReport! @auth(role: USER)
    deleteCustomReport(id: ID!): OperationResponse! @auth(role: USER)
    generateCustomReport(id: ID!): ReportGenerationResult! @auth(role: USER)

    # Scheduled Reports
    createScheduledReport(input: CreateScheduledReportInput!): ScheduledReport! @auth(role: USER)
    updateScheduledReport(id: ID!, input: UpdateScheduledReportInput!): ScheduledReport! @auth(role: USER)
    deleteScheduledReport(id: ID!): OperationResponse! @auth(role: USER)
    pauseScheduledReport(id: ID!): OperationResponse! @auth(role: USER)
    resumeScheduledReport(id: ID!): OperationResponse! @auth(role: USER)

    # Analytics Configuration
    updateAnalyticsSettings(input: AnalyticsSettingsInput!): AnalyticsSettings! @auth(role: USER)

    # Data Export
    exportAnalyticsData(input: AnalyticsExportInput!): DataExport! @auth(role: USER)

    # Event Tracking
    trackCustomEvent(input: CustomEventInput!): OperationResponse! @auth(role: USER)
    trackConversion(input: ConversionEventInput!): OperationResponse! @auth(role: USER)

    # Goals and KPIs
    createAnalyticsGoal(input: CreateAnalyticsGoalInput!): AnalyticsGoal! @auth(role: USER)
    updateAnalyticsGoal(id: ID!, input: UpdateAnalyticsGoalInput!): AnalyticsGoal! @auth(role: USER)
    deleteAnalyticsGoal(id: ID!): OperationResponse! @auth(role: USER)

    # Alerts
    createAnalyticsAlert(input: CreateAnalyticsAlertInput!): AnalyticsAlert! @auth(role: USER)
    updateAnalyticsAlert(id: ID!, input: UpdateAnalyticsAlertInput!): AnalyticsAlert! @auth(role: USER)
    deleteAnalyticsAlert(id: ID!): OperationResponse! @auth(role: USER)
  }

  extend type Subscription {
    # Real-time Analytics Updates
    analyticsUpdate(userId: ID!): AnalyticsUpdate! @auth(role: USER)
    realTimeMetrics(metrics: [MetricType!]!): RealTimeMetric! @auth(role: USER)

    # Alert Notifications
    analyticsAlert(userId: ID!): AnalyticsAlert! @auth(role: USER)
    goalUpdate(userId: ID!): GoalUpdate! @auth(role: USER)

    # Report Generation
    reportGenerated(userId: ID!): ReportGenerationResult! @auth(role: USER)

    # System Analytics (Admin)
    systemMetricUpdate: SystemMetricUpdate! @auth(role: ADMIN)
    performanceAlert: PerformanceAlert! @auth(role: ADMIN)
  }

  # Core Analytics Types
  type AnalyticsOverview {
    period: AnalyticsPeriod!
    summary: AnalyticsSummary!
    metrics: [AnalyticsMetric!]!
    trends: [AnalyticsTrend!]!
    comparisons: [AnalyticsComparison!]!
    insights: [AnalyticsInsight!]!
    lastUpdated: DateTime!
  }

  type AnalyticsSummary {
    totalUsers: Int!
    activeUsers: Int!
    newUsers: Int!
    totalSessions: Int!
    avgSessionDuration: Int!
    bounceRate: Percentage!
    conversionRate: Percentage!
    revenue: Currency!
    growth: GrowthMetrics!
  }

  type GrowthMetrics {
    users: Percentage!
    sessions: Percentage!
    revenue: Percentage!
    conversions: Percentage!
  }

  type AnalyticsMetric {
    name: String!
    value: Float!
    change: Float!
    changePercentage: Percentage!
    trend: TrendDirection!
    unit: String
    format: MetricFormat!
    description: String
    benchmark: Float
    target: Float
  }

  type AnalyticsTrend {
    metric: String!
    data: [TrendDataPoint!]!
    correlation: Float
    seasonality: SeasonalityData
    forecast: [ForecastPoint!]
  }

  type TrendDataPoint {
    timestamp: DateTime!
    value: Float!
    label: String
  }

  type SeasonalityData {
    detected: Boolean!
    period: String
    strength: Float!
    patterns: [SeasonalPattern!]
  }

  type SeasonalPattern {
    period: String!
    amplitude: Float!
    phase: Float!
  }

  type ForecastPoint {
    timestamp: DateTime!
    value: Float!
    confidence: ConfidenceInterval!
  }

  type ConfidenceInterval {
    lower: Float!
    upper: Float!
    level: Percentage!
  }

  type AnalyticsComparison {
    metric: String!
    current: Float!
    previous: Float!
    change: Float!
    changePercentage: Percentage!
    significance: StatisticalSignificance!
  }

  type StatisticalSignificance {
    pValue: Float!
    significant: Boolean!
    confidenceLevel: Percentage!
  }

  type AnalyticsInsight {
    id: ID!
    type: InsightType!
    title: String!
    description: String!
    impact: InsightImpact!
    confidence: Percentage!
    actionable: Boolean!
    recommendations: [String!]!
    data: JSON
    generatedAt: DateTime!
  }

  # User Analytics
  type UserAnalytics {
    user: User!
    period: AnalyticsPeriod!
    activity: UserActivityAnalytics!
    usage: UserUsageAnalytics!
    engagement: UserEngagementAnalytics!
    performance: UserPerformanceAnalytics!
    preferences: UserPreferenceAnalytics!
    journey: UserJourneyAnalytics!
  }

  type UserActivityAnalytics {
    totalSessions: Int!
    avgSessionDuration: Int!
    totalPageViews: Int!
    uniquePageViews: Int!
    bounceRate: Percentage!
    activityTimeline: [ActivityTimelinePoint!]!
    deviceBreakdown: [DeviceUsage!]!
    locationBreakdown: [LocationUsage!]!
  }

  type ActivityTimelinePoint {
    timestamp: DateTime!
    action: String!
    page: String
    duration: Int
    metadata: JSON
  }

  type DeviceUsage {
    device: DeviceType!
    sessions: Int!
    percentage: Percentage!
    avgDuration: Int!
  }

  type LocationUsage {
    country: Country!
    city: String
    sessions: Int!
    percentage: Percentage!
  }

  type UserUsageAnalytics {
    calculationsCount: Int!
    reportsGenerated: Int!
    apiCallsMade: Int!
    featuresUsed: [FeatureUsage!]!
    subscriptionUtilization: SubscriptionUtilization!
    costEfficiency: CostEfficiencyMetrics!
  }

  type FeatureUsage {
    feature: String!
    usageCount: Int!
    lastUsed: DateTime!
    frequency: UsageFrequency!
    proficiency: ProficiencyLevel!
  }

  type SubscriptionUtilization {
    plan: String!
    utilizationRate: Percentage!
    limitReached: [String!]!
    underutilized: [String!]!
    recommendations: [String!]!
  }

  type CostEfficiencyMetrics {
    costPerCalculation: Currency!
    costPerAPICall: Currency!
    valueGenerated: Currency!
    roi: Percentage!
  }

  type UserEngagementAnalytics {
    engagementScore: Float!
    recency: Int!
    frequency: Float!
    retention: RetentionMetrics!
    satisfaction: SatisfactionMetrics!
    loyalty: LoyaltyMetrics!
  }

  type RetentionMetrics {
    day1: Boolean!
    day7: Boolean!
    day30: Boolean!
    day90: Boolean!
    cohortRetention: [CohortRetentionPoint!]!
  }

  type CohortRetentionPoint {
    period: String!
    retained: Int!
    total: Int!
    rate: Percentage!
  }

  type SatisfactionMetrics {
    overallScore: Float!
    nps: Float
    csat: Float
    ces: Float
    feedback: [FeedbackSummary!]!
  }

  type FeedbackSummary {
    category: String!
    sentiment: SentimentType!
    count: Int!
    avgRating: Float!
  }

  type LoyaltyMetrics {
    loyaltyScore: Float!
    referrals: Int!
    advocacy: Float!
    churnRisk: ChurnRiskLevel!
    lifetimeValue: Currency!
  }

  type UserPerformanceAnalytics {
    productivity: ProductivityMetrics!
    accuracy: AccuracyMetrics!
    efficiency: EfficiencyMetrics!
    learning: LearningMetrics!
  }

  type ProductivityMetrics {
    calculationsPerHour: Float!
    timeToCompletion: Int!
    automationUsage: Percentage!
    multitasking: Float!
  }

  type AccuracyMetrics {
    errorRate: Percentage!
    correctionFrequency: Float!
    validationSuccess: Percentage!
    commonMistakes: [String!]!
  }

  type EfficiencyMetrics {
    workflowOptimization: Percentage!
    featureAdoption: Percentage!
    timeToValue: Int!
    resourceUtilization: Percentage!
  }

  type LearningMetrics {
    skillProgression: Float!
    knowledgeRetention: Percentage!
    helpResourceUsage: [HelpResourceUsage!]!
    competencyLevel: CompetencyLevel!
  }

  type HelpResourceUsage {
    resource: String!
    accessCount: Int!
    usefulness: Float!
  }

  type UserPreferenceAnalytics {
    featurePreferences: [FeaturePreference!]!
    workflowPatterns: [WorkflowPattern!]!
    communicationPreferences: CommunicationPreferenceAnalytics!
    customizations: [CustomizationUsage!]!
  }

  type FeaturePreference {
    feature: String!
    usage: Float!
    preference: PreferenceLevel!
    feedback: String
  }

  type WorkflowPattern {
    pattern: String!
    frequency: Float!
    efficiency: Float!
    satisfaction: Float!
  }

  type CommunicationPreferenceAnalytics {
    channels: [ChannelPreference!]!
    frequency: FrequencyPreference!
    timing: TimingPreference!
    content: ContentPreference!
  }

  type ChannelPreference {
    channel: CommunicationChannel!
    preference: PreferenceLevel!
    engagement: Float!
  }

  type FrequencyPreference {
    preferred: NotificationFrequency!
    actual: NotificationFrequency!
    satisfaction: Float!
  }

  type TimingPreference {
    preferredHours: [Int!]!
    timeZone: String!
    workingDays: [String!]!
  }

  type ContentPreference {
    types: [ContentTypePreference!]!
    topics: [TopicPreference!]!
    formats: [FormatPreference!]!
  }

  type ContentTypePreference {
    type: ContentType!
    preference: PreferenceLevel!
    engagement: Float!
  }

  type TopicPreference {
    topic: String!
    interest: Float!
    expertise: Float!
  }

  type FormatPreference {
    format: String!
    preference: PreferenceLevel!
    consumption: Float!
  }

  type CustomizationUsage {
    customization: String!
    usage: Float!
    satisfaction: Float!
    impact: Float!
  }

  type UserJourneyAnalytics {
    stages: [JourneyStage!]!
    touchpoints: [Touchpoint!]!
    conversions: [ConversionPoint!]!
    friction: [FrictionPoint!]!
    satisfaction: [SatisfactionPoint!]!
  }

  type JourneyStage {
    stage: String!
    duration: Int!
    completionRate: Percentage!
    dropoffRate: Percentage!
    satisfaction: Float!
  }

  type Touchpoint {
    name: String!
    channel: String!
    frequency: Int!
    impact: Float!
    sentiment: SentimentType!
  }

  type ConversionPoint {
    event: String!
    rate: Percentage!
    value: Currency
    attribution: [AttributionData!]!
  }

  type AttributionData {
    channel: String!
    contribution: Percentage!
    influence: Float!
  }

  type FrictionPoint {
    location: String!
    type: FrictionType!
    severity: Float!
    frequency: Int!
    impact: Float!
  }

  type SatisfactionPoint {
    touchpoint: String!
    score: Float!
    feedback: String
    improvement: Float!
  }

  # Tax Calculation Analytics
  type TaxCalculationAnalytics {
    period: AnalyticsPeriod!
    overview: TaxCalculationOverview!
    patterns: [CalculationPattern!]!
    accuracy: CalculationAccuracyMetrics!
    performance: CalculationPerformanceMetrics!
    popular: [PopularCalculation!]!
    trends: [CalculationTrend!]!
    comparisons: [CalculationComparison!]!
  }

  type TaxCalculationOverview {
    totalCalculations: Int!
    uniqueUsers: Int!
    avgCalculationsPerUser: Float!
    completionRate: Percentage!
    errorRate: Percentage!
    avgCalculationTime: Int!
    totalTaxProcessed: Currency!
  }

  type CalculationPattern {
    pattern: String!
    frequency: Int!
    countries: [CountryUsage!]!
    seasons: [SeasonalUsage!]!
    demographics: [DemographicUsage!]!
  }

  type CountryUsage {
    country: Country!
    calculations: Int!
    percentage: Percentage!
    avgAmount: Currency!
  }

  type SeasonalUsage {
    month: String!
    calculations: Int!
    growth: Percentage!
  }

  type DemographicUsage {
    segment: String!
    calculations: Int!
    percentage: Percentage!
    characteristics: [String!]!
  }

  type CalculationAccuracyMetrics {
    overallAccuracy: Percentage!
    validationSuccess: Percentage!
    userCorrections: Int!
    commonErrors: [CalculationError!]!
    improvements: [AccuracyImprovement!]!
  }

  type CalculationError {
    type: String!
    frequency: Int!
    impact: Float!
    resolution: String!
  }

  type AccuracyImprovement {
    area: String!
    improvement: Percentage!
    period: String!
  }

  type CalculationPerformanceMetrics {
    avgResponseTime: Int!
    cacheHitRate: Percentage!
    errorRate: Percentage!
    throughput: Float!
    scalability: ScalabilityMetrics!
  }

  type ScalabilityMetrics {
    concurrentUsers: Int!
    peakLoad: Float!
    capacityUtilization: Percentage!
    bottlenecks: [String!]!
  }

  type PopularCalculation {
    type: String!
    country: Country!
    count: Int!
    growth: Percentage!
    avgAmount: Currency!
  }

  type CalculationTrend {
    metric: String!
    trend: TrendDirection!
    data: [TrendDataPoint!]!
    seasonal: Boolean!
    forecast: [ForecastPoint!]
  }

  type CalculationComparison {
    dimension: String!
    segments: [ComparisonSegment!]!
    significance: StatisticalSignificance!
  }

  type ComparisonSegment {
    segment: String!
    value: Float!
    percentage: Percentage!
    trend: TrendDirection!
  }

  # API Analytics
  type APIAnalytics {
    period: AnalyticsPeriod!
    overview: APIOverview!
    endpoints: [EndpointAnalytics!]!
    performance: APIPerformanceMetrics!
    errors: APIErrorMetrics!
    usage: APIUsageMetrics!
    security: APISecurityMetrics!
  }

  type APIOverview {
    totalRequests: Int!
    successfulRequests: Int!
    failedRequests: Int!
    avgResponseTime: Int!
    errorRate: Percentage!
    uptime: Percentage!
    uniqueUsers: Int!
    dataTransferred: Int!
  }

  type EndpointAnalytics {
    endpoint: String!
    method: String!
    requests: Int!
    avgResponseTime: Int!
    errorRate: Percentage!
    popularParams: [ParameterUsage!]!
    userDistribution: [UserSegment!]!
  }

  type ParameterUsage {
    parameter: String!
    usage: Int!
    values: [ParameterValue!]!
  }

  type ParameterValue {
    value: String!
    count: Int!
    percentage: Percentage!
  }

  type UserSegment {
    segment: String!
    requests: Int!
    percentage: Percentage!
  }

  type APIPerformanceMetrics {
    responseTime: ResponseTimeMetrics!
    throughput: ThroughputMetrics!
    availability: AvailabilityMetrics!
    scalability: APIScalabilityMetrics!
  }

  type ResponseTimeMetrics {
    avg: Int!
    p50: Int!
    p90: Int!
    p95: Int!
    p99: Int!
    slowestEndpoints: [SlowEndpoint!]!
  }

  type SlowEndpoint {
    endpoint: String!
    avgResponseTime: Int!
    slowestRequest: Int!
  }

  type ThroughputMetrics {
    requestsPerSecond: Float!
    requestsPerMinute: Float!
    peakThroughput: Float!
    sustainedThroughput: Float!
  }

  type AvailabilityMetrics {
    uptime: Percentage!
    downtime: Int!
    incidents: [AvailabilityIncident!]!
    sla: SLAMetrics!
  }

  type AvailabilityIncident {
    start: DateTime!
    end: DateTime!
    duration: Int!
    severity: IncidentSeverity!
    cause: String!
  }

  type SLAMetrics {
    target: Percentage!
    actual: Percentage!
    breaches: Int!
    credits: Currency!
  }

  type APIScalabilityMetrics {
    maxConcurrentUsers: Int!
    loadCapacity: Float!
    autoScalingEvents: [ScalingEvent!]!
    resourceUtilization: ResourceUtilization!
  }

  type ScalingEvent {
    timestamp: DateTime!
    direction: ScaleDirection!
    trigger: String!
    capacity: Float!
  }

  type ResourceUtilization {
    cpu: Percentage!
    memory: Percentage!
    network: Percentage!
    storage: Percentage!
  }

  type APIErrorMetrics {
    totalErrors: Int!
    errorRate: Percentage!
    errorTypes: [ErrorTypeStats!]!
    errorTrends: [ErrorTrend!]!
    topErrors: [TopError!]!
  }

  type ErrorTypeStats {
    type: String!
    code: Int!
    count: Int!
    percentage: Percentage!
    trend: TrendDirection!
  }

  type ErrorTrend {
    period: String!
    errors: Int!
    change: Percentage!
  }

  type TopError {
    message: String!
    count: Int!
    endpoints: [String!]!
    firstSeen: DateTime!
    lastSeen: DateTime!
  }

  type APIUsageMetrics {
    requestPatterns: [RequestPattern!]!
    geographicDistribution: [GeographicUsage!]!
    clientDistribution: [ClientUsage!]!
    versionDistribution: [VersionUsage!]!
  }

  type RequestPattern {
    pattern: String!
    frequency: Int!
    timing: [TimingPattern!]!
  }

  type TimingPattern {
    hour: Int!
    requests: Int!
    day: String!
  }

  type GeographicUsage {
    country: Country!
    requests: Int!
    percentage: Percentage!
    avgResponseTime: Int!
  }

  type ClientUsage {
    client: String!
    version: String
    requests: Int!
    percentage: Percentage!
  }

  type VersionUsage {
    version: String!
    requests: Int!
    percentage: Percentage!
    deprecated: Boolean!
  }

  type APISecurityMetrics {
    threatDetection: ThreatDetectionMetrics!
    authentication: AuthenticationMetrics!
    authorization: AuthorizationMetrics!
    rateLimit: RateLimitMetrics!
  }

  type ThreatDetectionMetrics {
    threatsDetected: Int!
    threatsBlocked: Int!
    suspiciousActivity: [SuspiciousActivity!]!
    securityIncidents: [SecurityIncident!]!
  }

  type SuspiciousActivity {
    type: ThreatType!
    count: Int!
    severity: ThreatSeverity!
    sources: [String!]!
  }

  type SecurityIncident {
    id: ID!
    type: IncidentType!
    severity: IncidentSeverity!
    timestamp: DateTime!
    resolved: Boolean!
    impact: String!
  }

  type AuthenticationMetrics {
    totalAttempts: Int!
    successfulAuth: Int!
    failedAuth: Int!
    authMethods: [AuthMethodUsage!]!
    failureReasons: [AuthFailureReason!]!
  }

  type AuthMethodUsage {
    method: String!
    usage: Int!
    successRate: Percentage!
  }

  type AuthFailureReason {
    reason: String!
    count: Int!
    percentage: Percentage!
  }

  type AuthorizationMetrics {
    accessGrants: Int!
    accessDenials: Int!
    permissionViolations: [PermissionViolation!]!
    roleUsage: [RoleUsage!]!
  }

  type PermissionViolation {
    permission: String!
    attempts: Int!
    users: [String!]!
  }

  type RoleUsage {
    role: String!
    users: Int!
    requests: Int!
    permissions: [String!]!
  }

  type RateLimitMetrics {
    totalRequests: Int!
    limitedRequests: Int!
    limitHitRate: Percentage!
    topLimitedUsers: [LimitedUser!]!
    limitViolations: [LimitViolation!]!
  }

  type LimitedUser {
    userId: ID!
    violations: Int!
    lastViolation: DateTime!
  }

  type LimitViolation {
    timestamp: DateTime!
    userId: ID!
    endpoint: String!
    limit: Int!
    requests: Int!
  }

  # Performance Analytics
  type PerformanceAnalytics {
    period: AnalyticsPeriod!
    overview: PerformanceOverview!
    webVitals: WebVitalsMetrics!
    backend: BackendPerformanceMetrics!
    database: DatabasePerformanceMetrics!
    cdn: CDNPerformanceMetrics!
    monitoring: MonitoringMetrics!
  }

  type PerformanceOverview {
    overallScore: Float!
    availability: Percentage!
    responseTime: Int!
    throughput: Float!
    errorRate: Percentage!
    userSatisfaction: Float!
  }

  type WebVitalsMetrics {
    lcp: WebVitalMetric!
    fid: WebVitalMetric!
    cls: WebVitalMetric!
    fcp: WebVitalMetric!
    ttfb: WebVitalMetric!
    scores: WebVitalScores!
  }

  type WebVitalMetric {
    value: Float!
    percentile75: Float!
    percentile90: Float!
    percentile95: Float!
    trend: TrendDirection!
    grade: PerformanceGrade!
  }

  type WebVitalScores {
    mobile: Float!
    desktop: Float!
    overall: Float!
  }

  type BackendPerformanceMetrics {
    responseTime: ResponseTimeMetrics!
    throughput: ThroughputMetrics!
    errorRate: Percentage!
    resourceUsage: ResourceUtilization!
    bottlenecks: [PerformanceBottleneck!]!
  }

  type PerformanceBottleneck {
    component: String!
    metric: String!
    severity: Float!
    impact: String!
    recommendation: String!
  }

  type DatabasePerformanceMetrics {
    queryTime: QueryPerformanceMetrics!
    connections: ConnectionMetrics!
    caching: CacheMetrics!
    optimization: [OptimizationSuggestion!]!
  }

  type QueryPerformanceMetrics {
    avgTime: Int!
    slowQueries: [SlowQuery!]!
    indexUsage: IndexUsageMetrics!
  }

  type SlowQuery {
    query: String!
    avgTime: Int!
    executions: Int!
    table: String!
  }

  type IndexUsageMetrics {
    totalIndexes: Int!
    usedIndexes: Int!
    unusedIndexes: [String!]!
    missingIndexes: [String!]!
  }

  type ConnectionMetrics {
    totalConnections: Int!
    activeConnections: Int!
    maxConnections: Int!
    connectionPoolUsage: Percentage!
  }

  type CacheMetrics {
    hitRate: Percentage!
    missRate: Percentage!
    evictionRate: Percentage!
    size: Int!
    effectiveness: Float!
  }

  type OptimizationSuggestion {
    type: OptimizationType!
    description: String!
    impact: Float!
    effort: EffortLevel!
  }

  type CDNPerformanceMetrics {
    hitRate: Percentage!
    bandwidth: BandwidthMetrics!
    edgeLocations: [EdgeLocationMetrics!]!
    cacheEfficiency: CacheEfficiencyMetrics!
  }

  type BandwidthMetrics {
    total: Int!
    cached: Int!
    origin: Int!
    savings: Percentage!
  }

  type EdgeLocationMetrics {
    location: String!
    hitRate: Percentage!
    responseTime: Int!
    traffic: Int!
  }

  type CacheEfficiencyMetrics {
    static: Percentage!
    dynamic: Percentage!
    api: Percentage!
    overall: Percentage!
  }

  type MonitoringMetrics {
    alerts: AlertMetrics!
    incidents: IncidentMetrics!
    sla: SLAMetrics!
    mttr: Int!
    mtbf: Int!
  }

  type AlertMetrics {
    total: Int!
    critical: Int!
    warning: Int!
    resolved: Int!
    falsePositives: Int!
  }

  type IncidentMetrics {
    total: Int!
    resolved: Int!
    avgResolutionTime: Int!
    byseverity: [SeverityCount!]!
    causes: [IncidentCause!]!
  }

  type SeverityCount {
    severity: IncidentSeverity!
    count: Int!
  }

  type IncidentCause {
    cause: String!
    count: Int!
    percentage: Percentage!
  }

  # Business Intelligence
  type BusinessIntelligence {
    period: AnalyticsPeriod!
    kpis: [KPIMetric!]!
    segments: [BusinessSegment!]!
    cohorts: [CohortAnalysis!]!
    forecasts: [BusinessForecast!]!
    recommendations: [BusinessRecommendation!]!
  }

  type KPIMetric {
    name: String!
    value: Float!
    target: Float!
    variance: Percentage!
    trend: TrendDirection!
    status: KPIStatus!
    impact: BusinessImpact!
  }

  type BusinessSegment {
    name: String!
    size: Int!
    revenue: Currency!
    growth: Percentage!
    characteristics: [SegmentCharacteristic!]!
    opportunities: [String!]!
  }

  type SegmentCharacteristic {
    attribute: String!
    value: String!
    significance: Float!
  }

  type CohortAnalysis {
    cohort: String!
    size: Int!
    retention: [RetentionData!]!
    ltv: Currency!
    churn: ChurnData!
  }

  type RetentionData {
    period: String!
    retained: Int!
    rate: Percentage!
  }

  type ChurnData {
    rate: Percentage!
    reasons: [ChurnReason!]!
    predictions: [ChurnPrediction!]!
  }

  type ChurnPrediction {
    userId: ID!
    probability: Percentage!
    factors: [String!]!
    recommendations: [String!]!
  }

  type BusinessForecast {
    metric: String!
    period: String!
    forecast: Float!
    confidence: ConfidenceInterval!
    assumptions: [String!]!
  }

  type BusinessRecommendation {
    category: RecommendationCategory!
    title: String!
    description: String!
    impact: BusinessImpact!
    effort: EffortLevel!
    priority: Priority!
    metrics: [String!]!
  }

  # Real-time Analytics
  type RealTimeAnalytics {
    activeUsers: Int!
    currentSessions: Int!
    apiRequests: RealTimeAPIMetrics!
    performance: RealTimePerformanceMetrics!
    alerts: [RealTimeAlert!]!
    trends: [RealTimeTrend!]!
    lastUpdated: DateTime!
  }

  type RealTimeAPIMetrics {
    requestsPerSecond: Float!
    avgResponseTime: Int!
    errorRate: Percentage!
    activeEndpoints: [ActiveEndpoint!]!
  }

  type ActiveEndpoint {
    endpoint: String!
    requests: Int!
    avgResponseTime: Int!
    errors: Int!
  }

  type RealTimePerformanceMetrics {
    cpuUsage: Percentage!
    memoryUsage: Percentage!
    diskUsage: Percentage!
    networkIO: NetworkIOMetrics!
  }

  type NetworkIOMetrics {
    bytesIn: Int!
    bytesOut: Int!
    packetsIn: Int!
    packetsOut: Int!
  }

  type RealTimeAlert {
    id: ID!
    type: AlertType!
    severity: AlertSeverity!
    message: String!
    metric: String!
    value: Float!
    threshold: Float!
    timestamp: DateTime!
  }

  type RealTimeTrend {
    metric: String!
    value: Float!
    change: Float!
    direction: TrendDirection!
    timestamp: DateTime!
  }

  # Custom Reports
  type CustomReport {
    id: ID!
    name: String!
    description: String!
    type: ReportType!
    configuration: ReportConfiguration!
    schedule: ReportSchedule
    format: ReportFormat!
    recipients: [String!]!
    lastGenerated: DateTime
    nextGeneration: DateTime
    status: ReportStatus!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type ReportConfiguration {
    metrics: [String!]!
    dimensions: [String!]!
    filters: [ReportFilter!]!
    dateRange: DateRangeConfig!
    visualization: VisualizationConfig!
    aggregation: AggregationConfig!
  }

  type ReportFilter {
    field: String!
    operator: FilterOperator!
    value: String!
  }

  type DateRangeConfig {
    type: DateRangeType!
    startDate: Date
    endDate: Date
    period: AnalyticsPeriod
    comparison: ComparisonConfig
  }

  type ComparisonConfig {
    enabled: Boolean!
    type: ComparisonType!
    periods: Int!
  }

  type VisualizationConfig {
    charts: [ChartConfig!]!
    tables: [TableConfig!]!
    layout: LayoutConfig!
  }

  type ChartConfig {
    type: ChartType!
    metrics: [String!]!
    dimensions: [String!]!
    settings: JSON
  }

  type TableConfig {
    columns: [ColumnConfig!]!
    sorting: SortConfig!
    pagination: PaginationConfig!
  }

  type ColumnConfig {
    field: String!
    label: String!
    type: ColumnType!
    format: String
    aggregation: AggregationType
  }

  type SortConfig {
    field: String!
    direction: SortDirection!
  }

  type PaginationConfig {
    enabled: Boolean!
    pageSize: Int!
  }

  type LayoutConfig {
    sections: [SectionConfig!]!
    theme: String!
    branding: BrandingConfig!
  }

  type SectionConfig {
    type: SectionType!
    title: String!
    content: JSON!
    order: Int!
  }

  type BrandingConfig {
    logo: String
    colors: ColorConfig!
    fonts: FontConfig!
  }

  type ColorConfig {
    primary: String!
    secondary: String!
    accent: String!
  }

  type FontConfig {
    header: String!
    body: String!
    code: String!
  }

  type AggregationConfig {
    groupBy: [String!]!
    aggregations: [AggregationRule!]!
  }

  type AggregationRule {
    field: String!
    function: AggregationFunction!
    alias: String
  }

  type ReportSchedule {
    frequency: ScheduleFrequency!
    time: String!
    timezone: String!
    daysOfWeek: [Int!]
    daysOfMonth: [Int!]
    enabled: Boolean!
  }

  type ScheduledReport {
    id: ID!
    report: CustomReport!
    schedule: ReportSchedule!
    lastRun: DateTime
    nextRun: DateTime!
    status: ScheduleStatus!
    runs: [ReportRun!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type ReportRun {
    id: ID!
    startedAt: DateTime!
    completedAt: DateTime
    status: RunStatus!
    duration: Int
    resultUrl: String
    error: String
    metrics: RunMetrics!
  }

  type RunMetrics {
    recordsProcessed: Int!
    dataSize: Int!
    executionTime: Int!
    memoryUsed: Int!
  }

  type ReportGenerationResult {
    id: ID!
    report: CustomReport!
    status: GenerationStatus!
    progress: Percentage!
    downloadUrl: String
    error: String
    metrics: GenerationMetrics!
    startedAt: DateTime!
    completedAt: DateTime
  }

  type GenerationMetrics {
    recordsProcessed: Int!
    dataPoints: Int!
    fileSize: Int!
    processingTime: Int!
  }

  # Goals and Alerts
  type AnalyticsGoal {
    id: ID!
    name: String!
    description: String!
    metric: String!
    target: Float!
    period: GoalPeriod!
    status: GoalStatus!
    progress: GoalProgress!
    alerts: [GoalAlert!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type GoalProgress {
    current: Float!
    target: Float!
    percentage: Percentage!
    onTrack: Boolean!
    projectedCompletion: Date
  }

  type GoalAlert {
    threshold: Percentage!
    triggered: Boolean!
    lastTriggered: DateTime
  }

  type AnalyticsAlert {
    id: ID!
    name: String!
    description: String!
    metric: String!
    condition: AlertCondition!
    threshold: Float!
    frequency: AlertFrequency!
    recipients: [String!]!
    channels: [AlertChannel!]!
    enabled: Boolean!
    triggered: Boolean!
    lastTriggered: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type AlertCondition {
    operator: ComparisonOperator!
    value: Float!
    aggregation: AggregationFunction!
    window: TimeWindow!
  }

  type TimeWindow {
    duration: Int!
    unit: TimeUnit!
  }

  # Events and Updates
  type AnalyticsUpdate {
    type: UpdateType!
    metric: String!
    value: Float!
    change: Float!
    timestamp: DateTime!
  }

  type RealTimeMetric {
    name: String!
    value: Float!
    unit: String!
    timestamp: DateTime!
  }

  type GoalUpdate {
    goal: AnalyticsGoal!
    previousProgress: Float!
    currentProgress: Float!
    milestone: Boolean!
    timestamp: DateTime!
  }

  type SystemMetricUpdate {
    metric: String!
    value: Float!
    threshold: Float!
    severity: AlertSeverity!
    timestamp: DateTime!
  }

  type PerformanceAlert {
    component: String!
    metric: String!
    value: Float!
    threshold: Float!
    severity: AlertSeverity!
    timestamp: DateTime!
  }

  # Input Types
  input AnalyticsFilterInput {
    field: String!
    operator: FilterOperator!
    value: String!
  }

  input ComparativeAnalyticsInput {
    metrics: [String!]!
    segments: [SegmentInput!]!
    period: AnalyticsPeriod!
    comparison: ComparisonConfig!
  }

  input SegmentInput {
    name: String!
    filters: [AnalyticsFilterInput!]!
  }

  input PredictiveAnalyticsInput {
    metrics: [String!]!
    horizon: Int!
    confidence: Percentage!
    factors: [String!]
  }

  input BenchmarkAnalyticsInput {
    metrics: [String!]!
    industry: String
    size: CompanySize
    region: String
  }

  input CreateCustomReportInput {
    name: String!
    description: String!
    type: ReportType!
    configuration: ReportConfigurationInput!
    schedule: ReportScheduleInput
    format: ReportFormat!
    recipients: [String!]!
  }

  input ReportConfigurationInput {
    metrics: [String!]!
    dimensions: [String!]!
    filters: [ReportFilterInput!]!
    dateRange: DateRangeConfigInput!
    visualization: VisualizationConfigInput!
    aggregation: AggregationConfigInput!
  }

  input ReportFilterInput {
    field: String!
    operator: FilterOperator!
    value: String!
  }

  input DateRangeConfigInput {
    type: DateRangeType!
    startDate: Date
    endDate: Date
    period: AnalyticsPeriod
    comparison: ComparisonConfigInput
  }

  input ComparisonConfigInput {
    enabled: Boolean!
    type: ComparisonType!
    periods: Int!
  }

  input VisualizationConfigInput {
    charts: [ChartConfigInput!]!
    tables: [TableConfigInput!]!
    layout: LayoutConfigInput!
  }

  input ChartConfigInput {
    type: ChartType!
    metrics: [String!]!
    dimensions: [String!]!
    settings: JSON
  }

  input TableConfigInput {
    columns: [ColumnConfigInput!]!
    sorting: SortConfigInput!
    pagination: PaginationConfigInput!
  }

  input ColumnConfigInput {
    field: String!
    label: String!
    type: ColumnType!
    format: String
    aggregation: AggregationType
  }

  input SortConfigInput {
    field: String!
    direction: SortDirection!
  }

  input PaginationConfigInput {
    enabled: Boolean!
    pageSize: Int!
  }

  input LayoutConfigInput {
    sections: [SectionConfigInput!]!
    theme: String!
    branding: BrandingConfigInput!
  }

  input SectionConfigInput {
    type: SectionType!
    title: String!
    content: JSON!
    order: Int!
  }

  input BrandingConfigInput {
    logo: String
    colors: ColorConfigInput!
    fonts: FontConfigInput!
  }

  input ColorConfigInput {
    primary: String!
    secondary: String!
    accent: String!
  }

  input FontConfigInput {
    header: String!
    body: String!
    code: String!
  }

  input AggregationConfigInput {
    groupBy: [String!]!
    aggregations: [AggregationRuleInput!]!
  }

  input AggregationRuleInput {
    field: String!
    function: AggregationFunction!
    alias: String
  }

  input ReportScheduleInput {
    frequency: ScheduleFrequency!
    time: String!
    timezone: String!
    daysOfWeek: [Int!]
    daysOfMonth: [Int!]
    enabled: Boolean = true
  }

  input UpdateCustomReportInput {
    name: String
    description: String
    configuration: ReportConfigurationInput
    schedule: ReportScheduleInput
    format: ReportFormat
    recipients: [String!]
  }

  input CreateScheduledReportInput {
    reportId: ID!
    schedule: ReportScheduleInput!
  }

  input UpdateScheduledReportInput {
    schedule: ReportScheduleInput
  }

  input AnalyticsSettingsInput {
    dataRetention: Int!
    sampling: SamplingConfig!
    privacy: PrivacyConfig!
    notifications: NotificationConfig!
  }

  input SamplingConfig {
    enabled: Boolean!
    rate: Percentage!
    method: SamplingMethod!
  }

  input PrivacyConfig {
    anonymization: Boolean!
    dataMinimization: Boolean!
    retention: Int!
  }

  input NotificationConfig {
    alerts: Boolean!
    reports: Boolean!
    insights: Boolean!
    frequency: NotificationFrequency!
  }

  input AnalyticsExportInput {
    type: ExportType!
    format: ExportFormat!
    dateRange: DateRangeConfigInput!
    filters: [AnalyticsFilterInput!]!
    compression: Boolean = false
  }

  input CustomEventInput {
    name: String!
    properties: JSON!
    userId: ID
    sessionId: String
    timestamp: DateTime
  }

  input ConversionEventInput {
    type: ConversionType!
    value: Currency
    properties: JSON!
    attribution: AttributionInput
  }

  input AttributionInput {
    channel: String!
    campaign: String
    source: String
    medium: String
  }

  input CreateAnalyticsGoalInput {
    name: String!
    description: String!
    metric: String!
    target: Float!
    period: GoalPeriod!
    alerts: [GoalAlertInput!]!
  }

  input GoalAlertInput {
    threshold: Percentage!
  }

  input UpdateAnalyticsGoalInput {
    name: String
    description: String
    target: Float
    period: GoalPeriod
    alerts: [GoalAlertInput!]
  }

  input CreateAnalyticsAlertInput {
    name: String!
    description: String!
    metric: String!
    condition: AlertConditionInput!
    frequency: AlertFrequency!
    recipients: [String!]!
    channels: [AlertChannel!]!
  }

  input AlertConditionInput {
    operator: ComparisonOperator!
    value: Float!
    aggregation: AggregationFunction!
    window: TimeWindowInput!
  }

  input TimeWindowInput {
    duration: Int!
    unit: TimeUnit!
  }

  input UpdateAnalyticsAlertInput {
    name: String
    description: String
    condition: AlertConditionInput
    frequency: AlertFrequency
    recipients: [String!]
    channels: [AlertChannel!]
    enabled: Boolean
  }

  # Connections
  type CustomReportConnection {
    edges: [CustomReportEdge!]!
    pageInfo: PageInfo!
  }

  type CustomReportEdge {
    node: CustomReport!
    cursor: String!
  }

  type ScheduledReportConnection {
    edges: [ScheduledReportEdge!]!
    pageInfo: PageInfo!
  }

  type ScheduledReportEdge {
    node: ScheduledReport!
    cursor: String!
  }

  # Enums
  enum MetricType {
    USER_COUNT
    SESSION_COUNT
    PAGE_VIEWS
    API_REQUESTS
    REVENUE
    CONVERSION_RATE
    RESPONSE_TIME
    ERROR_RATE
    CUSTOM
  }

  enum MetricFormat {
    NUMBER
    PERCENTAGE
    CURRENCY
    TIME
    BYTES
    RATE
  }

  enum InsightType {
    ANOMALY
    TREND
    CORRELATION
    PREDICTION
    RECOMMENDATION
    ALERT
  }

  enum InsightImpact {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  enum BusinessMetric {
    REVENUE
    GROWTH
    RETENTION
    ACQUISITION
    ENGAGEMENT
    SATISFACTION
    EFFICIENCY
    COST
  }

  enum SentimentType {
    POSITIVE
    NEUTRAL
    NEGATIVE
    MIXED
  }

  enum ChurnRiskLevel {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  enum CompetencyLevel {
    BEGINNER
    INTERMEDIATE
    ADVANCED
    EXPERT
  }

  enum PreferenceLevel {
    VERY_LOW
    LOW
    NEUTRAL
    HIGH
    VERY_HIGH
  }

  enum UsageFrequency {
    NEVER
    RARELY
    OCCASIONALLY
    REGULARLY
    FREQUENTLY
    ALWAYS
  }

  enum ProficiencyLevel {
    NOVICE
    BEGINNER
    INTERMEDIATE
    ADVANCED
    EXPERT
    MASTER
  }

  enum FrictionType {
    USABILITY
    PERFORMANCE
    CONTENT
    TECHNICAL
    DESIGN
    FLOW
  }

  enum PerformanceGrade {
    A
    B
    C
    D
    F
  }

  enum OptimizationType {
    INDEX
    QUERY
    CACHE
    SCHEMA
    HARDWARE
    CONFIGURATION
  }

  enum KPIStatus {
    ON_TRACK
    AT_RISK
    BEHIND
    EXCEEDED
    FAILED
  }

  enum BusinessImpact {
    NONE
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  enum ThreatType {
    BRUTE_FORCE
    DDoS
    SQL_INJECTION
    XSS
    SUSPICIOUS_PATTERN
    RATE_LIMIT_VIOLATION
  }

  enum ThreatSeverity {
    INFO
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  enum IncidentType {
    SECURITY
    PERFORMANCE
    AVAILABILITY
    DATA
    COMPLIANCE
  }

  enum ScaleDirection {
    UP
    DOWN
  }

  enum ReportType {
    STANDARD
    CUSTOM
    EXECUTIVE
    OPERATIONAL
    COMPLIANCE
    FINANCIAL
  }

  enum ReportStatus {
    DRAFT
    ACTIVE
    PAUSED
    ARCHIVED
  }

  enum DateRangeType {
    PRESET
    CUSTOM
    RELATIVE
    ROLLING
  }

  enum ComparisonType {
    PREVIOUS_PERIOD
    YEAR_OVER_YEAR
    CUSTOM_PERIOD
    BENCHMARK
  }

  enum ChartType {
    LINE
    BAR
    PIE
    AREA
    SCATTER
    HEATMAP
    GAUGE
    FUNNEL
    SANKEY
    TREEMAP
  }

  enum ColumnType {
    TEXT
    NUMBER
    PERCENTAGE
    CURRENCY
    DATE
    LINK
    IMAGE
  }

  enum AggregationType {
    SUM
    AVG
    COUNT
    MIN
    MAX
    MEDIAN
    PERCENTILE
  }

  enum SectionType {
    CHART
    TABLE
    TEXT
    IMAGE
    METRIC
    KPI
  }

  enum AggregationFunction {
    SUM
    COUNT
    AVG
    MIN
    MAX
    MEDIAN
    PERCENTILE_95
    DISTINCT_COUNT
  }

  enum ScheduleFrequency {
    HOURLY
    DAILY
    WEEKLY
    MONTHLY
    QUARTERLY
    YEARLY
    CUSTOM
  }

  enum ScheduleStatus {
    ACTIVE
    PAUSED
    FAILED
    COMPLETED
  }

  enum RunStatus {
    PENDING
    RUNNING
    COMPLETED
    FAILED
    CANCELLED
  }

  enum GenerationStatus {
    QUEUED
    PROCESSING
    COMPLETED
    FAILED
    CANCELLED
  }

  enum GoalPeriod {
    DAILY
    WEEKLY
    MONTHLY
    QUARTERLY
    YEARLY
  }

  enum GoalStatus {
    ACTIVE
    COMPLETED
    PAUSED
    ARCHIVED
  }

  enum AlertFrequency {
    IMMEDIATE
    HOURLY
    DAILY
    WEEKLY
  }

  enum AlertChannel {
    EMAIL
    SMS
    SLACK
    WEBHOOK
    IN_APP
  }

  enum AlertType {
    THRESHOLD
    ANOMALY
    TREND
    GOAL
    SYSTEM
  }

  enum AlertSeverity {
    INFO
    WARNING
    CRITICAL
    EMERGENCY
  }

  enum ComparisonOperator {
    EQUALS
    NOT_EQUALS
    GREATER_THAN
    LESS_THAN
    GREATER_THAN_OR_EQUAL
    LESS_THAN_OR_EQUAL
    CONTAINS
    NOT_CONTAINS
  }

  enum TimeUnit {
    SECOND
    MINUTE
    HOUR
    DAY
    WEEK
    MONTH
    YEAR
  }

  enum UpdateType {
    METRIC_UPDATE
    THRESHOLD_BREACH
    GOAL_PROGRESS
    ALERT_TRIGGERED
    REPORT_GENERATED
  }

  enum CompanySize {
    STARTUP
    SMALL
    MEDIUM
    LARGE
    ENTERPRISE
  }

  enum SamplingMethod {
    RANDOM
    SYSTEMATIC
    STRATIFIED
    CLUSTER
  }

  enum ConversionType {
    REGISTRATION
    SUBSCRIPTION
    PURCHASE
    UPGRADE
    ENGAGEMENT
    CUSTOM
  }

  type AnalyticsSettings {
    dataRetention: Int!
    sampling: SamplingConfiguration!
    privacy: PrivacyConfiguration!
    notifications: NotificationConfiguration!
    updatedAt: DateTime!
  }

  type SamplingConfiguration {
    enabled: Boolean!
    rate: Percentage!
    method: SamplingMethod!
  }

  type PrivacyConfiguration {
    anonymization: Boolean!
    dataMinimization: Boolean!
    retention: Int!
  }

  type NotificationConfiguration {
    alerts: Boolean!
    reports: Boolean!
    insights: Boolean!
    frequency: NotificationFrequency!
  }
`;

module.exports = analyticsTypeDefs;