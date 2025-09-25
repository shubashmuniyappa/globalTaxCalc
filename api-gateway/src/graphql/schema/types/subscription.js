/**
 * Subscription GraphQL Type Definitions
 * Subscription plans, billing, and enterprise features
 */

const { gql } = require('graphql-tag');

const subscriptionTypeDefs = gql`
  extend type Query {
    # Subscription Plans
    getSubscriptionPlans(
      filters: [FilterInput!]
      sort: [SortInput!]
    ): [SubscriptionPlan!]!

    getSubscriptionPlan(id: ID!): SubscriptionPlan

    # Current User Subscription
    getMySubscription: UserSubscription @auth(role: USER)

    # Subscription Usage
    getSubscriptionUsage(
      period: UsagePeriod
    ): SubscriptionUsage @auth(role: USER)

    # Billing
    getBillingHistory(
      pagination: PaginationInput
    ): BillingTransactionConnection @auth(role: USER)

    getUpcomingInvoice: Invoice @auth(role: USER)

    # Enterprise Features
    getEnterpriseFeatures: [EnterpriseFeature!]! @auth(role: ENTERPRISE)

    # Admin Queries
    getSubscriptionStats: SubscriptionStats @auth(role: ADMIN)
    getRevenueMetrics(
      period: RevenueMetricsPeriod!
    ): RevenueMetrics @auth(role: ADMIN)
  }

  extend type Mutation {
    # Subscription Management
    createSubscription(input: CreateSubscriptionInput!): UserSubscription! @auth(role: USER)
    updateSubscription(input: UpdateSubscriptionInput!): UserSubscription! @auth(role: USER)
    cancelSubscription(input: CancelSubscriptionInput!): UserSubscription! @auth(role: USER)
    resumeSubscription: UserSubscription! @auth(role: USER)

    # Plan Changes
    changePlan(input: ChangePlanInput!): UserSubscription! @auth(role: USER)
    upgradeToEnterprise(input: EnterpriseUpgradeInput!): UserSubscription! @auth(role: USER)

    # Trials
    startTrial(planId: ID!): UserSubscription! @auth(role: USER)
    extendTrial(days: Int!): UserSubscription! @auth(role: ADMIN)

    # Payment Methods
    addPaymentMethod(input: PaymentMethodInput!): PaymentMethod! @auth(role: USER)
    updatePaymentMethod(id: ID!, input: UpdatePaymentMethodInput!): PaymentMethod! @auth(role: USER)
    deletePaymentMethod(id: ID!): OperationResponse! @auth(role: USER)
    setDefaultPaymentMethod(id: ID!): OperationResponse! @auth(role: USER)

    # Billing
    retryPayment(invoiceId: ID!): PaymentResult! @auth(role: USER)
    requestRefund(input: RefundRequestInput!): RefundRequest! @auth(role: USER)

    # Coupons and Discounts
    applyCoupon(code: String!): CouponApplication! @auth(role: USER)
    removeCoupon: OperationResponse! @auth(role: USER)

    # Enterprise Features
    requestEnterpriseQuote(input: EnterpriseQuoteInput!): EnterpriseQuote! @auth(role: USER)
    activateEnterpriseFeature(featureId: ID!): EnterpriseFeatureActivation! @auth(role: ENTERPRISE)

    # Admin Mutations
    createSubscriptionPlan(input: CreatePlanInput!): SubscriptionPlan! @auth(role: ADMIN)
    updateSubscriptionPlan(id: ID!, input: UpdatePlanInput!): SubscriptionPlan! @auth(role: ADMIN)
    archiveSubscriptionPlan(id: ID!): OperationResponse! @auth(role: ADMIN)

    # Coupon Management
    createCoupon(input: CreateCouponInput!): Coupon! @auth(role: ADMIN)
    updateCoupon(id: ID!, input: UpdateCouponInput!): Coupon! @auth(role: ADMIN)
    deactivateCoupon(id: ID!): OperationResponse! @auth(role: ADMIN)
  }

  extend type Subscription {
    # Subscription Events
    subscriptionUpdated(userId: ID!): UserSubscription! @auth(role: USER)
    paymentProcessed(userId: ID!): PaymentResult! @auth(role: USER)
    invoiceCreated(userId: ID!): Invoice! @auth(role: USER)
    usageLimitReached(userId: ID!): UsageAlert! @auth(role: USER)

    # Admin Events
    subscriptionCreated: UserSubscription! @auth(role: ADMIN)
    subscriptionCanceled: UserSubscription! @auth(role: ADMIN)
    paymentFailed: PaymentFailure! @auth(role: ADMIN)
    revenueUpdate: RevenueUpdate! @auth(role: ADMIN)
  }

  # Subscription Plan Types
  type SubscriptionPlan {
    id: ID!
    name: String!
    displayName: String!
    description: String!
    type: PlanType!
    tier: PlanTier!
    pricing: PlanPricing!
    features: [PlanFeature!]!
    limits: PlanLimits!
    billing: BillingConfiguration!
    trial: TrialConfiguration
    metadata: JSON
    status: PlanStatus!
    popular: Boolean!
    recommended: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!

    # Computed fields
    isActive: Boolean!
    subscriberCount: Int!
    conversionRate: Percentage
  }

  type PlanPricing {
    monthly: PlanPrice
    yearly: PlanPrice
    custom: Boolean!
    enterprise: Boolean!
    currency: CurrencyCode!
  }

  type PlanPrice {
    amount: Currency!
    currency: CurrencyCode!
    discount: Percentage
    setupFee: Currency
  }

  type PlanFeature {
    id: ID!
    name: String!
    description: String!
    category: FeatureCategory!
    type: FeatureType!
    value: String
    included: Boolean!
    unlimited: Boolean!
    highlighted: Boolean!
  }

  type PlanLimits {
    apiRequests: UsageLimit
    calculations: UsageLimit
    reports: UsageLimit
    storage: UsageLimit
    users: UsageLimit
    customFields: UsageLimit
    integrations: UsageLimit
    support: SupportLevel!
  }

  type UsageLimit {
    monthly: Int
    daily: Int
    burst: Int
    unlimited: Boolean!
  }

  type BillingConfiguration {
    cycle: BillingCycle!
    upfrontPayment: Boolean!
    prorationPolicy: ProrationPolicy!
    gracePeriod: Int!
    autoRenewal: Boolean!
  }

  type TrialConfiguration {
    enabled: Boolean!
    duration: Int!
    requiresPaymentMethod: Boolean!
    features: [String!]!
  }

  # User Subscription
  type UserSubscription {
    id: ID!
    user: User!
    plan: SubscriptionPlan!
    status: SubscriptionStatus!
    currentPeriodStart: Date!
    currentPeriodEnd: Date!
    billingCycleAnchor: Date!
    cancelAtPeriodEnd: Boolean!
    canceledAt: DateTime
    endedAt: DateTime
    trialStart: Date
    trialEnd: Date
    discount: AppliedDiscount
    usage: CurrentUsage!
    billing: SubscriptionBilling!
    metadata: JSON
    createdAt: DateTime!
    updatedAt: DateTime!

    # Computed fields
    isActive: Boolean!
    isTrialing: Boolean!
    daysUntilRenewal: Int!
    nextBillingAmount: Currency!
    overageCharges: Currency!
  }

  type AppliedDiscount {
    coupon: Coupon!
    percentOff: Int
    amountOff: Currency
    duration: DiscountDuration!
    durationInMonths: Int
    start: Date!
    end: Date
  }

  type CurrentUsage {
    period: UsagePeriod!
    apiRequests: UsageMetric!
    calculations: UsageMetric!
    reports: UsageMetric!
    storage: UsageMetric!
    dataTransfer: UsageMetric!
    resetDate: Date!
  }

  type UsageMetric {
    current: Int!
    limit: Int
    unlimited: Boolean!
    percentage: Percentage!
    overage: Int!
    cost: Currency!
  }

  type SubscriptionBilling {
    nextInvoiceDate: Date!
    nextInvoiceAmount: Currency!
    lastInvoiceDate: Date
    lastInvoiceAmount: Currency
    paymentMethod: PaymentMethod
    billingAddress: Address
    taxRate: Percentage
    currency: CurrencyCode!
  }

  # Subscription Usage and Analytics
  type SubscriptionUsage {
    subscription: UserSubscription!
    current: UsagePeriodData!
    previous: UsagePeriodData!
    trend: UsageTrend!
    projections: [UsageProjection!]!
    recommendations: [UsageRecommendation!]!
  }

  type UsagePeriodData {
    period: String!
    startDate: Date!
    endDate: Date!
    metrics: [UsageMetricData!]!
    cost: Currency!
    overages: [OverageData!]!
  }

  type UsageMetricData {
    name: String!
    current: Int!
    limit: Int
    percentage: Percentage!
    trend: Float!
  }

  type OverageData {
    metric: String!
    amount: Int!
    rate: Currency!
    cost: Currency!
  }

  type UsageTrend {
    direction: TrendDirection!
    percentage: Float!
    period: String!
  }

  type UsageProjection {
    date: Date!
    estimated: Int!
    confidence: Percentage!
  }

  type UsageRecommendation {
    type: RecommendationType!
    title: String!
    description: String!
    impact: String!
    action: String!
    priority: Priority!
  }

  # Payment and Billing
  type PaymentResult {
    id: ID!
    status: PaymentStatus!
    amount: Currency!
    currency: CurrencyCode!
    method: PaymentMethod!
    invoice: Invoice
    receipt: PaymentReceipt
    failureReason: String
    processedAt: DateTime!
  }

  type PaymentReceipt {
    id: ID!
    number: String!
    url: String!
    email: String!
    sentAt: DateTime!
  }

  type RefundRequest {
    id: ID!
    amount: Currency!
    reason: String!
    status: RefundStatus!
    invoice: Invoice!
    processedAt: DateTime
    createdAt: DateTime!
  }

  # Coupons and Discounts
  type CouponApplication {
    success: Boolean!
    coupon: Coupon
    discount: AppliedDiscount
    savings: Currency!
    message: String
    errors: [ValidationError!]
  }

  # Enterprise Features
  type EnterpriseFeature {
    id: ID!
    name: String!
    description: String!
    category: EnterpriseCategory!
    enabled: Boolean!
    configuration: JSON
    pricing: EnterpriseFeaturePricing
    requirements: [String!]!
  }

  type EnterpriseFeaturePricing {
    type: EnterprisePricingType!
    basePrice: Currency
    perUserPrice: Currency
    perRequestPrice: Currency
    custom: Boolean!
  }

  type EnterpriseQuote {
    id: ID!
    contact: QuoteContact!
    requirements: EnterpriseRequirements!
    pricing: QuotePricing!
    status: QuoteStatus!
    validUntil: Date!
    createdAt: DateTime!
  }

  type QuoteContact {
    name: String!
    email: String!
    company: String!
    phone: String
    title: String
  }

  type EnterpriseRequirements {
    users: Int!
    apiRequests: Int!
    features: [String!]!
    integrations: [String!]!
    support: EnterpriseSupportLevel!
    compliance: [ComplianceRequirement!]!
  }

  type QuotePricing {
    setup: Currency!
    monthly: Currency!
    yearly: Currency!
    discount: Percentage
    currency: CurrencyCode!
  }

  type ComplianceRequirement {
    type: ComplianceType!
    required: Boolean!
    certified: Boolean!
  }

  type EnterpriseFeatureActivation {
    feature: EnterpriseFeature!
    activatedAt: DateTime!
    configuration: JSON
    cost: Currency
  }

  # Statistics and Analytics
  type SubscriptionStats {
    overview: SubscriptionOverview!
    planDistribution: [PlanDistribution!]!
    churnAnalysis: ChurnAnalysis!
    revenueMetrics: RevenueOverview!
    trialConversion: TrialConversionStats!
    growth: SubscriptionGrowth!
  }

  type SubscriptionOverview {
    total: Int!
    active: Int!
    trialing: Int!
    canceled: Int!
    pastDue: Int!
    mrr: Currency!
    arr: Currency!
    averageRevenuePerUser: Currency!
  }

  type PlanDistribution {
    plan: SubscriptionPlan!
    count: Int!
    percentage: Percentage!
    revenue: Currency!
  }

  type ChurnAnalysis {
    monthlyChurnRate: Percentage!
    averageLifetime: Int!
    churnReasons: [ChurnReason!]!
    cohortAnalysis: [CohortData!]!
  }

  type ChurnReason {
    reason: String!
    count: Int!
    percentage: Percentage!
  }

  type CohortData {
    month: String!
    size: Int!
    retention: [Percentage!]!
  }

  type RevenueOverview {
    total: Currency!
    recurring: Currency!
    oneTime: Currency!
    growth: Percentage!
    forecast: Currency!
  }

  type TrialConversionStats {
    started: Int!
    converted: Int!
    rate: Percentage!
    averageTrialLength: Int!
    conversionByPlan: [PlanConversion!]!
  }

  type PlanConversion {
    plan: SubscriptionPlan!
    trials: Int!
    conversions: Int!
    rate: Percentage!
  }

  type SubscriptionGrowth {
    newSubscriptions: [GrowthData!]!
    upgrades: [GrowthData!]!
    downgrades: [GrowthData!]!
    cancellations: [GrowthData!]!
  }

  type GrowthData {
    period: String!
    count: Int!
    revenue: Currency!
  }

  type RevenueMetrics {
    period: RevenueMetricsPeriod!
    total: Currency!
    recurring: Currency!
    oneTime: Currency!
    breakdown: RevenueBreakdown!
    growth: RevenueGrowth!
    projections: [RevenueProjection!]!
  }

  type RevenueBreakdown {
    byPlan: [PlanRevenue!]!
    byRegion: [RegionRevenue!]!
    byChannel: [ChannelRevenue!]!
  }

  type PlanRevenue {
    plan: SubscriptionPlan!
    revenue: Currency!
    subscribers: Int!
    growth: Percentage!
  }

  type RegionRevenue {
    country: Country!
    revenue: Currency!
    subscribers: Int!
    growth: Percentage!
  }

  type ChannelRevenue {
    channel: String!
    revenue: Currency!
    subscribers: Int!
    conversion: Percentage!
  }

  type RevenueGrowth {
    monthOverMonth: Percentage!
    yearOverYear: Percentage!
    compound: Percentage!
  }

  type RevenueProjection {
    period: String!
    estimated: Currency!
    conservative: Currency!
    optimistic: Currency!
    confidence: Percentage!
  }

  # Events and Notifications
  type UsageAlert {
    id: ID!
    type: UsageAlertType!
    metric: String!
    threshold: Percentage!
    current: Int!
    limit: Int!
    message: String!
    timestamp: DateTime!
  }

  type PaymentFailure {
    id: ID!
    subscription: UserSubscription!
    invoice: Invoice!
    reason: String!
    retryAt: DateTime
    attempts: Int!
    timestamp: DateTime!
  }

  type RevenueUpdate {
    period: String!
    total: Currency!
    change: Currency!
    percentage: Percentage!
    timestamp: DateTime!
  }

  # Input Types
  input CreateSubscriptionInput {
    planId: ID!
    paymentMethodId: ID
    couponCode: String
    trial: Boolean = false
    billingAddress: AddressInput
    metadata: JSON
  }

  input UpdateSubscriptionInput {
    planId: ID
    couponCode: String
    billingAddress: AddressInput
    metadata: JSON
  }

  input CancelSubscriptionInput {
    reason: CancelationReason
    feedback: String
    immediate: Boolean = false
    scheduledDate: Date
  }

  input ChangePlanInput {
    planId: ID!
    proration: Boolean = true
    billingCycleAnchor: BillingCycleAnchor = UNCHANGED
  }

  input EnterpriseUpgradeInput {
    contact: QuoteContactInput!
    requirements: EnterpriseRequirementsInput!
    startDate: Date
  }

  input QuoteContactInput {
    name: String!
    email: String!
    company: String!
    phone: String
    title: String
  }

  input EnterpriseRequirementsInput {
    users: Int!
    apiRequests: Int!
    features: [String!]!
    integrations: [String!]!
    support: EnterpriseSupportLevel!
    compliance: [ComplianceRequirement!]!
  }

  input PaymentMethodInput {
    type: PaymentMethodType!
    token: String!
    billingAddress: AddressInput!
    makeDefault: Boolean = false
  }

  input UpdatePaymentMethodInput {
    billingAddress: AddressInput
    makeDefault: Boolean
  }

  input RefundRequestInput {
    invoiceId: ID!
    amount: Currency
    reason: String!
  }

  input EnterpriseQuoteInput {
    contact: QuoteContactInput!
    requirements: EnterpriseRequirementsInput!
    timeline: String
    budget: Currency
    notes: String
  }

  input CreatePlanInput {
    name: String!
    displayName: String!
    description: String!
    type: PlanType!
    tier: PlanTier!
    pricing: PlanPricingInput!
    features: [PlanFeatureInput!]!
    limits: PlanLimitsInput!
    billing: BillingConfigurationInput!
    trial: TrialConfigurationInput
    metadata: JSON
  }

  input PlanPricingInput {
    monthly: PlanPriceInput
    yearly: PlanPriceInput
    custom: Boolean = false
    enterprise: Boolean = false
    currency: CurrencyCode!
  }

  input PlanPriceInput {
    amount: Currency!
    currency: CurrencyCode!
    discount: Percentage
    setupFee: Currency
  }

  input PlanFeatureInput {
    name: String!
    description: String!
    category: FeatureCategory!
    type: FeatureType!
    value: String
    included: Boolean!
    unlimited: Boolean = false
    highlighted: Boolean = false
  }

  input PlanLimitsInput {
    apiRequests: UsageLimitInput
    calculations: UsageLimitInput
    reports: UsageLimitInput
    storage: UsageLimitInput
    users: UsageLimitInput
    customFields: UsageLimitInput
    integrations: UsageLimitInput
    support: SupportLevel!
  }

  input UsageLimitInput {
    monthly: Int
    daily: Int
    burst: Int
    unlimited: Boolean = false
  }

  input BillingConfigurationInput {
    cycle: BillingCycle!
    upfrontPayment: Boolean = false
    prorationPolicy: ProrationPolicy!
    gracePeriod: Int!
    autoRenewal: Boolean = true
  }

  input TrialConfigurationInput {
    enabled: Boolean!
    duration: Int!
    requiresPaymentMethod: Boolean = false
    features: [String!]!
  }

  input UpdatePlanInput {
    name: String
    displayName: String
    description: String
    pricing: PlanPricingInput
    features: [PlanFeatureInput!]
    limits: PlanLimitsInput
    billing: BillingConfigurationInput
    trial: TrialConfigurationInput
    metadata: JSON
    status: PlanStatus
  }

  input CreateCouponInput {
    name: String!
    code: String!
    type: CouponType!
    value: Int!
    currency: CurrencyCode
    duration: DiscountDuration!
    durationInMonths: Int
    maxRedemptions: Int
    expiresAt: DateTime
    restrictions: CouponRestrictionsInput
  }

  input CouponRestrictionsInput {
    minimumAmount: Currency
    plans: [ID!]
    firstTimeOnly: Boolean
    existingCustomersOnly: Boolean
  }

  input UpdateCouponInput {
    name: String
    maxRedemptions: Int
    expiresAt: DateTime
    restrictions: CouponRestrictionsInput
  }

  # Connections
  type BillingTransactionConnection {
    edges: [BillingTransactionEdge!]!
    pageInfo: PageInfo!
  }

  type BillingTransactionEdge {
    node: BillingTransaction!
    cursor: String!
  }

  # Enums
  enum PlanType {
    FREE
    BASIC
    PROFESSIONAL
    BUSINESS
    ENTERPRISE
    CUSTOM
  }

  enum PlanTier {
    STARTER
    GROWTH
    PROFESSIONAL
    ENTERPRISE
    CUSTOM
  }

  enum PlanStatus {
    ACTIVE
    INACTIVE
    ARCHIVED
    DRAFT
  }

  enum FeatureCategory {
    CORE
    ANALYTICS
    INTEGRATIONS
    SUPPORT
    SECURITY
    COMPLIANCE
    API
    STORAGE
    COLLABORATION
    CUSTOMIZATION
  }

  enum FeatureType {
    BOOLEAN
    NUMERIC
    TEXT
    LIST
    UNLIMITED
  }

  enum BillingCycle {
    MONTHLY
    YEARLY
    CUSTOM
  }

  enum ProrationPolicy {
    CREATE_PRORATIONS
    NONE
    ALWAYS_INVOICE
  }

  enum SupportLevel {
    COMMUNITY
    EMAIL
    PRIORITY
    PHONE
    DEDICATED
    WHITE_GLOVE
  }

  enum DiscountDuration {
    ONCE
    REPEATING
    FOREVER
  }

  enum PaymentStatus {
    PENDING
    PROCESSING
    SUCCEEDED
    FAILED
    CANCELED
    REQUIRES_ACTION
  }

  enum RefundStatus {
    PENDING
    APPROVED
    PROCESSED
    DENIED
    CANCELED
  }

  enum TrendDirection {
    UP
    DOWN
    STABLE
  }

  enum RecommendationType {
    UPGRADE
    OPTIMIZE
    WARNING
    SUGGESTION
  }

  enum EnterpriseCategory {
    INTEGRATION
    SECURITY
    COMPLIANCE
    ANALYTICS
    CUSTOMIZATION
    SUPPORT
  }

  enum EnterprisePricingType {
    FIXED
    PER_USER
    PER_REQUEST
    CUSTOM
  }

  enum EnterpriseSupportLevel {
    STANDARD
    PRIORITY
    DEDICATED
    WHITE_GLOVE
    CUSTOM
  }

  enum ComplianceType {
    SOC2
    HIPAA
    GDPR
    PCI_DSS
    ISO_27001
    CCPA
    CUSTOM
  }

  enum QuoteStatus {
    DRAFT
    SENT
    REVIEWED
    APPROVED
    REJECTED
    EXPIRED
  }

  enum CancelationReason {
    TOO_EXPENSIVE
    MISSING_FEATURES
    TOO_COMPLEX
    POOR_SUPPORT
    SWITCHING_PROVIDERS
    NO_LONGER_NEEDED
    OTHER
  }

  enum BillingCycleAnchor {
    UNCHANGED
    NOW
    PHASE
  }

  enum UsageAlertType {
    APPROACHING_LIMIT
    LIMIT_EXCEEDED
    UNUSUAL_ACTIVITY
    BILLING_WARNING
  }

  enum RevenueMetricsPeriod {
    DAILY
    WEEKLY
    MONTHLY
    QUARTERLY
    YEARLY
  }

  enum UsagePeriod {
    CURRENT
    PREVIOUS
    YEARLY
    CUSTOM
  }
`;

module.exports = subscriptionTypeDefs;