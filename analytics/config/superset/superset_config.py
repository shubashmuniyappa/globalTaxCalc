"""
Apache Superset Configuration for GlobalTaxCalc Analytics Platform
"""
import os
from datetime import timedelta
from typing import Optional
from celery.schedules import crontab
from flask_caching.backends.redis import RedisCache

# Base configuration
ROW_LIMIT = 5000
VIZ_ROW_LIMIT = 10000
SAMPLES_ROW_LIMIT = 1000
SQLLAB_TIMEOUT = 300
SUPERSET_WEBSERVER_TIMEOUT = 300

# Database Configuration
DATABASE_DIALECT = os.environ.get("DATABASE_DIALECT", "postgresql")
DATABASE_USER = os.environ.get("DATABASE_USER", "superset")
DATABASE_PASSWORD = os.environ.get("DATABASE_PASSWORD", "superset")
DATABASE_HOST = os.environ.get("DATABASE_HOST", "localhost")
DATABASE_PORT = os.environ.get("DATABASE_PORT", "5432")
DATABASE_DB = os.environ.get("DATABASE_DB", "superset")

# SQLAlchemy Database URI
SQLALCHEMY_DATABASE_URI = (
    f"{DATABASE_DIALECT}://{DATABASE_USER}:{DATABASE_PASSWORD}@"
    f"{DATABASE_HOST}:{DATABASE_PORT}/{DATABASE_DB}"
)

# Redis Configuration
REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
REDIS_PORT = os.environ.get("REDIS_PORT", "6379")
REDIS_PASSWORD = os.environ.get("REDIS_PASSWORD", "")
REDIS_DB = os.environ.get("REDIS_DB", "1")

redis_connection_string = f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}"

# Cache Configuration
CACHE_CONFIG = {
    'CACHE_TYPE': 'RedisCache',
    'CACHE_DEFAULT_TIMEOUT': 300,
    'CACHE_KEY_PREFIX': 'superset_',
    'CACHE_REDIS_URL': redis_connection_string,
}

DATA_CACHE_CONFIG = CACHE_CONFIG

# Celery Configuration
class CeleryConfig:
    broker_url = redis_connection_string
    imports = (
        "superset.sql_lab",
        "superset.tasks",
        "superset.tasks.thumbnails",
        "superset.tasks.cache",
    )
    result_backend = redis_connection_string
    worker_prefetch_multiplier = 10
    task_acks_late = True
    task_annotations = {
        "sql_lab.get_sql_results": {
            "rate_limit": "100/s",
        },
        "email_reports.send": {
            "rate_limit": "1/s",
            "time_limit": 120,
            "soft_time_limit": 150,
            "bind": True,
        },
    }
    beat_schedule = {
        "reports.scheduler": {
            "task": "email_reports.send",
            "schedule": crontab(minute=1, hour="*"),
        },
        "reports.prune_log": {
            "task": "email_reports.prune_log",
            "schedule": crontab(minute=0, hour=0),
        },
        "cache-warmup-hourly": {
            "task": "cache-warmup",
            "schedule": crontab(minute=0, hour="*"),
        },
    }

CELERY_CONFIG = CeleryConfig

# Security Configuration
SECRET_KEY = os.environ.get("SECRET_KEY", "thisISaSECRET_1234")
WTF_CSRF_ENABLED = True
WTF_CSRF_EXEMPT_LIST = ["superset.views.core.log"]
WTF_CSRF_TIME_LIMIT = None

# Authentication Configuration
AUTH_TYPE = AUTH_OAUTH
AUTH_USER_REGISTRATION = True
AUTH_USER_REGISTRATION_ROLE = "Public"

# OAuth Configuration (Optional)
OAUTH_PROVIDERS = [
    {
        "name": "google",
        "token_key": "access_token",
        "icon": "fa-google",
        "remote_app": {
            "client_id": os.environ.get("GOOGLE_CLIENT_ID"),
            "client_secret": os.environ.get("GOOGLE_CLIENT_SECRET"),
            "api_base_url": "https://www.googleapis.com/oauth2/v2/",
            "client_kwargs": {"scope": "email profile"},
            "request_token_url": None,
            "access_token_url": "https://accounts.google.com/o/oauth2/token",
            "authorize_url": "https://accounts.google.com/o/oauth2/auth",
        },
    }
]

# Feature Flags
FEATURE_FLAGS = {
    "DASHBOARD_NATIVE_FILTERS": True,
    "DASHBOARD_CROSS_FILTERS": True,
    "DASHBOARD_RBAC": True,
    "ENABLE_TEMPLATE_PROCESSING": True,
    "ALERT_REPORTS": True,
    "DYNAMIC_PLUGINS": True,
    "VERSIONED_EXPORT": True,
    "EMBEDDED_SUPERSET": True,
    "ESCAPE_MARKDOWN_HTML": True,
    "DASHBOARD_FILTERS_EXPERIMENTAL": True,
    "GLOBAL_ASYNC_QUERIES": True,
    "LISTVIEWS_DEFAULT_CARD_VIEW": True,
}

# Custom Visualization Plugins
DEFAULT_MODULE_DS_MAP = {
    "superset.connectors.sqla": ["SqlaTable"],
}

# Email Configuration
EMAIL_NOTIFICATIONS = True
SMTP_HOST = os.environ.get("SMTP_HOST", "localhost")
SMTP_STARTTLS = True
SMTP_SSL = False
SMTP_USER = os.environ.get("SMTP_USER", "superset")
SMTP_PORT = os.environ.get("SMTP_PORT", 587)
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_MAIL_FROM = os.environ.get("SMTP_MAIL_FROM", "superset@globaltaxcalc.com")

# Slack Configuration (Optional)
SLACK_API_TOKEN = os.environ.get("SLACK_API_TOKEN")

# Analytics Tracking
GOOGLE_ANALYTICS_ID = os.environ.get("GOOGLE_ANALYTICS_ID")

# Custom CSS and Branding
APP_NAME = "GlobalTaxCalc Analytics"
APP_ICON = "/static/assets/images/superset-logo-horiz.png"
APP_ICON_WIDTH = 126

# Custom Colors
THEME_OVERRIDES = {
    "colors": {
        "primary": {
            "base": "#667eea",
            "dark1": "#5a67d8",
            "dark2": "#4c51bf",
            "light1": "#7c3aed",
            "light2": "#8b5cf6",
            "light3": "#a78bfa",
            "light4": "#c4b5fd",
            "light5": "#ddd6fe",
        },
        "secondary": {
            "base": "#f59e0b",
            "dark1": "#d97706",
            "dark2": "#b45309",
            "light1": "#fbbf24",
            "light2": "#fcd34d",
            "light3": "#fde68a",
            "light4": "#fef3c7",
            "light5": "#fffbeb",
        },
        "grayscale": {
            "base": "#666666",
            "dark1": "#323232",
            "dark2": "#000000",
            "light1": "#B2B2B2",
            "light2": "#E0E0E0",
            "light3": "#F0F0F0",
            "light4": "#F7F7F7",
            "light5": "#FFFFFF",
        },
        "error": {
            "base": "#E04355",
            "dark1": "#A7323F",
            "dark2": "#6F212A",
            "light1": "#EF7D86",
            "light2": "#FAACB5",
        },
        "warning": {
            "base": "#FF7F00",
            "dark1": "#BF5F00",
            "dark2": "#7F3F00",
            "light1": "#FF9F40",
            "light2": "#FFBF7F",
        },
        "success": {
            "base": "#5AC189",
            "dark1": "#439066",
            "dark2": "#2C5F44",
            "light1": "#7ED3A7",
            "light2": "#A2E6C4",
        },
        "info": {
            "base": "#66D9EF",
            "dark1": "#4DB8CC",
            "dark2": "#339799",
            "light1": "#85E3F4",
            "light2": "#A3EDF8",
        },
    }
}

# SQL Lab Configuration
SQLLAB_ASYNC_TIME_LIMIT_SEC = 60 * 60 * 6  # 6 hours
SQLLAB_TIMEOUT = 300
SQLLAB_DEFAULT_DBID = None

# Dashboard Configuration
DASHBOARD_AUTO_REFRESH_MODE = "fetch"
DASHBOARD_AUTO_REFRESH_INTERVALS = [
    [10, "10 seconds"],
    [30, "30 seconds"],
    [60, "1 minute"],
    [300, "5 minutes"],
    [1800, "30 minutes"],
    [3600, "1 hour"],
    [21600, "6 hours"],
    [43200, "12 hours"],
    [86400, "24 hours"],
]

# Custom Security Manager
from superset.security import SupersetSecurityManager

class CustomSecurityManager(SupersetSecurityManager):
    """Custom security manager for GlobalTaxCalc"""

    def auth_user_oauth(self, userinfo):
        """OAuth user authentication with custom logic"""
        user = super().auth_user_oauth(userinfo)

        # Add custom user provisioning logic here
        if user and not user.roles:
            # Assign default role based on email domain
            email = userinfo.get('email', '')
            if email.endswith('@globaltaxcalc.com'):
                public_role = self.find_role('Admin')
            else:
                public_role = self.find_role('Public')

            if public_role:
                user.roles = [public_role]
                self.get_session.commit()

        return user

CUSTOM_SECURITY_MANAGER = CustomSecurityManager

# Logging Configuration
import logging
from logging.handlers import RotatingFileHandler

# Create logs directory if it doesn't exist
os.makedirs('/app/superset_home/logs', exist_ok=True)

# Configure logging
ENABLE_TIME_ROTATE = True
TIME_ROTATE_LOG_LEVEL = "INFO"
FILENAME = "/app/superset_home/logs/superset.log"

# Set up rotating file handler
file_handler = RotatingFileHandler(
    FILENAME, maxBytes=10000000, backupCount=5
)
file_handler.setLevel(logging.INFO)

# Format for log messages
formatter = logging.Formatter(
    "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
file_handler.setFormatter(formatter)

# Add handler to logger
logger = logging.getLogger()
logger.addHandler(file_handler)
logger.setLevel(logging.INFO)

# Performance and Limits
RESULTS_BACKEND_USE_MSGPACK = True
GLOBAL_ASYNC_QUERIES_REDIS_CONFIG = {
    "port": REDIS_PORT,
    "host": REDIS_HOST,
    "password": REDIS_PASSWORD,
    "db": 0,
}

# Async Query Configuration
GLOBAL_ASYNC_QUERIES_REDIS_STREAM_PREFIX = "async-events-"
GLOBAL_ASYNC_QUERIES_REDIS_STREAM_LIMIT = 1000
GLOBAL_ASYNC_QUERIES_REDIS_STREAM_LIMIT_FIREHOSE = 1000000

# Custom Jinja Context
def GET_FEATURE_FLAGS_FUNC():
    return FEATURE_FLAGS

JINJA_CONTEXT_ADDONS = {
    'GET_FEATURE_FLAGS_FUNC': GET_FEATURE_FLAGS_FUNC,
}

# Database Connection Pool
SQLALCHEMY_ENGINE_OPTIONS = {
    'pool_size': 10,
    'pool_timeout': 20,
    'pool_recycle': -1,
    'max_overflow': 0,
}

# CORS Configuration
ENABLE_CORS = True
CORS_OPTIONS = {
    'supports_credentials': True,
    'allow_headers': [
        'X-CSRFToken', 'Content-Type', 'Origin', 'X-Requested-With', 'Accept',
        'Authorization', 'X-Forwarded-For'
    ],
    'resources': {
        '/api/*': {
            'origins': [
                'http://localhost:3000',
                'https://globaltaxcalc.com',
                'https://*.globaltaxcalc.com'
            ]
        }
    }
}

# WebSocket Configuration for Live Updates
WEBSOCKET_WHITELIST = [
    'localhost:8088',
    'globaltaxcalc.com:8088',
]

# Custom Data Source Configurations
EXTRA_DYNAMIC_MODULES = {
    'superset.db_engine_specs.clickhouse': ['ClickHouseEngineSpec'],
}

# ClickHouse specific configuration
CLICKHOUSE_CONNECTION_PARAMS = {
    'connect_timeout': 30,
    'send_receive_timeout': 300,
    'sync_request_timeout': 600,
}

# Backup and Export Configuration
BACKUP_COUNT = 30
EXPORT_MAX_ROWS = 100000

# Custom Menu Items
MENU_ITEMS = [
    {
        "name": "GlobalTaxCalc Documentation",
        "url": "https://docs.globaltaxcalc.com",
        "icon": "fa-book",
        "target": "_blank"
    },
    {
        "name": "Support",
        "url": "mailto:support@globaltaxcalc.com",
        "icon": "fa-envelope",
        "target": "_blank"
    }
]

# Custom CSS
EXTRA_CATEGORICAL_COLOR_SCHEMES = [
    {
        "id": "globaltaxcalc_colors",
        "description": "GlobalTaxCalc Brand Colors",
        "label": "GlobalTaxCalc",
        "colors": [
            "#667eea", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6",
            "#06b6d4", "#f97316", "#84cc16", "#ec4899", "#6366f1"
        ]
    }
]

# Alert and Reporting Configuration
ALERT_REPORTS_NOTIFICATION_DRY_RUN = False
WEBDRIVER_BASEURL = "http://superset:8088/"
WEBDRIVER_BASEURL_USER_FRIENDLY = "http://localhost:8088/"

# Thumbnail Configuration
THUMBNAIL_SELENIUM_USER = "admin"
THUMBNAIL_CACHE_CONFIG = CACHE_CONFIG

# Rate Limiting
RATELIMIT_ENABLED = True
RATELIMIT_STORAGE_URI = redis_connection_string

# Session Configuration
PERMANENT_SESSION_LIFETIME = timedelta(days=7)
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = False  # Set to True in production with HTTPS
SESSION_COOKIE_SAMESITE = "Lax"

# Content Security Policy
TALISMAN_ENABLED = True
TALISMAN_CONFIG = {
    "content_security_policy": {
        "default-src": ["'self'"],
        "img-src": ["'self'", "data:", "blob:", "https:"],
        "worker-src": ["'self'", "blob:"],
        "connect-src": [
            "'self'", "https://api.mapbox.com", "https://events.mapbox.com"
        ],
        "object-src": "'none'",
        "style-src": ["'self'", "'unsafe-inline'"],
        "script-src": ["'self'", "'strict-dynamic'", "'unsafe-eval'"]
    },
    "content_security_policy_nonce_in": ["script-src", "style-src"],
    "force_https": False,  # Set to True in production
}