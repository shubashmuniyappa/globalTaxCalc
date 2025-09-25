#!/bin/bash
# Superset Initialization Script for GlobalTaxCalc Analytics

set -e

echo "🚀 Initializing GlobalTaxCalc Analytics Platform..."

# Wait for database to be ready
echo "⏳ Waiting for database connection..."
while ! superset db upgrade; do
    echo "Database not ready, waiting..."
    sleep 5
done

echo "✅ Database connection established"

# Check if we need to initialize (first run)
if ! superset fab list-users | grep -q admin; then
    echo "🔧 First-time setup detected, initializing..."

    # Create admin user
    superset fab create-admin \
        --username admin \
        --firstname Admin \
        --lastname User \
        --email admin@globaltaxcalc.com \
        --password admin123

    echo "✅ Admin user created"

    # Initialize roles and permissions
    superset init
    echo "✅ Roles and permissions initialized"

    # Import default dashboards and datasets
    if [ -d "/app/dashboards" ]; then
        echo "📊 Importing default dashboards..."
        for dashboard in /app/dashboards/*.zip; do
            if [ -f "$dashboard" ]; then
                superset import-dashboards -p "$dashboard"
                echo "✅ Imported $(basename "$dashboard")"
            fi
        done
    fi

    # Import datasets
    if [ -d "/app/datasets" ]; then
        echo "📈 Importing datasets..."
        for dataset in /app/datasets/*.yaml; do
            if [ -f "$dataset" ]; then
                superset import-datasources -p "$dataset"
                echo "✅ Imported $(basename "$dataset")"
            fi
        done
    fi

    # Set up ClickHouse connection
    echo "🔗 Setting up ClickHouse connection..."
    python3 << EOF
from superset import app, db
from superset.models.core import Database

app_context = app.app_context()
app_context.push()

# Check if ClickHouse database already exists
existing_db = db.session.query(Database).filter_by(database_name='GlobalTaxCalc Analytics').first()

if not existing_db:
    # Create ClickHouse database connection
    clickhouse_db = Database(
        database_name='GlobalTaxCalc Analytics',
        sqlalchemy_uri='clickhouse+native://analytics_user:analytics_password@clickhouse:9000/analytics',
        expose_in_sqllab=True,
        allow_ctas=True,
        allow_cvas=True,
        allow_dml=True,
        cache_timeout=3600,
        extra='{"engine_params": {"connect_timeout": 30, "send_receive_timeout": 300}}'
    )

    db.session.add(clickhouse_db)
    db.session.commit()
    print("✅ ClickHouse database connection created")
else:
    print("✅ ClickHouse database connection already exists")

app_context.pop()
EOF

    echo "🎯 Setup completed successfully!"
else
    echo "✅ Superset already initialized"
fi

# Start Superset
echo "🌟 Starting Superset server..."
exec superset run -h 0.0.0.0 -p 8088 --with-threads --reload --debugger