-- ClickHouse Schema Initialization for GlobalTaxCalc Analytics
-- This script creates the complete analytics database schema

-- Create analytics database
CREATE DATABASE IF NOT EXISTS analytics;
USE analytics;

-- User Events Table - Core user interaction tracking
CREATE TABLE IF NOT EXISTS user_events
(
    event_id UUID DEFAULT generateUUIDv4(),
    user_id String,
    session_id String,
    event_name String,
    event_timestamp DateTime64(3) DEFAULT now64(),
    event_date Date DEFAULT toDate(event_timestamp),

    -- User properties
    user_country String DEFAULT '',
    user_state String DEFAULT '',
    user_city String DEFAULT '',
    user_timezone String DEFAULT '',
    user_type Enum8('free' = 1, 'premium' = 2, 'enterprise' = 3) DEFAULT 'free',
    user_registration_date Date,

    -- Session properties
    session_start_time DateTime64(3),
    session_duration_seconds UInt32 DEFAULT 0,
    is_new_session UInt8 DEFAULT 0,

    -- Device and browser information
    device_type Enum8('desktop' = 1, 'mobile' = 2, 'tablet' = 3) DEFAULT 'desktop',
    browser_name String DEFAULT '',
    browser_version String DEFAULT '',
    os_name String DEFAULT '',
    os_version String DEFAULT '',
    screen_resolution String DEFAULT '',
    viewport_size String DEFAULT '',

    -- Page context
    page_url String DEFAULT '',
    page_title String DEFAULT '',
    page_path String DEFAULT '',
    referrer_url String DEFAULT '',
    utm_source String DEFAULT '',
    utm_medium String DEFAULT '',
    utm_campaign String DEFAULT '',
    utm_content String DEFAULT '',
    utm_term String DEFAULT '',

    -- Event specific data (JSON)
    event_properties String DEFAULT '{}',

    -- Geographic data
    ip_address String DEFAULT '',
    geo_country String DEFAULT '',
    geo_region String DEFAULT '',
    geo_city String DEFAULT '',
    geo_latitude Float64 DEFAULT 0,
    geo_longitude Float64 DEFAULT 0,

    -- Attribution
    attribution_channel String DEFAULT '',
    attribution_source String DEFAULT '',
    attribution_medium String DEFAULT '',
    first_touch_timestamp DateTime64(3),
    last_touch_timestamp DateTime64(3),

    -- Technical metrics
    page_load_time UInt32 DEFAULT 0,
    time_on_page UInt32 DEFAULT 0,

    -- Computed fields
    event_hour UInt8 GENERATED ALWAYS AS toHour(event_timestamp) STORED,
    event_day_of_week UInt8 GENERATED ALWAYS AS toDayOfWeek(event_timestamp) STORED,
    event_month UInt8 GENERATED ALWAYS AS toMonth(event_timestamp) STORED,
    event_year UInt16 GENERATED ALWAYS AS toYear(event_timestamp) STORED
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_date, user_id, event_timestamp)
TTL event_date + INTERVAL 2 YEAR
SETTINGS index_granularity = 8192;

-- Calculator Usage Table - Specific calculator interactions
CREATE TABLE IF NOT EXISTS calculator_usage
(
    usage_id UUID DEFAULT generateUUIDv4(),
    user_id String,
    session_id String,
    calculator_type Enum8('income_tax' = 1, 'paycheck' = 2, 'sales_tax' = 3, 'property_tax' = 4, 'capital_gains' = 5, 'retirement' = 6) DEFAULT 'income_tax',
    calculation_timestamp DateTime64(3) DEFAULT now64(),
    calculation_date Date DEFAULT toDate(calculation_timestamp),

    -- Input parameters (JSON)
    input_parameters String DEFAULT '{}',

    -- Results (JSON)
    calculation_results String DEFAULT '{}',

    -- Calculation metadata
    calculation_duration_ms UInt32 DEFAULT 0,
    calculation_steps UInt16 DEFAULT 0,
    error_occurred UInt8 DEFAULT 0,
    error_message String DEFAULT '',

    -- User interaction
    interaction_type Enum8('manual' = 1, 'saved' = 2, 'shared' = 3, 'exported' = 4) DEFAULT 'manual',
    saved_calculation_id String DEFAULT '',

    -- Geographic context
    tax_jurisdiction_country String DEFAULT '',
    tax_jurisdiction_state String DEFAULT '',
    tax_jurisdiction_city String DEFAULT '',
    tax_year UInt16 DEFAULT 0,

    -- Calculated fields
    income_bracket String DEFAULT '',
    tax_rate_effective Float64 DEFAULT 0,
    tax_amount_total Float64 DEFAULT 0,

    -- Performance metrics
    cache_hit UInt8 DEFAULT 0,
    offline_calculation UInt8 DEFAULT 0
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(calculation_date)
ORDER BY (calculation_date, calculator_type, user_id, calculation_timestamp)
TTL calculation_date + INTERVAL 3 YEAR
SETTINGS index_granularity = 8192;

-- Revenue Events Table - Financial tracking
CREATE TABLE IF NOT EXISTS revenue_events
(
    revenue_id UUID DEFAULT generateUUIDv4(),
    user_id String,
    session_id String,
    event_timestamp DateTime64(3) DEFAULT now64(),
    event_date Date DEFAULT toDate(event_timestamp),

    -- Revenue event details
    event_type Enum8('subscription' = 1, 'purchase' = 2, 'upgrade' = 3, 'renewal' = 4, 'refund' = 5, 'chargeback' = 6) DEFAULT 'subscription',
    product_type Enum8('premium' = 1, 'professional' = 2, 'enterprise' = 3, 'addon' = 4) DEFAULT 'premium',
    product_name String DEFAULT '',
    product_sku String DEFAULT '',

    -- Financial data
    revenue_amount Decimal64(4) DEFAULT 0,
    currency String DEFAULT 'USD',
    revenue_amount_usd Decimal64(4) DEFAULT 0,

    -- Subscription details
    subscription_id String DEFAULT '',
    billing_cycle Enum8('monthly' = 1, 'quarterly' = 2, 'annual' = 3, 'lifetime' = 4) DEFAULT 'monthly',
    billing_period_start Date,
    billing_period_end Date,

    -- Payment details
    payment_method Enum8('credit_card' = 1, 'paypal' = 2, 'bank_transfer' = 3, 'crypto' = 4, 'other' = 5) DEFAULT 'credit_card',
    payment_processor String DEFAULT '',
    transaction_id String DEFAULT '',

    -- Promotional data
    coupon_code String DEFAULT '',
    discount_amount Decimal64(4) DEFAULT 0,
    discount_percentage Float64 DEFAULT 0,

    -- Attribution
    attribution_source String DEFAULT '',
    attribution_medium String DEFAULT '',
    attribution_campaign String DEFAULT '',

    -- Customer lifetime value components
    customer_lifetime_days UInt32 DEFAULT 0,
    previous_revenue_total Decimal64(4) DEFAULT 0,
    cumulative_revenue Decimal64(4) DEFAULT 0,

    -- Geographic data
    billing_country String DEFAULT '',
    billing_state String DEFAULT '',
    tax_amount Decimal64(4) DEFAULT 0,
    tax_rate Float64 DEFAULT 0
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_date, user_id, event_timestamp)
TTL event_date + INTERVAL 7 YEAR
SETTINGS index_granularity = 8192;

-- User Segments Table - Dynamic user segmentation
CREATE TABLE IF NOT EXISTS user_segments
(
    user_id String,
    segment_id String,
    segment_name String,
    segment_type Enum8('behavioral' = 1, 'demographic' = 2, 'value_based' = 3, 'lifecycle' = 4, 'custom' = 5) DEFAULT 'behavioral',
    assigned_timestamp DateTime64(3) DEFAULT now64(),
    assigned_date Date DEFAULT toDate(assigned_timestamp),

    -- Segment criteria
    segment_criteria String DEFAULT '{}',
    segment_score Float64 DEFAULT 0,
    confidence_level Float64 DEFAULT 0,

    -- Segment metadata
    segment_description String DEFAULT '',
    is_active UInt8 DEFAULT 1,
    last_updated DateTime64(3) DEFAULT now64(),

    -- Performance metrics
    segment_size UInt32 DEFAULT 0,
    average_ltv Decimal64(4) DEFAULT 0,
    conversion_rate Float64 DEFAULT 0,
    retention_rate Float64 DEFAULT 0
)
ENGINE = ReplacingMergeTree(last_updated)
PARTITION BY toYYYYMM(assigned_date)
ORDER BY (user_id, segment_id)
TTL assigned_date + INTERVAL 1 YEAR
SETTINGS index_granularity = 8192;

-- A/B Test Results Table - Experimentation tracking
CREATE TABLE IF NOT EXISTS ab_test_results
(
    test_id String,
    user_id String,
    variant_id String,
    assignment_timestamp DateTime64(3) DEFAULT now64(),
    assignment_date Date DEFAULT toDate(assignment_timestamp),

    -- Test configuration
    test_name String DEFAULT '',
    test_hypothesis String DEFAULT '',
    test_start_date Date,
    test_end_date Date,
    test_status Enum8('active' = 1, 'paused' = 2, 'completed' = 3, 'cancelled' = 4) DEFAULT 'active',

    -- Variant details
    variant_name String DEFAULT '',
    variant_type Enum8('control' = 1, 'treatment' = 2) DEFAULT 'control',
    variant_config String DEFAULT '{}',

    -- Conversion tracking
    conversion_event String DEFAULT '',
    converted UInt8 DEFAULT 0,
    conversion_timestamp DateTime64(3),
    conversion_value Decimal64(4) DEFAULT 0,

    -- Engagement metrics
    page_views UInt32 DEFAULT 0,
    session_duration UInt32 DEFAULT 0,
    bounce_rate Float64 DEFAULT 0,

    -- Statistical significance
    sample_size UInt32 DEFAULT 0,
    confidence_interval_lower Float64 DEFAULT 0,
    confidence_interval_upper Float64 DEFAULT 0,
    p_value Float64 DEFAULT 0,
    statistical_power Float64 DEFAULT 0
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(assignment_date)
ORDER BY (test_id, user_id, assignment_timestamp)
TTL assignment_date + INTERVAL 2 YEAR
SETTINGS index_granularity = 8192;

-- Performance Metrics Table - System and application performance
CREATE TABLE IF NOT EXISTS performance_metrics
(
    metric_id UUID DEFAULT generateUUIDv4(),
    timestamp DateTime64(3) DEFAULT now64(),
    date Date DEFAULT toDate(timestamp),

    -- Metric identification
    metric_name String,
    metric_type Enum8('core_web_vital' = 1, 'page_load' = 2, 'api_response' = 3, 'database' = 4, 'custom' = 5) DEFAULT 'custom',
    metric_category String DEFAULT '',

    -- Metric values
    metric_value Float64 DEFAULT 0,
    metric_unit String DEFAULT '',
    metric_threshold Float64 DEFAULT 0,
    threshold_status Enum8('good' = 1, 'needs_improvement' = 2, 'poor' = 3) DEFAULT 'good',

    -- Context information
    page_url String DEFAULT '',
    user_agent String DEFAULT '',
    connection_type String DEFAULT '',
    device_type String DEFAULT '',

    -- Performance details
    measurement_method String DEFAULT '',
    sample_size UInt32 DEFAULT 1,
    percentile_50 Float64 DEFAULT 0,
    percentile_75 Float64 DEFAULT 0,
    percentile_95 Float64 DEFAULT 0,
    percentile_99 Float64 DEFAULT 0,

    -- Geographic context
    geo_country String DEFAULT '',
    geo_region String DEFAULT '',

    -- Additional data
    metadata String DEFAULT '{}'
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, metric_name, timestamp)
TTL date + INTERVAL 6 MONTH
SETTINGS index_granularity = 8192;

-- Marketing Attribution Table - Multi-touch attribution
CREATE TABLE IF NOT EXISTS marketing_attribution
(
    attribution_id UUID DEFAULT generateUUIDv4(),
    user_id String,
    conversion_timestamp DateTime64(3) DEFAULT now64(),
    conversion_date Date DEFAULT toDate(conversion_timestamp),

    -- Conversion details
    conversion_type Enum8('signup' = 1, 'purchase' = 2, 'trial' = 3, 'subscription' = 4) DEFAULT 'signup',
    conversion_value Decimal64(4) DEFAULT 0,

    -- Attribution model
    attribution_model Enum8('first_touch' = 1, 'last_touch' = 2, 'linear' = 3, 'time_decay' = 4, 'position_based' = 5) DEFAULT 'last_touch',

    -- Channel attribution
    channel_1 String DEFAULT '',
    channel_1_weight Float64 DEFAULT 0,
    channel_1_timestamp DateTime64(3),

    channel_2 String DEFAULT '',
    channel_2_weight Float64 DEFAULT 0,
    channel_2_timestamp DateTime64(3),

    channel_3 String DEFAULT '',
    channel_3_weight Float64 DEFAULT 0,
    channel_3_timestamp DateTime64(3),

    -- Campaign details
    campaign_name String DEFAULT '',
    campaign_medium String DEFAULT '',
    campaign_source String DEFAULT '',
    campaign_content String DEFAULT '',
    campaign_term String DEFAULT '',

    -- Attribution quality
    attribution_confidence Float64 DEFAULT 0,
    touchpoint_count UInt16 DEFAULT 0,
    customer_journey_length_days UInt32 DEFAULT 0,

    -- Revenue attribution
    attributed_revenue Decimal64(4) DEFAULT 0,
    revenue_attribution_model String DEFAULT '',

    -- Additional context
    attribution_metadata String DEFAULT '{}'
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(conversion_date)
ORDER BY (conversion_date, user_id, conversion_timestamp)
TTL conversion_date + INTERVAL 3 YEAR
SETTINGS index_granularity = 8192;

-- Cohort Analysis Table - User cohort tracking
CREATE TABLE IF NOT EXISTS cohort_analysis
(
    cohort_id String,
    user_id String,
    cohort_timestamp DateTime64(3) DEFAULT now64(),
    cohort_date Date DEFAULT toDate(cohort_timestamp),

    -- Cohort definition
    cohort_name String DEFAULT '',
    cohort_type Enum8('acquisition' = 1, 'behavioral' = 2, 'revenue' = 3, 'engagement' = 4) DEFAULT 'acquisition',
    cohort_period Enum8('daily' = 1, 'weekly' = 2, 'monthly' = 3, 'quarterly' = 4) DEFAULT 'monthly',

    -- User properties at cohort entry
    user_acquisition_channel String DEFAULT '',
    user_first_calculation_type String DEFAULT '',
    user_signup_country String DEFAULT '',
    user_initial_plan String DEFAULT '',

    -- Retention tracking
    period_0_active UInt8 DEFAULT 1,
    period_1_active UInt8 DEFAULT 0,
    period_2_active UInt8 DEFAULT 0,
    period_3_active UInt8 DEFAULT 0,
    period_4_active UInt8 DEFAULT 0,
    period_5_active UInt8 DEFAULT 0,
    period_6_active UInt8 DEFAULT 0,
    period_7_active UInt8 DEFAULT 0,
    period_8_active UInt8 DEFAULT 0,
    period_9_active UInt8 DEFAULT 0,
    period_10_active UInt8 DEFAULT 0,
    period_11_active UInt8 DEFAULT 0,

    -- Revenue tracking per period
    period_0_revenue Decimal64(4) DEFAULT 0,
    period_1_revenue Decimal64(4) DEFAULT 0,
    period_2_revenue Decimal64(4) DEFAULT 0,
    period_3_revenue Decimal64(4) DEFAULT 0,
    period_4_revenue Decimal64(4) DEFAULT 0,
    period_5_revenue Decimal64(4) DEFAULT 0,
    period_6_revenue Decimal64(4) DEFAULT 0,
    period_7_revenue Decimal64(4) DEFAULT 0,
    period_8_revenue Decimal64(4) DEFAULT 0,
    period_9_revenue Decimal64(4) DEFAULT 0,
    period_10_revenue Decimal64(4) DEFAULT 0,
    period_11_revenue Decimal64(4) DEFAULT 0,

    -- Cumulative metrics
    total_revenue Decimal64(4) DEFAULT 0,
    total_calculations UInt32 DEFAULT 0,
    total_sessions UInt32 DEFAULT 0,
    last_activity_date Date,

    -- Cohort size and statistics
    cohort_size UInt32 DEFAULT 0,
    retention_rate Float64 DEFAULT 0,
    average_revenue_per_user Decimal64(4) DEFAULT 0
)
ENGINE = ReplacingMergeTree(cohort_timestamp)
PARTITION BY toYYYYMM(cohort_date)
ORDER BY (cohort_id, user_id)
TTL cohort_date + INTERVAL 2 YEAR
SETTINGS index_granularity = 8192;

-- Predictive Models Table - ML model results and predictions
CREATE TABLE IF NOT EXISTS predictive_models
(
    prediction_id UUID DEFAULT generateUUIDv4(),
    user_id String,
    model_name String,
    model_version String DEFAULT '1.0',
    prediction_timestamp DateTime64(3) DEFAULT now64(),
    prediction_date Date DEFAULT toDate(prediction_timestamp),

    -- Model details
    model_type Enum8('churn' = 1, 'ltv' = 2, 'conversion' = 3, 'recommendation' = 4, 'demand' = 5) DEFAULT 'churn',
    algorithm String DEFAULT '',
    training_data_period String DEFAULT '',

    -- Predictions
    prediction_value Float64 DEFAULT 0,
    prediction_confidence Float64 DEFAULT 0,
    prediction_class String DEFAULT '',
    prediction_probability Float64 DEFAULT 0,

    -- Feature importance (JSON)
    feature_importance String DEFAULT '{}',
    input_features String DEFAULT '{}',

    -- Model performance
    model_accuracy Float64 DEFAULT 0,
    model_precision Float64 DEFAULT 0,
    model_recall Float64 DEFAULT 0,
    model_f1_score Float64 DEFAULT 0,

    -- Prediction context
    prediction_horizon_days UInt32 DEFAULT 0,
    actual_outcome Float64 DEFAULT 0,
    outcome_observed UInt8 DEFAULT 0,
    outcome_timestamp DateTime64(3),

    -- Business impact
    expected_value Decimal64(4) DEFAULT 0,
    intervention_recommended String DEFAULT '',
    intervention_applied UInt8 DEFAULT 0,

    -- Model metadata
    model_metadata String DEFAULT '{}'
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(prediction_date)
ORDER BY (prediction_date, model_name, user_id, prediction_timestamp)
TTL prediction_date + INTERVAL 1 YEAR
SETTINGS index_granularity = 8192;

-- Create materialized views for common aggregations

-- Daily User Activity Summary
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_user_activity_mv
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_date, user_id)
AS SELECT
    event_date,
    user_id,
    user_country,
    user_type,
    device_type,
    countIf(event_name = 'page_view') as page_views,
    countIf(event_name = 'calculation_completed') as calculations,
    countIf(event_name = 'signup') as signups,
    countIf(event_name = 'subscription') as subscriptions,
    uniq(session_id) as sessions,
    sum(time_on_page) as total_time_on_site,
    avg(page_load_time) as avg_page_load_time,
    count() as total_events
FROM user_events
GROUP BY event_date, user_id, user_country, user_type, device_type;

-- Hourly Calculator Usage Summary
CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_calculator_usage_mv
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(calculation_date)
ORDER BY (calculation_date, toHour(calculation_timestamp), calculator_type)
AS SELECT
    calculation_date,
    toHour(calculation_timestamp) as hour,
    calculator_type,
    tax_jurisdiction_country,
    count() as calculation_count,
    countIf(error_occurred = 1) as error_count,
    avg(calculation_duration_ms) as avg_duration_ms,
    countIf(cache_hit = 1) as cache_hits,
    countIf(offline_calculation = 1) as offline_calculations,
    sum(tax_amount_total) as total_tax_calculated,
    avg(tax_rate_effective) as avg_tax_rate
FROM calculator_usage
GROUP BY calculation_date, hour, calculator_type, tax_jurisdiction_country;

-- Daily Revenue Summary
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_revenue_mv
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_date, product_type, billing_country)
AS SELECT
    event_date,
    product_type,
    billing_country,
    currency,
    count() as transaction_count,
    sum(revenue_amount) as total_revenue,
    sum(revenue_amount_usd) as total_revenue_usd,
    countIf(event_type = 'subscription') as new_subscriptions,
    countIf(event_type = 'renewal') as renewals,
    countIf(event_type = 'refund') as refunds,
    sum(discount_amount) as total_discounts,
    uniq(user_id) as unique_customers
FROM revenue_events
GROUP BY event_date, product_type, billing_country, currency;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON user_events(user_id) TYPE bloom_filter GRANULARITY 1;
CREATE INDEX IF NOT EXISTS idx_user_events_session_id ON user_events(session_id) TYPE bloom_filter GRANULARITY 1;
CREATE INDEX IF NOT EXISTS idx_user_events_event_name ON user_events(event_name) TYPE bloom_filter GRANULARITY 1;
CREATE INDEX IF NOT EXISTS idx_calculator_usage_user_id ON calculator_usage(user_id) TYPE bloom_filter GRANULARITY 1;
CREATE INDEX IF NOT EXISTS idx_revenue_events_user_id ON revenue_events(user_id) TYPE bloom_filter GRANULARITY 1;
CREATE INDEX IF NOT EXISTS idx_revenue_events_transaction_id ON revenue_events(transaction_id) TYPE bloom_filter GRANULARITY 1;