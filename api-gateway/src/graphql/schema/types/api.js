/**
 * API Management GraphQL Type Definitions
 * API keys, versioning, documentation, and developer portal types
 */

const { gql } = require('graphql-tag');

const apiTypeDefs = gql`
  extend type Query {
    # API Information
    getAPIVersions: [APIVersion!]!
    getAPIVersion(version: String!): APIVersion

    # API Documentation
    getAPIDocumentation(version: String): APIDocumentation!
    getEndpointDocumentation(endpoint: String!, version: String): EndpointDocumentation!

    # Developer Portal
    getDeveloperResources: DeveloperResources!
    getSDKs(language: ProgrammingLanguage): [SDK!]!
    getCodeExamples(
      endpoint: String
      language: ProgrammingLanguage
      useCase: String
    ): [CodeExample!]!

    # API Keys Management
    getAPIKeys(
      filters: [FilterInput!]
      pagination: PaginationInput
    ): APIKeyConnection! @auth(role: USER)

    getAPIKey(id: ID!): APIKey! @auth(role: USER)
    getAPIKeyUsage(
      keyId: ID!
      period: AnalyticsPeriod!
    ): APIKeyUsage! @auth(role: USER)

    # Rate Limiting
    getRateLimits(keyId: ID): [RateLimit!]! @auth(role: USER)
    getQuotas(keyId: ID): [Quota!]! @auth(role: USER)

    # Webhooks
    getWebhooks(
      pagination: PaginationInput
    ): WebhookConnection! @auth(role: USER)

    getWebhook(id: ID!): Webhook! @auth(role: USER)
    getWebhookDeliveries(
      webhookId: ID!
      pagination: PaginationInput
    ): WebhookDeliveryConnection! @auth(role: USER)

    # API Health and Status
    getAPIStatus: APIStatus!
    getServiceStatus(service: String!): ServiceStatus!
    getAPIMetrics(
      period: AnalyticsPeriod!
      service: String
    ): APIMetricsData! @auth(role: ADMIN)

    # Developer Applications
    getDeveloperApplications(
      pagination: PaginationInput
    ): DeveloperApplicationConnection! @auth(role: USER)

    getDeveloperApplication(id: ID!): DeveloperApplication! @auth(role: USER)

    # API Marketplace
    getAPIPlans: [APIPlan!]!
    getAPIPlan(id: ID!): APIPlan!

    # Admin Queries
    getAllAPIKeys(
      filters: [FilterInput!]
      pagination: PaginationInput
    ): APIKeyConnection! @auth(role: ADMIN)

    getAPIAnalytics(
      period: AnalyticsPeriod!
      filters: [AnalyticsFilterInput!]
    ): AdminAPIAnalytics! @auth(role: ADMIN)

    getDeveloperStats: DeveloperStats! @auth(role: ADMIN)
  }

  extend type Mutation {
    # API Key Management
    createAPIKey(input: CreateAPIKeyInput!): APIKey! @auth(role: USER)
    updateAPIKey(id: ID!, input: UpdateAPIKeyInput!): APIKey! @auth(role: USER)
    regenerateAPIKey(id: ID!): APIKey! @auth(role: USER)
    revokeAPIKey(id: ID!): OperationResponse! @auth(role: USER)
    rotateAPIKey(id: ID!): APIKeyRotationResult! @auth(role: USER)

    # Rate Limit Management
    updateRateLimit(keyId: ID!, input: RateLimitInput!): RateLimit! @auth(role: USER)
    requestQuotaIncrease(input: QuotaIncreaseInput!): QuotaRequest! @auth(role: USER)

    # Webhook Management
    createWebhook(input: CreateWebhookInput!): Webhook! @auth(role: USER)
    updateWebhook(id: ID!, input: UpdateWebhookInput!): Webhook! @auth(role: USER)
    deleteWebhook(id: ID!): OperationResponse! @auth(role: USER)
    testWebhook(id: ID!, payload: JSON): WebhookTestResult! @auth(role: USER)
    replayWebhookDelivery(deliveryId: ID!): WebhookDelivery! @auth(role: USER)

    # Developer Applications
    createDeveloperApplication(input: CreateDeveloperApplicationInput!): DeveloperApplication! @auth(role: USER)
    updateDeveloperApplication(id: ID!, input: UpdateDeveloperApplicationInput!): DeveloperApplication! @auth(role: USER)
    deleteDeveloperApplication(id: ID!): OperationResponse! @auth(role: USER)
    submitForReview(id: ID!): OperationResponse! @auth(role: USER)

    # OAuth Applications
    createOAuthApplication(input: CreateOAuthApplicationInput!): OAuthApplication! @auth(role: USER)
    updateOAuthApplication(id: ID!, input: UpdateOAuthApplicationInput!): OAuthApplication! @auth(role: USER)
    deleteOAuthApplication(id: ID!): OperationResponse! @auth(role: USER)
    regenerateClientSecret(id: ID!): OAuthCredentials! @auth(role: USER)

    # API Feedback and Support
    submitAPIFeedback(input: APIFeedbackInput!): APIFeedback! @auth(role: USER)
    reportAPIIssue(input: APIIssueInput!): APIIssue! @auth(role: USER)
    requestAPIFeature(input: APIFeatureRequestInput!): APIFeatureRequest! @auth(role: USER)

    # Developer Onboarding
    completeOnboarding(input: OnboardingCompletionInput!): OnboardingResult! @auth(role: USER)
    requestDeveloperAccess(input: DeveloperAccessRequestInput!): DeveloperAccessRequest!

    # API Documentation Contributions
    suggestDocumentationChange(input: DocumentationChangeInput!): DocumentationSuggestion! @auth(role: USER)
    submitCodeExample(input: CodeExampleInput!): CodeExample! @auth(role: USER)

    # Admin Mutations
    approveAPIKey(id: ID!): APIKey! @auth(role: ADMIN)
    suspendAPIKey(id: ID!, reason: String!): APIKey! @auth(role: ADMIN)
    updateAPIKeyLimits(id: ID!, limits: APIKeyLimitsInput!): APIKey! @auth(role: ADMIN)

    approveDeveloperApplication(id: ID!): DeveloperApplication! @auth(role: ADMIN)
    rejectDeveloperApplication(id: ID!, reason: String!): DeveloperApplication! @auth(role: ADMIN)

    updateAPIDocumentation(input: UpdateAPIDocumentationInput!): APIDocumentation! @auth(role: ADMIN)
    publishAPIVersion(input: PublishAPIVersionInput!): APIVersion! @auth(role: ADMIN)
    deprecateAPIVersion(version: String!, reason: String!): APIVersion! @auth(role: ADMIN)
  }

  extend type Subscription {
    # API Status Updates
    apiStatusUpdate: APIStatusUpdate!
    serviceStatusUpdate(service: String!): ServiceStatusUpdate!

    # Webhook Events
    webhookDelivery(userId: ID!): WebhookDelivery! @auth(role: USER)
    webhookDeliveryStatus(userId: ID!): WebhookDeliveryStatus! @auth(role: USER)

    # API Key Events
    apiKeyUsageAlert(userId: ID!): APIKeyUsageAlert! @auth(role: USER)
    rateLimitExceeded(userId: ID!): RateLimitAlert! @auth(role: USER)

    # Developer Events
    applicationStatusUpdate(userId: ID!): ApplicationStatusUpdate! @auth(role: USER)
    documentationUpdate: DocumentationUpdate!

    # Admin Events
    newDeveloperApplication: DeveloperApplication! @auth(role: ADMIN)
    apiKeyCreated: APIKey! @auth(role: ADMIN)
    criticalAPIIssue: APIIssue! @auth(role: ADMIN)
  }

  # API Version Management
  type APIVersion {
    version: String!
    name: String!
    description: String!
    status: APIVersionStatus!
    releaseDate: Date!
    deprecationDate: Date
    sunsetDate: Date
    changelog: [ChangelogEntry!]!
    documentation: APIDocumentation!
    endpoints: [APIEndpoint!]!
    sdks: [SDK!]!
    migration: MigrationGuide
    breaking: Boolean!
    stable: Boolean!
    preferred: Boolean!
    usage: APIVersionUsage!
  }

  type ChangelogEntry {
    version: String!
    date: Date!
    type: ChangeType!
    title: String!
    description: String!
    breaking: Boolean!
    endpoints: [String!]
    migration: String
  }

  type APIDocumentation {
    version: String!
    title: String!
    description: String!
    baseUrl: String!
    authentication: AuthenticationDocumentation!
    endpoints: [EndpointDocumentation!]!
    schemas: [SchemaDocumentation!]!
    examples: [APIExample!]!
    guides: [DocumentationGuide!]!
    changelog: [ChangelogEntry!]!
    lastUpdated: DateTime!
  }

  type AuthenticationDocumentation {
    methods: [AuthMethod!]!
    examples: [AuthExample!]!
    scopes: [Scope!]!
    security: SecurityDocumentation!
  }

  type AuthMethod {
    type: AuthenticationType!
    name: String!
    description: String!
    required: Boolean!
    example: String!
    headers: [HeaderExample!]
  }

  type AuthExample {
    language: ProgrammingLanguage!
    code: String!
    description: String!
  }

  type Scope {
    name: String!
    description: String!
    resources: [String!]!
    actions: [String!]!
  }

  type SecurityDocumentation {
    rateLimit: RateLimitDocumentation!
    authentication: String!
    authorization: String!
    encryption: String!
    compliance: [String!]!
  }

  type RateLimitDocumentation {
    description: String!
    limits: [RateLimitExample!]!
    headers: [HeaderExample!]!
    handling: String!
  }

  type RateLimitExample {
    tier: String!
    requests: Int!
    window: String!
    description: String!
  }

  type HeaderExample {
    name: String!
    description: String!
    example: String!
    required: Boolean!
  }

  type EndpointDocumentation {
    path: String!
    method: HTTPMethod!
    summary: String!
    description: String!
    operationId: String!
    tags: [String!]!
    parameters: [ParameterDocumentation!]!
    requestBody: RequestBodyDocumentation
    responses: [ResponseDocumentation!]!
    examples: [EndpointExample!]!
    security: [SecurityRequirement!]!
    deprecated: Boolean!
    rateLimit: RateLimit
    changelog: [ChangelogEntry!]!
  }

  type ParameterDocumentation {
    name: String!
    in: ParameterLocation!
    description: String!
    required: Boolean!
    schema: SchemaDocumentation!
    example: String
    examples: [ParameterExample!]
  }

  type ParameterExample {
    name: String!
    value: String!
    description: String!
  }

  type RequestBodyDocumentation {
    description: String!
    required: Boolean!
    content: [ContentDocumentation!]!
    examples: [RequestExample!]
  }

  type ContentDocumentation {
    mediaType: String!
    schema: SchemaDocumentation!
    examples: [ContentExample!]
  }

  type ContentExample {
    name: String!
    summary: String!
    value: JSON!
  }

  type ResponseDocumentation {
    statusCode: Int!
    description: String!
    headers: [HeaderDocumentation!]
    content: [ContentDocumentation!]
    examples: [ResponseExample!]
  }

  type HeaderDocumentation {
    name: String!
    description: String!
    schema: SchemaDocumentation!
  }

  type ResponseExample {
    name: String!
    summary: String!
    value: JSON!
  }

  type RequestExample {
    name: String!
    summary: String!
    value: JSON!
  }

  type EndpointExample {
    name: String!
    description: String!
    request: RequestExample!
    response: ResponseExample!
    language: ProgrammingLanguage
  }

  type SecurityRequirement {
    name: String!
    scopes: [String!]
  }

  type SchemaDocumentation {
    name: String!
    type: SchemaType!
    format: String
    description: String!
    properties: [PropertyDocumentation!]
    required: [String!]
    example: JSON
    enum: [String!]
    items: SchemaDocumentation
    additionalProperties: Boolean
  }

  type PropertyDocumentation {
    name: String!
    schema: SchemaDocumentation!
    description: String!
    required: Boolean!
  }

  type APIExample {
    title: String!
    description: String!
    category: ExampleCategory!
    language: ProgrammingLanguage!
    code: String!
    endpoint: String
    useCase: String!
    difficulty: DifficultyLevel!
    tags: [String!]!
  }

  type DocumentationGuide {
    title: String!
    description: String!
    category: GuideCategory!
    content: String!
    sections: [GuideSection!]!
    examples: [APIExample!]!
    difficulty: DifficultyLevel!
    estimatedTime: Int!
  }

  type APIEndpoint {
    path: String!
    method: HTTPMethod!
    version: String!
    summary: String!
    description: String!
    tags: [String!]!
    deprecated: Boolean!
    rateLimit: RateLimit
    authentication: [AuthenticationType!]!
    scopes: [String!]
    usage: EndpointUsage!
  }

  type EndpointUsage {
    requests: Int!
    users: Int!
    avgResponseTime: Int!
    errorRate: Percentage!
    popularity: Float!
  }

  type MigrationGuide {
    fromVersion: String!
    toVersion: String!
    title: String!
    description: String!
    steps: [MigrationStep!]!
    breaking: [BreakingChange!]!
    timeline: String!
    automation: MigrationAutomation
  }

  type MigrationStep {
    order: Int!
    title: String!
    description: String!
    code: String
    automated: Boolean!
    impact: MigrationImpact!
  }

  type BreakingChange {
    endpoint: String
    change: String!
    impact: String!
    workaround: String!
  }

  type MigrationAutomation {
    available: Boolean!
    tool: String
    script: String
    instructions: String!
  }

  type APIVersionUsage {
    totalRequests: Int!
    uniqueUsers: Int!
    adoptionRate: Percentage!
    retentionRate: Percentage!
    migrationRate: Percentage!
  }

  # Developer Portal
  type DeveloperResources {
    gettingStarted: GettingStartedGuide!
    tutorials: [Tutorial!]!
    samples: [CodeSample!]!
    tools: [DeveloperTool!]!
    community: CommunityResources!
    support: SupportResources!
    announcements: [Announcement!]!
  }

  type GettingStartedGuide {
    title: String!
    description: String!
    steps: [OnboardingStep!]!
    estimatedTime: Int!
    prerequisites: [String!]!
  }

  type OnboardingStep {
    order: Int!
    title: String!
    description: String!
    content: String!
    code: String
    validation: StepValidation
  }

  type StepValidation {
    type: ValidationType!
    endpoint: String
    expectedResult: String!
  }

  type Tutorial {
    id: ID!
    title: String!
    description: String!
    category: TutorialCategory!
    difficulty: DifficultyLevel!
    duration: Int!
    prerequisites: [String!]!
    steps: [TutorialStep!]!
    resources: [TutorialResource!]!
    tags: [String!]!
    rating: Float!
    completions: Int!
  }

  type TutorialStep {
    order: Int!
    title: String!
    content: String!
    code: String
    language: ProgrammingLanguage
    validation: StepValidation
  }

  type TutorialResource {
    type: ResourceType!
    title: String!
    url: String!
    description: String!
  }

  type CodeSample {
    id: ID!
    title: String!
    description: String!
    language: ProgrammingLanguage!
    code: String!
    endpoint: String
    category: SampleCategory!
    useCase: String!
    difficulty: DifficultyLevel!
    downloads: Int!
    rating: Float!
    tags: [String!]!
  }

  type DeveloperTool {
    name: String!
    description: String!
    type: ToolType!
    url: String!
    version: String!
    platform: [Platform!]!
    features: [String!]!
    documentation: String!
  }

  type CommunityResources {
    forum: ForumInfo!
    discord: CommunityPlatform
    slack: CommunityPlatform
    github: CommunityPlatform
    blog: BlogInfo!
    events: [CommunityEvent!]!
  }

  type ForumInfo {
    url: String!
    posts: Int!
    activeUsers: Int!
    categories: [ForumCategory!]!
  }

  type ForumCategory {
    name: String!
    description: String!
    posts: Int!
    url: String!
  }

  type CommunityPlatform {
    name: String!
    url: String!
    members: Int!
    description: String!
  }

  type BlogInfo {
    url: String!
    latestPosts: [BlogPost!]!
  }

  type BlogPost {
    title: String!
    excerpt: String!
    url: String!
    publishedAt: Date!
    author: String!
    tags: [String!]!
  }

  type CommunityEvent {
    id: ID!
    title: String!
    description: String!
    type: EventType!
    date: DateTime!
    duration: Int!
    location: String
    virtual: Boolean!
    registrationUrl: String!
    capacity: Int
    registered: Int!
  }

  type SupportResources {
    documentation: String!
    faq: String!
    email: String!
    chat: Boolean!
    phone: String
    hours: BusinessHours!
    sla: SupportSLA!
  }

  type SupportSLA {
    responseTime: ResponseTimeSLA!
    availability: Percentage!
    escalation: EscalationPolicy!
  }

  type ResponseTimeSLA {
    critical: Int!
    high: Int!
    medium: Int!
    low: Int!
  }

  type EscalationPolicy {
    levels: [EscalationLevel!]!
    timeouts: [Int!]!
  }

  type EscalationLevel {
    level: Int!
    team: String!
    contacts: [String!]!
  }

  type Announcement {
    id: ID!
    title: String!
    content: String!
    type: AnnouncementType!
    priority: Priority!
    publishedAt: DateTime!
    expiresAt: DateTime
    audience: [UserRole!]!
    tags: [String!]!
  }

  # SDKs and Code Examples
  type SDK {
    language: ProgrammingLanguage!
    name: String!
    version: String!
    description: String!
    downloadUrl: String!
    repository: String!
    documentation: String!
    examples: [CodeExample!]!
    installation: InstallationGuide!
    compatibility: CompatibilityInfo!
    features: [SDKFeature!]!
    downloads: Int!
    rating: Float!
    lastUpdated: DateTime!
  }

  type InstallationGuide {
    packageManager: [PackageManagerInstruction!]!
    manual: ManualInstallation
    requirements: [String!]!
  }

  type PackageManagerInstruction {
    manager: PackageManager!
    command: String!
    configuration: String
  }

  type ManualInstallation {
    steps: [String!]!
    downloadUrl: String!
    verification: String!
  }

  type CompatibilityInfo {
    versions: [String!]!
    platforms: [Platform!]!
    frameworks: [Framework!]!
  }

  type Framework {
    name: String!
    versions: [String!]!
  }

  type SDKFeature {
    name: String!
    description: String!
    example: String
    since: String!
  }

  type CodeExample {
    id: ID!
    title: String!
    description: String!
    language: ProgrammingLanguage!
    code: String!
    endpoint: String
    method: HTTPMethod
    category: ExampleCategory!
    useCase: String!
    difficulty: DifficultyLevel!
    tags: [String!]!
    author: User
    votes: Int!
    views: Int!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  # API Key Management
  type APIKeyUsage {
    key: APIKey!
    period: AnalyticsPeriod!
    requests: UsageMetric!
    dataTransfer: UsageMetric!
    errors: Int!
    topEndpoints: [EndpointUsageStats!]!
    hourlyDistribution: [HourlyUsage!]!
    geographicDistribution: [GeographicAPIUsage!]!
  }

  type EndpointUsageStats {
    endpoint: String!
    method: HTTPMethod!
    requests: Int!
    percentage: Percentage!
    avgResponseTime: Int!
    errors: Int!
  }

  type HourlyUsage {
    hour: Int!
    requests: Int!
    errors: Int!
    avgResponseTime: Int!
  }

  type GeographicAPIUsage {
    country: Country!
    requests: Int!
    percentage: Percentage!
  }

  type Quota {
    id: ID!
    name: String!
    description: String!
    limit: Int!
    used: Int!
    remaining: Int!
    resetDate: Date!
    period: QuotaPeriod!
    overage: QuotaOverage
  }

  type QuotaOverage {
    allowed: Boolean!
    rate: Currency!
    current: Int!
    cost: Currency!
  }

  type APIKeyRotationResult {
    oldKey: String!
    newKey: APIKey!
    transitionPeriod: Int!
    expiresAt: DateTime!
  }

  # Webhooks
  type Webhook {
    id: ID!
    name: String!
    description: String!
    url: String!
    events: [WebhookEvent!]!
    headers: [WebhookHeader!]!
    secret: String
    active: Boolean!
    sslVerification: Boolean!
    retryPolicy: RetryPolicy!
    deliveries: [WebhookDelivery!]!
    stats: WebhookStats!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type WebhookEvent {
    type: EventType!
    description: String!
    schema: JSON!
  }

  type WebhookHeader {
    name: String!
    value: String!
  }

  type RetryPolicy {
    maxRetries: Int!
    backoffStrategy: BackoffStrategy!
    retryDelay: Int!
    maxDelay: Int!
  }

  type WebhookDelivery {
    id: ID!
    webhook: Webhook!
    event: EventType!
    payload: JSON!
    status: DeliveryStatus!
    httpStatus: Int
    response: String
    attempts: Int!
    deliveredAt: DateTime
    nextRetry: DateTime
    createdAt: DateTime!
  }

  type WebhookStats {
    totalDeliveries: Int!
    successfulDeliveries: Int!
    failedDeliveries: Int!
    avgResponseTime: Int!
    successRate: Percentage!
    lastDelivery: DateTime
  }

  type WebhookTestResult {
    success: Boolean!
    status: Int!
    response: String!
    responseTime: Int!
    headers: JSON!
    error: String
  }

  type WebhookDeliveryStatus {
    deliveryId: ID!
    status: DeliveryStatus!
    attempts: Int!
    nextRetry: DateTime
    error: String
  }

  # Developer Applications
  type DeveloperApplication {
    id: ID!
    name: String!
    description: String!
    type: ApplicationType!
    category: ApplicationCategory!
    status: ApplicationStatus!
    developer: User!
    website: String
    privacyPolicy: String
    termsOfService: String
    redirectUris: [String!]
    scopes: [String!]!
    rateLimits: [RateLimit!]!
    quotas: [Quota!]!
    keys: [APIKey!]!
    oauth: OAuthApplication
    review: ApplicationReview
    usage: ApplicationUsage!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type OAuthApplication {
    clientId: String!
    clientSecret: String!
    grantTypes: [GrantType!]!
    responseTypes: [ResponseType!]!
    redirectUris: [String!]!
    scope: [String!]!
    tokenEndpointAuthMethod: TokenAuthMethod!
  }

  type ApplicationReview {
    status: ReviewStatus!
    reviewer: User
    comments: String
    requestedChanges: [String!]
    reviewedAt: DateTime
    resubmittedAt: DateTime
  }

  type ApplicationUsage {
    totalRequests: Int!
    dailyAverage: Float!
    peakUsage: Int!
    lastActivity: DateTime
    activeUsers: Int!
  }

  # API Plans and Monetization
  type APIPlan {
    id: ID!
    name: String!
    description: String!
    type: PlanType!
    pricing: PlanPricing!
    features: [APIFeature!]!
    limits: APILimits!
    support: SupportLevel!
    sla: ServiceLevelAgreement
    popular: Boolean!
    enterprise: Boolean!
    deprecated: Boolean!
  }

  type APIFeature {
    name: String!
    description: String!
    included: Boolean!
    limit: Int
    unit: String
  }

  type APILimits {
    requestsPerMonth: Int
    requestsPerDay: Int
    requestsPerMinute: Int
    concurrentRequests: Int
    dataTransfer: Int
    storage: Int
    webhooks: Int
    applications: Int
  }

  type ServiceLevelAgreement {
    uptime: Percentage!
    responseTime: Int!
    support: SupportSLA!
    penalties: [SLAPenalty!]!
  }

  type SLAPenalty {
    threshold: Percentage!
    penalty: String!
    credit: Percentage
  }

  # API Status and Health
  type APIStatus {
    overall: ServiceStatusType!
    services: [ServiceStatus!]!
    incidents: [StatusIncident!]!
    maintenances: [MaintenanceWindow!]!
    metrics: [StatusMetric!]!
    lastUpdated: DateTime!
  }

  type StatusIncident {
    id: ID!
    title: String!
    description: String!
    status: IncidentStatus!
    severity: IncidentSeverity!
    services: [String!]!
    updates: [IncidentUpdate!]!
    startedAt: DateTime!
    resolvedAt: DateTime
  }

  type IncidentUpdate {
    status: IncidentStatus!
    message: String!
    timestamp: DateTime!
  }

  type MaintenanceWindow {
    id: ID!
    title: String!
    description: String!
    services: [String!]!
    scheduledFor: DateTime!
    duration: Int!
    impact: MaintenanceImpact!
    updates: [MaintenanceUpdate!]!
  }

  type MaintenanceUpdate {
    message: String!
    timestamp: DateTime!
  }

  type StatusMetric {
    name: String!
    value: Float!
    unit: String!
    status: MetricStatus!
  }

  # Analytics and Metrics
  type APIMetricsData {
    period: AnalyticsPeriod!
    overview: APIMetricsOverview!
    endpoints: [EndpointMetrics!]!
    developers: [DeveloperMetrics!]!
    applications: [ApplicationMetrics!]!
    errors: [ErrorMetrics!]!
    geography: [GeographicMetrics!]!
  }

  type APIMetricsOverview {
    totalRequests: Int!
    uniqueDevelopers: Int!
    activeApplications: Int!
    avgResponseTime: Int!
    errorRate: Percentage!
    dataTransferred: Int!
  }

  type EndpointMetrics {
    endpoint: String!
    method: HTTPMethod!
    requests: Int!
    uniqueUsers: Int!
    avgResponseTime: Int!
    errorRate: Percentage!
    popularParameters: [ParameterUsage!]!
  }

  type DeveloperMetrics {
    developer: User!
    requests: Int!
    applications: Int!
    avgResponseTime: Int!
    errorRate: Percentage!
    firstRequest: DateTime!
    lastRequest: DateTime!
  }

  type ApplicationMetrics {
    application: DeveloperApplication!
    requests: Int!
    users: Int!
    avgResponseTime: Int!
    errorRate: Percentage!
    dataTransfer: Int!
  }

  type ErrorMetrics {
    code: Int!
    message: String!
    count: Int!
    percentage: Percentage!
    endpoints: [String!]!
    trend: TrendDirection!
  }

  type GeographicMetrics {
    country: Country!
    requests: Int!
    developers: Int!
    avgResponseTime: Int!
    errorRate: Percentage!
  }

  type AdminAPIAnalytics {
    period: AnalyticsPeriod!
    metrics: APIMetricsData!
    growth: APIGrowthMetrics!
    adoption: APIAdoptionMetrics!
    quality: APIQualityMetrics!
    revenue: APIRevenueMetrics!
  }

  type APIGrowthMetrics {
    requestGrowth: Percentage!
    developerGrowth: Percentage!
    applicationGrowth: Percentage!
    revenueGrowth: Percentage!
    trends: [GrowthTrend!]!
  }

  type GrowthTrend {
    metric: String!
    period: String!
    value: Float!
    growth: Percentage!
  }

  type APIAdoptionMetrics {
    newDevelopers: Int!
    activeDevelopers: Int!
    retentionRate: Percentage!
    timeToFirstSuccess: Int!
    conversionFunnel: [ConversionStep!]!
  }

  type ConversionStep {
    step: String!
    users: Int!
    conversionRate: Percentage!
    dropoffRate: Percentage!
  }

  type APIQualityMetrics {
    uptime: Percentage!
    reliability: Percentage!
    performance: PerformanceScore!
    documentation: DocumentationScore!
    satisfaction: SatisfactionScore!
  }

  type PerformanceScore {
    overall: Float!
    responseTime: Float!
    throughput: Float!
    errorRate: Float!
  }

  type DocumentationScore {
    completeness: Percentage!
    accuracy: Percentage!
    clarity: Float!
    examples: Percentage!
  }

  type SatisfactionScore {
    overall: Float!
    nps: Float!
    csat: Float!
    feedback: [FeedbackSummary!]!
  }

  type APIRevenueMetrics {
    totalRevenue: Currency!
    monthlyRecurring: Currency!
    averageRevenuePerUser: Currency!
    planDistribution: [PlanRevenue!]!
    growth: Percentage!
  }

  type DeveloperStats {
    total: Int!
    active: Int!
    new: Int!
    byPlan: [PlanDeveloperCount!]!
    byRegion: [RegionDeveloperCount!]!
    topDevelopers: [TopDeveloper!]!
    engagement: DeveloperEngagement!
  }

  type PlanDeveloperCount {
    plan: APIPlan!
    count: Int!
    percentage: Percentage!
  }

  type RegionDeveloperCount {
    region: String!
    count: Int!
    percentage: Percentage!
  }

  type TopDeveloper {
    developer: User!
    requests: Int!
    applications: Int!
    revenue: Currency!
  }

  type DeveloperEngagement {
    avgRequestsPerDeveloper: Float!
    avgApplicationsPerDeveloper: Float!
    retentionRate: Percentage!
    activationRate: Percentage!
  }

  # Feedback and Support
  type APIFeedback {
    id: ID!
    type: FeedbackType!
    category: FeedbackCategory!
    rating: Int!
    comment: String!
    endpoint: String
    version: String
    user: User!
    response: FeedbackResponse
    createdAt: DateTime!
  }

  type FeedbackResponse {
    message: String!
    responder: User!
    respondedAt: DateTime!
  }

  type APIIssue {
    id: ID!
    title: String!
    description: String!
    type: IssueType!
    severity: IssueSeverity!
    status: IssueStatus!
    endpoint: String
    version: String
    reproduction: ReproductionSteps!
    reporter: User!
    assignee: User
    resolution: IssueResolution
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type ReproductionSteps {
    steps: [String!]!
    expectedResult: String!
    actualResult: String!
    environment: EnvironmentInfo!
  }

  type EnvironmentInfo {
    platform: String!
    language: String
    sdk: String
    version: String
  }

  type IssueResolution {
    type: ResolutionType!
    description: String!
    version: String
    resolvedBy: User!
    resolvedAt: DateTime!
  }

  type APIFeatureRequest {
    id: ID!
    title: String!
    description: String!
    category: FeatureCategory!
    priority: Priority!
    status: FeatureRequestStatus!
    votes: Int!
    requester: User!
    comments: [FeatureComment!]!
    implementation: FeatureImplementation
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type FeatureComment {
    id: ID!
    comment: String!
    author: User!
    createdAt: DateTime!
  }

  type FeatureImplementation {
    version: String!
    estimatedDate: Date
    implementedAt: DateTime
    description: String!
  }

  # Developer Onboarding
  type OnboardingResult {
    completed: Boolean!
    progress: OnboardingProgress!
    nextSteps: [OnboardingStep!]!
    resources: [OnboardingResource!]!
  }

  type OnboardingProgress {
    completedSteps: Int!
    totalSteps: Int!
    percentage: Percentage!
    currentStep: OnboardingStep
  }

  type OnboardingResource {
    type: ResourceType!
    title: String!
    url: String!
    description: String!
  }

  type DeveloperAccessRequest {
    id: ID!
    user: User!
    type: AccessType!
    justification: String!
    status: RequestStatus!
    reviewer: User
    reviewedAt: DateTime
    createdAt: DateTime!
  }

  # Documentation Contributions
  type DocumentationSuggestion {
    id: ID!
    type: SuggestionType!
    section: String!
    currentContent: String
    suggestedContent: String!
    reason: String!
    author: User!
    status: SuggestionStatus!
    reviewer: User
    response: String
    createdAt: DateTime!
    reviewedAt: DateTime
  }

  # Events and Updates
  type APIStatusUpdate {
    service: String!
    status: ServiceStatusType!
    message: String!
    timestamp: DateTime!
  }

  type ServiceStatusUpdate {
    service: String!
    status: ServiceStatusType!
    metrics: [StatusMetric!]!
    timestamp: DateTime!
  }

  type APIKeyUsageAlert {
    key: APIKey!
    metric: String!
    threshold: Float!
    current: Float!
    message: String!
    timestamp: DateTime!
  }

  type RateLimitAlert {
    key: APIKey!
    endpoint: String!
    limit: Int!
    requests: Int!
    windowStart: DateTime!
    timestamp: DateTime!
  }

  type ApplicationStatusUpdate {
    application: DeveloperApplication!
    oldStatus: ApplicationStatus!
    newStatus: ApplicationStatus!
    message: String!
    timestamp: DateTime!
  }

  type DocumentationUpdate {
    version: String
    section: String!
    type: UpdateType!
    summary: String!
    timestamp: DateTime!
  }

  # Input Types
  input CreateAPIKeyInput {
    name: String!
    description: String!
    scopes: [String!]!
    restrictions: APIKeyRestrictionsInput
    expiresAt: DateTime
  }

  input APIKeyRestrictionsInput {
    allowedIPs: [String!]
    allowedDomains: [String!]
    allowedEndpoints: [String!]
    allowedMethods: [HTTPMethod!]
  }

  input UpdateAPIKeyInput {
    name: String
    description: String
    scopes: [String!]
    restrictions: APIKeyRestrictionsInput
    expiresAt: DateTime
    active: Boolean
  }

  input RateLimitInput {
    requests: Int!
    window: String!
    burst: Int
  }

  input QuotaIncreaseInput {
    keyId: ID!
    quota: String!
    requestedLimit: Int!
    justification: String!
    urgency: Priority!
  }

  input CreateWebhookInput {
    name: String!
    description: String!
    url: String!
    events: [EventType!]!
    headers: [WebhookHeaderInput!]
    secret: String
    sslVerification: Boolean = true
    retryPolicy: RetryPolicyInput
  }

  input WebhookHeaderInput {
    name: String!
    value: String!
  }

  input RetryPolicyInput {
    maxRetries: Int = 3
    backoffStrategy: BackoffStrategy = EXPONENTIAL
    retryDelay: Int = 1000
    maxDelay: Int = 300000
  }

  input UpdateWebhookInput {
    name: String
    description: String
    url: String
    events: [EventType!]
    headers: [WebhookHeaderInput!]
    secret: String
    active: Boolean
    sslVerification: Boolean
    retryPolicy: RetryPolicyInput
  }

  input CreateDeveloperApplicationInput {
    name: String!
    description: String!
    type: ApplicationType!
    category: ApplicationCategory!
    website: String
    privacyPolicy: String
    termsOfService: String
    redirectUris: [String!]
    scopes: [String!]!
  }

  input UpdateDeveloperApplicationInput {
    name: String
    description: String
    website: String
    privacyPolicy: String
    termsOfService: String
    redirectUris: [String!]
    scopes: [String!]
  }

  input CreateOAuthApplicationInput {
    applicationId: ID!
    grantTypes: [GrantType!]!
    responseTypes: [ResponseType!]!
    redirectUris: [String!]!
    scope: [String!]!
    tokenEndpointAuthMethod: TokenAuthMethod!
  }

  input UpdateOAuthApplicationInput {
    grantTypes: [GrantType!]
    responseTypes: [ResponseType!]
    redirectUris: [String!]
    scope: [String!]
    tokenEndpointAuthMethod: TokenAuthMethod
  }

  input APIFeedbackInput {
    type: FeedbackType!
    category: FeedbackCategory!
    rating: Int!
    comment: String!
    endpoint: String
    version: String
  }

  input APIIssueInput {
    title: String!
    description: String!
    type: IssueType!
    severity: IssueSeverity!
    endpoint: String
    version: String
    reproduction: ReproductionStepsInput!
  }

  input ReproductionStepsInput {
    steps: [String!]!
    expectedResult: String!
    actualResult: String!
    environment: EnvironmentInfoInput!
  }

  input EnvironmentInfoInput {
    platform: String!
    language: String
    sdk: String
    version: String
  }

  input APIFeatureRequestInput {
    title: String!
    description: String!
    category: FeatureCategory!
    priority: Priority = NORMAL
  }

  input OnboardingCompletionInput {
    steps: [String!]!
    feedback: String
  }

  input DeveloperAccessRequestInput {
    type: AccessType!
    justification: String!
  }

  input DocumentationChangeInput {
    type: SuggestionType!
    section: String!
    currentContent: String
    suggestedContent: String!
    reason: String!
  }

  input CodeExampleInput {
    title: String!
    description: String!
    language: ProgrammingLanguage!
    code: String!
    endpoint: String
    method: HTTPMethod
    category: ExampleCategory!
    useCase: String!
    difficulty: DifficultyLevel!
    tags: [String!]!
  }

  input APIKeyLimitsInput {
    rateLimits: [RateLimitInput!]!
    quotas: [QuotaInput!]!
  }

  input QuotaInput {
    name: String!
    limit: Int!
    period: QuotaPeriod!
    overage: QuotaOverageInput
  }

  input QuotaOverageInput {
    allowed: Boolean!
    rate: Currency!
  }

  input UpdateAPIDocumentationInput {
    version: String!
    sections: [DocumentationSectionInput!]!
  }

  input DocumentationSectionInput {
    type: DocumentationSectionType!
    content: String!
  }

  input PublishAPIVersionInput {
    version: String!
    name: String!
    description: String!
    changelog: [ChangelogEntryInput!]!
    migration: MigrationGuideInput
    breaking: Boolean = false
  }

  input ChangelogEntryInput {
    type: ChangeType!
    title: String!
    description: String!
    breaking: Boolean = false
    endpoints: [String!]
    migration: String
  }

  input MigrationGuideInput {
    fromVersion: String!
    title: String!
    description: String!
    steps: [MigrationStepInput!]!
    breaking: [BreakingChangeInput!]!
    timeline: String!
  }

  input MigrationStepInput {
    title: String!
    description: String!
    code: String
    automated: Boolean = false
    impact: MigrationImpact!
  }

  input BreakingChangeInput {
    endpoint: String
    change: String!
    impact: String!
    workaround: String!
  }

  # Connections
  type APIKeyConnection {
    edges: [APIKeyEdge!]!
    pageInfo: PageInfo!
  }

  type APIKeyEdge {
    node: APIKey!
    cursor: String!
  }

  type WebhookConnection {
    edges: [WebhookEdge!]!
    pageInfo: PageInfo!
  }

  type WebhookEdge {
    node: Webhook!
    cursor: String!
  }

  type WebhookDeliveryConnection {
    edges: [WebhookDeliveryEdge!]!
    pageInfo: PageInfo!
  }

  type WebhookDeliveryEdge {
    node: WebhookDelivery!
    cursor: String!
  }

  type DeveloperApplicationConnection {
    edges: [DeveloperApplicationEdge!]!
    pageInfo: PageInfo!
  }

  type DeveloperApplicationEdge {
    node: DeveloperApplication!
    cursor: String!
  }

  # Enums
  enum APIVersionStatus {
    DEVELOPMENT
    BETA
    STABLE
    DEPRECATED
    SUNSET
  }

  enum ChangeType {
    ADDED
    CHANGED
    DEPRECATED
    REMOVED
    FIXED
    SECURITY
  }

  enum AuthenticationType {
    API_KEY
    BEARER_TOKEN
    OAUTH2
    BASIC_AUTH
    CUSTOM
  }

  enum HTTPMethod {
    GET
    POST
    PUT
    PATCH
    DELETE
    HEAD
    OPTIONS
  }

  enum ParameterLocation {
    QUERY
    HEADER
    PATH
    COOKIE
    FORM
  }

  enum SchemaType {
    STRING
    NUMBER
    INTEGER
    BOOLEAN
    ARRAY
    OBJECT
    NULL
  }

  enum ExampleCategory {
    AUTHENTICATION
    BASIC_USAGE
    ADVANCED
    ERROR_HANDLING
    PAGINATION
    FILTERING
    WEBHOOKS
    REAL_TIME
  }

  enum GuideCategory {
    GETTING_STARTED
    AUTHENTICATION
    RATE_LIMITING
    WEBHOOKS
    SDKs
    TROUBLESHOOTING
    BEST_PRACTICES
    MIGRATION
  }

  enum ProgrammingLanguage {
    JAVASCRIPT
    TYPESCRIPT
    PYTHON
    PHP
    RUBY
    JAVA
    CSHARP
    GO
    RUST
    SWIFT
    KOTLIN
    DART
    R
    SCALA
    PERL
    LUA
    BASH
    POWERSHELL
  }

  enum TutorialCategory {
    GETTING_STARTED
    INTEGRATION
    ADVANCED
    BEST_PRACTICES
    TROUBLESHOOTING
    USE_CASES
  }

  enum SampleCategory {
    BASIC
    INTERMEDIATE
    ADVANCED
    INTEGRATION
    TESTING
    PRODUCTION
  }

  enum ToolType {
    CLI
    GUI
    LIBRARY
    PLUGIN
    EXTENSION
    SIMULATOR
    TESTING
    MONITORING
  }

  enum Platform {
    WINDOWS
    MACOS
    LINUX
    WEB
    MOBILE
    DOCKER
    CLOUD
  }

  enum PackageManager {
    NPM
    YARN
    PIP
    COMPOSER
    GEM
    MAVEN
    GRADLE
    NUGET
    CARGO
    GO_MOD
  }

  enum EventType {
    USER_CREATED
    USER_UPDATED
    USER_DELETED
    SUBSCRIPTION_CREATED
    SUBSCRIPTION_UPDATED
    SUBSCRIPTION_CANCELLED
    PAYMENT_SUCCESSFUL
    PAYMENT_FAILED
    TAX_CALCULATION_COMPLETED
    API_KEY_CREATED
    API_KEY_REVOKED
    WEBHOOK_DELIVERY_FAILED
    CUSTOM
  }

  enum DeliveryStatus {
    PENDING
    DELIVERED
    FAILED
    RETRYING
    ABANDONED
  }

  enum BackoffStrategy {
    LINEAR
    EXPONENTIAL
    FIXED
  }

  enum ApplicationType {
    WEB_APPLICATION
    MOBILE_APPLICATION
    DESKTOP_APPLICATION
    API_CLIENT
    WEBHOOK_CONSUMER
    INTEGRATION
    OTHER
  }

  enum ApplicationCategory {
    FINTECH
    ACCOUNTING
    TAX_PREPARATION
    BUSINESS_INTELLIGENCE
    E_COMMERCE
    EDUCATION
    HEALTHCARE
    GOVERNMENT
    OTHER
  }

  enum ApplicationStatus {
    DRAFT
    SUBMITTED
    UNDER_REVIEW
    APPROVED
    REJECTED
    SUSPENDED
    ARCHIVED
  }

  enum ReviewStatus {
    PENDING
    IN_REVIEW
    APPROVED
    REJECTED
    CHANGES_REQUESTED
  }

  enum GrantType {
    AUTHORIZATION_CODE
    CLIENT_CREDENTIALS
    REFRESH_TOKEN
    IMPLICIT
    PASSWORD
  }

  enum ResponseType {
    CODE
    TOKEN
    ID_TOKEN
  }

  enum TokenAuthMethod {
    CLIENT_SECRET_POST
    CLIENT_SECRET_BASIC
    CLIENT_SECRET_JWT
    PRIVATE_KEY_JWT
    NONE
  }

  enum QuotaPeriod {
    MINUTE
    HOUR
    DAY
    WEEK
    MONTH
    YEAR
  }

  enum IncidentStatus {
    INVESTIGATING
    IDENTIFIED
    MONITORING
    RESOLVED
  }

  enum MaintenanceImpact {
    NONE
    MINOR
    MAJOR
    CRITICAL
  }

  enum MetricStatus {
    NORMAL
    WARNING
    CRITICAL
    UNKNOWN
  }

  enum FeedbackType {
    BUG_REPORT
    FEATURE_REQUEST
    GENERAL_FEEDBACK
    DOCUMENTATION
    PERFORMANCE
    USABILITY
  }

  enum FeedbackCategory {
    API_DESIGN
    DOCUMENTATION
    PERFORMANCE
    RELIABILITY
    SUPPORT
    PRICING
    FEATURES
  }

  enum IssueType {
    BUG
    PERFORMANCE
    SECURITY
    DOCUMENTATION
    FEATURE
    SUPPORT
  }

  enum IssueSeverity {
    LOW
    MEDIUM
    HIGH
    CRITICAL
    BLOCKER
  }

  enum IssueStatus {
    OPEN
    IN_PROGRESS
    RESOLVED
    CLOSED
    DUPLICATE
    WONT_FIX
  }

  enum ResolutionType {
    FIXED
    DUPLICATE
    WONT_FIX
    CANNOT_REPRODUCE
    WORKS_AS_DESIGNED
  }

  enum FeatureRequestStatus {
    SUBMITTED
    UNDER_REVIEW
    APPROVED
    IN_DEVELOPMENT
    COMPLETED
    REJECTED
    DEFERRED
  }

  enum AccessType {
    BETA_ACCESS
    PREMIUM_FEATURES
    INCREASED_LIMITS
    PRIVATE_ENDPOINTS
    CUSTOM_INTEGRATION
  }

  enum RequestStatus {
    PENDING
    APPROVED
    REJECTED
    EXPIRED
  }

  enum SuggestionType {
    CONTENT_UPDATE
    NEW_SECTION
    EXAMPLE_IMPROVEMENT
    ERROR_CORRECTION
    CLARIFICATION
  }

  enum ValidationType {
    API_CALL
    CODE_EXECUTION
    MANUAL_VERIFICATION
    AUTOMATED_TEST
  }

  enum MigrationImpact {
    LOW
    MEDIUM
    HIGH
    BREAKING
  }

  enum AnnouncementType {
    NEW_FEATURE
    MAINTENANCE
    DEPRECATION
    SECURITY
    POLICY_CHANGE
    COMMUNITY
  }

  enum DocumentationSectionType {
    OVERVIEW
    AUTHENTICATION
    ENDPOINTS
    SCHEMAS
    EXAMPLES
    GUIDES
    CHANGELOG
    MIGRATION
  }
`;

module.exports = apiTypeDefs;