"""
System Health Monitoring Module

This module provides comprehensive system health monitoring including:
- Infrastructure monitoring (CPU, memory, disk, network)
- Application performance monitoring
- Database health checks
- Service availability monitoring
- Health score calculation
"""

import psutil
import asyncio
import time
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import clickhouse_connect
import redis
import requests
from dataclasses import dataclass, asdict
import logging
import subprocess
import socket

logger = logging.getLogger(__name__)

@dataclass
class HealthMetric:
    """Represents a health metric"""
    component: str
    metric_name: str
    value: float
    status: str  # 'healthy', 'warning', 'critical'
    threshold_warning: float
    threshold_critical: float
    timestamp: datetime
    details: Dict[str, Any] = None

@dataclass
class ServiceStatus:
    """Represents service availability status"""
    service_name: str
    url: str
    status: str  # 'up', 'down', 'degraded'
    response_time: float
    status_code: Optional[int]
    last_check: datetime
    error_message: Optional[str] = None

class SystemHealthMonitor:
    """
    Comprehensive system health monitoring for GlobalTaxCalc infrastructure
    """

    def __init__(self,
                 clickhouse_config: Dict[str, str],
                 redis_config: Dict[str, str],
                 services_config: List[Dict[str, str]] = None):
        """
        Initialize the system health monitor

        Args:
            clickhouse_config: ClickHouse connection configuration
            redis_config: Redis connection configuration
            services_config: List of services to monitor
        """
        self.clickhouse_config = clickhouse_config
        self.redis_config = redis_config
        self.services_config = services_config or []

        # Connections
        self.clickhouse_client = None
        self.redis_client = None

        # Health data
        self.health_metrics = []
        self.service_statuses = {}
        self.is_monitoring = False

        # Health thresholds
        self.thresholds = {
            'cpu_usage': {'warning': 70, 'critical': 90},
            'memory_usage': {'warning': 80, 'critical': 95},
            'disk_usage': {'warning': 80, 'critical': 95},
            'response_time': {'warning': 1000, 'critical': 5000},  # milliseconds
            'error_rate': {'warning': 5, 'critical': 10},  # percentage
            'connection_pool': {'warning': 80, 'critical': 95}  # percentage
        }

        self._setup_connections()
        self._setup_default_services()

    def _setup_connections(self):
        """Setup database and cache connections"""
        try:
            # ClickHouse connection
            self.clickhouse_client = clickhouse_connect.get_client(
                host=self.clickhouse_config['host'],
                port=self.clickhouse_config['port'],
                username=self.clickhouse_config['username'],
                password=self.clickhouse_config['password'],
                database=self.clickhouse_config['database']
            )

            # Redis connection
            self.redis_client = redis.Redis(
                host=self.redis_config['host'],
                port=self.redis_config['port'],
                password=self.redis_config.get('password'),
                decode_responses=True
            )

            logger.info("System health monitor connections established")

        except Exception as e:
            logger.error(f"Failed to establish connections: {e}")
            raise

    def _setup_default_services(self):
        """Setup default services to monitor"""
        default_services = [
            {'name': 'ClickHouse', 'url': f"http://{self.clickhouse_config['host']}:8123/ping"},
            {'name': 'Redis', 'url': f"http://{self.redis_config['host']}:6379"},
            {'name': 'Superset', 'url': 'http://localhost:8088/health'},
            {'name': 'Analytics API', 'url': 'http://localhost:8000/health'},
            {'name': 'Main Application', 'url': 'http://localhost:3000/health'}
        ]

        if not self.services_config:
            self.services_config = default_services

    async def start_health_monitoring(self):
        """Start comprehensive health monitoring"""
        if self.is_monitoring:
            logger.warning("Health monitoring is already running")
            return

        self.is_monitoring = True
        logger.info("Starting system health monitoring")

        # Start monitoring tasks
        tasks = [
            asyncio.create_task(self._monitor_system_resources()),
            asyncio.create_task(self._monitor_services()),
            asyncio.create_task(self._monitor_database_health()),
            asyncio.create_task(self._monitor_application_health()),
            asyncio.create_task(self._calculate_health_scores()),
            asyncio.create_task(self._store_health_data())
        ]

        try:
            await asyncio.gather(*tasks)
        except Exception as e:
            logger.error(f"Error in health monitoring tasks: {e}")
        finally:
            self.is_monitoring = False

    async def stop_health_monitoring(self):
        """Stop health monitoring"""
        self.is_monitoring = False
        logger.info("System health monitoring stopped")

    async def _monitor_system_resources(self):
        """Monitor system-level resources"""
        while self.is_monitoring:
            try:
                current_time = datetime.now()

                # CPU metrics
                cpu_percent = psutil.cpu_percent(interval=1)
                cpu_count = psutil.cpu_count()
                load_avg = psutil.getloadavg()[0] if hasattr(psutil, 'getloadavg') else 0

                cpu_metric = HealthMetric(
                    component='system',
                    metric_name='cpu_usage',
                    value=cpu_percent,
                    status=self._get_status(cpu_percent, 'cpu_usage'),
                    threshold_warning=self.thresholds['cpu_usage']['warning'],
                    threshold_critical=self.thresholds['cpu_usage']['critical'],
                    timestamp=current_time,
                    details={'cpu_count': cpu_count, 'load_avg': load_avg}
                )

                # Memory metrics
                memory = psutil.virtual_memory()
                memory_percent = memory.percent

                memory_metric = HealthMetric(
                    component='system',
                    metric_name='memory_usage',
                    value=memory_percent,
                    status=self._get_status(memory_percent, 'memory_usage'),
                    threshold_warning=self.thresholds['memory_usage']['warning'],
                    threshold_critical=self.thresholds['memory_usage']['critical'],
                    timestamp=current_time,
                    details={
                        'total_gb': round(memory.total / (1024**3), 2),
                        'available_gb': round(memory.available / (1024**3), 2),
                        'used_gb': round(memory.used / (1024**3), 2)
                    }
                )

                # Disk metrics
                disk_usage = psutil.disk_usage('/')
                disk_percent = (disk_usage.used / disk_usage.total) * 100

                disk_metric = HealthMetric(
                    component='system',
                    metric_name='disk_usage',
                    value=disk_percent,
                    status=self._get_status(disk_percent, 'disk_usage'),
                    threshold_warning=self.thresholds['disk_usage']['warning'],
                    threshold_critical=self.thresholds['disk_usage']['critical'],
                    timestamp=current_time,
                    details={
                        'total_gb': round(disk_usage.total / (1024**3), 2),
                        'free_gb': round(disk_usage.free / (1024**3), 2),
                        'used_gb': round(disk_usage.used / (1024**3), 2)
                    }
                )

                # Network metrics
                network_io = psutil.net_io_counters()
                network_metric = HealthMetric(
                    component='system',
                    metric_name='network_io',
                    value=0,  # This would need baseline calculation
                    status='healthy',
                    threshold_warning=0,
                    threshold_critical=0,
                    timestamp=current_time,
                    details={
                        'bytes_sent': network_io.bytes_sent,
                        'bytes_recv': network_io.bytes_recv,
                        'packets_sent': network_io.packets_sent,
                        'packets_recv': network_io.packets_recv
                    }
                )

                # Add metrics to collection
                self.health_metrics.extend([cpu_metric, memory_metric, disk_metric, network_metric])

                await asyncio.sleep(60)  # Check every minute

            except Exception as e:
                logger.error(f"Error monitoring system resources: {e}")
                await asyncio.sleep(120)

    async def _monitor_services(self):
        """Monitor service availability and response times"""
        while self.is_monitoring:
            try:
                for service_config in self.services_config:
                    service_name = service_config['name']
                    service_url = service_config['url']

                    status = await self._check_service_health(service_name, service_url)
                    self.service_statuses[service_name] = status

                await asyncio.sleep(30)  # Check every 30 seconds

            except Exception as e:
                logger.error(f"Error monitoring services: {e}")
                await asyncio.sleep(60)

    async def _check_service_health(self, service_name: str, url: str) -> ServiceStatus:
        """Check health of a single service"""
        try:
            start_time = time.time()

            # Handle different service types
            if 'redis' in service_name.lower():
                status = await self._check_redis_health()
            else:
                # HTTP-based health check
                async with asyncio.timeout(10):
                    response = requests.get(url, timeout=10)
                    response_time = (time.time() - start_time) * 1000

                    if response.status_code == 200:
                        service_status = 'up'
                    elif 200 <= response.status_code < 500:
                        service_status = 'degraded'
                    else:
                        service_status = 'down'

                    return ServiceStatus(
                        service_name=service_name,
                        url=url,
                        status=service_status,
                        response_time=response_time,
                        status_code=response.status_code,
                        last_check=datetime.now()
                    )

        except Exception as e:
            return ServiceStatus(
                service_name=service_name,
                url=url,
                status='down',
                response_time=0,
                status_code=None,
                last_check=datetime.now(),
                error_message=str(e)
            )

    async def _check_redis_health(self) -> ServiceStatus:
        """Check Redis health specifically"""
        try:
            start_time = time.time()
            ping_result = self.redis_client.ping()
            response_time = (time.time() - start_time) * 1000

            if ping_result:
                status = 'up'
            else:
                status = 'down'

            return ServiceStatus(
                service_name='Redis',
                url=f"redis://{self.redis_config['host']}:{self.redis_config['port']}",
                status=status,
                response_time=response_time,
                status_code=200 if ping_result else 500,
                last_check=datetime.now()
            )

        except Exception as e:
            return ServiceStatus(
                service_name='Redis',
                url=f"redis://{self.redis_config['host']}:{self.redis_config['port']}",
                status='down',
                response_time=0,
                status_code=500,
                last_check=datetime.now(),
                error_message=str(e)
            )

    async def _monitor_database_health(self):
        """Monitor ClickHouse database health"""
        while self.is_monitoring:
            try:
                current_time = datetime.now()

                # Check connection pool
                try:
                    # Test query performance
                    start_time = time.time()
                    result = self.clickhouse_client.query("SELECT 1")
                    query_time = (time.time() - start_time) * 1000

                    db_response_metric = HealthMetric(
                        component='database',
                        metric_name='response_time',
                        value=query_time,
                        status=self._get_status(query_time, 'response_time'),
                        threshold_warning=self.thresholds['response_time']['warning'],
                        threshold_critical=self.thresholds['response_time']['critical'],
                        timestamp=current_time,
                        details={'query': 'SELECT 1'}
                    )

                    self.health_metrics.append(db_response_metric)

                    # Check database size and table counts
                    size_query = """
                    SELECT
                        database,
                        COUNT(*) as table_count,
                        SUM(total_bytes) as total_size_bytes
                    FROM system.tables
                    WHERE database = 'analytics'
                    GROUP BY database
                    """

                    size_result = self.clickhouse_client.query(size_query)
                    if size_result.result_rows:
                        row = size_result.result_rows[0]
                        db_size_gb = row[2] / (1024**3) if row[2] else 0

                        db_size_metric = HealthMetric(
                            component='database',
                            metric_name='database_size',
                            value=db_size_gb,
                            status='healthy',  # Would need thresholds based on capacity
                            threshold_warning=100,  # 100GB warning
                            threshold_critical=500,  # 500GB critical
                            timestamp=current_time,
                            details={
                                'database': row[0],
                                'table_count': row[1],
                                'size_gb': db_size_gb
                            }
                        )

                        self.health_metrics.append(db_size_metric)

                except Exception as e:
                    # Database connection issue
                    db_error_metric = HealthMetric(
                        component='database',
                        metric_name='connection_status',
                        value=0,  # 0 = down, 1 = up
                        status='critical',
                        threshold_warning=1,
                        threshold_critical=1,
                        timestamp=current_time,
                        details={'error': str(e)}
                    )

                    self.health_metrics.append(db_error_metric)

                await asyncio.sleep(300)  # Check every 5 minutes

            except Exception as e:
                logger.error(f"Error monitoring database health: {e}")
                await asyncio.sleep(600)

    async def _monitor_application_health(self):
        """Monitor application-specific health metrics"""
        while self.is_monitoring:
            try:
                current_time = datetime.now()

                # Check recent error rates
                five_minutes_ago = current_time - timedelta(minutes=5)

                error_query = f"""
                SELECT
                    COUNT(CASE WHEN event_type = 'error' THEN 1 END) as error_count,
                    COUNT(*) as total_events,
                    COUNT(CASE WHEN event_type = 'error' THEN 1 END) * 100.0 / COUNT(*) as error_rate
                FROM user_events
                WHERE timestamp >= '{five_minutes_ago.isoformat()}'
                """

                try:
                    result = self.clickhouse_client.query(error_query)
                    if result.result_rows:
                        row = result.result_rows[0]
                        error_rate = row[2] or 0

                        error_metric = HealthMetric(
                            component='application',
                            metric_name='error_rate',
                            value=error_rate,
                            status=self._get_status(error_rate, 'error_rate'),
                            threshold_warning=self.thresholds['error_rate']['warning'],
                            threshold_critical=self.thresholds['error_rate']['critical'],
                            timestamp=current_time,
                            details={
                                'error_count': row[0],
                                'total_events': row[1],
                                'time_window_minutes': 5
                            }
                        )

                        self.health_metrics.append(error_metric)

                except Exception as e:
                    logger.error(f"Error checking application error rate: {e}")

                # Check active user sessions
                try:
                    session_query = f"""
                    SELECT COUNT(DISTINCT session_id) as active_sessions
                    FROM user_events
                    WHERE timestamp >= '{five_minutes_ago.isoformat()}'
                    """

                    result = self.clickhouse_client.query(session_query)
                    if result.result_rows:
                        active_sessions = result.result_rows[0][0] or 0

                        session_metric = HealthMetric(
                            component='application',
                            metric_name='active_sessions',
                            value=active_sessions,
                            status='healthy',  # Sessions are informational
                            threshold_warning=0,
                            threshold_critical=0,
                            timestamp=current_time,
                            details={'time_window_minutes': 5}
                        )

                        self.health_metrics.append(session_metric)

                except Exception as e:
                    logger.error(f"Error checking active sessions: {e}")

                await asyncio.sleep(120)  # Check every 2 minutes

            except Exception as e:
                logger.error(f"Error monitoring application health: {e}")
                await asyncio.sleep(240)

    async def _calculate_health_scores(self):
        """Calculate overall health scores"""
        while self.is_monitoring:
            try:
                current_time = datetime.now()
                ten_minutes_ago = current_time - timedelta(minutes=10)

                # Get recent metrics
                recent_metrics = [
                    m for m in self.health_metrics
                    if m.timestamp >= ten_minutes_ago
                ]

                if not recent_metrics:
                    await asyncio.sleep(60)
                    continue

                # Calculate component health scores
                component_scores = {}

                for component in ['system', 'database', 'application']:
                    component_metrics = [m for m in recent_metrics if m.component == component]

                    if component_metrics:
                        # Calculate weighted score based on metric criticality
                        total_score = 0
                        total_weight = 0

                        for metric in component_metrics:
                            if metric.status == 'healthy':
                                score = 100
                            elif metric.status == 'warning':
                                score = 60
                            else:  # critical
                                score = 20

                            # Weight critical metrics higher
                            weight = 3 if metric.metric_name in ['cpu_usage', 'memory_usage', 'error_rate'] else 1

                            total_score += score * weight
                            total_weight += weight

                        component_score = total_score / total_weight if total_weight > 0 else 100
                        component_scores[component] = component_score

                # Calculate overall health score
                if component_scores:
                    overall_score = sum(component_scores.values()) / len(component_scores)

                    # Store in Redis
                    health_data = {
                        'timestamp': current_time.isoformat(),
                        'overall_score': overall_score,
                        'component_scores': component_scores,
                        'service_statuses': {
                            name: {
                                'status': status.status,
                                'response_time': status.response_time
                            }
                            for name, status in self.service_statuses.items()
                        }
                    }

                    self.redis_client.setex('system_health_score', 300, json.dumps(health_data))

                await asyncio.sleep(300)  # Calculate every 5 minutes

            except Exception as e:
                logger.error(f"Error calculating health scores: {e}")
                await asyncio.sleep(600)

    async def _store_health_data(self):
        """Store health metrics in ClickHouse for historical analysis"""
        while self.is_monitoring:
            try:
                if not self.health_metrics:
                    await asyncio.sleep(60)
                    continue

                # Prepare data for insertion
                metrics_to_store = []
                current_time = datetime.now()
                five_minutes_ago = current_time - timedelta(minutes=5)

                # Get metrics from last 5 minutes that haven't been stored
                for metric in self.health_metrics:
                    if metric.timestamp >= five_minutes_ago:
                        metrics_to_store.append([
                            metric.timestamp.isoformat(),
                            metric.component,
                            metric.metric_name,
                            metric.value,
                            metric.status,
                            metric.threshold_warning,
                            metric.threshold_critical,
                            json.dumps(metric.details or {})
                        ])

                if metrics_to_store:
                    # Insert into ClickHouse
                    self.clickhouse_client.insert(
                        'health_metrics',
                        metrics_to_store,
                        column_names=[
                            'timestamp', 'component', 'metric_name', 'value',
                            'status', 'threshold_warning', 'threshold_critical', 'details'
                        ]
                    )

                    logger.info(f"Stored {len(metrics_to_store)} health metrics")

                # Clean old metrics from memory (keep last hour)
                one_hour_ago = current_time - timedelta(hours=1)
                self.health_metrics = [m for m in self.health_metrics if m.timestamp >= one_hour_ago]

                await asyncio.sleep(300)  # Store every 5 minutes

            except Exception as e:
                logger.error(f"Error storing health data: {e}")
                await asyncio.sleep(600)

    def _get_status(self, value: float, metric_type: str) -> str:
        """Determine status based on value and thresholds"""
        thresholds = self.thresholds.get(metric_type, {'warning': 80, 'critical': 95})

        if value >= thresholds['critical']:
            return 'critical'
        elif value >= thresholds['warning']:
            return 'warning'
        else:
            return 'healthy'

    def get_current_health_status(self) -> Dict[str, Any]:
        """Get current system health status"""
        try:
            # Get latest health data from Redis
            health_data = self.redis_client.get('system_health_score')

            if health_data:
                return json.loads(health_data)
            else:
                return {
                    'overall_score': 0,
                    'status': 'unknown',
                    'message': 'No health data available'
                }

        except Exception as e:
            logger.error(f"Error getting health status: {e}")
            return {
                'overall_score': 0,
                'status': 'error',
                'message': str(e)
            }

    def get_health_history(self, hours: int = 24) -> List[Dict[str, Any]]:
        """Get health metrics history"""
        try:
            start_time = datetime.now() - timedelta(hours=hours)

            query = f"""
            SELECT
                timestamp,
                component,
                metric_name,
                value,
                status,
                details
            FROM health_metrics
            WHERE timestamp >= '{start_time.isoformat()}'
            ORDER BY timestamp DESC
            LIMIT 1000
            """

            result = self.clickhouse_client.query(query)
            history = []

            for row in result.result_rows:
                history.append({
                    'timestamp': row[0],
                    'component': row[1],
                    'metric_name': row[2],
                    'value': row[3],
                    'status': row[4],
                    'details': json.loads(row[5]) if row[5] else {}
                })

            return history

        except Exception as e:
            logger.error(f"Error getting health history: {e}")
            return []

# Example usage
if __name__ == "__main__":
    clickhouse_config = {
        'host': 'localhost',
        'port': 9000,
        'username': 'default',
        'password': '',
        'database': 'analytics'
    }

    redis_config = {
        'host': 'localhost',
        'port': 6379,
        'password': None
    }

    monitor = SystemHealthMonitor(clickhouse_config, redis_config)
    asyncio.run(monitor.start_health_monitoring())