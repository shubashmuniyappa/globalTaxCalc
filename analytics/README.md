# GlobalTaxCalc Analytics Platform

A comprehensive analytics and business intelligence platform for GlobalTaxCalc.com, providing advanced data insights, predictive analytics, and business intelligence capabilities.

## 🚀 Features

### Core Analytics Components

1. **Apache Superset Integration**
   - Complete BI setup with ClickHouse integration
   - Pre-configured dashboards and visualizations
   - OAuth authentication and role-based access control

2. **Business Dashboards**
   - Executive Dashboard: High-level KPIs and business metrics
   - User Analytics Dashboard: Detailed user behavior analysis
   - Revenue Dashboard: Revenue tracking and forecasting

3. **User Segmentation System**
   - Behavioral segmentation using K-means clustering
   - RFM (Recency, Frequency, Monetary) value-based segmentation
   - Lifecycle stage segmentation
   - Geographic segmentation

4. **Predictive Analytics Models**
   - Customer churn prediction using ML algorithms
   - Customer lifetime value (LTV) forecasting
   - Demand forecasting with time series analysis
   - Feature importance analysis and model interpretability

5. **Conversion Funnel Analysis**
   - Multi-step funnel visualization
   - Cohort analysis for user retention
   - A/B test result analysis
   - Attribution modeling
   - Bottleneck identification and optimization recommendations

6. **Real-time Monitoring System**
   - Live traffic and user activity monitoring
   - Performance metrics tracking
   - Anomaly detection with statistical methods
   - Intelligent alerting system
   - WebSocket feeds for real-time dashboards

7. **System Health Monitoring**
   - Infrastructure monitoring (CPU, memory, disk, network)
   - Application performance monitoring
   - Database health checks
   - Service availability monitoring
   - Health score calculation

8. **Competitive Intelligence**
   - Competitor website monitoring
   - Pricing intelligence tracking
   - Feature comparison analysis
   - SEO competitive analysis
   - Market trend analysis

9. **Automated Insights Generation**
   - Statistical anomaly detection
   - Trend analysis and forecasting
   - Business KPI insights
   - Automated narrative generation
   - Intelligent alerting and recommendations

## 🏗️ Architecture

### Technology Stack

- **Database**: ClickHouse (columnar analytics database)
- **Caching**: Redis (real-time data and caching)
- **BI Platform**: Apache Superset
- **ML Libraries**: scikit-learn, XGBoost, Prophet
- **Visualization**: Plotly, Seaborn
- **Web Scraping**: BeautifulSoup, aiohttp
- **Task Queue**: Celery
- **Containerization**: Docker & Docker Compose

### System Components

```
├── analytics/
│   ├── config/                     # Configuration files
│   │   ├── superset/              # Superset configuration
│   │   └── clickhouse/            # ClickHouse setup
│   ├── dashboards/                # Business dashboards
│   │   ├── executive_dashboard.py
│   │   ├── user_analytics_dashboard.py
│   │   └── revenue_dashboard.py
│   ├── segmentation/              # User segmentation
│   │   └── user_segmentation.py
│   ├── ml/                        # Machine learning models
│   │   └── predictive_models.py
│   ├── funnels/                   # Funnel analysis
│   │   ├── conversion_funnel.py
│   │   └── funnel_optimization.py
│   ├── monitoring/                # Monitoring systems
│   │   ├── real_time_monitor.py
│   │   └── system_health.py
│   ├── competitive_intelligence/  # Competitive analysis
│   │   └── market_analysis.py
│   ├── insights/                  # Automated insights
│   │   └── automated_insights.py
│   └── main_analytics_orchestrator.py
```

## 📊 Data Schema

### ClickHouse Tables

- **user_events**: Core user activity tracking
- **calculator_usage**: Tax calculator interaction data
- **revenue_events**: Revenue and transaction tracking
- **user_segments**: Segmentation results
- **ab_test_results**: A/B testing data
- **performance_metrics**: System performance data
- **marketing_attribution**: Marketing channel attribution
- **cohort_analysis**: User cohort data
- **predictive_models**: ML model results
- **competitor_pricing**: Competitive pricing data
- **competitor_features**: Feature comparison data
- **market_trends**: Market trend analysis
- **automated_insights**: Generated insights

## 🚀 Getting Started

### Prerequisites

- Docker and Docker Compose
- Python 3.9+
- At least 8GB RAM for full deployment

### Installation

1. **Clone and Setup**
   ```bash
   cd globalTaxCalc/analytics
   ```

2. **Environment Configuration**
   Create `.env` file:
   ```env
   CLICKHOUSE_HOST=localhost
   CLICKHOUSE_PORT=9000
   CLICKHOUSE_DB=analytics
   REDIS_HOST=localhost
   REDIS_PORT=6379
   SUPERSET_SECRET_KEY=your_secret_key
   ```

3. **Start Infrastructure**
   ```bash
   docker-compose up -d
   ```

4. **Initialize Database**
   ```bash
   docker exec -it clickhouse-server clickhouse-client --query="$(cat scripts/clickhouse/init.sql)"
   ```

5. **Install Python Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

6. **Start Analytics Orchestrator**
   ```bash
   python main_analytics_orchestrator.py
   ```

### Quick Start Services

- **Superset Dashboard**: http://localhost:8088
  - Username: admin
  - Password: admin

- **Grafana Monitoring**: http://localhost:3001
  - Username: admin
  - Password: admin

- **Jupyter Notebooks**: http://localhost:8889

## 📈 Usage Examples

### Generate User Segmentation

```python
from segmentation.user_segmentation import UserSegmentationEngine

# Initialize segmentation engine
segmentation = UserSegmentationEngine(clickhouse_config)

# Perform behavioral segmentation
segments = segmentation.perform_behavioral_segmentation()

# Get segment profiles
profiles = segmentation.get_segment_profiles()
```

### Run Funnel Analysis

```python
from funnels.conversion_funnel import ConversionFunnelAnalyzer

# Initialize funnel analyzer
funnel_analyzer = ConversionFunnelAnalyzer(clickhouse_config)

# Analyze conversion funnel
analysis = funnel_analyzer.analyze_conversion_funnel()

# Get bottlenecks
bottlenecks = funnel_analyzer.identify_bottlenecks()
```

### Generate Predictive Models

```python
from ml.predictive_models import PredictiveAnalyticsEngine

# Initialize predictive engine
predictor = PredictiveAnalyticsEngine(clickhouse_config)

# Train churn prediction model
churn_model = predictor.train_churn_prediction_model()

# Predict user churn
churn_probability = predictor.predict_user_churn(user_id)
```

### Get Automated Insights

```python
from insights.automated_insights import AutomatedInsightsEngine

# Initialize insights engine
insights = AutomatedInsightsEngine(clickhouse_config, redis_config)

# Generate all insights
all_insights = insights.generate_all_insights()

# Get active insights
active_insights = insights.get_active_insights(priority='high')
```

## 🔧 Configuration

### ClickHouse Configuration

```python
clickhouse_config = {
    'host': 'localhost',
    'port': 9000,
    'username': 'default',
    'password': '',
    'database': 'analytics'
}
```

### Redis Configuration

```python
redis_config = {
    'host': 'localhost',
    'port': 6379,
    'password': None
}
```

### Notification Configuration

```python
notification_config = {
    'email': {
        'smtp_server': 'smtp.gmail.com',
        'smtp_port': 587,
        'username': 'alerts@globaltaxcalc.com',
        'password': 'your_password',
        'from': 'alerts@globaltaxcalc.com',
        'to': 'admin@globaltaxcalc.com'
    },
    'slack': {
        'webhook_url': 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
    }
}
```

## 📊 Dashboard Access

### Superset Dashboards

1. **Executive Dashboard**
   - URL: http://localhost:8088/dashboard/executive
   - KPIs: Revenue, users, conversion rates, growth metrics

2. **User Analytics Dashboard**
   - URL: http://localhost:8088/dashboard/users
   - Metrics: User behavior, engagement, retention, acquisition

3. **Revenue Dashboard**
   - URL: http://localhost:8088/dashboard/revenue
   - Metrics: Revenue trends, LTV, MRR, cohort revenue

### Real-time Monitoring

- **WebSocket Endpoint**: ws://localhost:8765
- **Health Status**: Available via REST API
- **Alert Dashboard**: Integrated in Superset

## 🚨 Monitoring & Alerts

### Alert Types

1. **Performance Alerts**
   - High error rates (>5%)
   - Slow response times (>2s)
   - System resource usage (>80%)

2. **Business Alerts**
   - Low conversion rates (<1%)
   - Revenue drops (>20% decrease)
   - Traffic anomalies

3. **System Health Alerts**
   - Service downtime
   - Database connection issues
   - Memory/CPU threshold breaches

### Alert Channels

- Email notifications
- Slack webhooks
- In-dashboard alerts
- WebSocket real-time notifications

## 🔬 Analytics Capabilities

### Segmentation Analysis

- **Behavioral Segmentation**: K-means clustering on user actions
- **Value-based Segmentation**: RFM analysis for customer value
- **Lifecycle Segmentation**: New, active, at-risk, churned users
- **Geographic Segmentation**: Location-based user analysis

### Predictive Analytics

- **Churn Prediction**: Identify users likely to churn
- **LTV Forecasting**: Predict customer lifetime value
- **Demand Forecasting**: Predict future usage patterns
- **Feature Importance**: Understand key drivers

### Funnel Optimization

- **Conversion Analysis**: Step-by-step funnel performance
- **Cohort Analysis**: User retention over time
- **A/B Testing**: Statistical significance testing
- **Attribution Modeling**: Marketing channel attribution

### Competitive Intelligence

- **Pricing Monitoring**: Track competitor pricing changes
- **Feature Tracking**: Monitor competitor feature updates
- **SEO Analysis**: Competitive SEO metrics
- **Market Trends**: Industry trend analysis

## 🚀 Scaling & Performance

### Performance Optimizations

- ClickHouse materialized views for fast queries
- Redis caching for frequently accessed data
- Async processing for real-time monitoring
- Connection pooling for database efficiency

### Scaling Considerations

- Horizontal scaling with ClickHouse clusters
- Redis cluster for cache scaling
- Load balancing for dashboard access
- Microservice architecture for component isolation

## 📚 API Reference

### Analytics Orchestrator

```python
# Start all analytics components
orchestrator = AnalyticsOrchestrator(config)
await orchestrator.start_orchestrator()

# Get system status
status = orchestrator.get_orchestrator_status()
```

### Real-time Monitor

```python
# Start real-time monitoring
monitor = RealTimeMonitor(clickhouse_config, redis_config)
await monitor.start_monitoring()

# Get active alerts
alerts = monitor.get_active_alerts()
```

### Insights Engine

```python
# Generate insights
insights = insights_engine.generate_all_insights()

# Get insights summary
summary = insights_engine.get_insights_summary()
```

## 🛠️ Development

### Adding New Components

1. Create component in appropriate directory
2. Add to main orchestrator
3. Update configuration
4. Add tests
5. Update documentation

### Testing

```bash
# Run unit tests
python -m pytest tests/

# Run integration tests
python -m pytest tests/integration/

# Run performance tests
python -m pytest tests/performance/
```

## 📋 Maintenance

### Regular Tasks

- **Daily**: Review automated insights and alerts
- **Weekly**: Check system health metrics
- **Monthly**: Review competitive intelligence reports
- **Quarterly**: Model retraining and optimization

### Backup & Recovery

- ClickHouse data backup procedures
- Configuration backup
- Model artifact preservation
- Dashboard configuration export

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Implement changes with tests
4. Update documentation
5. Submit pull request

## 📄 License

This project is proprietary to GlobalTaxCalc.com. All rights reserved.

## 🆘 Support

For technical support or questions:
- Internal Documentation: See `/docs` directory
- Technical Team: Contact analytics team
- Issues: Use internal issue tracking system

---

**GlobalTaxCalc Analytics Platform** - Empowering data-driven decisions for tax calculation services.