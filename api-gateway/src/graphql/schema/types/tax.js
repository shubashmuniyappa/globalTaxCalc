/**
 * Tax GraphQL Type Definitions
 * Comprehensive tax calculation and management types
 */

const { gql } = require('graphql-tag');

const taxTypeDefs = gql`
  extend type Query {
    # Tax Calculations
    calculateTax(input: TaxCalculationInput!): TaxCalculationResult! @rateLimit(max: 100, window: "1h")
    calculatePayrollTax(input: PayrollTaxInput!): PayrollTaxResult! @rateLimit(max: 100, window: "1h")
    calculatePropertyTax(input: PropertyTaxInput!): PropertyTaxResult! @rateLimit(max: 50, window: "1h")
    estimateQuarterlyTax(input: QuarterlyTaxInput!): QuarterlyTaxResult! @rateLimit(max: 50, window: "1h")

    # Tax Brackets and Rates
    getTaxBrackets(country: Country!, year: Int!, type: TaxType = INCOME): [TaxBracket!]!
    getTaxRates(country: Country!, year: Int!): TaxRates!
    getDeductions(country: Country!, year: Int!, filingStatus: FilingStatus): [Deduction!]!
    getCredits(country: Country!, year: Int!): [TaxCredit!]!

    # Tax Forms and Documents
    getTaxForms(country: Country!, year: Int!): [TaxForm!]!
    getTaxForm(id: ID!): TaxForm
    generateTaxReport(input: TaxReportInput!): TaxReport! @auth(role: USER)

    # Tax Scenarios and Comparisons
    compareTaxScenarios(input: TaxComparisonInput!): TaxComparison!
    optimizeTax(input: TaxOptimizationInput!): TaxOptimizationResult! @auth(role: PREMIUM)

    # Tax History and Records
    getTaxCalculations(
      filters: [FilterInput!]
      sort: [SortInput!]
      pagination: PaginationInput
    ): TaxCalculationConnection! @auth(role: USER)

    getTaxCalculation(id: ID!): TaxCalculation @auth(role: USER)

    # Saved Calculations
    getSavedCalculations(
      pagination: PaginationInput
    ): SavedCalculationConnection! @auth(role: USER)
  }

  extend type Mutation {
    # Save and manage calculations
    saveCalculation(input: SaveCalculationInput!): SavedCalculation! @auth(role: USER)
    updateSavedCalculation(id: ID!, input: UpdateCalculationInput!): SavedCalculation! @auth(role: USER)
    deleteSavedCalculation(id: ID!): OperationResponse! @auth(role: USER)

    # Tax planning
    createTaxPlan(input: TaxPlanInput!): TaxPlan! @auth(role: PREMIUM)
    updateTaxPlan(id: ID!, input: UpdateTaxPlanInput!): TaxPlan! @auth(role: PREMIUM)
    deleteTaxPlan(id: ID!): OperationResponse! @auth(role: PREMIUM)

    # Tax reminders
    setTaxReminder(input: TaxReminderInput!): TaxReminder! @auth(role: USER)
    updateTaxReminder(id: ID!, input: UpdateTaxReminderInput!): TaxReminder! @auth(role: USER)
    deleteTaxReminder(id: ID!): OperationResponse! @auth(role: USER)
  }

  extend type Subscription {
    # Real-time tax updates
    taxRatesUpdated(country: Country!): TaxRatesUpdate!
    taxCalculationCompleted(userId: ID!): TaxCalculationResult! @auth(role: USER)
    taxDeadlineReminder(userId: ID!): TaxReminder! @auth(role: USER)
  }

  # Tax Calculation Types
  type TaxCalculationResult {
    id: ID!
    grossIncome: Currency!
    taxableIncome: Currency!
    totalTax: Currency!
    netIncome: Currency!
    effectiveRate: Percentage!
    marginalRate: Percentage!
    breakdown: TaxBreakdown!
    deductions: [AppliedDeduction!]!
    credits: [AppliedCredit!]!
    payments: TaxPayments!
    refund: Currency
    owed: Currency
    metadata: TaxMetadata!
    calculatedAt: DateTime!
    expiresAt: DateTime!
  }

  type TaxBreakdown {
    federal: TaxComponent
    state: TaxComponent
    local: TaxComponent
    socialSecurity: TaxComponent
    medicare: TaxComponent
    unemployment: TaxComponent
    disability: TaxComponent
    other: [TaxComponent!]
  }

  type TaxComponent {
    name: String!
    rate: Percentage!
    taxableIncome: Currency!
    amount: Currency!
    description: String
  }

  type AppliedDeduction {
    id: ID!
    name: String!
    type: DeductionType!
    amount: Currency!
    description: String
    category: String
    eligibility: DeductionEligibility!
  }

  type AppliedCredit {
    id: ID!
    name: String!
    type: CreditType!
    amount: Currency!
    description: String
    refundable: Boolean!
    eligibility: CreditEligibility!
  }

  type TaxPayments {
    withholding: Currency!
    estimated: Currency!
    previous: Currency!
    total: Currency!
  }

  type TaxMetadata {
    country: Country!
    year: Int!
    filingStatus: FilingStatus!
    currency: CurrencyCode!
    calculationMethod: String!
    version: String!
    accuracy: Percentage!
    assumptions: [String!]!
  }

  # Input Types
  input TaxCalculationInput {
    # Basic Information
    income: IncomeInput!
    country: Country!
    year: Int!
    filingStatus: FilingStatus!

    # Personal Information
    age: Int
    dependents: [DependentInput!]
    disabilities: [DisabilityInput!]

    # Deductions and Credits
    deductions: [DeductionInput!]
    credits: [CreditInput!]

    # Other Income and Payments
    otherIncome: [OtherIncomeInput!]
    payments: PaymentInput

    # Options
    options: CalculationOptions
  }

  input IncomeInput {
    wages: Currency!
    salaries: Currency
    tips: Currency
    businessIncome: Currency
    capitalGains: Currency
    dividends: Currency
    interest: Currency
    rental: Currency
    retirement: Currency
    unemployment: Currency
    socialSecurity: Currency
    other: Currency
  }

  input DependentInput {
    name: String!
    relationship: RelationshipType!
    age: Int!
    income: Currency
    disabled: Boolean
    student: Boolean
  }

  input DisabilityInput {
    type: DisabilityType!
    severity: DisabilitySeverity!
    qualified: Boolean!
  }

  input DeductionInput {
    type: DeductionType!
    amount: Currency!
    description: String
    category: String
    documentation: [String!]
  }

  input CreditInput {
    type: CreditType!
    amount: Currency
    eligibilityData: JSON
  }

  input OtherIncomeInput {
    type: IncomeType!
    amount: Currency!
    source: String!
    taxable: Boolean!
  }

  input PaymentInput {
    withholding: Currency
    estimated: [EstimatedPaymentInput!]
    previousYear: Currency
  }

  input EstimatedPaymentInput {
    quarter: Quarter!
    amount: Currency!
    date: Date!
  }

  input CalculationOptions {
    optimizeDeductions: Boolean = true
    includeAlternativeMinimumTax: Boolean = true
    projectFutureYears: Int
    considerStateOptimization: Boolean = true
    includeRetirementPlanning: Boolean = false
  }

  # Payroll Tax Types
  type PayrollTaxResult {
    id: ID!
    grossPay: Currency!
    netPay: Currency!
    totalTax: Currency!
    breakdown: PayrollBreakdown!
    payPeriod: PayPeriod!
    annualProjection: AnnualProjection!
    calculatedAt: DateTime!
  }

  type PayrollBreakdown {
    federalIncome: Currency!
    stateIncome: Currency
    localIncome: Currency
    socialSecurity: PayrollTaxComponent!
    medicare: PayrollTaxComponent!
    stateDisability: Currency
    stateUnemployment: Currency
    other: [PayrollTaxComponent!]
  }

  type PayrollTaxComponent {
    employee: Currency!
    employer: Currency!
    rate: Percentage!
    cap: Currency
  }

  type AnnualProjection {
    grossIncome: Currency!
    totalTax: Currency!
    netIncome: Currency!
    effectiveRate: Percentage!
  }

  input PayrollTaxInput {
    grossPay: Currency!
    payPeriod: PayPeriod!
    country: Country!
    state: String
    filingStatus: FilingStatus!
    allowances: Int
    additionalWithholding: Currency
    exemptFromFederal: Boolean = false
    exemptFromState: Boolean = false
    year: Int!
  }

  # Property Tax Types
  type PropertyTaxResult {
    id: ID!
    assessedValue: Currency!
    taxableValue: Currency!
    annualTax: Currency!
    monthlyTax: Currency!
    effectiveRate: Percentage!
    breakdown: PropertyTaxBreakdown!
    calculatedAt: DateTime!
  }

  type PropertyTaxBreakdown {
    county: Currency!
    city: Currency
    school: Currency!
    special: [SpecialAssessment!]
    exemptions: [PropertyExemption!]
  }

  type SpecialAssessment {
    name: String!
    amount: Currency!
    rate: Percentage!
    purpose: String!
  }

  type PropertyExemption {
    name: String!
    amount: Currency!
    type: ExemptionType!
    description: String!
  }

  input PropertyTaxInput {
    assessedValue: Currency!
    propertyType: PropertyType!
    country: Country!
    state: String!
    county: String!
    city: String
    homestead: Boolean = false
    seniorExemption: Boolean = false
    veteranExemption: Boolean = false
    disabilityExemption: Boolean = false
    year: Int!
  }

  # Tax Brackets and Rates
  type TaxBracket {
    id: ID!
    minIncome: Currency!
    maxIncome: Currency
    rate: Percentage!
    filingStatus: FilingStatus!
    type: TaxType!
    description: String
  }

  type TaxRates {
    country: Country!
    year: Int!
    currency: CurrencyCode!
    income: [TaxBracket!]!
    capital: [TaxBracket!]!
    corporate: [TaxBracket!]!
    payroll: PayrollRates!
    property: PropertyRates!
    sales: SalesRates!
    updatedAt: DateTime!
  }

  type PayrollRates {
    socialSecurity: PayrollRate!
    medicare: PayrollRate!
    unemployment: PayrollRate!
    disability: PayrollRate
  }

  type PayrollRate {
    rate: Percentage!
    cap: Currency
    employeeRate: Percentage!
    employerRate: Percentage!
  }

  type PropertyRates {
    residential: Percentage!
    commercial: Percentage!
    industrial: Percentage!
    agricultural: Percentage
  }

  type SalesRates {
    state: Percentage
    local: Percentage
    combined: Percentage!
  }

  # Deductions and Credits
  type Deduction {
    id: ID!
    name: String!
    type: DeductionType!
    amount: Currency
    percentage: Percentage
    cap: Currency
    description: String!
    eligibility: DeductionEligibility!
    category: String!
    phase: DeductionPhase!
  }

  type DeductionEligibility {
    incomeLimit: Currency
    ageRequirement: Int
    filingStatusRestrictions: [FilingStatus!]
    dependentRequirement: Boolean
    documentation: [String!]!
  }

  type DeductionPhase {
    startIncome: Currency
    endIncome: Currency
    phaseOutRate: Percentage
  }

  type TaxCredit {
    id: ID!
    name: String!
    type: CreditType!
    amount: Currency
    percentage: Percentage
    cap: Currency
    refundable: Boolean!
    description: String!
    eligibility: CreditEligibility!
    phaseOut: CreditPhaseOut
  }

  type CreditEligibility {
    incomeRange: IncomeRange
    ageRequirement: Int
    dependentRequirement: Boolean
    filingStatusRestrictions: [FilingStatus!]
    workRequirement: Boolean
    residencyRequirement: Boolean
  }

  type IncomeRange {
    min: Currency
    max: Currency
  }

  type CreditPhaseOut {
    startIncome: Currency!
    endIncome: Currency!
    phaseOutRate: Percentage!
  }

  # Tax Forms
  type TaxForm {
    id: ID!
    name: String!
    title: String!
    description: String!
    type: FormType!
    country: Country!
    year: Int!
    url: String!
    instructions: String
    schedules: [TaxSchedule!]
    deadline: Date
    extensions: [FormExtension!]
  }

  type TaxSchedule {
    name: String!
    title: String!
    purpose: String!
    required: Boolean!
  }

  type FormExtension {
    type: ExtensionType!
    deadline: Date!
    requirements: [String!]!
  }

  # Tax Planning and Optimization
  type TaxOptimizationResult {
    id: ID!
    currentScenario: TaxCalculationResult!
    optimizedScenario: TaxCalculationResult!
    savings: Currency!
    recommendations: [TaxRecommendation!]!
    strategies: [TaxStrategy!]!
    timeline: OptimizationTimeline!
    confidence: Percentage!
  }

  type TaxRecommendation {
    id: ID!
    title: String!
    description: String!
    impact: Currency!
    effort: EffortLevel!
    timeline: String!
    category: RecommendationCategory!
    priority: Priority!
    steps: [String!]!
  }

  type TaxStrategy {
    name: String!
    description: String!
    potentialSavings: Currency!
    requirements: [String!]!
    risks: [String!]!
    timeline: String!
  }

  type OptimizationTimeline {
    immediate: [TaxRecommendation!]!
    shortTerm: [TaxRecommendation!]!
    longTerm: [TaxRecommendation!]!
  }

  input TaxOptimizationInput {
    currentCalculation: ID!
    goals: [OptimizationGoal!]!
    constraints: OptimizationConstraints
    timeHorizon: TimeHorizon!
  }

  input OptimizationConstraints {
    maxRisk: RiskLevel!
    budgetLimit: Currency
    timeCommitment: TimeCommitment!
  }

  # Saved Calculations
  type SavedCalculation {
    id: ID!
    name: String!
    description: String
    calculation: TaxCalculationResult!
    tags: [String!]!
    shared: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
    accessedAt: DateTime
  }

  type SavedCalculationConnection {
    edges: [SavedCalculationEdge!]!
    pageInfo: PageInfo!
  }

  type SavedCalculationEdge {
    node: SavedCalculation!
    cursor: String!
  }

  input SaveCalculationInput {
    name: String!
    description: String
    calculationId: ID!
    tags: [String!]
    shared: Boolean = false
  }

  input UpdateCalculationInput {
    name: String
    description: String
    tags: [String!]
    shared: Boolean
  }

  # Tax Planning
  type TaxPlan {
    id: ID!
    name: String!
    description: String
    year: Int!
    goals: [PlanGoal!]!
    strategies: [PlanStrategy!]!
    milestones: [PlanMilestone!]!
    projections: [YearlyProjection!]!
    status: PlanStatus!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type PlanGoal {
    id: ID!
    title: String!
    description: String!
    target: Currency!
    current: Currency!
    deadline: Date!
    priority: Priority!
  }

  type PlanStrategy {
    id: ID!
    name: String!
    description: String!
    estimatedSavings: Currency!
    implementation: [String!]!
    status: StrategyStatus!
  }

  type PlanMilestone {
    id: ID!
    title: String!
    description: String!
    deadline: Date!
    completed: Boolean!
    completedAt: DateTime
  }

  type YearlyProjection {
    year: Int!
    income: Currency!
    tax: Currency!
    savings: Currency!
    confidence: Percentage!
  }

  # Tax Reminders
  type TaxReminder {
    id: ID!
    title: String!
    description: String!
    type: ReminderType!
    date: Date!
    recurring: Boolean!
    frequency: ReminderFrequency
    status: ReminderStatus!
    metadata: JSON
    createdAt: DateTime!
  }

  input TaxReminderInput {
    title: String!
    description: String
    type: ReminderType!
    date: Date!
    recurring: Boolean = false
    frequency: ReminderFrequency
  }

  # Enums
  enum TaxType {
    INCOME
    CAPITAL_GAINS
    CORPORATE
    PAYROLL
    PROPERTY
    SALES
    EXCISE
    ESTATE
    GIFT
    OTHER
  }

  enum FilingStatus {
    SINGLE
    MARRIED_JOINT
    MARRIED_SEPARATE
    HEAD_OF_HOUSEHOLD
    QUALIFYING_WIDOW
  }

  enum PayPeriod {
    WEEKLY
    BIWEEKLY
    SEMIMONTHLY
    MONTHLY
    QUARTERLY
    ANNUALLY
  }

  enum PropertyType {
    RESIDENTIAL
    COMMERCIAL
    INDUSTRIAL
    AGRICULTURAL
    VACANT
    OTHER
  }

  enum DeductionType {
    STANDARD
    ITEMIZED
    BUSINESS_EXPENSE
    CHARITABLE
    MEDICAL
    STATE_LOCAL_TAX
    MORTGAGE_INTEREST
    STUDENT_LOAN_INTEREST
    RETIREMENT_CONTRIBUTION
    HSA_CONTRIBUTION
    OTHER
  }

  enum CreditType {
    CHILD_TAX_CREDIT
    EARNED_INCOME_CREDIT
    EDUCATION_CREDIT
    DEPENDENT_CARE_CREDIT
    ADOPTION_CREDIT
    ENERGY_CREDIT
    FOREIGN_TAX_CREDIT
    OTHER
  }

  enum IncomeType {
    WAGES
    BUSINESS
    INVESTMENT
    CAPITAL_GAINS
    RENTAL
    RETIREMENT
    UNEMPLOYMENT
    SOCIAL_SECURITY
    OTHER
  }

  enum RelationshipType {
    CHILD
    SPOUSE
    PARENT
    SIBLING
    GRANDPARENT
    GRANDCHILD
    UNCLE_AUNT
    NEPHEW_NIECE
    COUSIN
    OTHER
  }

  enum DisabilityType {
    VISUAL
    HEARING
    MOBILITY
    COGNITIVE
    MENTAL_HEALTH
    CHRONIC_ILLNESS
    OTHER
  }

  enum DisabilitySeverity {
    MILD
    MODERATE
    SEVERE
    PROFOUND
  }

  enum Quarter {
    Q1
    Q2
    Q3
    Q4
  }

  enum ExemptionType {
    HOMESTEAD
    SENIOR
    VETERAN
    DISABILITY
    AGRICULTURAL
    HISTORIC
    OTHER
  }

  enum FormType {
    RETURN
    SCHEDULE
    WORKSHEET
    INSTRUCTION
    PUBLICATION
    OTHER
  }

  enum ExtensionType {
    AUTOMATIC
    REQUESTED
    DISASTER_RELIEF
  }

  enum EffortLevel {
    LOW
    MEDIUM
    HIGH
    EXPERT
  }

  enum RecommendationCategory {
    DEDUCTIONS
    CREDITS
    TIMING
    INCOME_PLANNING
    RETIREMENT
    INVESTMENT
    BUSINESS
    ESTATE
    OTHER
  }

  enum OptimizationGoal {
    MINIMIZE_TAX
    MAXIMIZE_REFUND
    OPTIMIZE_CASH_FLOW
    LONG_TERM_PLANNING
    RETIREMENT_PLANNING
    EDUCATION_PLANNING
    ESTATE_PLANNING
  }

  enum TimeHorizon {
    CURRENT_YEAR
    NEXT_YEAR
    TWO_TO_FIVE_YEARS
    FIVE_PLUS_YEARS
  }

  enum RiskLevel {
    CONSERVATIVE
    MODERATE
    AGGRESSIVE
  }

  enum TimeCommitment {
    MINIMAL
    MODERATE
    SUBSTANTIAL
  }

  enum PlanStatus {
    DRAFT
    ACTIVE
    COMPLETED
    ARCHIVED
  }

  enum StrategyStatus {
    PLANNED
    IN_PROGRESS
    COMPLETED
    DEFERRED
    CANCELLED
  }

  enum ReminderType {
    DEADLINE
    QUARTERLY_PAYMENT
    DOCUMENT_COLLECTION
    TAX_PLANNING
    REVIEW
    OTHER
  }

  enum ReminderFrequency {
    WEEKLY
    MONTHLY
    QUARTERLY
    ANNUALLY
  }

  enum ReminderStatus {
    ACTIVE
    COMPLETED
    SNOOZED
    CANCELLED
  }

  # Connections
  type TaxCalculationConnection {
    edges: [TaxCalculationEdge!]!
    pageInfo: PageInfo!
  }

  type TaxCalculationEdge {
    node: TaxCalculation!
    cursor: String!
  }

  type TaxCalculation {
    id: ID!
    result: TaxCalculationResult!
    input: JSON!
    userId: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  # Subscriptions
  type TaxRatesUpdate {
    country: Country!
    year: Int!
    rates: TaxRates!
    changes: [RateChange!]!
    effectiveDate: Date!
  }

  type RateChange {
    type: String!
    oldValue: Float!
    newValue: Float!
    description: String!
  }

  # Reports
  type TaxReport {
    id: ID!
    type: ReportType!
    format: ReportFormat!
    content: String!
    downloadUrl: String!
    generatedAt: DateTime!
    expiresAt: DateTime!
  }

  input TaxReportInput {
    type: ReportType!
    format: ReportFormat!
    calculationId: ID!
    options: ReportOptions
  }

  input ReportOptions {
    includeCharts: Boolean = true
    includeComparisons: Boolean = false
    includeRecommendations: Boolean = true
    template: String
  }

  enum ReportType {
    SUMMARY
    DETAILED
    COMPARISON
    OPTIMIZATION
    PROJECTION
  }

  enum ReportFormat {
    PDF
    HTML
    EXCEL
    CSV
    JSON
  }

  # Comparisons
  type TaxComparison {
    id: ID!
    scenarios: [ComparisonScenario!]!
    summary: ComparisonSummary!
    recommendations: [String!]!
    generatedAt: DateTime!
  }

  type ComparisonScenario {
    name: String!
    description: String
    calculation: TaxCalculationResult!
    differences: [TaxDifference!]!
  }

  type ComparisonSummary {
    bestScenario: String!
    maxSavings: Currency!
    keyDifferences: [String!]!
  }

  type TaxDifference {
    field: String!
    scenarios: [ScenarioValue!]!
  }

  type ScenarioValue {
    scenario: String!
    value: String!
  }

  input TaxComparisonInput {
    scenarios: [ComparisonScenarioInput!]!
    baseScenario: String
  }

  input ComparisonScenarioInput {
    name: String!
    description: String
    calculation: TaxCalculationInput!
  }

  input QuarterlyTaxInput {
    annualIncome: Currency!
    country: Country!
    year: Int!
    filingStatus: FilingStatus!
    priorYearTax: Currency
    withholding: Currency
    estimatedPayments: Currency
  }

  type QuarterlyTaxResult {
    id: ID!
    quarter: Quarter!
    estimatedTax: Currency!
    requiredPayment: Currency!
    recommendation: Currency!
    penalty: Currency
    safeHarbor: Boolean!
    dueDate: Date!
    calculatedAt: DateTime!
  }
`;

module.exports = taxTypeDefs;