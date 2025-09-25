"""
Currency Conversion System

Provides real-time and historical currency conversion functionality
with support for multiple exchange rate APIs, caching, and localized
number formatting for the multi-country tax engine.
"""

import asyncio
import aiohttp
import json
import logging
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Optional, Any, Union
import redis
from dataclasses import dataclass, asdict
import os

logger = logging.getLogger(__name__)

@dataclass
class ExchangeRate:
    """Exchange rate data structure"""
    from_currency: str
    to_currency: str
    rate: Decimal
    timestamp: datetime
    source: str
    is_historical: bool = False

@dataclass
class CurrencyInfo:
    """Currency information and formatting rules"""
    code: str
    name: str
    symbol: str
    decimal_places: int
    thousand_separator: str
    decimal_separator: str
    symbol_position: str  # 'before' or 'after'

class CurrencyConverter:
    """
    Comprehensive currency conversion system with multiple providers,
    caching, and localized formatting support.
    """

    def __init__(self, redis_url: str = None, api_keys: Dict[str, str] = None):
        self.redis_client = None
        if redis_url:
            try:
                self.redis_client = redis.from_url(redis_url)
            except Exception as e:
                logger.warning(f"Redis connection failed: {e}")

        self.api_keys = api_keys or {}
        self.cache_ttl = 3600  # 1 hour cache for live rates
        self.historical_cache_ttl = 86400 * 7  # 7 days for historical rates

        # Currency information
        self.currencies = self._load_currency_info()

        # Exchange rate providers (in order of preference)
        self.providers = [
            'exchangerate_api',
            'fixer_io',
            'currencylayer',
            'openexchangerates'
        ]

    def _load_currency_info(self) -> Dict[str, CurrencyInfo]:
        """Load currency information and formatting rules"""
        return {
            'USD': CurrencyInfo('USD', 'US Dollar', '$', 2, ',', '.', 'before'),
            'EUR': CurrencyInfo('EUR', 'Euro', '€', 2, '.', ',', 'before'),
            'GBP': CurrencyInfo('GBP', 'British Pound', '£', 2, ',', '.', 'before'),
            'JPY': CurrencyInfo('JPY', 'Japanese Yen', '¥', 0, ',', '.', 'before'),
            'INR': CurrencyInfo('INR', 'Indian Rupee', '₹', 2, ',', '.', 'before'),
            'SGD': CurrencyInfo('SGD', 'Singapore Dollar', 'S$', 2, ',', '.', 'before'),
            'BRL': CurrencyInfo('BRL', 'Brazilian Real', 'R$', 2, '.', ',', 'before'),
            'MXN': CurrencyInfo('MXN', 'Mexican Peso', '$', 2, ',', '.', 'before'),
            'CAD': CurrencyInfo('CAD', 'Canadian Dollar', 'C$', 2, ',', '.', 'before'),
            'AUD': CurrencyInfo('AUD', 'Australian Dollar', 'A$', 2, ',', '.', 'before'),
            'CHF': CurrencyInfo('CHF', 'Swiss Franc', 'CHF', 2, "'", '.', 'after'),
            'SEK': CurrencyInfo('SEK', 'Swedish Krona', 'kr', 2, ' ', ',', 'after'),
            'NOK': CurrencyInfo('NOK', 'Norwegian Krone', 'kr', 2, ' ', ',', 'after'),
            'DKK': CurrencyInfo('DKK', 'Danish Krone', 'kr', 2, '.', ',', 'after'),
            'CNY': CurrencyInfo('CNY', 'Chinese Yuan', '¥', 2, ',', '.', 'before'),
            'KRW': CurrencyInfo('KRW', 'South Korean Won', '₩', 0, ',', '.', 'before'),
            'THB': CurrencyInfo('THB', 'Thai Baht', '฿', 2, ',', '.', 'before'),
            'MYR': CurrencyInfo('MYR', 'Malaysian Ringgit', 'RM', 2, ',', '.', 'before'),
            'PHP': CurrencyInfo('PHP', 'Philippine Peso', '₱', 2, ',', '.', 'before'),
            'IDR': CurrencyInfo('IDR', 'Indonesian Rupiah', 'Rp', 0, '.', ',', 'before'),
            'VND': CurrencyInfo('VND', 'Vietnamese Dong', '₫', 0, '.', ',', 'after'),
            'TWD': CurrencyInfo('TWD', 'Taiwan Dollar', 'NT$', 2, ',', '.', 'before'),
            'HKD': CurrencyInfo('HKD', 'Hong Kong Dollar', 'HK$', 2, ',', '.', 'before'),
            'NZD': CurrencyInfo('NZD', 'New Zealand Dollar', 'NZ$', 2, ',', '.', 'before'),
            'ZAR': CurrencyInfo('ZAR', 'South African Rand', 'R', 2, ' ', '.', 'before'),
            'RUB': CurrencyInfo('RUB', 'Russian Ruble', '₽', 2, ' ', ',', 'after'),
            'TRY': CurrencyInfo('TRY', 'Turkish Lira', '₺', 2, '.', ',', 'before'),
            'PLN': CurrencyInfo('PLN', 'Polish Złoty', 'zł', 2, ' ', ',', 'after'),
            'CZK': CurrencyInfo('CZK', 'Czech Koruna', 'Kč', 2, ' ', ',', 'after'),
            'HUF': CurrencyInfo('HUF', 'Hungarian Forint', 'Ft', 0, ' ', ',', 'after'),
            'ILS': CurrencyInfo('ILS', 'Israeli Shekel', '₪', 2, ',', '.', 'before'),
            'AED': CurrencyInfo('AED', 'UAE Dirham', 'د.إ', 2, ',', '.', 'before'),
            'SAR': CurrencyInfo('SAR', 'Saudi Riyal', '﷼', 2, ',', '.', 'before')
        }

    async def get_exchange_rate(
        self,
        from_currency: str,
        to_currency: str,
        date: Optional[datetime] = None
    ) -> Optional[ExchangeRate]:
        """
        Get exchange rate between two currencies.

        Args:
            from_currency: Source currency code
            to_currency: Target currency code
            date: Optional date for historical rates

        Returns:
            ExchangeRate object or None if not available
        """
        from_currency = from_currency.upper()
        to_currency = to_currency.upper()

        # Handle same currency
        if from_currency == to_currency:
            return ExchangeRate(
                from_currency=from_currency,
                to_currency=to_currency,
                rate=Decimal('1.0'),
                timestamp=datetime.now(),
                source='same_currency',
                is_historical=date is not None
            )

        # Check cache first
        rate = await self._get_cached_rate(from_currency, to_currency, date)
        if rate:
            return rate

        # Fetch from API providers
        rate = await self._fetch_rate_from_providers(from_currency, to_currency, date)
        if rate:
            await self._cache_rate(rate)
            return rate

        logger.error(f"Failed to get exchange rate for {from_currency} to {to_currency}")
        return None

    async def convert_amount(
        self,
        amount: Union[Decimal, float, int],
        from_currency: str,
        to_currency: str,
        date: Optional[datetime] = None
    ) -> Optional[Decimal]:
        """
        Convert amount from one currency to another.

        Args:
            amount: Amount to convert
            from_currency: Source currency
            to_currency: Target currency
            date: Optional date for historical conversion

        Returns:
            Converted amount or None if conversion failed
        """
        if isinstance(amount, (float, int)):
            amount = Decimal(str(amount))

        rate = await self.get_exchange_rate(from_currency, to_currency, date)
        if not rate:
            return None

        converted = amount * rate.rate
        return self._round_currency_amount(converted, to_currency)

    async def get_multiple_rates(
        self,
        base_currency: str,
        target_currencies: List[str],
        date: Optional[datetime] = None
    ) -> Dict[str, Optional[ExchangeRate]]:
        """Get multiple exchange rates for a base currency"""
        tasks = []
        for target in target_currencies:
            task = self.get_exchange_rate(base_currency, target, date)
            tasks.append(task)

        results = await asyncio.gather(*tasks, return_exceptions=True)

        return {
            target: result if not isinstance(result, Exception) else None
            for target, result in zip(target_currencies, results)
        }

    async def _get_cached_rate(
        self,
        from_currency: str,
        to_currency: str,
        date: Optional[datetime]
    ) -> Optional[ExchangeRate]:
        """Get cached exchange rate"""
        if not self.redis_client:
            return None

        try:
            cache_key = self._generate_cache_key(from_currency, to_currency, date)
            cached_data = self.redis_client.get(cache_key)

            if cached_data:
                data = json.loads(cached_data)
                return ExchangeRate(
                    from_currency=data['from_currency'],
                    to_currency=data['to_currency'],
                    rate=Decimal(data['rate']),
                    timestamp=datetime.fromisoformat(data['timestamp']),
                    source=data['source'],
                    is_historical=data['is_historical']
                )
        except Exception as e:
            logger.warning(f"Cache retrieval failed: {e}")

        return None

    async def _cache_rate(self, rate: ExchangeRate) -> None:
        """Cache exchange rate"""
        if not self.redis_client:
            return

        try:
            cache_key = self._generate_cache_key(
                rate.from_currency,
                rate.to_currency,
                None if not rate.is_historical else rate.timestamp
            )

            ttl = self.historical_cache_ttl if rate.is_historical else self.cache_ttl

            rate_data = asdict(rate)
            rate_data['rate'] = str(rate.rate)
            rate_data['timestamp'] = rate.timestamp.isoformat()

            self.redis_client.setex(
                cache_key,
                ttl,
                json.dumps(rate_data)
            )
        except Exception as e:
            logger.warning(f"Cache storage failed: {e}")

    async def _fetch_rate_from_providers(
        self,
        from_currency: str,
        to_currency: str,
        date: Optional[datetime]
    ) -> Optional[ExchangeRate]:
        """Fetch exchange rate from API providers"""
        for provider in self.providers:
            try:
                rate = await self._fetch_from_provider(provider, from_currency, to_currency, date)
                if rate:
                    return rate
            except Exception as e:
                logger.warning(f"Provider {provider} failed: {e}")
                continue

        return None

    async def _fetch_from_provider(
        self,
        provider: str,
        from_currency: str,
        to_currency: str,
        date: Optional[datetime]
    ) -> Optional[ExchangeRate]:
        """Fetch rate from specific provider"""
        if provider == 'exchangerate_api':
            return await self._fetch_exchangerate_api(from_currency, to_currency, date)
        elif provider == 'fixer_io':
            return await self._fetch_fixer_io(from_currency, to_currency, date)
        elif provider == 'currencylayer':
            return await self._fetch_currencylayer(from_currency, to_currency, date)
        elif provider == 'openexchangerates':
            return await self._fetch_openexchangerates(from_currency, to_currency, date)

        return None

    async def _fetch_exchangerate_api(
        self,
        from_currency: str,
        to_currency: str,
        date: Optional[datetime]
    ) -> Optional[ExchangeRate]:
        """Fetch from ExchangeRate-API"""
        api_key = self.api_keys.get('exchangerate_api')
        base_url = "https://v6.exchangerate-api.com/v6"

        if date:
            # Historical rates
            date_str = date.strftime('%Y-%m-%d')
            url = f"{base_url}/{api_key}/history/{from_currency}/{date_str}"
        else:
            # Latest rates
            url = f"{base_url}/{api_key}/pair/{from_currency}/{to_currency}"

        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status == 200:
                    data = await response.json()

                    if date:
                        rate_value = data.get('conversion_rates', {}).get(to_currency)
                    else:
                        rate_value = data.get('conversion_rate')

                    if rate_value:
                        return ExchangeRate(
                            from_currency=from_currency,
                            to_currency=to_currency,
                            rate=Decimal(str(rate_value)),
                            timestamp=date or datetime.now(),
                            source='exchangerate_api',
                            is_historical=date is not None
                        )

        return None

    async def _fetch_fixer_io(
        self,
        from_currency: str,
        to_currency: str,
        date: Optional[datetime]
    ) -> Optional[ExchangeRate]:
        """Fetch from Fixer.io"""
        api_key = self.api_keys.get('fixer_io')
        if not api_key:
            return None

        base_url = "http://data.fixer.io/api"

        if date:
            date_str = date.strftime('%Y-%m-%d')
            url = f"{base_url}/{date_str}"
        else:
            url = f"{base_url}/latest"

        params = {
            'access_key': api_key,
            'base': from_currency,
            'symbols': to_currency
        }

        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()

                    if data.get('success') and to_currency in data.get('rates', {}):
                        rate_value = data['rates'][to_currency]
                        return ExchangeRate(
                            from_currency=from_currency,
                            to_currency=to_currency,
                            rate=Decimal(str(rate_value)),
                            timestamp=date or datetime.now(),
                            source='fixer_io',
                            is_historical=date is not None
                        )

        return None

    def _generate_cache_key(
        self,
        from_currency: str,
        to_currency: str,
        date: Optional[datetime]
    ) -> str:
        """Generate cache key for exchange rate"""
        if date:
            date_str = date.strftime('%Y-%m-%d')
            return f"exchange_rate:{from_currency}:{to_currency}:{date_str}"
        else:
            return f"exchange_rate:{from_currency}:{to_currency}:latest"

    def _round_currency_amount(self, amount: Decimal, currency: str) -> Decimal:
        """Round amount according to currency decimal places"""
        currency_info = self.currencies.get(currency.upper())
        if not currency_info:
            return amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        if currency_info.decimal_places == 0:
            return amount.quantize(Decimal('1'), rounding=ROUND_HALF_UP)
        else:
            decimal_places = '0.' + '0' * (currency_info.decimal_places - 1) + '1'
            return amount.quantize(Decimal(decimal_places), rounding=ROUND_HALF_UP)

    def format_currency(
        self,
        amount: Union[Decimal, float, int],
        currency: str,
        include_symbol: bool = True,
        locale_style: bool = True
    ) -> str:
        """
        Format currency amount according to local conventions.

        Args:
            amount: Amount to format
            currency: Currency code
            include_symbol: Whether to include currency symbol
            locale_style: Whether to use locale-specific formatting

        Returns:
            Formatted currency string
        """
        if isinstance(amount, (float, int)):
            amount = Decimal(str(amount))

        currency = currency.upper()
        currency_info = self.currencies.get(currency)

        if not currency_info:
            # Fallback formatting
            return f"{currency} {amount:,.2f}"

        # Round to appropriate decimal places
        rounded_amount = self._round_currency_amount(amount, currency)

        if locale_style:
            # Format with locale-specific separators
            formatted = self._format_with_separators(
                rounded_amount,
                currency_info.decimal_places,
                currency_info.thousand_separator,
                currency_info.decimal_separator
            )
        else:
            # Standard formatting
            if currency_info.decimal_places == 0:
                formatted = f"{rounded_amount:,.0f}".replace(',', currency_info.thousand_separator)
            else:
                formatted = f"{rounded_amount:,.{currency_info.decimal_places}f}"

        if include_symbol:
            if currency_info.symbol_position == 'before':
                return f"{currency_info.symbol}{formatted}"
            else:
                return f"{formatted} {currency_info.symbol}"
        else:
            return formatted

    def _format_with_separators(
        self,
        amount: Decimal,
        decimal_places: int,
        thousand_separator: str,
        decimal_separator: str
    ) -> str:
        """Format number with custom separators"""
        # Convert to string with appropriate decimal places
        if decimal_places == 0:
            amount_str = str(int(amount))
            decimal_part = ""
        else:
            amount_str = f"{amount:.{decimal_places}f}"
            integer_part, decimal_part = amount_str.split('.')
            decimal_part = decimal_separator + decimal_part

        # Add thousand separators
        integer_part = str(int(float(amount_str.split('.')[0])))
        if len(integer_part) > 3:
            # Add thousand separators from right to left
            result = ""
            for i, digit in enumerate(reversed(integer_part)):
                if i > 0 and i % 3 == 0:
                    result = thousand_separator + result
                result = digit + result
            integer_part = result

        return integer_part + decimal_part

    def get_supported_currencies(self) -> List[Dict[str, str]]:
        """Get list of supported currencies"""
        return [
            {
                'code': info.code,
                'name': info.name,
                'symbol': info.symbol
            }
            for info in self.currencies.values()
        ]

    def validate_currency_code(self, currency: str) -> bool:
        """Validate if currency code is supported"""
        return currency.upper() in self.currencies

    async def get_currency_trends(
        self,
        from_currency: str,
        to_currency: str,
        days: int = 30
    ) -> List[Dict[str, Any]]:
        """Get currency trends over specified period"""
        trends = []
        end_date = datetime.now()

        for i in range(days):
            historical_date = end_date - timedelta(days=i)
            rate = await self.get_exchange_rate(from_currency, to_currency, historical_date)

            if rate:
                trends.append({
                    'date': historical_date.strftime('%Y-%m-%d'),
                    'rate': float(rate.rate),
                    'timestamp': historical_date.isoformat()
                })

        return list(reversed(trends))  # Return in chronological order

    async def bulk_convert(
        self,
        conversions: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Perform bulk currency conversions.

        Args:
            conversions: List of conversion requests
                [{'amount': 100, 'from': 'USD', 'to': 'EUR', 'date': None}, ...]

        Returns:
            List of conversion results
        """
        tasks = []
        for conversion in conversions:
            task = self.convert_amount(
                conversion['amount'],
                conversion['from'],
                conversion['to'],
                conversion.get('date')
            )
            tasks.append(task)

        results = await asyncio.gather(*tasks, return_exceptions=True)

        output = []
        for i, result in enumerate(results):
            conversion = conversions[i]
            if isinstance(result, Exception):
                output.append({
                    'original': conversion,
                    'converted_amount': None,
                    'error': str(result)
                })
            else:
                output.append({
                    'original': conversion,
                    'converted_amount': float(result) if result else None,
                    'error': None if result else 'Conversion failed'
                })

        return output