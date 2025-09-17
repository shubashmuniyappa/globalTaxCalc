"""
Redis cache manager for the tax engine
"""

import asyncio
import json
import time
from typing import Any, Dict, List, Optional, Union

import aioredis
import structlog
from redis.exceptions import ConnectionError, TimeoutError

from .config import get_settings
from .exceptions import CacheError

logger = structlog.get_logger(__name__)
settings = get_settings()


class CacheManager:
    """Redis cache manager with automatic failover"""

    def __init__(self):
        self.redis: Optional[aioredis.Redis] = None
        self.connected = False
        self.connection_retries = 0
        self.max_retries = 3

    async def initialize(self):
        """Initialize Redis connection"""
        try:
            redis_config = settings.get_redis_config()
            self.redis = aioredis.from_url(
                redis_config["url"],
                password=redis_config.get("password"),
                db=redis_config["db"],
                decode_responses=redis_config["decode_responses"],
                encoding=redis_config["encoding"],
                socket_connect_timeout=redis_config["socket_connect_timeout"],
                socket_timeout=redis_config["socket_timeout"],
                retry_on_timeout=redis_config["retry_on_timeout"],
                health_check_interval=redis_config["health_check_interval"]
            )

            # Test connection
            await self.ping()
            self.connected = True
            self.connection_retries = 0

            logger.info("Cache manager initialized successfully")

        except Exception as e:
            logger.error("Failed to initialize cache manager", error=str(e))
            self.connected = False
            raise CacheError(f"Failed to initialize cache: {str(e)}")

    async def close(self):
        """Close Redis connection"""
        if self.redis:
            await self.redis.close()
            self.connected = False
            logger.info("Cache connection closed")

    async def ping(self) -> bool:
        """Test Redis connection"""
        if not self.redis:
            return False

        try:
            result = await self.redis.ping()
            return result
        except Exception as e:
            logger.error("Cache ping failed", error=str(e))
            return False

    async def _handle_connection_error(self, operation: str):
        """Handle Redis connection errors with retry logic"""
        self.connection_retries += 1

        if self.connection_retries <= self.max_retries:
            logger.warning(
                "Cache operation failed, retrying",
                operation=operation,
                retry=self.connection_retries,
                max_retries=self.max_retries
            )

            # Wait before retry
            await asyncio.sleep(min(2 ** self.connection_retries, 10))

            try:
                await self.initialize()
                return True
            except Exception:
                pass

        logger.error(
            "Cache operation failed after max retries",
            operation=operation,
            retries=self.connection_retries
        )
        self.connected = False
        return False

    def _get_cache_key(self, prefix: str, key: str) -> str:
        """Generate cache key with prefix"""
        return f"{settings.get_cache_prefix(prefix)}:{key}"

    async def get(self, prefix: str, key: str) -> Optional[Any]:
        """Get value from cache"""
        if not self.connected or not self.redis:
            return None

        try:
            cache_key = self._get_cache_key(prefix, key)
            value = await self.redis.get(cache_key)

            if value is not None:
                logger.debug("Cache hit", cache_key=cache_key)
                return json.loads(value)
            else:
                logger.debug("Cache miss", cache_key=cache_key)
                return None

        except (ConnectionError, TimeoutError):
            await self._handle_connection_error("get")
            return None
        except Exception as e:
            logger.error("Cache get error", key=key, error=str(e))
            return None

    async def set(
        self,
        prefix: str,
        key: str,
        value: Any,
        ttl: Optional[int] = None
    ) -> bool:
        """Set value in cache"""
        if not self.connected or not self.redis:
            return False

        try:
            cache_key = self._get_cache_key(prefix, key)
            json_value = json.dumps(value, default=str)

            if ttl:
                await self.redis.setex(cache_key, ttl, json_value)
            else:
                await self.redis.set(cache_key, json_value)

            logger.debug("Cache set", cache_key=cache_key, ttl=ttl)
            return True

        except (ConnectionError, TimeoutError):
            await self._handle_connection_error("set")
            return False
        except Exception as e:
            logger.error("Cache set error", key=key, error=str(e))
            return False

    async def delete(self, prefix: str, key: str) -> bool:
        """Delete value from cache"""
        if not self.connected or not self.redis:
            return False

        try:
            cache_key = self._get_cache_key(prefix, key)
            result = await self.redis.delete(cache_key)
            logger.debug("Cache delete", cache_key=cache_key, deleted=bool(result))
            return bool(result)

        except (ConnectionError, TimeoutError):
            await self._handle_connection_error("delete")
            return False
        except Exception as e:
            logger.error("Cache delete error", key=key, error=str(e))
            return False

    async def exists(self, prefix: str, key: str) -> bool:
        """Check if key exists in cache"""
        if not self.connected or not self.redis:
            return False

        try:
            cache_key = self._get_cache_key(prefix, key)
            result = await self.redis.exists(cache_key)
            return bool(result)

        except (ConnectionError, TimeoutError):
            await self._handle_connection_error("exists")
            return False
        except Exception as e:
            logger.error("Cache exists error", key=key, error=str(e))
            return False

    async def clear_prefix(self, prefix: str) -> int:
        """Clear all keys with given prefix"""
        if not self.connected or not self.redis:
            return 0

        try:
            pattern = f"{settings.get_cache_prefix(prefix)}:*"
            keys = await self.redis.keys(pattern)

            if keys:
                result = await self.redis.delete(*keys)
                logger.info("Cache prefix cleared", prefix=prefix, deleted_keys=result)
                return result
            else:
                return 0

        except (ConnectionError, TimeoutError):
            await self._handle_connection_error("clear_prefix")
            return 0
        except Exception as e:
            logger.error("Cache clear prefix error", prefix=prefix, error=str(e))
            return 0

    async def get_info(self) -> Dict[str, Any]:
        """Get cache information and statistics"""
        if not self.connected or not self.redis:
            return {
                "status": "disconnected",
                "connected": False
            }

        try:
            info = await self.redis.info()
            memory_info = await self.redis.info("memory")

            return {
                "status": "connected",
                "connected": True,
                "redis_version": info.get("redis_version"),
                "used_memory": memory_info.get("used_memory_human"),
                "connected_clients": info.get("connected_clients"),
                "total_commands_processed": info.get("total_commands_processed"),
                "keyspace_hits": info.get("keyspace_hits", 0),
                "keyspace_misses": info.get("keyspace_misses", 0),
                "hit_rate": self._calculate_hit_rate(info)
            }

        except Exception as e:
            logger.error("Failed to get cache info", error=str(e))
            return {
                "status": "error",
                "connected": False,
                "error": str(e)
            }

    def _calculate_hit_rate(self, info: Dict[str, Any]) -> float:
        """Calculate cache hit rate"""
        hits = info.get("keyspace_hits", 0)
        misses = info.get("keyspace_misses", 0)
        total = hits + misses

        if total == 0:
            return 0.0

        return (hits / total) * 100


class TaxRuleCache:
    """Specialized cache for tax rules"""

    def __init__(self, cache_manager: CacheManager):
        self.cache = cache_manager
        self.prefix = "tax_rules"

    async def get_tax_rules(self, country: str, tax_year: int) -> Optional[Dict[str, Any]]:
        """Get tax rules from cache"""
        key = f"{country}:{tax_year}"
        return await self.cache.get(self.prefix, key)

    async def set_tax_rules(
        self,
        country: str,
        tax_year: int,
        rules: Dict[str, Any]
    ) -> bool:
        """Set tax rules in cache"""
        key = f"{country}:{tax_year}"
        return await self.cache.set(
            self.prefix,
            key,
            rules,
            ttl=settings.tax_rules_cache_ttl
        )

    async def invalidate_country_rules(self, country: str) -> int:
        """Invalidate all rules for a country"""
        return await self.cache.clear_prefix(f"{self.prefix}:{country}")


class CalculationCache:
    """Specialized cache for calculation results"""

    def __init__(self, cache_manager: CacheManager):
        self.cache = cache_manager
        self.prefix = "calculations"

    def _generate_calculation_key(self, calculation_data: Dict[str, Any]) -> str:
        """Generate a unique key for calculation data"""
        import hashlib

        # Sort the dictionary to ensure consistent hashing
        sorted_data = json.dumps(calculation_data, sort_keys=True)
        return hashlib.md5(sorted_data.encode()).hexdigest()

    async def get_calculation(self, calculation_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Get calculation result from cache"""
        key = self._generate_calculation_key(calculation_data)
        return await self.cache.get(self.prefix, key)

    async def set_calculation(
        self,
        calculation_data: Dict[str, Any],
        result: Dict[str, Any]
    ) -> bool:
        """Set calculation result in cache"""
        key = self._generate_calculation_key(calculation_data)
        return await self.cache.set(
            self.prefix,
            key,
            result,
            ttl=settings.calculation_cache_ttl
        )


class OptimizationCache:
    """Specialized cache for optimization results"""

    def __init__(self, cache_manager: CacheManager):
        self.cache = cache_manager
        self.prefix = "optimizations"

    def _generate_optimization_key(self, optimization_data: Dict[str, Any]) -> str:
        """Generate a unique key for optimization data"""
        import hashlib

        # Sort the dictionary to ensure consistent hashing
        sorted_data = json.dumps(optimization_data, sort_keys=True)
        return hashlib.md5(sorted_data.encode()).hexdigest()

    async def get_optimization(self, optimization_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Get optimization result from cache"""
        key = self._generate_optimization_key(optimization_data)
        return await self.cache.get(self.prefix, key)

    async def set_optimization(
        self,
        optimization_data: Dict[str, Any],
        result: Dict[str, Any]
    ) -> bool:
        """Set optimization result in cache"""
        key = self._generate_optimization_key(optimization_data)
        return await self.cache.set(
            self.prefix,
            key,
            result,
            ttl=settings.optimization_cache_ttl
        )