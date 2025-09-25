"""
ML Platform Setup Script
Automated setup for the GlobalTaxCalc ML Platform
"""

import os
import sys
import subprocess
import logging
from pathlib import Path
import json
import shutil
from typing import Dict, List

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MLPlatformSetup:
    """Setup and configuration manager for ML platform"""

    def __init__(self, base_path: str = None):
        self.base_path = Path(base_path) if base_path else Path(__file__).parent
        self.config = {}
        self.setup_steps = [
            'create_directories',
            'install_dependencies',
            'setup_mlflow',
            'setup_database',
            'setup_redis',
            'initialize_feature_store',
            'setup_monitoring',
            'create_config_files',
            'run_tests'
        ]

    def run_complete_setup(self):
        """Run complete ML platform setup"""
        logger.info("Starting GlobalTaxCalc ML Platform setup...")

        try:
            for step in self.setup_steps:
                logger.info(f"Executing setup step: {step}")
                method = getattr(self, step)
                method()
                logger.info(f"Completed setup step: {step}")

            logger.info("ML Platform setup completed successfully!")
            self.print_next_steps()

        except Exception as e:
            logger.error(f"Setup failed at step {step}: {e}")
            raise

    def create_directories(self):
        """Create necessary directory structure"""
        directories = [
            'data/raw',
            'data/processed',
            'data/features',
            'data/models',
            'logs',
            'config',
            'scripts',
            'notebooks',
            'tests',
            'mlruns',
            'mlflow-artifacts',
            'monitoring/alerts',
            'monitoring/reports'
        ]

        for directory in directories:
            dir_path = self.base_path / directory
            dir_path.mkdir(parents=True, exist_ok=True)
            logger.info(f"Created directory: {dir_path}")

    def install_dependencies(self):
        """Install Python dependencies"""
        logger.info("Installing Python dependencies...")

        # Check if requirements.txt exists
        requirements_file = self.base_path / 'requirements.txt'
        if not requirements_file.exists():
            logger.error("requirements.txt not found. Please ensure it exists in the ML platform directory.")
            raise FileNotFoundError("requirements.txt not found")

        try:
            subprocess.run([
                sys.executable, '-m', 'pip', 'install', '-r', str(requirements_file)
            ], check=True, capture_output=True, text=True)
            logger.info("Dependencies installed successfully")

        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to install dependencies: {e.stderr}")
            raise

    def setup_mlflow(self):
        """Setup MLflow tracking server"""
        logger.info("Setting up MLflow...")

        # Create MLflow directories
        mlruns_dir = self.base_path / 'mlruns'
        artifacts_dir = self.base_path / 'mlflow-artifacts'

        mlruns_dir.mkdir(exist_ok=True)
        artifacts_dir.mkdir(exist_ok=True)

        # Create MLflow configuration
        mlflow_config = {
            'tracking_uri': 'sqlite:///mlflow.db',
            'artifact_root': str(artifacts_dir),
            'backend_store_uri': 'sqlite:///mlflow.db',
            'default_artifact_root': str(artifacts_dir)
        }

        config_file = self.base_path / 'config' / 'mlflow_config.json'
        with open(config_file, 'w') as f:
            json.dump(mlflow_config, f, indent=2)

        logger.info("MLflow configuration created")

    def setup_database(self):
        """Setup SQLite databases for monitoring and features"""
        logger.info("Setting up databases...")

        # Create database directory
        db_dir = self.base_path / 'data' / 'databases'
        db_dir.mkdir(exist_ok=True)

        # Database configuration
        db_config = {
            'feature_store': str(db_dir / 'feature_store.db'),
            'model_monitoring': str(db_dir / 'model_monitoring.db'),
            'user_analytics': str(db_dir / 'user_analytics.db'),
            'mlflow': str(self.base_path / 'mlflow.db')
        }

        config_file = self.base_path / 'config' / 'database_config.json'
        with open(config_file, 'w') as f:
            json.dump(db_config, f, indent=2)

        logger.info("Database configuration created")

    def setup_redis(self):
        """Setup Redis configuration"""
        logger.info("Setting up Redis configuration...")

        redis_config = {
            'host': 'localhost',
            'port': 6379,
            'db': 0,
            'password': None,
            'socket_timeout': 30,
            'socket_connect_timeout': 30,
            'retry_on_timeout': True,
            'health_check_interval': 30
        }

        config_file = self.base_path / 'config' / 'redis_config.json'
        with open(config_file, 'w') as f:
            json.dump(redis_config, f, indent=2)

        logger.info("Redis configuration created")

    def initialize_feature_store(self):
        """Initialize feature store configuration"""
        logger.info("Initializing feature store...")

        feast_config = {
            'project': 'globaltaxcalc',
            'provider': 'local',
            'registry': str(self.base_path / 'data' / 'feature_registry.db'),
            'online_store': {
                'type': 'sqlite',
                'path': str(self.base_path / 'data' / 'online_store.db')
            },
            'offline_store': {
                'type': 'file',
                'path': str(self.base_path / 'data' / 'offline_store')
            }
        }

        # Create feature store directory
        feature_store_dir = self.base_path / 'data' / 'feature_store'
        feature_store_dir.mkdir(exist_ok=True)

        config_file = self.base_path / 'config' / 'feature_store_config.json'
        with open(config_file, 'w') as f:
            json.dump(feast_config, f, indent=2)

        logger.info("Feature store configuration created")

    def setup_monitoring(self):
        """Setup monitoring configuration"""
        logger.info("Setting up monitoring...")

        monitoring_config = {
            'performance_thresholds': {
                'tax_optimization': {
                    'min_accuracy': 0.80,
                    'min_r2': 0.70,
                    'max_mae': 500.0,
                    'max_prediction_time': 100.0
                },
                'churn_prediction': {
                    'min_accuracy': 0.75,
                    'min_precision': 0.70,
                    'min_recall': 0.75,
                    'max_prediction_time': 50.0
                }
            },
            'alert_channels': ['email', 'log'],
            'email_config': {
                'smtp_server': 'smtp.gmail.com',
                'smtp_port': 587,
                'use_tls': True,
                'sender_email': '',
                'recipient_email': '',
                'username': '',
                'password': ''
            },
            'drift_detection': {
                'check_frequency_hours': 24,
                'psi_threshold': 0.2,
                'js_divergence_threshold': 0.1
            }
        }

        config_file = self.base_path / 'config' / 'monitoring_config.json'
        with open(config_file, 'w') as f:
            json.dump(monitoring_config, f, indent=2)

        logger.info("Monitoring configuration created")

    def create_config_files(self):
        """Create main configuration files"""
        logger.info("Creating main configuration files...")

        # Main application config
        app_config = {
            'ml_service': {
                'host': '0.0.0.0',
                'port': 8000,
                'workers': 4,
                'timeout': 60
            },
            'dashboard': {
                'host': '0.0.0.0',
                'port': 8501,
                'title': 'GlobalTaxCalc ML Analytics'
            },
            'logging': {
                'level': 'INFO',
                'format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                'file': str(self.base_path / 'logs' / 'ml_platform.log')
            }
        }

        config_file = self.base_path / 'config' / 'app_config.json'
        with open(config_file, 'w') as f:
            json.dump(app_config, f, indent=2)

        # Environment configuration
        env_config = {
            'MLFLOW_TRACKING_URI': 'sqlite:///mlflow.db',
            'MLFLOW_ARTIFACT_ROOT': str(self.base_path / 'mlflow-artifacts'),
            'REDIS_URL': 'redis://localhost:6379/0',
            'DATABASE_URL': 'sqlite:///data/databases/model_monitoring.db',
            'FEATURE_STORE_CONFIG': str(self.base_path / 'config' / 'feature_store_config.json'),
            'LOG_LEVEL': 'INFO'
        }

        env_file = self.base_path / '.env'
        with open(env_file, 'w') as f:
            for key, value in env_config.items():
                f.write(f"{key}={value}\n")

        logger.info("Configuration files created")

    def run_tests(self):
        """Run basic platform tests"""
        logger.info("Running platform tests...")

        try:
            # Test imports
            test_imports = [
                'pandas',
                'numpy',
                'scikit-learn',
                'lightgbm',
                'mlflow',
                'streamlit',
                'fastapi',
                'redis'
            ]

            for module in test_imports:
                try:
                    __import__(module)
                    logger.info(f"✓ {module} import successful")
                except ImportError as e:
                    logger.error(f"✗ {module} import failed: {e}")
                    raise

            # Test database connections
            import sqlite3
            test_db = self.base_path / 'test.db'
            conn = sqlite3.connect(test_db)
            conn.execute("CREATE TABLE test (id INTEGER)")
            conn.close()
            test_db.unlink()
            logger.info("✓ Database connectivity test passed")

            logger.info("All platform tests passed")

        except Exception as e:
            logger.error(f"Platform tests failed: {e}")
            raise

    def create_startup_scripts(self):
        """Create startup scripts for different services"""
        logger.info("Creating startup scripts...")

        # MLflow server startup script
        mlflow_script = f"""#!/bin/bash
echo "Starting MLflow server..."
cd {self.base_path}
mlflow server \\
    --backend-store-uri sqlite:///mlflow.db \\
    --default-artifact-root ./mlflow-artifacts \\
    --host 0.0.0.0 \\
    --port 5000
"""

        mlflow_script_path = self.base_path / 'scripts' / 'start_mlflow.sh'
        with open(mlflow_script_path, 'w') as f:
            f.write(mlflow_script)
        os.chmod(mlflow_script_path, 0o755)

        # ML service startup script
        ml_service_script = f"""#!/bin/bash
echo "Starting ML Service..."
cd {self.base_path}
python -m uvicorn integration.ml_service_integration:app \\
    --host 0.0.0.0 \\
    --port 8000 \\
    --workers 4
"""

        ml_service_script_path = self.base_path / 'scripts' / 'start_ml_service.sh'
        with open(ml_service_script_path, 'w') as f:
            f.write(ml_service_script)
        os.chmod(ml_service_script_path, 0o755)

        # Dashboard startup script
        dashboard_script = f"""#!/bin/bash
echo "Starting Analytics Dashboard..."
cd {self.base_path}
streamlit run dashboards/analytics_dashboard.py \\
    --server.address 0.0.0.0 \\
    --server.port 8501
"""

        dashboard_script_path = self.base_path / 'scripts' / 'start_dashboard.sh'
        with open(dashboard_script_path, 'w') as f:
            f.write(dashboard_script)
        os.chmod(dashboard_script_path, 0o755)

        # Combined startup script
        combined_script = f"""#!/bin/bash
echo "Starting GlobalTaxCalc ML Platform..."

# Start MLflow server in background
./scripts/start_mlflow.sh &
echo "MLflow server started"

# Wait for MLflow to initialize
sleep 5

# Start ML service in background
./scripts/start_ml_service.sh &
echo "ML service started"

# Start dashboard
./scripts/start_dashboard.sh &
echo "Dashboard started"

echo "All services started. Access points:"
echo "- MLflow UI: http://localhost:5000"
echo "- ML Service API: http://localhost:8000"
echo "- Analytics Dashboard: http://localhost:8501"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for user interrupt
wait
"""

        combined_script_path = self.base_path / 'scripts' / 'start_all.sh'
        with open(combined_script_path, 'w') as f:
            f.write(combined_script)
        os.chmod(combined_script_path, 0o755)

        logger.info("Startup scripts created")

    def print_next_steps(self):
        """Print next steps for the user"""
        print("\n" + "="*60)
        print("🎉 GlobalTaxCalc ML Platform Setup Complete!")
        print("="*60)
        print("\nNext Steps:")
        print("\n1. Configure external services (optional):")
        print("   - Redis: Install and start Redis server")
        print("   - Email alerts: Update monitoring_config.json with SMTP settings")

        print("\n2. Start the ML platform:")
        print(f"   cd {self.base_path}")
        print("   ./scripts/start_all.sh")

        print("\n3. Access the services:")
        print("   - MLflow UI: http://localhost:5000")
        print("   - ML Service API: http://localhost:8000")
        print("   - API Documentation: http://localhost:8000/docs")
        print("   - Analytics Dashboard: http://localhost:8501")

        print("\n4. Integration with main application:")
        print("   - Use the ML Service API endpoints in your frontend")
        print("   - Example: POST /predict/tax-savings")
        print("   - See integration/ml_service_integration.py for all endpoints")

        print("\n5. Monitoring and maintenance:")
        print("   - Monitor model performance in the dashboard")
        print("   - Check logs in the logs/ directory")
        print("   - Retrain models using MLflow experiments")

        print("\n6. Documentation:")
        print("   - API docs: http://localhost:8000/docs")
        print("   - Model documentation in models/ directory")
        print("   - Configuration files in config/ directory")

        print("\n" + "="*60)
        print("Happy ML-powered tax calculating! 🚀")
        print("="*60)


def main():
    """Main setup function"""
    print("GlobalTaxCalc ML Platform Setup")
    print("=" * 40)

    # Get setup path
    if len(sys.argv) > 1:
        setup_path = sys.argv[1]
    else:
        setup_path = os.path.dirname(os.path.abspath(__file__))

    # Run setup
    setup = MLPlatformSetup(setup_path)

    try:
        setup.run_complete_setup()
        setup.create_startup_scripts()
    except Exception as e:
        logger.error(f"Setup failed: {e}")
        print(f"\n❌ Setup failed: {e}")
        print("Please check the logs and fix any issues before retrying.")
        sys.exit(1)


if __name__ == "__main__":
    main()