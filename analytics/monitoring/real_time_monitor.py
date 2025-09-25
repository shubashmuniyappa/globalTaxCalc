"""
Real-time Monitoring System

This module provides real-time monitoring capabilities including:
- Live traffic and user activity monitoring
- Performance metrics tracking
- Anomaly detection
- Alert system
- Real-time dashboard data feeds
"""

import asyncio
import websockets
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Callable
import clickhouse_connect
import redis
from dataclasses import dataclass, asdict
import logging
from collections import deque, defaultdict
import time
import threading
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import smtplib
from email.mime.text import MimeText
from email.mime.multipart import MimeMultipart
import requests

logger = logging.getLogger(__name__)

@dataclass
class MetricSnapshot:
    """Represents a real-time metric snapshot"""
    timestamp: datetime
    metric_name: str
    value: float
    metadata: Dict[str, Any] = None

@dataclass
class AlertRule:
    """Represents an alert rule configuration"""
    name: str
    metric_name: str
    condition: str  # 'greater_than', 'less_than', 'anomaly', 'change_rate'
    threshold: float
    time_window: int  # seconds
    severity: str  # 'low', 'medium', 'high', 'critical'
    notification_channels: List[str]
    enabled: bool = True

@dataclass
class Alert:
    """Represents a triggered alert"""
    id: str
    rule_name: str
    metric_name: str
    current_value: float
    threshold: float
    severity: str
    message: str
    timestamp: datetime
    resolved: bool = False
    resolved_timestamp: Optional[datetime] = None

class RealTimeMonitor:
    """
    Real-time monitoring system for GlobalTaxCalc analytics
    """

    def __init__(self,
                 clickhouse_config: Dict[str, str],
                 redis_config: Dict[str, str],
                 notification_config: Dict[str, str] = None):
        """
        Initialize the real-time monitor

        Args:
            clickhouse_config: ClickHouse connection configuration
            redis_config: Redis connection configuration
            notification_config: Email/Slack notification configuration
        """
        self.clickhouse_config = clickhouse_config
        self.redis_config = redis_config
        self.notification_config = notification_config or {}

        # Connections
        self.clickhouse_client = None
        self.redis_client = None

        # Monitoring state
        self.is_running = False
        self.metric_buffers = defaultdict(lambda: deque(maxlen=1000))
        self.alert_rules = []
        self.active_alerts = {}
        self.anomaly_detectors = {}

        # WebSocket connections for real-time dashboards
        self.websocket_clients = set()

        # Performance tracking
        self.performance_metrics = {
            'events_processed': 0,
            'alerts_triggered': 0,
            'last_update': datetime.now()
        }

        self._setup_connections()
        self._setup_default_alert_rules()

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

            logger.info("Real-time monitor connections established successfully")

        except Exception as e:
            logger.error(f"Failed to establish connections: {e}")
            raise

    def _setup_default_alert_rules(self):
        """Setup default alert rules for common metrics"""
        default_rules = [
            AlertRule(
                name="High Error Rate",
                metric_name="error_rate",
                condition="greater_than",
                threshold=5.0,  # 5% error rate
                time_window=300,  # 5 minutes
                severity="high",
                notification_channels=["email", "slack"]
            ),
            AlertRule(
                name="Low Conversion Rate",
                metric_name="conversion_rate",
                condition="less_than",
                threshold=1.0,  # 1% conversion rate
                time_window=600,  # 10 minutes
                severity="medium",
                notification_channels=["email"]
            ),
            AlertRule(
                name="High Response Time",
                metric_name="avg_response_time",
                condition="greater_than",
                threshold=2000,  # 2 seconds
                time_window=180,  # 3 minutes
                severity="high",
                notification_channels=["email", "slack"]
            ),
            AlertRule(
                name="Traffic Anomaly",
                metric_name="traffic_volume",
                condition="anomaly",
                threshold=2.0,  # 2 standard deviations
                time_window=300,
                severity="medium",
                notification_channels=["email"]
            ),
            AlertRule(
                name="Revenue Drop",
                metric_name="revenue_rate",
                condition="change_rate",
                threshold=-20.0,  # 20% decrease
                time_window=600,
                severity="critical",
                notification_channels=["email", "slack"]
            )
        ]

        self.alert_rules.extend(default_rules)

    async def start_monitoring(self):
        """Start the real-time monitoring system"""
        if self.is_running:
            logger.warning("Monitor is already running")
            return

        self.is_running = True
        logger.info("Starting real-time monitoring system")

        # Start monitoring tasks
        tasks = [
            asyncio.create_task(self._monitor_traffic()),
            asyncio.create_task(self._monitor_performance()),
            asyncio.create_task(self._monitor_conversions()),
            asyncio.create_task(self._monitor_revenue()),
            asyncio.create_task(self._monitor_errors()),
            asyncio.create_task(self._check_alerts()),
            asyncio.create_task(self._websocket_server())
        ]

        try:
            await asyncio.gather(*tasks)
        except Exception as e:
            logger.error(f"Error in monitoring tasks: {e}")
        finally:
            self.is_running = False

    async def stop_monitoring(self):
        """Stop the real-time monitoring system"""
        self.is_running = False
        logger.info("Real-time monitoring system stopped")

    async def _monitor_traffic(self):
        """Monitor real-time traffic metrics"""
        while self.is_running:
            try:
                # Query current traffic metrics
                current_time = datetime.now()
                five_minutes_ago = current_time - timedelta(minutes=5)

                query = f"""
                SELECT
                    COUNT(*) as total_events,
                    COUNT(DISTINCT user_id) as unique_users,
                    COUNT(DISTINCT session_id) as unique_sessions,
                    AVG(session_duration) as avg_session_duration
                FROM user_events
                WHERE timestamp >= '{five_minutes_ago.isoformat()}'
                """

                result = self.clickhouse_client.query(query)
                if result.result_rows:
                    row = result.result_rows[0]

                    metrics = [
                        MetricSnapshot(current_time, "traffic_volume", row[0]),
                        MetricSnapshot(current_time, "unique_users", row[1]),
                        MetricSnapshot(current_time, "unique_sessions", row[2]),
                        MetricSnapshot(current_time, "avg_session_duration", row[3] or 0)
                    ]

                    await self._process_metrics(metrics)

                await asyncio.sleep(30)  # Check every 30 seconds

            except Exception as e:
                logger.error(f"Error monitoring traffic: {e}")
                await asyncio.sleep(60)

    async def _monitor_performance(self):
        """Monitor real-time performance metrics"""
        while self.is_running:
            try:
                current_time = datetime.now()
                five_minutes_ago = current_time - timedelta(minutes=5)

                # Query performance metrics
                query = f"""
                SELECT
                    AVG(response_time) as avg_response_time,
                    MAX(response_time) as max_response_time,
                    COUNT(CASE WHEN response_time > 2000 THEN 1 END) * 100.0 / COUNT(*) as slow_requests_pct
                FROM performance_metrics
                WHERE timestamp >= '{five_minutes_ago.isoformat()}'
                """

                result = self.clickhouse_client.query(query)
                if result.result_rows:
                    row = result.result_rows[0]

                    metrics = [
                        MetricSnapshot(current_time, "avg_response_time", row[0] or 0),
                        MetricSnapshot(current_time, "max_response_time", row[1] or 0),
                        MetricSnapshot(current_time, "slow_requests_pct", row[2] or 0)
                    ]

                    await self._process_metrics(metrics)

                await asyncio.sleep(60)  # Check every minute

            except Exception as e:
                logger.error(f"Error monitoring performance: {e}")
                await asyncio.sleep(120)

    async def _monitor_conversions(self):
        """Monitor real-time conversion metrics"""
        while self.is_running:
            try:
                current_time = datetime.now()
                ten_minutes_ago = current_time - timedelta(minutes=10)

                # Query conversion metrics
                query = f"""
                WITH funnel_data AS (
                    SELECT
                        user_id,
                        MAX(CASE WHEN event_type = 'landing' THEN 1 ELSE 0 END) as reached_landing,
                        MAX(CASE WHEN event_type = 'calculator_start' THEN 1 ELSE 0 END) as reached_calculator,
                        MAX(CASE WHEN event_type = 'signup' THEN 1 ELSE 0 END) as reached_signup,
                        MAX(CASE WHEN event_type = 'subscription' THEN 1 ELSE 0 END) as reached_subscription
                    FROM user_events
                    WHERE timestamp >= '{ten_minutes_ago.isoformat()}'
                    GROUP BY user_id
                )
                SELECT
                    SUM(reached_landing) as total_visitors,
                    SUM(reached_calculator) as calculator_starts,
                    SUM(reached_signup) as signups,
                    SUM(reached_subscription) as subscriptions,
                    CASE WHEN SUM(reached_landing) > 0
                         THEN SUM(reached_subscription) * 100.0 / SUM(reached_landing)
                         ELSE 0 END as conversion_rate
                FROM funnel_data
                """

                result = self.clickhouse_client.query(query)
                if result.result_rows:
                    row = result.result_rows[0]

                    metrics = [
                        MetricSnapshot(current_time, "total_visitors", row[0] or 0),
                        MetricSnapshot(current_time, "calculator_starts", row[1] or 0),
                        MetricSnapshot(current_time, "signups", row[2] or 0),
                        MetricSnapshot(current_time, "subscriptions", row[3] or 0),
                        MetricSnapshot(current_time, "conversion_rate", row[4] or 0)
                    ]

                    await self._process_metrics(metrics)

                await asyncio.sleep(120)  # Check every 2 minutes

            except Exception as e:
                logger.error(f"Error monitoring conversions: {e}")
                await asyncio.sleep(180)

    async def _monitor_revenue(self):
        """Monitor real-time revenue metrics"""
        while self.is_running:
            try:
                current_time = datetime.now()
                one_hour_ago = current_time - timedelta(hours=1)

                # Query revenue metrics
                query = f"""
                SELECT
                    SUM(event_value) as total_revenue,
                    COUNT(*) as revenue_events,
                    AVG(event_value) as avg_transaction_value
                FROM user_events
                WHERE event_type = 'revenue'
                AND timestamp >= '{one_hour_ago.isoformat()}'
                """

                result = self.clickhouse_client.query(query)
                if result.result_rows:
                    row = result.result_rows[0]

                    # Calculate hourly revenue rate
                    hourly_revenue = row[0] or 0

                    metrics = [
                        MetricSnapshot(current_time, "hourly_revenue", hourly_revenue),
                        MetricSnapshot(current_time, "revenue_events", row[1] or 0),
                        MetricSnapshot(current_time, "avg_transaction_value", row[2] or 0),
                        MetricSnapshot(current_time, "revenue_rate", hourly_revenue)  # For trend analysis
                    ]

                    await self._process_metrics(metrics)

                await asyncio.sleep(300)  # Check every 5 minutes

            except Exception as e:
                logger.error(f"Error monitoring revenue: {e}")
                await asyncio.sleep(360)

    async def _monitor_errors(self):
        """Monitor real-time error metrics"""
        while self.is_running:
            try:
                current_time = datetime.now()
                five_minutes_ago = current_time - timedelta(minutes=5)

                # Query error metrics
                query = f"""
                SELECT
                    COUNT(CASE WHEN event_type = 'error' THEN 1 END) as error_count,
                    COUNT(*) as total_events,
                    COUNT(CASE WHEN event_type = 'error' THEN 1 END) * 100.0 / COUNT(*) as error_rate
                FROM user_events
                WHERE timestamp >= '{five_minutes_ago.isoformat()}'
                """

                result = self.clickhouse_client.query(query)
                if result.result_rows:
                    row = result.result_rows[0]

                    metrics = [
                        MetricSnapshot(current_time, "error_count", row[0] or 0),
                        MetricSnapshot(current_time, "total_events", row[1] or 0),
                        MetricSnapshot(current_time, "error_rate", row[2] or 0)
                    ]

                    await self._process_metrics(metrics)

                await asyncio.sleep(60)  # Check every minute

            except Exception as e:
                logger.error(f"Error monitoring errors: {e}")
                await asyncio.sleep(120)

    async def _process_metrics(self, metrics: List[MetricSnapshot]):
        """Process and store metrics"""
        try:
            for metric in metrics:
                # Store in buffer for real-time analysis
                self.metric_buffers[metric.metric_name].append(metric)

                # Store in Redis for dashboard feeds
                redis_key = f"realtime_metric:{metric.metric_name}"
                metric_data = {
                    'timestamp': metric.timestamp.isoformat(),
                    'value': metric.value,
                    'metadata': metric.metadata or {}
                }

                # Store latest value
                self.redis_client.setex(redis_key, 3600, json.dumps(metric_data))

                # Store in time series (last 1000 points)
                time_series_key = f"timeseries:{metric.metric_name}"
                self.redis_client.lpush(time_series_key, json.dumps(metric_data))
                self.redis_client.ltrim(time_series_key, 0, 999)
                self.redis_client.expire(time_series_key, 3600)

            # Broadcast to WebSocket clients
            await self._broadcast_metrics(metrics)

            # Update performance tracking
            self.performance_metrics['events_processed'] += len(metrics)
            self.performance_metrics['last_update'] = datetime.now()

        except Exception as e:
            logger.error(f"Error processing metrics: {e}")

    async def _check_alerts(self):
        """Check alert rules and trigger notifications"""
        while self.is_running:
            try:
                for rule in self.alert_rules:
                    if not rule.enabled:
                        continue

                    await self._evaluate_alert_rule(rule)

                await asyncio.sleep(30)  # Check every 30 seconds

            except Exception as e:
                logger.error(f"Error checking alerts: {e}")
                await asyncio.sleep(60)

    async def _evaluate_alert_rule(self, rule: AlertRule):
        """Evaluate a single alert rule"""
        try:
            metric_buffer = self.metric_buffers[rule.metric_name]

            if not metric_buffer:
                return

            current_time = datetime.now()
            time_threshold = current_time - timedelta(seconds=rule.time_window)

            # Get recent metrics within time window
            recent_metrics = [
                m for m in metric_buffer
                if m.timestamp >= time_threshold
            ]

            if not recent_metrics:
                return

            current_value = recent_metrics[-1].value

            # Evaluate condition
            should_alert = False

            if rule.condition == "greater_than":
                should_alert = current_value > rule.threshold

            elif rule.condition == "less_than":
                should_alert = current_value < rule.threshold

            elif rule.condition == "anomaly":
                should_alert = await self._detect_anomaly(rule.metric_name, current_value, rule.threshold)

            elif rule.condition == "change_rate":
                should_alert = await self._detect_change_rate(recent_metrics, rule.threshold)

            # Handle alert
            if should_alert:
                await self._trigger_alert(rule, current_value)
            else:
                await self._resolve_alert(rule.name)

        except Exception as e:
            logger.error(f"Error evaluating alert rule {rule.name}: {e}")

    async def _detect_anomaly(self, metric_name: str, current_value: float, threshold: float) -> bool:
        """Detect anomalies using isolation forest"""
        try:
            metric_buffer = self.metric_buffers[metric_name]

            if len(metric_buffer) < 50:  # Need enough data points
                return False

            # Get historical values
            values = [m.value for m in metric_buffer]

            # Setup anomaly detector if not exists
            if metric_name not in self.anomaly_detectors:
                detector = IsolationForest(contamination=0.1, random_state=42)
                scaler = StandardScaler()

                # Fit on historical data
                scaled_values = scaler.fit_transform(np.array(values[:-1]).reshape(-1, 1))
                detector.fit(scaled_values)

                self.anomaly_detectors[metric_name] = {
                    'detector': detector,
                    'scaler': scaler
                }

            # Check current value
            detector_info = self.anomaly_detectors[metric_name]
            scaled_current = detector_info['scaler'].transform([[current_value]])
            anomaly_score = detector_info['detector'].decision_function(scaled_current)[0]

            # Lower scores indicate anomalies
            return anomaly_score < -threshold

        except Exception as e:
            logger.error(f"Error detecting anomaly for {metric_name}: {e}")
            return False

    async def _detect_change_rate(self, recent_metrics: List[MetricSnapshot], threshold: float) -> bool:
        """Detect significant change rate"""
        try:
            if len(recent_metrics) < 2:
                return False

            # Calculate percentage change from first to last metric in window
            first_value = recent_metrics[0].value
            last_value = recent_metrics[-1].value

            if first_value == 0:
                return False

            change_rate = ((last_value - first_value) / first_value) * 100

            # Check if change exceeds threshold (negative threshold for decreases)
            return change_rate <= threshold

        except Exception as e:
            logger.error(f"Error detecting change rate: {e}")
            return False

    async def _trigger_alert(self, rule: AlertRule, current_value: float):
        """Trigger an alert"""
        try:
            alert_id = f"{rule.name}_{int(time.time())}"

            # Check if similar alert is already active
            if rule.name in self.active_alerts and not self.active_alerts[rule.name].resolved:
                return  # Don't spam alerts

            alert = Alert(
                id=alert_id,
                rule_name=rule.name,
                metric_name=rule.metric_name,
                current_value=current_value,
                threshold=rule.threshold,
                severity=rule.severity,
                message=f"Alert: {rule.name} - {rule.metric_name} is {current_value:.2f} (threshold: {rule.threshold})",
                timestamp=datetime.now()
            )

            self.active_alerts[rule.name] = alert

            # Send notifications
            await self._send_notifications(alert, rule.notification_channels)

            # Store alert in Redis
            alert_data = asdict(alert)
            alert_data['timestamp'] = alert_data['timestamp'].isoformat()
            self.redis_client.setex(f"alert:{alert_id}", 86400, json.dumps(alert_data))

            # Update performance tracking
            self.performance_metrics['alerts_triggered'] += 1

            logger.warning(f"Alert triggered: {alert.message}")

        except Exception as e:
            logger.error(f"Error triggering alert: {e}")

    async def _resolve_alert(self, rule_name: str):
        """Resolve an active alert"""
        try:
            if rule_name in self.active_alerts and not self.active_alerts[rule_name].resolved:
                alert = self.active_alerts[rule_name]
                alert.resolved = True
                alert.resolved_timestamp = datetime.now()

                logger.info(f"Alert resolved: {alert.message}")

        except Exception as e:
            logger.error(f"Error resolving alert: {e}")

    async def _send_notifications(self, alert: Alert, channels: List[str]):
        """Send alert notifications"""
        for channel in channels:
            try:
                if channel == "email" and 'email' in self.notification_config:
                    await self._send_email_notification(alert)
                elif channel == "slack" and 'slack' in self.notification_config:
                    await self._send_slack_notification(alert)

            except Exception as e:
                logger.error(f"Error sending {channel} notification: {e}")

    async def _send_email_notification(self, alert: Alert):
        """Send email notification"""
        try:
            email_config = self.notification_config['email']

            msg = MimeMultipart()
            msg['From'] = email_config['from']
            msg['To'] = email_config['to']
            msg['Subject'] = f"[{alert.severity.upper()}] GlobalTaxCalc Alert: {alert.rule_name}"

            body = f"""
            Alert Details:
            - Rule: {alert.rule_name}
            - Metric: {alert.metric_name}
            - Current Value: {alert.current_value:.2f}
            - Threshold: {alert.threshold}
            - Severity: {alert.severity}
            - Time: {alert.timestamp.isoformat()}

            Message: {alert.message}
            """

            msg.attach(MimeText(body, 'plain'))

            # Send email
            server = smtplib.SMTP(email_config['smtp_server'], email_config['smtp_port'])
            server.starttls()
            server.login(email_config['username'], email_config['password'])
            server.send_message(msg)
            server.quit()

        except Exception as e:
            logger.error(f"Error sending email notification: {e}")

    async def _send_slack_notification(self, alert: Alert):
        """Send Slack notification"""
        try:
            slack_config = self.notification_config['slack']

            color = {
                'low': '#36a64f',
                'medium': '#ff9900',
                'high': '#ff0000',
                'critical': '#990000'
            }.get(alert.severity, '#36a64f')

            payload = {
                "attachments": [
                    {
                        "color": color,
                        "title": f"{alert.severity.upper()} Alert: {alert.rule_name}",
                        "text": alert.message,
                        "fields": [
                            {"title": "Metric", "value": alert.metric_name, "short": True},
                            {"title": "Current Value", "value": f"{alert.current_value:.2f}", "short": True},
                            {"title": "Threshold", "value": f"{alert.threshold}", "short": True},
                            {"title": "Time", "value": alert.timestamp.isoformat(), "short": True}
                        ]
                    }
                ]
            }

            response = requests.post(slack_config['webhook_url'], json=payload)
            response.raise_for_status()

        except Exception as e:
            logger.error(f"Error sending Slack notification: {e}")

    async def _websocket_server(self):
        """WebSocket server for real-time dashboard feeds"""
        async def handle_client(websocket, path):
            self.websocket_clients.add(websocket)
            try:
                await websocket.wait_closed()
            finally:
                self.websocket_clients.remove(websocket)

        try:
            server = await websockets.serve(handle_client, "localhost", 8765)
            logger.info("WebSocket server started on ws://localhost:8765")
            await server.wait_closed()
        except Exception as e:
            logger.error(f"WebSocket server error: {e}")

    async def _broadcast_metrics(self, metrics: List[MetricSnapshot]):
        """Broadcast metrics to WebSocket clients"""
        if not self.websocket_clients:
            return

        try:
            message = {
                'type': 'metrics_update',
                'data': [
                    {
                        'timestamp': metric.timestamp.isoformat(),
                        'metric_name': metric.metric_name,
                        'value': metric.value,
                        'metadata': metric.metadata
                    }
                    for metric in metrics
                ]
            }

            # Send to all connected clients
            disconnected_clients = set()
            for client in self.websocket_clients:
                try:
                    await client.send(json.dumps(message))
                except:
                    disconnected_clients.add(client)

            # Remove disconnected clients
            self.websocket_clients -= disconnected_clients

        except Exception as e:
            logger.error(f"Error broadcasting metrics: {e}")

    def get_metric_history(self, metric_name: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Get metric history from Redis"""
        try:
            time_series_key = f"timeseries:{metric_name}"
            data = self.redis_client.lrange(time_series_key, 0, limit - 1)

            return [json.loads(item) for item in data]

        except Exception as e:
            logger.error(f"Error getting metric history: {e}")
            return []

    def get_active_alerts(self) -> List[Dict[str, Any]]:
        """Get currently active alerts"""
        try:
            active = []
            for alert in self.active_alerts.values():
                if not alert.resolved:
                    alert_dict = asdict(alert)
                    alert_dict['timestamp'] = alert_dict['timestamp'].isoformat()
                    active.append(alert_dict)

            return active

        except Exception as e:
            logger.error(f"Error getting active alerts: {e}")
            return []

    def get_monitoring_status(self) -> Dict[str, Any]:
        """Get monitoring system status"""
        return {
            'is_running': self.is_running,
            'performance_metrics': self.performance_metrics,
            'active_alerts_count': len([a for a in self.active_alerts.values() if not a.resolved]),
            'alert_rules_count': len(self.alert_rules),
            'websocket_clients_count': len(self.websocket_clients),
            'monitored_metrics': list(self.metric_buffers.keys())
        }

    def add_alert_rule(self, rule: AlertRule):
        """Add a new alert rule"""
        self.alert_rules.append(rule)
        logger.info(f"Added alert rule: {rule.name}")

    def remove_alert_rule(self, rule_name: str):
        """Remove an alert rule"""
        self.alert_rules = [r for r in self.alert_rules if r.name != rule_name]
        logger.info(f"Removed alert rule: {rule_name}")

# Example usage
if __name__ == "__main__":
    # Configuration
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

    # Start monitoring
    monitor = RealTimeMonitor(clickhouse_config, redis_config, notification_config)
    asyncio.run(monitor.start_monitoring())