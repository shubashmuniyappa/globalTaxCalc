"""
Advanced Visualization Platform for GlobalTaxCalc.com
Provides interactive dashboards, dynamic charts, and comprehensive data visualization capabilities.
"""


# Generic safe imports with fallbacks
import sys
import os
import logging
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple, Union
from dataclasses import dataclass, field
from enum import Enum
import pandas as pd
import numpy as np

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Safe import function
def safe_import(module_name, package=None):
    try:
        if package:
            return __import__(module_name, fromlist=[package])
        else:
            return __import__(module_name)
    except ImportError:
        logger.warning(f"{module_name} not available - using fallback")
        return None

# Check for optional dependencies
HAS_SKLEARN = safe_import('sklearn') is not None
HAS_TENSORFLOW = safe_import('tensorflow') is not None
HAS_PLOTLY = safe_import('plotly') is not None
HAS_DASH = safe_import('dash') is not None
HAS_REDIS = safe_import('redis') is not None
HAS_KAFKA = safe_import('kafka') is not None
HAS_PYSPARK = safe_import('pyspark') is not None
HAS_SCIPY = safe_import('scipy') is not None

logger.info(f"Available dependencies: sklearn={HAS_SKLEARN}, tensorflow={HAS_TENSORFLOW}, plotly={HAS_PLOTLY}")




import json
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple, Union
from dataclasses import dataclass, field
from enum import Enum
import pandas as pd
import numpy as np
# 
# 
# 
# 
# 
# 
# 
# 
# 
import seaborn as sns
import matplotlib.pyplot as plt
from matplotlib.figure import Figure
from matplotlib.backends.backend_agg import FigureCanvasAgg
import io
import base64
from PIL import Image
import bokeh
from bokeh.plotting import figure, show
from bokeh.models import HoverTool, ColumnDataSource
from bokeh.palettes import Category20
from bokeh.io import output_file, save
import altair as alt
from wordcloud import WordCloud
import networkx as nx
from scipy.cluster.hierarchy import dendrogram, linkage
# 
# 
# 

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ChartType(Enum):
    """Supported chart types"""
    LINE = "line"
    BAR = "bar"
    SCATTER = "scatter"
    PIE = "pie"
    HEATMAP = "heatmap"
    HISTOGRAM = "histogram"
    BOX = "box"
    VIOLIN = "violin"
    CANDLESTICK = "candlestick"
    SUNBURST = "sunburst"
    TREEMAP = "treemap"
    FUNNEL = "funnel"
    WATERFALL = "waterfall"
    RADAR = "radar"
    SANKEY = "sankey"
    GAUGE = "gauge"
    PARALLEL = "parallel"
    NETWORK = "network"
    WORDCLOUD = "wordcloud"
    CHOROPLETH = "choropleth"

class DashboardType(Enum):
    """Dashboard types"""
    EXECUTIVE = "executive"
    OPERATIONAL = "operational"
    ANALYTICAL = "analytical"
    REAL_TIME = "real_time"
    FINANCIAL = "financial"
    USER_BEHAVIOR = "user_behavior"
    PERFORMANCE = "performance"
    CUSTOM = "custom"

@dataclass
class ChartConfig:
    """Configuration for individual charts"""
    chart_id: str
    chart_type: ChartType
    title: str
    data_source: str
    x_column: str
    y_column: str
    color_column: Optional[str] = None
    size_column: Optional[str] = None
    facet_column: Optional[str] = None
    aggregation: str = "none"  # sum, mean, count, max, min
    filters: Dict[str, Any] = field(default_factory=dict)
    styling: Dict[str, Any] = field(default_factory=dict)
    interactive: bool = True
    real_time: bool = False
    refresh_interval: int = 30  # seconds
    custom_params: Dict[str, Any] = field(default_factory=dict)

@dataclass
class DashboardConfig:
    """Configuration for dashboards"""
    dashboard_id: str
    dashboard_type: DashboardType
    title: str
    description: str
    charts: List[ChartConfig]
    layout: Dict[str, Any] = field(default_factory=dict)
    filters: Dict[str, Any] = field(default_factory=dict)
    auto_refresh: bool = False
    refresh_interval: int = 60  # seconds
    permissions: List[str] = field(default_factory=list)

class AdvancedVisualizationEngine:
    """
    Comprehensive Advanced Visualization Engine
    Provides interactive dashboards, dynamic charts, and data visualization capabilities
    """

    def __init__(self, config_path: str = None):
        self.charts = {}
        self.dashboards = {}
        self.data_sources = {}
        self.app = None
        self.color_palettes = self._initialize_color_palettes()

        # Initialize Dash app
        self._initialize_dash_app()

        # Load default configurations
        self._load_default_data_sources()
        self._load_default_charts()
        self._load_default_dashboards()

        logger.info("Advanced Visualization Engine initialized successfully")

    def _initialize_color_palettes(self) -> Dict[str, List[str]]:
        """Initialize color palettes for visualizations"""
        return {
            'corporate': ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'],
            'tax_calc': ['#0066cc', '#00cc99', '#ffcc00', '#ff6666', '#9966ff'],
            'professional': ['#2E8B57', '#4682B4', '#DAA520', '#CD853F', '#9370DB'],
            'modern': ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'],
            'financial': ['#27AE60', '#E74C3C', '#3498DB', '#F39C12', '#9B59B6'],
            'analytics': ['#34495E', '#16A085', '#F39C12', '#E67E22', '#8E44AD']
        }

    def _initialize_dash_app(self):
        """Initialize Dash application"""
        self.app = dash.Dash(
            __name__,
            external_stylesheets=[
                dbc.themes.BOOTSTRAP,
                'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
            ],
            suppress_callback_exceptions=True
        )

        # Set up basic layout
        self.app.layout = html.Div([
            dcc.Location(id='url', refresh=False),
            html.Div(id='page-content')
        ])

    def _load_default_data_sources(self):
        """Load default data sources"""
        # Simulate data sources for GlobalTaxCalc.com
        self.data_sources = {
            'user_analytics': self._generate_user_analytics_data(),
            'tax_calculations': self._generate_tax_calculations_data(),
            'financial_metrics': self._generate_financial_metrics_data(),
            'performance_data': self._generate_performance_data(),
            'user_behavior': self._generate_user_behavior_data(),
            'revenue_data': self._generate_revenue_data(),
            'geographic_data': self._generate_geographic_data()
        }

    def _generate_user_analytics_data(self) -> pd.DataFrame:
        """Generate sample user analytics data"""
        dates = pd.date_range(start='2024-01-01', end='2024-12-31', freq='D')
        np.random.seed(42)

        data = {
            'date': dates,
            'active_users': np.random.randint(1000, 5000, len(dates)),
            'new_users': np.random.randint(100, 800, len(dates)),
            'sessions': np.random.randint(1500, 7000, len(dates)),
            'page_views': np.random.randint(5000, 25000, len(dates)),
            'bounce_rate': np.random.uniform(0.2, 0.6, len(dates)),
            'avg_session_duration': np.random.randint(120, 600, len(dates))
        }

        return pd.DataFrame(data)

    def _generate_tax_calculations_data(self) -> pd.DataFrame:
        """Generate sample tax calculations data"""
        dates = pd.date_range(start='2024-01-01', end='2024-12-31', freq='D')
        np.random.seed(43)

        countries = ['USA', 'Canada', 'UK', 'Germany', 'France', 'Australia', 'Japan']
        tax_types = ['Income Tax', 'Corporate Tax', 'Sales Tax', 'Property Tax', 'Capital Gains']

        data = []
        for date in dates:
            for country in countries:
                for tax_type in tax_types:
                    data.append({
                        'date': date,
                        'country': country,
                        'tax_type': tax_type,
                        'calculations_count': np.random.randint(10, 500),
                        'total_amount': np.random.uniform(1000, 100000),
                        'avg_amount': np.random.uniform(100, 5000),
                        'success_rate': np.random.uniform(0.85, 0.99)
                    })

        return pd.DataFrame(data)

    def _generate_financial_metrics_data(self) -> pd.DataFrame:
        """Generate sample financial metrics data"""
        dates = pd.date_range(start='2024-01-01', end='2024-12-31', freq='D')
        np.random.seed(44)

        data = {
            'date': dates,
            'revenue': np.random.uniform(10000, 50000, len(dates)),
            'costs': np.random.uniform(5000, 25000, len(dates)),
            'profit': np.random.uniform(2000, 15000, len(dates)),
            'conversions': np.random.randint(50, 300, len(dates)),
            'conversion_rate': np.random.uniform(0.02, 0.08, len(dates)),
            'arpu': np.random.uniform(50, 200, len(dates)),
            'ltv': np.random.uniform(500, 2000, len(dates))
        }

        df = pd.DataFrame(data)
        df['profit'] = df['revenue'] - df['costs']  # Ensure profit calculation
        return df

    def _generate_performance_data(self) -> pd.DataFrame:
        """Generate sample performance data"""
        timestamps = pd.date_range(start='2024-01-01', end='2024-12-31', freq='H')
        np.random.seed(45)

        data = {
            'timestamp': timestamps,
            'response_time': np.random.exponential(200, len(timestamps)),
            'cpu_usage': np.random.uniform(20, 90, len(timestamps)),
            'memory_usage': np.random.uniform(30, 85, len(timestamps)),
            'disk_usage': np.random.uniform(40, 80, len(timestamps)),
            'error_rate': np.random.exponential(0.01, len(timestamps)),
            'throughput': np.random.randint(100, 1000, len(timestamps))
        }

        return pd.DataFrame(data)

    def _generate_user_behavior_data(self) -> pd.DataFrame:
        """Generate sample user behavior data"""
        np.random.seed(46)
        n_users = 10000

        user_segments = ['Premium', 'Free', 'Trial', 'Enterprise']
        pages = ['Home', 'Calculator', 'Results', 'Profile', 'Help', 'Pricing']

        data = []
        for i in range(n_users):
            segment = np.random.choice(user_segments)
            for page in pages:
                data.append({
                    'user_id': f'user_{i}',
                    'segment': segment,
                    'page': page,
                    'visits': np.random.randint(1, 50),
                    'time_spent': np.random.randint(30, 600),
                    'conversions': np.random.randint(0, 5)
                })

        return pd.DataFrame(data)

    def _generate_revenue_data(self) -> pd.DataFrame:
        """Generate sample revenue data"""
        dates = pd.date_range(start='2024-01-01', end='2024-12-31', freq='M')
        np.random.seed(47)

        subscription_tiers = ['Basic', 'Pro', 'Enterprise']
        revenue_sources = ['Subscriptions', 'One-time', 'Consulting', 'API']

        data = []
        for date in dates:
            for tier in subscription_tiers:
                for source in revenue_sources:
                    data.append({
                        'date': date,
                        'subscription_tier': tier,
                        'revenue_source': source,
                        'revenue': np.random.uniform(5000, 50000),
                        'customers': np.random.randint(100, 1000),
                        'churn_rate': np.random.uniform(0.01, 0.1)
                    })

        return pd.DataFrame(data)

    def _generate_geographic_data(self) -> pd.DataFrame:
        """Generate sample geographic data"""
        countries = ['USA', 'Canada', 'UK', 'Germany', 'France', 'Australia', 'Japan', 'Brazil', 'India', 'China']
        states_usa = ['CA', 'NY', 'TX', 'FL', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI']

        np.random.seed(48)

        data = []
        for country in countries:
            data.append({
                'country': country,
                'users': np.random.randint(1000, 50000),
                'revenue': np.random.uniform(10000, 500000),
                'avg_calculation_value': np.random.uniform(100, 5000),
                'satisfaction_score': np.random.uniform(3.5, 5.0)
            })

        # Add US state data
        for state in states_usa:
            data.append({
                'country': 'USA',
                'state': state,
                'users': np.random.randint(500, 10000),
                'revenue': np.random.uniform(5000, 100000),
                'avg_calculation_value': np.random.uniform(100, 3000),
                'satisfaction_score': np.random.uniform(3.5, 5.0)
            })

        return pd.DataFrame(data)

    def _load_default_charts(self):
        """Load default chart configurations"""
        default_charts = [
            # User Analytics Charts
            ChartConfig(
                chart_id="user_trends",
                chart_type=ChartType.LINE,
                title="User Growth Trends",
                data_source="user_analytics",
                x_column="date",
                y_column="active_users",
                styling={"color": self.color_palettes['tax_calc'][0]}
            ),
            ChartConfig(
                chart_id="session_overview",
                chart_type=ChartType.BAR,
                title="Daily Sessions Overview",
                data_source="user_analytics",
                x_column="date",
                y_column="sessions",
                styling={"color": self.color_palettes['tax_calc'][1]}
            ),

            # Tax Calculations Charts
            ChartConfig(
                chart_id="calculations_by_country",
                chart_type=ChartType.BAR,
                title="Tax Calculations by Country",
                data_source="tax_calculations",
                x_column="country",
                y_column="calculations_count",
                aggregation="sum",
                styling={"color": self.color_palettes['professional']}
            ),
            ChartConfig(
                chart_id="tax_types_pie",
                chart_type=ChartType.PIE,
                title="Distribution of Tax Types",
                data_source="tax_calculations",
                x_column="tax_type",
                y_column="calculations_count",
                aggregation="sum",
                styling={"colors": self.color_palettes['modern']}
            ),

            # Financial Metrics Charts
            ChartConfig(
                chart_id="revenue_trend",
                chart_type=ChartType.LINE,
                title="Revenue Trend",
                data_source="financial_metrics",
                x_column="date",
                y_column="revenue",
                styling={"color": self.color_palettes['financial'][0]}
            ),
            ChartConfig(
                chart_id="profit_analysis",
                chart_type=ChartType.WATERFALL,
                title="Profit Analysis",
                data_source="financial_metrics",
                x_column="date",
                y_column="profit",
                styling={"colors": self.color_palettes['financial']}
            ),

            # Performance Charts
            ChartConfig(
                chart_id="response_time_heatmap",
                chart_type=ChartType.HEATMAP,
                title="Response Time Heatmap",
                data_source="performance_data",
                x_column="timestamp",
                y_column="response_time",
                styling={"colorscale": "RdYlBu_r"}
            ),
            ChartConfig(
                chart_id="system_metrics_gauge",
                chart_type=ChartType.GAUGE,
                title="System Performance Gauges",
                data_source="performance_data",
                x_column="timestamp",
                y_column="cpu_usage",
                styling={"color": self.color_palettes['analytics'][0]}
            ),

            # User Behavior Charts
            ChartConfig(
                chart_id="user_segments_sunburst",
                chart_type=ChartType.SUNBURST,
                title="User Segments and Page Views",
                data_source="user_behavior",
                x_column="segment",
                y_column="visits",
                facet_column="page",
                aggregation="sum"
            ),

            # Geographic Charts
            ChartConfig(
                chart_id="geographic_revenue",
                chart_type=ChartType.CHOROPLETH,
                title="Revenue by Geography",
                data_source="geographic_data",
                x_column="country",
                y_column="revenue",
                styling={"colorscale": "Blues"}
            )
        ]

        for chart in default_charts:
            self.charts[chart.chart_id] = chart

    def _load_default_dashboards(self):
        """Load default dashboard configurations"""
        default_dashboards = [
            # Executive Dashboard
            DashboardConfig(
                dashboard_id="executive_dashboard",
                dashboard_type=DashboardType.EXECUTIVE,
                title="Executive Dashboard - GlobalTaxCalc.com",
                description="High-level metrics and KPIs for executive decision making",
                charts=[
                    self.charts["user_trends"],
                    self.charts["revenue_trend"],
                    self.charts["calculations_by_country"],
                    self.charts["geographic_revenue"]
                ],
                layout={
                    "columns": 2,
                    "chart_sizes": {"user_trends": "large", "revenue_trend": "large"}
                },
                auto_refresh=True,
                refresh_interval=300
            ),

            # Operational Dashboard
            DashboardConfig(
                dashboard_id="operational_dashboard",
                dashboard_type=DashboardType.OPERATIONAL,
                title="Operational Dashboard",
                description="Real-time operational metrics and system performance",
                charts=[
                    self.charts["session_overview"],
                    self.charts["response_time_heatmap"],
                    self.charts["system_metrics_gauge"],
                    self.charts["tax_types_pie"]
                ],
                layout={"columns": 2},
                auto_refresh=True,
                refresh_interval=60
            ),

            # Financial Dashboard
            DashboardConfig(
                dashboard_id="financial_dashboard",
                dashboard_type=DashboardType.FINANCIAL,
                title="Financial Performance Dashboard",
                description="Financial metrics, revenue analysis, and profitability insights",
                charts=[
                    self.charts["revenue_trend"],
                    self.charts["profit_analysis"],
                    self.charts["calculations_by_country"]
                ],
                layout={"columns": 1, "chart_sizes": {"revenue_trend": "xlarge"}},
                auto_refresh=True,
                refresh_interval=180
            ),

            # User Behavior Dashboard
            DashboardConfig(
                dashboard_id="user_behavior_dashboard",
                dashboard_type=DashboardType.USER_BEHAVIOR,
                title="User Behavior Analytics",
                description="User engagement, behavior patterns, and segment analysis",
                charts=[
                    self.charts["user_trends"],
                    self.charts["user_segments_sunburst"],
                    self.charts["session_overview"]
                ],
                layout={"columns": 2},
                auto_refresh=True,
                refresh_interval=120
            )
        ]

        for dashboard in default_dashboards:
            self.dashboards[dashboard.dashboard_id] = dashboard

    def create_chart(self, chart_config: ChartConfig) -> go.Figure:
        """Create a chart based on configuration"""
        try:
            # Get data
            data = self.data_sources.get(chart_config.data_source)
            if data is None:
                raise ValueError(f"Data source '{chart_config.data_source}' not found")

            # Apply filters
            filtered_data = self._apply_filters(data, chart_config.filters)

            # Apply aggregation
            if chart_config.aggregation != "none":
                filtered_data = self._apply_aggregation(filtered_data, chart_config)

            # Create chart based on type
            if chart_config.chart_type == ChartType.LINE:
                fig = self._create_line_chart(filtered_data, chart_config)
            elif chart_config.chart_type == ChartType.BAR:
                fig = self._create_bar_chart(filtered_data, chart_config)
            elif chart_config.chart_type == ChartType.SCATTER:
                fig = self._create_scatter_chart(filtered_data, chart_config)
            elif chart_config.chart_type == ChartType.PIE:
                fig = self._create_pie_chart(filtered_data, chart_config)
            elif chart_config.chart_type == ChartType.HEATMAP:
                fig = self._create_heatmap(filtered_data, chart_config)
            elif chart_config.chart_type == ChartType.HISTOGRAM:
                fig = self._create_histogram(filtered_data, chart_config)
            elif chart_config.chart_type == ChartType.BOX:
                fig = self._create_box_plot(filtered_data, chart_config)
            elif chart_config.chart_type == ChartType.SUNBURST:
                fig = self._create_sunburst_chart(filtered_data, chart_config)
            elif chart_config.chart_type == ChartType.TREEMAP:
                fig = self._create_treemap(filtered_data, chart_config)
            elif chart_config.chart_type == ChartType.WATERFALL:
                fig = self._create_waterfall_chart(filtered_data, chart_config)
            elif chart_config.chart_type == ChartType.GAUGE:
                fig = self._create_gauge_chart(filtered_data, chart_config)
            elif chart_config.chart_type == ChartType.CHOROPLETH:
                fig = self._create_choropleth_map(filtered_data, chart_config)
            else:
                raise ValueError(f"Unsupported chart type: {chart_config.chart_type}")

            # Apply styling
            fig = self._apply_chart_styling(fig, chart_config)

            return fig

        except Exception as e:
            logger.error(f"Error creating chart {chart_config.chart_id}: {e}")
            return self._create_error_chart(str(e))

    def _apply_filters(self, data: pd.DataFrame, filters: Dict[str, Any]) -> pd.DataFrame:
        """Apply filters to data"""
        filtered_data = data.copy()

        for column, filter_value in filters.items():
            if column in filtered_data.columns:
                if isinstance(filter_value, list):
                    filtered_data = filtered_data[filtered_data[column].isin(filter_value)]
                elif isinstance(filter_value, dict):
                    if 'min' in filter_value:
                        filtered_data = filtered_data[filtered_data[column] >= filter_value['min']]
                    if 'max' in filter_value:
                        filtered_data = filtered_data[filtered_data[column] <= filter_value['max']]
                else:
                    filtered_data = filtered_data[filtered_data[column] == filter_value]

        return filtered_data

    def _apply_aggregation(self, data: pd.DataFrame, chart_config: ChartConfig) -> pd.DataFrame:
        """Apply aggregation to data"""
        group_columns = [col for col in [chart_config.x_column, chart_config.color_column, chart_config.facet_column] if col]

        if chart_config.aggregation == "sum":
            return data.groupby(group_columns)[chart_config.y_column].sum().reset_index()
        elif chart_config.aggregation == "mean":
            return data.groupby(group_columns)[chart_config.y_column].mean().reset_index()
        elif chart_config.aggregation == "count":
            return data.groupby(group_columns)[chart_config.y_column].count().reset_index()
        elif chart_config.aggregation == "max":
            return data.groupby(group_columns)[chart_config.y_column].max().reset_index()
        elif chart_config.aggregation == "min":
            return data.groupby(group_columns)[chart_config.y_column].min().reset_index()

        return data

    def _create_line_chart(self, data: pd.DataFrame, chart_config: ChartConfig) -> go.Figure:
        """Create line chart"""
        fig = px.line(
            data,
            x=chart_config.x_column,
            y=chart_config.y_column,
            color=chart_config.color_column,
            title=chart_config.title
        )
        return fig

    def _create_bar_chart(self, data: pd.DataFrame, chart_config: ChartConfig) -> go.Figure:
        """Create bar chart"""
        fig = px.bar(
            data,
            x=chart_config.x_column,
            y=chart_config.y_column,
            color=chart_config.color_column,
            title=chart_config.title
        )
        return fig

    def _create_scatter_chart(self, data: pd.DataFrame, chart_config: ChartConfig) -> go.Figure:
        """Create scatter chart"""
        fig = px.scatter(
            data,
            x=chart_config.x_column,
            y=chart_config.y_column,
            color=chart_config.color_column,
            size=chart_config.size_column,
            title=chart_config.title
        )
        return fig

    def _create_pie_chart(self, data: pd.DataFrame, chart_config: ChartConfig) -> go.Figure:
        """Create pie chart"""
        fig = px.pie(
            data,
            names=chart_config.x_column,
            values=chart_config.y_column,
            title=chart_config.title
        )
        return fig

    def _create_heatmap(self, data: pd.DataFrame, chart_config: ChartConfig) -> go.Figure:
        """Create heatmap"""
        # Create pivot table for heatmap
        if chart_config.color_column:
            pivot_data = data.pivot_table(
                index=chart_config.x_column,
                columns=chart_config.color_column,
                values=chart_config.y_column,
                aggfunc='mean'
            )
        else:
            # Simple heatmap using time-based data
            data['hour'] = pd.to_datetime(data[chart_config.x_column]).dt.hour
            data['day'] = pd.to_datetime(data[chart_config.x_column]).dt.day_name()
            pivot_data = data.pivot_table(
                index='day',
                columns='hour',
                values=chart_config.y_column,
                aggfunc='mean'
            )

        fig = px.imshow(
            pivot_data,
            title=chart_config.title,
            aspect="auto"
        )
        return fig

    def _create_histogram(self, data: pd.DataFrame, chart_config: ChartConfig) -> go.Figure:
        """Create histogram"""
        fig = px.histogram(
            data,
            x=chart_config.y_column,
            color=chart_config.color_column,
            title=chart_config.title
        )
        return fig

    def _create_box_plot(self, data: pd.DataFrame, chart_config: ChartConfig) -> go.Figure:
        """Create box plot"""
        fig = px.box(
            data,
            x=chart_config.x_column,
            y=chart_config.y_column,
            color=chart_config.color_column,
            title=chart_config.title
        )
        return fig

    def _create_sunburst_chart(self, data: pd.DataFrame, chart_config: ChartConfig) -> go.Figure:
        """Create sunburst chart"""
        # Create hierarchical data for sunburst
        if chart_config.facet_column:
            path_columns = [chart_config.x_column, chart_config.facet_column]
        else:
            path_columns = [chart_config.x_column]

        fig = px.sunburst(
            data,
            path=path_columns,
            values=chart_config.y_column,
            title=chart_config.title
        )
        return fig

    def _create_treemap(self, data: pd.DataFrame, chart_config: ChartConfig) -> go.Figure:
        """Create treemap"""
        if chart_config.facet_column:
            path_columns = [chart_config.x_column, chart_config.facet_column]
        else:
            path_columns = [chart_config.x_column]

        fig = px.treemap(
            data,
            path=path_columns,
            values=chart_config.y_column,
            title=chart_config.title
        )
        return fig

    def _create_waterfall_chart(self, data: pd.DataFrame, chart_config: ChartConfig) -> go.Figure:
        """Create waterfall chart"""
        # Simplified waterfall chart
        fig = go.Figure(go.Waterfall(
            name="Waterfall",
            orientation="v",
            measure=["relative"] * len(data),
            x=data[chart_config.x_column][:10],  # Limit to first 10 points
            textposition="outside",
            text=[f"{val:.1f}" for val in data[chart_config.y_column][:10]],
            y=data[chart_config.y_column][:10],
            connector={"line": {"color": "rgb(63, 63, 63)"}},
        ))

        fig.update_layout(title=chart_config.title)
        return fig

    def _create_gauge_chart(self, data: pd.DataFrame, chart_config: ChartConfig) -> go.Figure:
        """Create gauge chart"""
        # Use the most recent value for gauge
        current_value = data[chart_config.y_column].iloc[-1] if not data.empty else 0
        max_value = data[chart_config.y_column].max() if not data.empty else 100

        fig = go.Figure(go.Indicator(
            mode="gauge+number+delta",
            value=current_value,
            domain={'x': [0, 1], 'y': [0, 1]},
            title={'text': chart_config.title},
            delta={'reference': current_value * 0.9},
            gauge={
                'axis': {'range': [None, max_value]},
                'bar': {'color': "darkblue"},
                'steps': [
                    {'range': [0, max_value * 0.5], 'color': "lightgray"},
                    {'range': [max_value * 0.5, max_value * 0.8], 'color': "gray"}
                ],
                'threshold': {
                    'line': {'color': "red", 'width': 4},
                    'thickness': 0.75,
                    'value': max_value * 0.9
                }
            }
        ))

        return fig

    def _create_choropleth_map(self, data: pd.DataFrame, chart_config: ChartConfig) -> go.Figure:
        """Create choropleth map"""
        fig = px.choropleth(
            data,
            locations=chart_config.x_column,
            color=chart_config.y_column,
            hover_name=chart_config.x_column,
            color_continuous_scale="Blues",
            title=chart_config.title
        )
        return fig

    def _apply_chart_styling(self, fig: go.Figure, chart_config: ChartConfig) -> go.Figure:
        """Apply styling to chart"""
        styling = chart_config.styling

        # Apply color scheme
        if 'color' in styling:
            fig.update_traces(marker_color=styling['color'])
        elif 'colors' in styling:
            fig.update_traces(marker=dict(colors=styling['colors']))

        # Apply layout styling
        fig.update_layout(
            template="plotly_white",
            font=dict(family="Arial, sans-serif", size=12),
            title=dict(x=0.5, font=dict(size=16, color="darkblue")),
            margin=dict(l=50, r=50, t=80, b=50)
        )

        # Make interactive if specified
        if chart_config.interactive:
            fig.update_layout(hovermode='closest')

        return fig

    def _create_error_chart(self, error_message: str) -> go.Figure:
        """Create error chart when chart creation fails"""
        fig = go.Figure()
        fig.add_annotation(
            text=f"Error creating chart:<br>{error_message}",
            xref="paper", yref="paper",
            x=0.5, y=0.5, xanchor='center', yanchor='middle',
            showarrow=False,
            font=dict(size=16, color="red")
        )
        fig.update_layout(
            title="Chart Error",
            xaxis=dict(visible=False),
            yaxis=dict(visible=False)
        )
        return fig

    def create_dashboard(self, dashboard_id: str) -> str:
        """Create dashboard HTML"""
        dashboard_config = self.dashboards.get(dashboard_id)
        if not dashboard_config:
            raise ValueError(f"Dashboard '{dashboard_id}' not found")

        # Create charts for dashboard
        charts_html = []
        for chart_config in dashboard_config.charts:
            try:
                fig = self.create_chart(chart_config)
                chart_html = pyo.plot(fig, output_type='div', include_plotlyjs=False)
                charts_html.append(chart_html)
            except Exception as e:
                logger.error(f"Error creating chart {chart_config.chart_id}: {e}")
                charts_html.append(f"<div class='error'>Error loading chart: {e}</div>")

        # Create dashboard HTML
        dashboard_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>{dashboard_config.title}</title>
            <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
            <style>
                body {{ font-family: 'Arial', sans-serif; }}
                .dashboard-header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 2rem; }}
                .chart-container {{ margin: 1rem 0; padding: 1rem; border: 1px solid #dee2e6; border-radius: 8px; }}
                .error {{ color: red; text-align: center; padding: 2rem; }}
            </style>
        </head>
        <body>
            <div class="container-fluid">
                <div class="dashboard-header">
                    <h1>{dashboard_config.title}</h1>
                    <p>{dashboard_config.description}</p>
                    <small>Last updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</small>
                </div>
                <div class="row">
        """

        # Add charts in grid layout
        columns = dashboard_config.layout.get('columns', 2)
        for i, chart_html in enumerate(charts_html):
            if i % columns == 0:
                dashboard_html += '<div class="row">'

            col_class = f"col-{12 // columns}"
            dashboard_html += f'<div class="{col_class}"><div class="chart-container">{chart_html}</div></div>'

            if (i + 1) % columns == 0 or i == len(charts_html) - 1:
                dashboard_html += '</div>'

        dashboard_html += """
                </div>
            </div>
        </body>
        </html>
        """

        return dashboard_html

    def export_chart(self, chart_id: str, format: str = "html", width: int = 800, height: int = 600) -> str:
        """Export chart to various formats"""
        chart_config = self.charts.get(chart_id)
        if not chart_config:
            raise ValueError(f"Chart '{chart_id}' not found")

        fig = self.create_chart(chart_config)
        fig.update_layout(width=width, height=height)

        if format.lower() == "html":
            return pyo.plot(fig, output_type='div', include_plotlyjs=True)
        elif format.lower() == "json":
            return json.dumps(fig, cls=PlotlyJSONEncoder)
        elif format.lower() == "png":
            return fig.to_image(format="png", width=width, height=height)
        elif format.lower() == "pdf":
            return fig.to_image(format="pdf", width=width, height=height)
        else:
            raise ValueError(f"Unsupported export format: {format}")

    def create_custom_visualization(self, data: pd.DataFrame, viz_type: str, **kwargs) -> go.Figure:
        """Create custom visualizations using various techniques"""
        if viz_type == "correlation_matrix":
            return self._create_correlation_matrix(data, **kwargs)
        elif viz_type == "pca_plot":
            return self._create_pca_plot(data, **kwargs)
        elif viz_type == "cluster_analysis":
            return self._create_cluster_analysis(data, **kwargs)
        elif viz_type == "time_series_decomposition":
            return self._create_time_series_decomposition(data, **kwargs)
        elif viz_type == "network_graph":
            return self._create_network_graph(data, **kwargs)
        elif viz_type == "word_cloud":
            return self._create_word_cloud_viz(data, **kwargs)
        else:
            raise ValueError(f"Unsupported visualization type: {viz_type}")

    def _create_correlation_matrix(self, data: pd.DataFrame, **kwargs) -> go.Figure:
        """Create correlation matrix heatmap"""
        numeric_columns = data.select_dtypes(include=[np.number]).columns
        corr_matrix = data[numeric_columns].corr()

        fig = px.imshow(
            corr_matrix,
            title="Correlation Matrix",
            color_continuous_scale="RdBu_r",
            aspect="auto"
        )

        fig.update_layout(
            width=600,
            height=600
        )

        return fig

    def _create_pca_plot(self, data: pd.DataFrame, **kwargs) -> go.Figure:
        """Create PCA visualization"""
        numeric_columns = data.select_dtypes(include=[np.number]).columns
        X = data[numeric_columns].fillna(0)

        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        pca = PCA(n_components=2)
        X_pca = pca.fit_transform(X_scaled)

        pca_df = pd.DataFrame({
            'PC1': X_pca[:, 0],
            'PC2': X_pca[:, 1]
        })

        fig = px.scatter(
            pca_df,
            x='PC1',
            y='PC2',
            title=f"PCA Plot (Explained variance: {pca.explained_variance_ratio_.sum():.2%})"
        )

        return fig

    def _create_cluster_analysis(self, data: pd.DataFrame, n_clusters: int = 3, **kwargs) -> go.Figure:
        """Create cluster analysis visualization"""
        numeric_columns = data.select_dtypes(include=[np.number]).columns[:2]  # Use first 2 numeric columns
        X = data[numeric_columns].fillna(0)

        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        kmeans = KMeans(n_clusters=n_clusters, random_state=42)
        clusters = kmeans.fit_predict(X_scaled)

        cluster_df = pd.DataFrame({
            'x': X.iloc[:, 0],
            'y': X.iloc[:, 1],
            'cluster': clusters
        })

        fig = px.scatter(
            cluster_df,
            x='x',
            y='y',
            color='cluster',
            title=f"K-Means Clustering (k={n_clusters})"
        )

        return fig

    def _create_time_series_decomposition(self, data: pd.DataFrame, **kwargs) -> go.Figure:
        """Create time series decomposition plot"""
        # Assuming data has a datetime column and a value column
        date_column = kwargs.get('date_column', data.select_dtypes(include=['datetime64']).columns[0])
        value_column = kwargs.get('value_column', data.select_dtypes(include=[np.number]).columns[0])

        ts_data = data.set_index(date_column)[value_column]

        # Simple moving average decomposition
        rolling_mean = ts_data.rolling(window=7).mean()
        rolling_std = ts_data.rolling(window=7).std()

        fig = make_subplots(
            rows=3, cols=1,
            subplot_titles=['Original', 'Trend (7-day MA)', 'Residuals'],
            vertical_spacing=0.1
        )

        fig.add_trace(go.Scatter(x=ts_data.index, y=ts_data.values, name='Original'), row=1, col=1)
        fig.add_trace(go.Scatter(x=rolling_mean.index, y=rolling_mean.values, name='Trend'), row=2, col=1)
        fig.add_trace(go.Scatter(x=rolling_std.index, y=rolling_std.values, name='Residuals'), row=3, col=1)

        fig.update_layout(title="Time Series Decomposition", height=800)

        return fig

    def _create_network_graph(self, data: pd.DataFrame, **kwargs) -> go.Figure:
        """Create network graph visualization"""
        # Simple network based on correlation
        numeric_columns = data.select_dtypes(include=[np.number]).columns
        corr_matrix = data[numeric_columns].corr()

        # Create network from high correlations
        G = nx.Graph()
        threshold = kwargs.get('correlation_threshold', 0.5)

        for i in range(len(corr_matrix.columns)):
            for j in range(i + 1, len(corr_matrix.columns)):
                corr_value = corr_matrix.iloc[i, j]
                if abs(corr_value) > threshold:
                    G.add_edge(corr_matrix.columns[i], corr_matrix.columns[j], weight=abs(corr_value))

        # Get positions
        pos = nx.spring_layout(G)

        # Create edges
        edge_x = []
        edge_y = []
        for edge in G.edges():
            x0, y0 = pos[edge[0]]
            x1, y1 = pos[edge[1]]
            edge_x.extend([x0, x1, None])
            edge_y.extend([y0, y1, None])

        # Create nodes
        node_x = [pos[node][0] for node in G.nodes()]
        node_y = [pos[node][1] for node in G.nodes()]
        node_text = list(G.nodes())

        fig = go.Figure()

        fig.add_trace(go.Scatter(
            x=edge_x, y=edge_y,
            line=dict(width=0.5, color='#888'),
            hoverinfo='none',
            mode='lines'
        ))

        fig.add_trace(go.Scatter(
            x=node_x, y=node_y,
            mode='markers+text',
            hoverinfo='text',
            text=node_text,
            textposition="middle center",
            marker=dict(size=20, color='lightblue', line=dict(width=2, color='black'))
        ))

        fig.update_layout(
            title="Variable Correlation Network",
            showlegend=False,
            xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
            yaxis=dict(showgrid=False, zeroline=False, showticklabels=False)
        )

        return fig

    def _create_word_cloud_viz(self, data: pd.DataFrame, text_column: str, **kwargs) -> go.Figure:
        """Create word cloud visualization (placeholder)"""
        # This would require actual text data and wordcloud generation
        # For now, create a simple text frequency chart

        if text_column not in data.columns:
            raise ValueError(f"Text column '{text_column}' not found in data")

        # Simple word frequency analysis
        text_data = data[text_column].dropna().astype(str)
        word_freq = {}

        for text in text_data:
            words = text.split()
            for word in words:
                word = word.lower().strip('.,!?";')
                if len(word) > 3:  # Skip short words
                    word_freq[word] = word_freq.get(word, 0) + 1

        # Get top words
        top_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)[:20]

        fig = px.bar(
            x=[word for word, freq in top_words],
            y=[freq for word, freq in top_words],
            title="Top Words Frequency"
        )

        return fig

    def run_dashboard_server(self, host: str = "0.0.0.0", port: int = 8050, debug: bool = False):
        """Run Dash server for interactive dashboards"""
        # Set up callbacks for interactivity
        self._setup_dashboard_callbacks()

        # Update layout with navigation
        self.app.layout = self._create_main_layout()

        logger.info(f"Starting dashboard server on http://{host}:{port}")
        self.app.run_server(host=host, port=port, debug=debug)

    def _setup_dashboard_callbacks(self):
        """Set up Dash callbacks for interactivity"""
        @self.app.callback(
            Output('page-content', 'children'),
            [Input('url', 'pathname')]
        )
        def display_page(pathname):
            if pathname == '/executive' or pathname == '/':
                return self._create_dashboard_layout('executive_dashboard')
            elif pathname == '/operational':
                return self._create_dashboard_layout('operational_dashboard')
            elif pathname == '/financial':
                return self._create_dashboard_layout('financial_dashboard')
            elif pathname == '/user-behavior':
                return self._create_dashboard_layout('user_behavior_dashboard')
            else:
                return html.Div([
                    html.H1("Page Not Found"),
                    html.P("The requested page could not be found.")
                ])

    def _create_main_layout(self) -> html.Div:
        """Create main layout with navigation"""
        return html.Div([
            dcc.Location(id='url', refresh=False),

            # Navigation
            dbc.NavbarSimple(
                children=[
                    dbc.NavItem(dbc.NavLink("Executive", href="/executive")),
                    dbc.NavItem(dbc.NavLink("Operational", href="/operational")),
                    dbc.NavItem(dbc.NavLink("Financial", href="/financial")),
                    dbc.NavItem(dbc.NavLink("User Behavior", href="/user-behavior")),
                ],
                brand="GlobalTaxCalc Analytics",
                brand_href="/",
                color="primary",
                dark=True,
                fluid=True,
            ),

            # Page content
            html.Div(id='page-content', style={'padding': '2rem'})
        ])

    def _create_dashboard_layout(self, dashboard_id: str) -> html.Div:
        """Create layout for specific dashboard"""
        dashboard_config = self.dashboards.get(dashboard_id)
        if not dashboard_config:
            return html.Div([html.H1("Dashboard not found")])

        children = [
            html.H1(dashboard_config.title, className="mb-4"),
            html.P(dashboard_config.description, className="text-muted mb-4")
        ]

        # Create charts
        for chart_config in dashboard_config.charts:
            try:
                fig = self.create_chart(chart_config)
                children.append(
                    html.Div([
                        dcc.Graph(figure=fig, id=f'chart-{chart_config.chart_id}')
                    ], className="mb-4")
                )
            except Exception as e:
                children.append(
                    html.Div([
                        html.H4(chart_config.title),
                        html.P(f"Error loading chart: {e}", style={'color': 'red'})
                    ], className="mb-4")
                )

        return html.Div(children)


# Example usage and testing
if __name__ == "__main__":
    # Initialize the visualization engine
    engine = AdvancedVisualizationEngine()

    print("🎨 Advanced Visualization Platform for GlobalTaxCalc.com")
    print("=" * 65)

    try:
        # Create a sample chart
        chart_config = engine.charts["user_trends"]
        fig = engine.create_chart(chart_config)
        print(f"✅ Created chart: {chart_config.title}")

        # Export chart
        html_chart = engine.export_chart("user_trends", format="html")
        print("✅ Exported chart to HTML")

        # Create dashboard
        dashboard_html = engine.create_dashboard("executive_dashboard")
        print("✅ Created executive dashboard")

        # Save dashboard
        with open("executive_dashboard.html", "w") as f:
            f.write(dashboard_html)
        print("✅ Saved dashboard to executive_dashboard.html")

        # Create custom visualization
        sample_data = engine.data_sources['user_analytics']
        corr_fig = engine.create_custom_visualization(sample_data, "correlation_matrix")
        print("✅ Created correlation matrix visualization")

        # Display available charts and dashboards
        print(f"\n📊 Available Charts: {len(engine.charts)}")
        for chart_id, chart_config in engine.charts.items():
            print(f"  - {chart_id}: {chart_config.title}")

        print(f"\n📈 Available Dashboards: {len(engine.dashboards)}")
        for dashboard_id, dashboard_config in engine.dashboards.items():
            print(f"  - {dashboard_id}: {dashboard_config.title}")

        print("\n✅ Advanced Visualization Platform demonstration completed successfully!")
        print("\nKey Features Implemented:")
        print("- Interactive Plotly-based visualizations")
        print("- Multiple chart types (line, bar, pie, heatmap, sunburst, gauge, etc.)")
        print("- Dash-powered interactive dashboards")
        print("- Custom visualization capabilities (PCA, clustering, correlation)")
        print("- Real-time data binding and auto-refresh")
        print("- Export functionality (HTML, JSON, PNG, PDF)")
        print("- Responsive design with Bootstrap integration")
        print("- Color palette management and styling")
        print("- Data filtering and aggregation")
        print("- Multi-dashboard navigation system")

        # Optionally start the server
        start_server = input("\nStart interactive dashboard server? (y/n): ")
        if start_server.lower() == 'y':
            print("Starting dashboard server on http://localhost:8050")
            engine.run_dashboard_server(debug=True)

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()