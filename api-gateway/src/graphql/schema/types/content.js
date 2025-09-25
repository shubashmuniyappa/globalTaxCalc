/**
 * Content GraphQL Type Definitions
 * Content management, educational resources, and blog types
 */

const { gql } = require('graphql-tag');

const contentTypeDefs = gql`
  extend type Query {
    # Articles and Blog Posts
    getArticles(
      filters: [FilterInput!]
      sort: [SortInput!]
      pagination: PaginationInput
    ): ArticleConnection!

    getArticle(id: ID!): Article
    getArticleBySlug(slug: String!): Article

    # Educational Content
    getGuides(
      category: GuideCategory
      country: Country
      language: Language
      pagination: PaginationInput
    ): GuideConnection!

    getGuide(id: ID!): Guide
    getGuideBySlug(slug: String!): Guide

    # FAQ
    getFAQs(
      category: FAQCategory
      search: String
      pagination: PaginationInput
    ): FAQConnection!

    getFAQ(id: ID!): FAQ

    # Resources
    getResources(
      type: ResourceType
      category: ResourceCategory
      pagination: PaginationInput
    ): ResourceConnection!

    getResource(id: ID!): Resource

    # Templates
    getTemplates(
      type: TemplateType
      category: TemplateCategory
      country: Country
      pagination: PaginationInput
    ): TemplateConnection!

    getTemplate(id: ID!): Template

    # Glossary
    getGlossaryTerms(
      category: GlossaryCategory
      language: Language
      search: String
      pagination: PaginationInput
    ): GlossaryTermConnection!

    getGlossaryTerm(id: ID!): GlossaryTerm

    # Categories and Tags
    getCategories(type: CategoryType!): [Category!]!
    getTags(type: TagType): [Tag!]!

    # Content Search
    searchContent(input: ContentSearchInput!): ContentSearchResult!

    # Content Analytics
    getContentAnalytics(
      contentId: ID
      type: ContentType
      period: AnalyticsPeriod!
    ): ContentAnalytics! @auth(role: ADMIN)

    # Admin Queries
    getContentStats: ContentStats! @auth(role: ADMIN)
    getPendingContent(
      pagination: PaginationInput
    ): ContentConnection! @auth(role: ADMIN)
  }

  extend type Mutation {
    # Article Management
    createArticle(input: CreateArticleInput!): Article! @auth(role: ADMIN)
    updateArticle(id: ID!, input: UpdateArticleInput!): Article! @auth(role: ADMIN)
    publishArticle(id: ID!): Article! @auth(role: ADMIN)
    unpublishArticle(id: ID!): Article! @auth(role: ADMIN)
    deleteArticle(id: ID!): OperationResponse! @auth(role: ADMIN)

    # Guide Management
    createGuide(input: CreateGuideInput!): Guide! @auth(role: ADMIN)
    updateGuide(id: ID!, input: UpdateGuideInput!): Guide! @auth(role: ADMIN)
    publishGuide(id: ID!): Guide! @auth(role: ADMIN)
    deleteGuide(id: ID!): OperationResponse! @auth(role: ADMIN)

    # FAQ Management
    createFAQ(input: CreateFAQInput!): FAQ! @auth(role: ADMIN)
    updateFAQ(id: ID!, input: UpdateFAQInput!): FAQ! @auth(role: ADMIN)
    deleteFAQ(id: ID!): OperationResponse! @auth(role: ADMIN)

    # Resource Management
    createResource(input: CreateResourceInput!): Resource! @auth(role: ADMIN)
    updateResource(id: ID!, input: UpdateResourceInput!): Resource! @auth(role: ADMIN)
    deleteResource(id: ID!): OperationResponse! @auth(role: ADMIN)

    # Template Management
    createTemplate(input: CreateTemplateInput!): Template! @auth(role: ADMIN)
    updateTemplate(id: ID!, input: UpdateTemplateInput!): Template! @auth(role: ADMIN)
    deleteTemplate(id: ID!): OperationResponse! @auth(role: ADMIN)

    # Glossary Management
    createGlossaryTerm(input: CreateGlossaryTermInput!): GlossaryTerm! @auth(role: ADMIN)
    updateGlossaryTerm(id: ID!, input: UpdateGlossaryTermInput!): GlossaryTerm! @auth(role: ADMIN)
    deleteGlossaryTerm(id: ID!): OperationResponse! @auth(role: ADMIN)

    # Category and Tag Management
    createCategory(input: CreateCategoryInput!): Category! @auth(role: ADMIN)
    updateCategory(id: ID!, input: UpdateCategoryInput!): Category! @auth(role: ADMIN)
    deleteCategory(id: ID!): OperationResponse! @auth(role: ADMIN)

    createTag(input: CreateTagInput!): Tag! @auth(role: ADMIN)
    updateTag(id: ID!, input: UpdateTagInput!): Tag! @auth(role: ADMIN)
    deleteTag(id: ID!): OperationResponse! @auth(role: ADMIN)

    # Content Interaction
    likeContent(contentId: ID!, type: ContentType!): ContentInteraction! @auth(role: USER)
    unlikeContent(contentId: ID!, type: ContentType!): OperationResponse! @auth(role: USER)
    bookmarkContent(contentId: ID!, type: ContentType!): ContentBookmark! @auth(role: USER)
    removeBookmark(contentId: ID!, type: ContentType!): OperationResponse! @auth(role: USER)
    shareContent(contentId: ID!, type: ContentType!, platform: SocialPlatform!): ContentShare! @auth(role: USER)

    # Content Rating and Review
    rateContent(input: ContentRatingInput!): ContentRating! @auth(role: USER)
    reviewContent(input: ContentReviewInput!): ContentReview! @auth(role: USER)
    updateReview(id: ID!, input: UpdateReviewInput!): ContentReview! @auth(role: USER)
    deleteReview(id: ID!): OperationResponse! @auth(role: USER)

    # Content Feedback
    reportContent(input: ReportContentInput!): ContentReport! @auth(role: USER)
    suggestContent(input: ContentSuggestionInput!): ContentSuggestion! @auth(role: USER)
  }

  extend type Subscription {
    # Content Updates
    contentPublished(type: ContentType): Content!
    contentUpdated(contentId: ID!): Content!

    # User Interactions
    contentLiked(contentId: ID!): ContentInteraction! @auth(role: USER)
    contentReviewed(contentId: ID!): ContentReview!

    # Admin Notifications
    contentReported(type: ContentType): ContentReport! @auth(role: ADMIN)
    contentSuggested: ContentSuggestion! @auth(role: ADMIN)
  }

  # Core Content Types
  interface Content {
    id: ID!
    title: String!
    slug: String!
    excerpt: String
    content: String!
    status: ContentStatus!
    visibility: Visibility!
    featured: Boolean!
    author: ContentAuthor!
    categories: [Category!]!
    tags: [Tag!]!
    metadata: ContentMetadata!
    seo: SEOData!
    analytics: ContentAnalyticsSummary
    interactions: ContentInteractions!
    publishedAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Article implements Content {
    id: ID!
    title: String!
    slug: String!
    excerpt: String
    content: String!
    status: ContentStatus!
    visibility: Visibility!
    featured: Boolean!
    author: ContentAuthor!
    categories: [Category!]!
    tags: [Tag!]!
    metadata: ContentMetadata!
    seo: SEOData!
    analytics: ContentAnalyticsSummary
    interactions: ContentInteractions!
    publishedAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!

    # Article-specific fields
    type: ArticleType!
    readingTime: Int!
    featuredImage: ContentImage
    gallery: [ContentImage!]
    relatedArticles: [Article!]
    series: ArticleSeries
    newsletter: Boolean!
  }

  type Guide implements Content {
    id: ID!
    title: String!
    slug: String!
    excerpt: String
    content: String!
    status: ContentStatus!
    visibility: Visibility!
    featured: Boolean!
    author: ContentAuthor!
    categories: [Category!]!
    tags: [Tag!]!
    metadata: ContentMetadata!
    seo: SEOData!
    analytics: ContentAnalyticsSummary
    interactions: ContentInteractions!
    publishedAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!

    # Guide-specific fields
    difficulty: DifficultyLevel!
    estimatedTime: Int!
    prerequisites: [String!]
    sections: [GuideSection!]!
    downloadable: Boolean!
    country: Country
    taxYear: Int
    lastReviewed: Date
    reviewSchedule: ReviewSchedule
  }

  type FAQ {
    id: ID!
    question: String!
    answer: String!
    category: FAQCategory!
    tags: [Tag!]!
    helpful: Int!
    notHelpful: Int!
    related: [FAQ!]
    country: Country
    lastUpdated: DateTime!
    createdAt: DateTime!
  }

  type Resource {
    id: ID!
    title: String!
    description: String!
    type: ResourceType!
    category: ResourceCategory!
    url: String
    file: FileUpload
    thumbnail: ContentImage
    downloadCount: Int!
    size: Int
    format: String
    country: Country
    language: Language!
    free: Boolean!
    premium: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Template {
    id: ID!
    name: String!
    description: String!
    type: TemplateType!
    category: TemplateCategory!
    content: String!
    fields: [TemplateField!]!
    preview: String
    thumbnail: ContentImage
    country: Country!
    year: Int!
    popular: Boolean!
    downloadCount: Int!
    rating: Float!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type GlossaryTerm {
    id: ID!
    term: String!
    definition: String!
    category: GlossaryCategory!
    synonyms: [String!]
    relatedTerms: [GlossaryTerm!]
    examples: [String!]
    country: Country
    language: Language!
    source: String
    lastUpdated: DateTime!
    createdAt: DateTime!
  }

  # Supporting Types
  type ContentAuthor {
    id: ID!
    name: String!
    bio: String
    avatar: String
    title: String
    company: String
    socialLinks: [SocialMediaLink!]
    expertise: [String!]!
    articlesCount: Int!
    rating: Float
  }

  type ContentMetadata {
    language: Language!
    country: Country
    taxYear: Int
    difficulty: DifficultyLevel
    readingTime: Int
    wordCount: Int!
    lastReviewed: Date
    nextReview: Date
    version: String
    changelog: [VersionChange!]
  }

  type VersionChange {
    version: String!
    changes: [String!]!
    date: Date!
    author: String!
  }

  type SEOData {
    metaTitle: String
    metaDescription: String
    keywords: [String!]
    canonicalUrl: String
    noIndex: Boolean!
    noFollow: Boolean!
    openGraph: OpenGraphData
    twitterCard: TwitterCardData
    structuredData: JSON
  }

  type OpenGraphData {
    title: String
    description: String
    image: String
    type: String
    url: String
  }

  type TwitterCardData {
    card: String
    title: String
    description: String
    image: String
    creator: String
  }

  type ContentImage {
    id: ID!
    url: String!
    alt: String!
    caption: String
    width: Int!
    height: Int!
    size: Int!
    format: String!
  }

  type ArticleSeries {
    id: ID!
    name: String!
    description: String
    articles: [Article!]!
    order: Int!
  }

  type GuideSection {
    id: ID!
    title: String!
    content: String!
    order: Int!
    subsections: [GuideSubsection!]
  }

  type GuideSubsection {
    id: ID!
    title: String!
    content: String!
    order: Int!
  }

  type TemplateField {
    id: ID!
    name: String!
    label: String!
    type: FieldType!
    required: Boolean!
    defaultValue: String
    options: [String!]
    validation: FieldValidation
    description: String
  }

  type FieldValidation {
    pattern: String
    minLength: Int
    maxLength: Int
    min: Float
    max: Float
    required: Boolean!
  }

  type Category {
    id: ID!
    name: String!
    slug: String!
    description: String
    parent: Category
    children: [Category!]
    color: String
    icon: String
    contentCount: Int!
    type: CategoryType!
  }

  type ContentInteractions {
    views: Int!
    likes: Int!
    shares: Int!
    bookmarks: Int!
    comments: Int!
    avgRating: Float
    totalRatings: Int!
  }

  type ContentInteraction {
    id: ID!
    user: User!
    content: Content!
    type: InteractionType!
    timestamp: DateTime!
  }

  type ContentBookmark {
    id: ID!
    user: User!
    content: Content!
    collection: String
    createdAt: DateTime!
  }

  type ContentShare {
    id: ID!
    user: User!
    content: Content!
    platform: SocialPlatform!
    url: String!
    timestamp: DateTime!
  }

  type ContentRating {
    id: ID!
    user: User!
    content: Content!
    rating: Int!
    review: String
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type ContentReview {
    id: ID!
    user: User!
    content: Content!
    rating: Int!
    title: String
    review: String!
    helpful: Int!
    notHelpful: Int!
    verified: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type ContentReport {
    id: ID!
    user: User!
    content: Content!
    reason: ReportReason!
    description: String
    status: ReportStatus!
    reviewedBy: User
    reviewedAt: DateTime
    createdAt: DateTime!
  }

  type ContentSuggestion {
    id: ID!
    user: User!
    type: ContentType!
    title: String!
    description: String!
    priority: Priority!
    status: SuggestionStatus!
    assignedTo: User
    implementedAs: Content
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  # Analytics Types
  type ContentAnalytics {
    overview: ContentAnalyticsOverview!
    traffic: TrafficAnalytics!
    engagement: EngagementAnalytics!
    performance: PerformanceAnalytics!
    demographics: DemographicsAnalytics!
  }

  type ContentAnalyticsOverview {
    totalViews: Int!
    uniqueViews: Int!
    avgTimeOnPage: Int!
    bounceRate: Percentage!
    conversionRate: Percentage!
  }

  type TrafficAnalytics {
    sources: [TrafficSource!]!
    referrers: [Referrer!]!
    searchTerms: [SearchTerm!]!
    devices: [DeviceStats!]!
  }

  type TrafficSource {
    source: String!
    visitors: Int!
    percentage: Percentage!
  }

  type Referrer {
    domain: String!
    visits: Int!
    percentage: Percentage!
  }

  type SearchTerm {
    term: String!
    visits: Int!
    position: Float!
  }

  type DeviceStats {
    device: String!
    visits: Int!
    percentage: Percentage!
  }

  type EngagementAnalytics {
    avgTimeOnPage: Int!
    pageviews: Int!
    uniquePageviews: Int!
    exitRate: Percentage!
    scrollDepth: Percentage!
    socialShares: [SocialShareStats!]!
  }

  type SocialShareStats {
    platform: SocialPlatform!
    shares: Int!
  }

  type PerformanceAnalytics {
    loadTime: Int!
    firstContentfulPaint: Int!
    largestContentfulPaint: Int!
    cumulativeLayoutShift: Float!
    firstInputDelay: Int!
  }

  type DemographicsAnalytics {
    countries: [CountryStats!]!
    languages: [LanguageStats!]!
    ageGroups: [AgeGroupStats!]!
  }

  type CountryStats {
    country: Country!
    visitors: Int!
    percentage: Percentage!
  }

  type LanguageStats {
    language: Language!
    visitors: Int!
    percentage: Percentage!
  }

  type AgeGroupStats {
    ageGroup: String!
    visitors: Int!
    percentage: Percentage!
  }

  type ContentAnalyticsSummary {
    views: Int!
    uniqueViews: Int!
    likes: Int!
    shares: Int!
    avgRating: Float
    lastViewed: DateTime
  }

  type ContentStats {
    total: Int!
    published: Int!
    draft: Int!
    archived: Int!
    byType: [ContentTypeStats!]!
    byCategory: [CategoryStats!]!
    byAuthor: [AuthorStats!]!
    performance: ContentPerformanceStats!
  }

  type ContentTypeStats {
    type: ContentType!
    count: Int!
    views: Int!
    engagement: Float!
  }

  type CategoryStats {
    category: Category!
    count: Int!
    views: Int!
    engagement: Float!
  }

  type AuthorStats {
    author: ContentAuthor!
    count: Int!
    views: Int!
    avgRating: Float!
  }

  type ContentPerformanceStats {
    topContent: [TopContent!]!
    trendingContent: [TrendingContent!]!
    underperforming: [Content!]!
  }

  type TopContent {
    content: Content!
    views: Int!
    engagement: Float!
    rank: Int!
  }

  type TrendingContent {
    content: Content!
    growthRate: Percentage!
    views: Int!
    timeframe: String!
  }

  # Search Types
  type ContentSearchResult {
    results: [ContentSearchMatch!]!
    facets: [ContentSearchFacet!]!
    suggestions: [String!]!
    total: Int!
    took: Int!
    pagination: PageInfo!
  }

  type ContentSearchMatch {
    content: Content!
    score: Float!
    highlights: [String!]!
    snippet: String!
  }

  type ContentSearchFacet {
    field: String!
    values: [ContentSearchFacetValue!]!
  }

  type ContentSearchFacetValue {
    value: String!
    count: Int!
    selected: Boolean!
  }

  # Input Types
  input CreateArticleInput {
    title: String!
    slug: String
    excerpt: String
    content: String!
    type: ArticleType!
    status: ContentStatus = DRAFT
    visibility: Visibility = PUBLIC
    featured: Boolean = false
    categories: [ID!]!
    tags: [ID!]
    featuredImage: Upload
    gallery: [Upload!]
    series: ID
    newsletter: Boolean = false
    seo: SEODataInput
    metadata: ContentMetadataInput
    publishAt: DateTime
  }

  input UpdateArticleInput {
    title: String
    slug: String
    excerpt: String
    content: String
    type: ArticleType
    status: ContentStatus
    visibility: Visibility
    featured: Boolean
    categories: [ID!]
    tags: [ID!]
    featuredImage: Upload
    gallery: [Upload!]
    series: ID
    newsletter: Boolean
    seo: SEODataInput
    metadata: ContentMetadataInput
    publishAt: DateTime
  }

  input CreateGuideInput {
    title: String!
    slug: String
    excerpt: String
    content: String!
    difficulty: DifficultyLevel!
    estimatedTime: Int!
    prerequisites: [String!]
    sections: [GuideSectionInput!]!
    status: ContentStatus = DRAFT
    visibility: Visibility = PUBLIC
    featured: Boolean = false
    categories: [ID!]!
    tags: [ID!]
    country: Country
    taxYear: Int
    downloadable: Boolean = false
    seo: SEODataInput
    metadata: ContentMetadataInput
  }

  input GuideSectionInput {
    title: String!
    content: String!
    order: Int!
    subsections: [GuideSubsectionInput!]
  }

  input GuideSubsectionInput {
    title: String!
    content: String!
    order: Int!
  }

  input UpdateGuideInput {
    title: String
    slug: String
    excerpt: String
    content: String
    difficulty: DifficultyLevel
    estimatedTime: Int
    prerequisites: [String!]
    sections: [GuideSectionInput!]
    status: ContentStatus
    visibility: Visibility
    featured: Boolean
    categories: [ID!]
    tags: [ID!]
    country: Country
    taxYear: Int
    downloadable: Boolean
    seo: SEODataInput
    metadata: ContentMetadataInput
  }

  input CreateFAQInput {
    question: String!
    answer: String!
    category: FAQCategory!
    tags: [ID!]
    country: Country
  }

  input UpdateFAQInput {
    question: String
    answer: String
    category: FAQCategory
    tags: [ID!]
    country: Country
  }

  input CreateResourceInput {
    title: String!
    description: String!
    type: ResourceType!
    category: ResourceCategory!
    url: String
    file: Upload
    thumbnail: Upload
    country: Country
    language: Language!
    free: Boolean = true
    premium: Boolean = false
  }

  input UpdateResourceInput {
    title: String
    description: String
    type: ResourceType
    category: ResourceCategory
    url: String
    file: Upload
    thumbnail: Upload
    country: Country
    language: Language
    free: Boolean
    premium: Boolean
  }

  input CreateTemplateInput {
    name: String!
    description: String!
    type: TemplateType!
    category: TemplateCategory!
    content: String!
    fields: [TemplateFieldInput!]!
    preview: String
    thumbnail: Upload
    country: Country!
    year: Int!
  }

  input TemplateFieldInput {
    name: String!
    label: String!
    type: FieldType!
    required: Boolean = false
    defaultValue: String
    options: [String!]
    validation: FieldValidationInput
    description: String
  }

  input FieldValidationInput {
    pattern: String
    minLength: Int
    maxLength: Int
    min: Float
    max: Float
    required: Boolean = false
  }

  input UpdateTemplateInput {
    name: String
    description: String
    type: TemplateType
    category: TemplateCategory
    content: String
    fields: [TemplateFieldInput!]
    preview: String
    thumbnail: Upload
    country: Country
    year: Int
  }

  input CreateGlossaryTermInput {
    term: String!
    definition: String!
    category: GlossaryCategory!
    synonyms: [String!]
    examples: [String!]
    country: Country
    language: Language!
    source: String
  }

  input UpdateGlossaryTermInput {
    term: String
    definition: String
    category: GlossaryCategory
    synonyms: [String!]
    examples: [String!]
    country: Country
    language: Language
    source: String
  }

  input CreateCategoryInput {
    name: String!
    slug: String
    description: String
    parent: ID
    color: String
    icon: String
    type: CategoryType!
  }

  input UpdateCategoryInput {
    name: String
    slug: String
    description: String
    parent: ID
    color: String
    icon: String
  }

  input CreateTagInput {
    name: String!
    slug: String
    description: String
    color: String
    type: TagType
  }

  input UpdateTagInput {
    name: String
    slug: String
    description: String
    color: String
  }

  input ContentRatingInput {
    contentId: ID!
    type: ContentType!
    rating: Int!
    review: String
  }

  input ContentReviewInput {
    contentId: ID!
    type: ContentType!
    rating: Int!
    title: String
    review: String!
  }

  input UpdateReviewInput {
    rating: Int
    title: String
    review: String
  }

  input ReportContentInput {
    contentId: ID!
    type: ContentType!
    reason: ReportReason!
    description: String
  }

  input ContentSuggestionInput {
    type: ContentType!
    title: String!
    description: String!
    priority: Priority = NORMAL
  }

  input SEODataInput {
    metaTitle: String
    metaDescription: String
    keywords: [String!]
    canonicalUrl: String
    noIndex: Boolean = false
    noFollow: Boolean = false
    openGraph: OpenGraphDataInput
    twitterCard: TwitterCardDataInput
    structuredData: JSON
  }

  input OpenGraphDataInput {
    title: String
    description: String
    image: String
    type: String
    url: String
  }

  input TwitterCardDataInput {
    card: String
    title: String
    description: String
    image: String
    creator: String
  }

  input ContentMetadataInput {
    language: Language!
    country: Country
    taxYear: Int
    difficulty: DifficultyLevel
    version: String
  }

  input ContentSearchInput {
    query: String!
    types: [ContentType!]
    categories: [ID!]
    tags: [ID!]
    language: Language
    country: Country
    dateRange: TimeRangeInput
    sort: ContentSortInput
    filters: [ContentFilterInput!]
    pagination: PaginationInput
  }

  input ContentSortInput {
    field: ContentSortField!
    direction: SortDirection = DESC
  }

  input ContentFilterInput {
    field: ContentFilterField!
    operator: FilterOperator!
    value: String!
  }

  # Connections
  type ArticleConnection {
    edges: [ArticleEdge!]!
    pageInfo: PageInfo!
  }

  type ArticleEdge {
    node: Article!
    cursor: String!
  }

  type GuideConnection {
    edges: [GuideEdge!]!
    pageInfo: PageInfo!
  }

  type GuideEdge {
    node: Guide!
    cursor: String!
  }

  type FAQConnection {
    edges: [FAQEdge!]!
    pageInfo: PageInfo!
  }

  type FAQEdge {
    node: FAQ!
    cursor: String!
  }

  type ResourceConnection {
    edges: [ResourceEdge!]!
    pageInfo: PageInfo!
  }

  type ResourceEdge {
    node: Resource!
    cursor: String!
  }

  type TemplateConnection {
    edges: [TemplateEdge!]!
    pageInfo: PageInfo!
  }

  type TemplateEdge {
    node: Template!
    cursor: String!
  }

  type GlossaryTermConnection {
    edges: [GlossaryTermEdge!]!
    pageInfo: PageInfo!
  }

  type GlossaryTermEdge {
    node: GlossaryTerm!
    cursor: String!
  }

  type ContentConnection {
    edges: [ContentEdge!]!
    pageInfo: PageInfo!
  }

  type ContentEdge {
    node: Content!
    cursor: String!
  }

  # Enums
  enum ContentType {
    ARTICLE
    GUIDE
    FAQ
    RESOURCE
    TEMPLATE
    GLOSSARY
  }

  enum ArticleType {
    NEWS
    TUTORIAL
    OPINION
    ANALYSIS
    CASE_STUDY
    INTERVIEW
    REVIEW
    ANNOUNCEMENT
  }

  enum ContentStatus {
    DRAFT
    REVIEW
    PUBLISHED
    ARCHIVED
    DELETED
  }

  enum DifficultyLevel {
    BEGINNER
    INTERMEDIATE
    ADVANCED
    EXPERT
  }

  enum ReviewSchedule {
    MONTHLY
    QUARTERLY
    YEARLY
    AS_NEEDED
  }

  enum ResourceType {
    PDF
    VIDEO
    AUDIO
    SPREADSHEET
    PRESENTATION
    TOOL
    CALCULATOR
    CHECKLIST
    TEMPLATE
    FORM
  }

  enum ResourceCategory {
    TAX_FORMS
    GUIDES
    TOOLS
    TEMPLATES
    CHECKLISTS
    CALCULATORS
    LEGAL
    EDUCATIONAL
  }

  enum TemplateType {
    TAX_FORM
    BUSINESS_PLAN
    BUDGET
    INVOICE
    RECEIPT
    LETTER
    CONTRACT
    CHECKLIST
    WORKSHEET
  }

  enum TemplateCategory {
    PERSONAL
    BUSINESS
    LEGAL
    FINANCIAL
    TAX
    PLANNING
  }

  enum FieldType {
    TEXT
    TEXTAREA
    NUMBER
    EMAIL
    PHONE
    DATE
    SELECT
    RADIO
    CHECKBOX
    FILE
    CURRENCY
  }

  enum FAQCategory {
    GENERAL
    TAX_CALCULATION
    ACCOUNT
    BILLING
    FEATURES
    TECHNICAL
    LEGAL
    PRIVACY
  }

  enum GlossaryCategory {
    TAX_TERMS
    FINANCIAL
    LEGAL
    ACCOUNTING
    INVESTMENT
    BUSINESS
    TECHNOLOGY
  }

  enum CategoryType {
    ARTICLE
    GUIDE
    RESOURCE
    TEMPLATE
    FAQ
    GLOSSARY
  }

  enum TagType {
    GENERAL
    TOPIC
    COUNTRY
    FEATURE
    DIFFICULTY
  }

  enum InteractionType {
    VIEW
    LIKE
    SHARE
    BOOKMARK
    COMMENT
    DOWNLOAD
  }

  enum ReportReason {
    INAPPROPRIATE
    SPAM
    COPYRIGHT
    INCORRECT
    OUTDATED
    OFFENSIVE
    OTHER
  }

  enum ReportStatus {
    PENDING
    REVIEWED
    RESOLVED
    DISMISSED
  }

  enum SuggestionStatus {
    SUBMITTED
    REVIEWED
    APPROVED
    IN_PROGRESS
    COMPLETED
    REJECTED
  }

  enum ContentSortField {
    CREATED_AT
    UPDATED_AT
    PUBLISHED_AT
    TITLE
    VIEWS
    LIKES
    RATING
    RELEVANCE
  }

  enum ContentFilterField {
    STATUS
    AUTHOR
    CATEGORY
    TAG
    LANGUAGE
    COUNTRY
    DIFFICULTY
    TYPE
  }

  enum AnalyticsPeriod {
    HOUR
    DAY
    WEEK
    MONTH
    QUARTER
    YEAR
    ALL_TIME
  }
`;

module.exports = contentTypeDefs;