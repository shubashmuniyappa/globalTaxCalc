-- Initialize database for GlobalTaxCalc Auth Service
-- This script runs when the PostgreSQL container starts

-- Create additional databases if needed
-- CREATE DATABASE globaltaxcalc_test;
-- CREATE DATABASE globaltaxcalc_staging;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create a read-only user for monitoring/reporting
CREATE USER readonly_user WITH PASSWORD 'readonly_password';
GRANT CONNECT ON DATABASE globaltaxcalc_dev TO readonly_user;
GRANT USAGE ON SCHEMA public TO readonly_user;

-- Grant select permissions on all current and future tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO readonly_user;

-- Create indexes for better performance (these will be created by migrations, but adding here for reference)
-- These are examples and actual indexes are created by Sequelize migrations

-- Log table setup for better performance
-- These tables will be created by migrations, but we can optimize settings here

-- Set some PostgreSQL optimizations for the auth service workload
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries taking more than 1 second
ALTER SYSTEM SET checkpoint_timeout = '15min';
ALTER SYSTEM SET max_wal_size = '2GB';
ALTER SYSTEM SET min_wal_size = '1GB';

-- Note: These changes require a server restart to take effect
-- In production, these should be set via environment variables or config files