/**
 * User GraphQL Type Definitions
 * User management, authentication, and profile types
 */

const { gql } = require('graphql-tag');

const userTypeDefs = gql`
  extend type Query {
    # Current User
    me: User @auth(role: USER)

    # User Profile
    getUserProfile(id: ID!): UserProfile @auth(role: USER)

    # User Settings
    getUserSettings: UserSettings @auth(role: USER)
    getUserPreferences: UserPreferences @auth(role: USER)

    # User Activity
    getUserActivity(
      filters: [FilterInput!]
      pagination: PaginationInput
    ): UserActivityConnection @auth(role: USER)

    # User Sessions
    getUserSessions: [UserSession!]! @auth(role: USER)
    getActiveDevices: [UserDevice!]! @auth(role: USER)

    # User API Keys
    getUserAPIKeys: [APIKey!]! @auth(role: USER)

    # User Notifications
    getUserNotifications(
      filters: [FilterInput!]
      pagination: PaginationInput
    ): NotificationConnection @auth(role: USER)

    # User Billing
    getUserBilling: UserBilling @auth(role: USER)
    getUserInvoices(
      pagination: PaginationInput
    ): InvoiceConnection @auth(role: USER)

    # Admin Queries
    getUsers(
      filters: [FilterInput!]
      sort: [SortInput!]
      pagination: PaginationInput
    ): UserConnection @auth(role: ADMIN)

    getUser(id: ID!): User @auth(role: ADMIN)
    getUserStats: UserStats @auth(role: ADMIN)
  }

  extend type Mutation {
    # Authentication
    login(input: LoginInput!): AuthResponse!
    logout: OperationResponse! @auth(role: USER)
    logoutAllDevices: OperationResponse! @auth(role: USER)
    refreshToken(token: String!): TokenResponse!

    # Registration
    register(input: RegisterInput!): AuthResponse!
    verifyEmail(token: String!): OperationResponse!
    resendVerification: OperationResponse! @auth(role: USER)

    # Password Management
    forgotPassword(email: String!): OperationResponse!
    resetPassword(input: ResetPasswordInput!): OperationResponse!
    changePassword(input: ChangePasswordInput!): OperationResponse! @auth(role: USER)

    # Profile Management
    updateProfile(input: UpdateProfileInput!): User! @auth(role: USER)
    updateAvatar(file: Upload!): User! @auth(role: USER)
    deleteAvatar: OperationResponse! @auth(role: USER)

    # Settings and Preferences
    updateSettings(input: UpdateSettingsInput!): UserSettings! @auth(role: USER)
    updatePreferences(input: UpdatePreferencesInput!): UserPreferences! @auth(role: USER)

    # Two-Factor Authentication
    enableTwoFactor: TwoFactorSetup! @auth(role: USER)
    confirmTwoFactor(input: ConfirmTwoFactorInput!): OperationResponse! @auth(role: USER)
    disableTwoFactor(input: DisableTwoFactorInput!): OperationResponse! @auth(role: USER)
    generateBackupCodes: [String!]! @auth(role: USER)

    # API Key Management
    createAPIKey(input: CreateAPIKeyInput!): APIKey! @auth(role: USER)
    updateAPIKey(id: ID!, input: UpdateAPIKeyInput!): APIKey! @auth(role: USER)
    revokeAPIKey(id: ID!): OperationResponse! @auth(role: USER)
    regenerateAPIKey(id: ID!): APIKey! @auth(role: USER)

    # Session Management
    terminateSession(id: ID!): OperationResponse! @auth(role: USER)
    terminateAllSessions: OperationResponse! @auth(role: USER)

    # Notification Management
    markNotificationRead(id: ID!): Notification! @auth(role: USER)
    markAllNotificationsRead: OperationResponse! @auth(role: USER)
    deleteNotification(id: ID!): OperationResponse! @auth(role: USER)
    updateNotificationSettings(input: NotificationSettingsInput!): NotificationSettings! @auth(role: USER)

    # Privacy and Data
    downloadUserData: DataExport! @auth(role: USER)
    deleteUserAccount(input: DeleteAccountInput!): OperationResponse! @auth(role: USER)

    # Admin Mutations
    suspendUser(id: ID!, reason: String!): User! @auth(role: ADMIN)
    unsuspendUser(id: ID!): User! @auth(role: ADMIN)
    deleteUser(id: ID!): OperationResponse! @auth(role: ADMIN)
    updateUserRole(id: ID!, role: UserRole!): User! @auth(role: ADMIN)
    impersonateUser(id: ID!): AuthResponse! @auth(role: ADMIN)
  }

  extend type Subscription {
    # User subscriptions
    userNotifications(userId: ID!): Notification! @auth(role: USER)
    userSessionUpdate(userId: ID!): UserSession! @auth(role: USER)
    userActivityUpdate(userId: ID!): UserActivity! @auth(role: USER)

    # Admin subscriptions
    userRegistered: User! @auth(role: ADMIN)
    userSuspended: User! @auth(role: ADMIN)
    userDeleted: UserDeletionEvent! @auth(role: ADMIN)
  }

  # Core User Types
  type User {
    id: ID!
    email: String!
    username: String
    firstName: String
    lastName: String
    displayName: String!
    avatar: UserAvatar
    profile: UserProfile!
    settings: UserSettings!
    preferences: UserPreferences!
    role: UserRole!
    status: UserStatus!
    emailVerified: Boolean!
    twoFactorEnabled: Boolean!
    lastLoginAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!

    # Computed fields
    fullName: String!
    initials: String!
    isOnline: Boolean!

    # Related data
    subscription: UserSubscription
    billing: UserBilling
    apiUsage: APIUsage
    activitySummary: UserActivitySummary
  }

  type UserProfile {
    id: ID!
    bio: String
    title: String
    company: String
    website: String
    location: String
    timezone: String
    language: Language!
    country: Country
    phoneNumber: String
    dateOfBirth: Date
    address: Address
    socialLinks: [SocialMediaLink!]
    customFields: JSON
    privacy: ProfilePrivacy!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type UserAvatar {
    id: ID!
    url: String!
    thumbnailUrl: String!
    originalFilename: String!
    size: Int!
    mimeType: String!
    uploadedAt: DateTime!
  }

  type ProfilePrivacy {
    showEmail: Boolean!
    showPhone: Boolean!
    showLocation: Boolean!
    showBirthdate: Boolean!
    showActivity: Boolean!
    searchable: Boolean!
  }

  type UserSettings {
    id: ID!
    theme: ThemePreference!
    language: Language!
    timezone: String!
    dateFormat: String!
    timeFormat: String!
    currency: CurrencyCode!
    notifications: NotificationSettings!
    privacy: PrivacySettings!
    security: SecuritySettings!
    accessibility: AccessibilitySettings!
    developer: DeveloperSettings!
    updatedAt: DateTime!
  }

  type UserPreferences {
    id: ID!
    dashboard: DashboardPreferences!
    calculator: CalculatorPreferences!
    reports: ReportPreferences!
    communication: CommunicationPreferences!
    updatedAt: DateTime!
  }

  type NotificationSettings {
    email: EmailNotificationSettings!
    push: PushNotificationSettings!
    sms: SMSNotificationSettings!
    inApp: InAppNotificationSettings!
    digest: DigestSettings!
  }

  type EmailNotificationSettings {
    enabled: Boolean!
    marketing: Boolean!
    security: Boolean!
    billing: Boolean!
    product: Boolean!
    reminders: Boolean!
    frequency: NotificationFrequency!
  }

  type PushNotificationSettings {
    enabled: Boolean!
    security: Boolean!
    reminders: Boolean!
    updates: Boolean!
  }

  type SMSNotificationSettings {
    enabled: Boolean!
    security: Boolean!
    emergencyOnly: Boolean!
  }

  type InAppNotificationSettings {
    enabled: Boolean!
    sound: Boolean!
    desktop: Boolean!
  }

  type DigestSettings {
    enabled: Boolean!
    frequency: DigestFrequency!
    time: String!
    timezone: String!
  }

  type PrivacySettings {
    profileVisibility: ProfileVisibility!
    activityVisibility: ActivityVisibility!
    dataCollection: DataCollectionSettings!
    sharing: DataSharingSettings!
  }

  type DataCollectionSettings {
    analytics: Boolean!
    marketing: Boolean!
    personalization: Boolean!
    research: Boolean!
  }

  type DataSharingSettings {
    thirdParty: Boolean!
    partners: Boolean!
    advertising: Boolean!
  }

  type SecuritySettings {
    twoFactorAuth: TwoFactorSettings!
    sessionTimeout: Int!
    loginNotifications: Boolean!
    suspiciousActivityAlerts: Boolean!
    passwordlessLogin: Boolean!
    trustedDevices: [TrustedDevice!]!
  }

  type TwoFactorSettings {
    enabled: Boolean!
    method: TwoFactorMethod
    backupCodes: Int!
    lastUsed: DateTime
  }

  type TrustedDevice {
    id: ID!
    name: String!
    deviceType: DeviceType!
    addedAt: DateTime!
    lastUsed: DateTime
  }

  type AccessibilitySettings {
    highContrast: Boolean!
    largeText: Boolean!
    reduceMotion: Boolean!
    screenReader: Boolean!
    keyboardNavigation: Boolean!
  }

  type DeveloperSettings {
    apiAccess: Boolean!
    webhooks: Boolean!
    advancedFeatures: Boolean!
    betaFeatures: Boolean!
  }

  type DashboardPreferences {
    layout: DashboardLayout!
    widgets: [DashboardWidget!]!
    defaultView: DashboardView!
    autoRefresh: Boolean!
    refreshInterval: Int!
  }

  type DashboardWidget {
    id: ID!
    type: WidgetType!
    position: WidgetPosition!
    size: WidgetSize!
    config: JSON!
    visible: Boolean!
  }

  type WidgetPosition {
    x: Int!
    y: Int!
  }

  type WidgetSize {
    width: Int!
    height: Int!
  }

  type CalculatorPreferences {
    defaultCountry: Country!
    defaultCurrency: CurrencyCode!
    autoSave: Boolean!
    showAdvanced: Boolean!
    rememberInputs: Boolean!
    displayPrecision: Int!
  }

  type ReportPreferences {
    defaultFormat: ReportFormat!
    includeCharts: Boolean!
    includeDetails: Boolean!
    autoDownload: Boolean!
    emailReports: Boolean!
  }

  type CommunicationPreferences {
    preferredChannel: CommunicationChannel!
    marketingOptIn: Boolean!
    surveyParticipation: Boolean!
    communityUpdates: Boolean!
  }

  # Authentication
  type AuthResponse {
    success: Boolean!
    message: String
    user: User
    tokens: TokenPair
    expiresAt: DateTime
    twoFactorRequired: Boolean
    errors: [ValidationError!]
  }

  type TokenResponse {
    success: Boolean!
    tokens: TokenPair
    expiresAt: DateTime
    errors: [Error!]
  }

  type TokenPair {
    accessToken: String!
    refreshToken: String!
    tokenType: String!
  }

  # User Activity
  type UserActivity {
    id: ID!
    type: ActivityType!
    description: String!
    metadata: JSON
    ipAddress: String
    userAgent: String
    location: ActivityLocation
    timestamp: DateTime!
  }

  type ActivityLocation {
    country: String
    region: String
    city: String
    coordinates: Coordinates
  }

  type Coordinates {
    latitude: Float!
    longitude: Float!
  }

  type UserActivitySummary {
    totalActivities: Int!
    lastActive: DateTime
    mostActiveHour: Int
    mostActiveDay: String
    topActivities: [ActivityCount!]!
    devicesUsed: Int!
    countriesAccessed: Int!
  }

  type ActivityCount {
    type: ActivityType!
    count: Int!
  }

  type UserActivityConnection {
    edges: [UserActivityEdge!]!
    pageInfo: PageInfo!
  }

  type UserActivityEdge {
    node: UserActivity!
    cursor: String!
  }

  # User Sessions
  type UserSession {
    id: ID!
    device: UserDevice!
    ipAddress: String!
    location: ActivityLocation
    isActive: Boolean!
    isCurrent: Boolean!
    createdAt: DateTime!
    lastActiveAt: DateTime!
    expiresAt: DateTime!
  }

  type UserDevice {
    id: ID!
    name: String!
    type: DeviceType!
    os: String
    browser: String
    isTrusted: Boolean!
    firstSeen: DateTime!
    lastSeen: DateTime!
  }

  # Two-Factor Authentication
  type TwoFactorSetup {
    secret: String!
    qrCode: String!
    backupCodes: [String!]!
    manualEntryKey: String!
  }

  # API Usage
  type APIUsage {
    current: UsagePeriod!
    previous: UsagePeriod!
    limit: UsageLimit!
    overages: [Overage!]!
  }

  type UsagePeriod {
    period: String!
    requests: Int!
    graphqlQueries: Int!
    restCalls: Int!
    dataTransfer: Int!
    errors: Int!
    startDate: Date!
    endDate: Date!
  }

  type UsageLimit {
    requests: Int!
    dataTransfer: Int!
    resetDate: Date!
    upgradeRequired: Boolean!
  }

  type Overage {
    type: OverageType!
    amount: Int!
    cost: Currency!
    date: Date!
  }

  # User Billing
  type UserBilling {
    id: ID!
    customer: BillingCustomer!
    subscription: BillingSubscription
    paymentMethods: [PaymentMethod!]!
    invoices: [Invoice!]!
    credits: Currency!
    nextBillingDate: Date
    billingHistory: [BillingTransaction!]!
  }

  type BillingCustomer {
    id: ID!
    name: String!
    email: String!
    address: Address
    taxIds: [TaxId!]!
  }

  type BillingSubscription {
    id: ID!
    plan: SubscriptionPlan!
    status: SubscriptionStatus!
    currentPeriodStart: Date!
    currentPeriodEnd: Date!
    cancelAtPeriodEnd: Boolean!
    canceledAt: Date
    trialEnd: Date
    discount: Discount
  }

  type PaymentMethod {
    id: ID!
    type: PaymentMethodType!
    brand: String
    last4: String
    expiryMonth: Int
    expiryYear: Int
    isDefault: Boolean!
    createdAt: DateTime!
  }

  type Invoice {
    id: ID!
    number: String!
    status: InvoiceStatus!
    amount: Currency!
    currency: CurrencyCode!
    description: String
    paidAt: DateTime
    dueAt: Date!
    createdAt: DateTime!
    downloadUrl: String
    lineItems: [InvoiceLineItem!]!
  }

  type InvoiceLineItem {
    id: ID!
    description: String!
    quantity: Int!
    unitPrice: Currency!
    amount: Currency!
    period: InvoicePeriod
  }

  type InvoicePeriod {
    start: Date!
    end: Date!
  }

  type TaxId {
    type: TaxIdType!
    value: String!
    country: Country!
  }

  type Discount {
    id: ID!
    coupon: Coupon!
    percentOff: Int
    amountOff: Currency
    start: Date!
    end: Date
  }

  type Coupon {
    id: ID!
    name: String!
    code: String!
    type: CouponType!
    value: Int!
    currency: CurrencyCode
  }

  type BillingTransaction {
    id: ID!
    type: TransactionType!
    amount: Currency!
    currency: CurrencyCode!
    description: String!
    status: TransactionStatus!
    timestamp: DateTime!
    metadata: JSON
  }

  # Data Export
  type DataExport {
    id: ID!
    type: ExportType!
    status: ExportStatus!
    format: ExportFormat!
    downloadUrl: String
    expiresAt: DateTime!
    requestedAt: DateTime!
    completedAt: DateTime
    size: Int
  }

  # User Statistics (Admin)
  type UserStats {
    total: Int!
    active: Int!
    new: Int!
    suspended: Int!
    deleted: Int!
    byRole: [RoleCount!]!
    byStatus: [StatusCount!]!
    byCountry: [CountryCount!]!
    growth: UserGrowth!
    retention: RetentionMetrics!
  }

  type RoleCount {
    role: UserRole!
    count: Int!
  }

  type StatusCount {
    status: UserStatus!
    count: Int!
  }

  type CountryCount {
    country: Country!
    count: Int!
  }

  type UserGrowth {
    daily: [DailyGrowth!]!
    weekly: [WeeklyGrowth!]!
    monthly: [MonthlyGrowth!]!
  }

  type DailyGrowth {
    date: Date!
    registrations: Int!
    activations: Int!
    deletions: Int!
  }

  type WeeklyGrowth {
    week: String!
    registrations: Int!
    activations: Int!
    deletions: Int!
  }

  type MonthlyGrowth {
    month: String!
    registrations: Int!
    activations: Int!
    deletions: Int!
  }

  type RetentionMetrics {
    day1: Percentage!
    day7: Percentage!
    day30: Percentage!
    day90: Percentage!
  }

  # Events
  type UserDeletionEvent {
    userId: ID!
    email: String!
    deletedAt: DateTime!
    reason: String
    requestedBy: ID!
  }

  # Input Types
  input LoginInput {
    email: String!
    password: String!
    rememberMe: Boolean = false
    twoFactorCode: String
    trustedDevice: Boolean = false
  }

  input RegisterInput {
    email: String!
    password: String!
    firstName: String!
    lastName: String!
    username: String
    agreeToTerms: Boolean!
    subscribeToNewsletter: Boolean = false
    referralCode: String
  }

  input ResetPasswordInput {
    token: String!
    password: String!
  }

  input ChangePasswordInput {
    currentPassword: String!
    newPassword: String!
  }

  input UpdateProfileInput {
    firstName: String
    lastName: String
    username: String
    bio: String
    title: String
    company: String
    website: String
    location: String
    timezone: String
    language: Language
    country: Country
    phoneNumber: String
    dateOfBirth: Date
    address: AddressInput
    socialLinks: [SocialMediaLinkInput!]
    privacy: ProfilePrivacyInput
  }

  input SocialMediaLinkInput {
    platform: SocialPlatform!
    url: String!
    username: String
  }

  input ProfilePrivacyInput {
    showEmail: Boolean
    showPhone: Boolean
    showLocation: Boolean
    showBirthdate: Boolean
    showActivity: Boolean
    searchable: Boolean
  }

  input UpdateSettingsInput {
    theme: ThemePreference
    language: Language
    timezone: String
    dateFormat: String
    timeFormat: String
    currency: CurrencyCode
    notifications: NotificationSettingsInput
    privacy: PrivacySettingsInput
    security: SecuritySettingsInput
    accessibility: AccessibilitySettingsInput
    developer: DeveloperSettingsInput
  }

  input NotificationSettingsInput {
    email: EmailNotificationSettingsInput
    push: PushNotificationSettingsInput
    sms: SMSNotificationSettingsInput
    inApp: InAppNotificationSettingsInput
    digest: DigestSettingsInput
  }

  input EmailNotificationSettingsInput {
    enabled: Boolean
    marketing: Boolean
    security: Boolean
    billing: Boolean
    product: Boolean
    reminders: Boolean
    frequency: NotificationFrequency
  }

  input PushNotificationSettingsInput {
    enabled: Boolean
    security: Boolean
    reminders: Boolean
    updates: Boolean
  }

  input SMSNotificationSettingsInput {
    enabled: Boolean
    security: Boolean
    emergencyOnly: Boolean
  }

  input InAppNotificationSettingsInput {
    enabled: Boolean
    sound: Boolean
    desktop: Boolean
  }

  input DigestSettingsInput {
    enabled: Boolean
    frequency: DigestFrequency
    time: String
    timezone: String
  }

  input PrivacySettingsInput {
    profileVisibility: ProfileVisibility
    activityVisibility: ActivityVisibility
    dataCollection: DataCollectionSettingsInput
    sharing: DataSharingSettingsInput
  }

  input DataCollectionSettingsInput {
    analytics: Boolean
    marketing: Boolean
    personalization: Boolean
    research: Boolean
  }

  input DataSharingSettingsInput {
    thirdParty: Boolean
    partners: Boolean
    advertising: Boolean
  }

  input SecuritySettingsInput {
    sessionTimeout: Int
    loginNotifications: Boolean
    suspiciousActivityAlerts: Boolean
    passwordlessLogin: Boolean
  }

  input AccessibilitySettingsInput {
    highContrast: Boolean
    largeText: Boolean
    reduceMotion: Boolean
    screenReader: Boolean
    keyboardNavigation: Boolean
  }

  input DeveloperSettingsInput {
    apiAccess: Boolean
    webhooks: Boolean
    advancedFeatures: Boolean
    betaFeatures: Boolean
  }

  input UpdatePreferencesInput {
    dashboard: DashboardPreferencesInput
    calculator: CalculatorPreferencesInput
    reports: ReportPreferencesInput
    communication: CommunicationPreferencesInput
  }

  input DashboardPreferencesInput {
    layout: DashboardLayout
    defaultView: DashboardView
    autoRefresh: Boolean
    refreshInterval: Int
  }

  input CalculatorPreferencesInput {
    defaultCountry: Country
    defaultCurrency: CurrencyCode
    autoSave: Boolean
    showAdvanced: Boolean
    rememberInputs: Boolean
    displayPrecision: Int
  }

  input ReportPreferencesInput {
    defaultFormat: ReportFormat
    includeCharts: Boolean
    includeDetails: Boolean
    autoDownload: Boolean
    emailReports: Boolean
  }

  input CommunicationPreferencesInput {
    preferredChannel: CommunicationChannel
    marketingOptIn: Boolean
    surveyParticipation: Boolean
    communityUpdates: Boolean
  }

  input ConfirmTwoFactorInput {
    code: String!
    password: String!
  }

  input DisableTwoFactorInput {
    password: String!
    code: String!
  }

  input CreateAPIKeyInput {
    name: String!
    permissions: [PermissionInput!]!
    rateLimit: RateLimitInput
    expiresAt: DateTime
  }

  input PermissionInput {
    resource: String!
    actions: [String!]!
    conditions: JSON
  }

  input RateLimitInput {
    requests: Int!
    window: String!
  }

  input UpdateAPIKeyInput {
    name: String
    permissions: [PermissionInput!]
    rateLimit: RateLimitInput
    expiresAt: DateTime
    isActive: Boolean
  }

  input DeleteAccountInput {
    password: String!
    reason: String
    feedback: String
  }

  # Connections
  type UserConnection {
    edges: [UserEdge!]!
    pageInfo: PageInfo!
  }

  type UserEdge {
    node: User!
    cursor: String!
  }

  type NotificationConnection {
    edges: [NotificationEdge!]!
    pageInfo: PageInfo!
  }

  type NotificationEdge {
    node: Notification!
    cursor: String!
  }

  type InvoiceConnection {
    edges: [InvoiceEdge!]!
    pageInfo: PageInfo!
  }

  type InvoiceEdge {
    node: Invoice!
    cursor: String!
  }

  # Enums
  enum UserRole {
    USER
    PREMIUM
    BUSINESS
    ENTERPRISE
    ADMIN
    MODERATOR
    SUPPORT
    DEVELOPER
    SUPER_ADMIN
  }

  enum UserStatus {
    ACTIVE
    INACTIVE
    PENDING_VERIFICATION
    SUSPENDED
    DELETED
    LOCKED
  }

  enum ThemePreference {
    LIGHT
    DARK
    SYSTEM
    AUTO
  }

  enum ActivityType {
    LOGIN
    LOGOUT
    REGISTER
    PASSWORD_CHANGE
    PROFILE_UPDATE
    TAX_CALCULATION
    REPORT_GENERATED
    API_CALL
    SUBSCRIPTION_CHANGE
    PAYMENT
    SECURITY_EVENT
    DATA_EXPORT
    OTHER
  }

  enum DeviceType {
    DESKTOP
    LAPTOP
    TABLET
    MOBILE
    UNKNOWN
  }

  enum TwoFactorMethod {
    TOTP
    SMS
    EMAIL
    HARDWARE_KEY
  }

  enum NotificationFrequency {
    IMMEDIATE
    HOURLY
    DAILY
    WEEKLY
    NEVER
  }

  enum DigestFrequency {
    DAILY
    WEEKLY
    MONTHLY
  }

  enum ProfileVisibility {
    PUBLIC
    PRIVATE
    FRIENDS
    MEMBERS
  }

  enum ActivityVisibility {
    PUBLIC
    PRIVATE
    FRIENDS
    MEMBERS
  }

  enum DashboardLayout {
    GRID
    LIST
    COMPACT
    CUSTOM
  }

  enum DashboardView {
    OVERVIEW
    CALCULATIONS
    REPORTS
    ANALYTICS
    BILLING
  }

  enum WidgetType {
    TAX_SUMMARY
    RECENT_CALCULATIONS
    ANALYTICS_CHART
    NEWS_FEED
    WEATHER
    CALENDAR
    QUICK_ACTIONS
    USAGE_STATS
  }

  enum CommunicationChannel {
    EMAIL
    SMS
    PUSH
    IN_APP
    PHONE
  }

  enum PaymentMethodType {
    CARD
    BANK_ACCOUNT
    PAYPAL
    APPLE_PAY
    GOOGLE_PAY
    CRYPTO
  }

  enum InvoiceStatus {
    DRAFT
    PENDING
    PAID
    OVERDUE
    VOID
    UNCOLLECTIBLE
  }

  enum SubscriptionStatus {
    ACTIVE
    TRIALING
    PAST_DUE
    CANCELED
    UNPAID
    INCOMPLETE
    INCOMPLETE_EXPIRED
  }

  enum TaxIdType {
    VAT
    GST
    SSN
    EIN
    OTHER
  }

  enum CouponType {
    PERCENT
    AMOUNT
  }

  enum TransactionType {
    PAYMENT
    REFUND
    CREDIT
    DEBIT
    FEE
    TAX
    DISCOUNT
  }

  enum TransactionStatus {
    PENDING
    COMPLETED
    FAILED
    CANCELED
    EXPIRED
  }

  enum OverageType {
    API_REQUESTS
    DATA_TRANSFER
    STORAGE
    COMPUTE
  }

  enum ExportType {
    PROFILE
    CALCULATIONS
    ACTIVITY
    BILLING
    COMPLETE
  }

  enum ExportStatus {
    REQUESTED
    IN_PROGRESS
    COMPLETED
    FAILED
    EXPIRED
  }

  enum ExportFormat {
    JSON
    CSV
    PDF
    XML
  }
`;

module.exports = userTypeDefs;