"""
Competitive Intelligence and Market Analysis Module

This module provides comprehensive competitive intelligence capabilities including:
- Competitor website monitoring
- Market trend analysis
- Pricing intelligence
- Feature comparison tracking
- SEO competitive analysis
- Social media monitoring
"""

import asyncio
import aiohttp
import requests
from bs4 import BeautifulSoup
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
import json
import logging
from dataclasses import dataclass, asdict
import re
import time
from urllib.parse import urljoin, urlparse
import hashlib
from collections import defaultdict
import clickhouse_connect
import redis

logger = logging.getLogger(__name__)

@dataclass
class CompetitorData:
    """Represents competitor analysis data"""
    competitor_name: str
    website_url: str
    last_checked: datetime
    pricing_data: Dict[str, Any]
    features: List[str]
    content_changes: Dict[str, Any]
    seo_metrics: Dict[str, Any]
    traffic_estimates: Dict[str, Any]
    social_metrics: Dict[str, Any]

@dataclass
class MarketTrend:
    """Represents market trend data"""
    trend_name: str
    category: str
    data_points: List[Dict[str, Any]]
    trend_direction: str  # 'up', 'down', 'stable'
    confidence_score: float
    timestamp: datetime

@dataclass
class PricePoint:
    """Represents a pricing data point"""
    competitor: str
    product_name: str
    price: float
    currency: str
    features_included: List[str]
    billing_cycle: str
    last_updated: datetime

class CompetitiveIntelligenceEngine:
    """
    Comprehensive competitive intelligence and market analysis engine
    """

    def __init__(self,
                 clickhouse_config: Dict[str, str],
                 redis_config: Dict[str, str],
                 api_keys: Dict[str, str] = None):
        """
        Initialize the competitive intelligence engine

        Args:
            clickhouse_config: ClickHouse connection configuration
            redis_config: Redis connection configuration
            api_keys: Dictionary of API keys for external services
        """
        self.clickhouse_config = clickhouse_config
        self.redis_config = redis_config
        self.api_keys = api_keys or {}

        # Connections
        self.clickhouse_client = None
        self.redis_client = None
        self.session = None

        # Competitor configuration
        self.competitors = [
            {
                'name': 'TaxAct',
                'website': 'https://www.taxact.com',
                'pricing_page': 'https://www.taxact.com/pricing',
                'features_page': 'https://www.taxact.com/features'
            },
            {
                'name': 'H&R Block',
                'website': 'https://www.hrblock.com',
                'pricing_page': 'https://www.hrblock.com/online-tax-filing/pricing',
                'features_page': 'https://www.hrblock.com/tax-software'
            },
            {
                'name': 'TurboTax',
                'website': 'https://turbotax.intuit.com',
                'pricing_page': 'https://turbotax.intuit.com/pricing',
                'features_page': 'https://turbotax.intuit.com/features'
            },
            {
                'name': 'FreeTaxUSA',
                'website': 'https://www.freetaxusa.com',
                'pricing_page': 'https://www.freetaxusa.com/pricing',
                'features_page': 'https://www.freetaxusa.com/features'
            }
        ]

        # Market trend keywords
        self.trend_keywords = [
            'tax preparation software',
            'online tax calculator',
            'tax compliance automation',
            'digital tax services',
            'AI tax preparation',
            'tax software pricing',
            'international tax calculator'
        ]

        self._setup_connections()

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

            logger.info("Competitive intelligence connections established")

        except Exception as e:
            logger.error(f"Failed to establish connections: {e}")
            raise

    async def start_competitive_monitoring(self):
        """Start comprehensive competitive monitoring"""
        logger.info("Starting competitive intelligence monitoring")

        # Create aiohttp session
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        )

        try:
            # Start monitoring tasks
            tasks = [
                asyncio.create_task(self._monitor_competitor_pricing()),
                asyncio.create_task(self._monitor_competitor_features()),
                asyncio.create_task(self._monitor_competitor_content()),
                asyncio.create_task(self._analyze_market_trends()),
                asyncio.create_task(self._monitor_seo_metrics()),
                asyncio.create_task(self._analyze_social_presence())
            ]

            await asyncio.gather(*tasks, return_exceptions=True)

        finally:
            if self.session:
                await self.session.close()

    async def _monitor_competitor_pricing(self):
        """Monitor competitor pricing strategies"""
        while True:
            try:
                logger.info("Monitoring competitor pricing")

                for competitor in self.competitors:
                    try:
                        pricing_data = await self._scrape_pricing_data(competitor)
                        if pricing_data:
                            await self._store_pricing_data(competitor['name'], pricing_data)

                    except Exception as e:
                        logger.error(f"Error monitoring pricing for {competitor['name']}: {e}")

                # Wait 24 hours before next pricing check
                await asyncio.sleep(86400)

            except Exception as e:
                logger.error(f"Error in pricing monitoring: {e}")
                await asyncio.sleep(3600)

    async def _scrape_pricing_data(self, competitor: Dict[str, str]) -> Dict[str, Any]:
        """Scrape pricing data from competitor website"""
        try:
            async with self.session.get(competitor['pricing_page']) as response:
                if response.status != 200:
                    return None

                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')

                pricing_data = {
                    'plans': [],
                    'scraped_at': datetime.now().isoformat(),
                    'source_url': competitor['pricing_page']
                }

                # Generic pricing extraction patterns
                price_patterns = [
                    r'\$(\d+(?:\.\d{2})?)',  # $99.99
                    r'(\d+(?:\.\d{2})?)\s*dollars?',  # 99 dollars
                    r'(\d+(?:\.\d{2})?)\s*USD'  # 99 USD
                ]

                # Look for pricing sections
                price_elements = soup.find_all(['div', 'span', 'p'],
                                             class_=re.compile(r'price|cost|plan|tier', re.I))

                for element in price_elements:
                    text = element.get_text(strip=True)

                    for pattern in price_patterns:
                        matches = re.findall(pattern, text, re.I)
                        if matches:
                            for price in matches:
                                try:
                                    price_value = float(price)

                                    # Extract plan context
                                    parent = element.find_parent(['div', 'section'])
                                    context = parent.get_text(strip=True) if parent else text

                                    plan_data = {
                                        'price': price_value,
                                        'currency': 'USD',
                                        'context': context[:200],  # Limit context length
                                        'billing_cycle': self._extract_billing_cycle(context),
                                        'features': self._extract_features_from_context(context)
                                    }

                                    pricing_data['plans'].append(plan_data)

                                except ValueError:
                                    continue

                return pricing_data

        except Exception as e:
            logger.error(f"Error scraping pricing data for {competitor['name']}: {e}")
            return None

    def _extract_billing_cycle(self, text: str) -> str:
        """Extract billing cycle from text"""
        text_lower = text.lower()

        if any(word in text_lower for word in ['month', 'monthly', '/mo']):
            return 'monthly'
        elif any(word in text_lower for word in ['year', 'yearly', 'annual', '/yr']):
            return 'yearly'
        elif any(word in text_lower for word in ['week', 'weekly']):
            return 'weekly'
        else:
            return 'unknown'

    def _extract_features_from_context(self, text: str) -> List[str]:
        """Extract features from pricing context"""
        features = []

        # Common tax software features to look for
        feature_keywords = [
            'e-file', 'electronic filing', 'audit support', 'expert review',
            'live chat', 'phone support', 'maximum refund', 'accuracy guarantee',
            'state returns', 'federal returns', 'import data', 'previous year',
            'schedule c', 'itemized deductions', 'cryptocurrency', 'investment',
            'rental property', 'self-employed', 'business taxes'
        ]

        text_lower = text.lower()
        for keyword in feature_keywords:
            if keyword in text_lower:
                features.append(keyword)

        return features

    async def _store_pricing_data(self, competitor_name: str, pricing_data: Dict[str, Any]):
        """Store pricing data in database"""
        try:
            # Store in Redis for quick access
            redis_key = f"competitor_pricing:{competitor_name}"
            self.redis_client.setex(redis_key, 86400, json.dumps(pricing_data))

            # Store in ClickHouse for historical analysis
            for plan in pricing_data['plans']:
                row_data = [
                    datetime.now().isoformat(),
                    competitor_name,
                    plan['price'],
                    plan['currency'],
                    plan['billing_cycle'],
                    json.dumps(plan['features']),
                    plan['context'],
                    pricing_data['source_url']
                ]

                self.clickhouse_client.insert(
                    'competitor_pricing',
                    [row_data],
                    column_names=[
                        'timestamp', 'competitor', 'price', 'currency',
                        'billing_cycle', 'features', 'context', 'source_url'
                    ]
                )

            logger.info(f"Stored pricing data for {competitor_name}: {len(pricing_data['plans'])} plans")

        except Exception as e:
            logger.error(f"Error storing pricing data for {competitor_name}: {e}")

    async def _monitor_competitor_features(self):
        """Monitor competitor feature updates"""
        while True:
            try:
                logger.info("Monitoring competitor features")

                for competitor in self.competitors:
                    try:
                        features_data = await self._scrape_features_data(competitor)
                        if features_data:
                            await self._store_features_data(competitor['name'], features_data)

                    except Exception as e:
                        logger.error(f"Error monitoring features for {competitor['name']}: {e}")

                # Wait 7 days before next feature check
                await asyncio.sleep(604800)

            except Exception as e:
                logger.error(f"Error in features monitoring: {e}")
                await asyncio.sleep(86400)

    async def _scrape_features_data(self, competitor: Dict[str, str]) -> Dict[str, Any]:
        """Scrape features data from competitor website"""
        try:
            async with self.session.get(competitor['features_page']) as response:
                if response.status != 200:
                    return None

                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')

                features_data = {
                    'features': [],
                    'categories': {},
                    'scraped_at': datetime.now().isoformat(),
                    'source_url': competitor['features_page']
                }

                # Look for feature lists
                feature_elements = soup.find_all(['li', 'div', 'p'],
                                               class_=re.compile(r'feature|benefit|capability', re.I))

                for element in feature_elements:
                    text = element.get_text(strip=True)

                    if len(text) > 10 and len(text) < 200:  # Reasonable feature description length
                        features_data['features'].append(text)

                # Look for feature categories
                category_elements = soup.find_all(['h2', 'h3', 'h4'],
                                                class_=re.compile(r'category|section|group', re.I))

                for element in category_elements:
                    category_text = element.get_text(strip=True)

                    # Find features under this category
                    next_features = []
                    for sibling in element.find_next_siblings():
                        if sibling.name in ['h2', 'h3', 'h4']:
                            break

                        feature_items = sibling.find_all(['li', 'p'])
                        for item in feature_items:
                            feature_text = item.get_text(strip=True)
                            if len(feature_text) > 10 and len(feature_text) < 200:
                                next_features.append(feature_text)

                    if next_features:
                        features_data['categories'][category_text] = next_features

                return features_data

        except Exception as e:
            logger.error(f"Error scraping features data for {competitor['name']}: {e}")
            return None

    async def _store_features_data(self, competitor_name: str, features_data: Dict[str, Any]):
        """Store features data in database"""
        try:
            # Store in Redis
            redis_key = f"competitor_features:{competitor_name}"
            self.redis_client.setex(redis_key, 604800, json.dumps(features_data))

            # Store in ClickHouse
            row_data = [
                datetime.now().isoformat(),
                competitor_name,
                json.dumps(features_data['features']),
                json.dumps(features_data['categories']),
                features_data['source_url']
            ]

            self.clickhouse_client.insert(
                'competitor_features',
                [row_data],
                column_names=[
                    'timestamp', 'competitor', 'features_list',
                    'feature_categories', 'source_url'
                ]
            )

            logger.info(f"Stored features data for {competitor_name}: {len(features_data['features'])} features")

        except Exception as e:
            logger.error(f"Error storing features data for {competitor_name}: {e}")

    async def _monitor_competitor_content(self):
        """Monitor competitor content changes"""
        while True:
            try:
                logger.info("Monitoring competitor content changes")

                for competitor in self.competitors:
                    try:
                        content_changes = await self._detect_content_changes(competitor)
                        if content_changes:
                            await self._store_content_changes(competitor['name'], content_changes)

                    except Exception as e:
                        logger.error(f"Error monitoring content for {competitor['name']}: {e}")

                # Wait 3 days before next content check
                await asyncio.sleep(259200)

            except Exception as e:
                logger.error(f"Error in content monitoring: {e}")
                await asyncio.sleep(86400)

    async def _detect_content_changes(self, competitor: Dict[str, str]) -> Dict[str, Any]:
        """Detect content changes on competitor website"""
        try:
            async with self.session.get(competitor['website']) as response:
                if response.status != 200:
                    return None

                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')

                # Remove script and style elements
                for script in soup(["script", "style"]):
                    script.decompose()

                # Get text content
                text_content = soup.get_text()

                # Clean up text
                lines = (line.strip() for line in text_content.splitlines())
                chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
                text = ' '.join(chunk for chunk in chunks if chunk)

                # Create content hash
                content_hash = hashlib.md5(text.encode()).hexdigest()

                # Check for previous content hash
                redis_key = f"content_hash:{competitor['name']}"
                previous_hash = self.redis_client.get(redis_key)

                changes = {
                    'has_changes': previous_hash is not None and previous_hash != content_hash,
                    'current_hash': content_hash,
                    'previous_hash': previous_hash,
                    'checked_at': datetime.now().isoformat(),
                    'url': competitor['website']
                }

                # Store current hash
                self.redis_client.setex(redis_key, 259200, content_hash)

                if changes['has_changes']:
                    # Extract key changes (headlines, prices, etc.)
                    headlines = [h.get_text(strip=True) for h in soup.find_all(['h1', 'h2', 'h3'])]
                    changes['new_headlines'] = headlines[:10]  # Limit to top 10

                return changes

        except Exception as e:
            logger.error(f"Error detecting content changes for {competitor['name']}: {e}")
            return None

    async def _store_content_changes(self, competitor_name: str, changes: Dict[str, Any]):
        """Store content changes in database"""
        try:
            if changes['has_changes']:
                row_data = [
                    datetime.now().isoformat(),
                    competitor_name,
                    changes['current_hash'],
                    changes['previous_hash'],
                    json.dumps(changes.get('new_headlines', [])),
                    changes['url']
                ]

                self.clickhouse_client.insert(
                    'competitor_content_changes',
                    [row_data],
                    column_names=[
                        'timestamp', 'competitor', 'current_hash',
                        'previous_hash', 'new_headlines', 'url'
                    ]
                )

                logger.info(f"Detected and stored content changes for {competitor_name}")

        except Exception as e:
            logger.error(f"Error storing content changes for {competitor_name}: {e}")

    async def _analyze_market_trends(self):
        """Analyze market trends using external APIs"""
        while True:
            try:
                logger.info("Analyzing market trends")

                # Google Trends analysis
                if 'google_trends_api' in self.api_keys:
                    trends_data = await self._get_google_trends_data()
                    if trends_data:
                        await self._store_trends_data(trends_data)

                # News sentiment analysis
                if 'news_api' in self.api_keys:
                    news_data = await self._get_news_sentiment()
                    if news_data:
                        await self._store_news_sentiment(news_data)

                # Wait 24 hours before next trend analysis
                await asyncio.sleep(86400)

            except Exception as e:
                logger.error(f"Error in market trends analysis: {e}")
                await asyncio.sleep(43200)

    async def _get_google_trends_data(self) -> Dict[str, Any]:
        """Get Google Trends data for market keywords"""
        try:
            # This would integrate with Google Trends API or pytrends
            # For now, return mock data structure
            trends_data = {
                'keywords': {},
                'timestamp': datetime.now().isoformat()
            }

            for keyword in self.trend_keywords:
                # Mock trend data - in real implementation, use pytrends
                trends_data['keywords'][keyword] = {
                    'interest_over_time': [
                        {'date': '2024-01-01', 'interest': 75},
                        {'date': '2024-02-01', 'interest': 80},
                        {'date': '2024-03-01', 'interest': 85}
                    ],
                    'related_queries': ['tax software', 'online calculator'],
                    'trend_direction': 'up'
                }

            return trends_data

        except Exception as e:
            logger.error(f"Error getting Google Trends data: {e}")
            return None

    async def _get_news_sentiment(self) -> Dict[str, Any]:
        """Get news sentiment for tax software industry"""
        try:
            # This would integrate with News API
            # For now, return mock data structure
            news_data = {
                'articles': [],
                'overall_sentiment': 'positive',
                'sentiment_score': 0.7,
                'timestamp': datetime.now().isoformat()
            }

            return news_data

        except Exception as e:
            logger.error(f"Error getting news sentiment: {e}")
            return None

    async def _monitor_seo_metrics(self):
        """Monitor SEO metrics for competitors"""
        while True:
            try:
                logger.info("Monitoring SEO metrics")

                for competitor in self.competitors:
                    try:
                        seo_data = await self._analyze_seo_metrics(competitor)
                        if seo_data:
                            await self._store_seo_data(competitor['name'], seo_data)

                    except Exception as e:
                        logger.error(f"Error monitoring SEO for {competitor['name']}: {e}")

                # Wait 7 days before next SEO check
                await asyncio.sleep(604800)

            except Exception as e:
                logger.error(f"Error in SEO monitoring: {e}")
                await asyncio.sleep(86400)

    async def _analyze_seo_metrics(self, competitor: Dict[str, str]) -> Dict[str, Any]:
        """Analyze SEO metrics for competitor website"""
        try:
            async with self.session.get(competitor['website']) as response:
                if response.status != 200:
                    return None

                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')

                seo_data = {
                    'title': '',
                    'meta_description': '',
                    'meta_keywords': '',
                    'h1_tags': [],
                    'internal_links': 0,
                    'external_links': 0,
                    'images': 0,
                    'images_without_alt': 0,
                    'page_size_kb': len(html) / 1024,
                    'analyzed_at': datetime.now().isoformat()
                }

                # Title
                title_tag = soup.find('title')
                if title_tag:
                    seo_data['title'] = title_tag.get_text(strip=True)

                # Meta description
                meta_desc = soup.find('meta', attrs={'name': 'description'})
                if meta_desc:
                    seo_data['meta_description'] = meta_desc.get('content', '')

                # Meta keywords
                meta_keywords = soup.find('meta', attrs={'name': 'keywords'})
                if meta_keywords:
                    seo_data['meta_keywords'] = meta_keywords.get('content', '')

                # H1 tags
                h1_tags = soup.find_all('h1')
                seo_data['h1_tags'] = [h1.get_text(strip=True) for h1 in h1_tags]

                # Links analysis
                all_links = soup.find_all('a', href=True)
                domain = urlparse(competitor['website']).netloc

                for link in all_links:
                    href = link['href']
                    if href.startswith('http'):
                        if domain in href:
                            seo_data['internal_links'] += 1
                        else:
                            seo_data['external_links'] += 1
                    else:
                        seo_data['internal_links'] += 1

                # Images analysis
                all_images = soup.find_all('img')
                seo_data['images'] = len(all_images)
                seo_data['images_without_alt'] = len([img for img in all_images if not img.get('alt')])

                return seo_data

        except Exception as e:
            logger.error(f"Error analyzing SEO metrics for {competitor['name']}: {e}")
            return None

    async def _store_seo_data(self, competitor_name: str, seo_data: Dict[str, Any]):
        """Store SEO data in database"""
        try:
            row_data = [
                datetime.now().isoformat(),
                competitor_name,
                seo_data['title'],
                seo_data['meta_description'],
                seo_data['meta_keywords'],
                json.dumps(seo_data['h1_tags']),
                seo_data['internal_links'],
                seo_data['external_links'],
                seo_data['images'],
                seo_data['images_without_alt'],
                seo_data['page_size_kb']
            ]

            self.clickhouse_client.insert(
                'competitor_seo',
                [row_data],
                column_names=[
                    'timestamp', 'competitor', 'title', 'meta_description',
                    'meta_keywords', 'h1_tags', 'internal_links', 'external_links',
                    'images', 'images_without_alt', 'page_size_kb'
                ]
            )

            logger.info(f"Stored SEO data for {competitor_name}")

        except Exception as e:
            logger.error(f"Error storing SEO data for {competitor_name}: {e}")

    async def _analyze_social_presence(self):
        """Analyze competitor social media presence"""
        while True:
            try:
                logger.info("Analyzing social media presence")

                # This would integrate with social media APIs
                # For now, implement basic analysis

                for competitor in self.competitors:
                    social_data = {
                        'competitor': competitor['name'],
                        'platforms': {},
                        'analyzed_at': datetime.now().isoformat()
                    }

                    # Store placeholder data
                    await self._store_social_data(competitor['name'], social_data)

                # Wait 24 hours before next social analysis
                await asyncio.sleep(86400)

            except Exception as e:
                logger.error(f"Error in social presence analysis: {e}")
                await asyncio.sleep(43200)

    async def _store_social_data(self, competitor_name: str, social_data: Dict[str, Any]):
        """Store social media data in database"""
        try:
            # Store in Redis for quick access
            redis_key = f"competitor_social:{competitor_name}"
            self.redis_client.setex(redis_key, 86400, json.dumps(social_data))

        except Exception as e:
            logger.error(f"Error storing social data for {competitor_name}: {e}")

    async def _store_trends_data(self, trends_data: Dict[str, Any]):
        """Store market trends data"""
        try:
            # Store in Redis
            self.redis_client.setex('market_trends', 86400, json.dumps(trends_data))

            # Store in ClickHouse for historical analysis
            for keyword, data in trends_data['keywords'].items():
                for point in data['interest_over_time']:
                    row_data = [
                        point['date'],
                        keyword,
                        point['interest'],
                        data['trend_direction'],
                        json.dumps(data.get('related_queries', []))
                    ]

                    self.clickhouse_client.insert(
                        'market_trends',
                        [row_data],
                        column_names=[
                            'date', 'keyword', 'interest_score',
                            'trend_direction', 'related_queries'
                        ]
                    )

            logger.info("Stored market trends data")

        except Exception as e:
            logger.error(f"Error storing trends data: {e}")

    async def _store_news_sentiment(self, news_data: Dict[str, Any]):
        """Store news sentiment data"""
        try:
            # Store in Redis
            self.redis_client.setex('news_sentiment', 86400, json.dumps(news_data))

            logger.info("Stored news sentiment data")

        except Exception as e:
            logger.error(f"Error storing news sentiment: {e}")

    def generate_competitive_intelligence_report(self,
                                               days_back: int = 30) -> Dict[str, Any]:
        """Generate comprehensive competitive intelligence report"""
        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days_back)

            report = {
                'report_period': {
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat()
                },
                'pricing_analysis': self._analyze_pricing_trends(start_date, end_date),
                'feature_comparison': self._compare_competitor_features(),
                'market_trends': self._analyze_market_trends_summary(),
                'content_changes': self._summarize_content_changes(start_date, end_date),
                'seo_comparison': self._compare_seo_metrics(),
                'recommendations': self._generate_competitive_recommendations()
            }

            return report

        except Exception as e:
            logger.error(f"Error generating competitive intelligence report: {e}")
            return {}

    def _analyze_pricing_trends(self, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Analyze competitor pricing trends"""
        try:
            query = f"""
            SELECT
                competitor,
                AVG(price) as avg_price,
                MIN(price) as min_price,
                MAX(price) as max_price,
                COUNT(*) as price_points
            FROM competitor_pricing
            WHERE timestamp >= '{start_date.isoformat()}'
            AND timestamp <= '{end_date.isoformat()}'
            GROUP BY competitor
            ORDER BY avg_price
            """

            result = self.clickhouse_client.query(query)
            pricing_analysis = {}

            for row in result.result_rows:
                pricing_analysis[row[0]] = {
                    'avg_price': row[1],
                    'min_price': row[2],
                    'max_price': row[3],
                    'price_points': row[4]
                }

            return pricing_analysis

        except Exception as e:
            logger.error(f"Error analyzing pricing trends: {e}")
            return {}

    def _compare_competitor_features(self) -> Dict[str, Any]:
        """Compare competitor features"""
        try:
            comparison = {}

            for competitor in self.competitors:
                redis_key = f"competitor_features:{competitor['name']}"
                features_data = self.redis_client.get(redis_key)

                if features_data:
                    data = json.loads(features_data)
                    comparison[competitor['name']] = {
                        'total_features': len(data['features']),
                        'feature_categories': len(data['categories']),
                        'last_updated': data['scraped_at']
                    }

            return comparison

        except Exception as e:
            logger.error(f"Error comparing features: {e}")
            return {}

    def _analyze_market_trends_summary(self) -> Dict[str, Any]:
        """Analyze market trends summary"""
        try:
            trends_data = self.redis_client.get('market_trends')

            if trends_data:
                return json.loads(trends_data)
            else:
                return {}

        except Exception as e:
            logger.error(f"Error analyzing market trends: {e}")
            return {}

    def _summarize_content_changes(self, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Summarize content changes"""
        try:
            query = f"""
            SELECT
                competitor,
                COUNT(*) as change_count
            FROM competitor_content_changes
            WHERE timestamp >= '{start_date.isoformat()}'
            AND timestamp <= '{end_date.isoformat()}'
            GROUP BY competitor
            ORDER BY change_count DESC
            """

            result = self.clickhouse_client.query(query)
            changes_summary = {}

            for row in result.result_rows:
                changes_summary[row[0]] = row[1]

            return changes_summary

        except Exception as e:
            logger.error(f"Error summarizing content changes: {e}")
            return {}

    def _compare_seo_metrics(self) -> Dict[str, Any]:
        """Compare SEO metrics across competitors"""
        try:
            query = """
            SELECT
                competitor,
                AVG(internal_links) as avg_internal_links,
                AVG(external_links) as avg_external_links,
                AVG(page_size_kb) as avg_page_size
            FROM competitor_seo
            WHERE timestamp >= (NOW() - INTERVAL 7 DAY)
            GROUP BY competitor
            """

            result = self.clickhouse_client.query(query)
            seo_comparison = {}

            for row in result.result_rows:
                seo_comparison[row[0]] = {
                    'avg_internal_links': row[1],
                    'avg_external_links': row[2],
                    'avg_page_size_kb': row[3]
                }

            return seo_comparison

        except Exception as e:
            logger.error(f"Error comparing SEO metrics: {e}")
            return {}

    def _generate_competitive_recommendations(self) -> List[str]:
        """Generate competitive intelligence recommendations"""
        recommendations = []

        try:
            # Analyze pricing position
            pricing_data = self.redis_client.get('competitor_pricing:*')

            recommendations.extend([
                "Monitor competitor pricing changes weekly for dynamic pricing opportunities",
                "Analyze feature gaps compared to top competitors",
                "Track competitor content updates for marketing intelligence",
                "Optimize SEO based on competitor best practices",
                "Monitor competitor social media engagement strategies"
            ])

        except Exception as e:
            logger.error(f"Error generating recommendations: {e}")

        return recommendations

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

    api_keys = {
        'google_trends_api': 'your_api_key',
        'news_api': 'your_news_api_key'
    }

    intelligence_engine = CompetitiveIntelligenceEngine(
        clickhouse_config, redis_config, api_keys
    )

    asyncio.run(intelligence_engine.start_competitive_monitoring())