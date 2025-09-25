/**
 * Common GraphQL Type Definitions
 * Shared types and enums used across the schema
 */

const { gql } = require('graphql-tag');

const commonTypeDefs = gql`
  # Pagination
  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
    total: Int!
    page: Int!
    limit: Int!
  }

  input PaginationInput {
    first: Int
    after: String
    last: Int
    before: String
    page: Int = 1
    limit: Int = 20
  }

  # Sorting
  enum SortDirection {
    ASC
    DESC
  }

  input SortInput {
    field: String!
    direction: SortDirection = ASC
  }

  # Filtering
  input FilterInput {
    field: String!
    operator: FilterOperator!
    value: String!
  }

  enum FilterOperator {
    EQUALS
    NOT_EQUALS
    CONTAINS
    NOT_CONTAINS
    STARTS_WITH
    ENDS_WITH
    GREATER_THAN
    GREATER_THAN_OR_EQUAL
    LESS_THAN
    LESS_THAN_OR_EQUAL
    IN
    NOT_IN
    IS_NULL
    IS_NOT_NULL
    BETWEEN
  }

  # Address
  type Address {
    id: ID!
    street: String!
    city: String!
    state: String
    postalCode: String!
    country: Country!
    type: AddressType
    isDefault: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  input AddressInput {
    street: String!
    city: String!
    state: String
    postalCode: String!
    country: Country!
    type: AddressType = PRIMARY
    isDefault: Boolean = false
  }

  enum AddressType {
    PRIMARY
    BILLING
    SHIPPING
    WORK
    OTHER
  }

  # Contact Information
  type ContactInfo {
    email: String
    phone: String
    website: String
    socialMedia: [SocialMediaLink!]
  }

  type SocialMediaLink {
    platform: SocialPlatform!
    url: String!
    username: String
  }

  enum SocialPlatform {
    TWITTER
    FACEBOOK
    LINKEDIN
    INSTAGRAM
    YOUTUBE
    GITHUB
  }

  # File Upload
  type FileUpload {
    id: ID!
    filename: String!
    mimetype: String!
    encoding: String!
    size: Int!
    url: String!
    thumbnailUrl: String
    uploadedAt: DateTime!
    uploadedBy: ID!
  }

  # Error Handling
  type Error {
    code: String!
    message: String!
    details: JSON
    path: [String!]
    timestamp: DateTime!
  }

  type ValidationError {
    field: String!
    message: String!
    code: String!
    value: String
  }

  # Response Types
  type OperationResponse {
    success: Boolean!
    message: String
    errors: [Error!]
    data: JSON
  }

  type BulkOperationResponse {
    success: Boolean!
    message: String
    processed: Int!
    successful: Int!
    failed: Int!
    errors: [Error!]
    results: [JSON!]
  }

  # Audit Trail
  type AuditLog {
    id: ID!
    action: String!
    resource: String!
    resourceId: ID!
    userId: ID
    userEmail: String
    ipAddress: String
    userAgent: String
    changes: JSON
    timestamp: DateTime!
  }

  # Localization
  enum Language {
    EN
    ES
    FR
    DE
    IT
    PT
    JA
    ZH
    KO
    AR
    HE
    RU
    TR
    NL
    SV
    NO
    DA
    FI
    PL
    CS
    HU
    RO
    BG
    HR
    SL
    SK
    LT
    LV
    ET
    MT
    CY
    IS
    FO
    GA
    GD
    CY
    BR
    CO
    EU
    GL
    CA
    OC
    SC
    LB
    RM
    FY
    AF
    SQ
    HY
    AZ
    BE
    BS
    MK
    ME
    RS
    UA
    MD
    GE
    AM
    KZ
    KG
    TJ
    TM
    UZ
    MN
    TI
    BO
    MY
    LO
    KH
    VI
    TH
    MS
    ID
    TL
    FJ
    TO
    SM
    TV
    KI
    NR
    PW
    MH
    FM
    VU
    SB
    NC
    PF
    WF
    CK
    NU
    TK
    WS
    AS
    GU
    MP
    VI
    PR
    UM
    MQ
    GP
    GF
    RE
    YT
    PM
    BL
    MF
    WF
    PF
    NC
    TF
    AQ
    BV
    SJ
    HM
    CC
    CX
    NF
    IO
    GS
    FK
    PN
    SH
    AC
    TA
  }

  # Currency
  enum CurrencyCode {
    USD
    EUR
    GBP
    JPY
    AUD
    CAD
    CHF
    CNY
    SEK
    NZD
    MXN
    SGD
    HKD
    NOK
    TRY
    RUB
    INR
    BRL
    ZAR
    KRW
    DKK
    PLN
    TWD
    THB
    MYR
    CZK
    HUF
    ILS
    CLP
    PHP
    AED
    COP
    SAR
    RON
    BGN
    HRK
    ISK
    EGP
    QAR
    KWD
    BHD
    OMR
    JOD
    LBP
    TND
    DZD
    MAD
    LYD
    SDG
    SOS
    ETB
    KES
    UGX
    TZS
    RWF
    BIF
    DJF
    ERN
    NAD
    BWP
    LSL
    SZL
    ZMW
    AOA
    MZN
    MGA
    KMF
    SCR
    MUR
    MVR
    NPR
    PKR
    LKR
    BDT
    BTN
    MMK
    LAK
    KHR
    VND
    IDR
    BND
    PGK
    FJD
    TOP
    WST
    VUV
    SBD
    NCX
    XPF
    NZD
    AUD
    USD
  }

  # Status Enums
  enum Status {
    ACTIVE
    INACTIVE
    PENDING
    SUSPENDED
    DELETED
    ARCHIVED
  }

  enum Priority {
    LOW
    NORMAL
    HIGH
    URGENT
    CRITICAL
  }

  enum Visibility {
    PUBLIC
    PRIVATE
    INTERNAL
    RESTRICTED
  }

  # Time-based types
  type TimeRange {
    start: DateTime!
    end: DateTime!
    timezone: String
  }

  input TimeRangeInput {
    start: DateTime!
    end: DateTime!
    timezone: String
  }

  type BusinessHours {
    monday: DaySchedule
    tuesday: DaySchedule
    wednesday: DaySchedule
    thursday: DaySchedule
    friday: DaySchedule
    saturday: DaySchedule
    sunday: DaySchedule
    timezone: String!
  }

  type DaySchedule {
    open: String
    close: String
    closed: Boolean!
  }

  # Metrics and Analytics
  type Metric {
    name: String!
    value: Float!
    unit: String
    timestamp: DateTime!
    tags: [Tag!]
  }

  type Tag {
    key: String!
    value: String!
  }

  # Feature Flags
  type FeatureFlag {
    id: ID!
    name: String!
    description: String
    enabled: Boolean!
    rolloutPercentage: Float
    conditions: [FeatureCondition!]
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type FeatureCondition {
    type: FeatureConditionType!
    operator: FilterOperator!
    value: String!
  }

  enum FeatureConditionType {
    USER_ID
    EMAIL
    COUNTRY
    SUBSCRIPTION_TIER
    API_KEY
    IP_ADDRESS
    USER_AGENT
    CUSTOM
  }

  # Search
  type SearchResult {
    id: ID!
    type: String!
    title: String!
    description: String
    url: String
    score: Float!
    highlights: [String!]
    metadata: JSON
  }

  input SearchInput {
    query: String!
    filters: [FilterInput!]
    sort: [SortInput!]
    facets: [String!]
    pagination: PaginationInput
  }

  type SearchResponse {
    results: [SearchResult!]!
    facets: [SearchFacet!]
    pagination: PageInfo!
    total: Int!
    took: Int!
  }

  type SearchFacet {
    field: String!
    values: [SearchFacetValue!]!
  }

  type SearchFacetValue {
    value: String!
    count: Int!
  }

  # Notifications
  type Notification {
    id: ID!
    type: NotificationType!
    title: String!
    message: String!
    data: JSON
    read: Boolean!
    readAt: DateTime
    createdAt: DateTime!
    expiresAt: DateTime
  }

  enum NotificationType {
    INFO
    SUCCESS
    WARNING
    ERROR
    MARKETING
    SYSTEM
    SECURITY
    BILLING
    FEATURE
    SOCIAL
  }

  # Configuration
  type Configuration {
    key: String!
    value: JSON!
    description: String
    type: ConfigurationType!
    encrypted: Boolean!
    updatedAt: DateTime!
    updatedBy: ID
  }

  enum ConfigurationType {
    STRING
    NUMBER
    BOOLEAN
    JSON
    ARRAY
    SECRET
  }

  # Rate Limiting
  type RateLimit {
    limit: Int!
    remaining: Int!
    resetTime: DateTime!
    retryAfter: Int
  }

  # API Key
  type APIKey {
    id: ID!
    name: String!
    key: String!
    prefix: String!
    permissions: [Permission!]!
    rateLimit: RateLimit
    lastUsed: DateTime
    expiresAt: DateTime
    createdAt: DateTime!
    isActive: Boolean!
  }

  type Permission {
    resource: String!
    actions: [String!]!
    conditions: JSON
  }

  # Health and Monitoring
  type SystemHealth {
    status: SystemStatus!
    services: [ServiceHealth!]!
    metrics: [SystemMetric!]!
    lastCheck: DateTime!
  }

  enum SystemStatus {
    HEALTHY
    DEGRADED
    DOWN
    MAINTENANCE
  }

  type ServiceHealth {
    name: String!
    status: SystemStatus!
    responseTime: Int
    errorRate: Float
    throughput: Float
    lastCheck: DateTime!
  }

  type SystemMetric {
    name: String!
    value: Float!
    unit: String!
    threshold: Float
    critical: Boolean!
  }
`;

module.exports = commonTypeDefs;