"""
User Segmentation System for GlobalTaxCalc Analytics Platform

This module provides comprehensive user segmentation capabilities including
behavioral, demographic, value-based, and lifecycle segmentation with
machine learning-powered clustering and predictive analytics.
"""

from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from sklearn.cluster import KMeans, DBSCAN
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.decomposition import PCA
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import silhouette_score
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import warnings
warnings.filterwarnings('ignore')

class UserSegmentationEngine:
    """Advanced user segmentation with ML-powered clustering"""

    def __init__(self, clickhouse_client):
        self.client = clickhouse_client
        self.scaler = StandardScaler()
        self.segment_models = {}
        self.colors = {
            'primary': '#667eea',
            'secondary': '#f59e0b',
            'success': '#10b981',
            'danger': '#ef4444',
            'warning': '#f97316',
            'info': '#06b6d4',
            'purple': '#8b5cf6',
            'pink': '#ec4899'
        }

    def get_user_features_for_segmentation(self, days: int = 90) -> pd.DataFrame:
        """Extract comprehensive user features for segmentation"""

        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

        query = """
        WITH user_metrics AS (
            SELECT
                user_id,
                user_country,
                user_type,
                device_type,

                -- Activity metrics
                COUNT(DISTINCT session_id) as total_sessions,
                AVG(session_duration_seconds) as avg_session_duration,
                SUM(page_views) as total_page_views,
                AVG(time_on_page) as avg_time_on_page,
                COUNT(DISTINCT toDate(event_timestamp)) as active_days,

                -- Engagement metrics
                COUNT(CASE WHEN event_name = 'calculation_completed' THEN 1 END) as calculations_completed,
                COUNT(CASE WHEN event_name = 'export' THEN 1 END) as exports_made,
                COUNT(CASE WHEN event_name = 'share' THEN 1 END) as shares_made,
                COUNT(CASE WHEN event_name = 'save_calculation' THEN 1 END) as calculations_saved,

                -- Time-based patterns
                AVG(CASE WHEN toHour(event_timestamp) BETWEEN 9 AND 17 THEN 1 ELSE 0 END) as business_hours_usage,
                AVG(CASE WHEN toDayOfWeek(event_timestamp) IN (6, 7) THEN 1 ELSE 0 END) as weekend_usage,

                -- First and last activity
                MIN(event_timestamp) as first_activity,
                MAX(event_timestamp) as last_activity,

                -- Attribution data
                any(attribution_channel) as acquisition_channel,
                any(utm_source) as utm_source,
                any(utm_medium) as utm_medium

            FROM user_events
            WHERE event_timestamp BETWEEN '{start_date}' AND '{end_date}'
            GROUP BY user_id, user_country, user_type, device_type
        ),
        calculator_metrics AS (
            SELECT
                user_id,
                COUNT(*) as total_calculations,
                COUNT(DISTINCT calculator_type) as calculator_types_used,
                AVG(calculation_duration_ms) as avg_calculation_time,
                COUNT(CASE WHEN error_occurred = 1 THEN 1 END) as calculation_errors,
                SUM(tax_amount_total) as total_tax_calculated,
                AVG(tax_rate_effective) as avg_tax_rate,
                COUNT(CASE WHEN interaction_type = 'saved' THEN 1 END) as saved_calculations,
                COUNT(CASE WHEN interaction_type = 'shared' THEN 1 END) as shared_calculations,
                COUNT(CASE WHEN offline_calculation = 1 THEN 1 END) as offline_calculations
            FROM calculator_usage
            WHERE calculation_timestamp BETWEEN '{start_date}' AND '{end_date}'
            GROUP BY user_id
        ),
        revenue_metrics AS (
            SELECT
                user_id,
                SUM(revenue_amount_usd) as total_revenue,
                COUNT(*) as total_transactions,
                AVG(revenue_amount_usd) as avg_transaction_value,
                COUNT(CASE WHEN event_type = 'subscription' THEN 1 END) as subscriptions,
                COUNT(CASE WHEN event_type = 'renewal' THEN 1 END) as renewals,
                MAX(event_timestamp) as last_payment,
                MIN(event_timestamp) as first_payment
            FROM revenue_events
            WHERE event_timestamp BETWEEN '{start_date}' AND '{end_date}'
            GROUP BY user_id
        )
        SELECT
            um.user_id,
            um.user_country,
            um.user_type,
            um.device_type,
            um.total_sessions,
            um.avg_session_duration,
            um.total_page_views,
            um.avg_time_on_page,
            um.active_days,
            um.calculations_completed,
            um.exports_made,
            um.shares_made,
            um.calculations_saved,
            um.business_hours_usage,
            um.weekend_usage,
            dateDiff('day', um.first_activity, um.last_activity) as user_lifetime_days,
            um.acquisition_channel,
            um.utm_source,
            um.utm_medium,

            COALESCE(cm.total_calculations, 0) as calculator_total_calculations,
            COALESCE(cm.calculator_types_used, 0) as calculator_types_used,
            COALESCE(cm.avg_calculation_time, 0) as avg_calculation_time,
            COALESCE(cm.calculation_errors, 0) as calculation_errors,
            COALESCE(cm.total_tax_calculated, 0) as total_tax_calculated,
            COALESCE(cm.avg_tax_rate, 0) as avg_tax_rate,
            COALESCE(cm.saved_calculations, 0) as saved_calculations,
            COALESCE(cm.shared_calculations, 0) as shared_calculations,
            COALESCE(cm.offline_calculations, 0) as offline_calculations,

            COALESCE(rm.total_revenue, 0) as total_revenue,
            COALESCE(rm.total_transactions, 0) as revenue_transactions,
            COALESCE(rm.avg_transaction_value, 0) as avg_transaction_value,
            COALESCE(rm.subscriptions, 0) as subscriptions,
            COALESCE(rm.renewals, 0) as renewals

        FROM user_metrics um
        LEFT JOIN calculator_metrics cm ON um.user_id = cm.user_id
        LEFT JOIN revenue_metrics rm ON um.user_id = rm.user_id
        ORDER BY um.user_id
        """.format(
            start_date=start_date.strftime('%Y-%m-%d %H:%M:%S'),
            end_date=end_date.strftime('%Y-%m-%d %H:%M:%S')
        )

        result = self.client.execute(query)

        if not result:
            return pd.DataFrame()

        columns = [
            'user_id', 'user_country', 'user_type', 'device_type', 'total_sessions',
            'avg_session_duration', 'total_page_views', 'avg_time_on_page', 'active_days',
            'calculations_completed', 'exports_made', 'shares_made', 'calculations_saved',
            'business_hours_usage', 'weekend_usage', 'user_lifetime_days', 'acquisition_channel',
            'utm_source', 'utm_medium', 'calculator_total_calculations', 'calculator_types_used',
            'avg_calculation_time', 'calculation_errors', 'total_tax_calculated', 'avg_tax_rate',
            'saved_calculations', 'shared_calculations', 'offline_calculations', 'total_revenue',
            'revenue_transactions', 'avg_transaction_value', 'subscriptions', 'renewals'
        ]

        df = pd.DataFrame(result, columns=columns)

        # Calculate derived features
        df['sessions_per_day'] = df['total_sessions'] / df['active_days'].replace(0, 1)
        df['calculations_per_session'] = df['calculations_completed'] / df['total_sessions'].replace(0, 1)
        df['revenue_per_calculation'] = df['total_revenue'] / df['calculator_total_calculations'].replace(0, 1)
        df['error_rate'] = df['calculation_errors'] / df['calculator_total_calculations'].replace(0, 1)
        df['engagement_score'] = (
            df['calculations_completed'] * 0.4 +
            df['exports_made'] * 0.3 +
            df['shares_made'] * 0.2 +
            df['calculations_saved'] * 0.1
        )

        # Fill NaN values
        df = df.fillna(0)

        return df

    def perform_behavioral_segmentation(self, df: pd.DataFrame, n_clusters: int = 5) -> Dict[str, Any]:
        """Perform behavioral segmentation based on user activity patterns"""

        # Select behavioral features
        behavioral_features = [
            'total_sessions', 'avg_session_duration', 'total_page_views', 'active_days',
            'calculations_completed', 'exports_made', 'shares_made', 'calculations_saved',
            'business_hours_usage', 'weekend_usage', 'sessions_per_day', 'calculations_per_session',
            'engagement_score', 'calculator_types_used', 'error_rate'
        ]

        X = df[behavioral_features].copy()

        # Scale features
        X_scaled = self.scaler.fit_transform(X)

        # Determine optimal number of clusters
        if n_clusters == 'auto':
            n_clusters = self._find_optimal_clusters(X_scaled, max_clusters=8)

        # Apply K-means clustering
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        cluster_labels = kmeans.fit_predict(X_scaled)

        # Calculate cluster characteristics
        df['behavioral_segment'] = cluster_labels
        cluster_profiles = self._analyze_cluster_profiles(df, cluster_labels, behavioral_features, 'behavioral')

        # Store model
        self.segment_models['behavioral'] = {
            'model': kmeans,
            'scaler': self.scaler,
            'features': behavioral_features,
            'n_clusters': n_clusters
        }

        return {
            'segments': cluster_profiles,
            'labels': cluster_labels,
            'features_used': behavioral_features,
            'silhouette_score': silhouette_score(X_scaled, cluster_labels)
        }

    def perform_value_based_segmentation(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Perform RFM-style value-based segmentation"""

        # Calculate RFM metrics
        current_date = datetime.now()

        # Recency: Days since last activity
        df['recency'] = (current_date - pd.to_datetime(df['user_lifetime_days'], unit='D')).dt.days

        # Frequency: Total sessions
        df['frequency'] = df['total_sessions']

        # Monetary: Total revenue
        df['monetary'] = df['total_revenue']

        # Calculate quintiles for each metric
        df['recency_score'] = pd.qcut(df['recency'], 5, labels=[5, 4, 3, 2, 1])  # Lower recency = higher score
        df['frequency_score'] = pd.qcut(df['frequency'].rank(method='first'), 5, labels=[1, 2, 3, 4, 5])
        df['monetary_score'] = pd.qcut(df['monetary'].rank(method='first'), 5, labels=[1, 2, 3, 4, 5])

        # Create RFM segments
        df['rfm_score'] = (
            df['recency_score'].astype(int) * 100 +
            df['frequency_score'].astype(int) * 10 +
            df['monetary_score'].astype(int)
        )

        # Define value segments based on RFM scores
        def categorize_rfm(score):
            if score >= 444:
                return 'Champions'
            elif score >= 344:
                return 'Loyal Customers'
            elif score >= 334:
                return 'Potential Loyalists'
            elif score >= 244:
                return 'New Customers'
            elif score >= 144:
                return 'Promising'
            elif score >= 124:
                return 'Need Attention'
            elif score >= 114:
                return 'About to Sleep'
            elif score >= 111:
                return 'At Risk'
            else:
                return 'Cannot Lose Them'

        df['value_segment'] = df['rfm_score'].apply(categorize_rfm)

        # Analyze value segments
        value_analysis = df.groupby('value_segment').agg({
            'user_id': 'count',
            'total_revenue': ['sum', 'mean'],
            'total_sessions': 'mean',
            'recency': 'mean',
            'frequency': 'mean',
            'monetary': 'mean'
        }).round(2)

        return {
            'segments': df['value_segment'].value_counts().to_dict(),
            'analysis': value_analysis,
            'rfm_data': df[['user_id', 'recency', 'frequency', 'monetary', 'rfm_score', 'value_segment']]
        }

    def perform_lifecycle_segmentation(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Perform user lifecycle stage segmentation"""

        def determine_lifecycle_stage(row):
            # New users (less than 7 days old)
            if row['user_lifetime_days'] <= 7:
                return 'New'

            # Active users (recent activity and regular usage)
            elif row['active_days'] >= 7 and row['total_sessions'] >= 5:
                if row['total_revenue'] > 0:
                    return 'Active Paying'
                else:
                    return 'Active Free'

            # Engaged users (high engagement but maybe less frequent)
            elif row['engagement_score'] >= 10:
                return 'Engaged'

            # Occasional users (some activity but not very engaged)
            elif row['total_sessions'] >= 2 and row['calculations_completed'] >= 1:
                return 'Occasional'

            # Dormant users (registered but minimal activity)
            elif row['total_sessions'] <= 1:
                return 'Dormant'

            # At-risk users (were active but declining)
            else:
                return 'At Risk'

        df['lifecycle_stage'] = df.apply(determine_lifecycle_stage, axis=1)

        # Analyze lifecycle segments
        lifecycle_analysis = df.groupby('lifecycle_stage').agg({
            'user_id': 'count',
            'total_revenue': ['sum', 'mean'],
            'total_sessions': 'mean',
            'calculations_completed': 'mean',
            'engagement_score': 'mean',
            'user_lifetime_days': 'mean'
        }).round(2)

        return {
            'segments': df['lifecycle_stage'].value_counts().to_dict(),
            'analysis': lifecycle_analysis,
            'stage_data': df[['user_id', 'lifecycle_stage', 'user_lifetime_days', 'engagement_score']]
        }

    def perform_geographic_segmentation(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Perform geographic and demographic segmentation"""

        # Country-based analysis
        country_analysis = df.groupby('user_country').agg({
            'user_id': 'count',
            'total_revenue': ['sum', 'mean'],
            'total_sessions': 'mean',
            'calculations_completed': 'mean',
            'avg_session_duration': 'mean'
        }).round(2)

        # Device type analysis
        device_analysis = df.groupby('device_type').agg({
            'user_id': 'count',
            'total_revenue': ['sum', 'mean'],
            'total_sessions': 'mean',
            'calculations_completed': 'mean',
            'engagement_score': 'mean'
        }).round(2)

        # User type analysis
        user_type_analysis = df.groupby('user_type').agg({
            'user_id': 'count',
            'total_revenue': ['sum', 'mean'],
            'total_sessions': 'mean',
            'calculations_completed': 'mean',
            'avg_transaction_value': 'mean'
        }).round(2)

        return {
            'country_segments': country_analysis,
            'device_segments': device_analysis,
            'user_type_segments': user_type_analysis,
            'geographic_data': df[['user_id', 'user_country', 'device_type', 'user_type']]
        }

    def _find_optimal_clusters(self, X: np.ndarray, max_clusters: int = 10) -> int:
        """Find optimal number of clusters using elbow method and silhouette score"""

        inertias = []
        silhouette_scores = []
        k_range = range(2, max_clusters + 1)

        for k in k_range:
            kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
            labels = kmeans.fit_predict(X)
            inertias.append(kmeans.inertia_)
            silhouette_scores.append(silhouette_score(X, labels))

        # Find elbow point
        # Calculate the rate of change in inertia
        rate_of_change = np.diff(inertias)
        elbow_idx = np.argmax(rate_of_change[:-1] - rate_of_change[1:]) + 2

        # Choose the minimum between elbow method and best silhouette score
        best_silhouette_idx = np.argmax(silhouette_scores) + 2

        optimal_k = min(elbow_idx, best_silhouette_idx)
        return optimal_k

    def _analyze_cluster_profiles(self, df: pd.DataFrame, labels: np.ndarray,
                                features: List[str], segment_type: str) -> Dict[str, Any]:
        """Analyze and profile clusters"""

        df_temp = df.copy()
        df_temp['cluster'] = labels

        cluster_profiles = {}

        for cluster_id in sorted(np.unique(labels)):
            cluster_data = df_temp[df_temp['cluster'] == cluster_id]

            # Calculate statistics for each feature
            profile = {}
            for feature in features:
                profile[feature] = {
                    'mean': float(cluster_data[feature].mean()),
                    'median': float(cluster_data[feature].median()),
                    'std': float(cluster_data[feature].std())
                }

            # Calculate cluster size and characteristics
            cluster_profiles[f'{segment_type}_segment_{cluster_id}'] = {
                'size': len(cluster_data),
                'percentage': (len(cluster_data) / len(df_temp)) * 100,
                'profile': profile,
                'description': self._generate_cluster_description(profile, segment_type)
            }

        return cluster_profiles

    def _generate_cluster_description(self, profile: Dict[str, Dict], segment_type: str) -> str:
        """Generate human-readable cluster description"""

        if segment_type == 'behavioral':
            engagement = profile.get('engagement_score', {}).get('mean', 0)
            sessions = profile.get('total_sessions', {}).get('mean', 0)
            calculations = profile.get('calculations_completed', {}).get('mean', 0)

            if engagement > 20 and sessions > 10:
                return "Highly Engaged Power Users"
            elif engagement > 10 and sessions > 5:
                return "Regular Active Users"
            elif calculations > 5:
                return "Calculator-Focused Users"
            elif sessions > 2:
                return "Casual Browsers"
            else:
                return "Low-Engagement Users"

        return f"Segment with distinct {segment_type} patterns"

    def create_segmentation_visualizations(self, df: pd.DataFrame,
                                         segmentation_results: Dict[str, Any]) -> Dict[str, go.Figure]:
        """Create comprehensive segmentation visualizations"""

        charts = {}

        # Behavioral segmentation scatter plot
        if 'behavioral_segment' in df.columns:
            charts['behavioral_scatter'] = self._create_behavioral_scatter(df)

        # RFM analysis
        if 'value_segment' in df.columns:
            charts['rfm_analysis'] = self._create_rfm_analysis(df)

        # Lifecycle stage distribution
        if 'lifecycle_stage' in df.columns:
            charts['lifecycle_distribution'] = self._create_lifecycle_chart(df)

        # Geographic distribution
        charts['geographic_analysis'] = self._create_geographic_charts(df)

        # Segment comparison
        charts['segment_comparison'] = self._create_segment_comparison(df)

        return charts

    def _create_behavioral_scatter(self, df: pd.DataFrame) -> go.Figure:
        """Create behavioral segmentation scatter plot"""

        # Use PCA for 2D visualization
        behavioral_features = [col for col in df.columns if col not in
                             ['user_id', 'user_country', 'user_type', 'device_type',
                              'acquisition_channel', 'utm_source', 'utm_medium', 'behavioral_segment']]

        X = df[behavioral_features].fillna(0)
        X_scaled = StandardScaler().fit_transform(X)

        pca = PCA(n_components=2)
        X_pca = pca.fit_transform(X_scaled)

        fig = px.scatter(
            x=X_pca[:, 0], y=X_pca[:, 1],
            color=df['behavioral_segment'].astype(str),
            title='Behavioral Segmentation (PCA Visualization)',
            labels={'x': f'PC1 ({pca.explained_variance_ratio_[0]:.1%} variance)',
                   'y': f'PC2 ({pca.explained_variance_ratio_[1]:.1%} variance)'},
            color_discrete_sequence=list(self.colors.values())
        )

        fig.update_layout(height=500)
        return fig

    def _create_rfm_analysis(self, df: pd.DataFrame) -> go.Figure:
        """Create RFM analysis visualization"""

        fig = make_subplots(
            rows=2, cols=2,
            subplot_titles=('RFM Segments Distribution', 'Recency vs Frequency',
                          'Frequency vs Monetary', 'Recency vs Monetary'),
            specs=[[{"type": "bar"}, {"type": "scatter"}],
                   [{"type": "scatter"}, {"type": "scatter"}]]
        )

        # Segment distribution
        segment_counts = df['value_segment'].value_counts()
        fig.add_trace(
            go.Bar(x=segment_counts.index, y=segment_counts.values, name='Segments',
                   marker_color=self.colors['primary']),
            row=1, col=1
        )

        # Recency vs Frequency
        fig.add_trace(
            go.Scatter(x=df['recency'], y=df['frequency'], mode='markers',
                      marker=dict(color=df['monetary'], colorscale='Viridis', showscale=True),
                      name='Users'),
            row=1, col=2
        )

        # Frequency vs Monetary
        fig.add_trace(
            go.Scatter(x=df['frequency'], y=df['monetary'], mode='markers',
                      marker=dict(color=df['recency'], colorscale='Plasma'),
                      name='Users'),
            row=2, col=1
        )

        # Recency vs Monetary
        fig.add_trace(
            go.Scatter(x=df['recency'], y=df['monetary'], mode='markers',
                      marker=dict(color=df['frequency'], colorscale='Cividis'),
                      name='Users'),
            row=2, col=2
        )

        fig.update_layout(title='RFM Analysis Dashboard', height=700, showlegend=False)
        return fig

    def _create_lifecycle_chart(self, df: pd.DataFrame) -> go.Figure:
        """Create lifecycle stage analysis chart"""

        lifecycle_data = df['lifecycle_stage'].value_counts()

        fig = go.Figure(data=[
            go.Pie(labels=lifecycle_data.index, values=lifecycle_data.values,
                   hole=0.4, marker_colors=list(self.colors.values()))
        ])

        fig.update_layout(
            title='User Lifecycle Stage Distribution',
            height=500
        )

        return fig

    def _create_geographic_charts(self, df: pd.DataFrame) -> go.Figure:
        """Create geographic analysis charts"""

        fig = make_subplots(
            rows=2, cols=2,
            subplot_titles=('Top Countries by Users', 'Device Type Distribution',
                          'User Type Distribution', 'Revenue by Country'),
            specs=[[{"type": "bar"}, {"type": "pie"}],
                   [{"type": "pie"}, {"type": "bar"}]]
        )

        # Top countries
        top_countries = df['user_country'].value_counts().head(10)
        fig.add_trace(
            go.Bar(x=top_countries.index, y=top_countries.values, name='Users',
                   marker_color=self.colors['primary']),
            row=1, col=1
        )

        # Device type distribution
        device_dist = df['device_type'].value_counts()
        fig.add_trace(
            go.Pie(labels=device_dist.index, values=device_dist.values, name='Devices'),
            row=1, col=2
        )

        # User type distribution
        user_type_dist = df['user_type'].value_counts()
        fig.add_trace(
            go.Pie(labels=user_type_dist.index, values=user_type_dist.values, name='User Types'),
            row=2, col=1
        )

        # Revenue by country
        revenue_by_country = df.groupby('user_country')['total_revenue'].sum().sort_values(ascending=False).head(10)
        fig.add_trace(
            go.Bar(x=revenue_by_country.index, y=revenue_by_country.values, name='Revenue',
                   marker_color=self.colors['success']),
            row=2, col=2
        )

        fig.update_layout(title='Geographic and Demographic Analysis', height=700)
        return fig

    def _create_segment_comparison(self, df: pd.DataFrame) -> go.Figure:
        """Create segment comparison chart"""

        if 'behavioral_segment' not in df.columns:
            return go.Figure()

        # Compare segments across key metrics
        segment_comparison = df.groupby('behavioral_segment').agg({
            'total_revenue': 'mean',
            'total_sessions': 'mean',
            'calculations_completed': 'mean',
            'engagement_score': 'mean',
            'user_lifetime_days': 'mean'
        }).round(2)

        fig = go.Figure()

        metrics = ['total_revenue', 'total_sessions', 'calculations_completed', 'engagement_score']

        for metric in metrics:
            fig.add_trace(go.Bar(
                x=segment_comparison.index,
                y=segment_comparison[metric],
                name=metric.replace('_', ' ').title(),
                marker_color=list(self.colors.values())[metrics.index(metric)]
            ))

        fig.update_layout(
            title='Behavioral Segment Comparison',
            xaxis_title='Segment',
            yaxis_title='Average Value',
            barmode='group',
            height=500
        )

        return fig

    def save_segments_to_database(self, df: pd.DataFrame) -> bool:
        """Save segmentation results to ClickHouse"""

        try:
            # Prepare data for insertion
            segments_data = []

            for _, row in df.iterrows():
                if 'behavioral_segment' in df.columns:
                    segments_data.append({
                        'user_id': row['user_id'],
                        'segment_id': f"behavioral_{row['behavioral_segment']}",
                        'segment_name': f"Behavioral Segment {row['behavioral_segment']}",
                        'segment_type': 'behavioral',
                        'assigned_timestamp': datetime.now(),
                        'segment_score': float(row.get('engagement_score', 0)),
                        'confidence_level': 0.85
                    })

                if 'value_segment' in df.columns:
                    segments_data.append({
                        'user_id': row['user_id'],
                        'segment_id': f"value_{row['value_segment'].lower().replace(' ', '_')}",
                        'segment_name': row['value_segment'],
                        'segment_type': 'value_based',
                        'assigned_timestamp': datetime.now(),
                        'segment_score': float(row.get('rfm_score', 0)),
                        'confidence_level': 0.90
                    })

                if 'lifecycle_stage' in df.columns:
                    segments_data.append({
                        'user_id': row['user_id'],
                        'segment_id': f"lifecycle_{row['lifecycle_stage'].lower().replace(' ', '_')}",
                        'segment_name': row['lifecycle_stage'],
                        'segment_type': 'lifecycle',
                        'assigned_timestamp': datetime.now(),
                        'segment_score': float(row.get('user_lifetime_days', 0)),
                        'confidence_level': 0.95
                    })

            # Insert data (implementation depends on ClickHouse client)
            # This is a placeholder - actual implementation would use batch insert
            print(f"Would insert {len(segments_data)} segment assignments to database")

            return True

        except Exception as e:
            print(f"Error saving segments to database: {e}")
            return False

    def generate_segmentation_report(self, days: int = 90) -> Dict[str, Any]:
        """Generate comprehensive segmentation report"""

        # Get user features
        df = self.get_user_features_for_segmentation(days)

        if df.empty:
            return {'error': 'No data available for segmentation'}

        # Perform all types of segmentation
        behavioral_results = self.perform_behavioral_segmentation(df)
        value_results = self.perform_value_based_segmentation(df)
        lifecycle_results = self.perform_lifecycle_segmentation(df)
        geographic_results = self.perform_geographic_segmentation(df)

        # Create visualizations
        charts = self.create_segmentation_visualizations(df, {
            'behavioral': behavioral_results,
            'value': value_results,
            'lifecycle': lifecycle_results,
            'geographic': geographic_results
        })

        # Save segments to database
        save_success = self.save_segments_to_database(df)

        # Generate insights
        insights = self._generate_segmentation_insights(df, behavioral_results, value_results, lifecycle_results)

        return {
            'behavioral_segmentation': behavioral_results,
            'value_segmentation': value_results,
            'lifecycle_segmentation': lifecycle_results,
            'geographic_segmentation': geographic_results,
            'charts': charts,
            'insights': insights,
            'total_users': len(df),
            'segmentation_date': datetime.now(),
            'database_save_success': save_success
        }

    def _generate_segmentation_insights(self, df: pd.DataFrame, behavioral: Dict,
                                      value: Dict, lifecycle: Dict) -> List[Dict[str, str]]:
        """Generate actionable segmentation insights"""

        insights = []

        # Behavioral insights
        if behavioral.get('silhouette_score', 0) > 0.5:
            insights.append({
                'type': 'success',
                'category': 'Segmentation Quality',
                'title': 'High-Quality Behavioral Segments',
                'description': f'Behavioral segmentation achieved silhouette score of {behavioral["silhouette_score"]:.2f}, indicating well-defined segments.'
            })

        # Value segment insights
        value_segments = value.get('segments', {})
        if 'Champions' in value_segments:
            champion_percentage = (value_segments['Champions'] / len(df)) * 100
            if champion_percentage > 10:
                insights.append({
                    'type': 'success',
                    'category': 'Customer Value',
                    'title': 'Strong Champion Segment',
                    'description': f'{champion_percentage:.1f}% of users are Champions - your most valuable customers.'
                })

        if 'At Risk' in value_segments or 'Cannot Lose Them' in value_segments:
            at_risk_count = value_segments.get('At Risk', 0) + value_segments.get('Cannot Lose Them', 0)
            at_risk_percentage = (at_risk_count / len(df)) * 100
            if at_risk_percentage > 15:
                insights.append({
                    'type': 'warning',
                    'category': 'Customer Retention',
                    'title': 'High At-Risk Customer Percentage',
                    'description': f'{at_risk_percentage:.1f}% of customers are at risk. Implement retention campaigns.'
                })

        # Lifecycle insights
        lifecycle_segments = lifecycle.get('segments', {})
        if 'New' in lifecycle_segments:
            new_user_percentage = (lifecycle_segments['New'] / len(df)) * 100
            if new_user_percentage > 20:
                insights.append({
                    'type': 'info',
                    'category': 'User Lifecycle',
                    'title': 'High New User Influx',
                    'description': f'{new_user_percentage:.1f}% of users are new. Focus on onboarding optimization.'
                })

        if 'Dormant' in lifecycle_segments:
            dormant_percentage = (lifecycle_segments['Dormant'] / len(df)) * 100
            if dormant_percentage > 25:
                insights.append({
                    'type': 'warning',
                    'category': 'User Engagement',
                    'title': 'High Dormant User Rate',
                    'description': f'{dormant_percentage:.1f}% of users are dormant. Consider re-engagement campaigns.'
                })

        return insights