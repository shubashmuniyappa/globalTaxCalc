const config = require('../config');
const Redis = require('ioredis');

class LoadingOptimizationService {
  constructor() {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.cacheDb
    });

    this.loadingStrategies = new Map();
    this.performanceMetrics = new Map();
    this.coreWebVitals = new Map();

    this.init();
  }

  async init() {
    await this.loadLoadingStrategies();
    await this.initializePerformanceTracking();
  }

  async loadLoadingStrategies() {
    const strategies = [
      {
        id: 'lazy_loading',
        name: 'Lazy Loading',
        description: 'Load ads only when they come into viewport',
        enabled: config.performance.lazyLoadingEnabled,
        priority: 1,
        conditions: ['below_fold', 'low_priority'],
        implementation: this.generateLazyLoadingCode
      },
      {
        id: 'progressive_enhancement',
        name: 'Progressive Enhancement',
        description: 'Load ads after critical content',
        enabled: true,
        priority: 2,
        conditions: ['slow_connection', 'mobile_device'],
        implementation: this.generateProgressiveCode
      },
      {
        id: 'async_loading',
        name: 'Asynchronous Loading',
        description: 'Non-blocking asynchronous ad loading',
        enabled: true,
        priority: 3,
        conditions: ['all'],
        implementation: this.generateAsyncCode
      },
      {
        id: 'preload_optimization',
        name: 'Preload Optimization',
        description: 'Preload critical ad resources',
        enabled: true,
        priority: 4,
        conditions: ['high_priority', 'fast_connection'],
        implementation: this.generatePreloadCode
      },
      {
        id: 'intersection_observer',
        name: 'Intersection Observer',
        description: 'Modern viewport detection for ad loading',
        enabled: true,
        priority: 5,
        conditions: ['modern_browser'],
        implementation: this.generateIntersectionObserverCode
      }
    ];

    for (const strategy of strategies) {
      this.loadingStrategies.set(strategy.id, strategy);
    }
  }

  async getOptimizedAdCode(placement, context) {
    try {
      // Determine optimal loading strategy
      const strategy = await this.selectLoadingStrategy(placement, context);

      // Generate optimized ad code
      const adCode = await this.generateOptimizedCode(placement, context, strategy);

      // Add performance monitoring
      const monitoringCode = this.generateMonitoringCode(placement);

      // Combine everything
      return {
        adCode: adCode,
        monitoringCode: monitoringCode,
        strategy: strategy.id,
        loadingConfig: {
          lazy: strategy.id === 'lazy_loading' || strategy.id === 'intersection_observer',
          async: true,
          timeout: config.performance.adLoadTimeout,
          fallback: true,
          preload: strategy.id === 'preload_optimization'
        }
      };

    } catch (error) {
      console.error('Error generating optimized ad code:', error);
      return this.getFallbackCode(placement);
    }
  }

  async selectLoadingStrategy(placement, context) {
    // Analyze context to determine best strategy
    const deviceType = context.device || 'desktop';
    const connectionSpeed = context.connectionSpeed || 'fast';
    const position = placement.location;
    const userAgent = context.userAgent || '';

    // Check if modern browser supports Intersection Observer
    const supportsIntersectionObserver = this.supportsModernFeatures(userAgent);

    // Determine if ad is below the fold
    const isBelowFold = this.isBelowFold(position);

    // Mobile optimization
    if (deviceType === 'mobile') {
      if (isBelowFold && supportsIntersectionObserver) {
        return this.loadingStrategies.get('intersection_observer');
      } else if (isBelowFold) {
        return this.loadingStrategies.get('lazy_loading');
      } else {
        return this.loadingStrategies.get('progressive_enhancement');
      }
    }

    // Slow connection optimization
    if (connectionSpeed === 'slow' || connectionSpeed === '2g' || connectionSpeed === '3g') {
      return this.loadingStrategies.get('progressive_enhancement');
    }

    // High priority placements (above fold)
    if (!isBelowFold && placement.priority <= 2) {
      return this.loadingStrategies.get('preload_optimization');
    }

    // Default to async loading for most cases
    if (supportsIntersectionObserver && isBelowFold) {
      return this.loadingStrategies.get('intersection_observer');
    }

    return this.loadingStrategies.get('async_loading');
  }

  supportsModernFeatures(userAgent) {
    // Simple check for modern browser capabilities
    const modernBrowsers = [
      /Chrome\/[6-9]\d/,
      /Firefox\/[6-9]\d/,
      /Safari\/[1-9]\d/,
      /Edge\/[1-9]\d/
    ];

    return modernBrowsers.some(regex => regex.test(userAgent));
  }

  isBelowFold(position) {
    const belowFoldPositions = [
      config.adPlacements.locations.CONTENT_BOTTOM,
      config.adPlacements.locations.FOOTER,
      config.adPlacements.locations.SIDEBAR
    ];

    return belowFoldPositions.includes(position);
  }

  async generateOptimizedCode(placement, context, strategy) {
    // Get base ad code from strategy implementation
    const baseCode = strategy.implementation.call(this, placement, context);

    // Add Core Web Vitals optimization
    const optimizedCode = this.addCoreWebVitalsOptimization(baseCode, placement);

    // Add error handling and fallback
    const robustCode = this.addErrorHandling(optimizedCode, placement);

    return robustCode;
  }

  generateLazyLoadingCode(placement, context) {
    return `
      <div id="${placement.id}" class="ad-placeholder" data-ad-unit="${placement.unitId}">
        <script>
          (function() {
            var adContainer = document.getElementById('${placement.id}');
            var observer = new IntersectionObserver(function(entries) {
              entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                  observer.unobserve(entry.target);
                  loadAd_${placement.id}();
                }
              });
            }, {
              rootMargin: '50px 0px',
              threshold: 0.1
            });

            if (adContainer) {
              observer.observe(adContainer);
            }

            function loadAd_${placement.id}() {
              // Record load start time for performance measurement
              var loadStart = performance.now();

              // Create ad container
              var adDiv = document.createElement('div');
              adDiv.style.width = '${placement.size.width}px';
              adDiv.style.height = '${placement.size.height}px';

              // Ad network specific code would go here
              ${this.getNetworkSpecificCode(placement)}

              adContainer.appendChild(adDiv);

              // Record load completion
              var loadEnd = performance.now();
              window.adPerformance = window.adPerformance || {};
              window.adPerformance['${placement.id}'] = {
                loadTime: loadEnd - loadStart,
                strategy: 'lazy_loading',
                timestamp: Date.now()
              };
            }
          })();
        </script>
      </div>
    `;
  }

  generateProgressiveCode(placement, context) {
    return `
      <div id="${placement.id}" class="ad-container" data-ad-unit="${placement.unitId}">
        <script>
          (function() {
            // Wait for critical content to load
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', function() {
                setTimeout(loadAd_${placement.id}, 100);
              });
            } else {
              setTimeout(loadAd_${placement.id}, 100);
            }

            function loadAd_${placement.id}() {
              var loadStart = performance.now();
              var adContainer = document.getElementById('${placement.id}');

              if (!adContainer) return;

              // Progressive enhancement: Check if network is available
              if (navigator.onLine === false) {
                showFallbackContent();
                return;
              }

              // Load ad with timeout
              var timeout = setTimeout(function() {
                showFallbackContent();
              }, ${config.performance.adLoadTimeout});

              ${this.getNetworkSpecificCode(placement)}

              clearTimeout(timeout);

              var loadEnd = performance.now();
              window.adPerformance = window.adPerformance || {};
              window.adPerformance['${placement.id}'] = {
                loadTime: loadEnd - loadStart,
                strategy: 'progressive_enhancement',
                timestamp: Date.now()
              };
            }

            function showFallbackContent() {
              var adContainer = document.getElementById('${placement.id}');
              adContainer.innerHTML = '<div class="ad-fallback">Advertisement</div>';
            }
          })();
        </script>
      </div>
    `;
  }

  generateAsyncCode(placement, context) {
    return `
      <div id="${placement.id}" class="ad-container" data-ad-unit="${placement.unitId}">
        <script async>
          (function() {
            var loadStart = performance.now();

            // Asynchronous ad loading
            function loadAd_${placement.id}() {
              var script = document.createElement('script');
              script.async = true;
              script.onload = function() {
                var loadEnd = performance.now();
                window.adPerformance = window.adPerformance || {};
                window.adPerformance['${placement.id}'] = {
                  loadTime: loadEnd - loadStart,
                  strategy: 'async_loading',
                  timestamp: Date.now()
                };
              };

              script.onerror = function() {
                console.warn('Failed to load ad for placement ${placement.id}');
                showFallbackAd();
              };

              ${this.getNetworkSpecificCode(placement)}

              document.head.appendChild(script);
            }

            function showFallbackAd() {
              var adContainer = document.getElementById('${placement.id}');
              if (adContainer) {
                adContainer.innerHTML = '<div class="ad-fallback">Advertisement</div>';
              }
            }

            // Load immediately for async strategy
            loadAd_${placement.id}();
          })();
        </script>
      </div>
    `;
  }

  generatePreloadCode(placement, context) {
    return `
      <link rel="preload" href="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js" as="script" crossorigin>
      <div id="${placement.id}" class="ad-container priority-ad" data-ad-unit="${placement.unitId}">
        <script>
          (function() {
            var loadStart = performance.now();

            // Preload critical ad resources
            function preloadAdResources() {
              var link = document.createElement('link');
              link.rel = 'dns-prefetch';
              link.href = '//googleads.g.doubleclick.net';
              document.head.appendChild(link);

              var link2 = document.createElement('link');
              link2.rel = 'dns-prefetch';
              link2.href = '//pagead2.googlesyndication.com';
              document.head.appendChild(link2);
            }

            // Load ad immediately for high priority
            function loadAd_${placement.id}() {
              preloadAdResources();

              ${this.getNetworkSpecificCode(placement)}

              var loadEnd = performance.now();
              window.adPerformance = window.adPerformance || {};
              window.adPerformance['${placement.id}'] = {
                loadTime: loadEnd - loadStart,
                strategy: 'preload_optimization',
                timestamp: Date.now()
              };
            }

            loadAd_${placement.id}();
          })();
        </script>
      </div>
    `;
  }

  generateIntersectionObserverCode(placement, context) {
    return `
      <div id="${placement.id}" class="ad-container modern-lazy" data-ad-unit="${placement.unitId}">
        <script>
          (function() {
            if (!('IntersectionObserver' in window)) {
              // Fallback for older browsers
              ${this.generateLazyLoadingCode(placement, context)}
              return;
            }

            var loadStart = performance.now();
            var adContainer = document.getElementById('${placement.id}');
            var hasLoaded = false;

            var observer = new IntersectionObserver(function(entries) {
              entries.forEach(function(entry) {
                if (entry.isIntersecting && !hasLoaded) {
                  hasLoaded = true;
                  observer.unobserve(entry.target);
                  loadAd_${placement.id}();
                }
              });
            }, {
              rootMargin: '100px 0px',
              threshold: [0, 0.25, 0.5, 0.75, 1]
            });

            if (adContainer) {
              observer.observe(adContainer);
            }

            function loadAd_${placement.id}() {
              // Track viewability from the start
              var viewabilityObserver = new IntersectionObserver(function(entries) {
                entries.forEach(function(entry) {
                  var viewablePercentage = entry.intersectionRatio;
                  if (viewablePercentage >= 0.5) {
                    // Ad is 50% viewable
                    reportViewability('${placement.id}', viewablePercentage);
                  }
                });
              }, {
                threshold: [0.5, 0.75, 1]
              });

              ${this.getNetworkSpecificCode(placement)}

              viewabilityObserver.observe(adContainer);

              var loadEnd = performance.now();
              window.adPerformance = window.adPerformance || {};
              window.adPerformance['${placement.id}'] = {
                loadTime: loadEnd - loadStart,
                strategy: 'intersection_observer',
                timestamp: Date.now()
              };
            }

            function reportViewability(placementId, viewability) {
              // Send viewability data to analytics
              if (window.gtag) {
                window.gtag('event', 'ad_viewable', {
                  'placement_id': placementId,
                  'viewability_score': viewability
                });
              }
            }
          })();
        </script>
      </div>
    `;
  }

  getNetworkSpecificCode(placement) {
    // This would be dynamically generated based on the selected network
    return `
      // Network-specific ad code placeholder
      var adElement = document.createElement('div');
      adElement.innerHTML = 'Ad content for ${placement.unitId}';
      adElement.style.width = '${placement.size.width}px';
      adElement.style.height = '${placement.size.height}px';
      adElement.style.border = '1px solid #ddd';
      adElement.style.textAlign = 'center';
      adElement.style.paddingTop = '${Math.floor(placement.size.height / 2 - 10)}px';
      document.getElementById('${placement.id}').appendChild(adElement);
    `;
  }

  addCoreWebVitalsOptimization(code, placement) {
    return `
      ${code}
      <script>
        // Core Web Vitals optimization
        (function() {
          // Measure Cumulative Layout Shift (CLS)
          var clsObserver = new PerformanceObserver(function(entryList) {
            var entries = entryList.getEntries();
            entries.forEach(function(entry) {
              if (!entry.hadRecentInput) {
                window.adCoreWebVitals = window.adCoreWebVitals || {};
                window.adCoreWebVitals.cls = (window.adCoreWebVitals.cls || 0) + entry.value;
              }
            });
          });

          if ('PerformanceObserver' in window) {
            clsObserver.observe({entryTypes: ['layout-shift']});
          }

          // Optimize for Largest Contentful Paint (LCP)
          function optimizeLCP() {
            var adContainer = document.getElementById('${placement.id}');
            if (adContainer) {
              // Ensure ad container has proper dimensions to prevent layout shift
              adContainer.style.width = '${placement.size.width}px';
              adContainer.style.height = '${placement.size.height}px';
              adContainer.style.minHeight = '${placement.size.height}px';
            }
          }

          optimizeLCP();

          // Report Core Web Vitals
          window.addEventListener('beforeunload', function() {
            var vitals = window.adCoreWebVitals || {};
            if (vitals.cls !== undefined) {
              navigator.sendBeacon('/api/ads/core-web-vitals', JSON.stringify({
                placementId: '${placement.id}',
                cls: vitals.cls,
                timestamp: Date.now()
              }));
            }
          });
        })();
      </script>
    `;
  }

  addErrorHandling(code, placement) {
    return `
      ${code}
      <script>
        // Error handling and fallback
        (function() {
          window.addEventListener('error', function(event) {
            if (event.target && event.target.src &&
                (event.target.src.includes('googlesyndication.com') ||
                 event.target.src.includes('media.net'))) {

              console.warn('Ad loading error for placement ${placement.id}:', event.error);

              // Show fallback content
              var adContainer = document.getElementById('${placement.id}');
              if (adContainer && !adContainer.querySelector('.ad-fallback')) {
                adContainer.innerHTML = '<div class="ad-fallback" style="' +
                  'width: ${placement.size.width}px; ' +
                  'height: ${placement.size.height}px; ' +
                  'border: 1px solid #e0e0e0; ' +
                  'display: flex; ' +
                  'align-items: center; ' +
                  'justify-content: center; ' +
                  'background: #f9f9f9; ' +
                  'color: #666; ' +
                  'font-size: 12px;">Advertisement</div>';
              }

              // Report error to analytics
              if (window.gtag) {
                window.gtag('event', 'ad_error', {
                  'placement_id': '${placement.id}',
                  'error_type': 'network_error'
                });
              }
            }
          });

          // Timeout fallback
          setTimeout(function() {
            var adContainer = document.getElementById('${placement.id}');
            if (adContainer && adContainer.children.length === 0) {
              console.warn('Ad timeout for placement ${placement.id}');
              adContainer.innerHTML = '<div class="ad-timeout">Ad loading timeout</div>';

              if (window.gtag) {
                window.gtag('event', 'ad_timeout', {
                  'placement_id': '${placement.id}'
                });
              }
            }
          }, ${config.performance.adLoadTimeout});
        })();
      </script>
    `;
  }

  generateMonitoringCode(placement) {
    return `
      <script>
        // Performance monitoring for placement ${placement.id}
        (function() {
          var startTime = performance.now();

          // Monitor loading performance
          function reportPerformance() {
            var endTime = performance.now();
            var loadTime = endTime - startTime;

            var performanceData = {
              placementId: '${placement.id}',
              loadTime: loadTime,
              timestamp: Date.now(),
              strategy: window.adPerformance && window.adPerformance['${placement.id}'] ?
                        window.adPerformance['${placement.id}'].strategy : 'unknown'
            };

            // Send to analytics endpoint
            if (navigator.sendBeacon) {
              navigator.sendBeacon('/api/ads/performance', JSON.stringify(performanceData));
            }
          }

          // Report when ad is fully loaded
          var adContainer = document.getElementById('${placement.id}');
          if (adContainer) {
            var observer = new MutationObserver(function(mutations) {
              mutations.forEach(function(mutation) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                  reportPerformance();
                  observer.disconnect();
                }
              });
            });

            observer.observe(adContainer, { childList: true, subtree: true });
          }

          // Fallback timeout reporting
          setTimeout(reportPerformance, ${config.performance.adLoadTimeout + 1000});
        })();
      </script>
    `;
  }

  getFallbackCode(placement) {
    return {
      adCode: `
        <div id="${placement.id}" class="ad-container ad-fallback">
          <div style="
            width: ${placement.size.width}px;
            height: ${placement.size.height}px;
            border: 1px solid #ddd;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f5f5f5;
            color: #666;
            font-size: 14px;
          ">
            Advertisement
          </div>
        </div>
      `,
      monitoringCode: '',
      strategy: 'fallback',
      loadingConfig: {
        lazy: false,
        async: false,
        timeout: 0,
        fallback: true,
        preload: false
      }
    };
  }

  async trackLoadingPerformance(placementId, loadTime, strategy, context = {}) {
    const performanceData = {
      placementId,
      loadTime,
      strategy,
      timestamp: Date.now(),
      device: context.device,
      country: context.country,
      connectionSpeed: context.connectionSpeed
    };

    // Store performance data
    await this.redis.lpush('loading_performance', JSON.stringify(performanceData));
    await this.redis.ltrim('loading_performance', 0, 9999); // Keep last 10k entries
    await this.redis.expire('loading_performance', 86400 * 7); // 7 days

    // Update averages
    await this.updatePerformanceAverages(strategy, loadTime, context);
  }

  async updatePerformanceAverages(strategy, loadTime, context) {
    const avgKey = `avg_load_time:${strategy}:${context.device || 'unknown'}`;

    // Get current average
    const currentData = await this.redis.hmget(avgKey, 'total', 'count');
    const currentTotal = parseFloat(currentData[0] || 0);
    const currentCount = parseInt(currentData[1] || 0);

    // Update with new data
    const newTotal = currentTotal + loadTime;
    const newCount = currentCount + 1;
    const newAverage = newTotal / newCount;

    await this.redis.hmset(avgKey, {
      total: newTotal,
      count: newCount,
      average: newAverage.toFixed(2)
    });

    await this.redis.expire(avgKey, 86400); // 24 hours
  }

  async trackCoreWebVitals(placementId, vitals, context = {}) {
    const vitalsData = {
      placementId,
      cls: vitals.cls,
      lcp: vitals.lcp,
      fid: vitals.fid,
      timestamp: Date.now(),
      device: context.device,
      country: context.country
    };

    await this.redis.lpush('core_web_vitals', JSON.stringify(vitalsData));
    await this.redis.ltrim('core_web_vitals', 0, 9999);
    await this.redis.expire('core_web_vitals', 86400 * 7);

    // Check if vitals are above thresholds
    if (vitals.cls > 0.1) { // CLS threshold
      console.warn(`High CLS detected for placement ${placementId}: ${vitals.cls}`);
    }

    if (vitals.lcp > 2500) { // LCP threshold in ms
      console.warn(`High LCP detected for placement ${placementId}: ${vitals.lcp}ms`);
    }
  }

  async getLoadingPerformanceReport(timeRange = '24h') {
    const report = {
      timeRange,
      totalMeasurements: 0,
      averageLoadTime: 0,
      strategyBreakdown: {},
      deviceBreakdown: {},
      coreWebVitals: {
        averageCLS: 0,
        averageLCP: 0,
        averageFID: 0
      },
      recommendations: []
    };

    try {
      // Get performance data
      const performanceData = await this.redis.lrange('loading_performance', 0, -1);
      const vitalsData = await this.redis.lrange('core_web_vitals', 0, -1);

      // Filter by time range
      const cutoffTime = Date.now() - this.getTimeRangeMs(timeRange);

      const filteredPerformance = performanceData
        .map(item => JSON.parse(item))
        .filter(item => item.timestamp > cutoffTime);

      const filteredVitals = vitalsData
        .map(item => JSON.parse(item))
        .filter(item => item.timestamp > cutoffTime);

      report.totalMeasurements = filteredPerformance.length;

      if (filteredPerformance.length > 0) {
        // Calculate average load time
        const totalLoadTime = filteredPerformance.reduce((sum, item) => sum + item.loadTime, 0);
        report.averageLoadTime = totalLoadTime / filteredPerformance.length;

        // Strategy breakdown
        const strategies = {};
        filteredPerformance.forEach(item => {
          if (!strategies[item.strategy]) {
            strategies[item.strategy] = { count: 0, totalTime: 0, avgTime: 0 };
          }
          strategies[item.strategy].count++;
          strategies[item.strategy].totalTime += item.loadTime;
        });

        for (const [strategy, data] of Object.entries(strategies)) {
          data.avgTime = data.totalTime / data.count;
          report.strategyBreakdown[strategy] = data;
        }

        // Device breakdown
        const devices = {};
        filteredPerformance.forEach(item => {
          const device = item.device || 'unknown';
          if (!devices[device]) {
            devices[device] = { count: 0, totalTime: 0, avgTime: 0 };
          }
          devices[device].count++;
          devices[device].totalTime += item.loadTime;
        });

        for (const [device, data] of Object.entries(devices)) {
          data.avgTime = data.totalTime / data.count;
          report.deviceBreakdown[device] = data;
        }
      }

      // Core Web Vitals analysis
      if (filteredVitals.length > 0) {
        const totalCLS = filteredVitals.reduce((sum, item) => sum + (item.cls || 0), 0);
        const totalLCP = filteredVitals.reduce((sum, item) => sum + (item.lcp || 0), 0);
        const totalFID = filteredVitals.reduce((sum, item) => sum + (item.fid || 0), 0);

        report.coreWebVitals.averageCLS = totalCLS / filteredVitals.length;
        report.coreWebVitals.averageLCP = totalLCP / filteredVitals.length;
        report.coreWebVitals.averageFID = totalFID / filteredVitals.length;
      }

      // Generate recommendations
      report.recommendations = this.generateOptimizationRecommendations(report);

    } catch (error) {
      console.error('Error generating loading performance report:', error);
    }

    return report;
  }

  getTimeRangeMs(timeRange) {
    switch (timeRange) {
      case '1h': return 60 * 60 * 1000;
      case '24h': return 24 * 60 * 60 * 1000;
      case '7d': return 7 * 24 * 60 * 60 * 1000;
      case '30d': return 30 * 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000;
    }
  }

  generateOptimizationRecommendations(report) {
    const recommendations = [];

    // Load time recommendations
    if (report.averageLoadTime > 1000) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: `Average load time (${report.averageLoadTime.toFixed(0)}ms) exceeds 1 second. Consider implementing lazy loading for below-fold ads.`
      });
    }

    // Core Web Vitals recommendations
    if (report.coreWebVitals.averageCLS > 0.1) {
      recommendations.push({
        type: 'core_web_vitals',
        priority: 'high',
        message: `High Cumulative Layout Shift (${report.coreWebVitals.averageCLS.toFixed(3)}). Ensure ad containers have fixed dimensions.`
      });
    }

    if (report.coreWebVitals.averageLCP > 2500) {
      recommendations.push({
        type: 'core_web_vitals',
        priority: 'medium',
        message: `High Largest Contentful Paint (${report.coreWebVitals.averageLCP.toFixed(0)}ms). Consider preloading critical ad resources.`
      });
    }

    // Strategy recommendations
    const worstStrategy = Object.entries(report.strategyBreakdown)
      .sort(([,a], [,b]) => b.avgTime - a.avgTime)[0];

    if (worstStrategy && worstStrategy[1].avgTime > 1500) {
      recommendations.push({
        type: 'strategy',
        priority: 'medium',
        message: `${worstStrategy[0]} strategy has high load times (${worstStrategy[1].avgTime.toFixed(0)}ms). Consider switching to async or lazy loading.`
      });
    }

    // Device-specific recommendations
    const mobilePerf = report.deviceBreakdown.mobile;
    if (mobilePerf && mobilePerf.avgTime > 800) {
      recommendations.push({
        type: 'mobile',
        priority: 'high',
        message: `Mobile load times are high (${mobilePerf.avgTime.toFixed(0)}ms). Implement mobile-specific optimizations.`
      });
    }

    return recommendations;
  }

  async initializePerformanceTracking() {
    // Initialize performance tracking data structures
    const strategies = Array.from(this.loadingStrategies.keys());

    for (const strategy of strategies) {
      const avgKey = `avg_load_time:${strategy}:global`;
      const exists = await this.redis.exists(avgKey);

      if (!exists) {
        await this.redis.hmset(avgKey, {
          total: '0',
          count: '0',
          average: '0'
        });
      }
    }
  }

  async healthCheck() {
    try {
      await this.redis.ping();

      const performanceCount = await this.redis.llen('loading_performance');
      const vitalsCount = await this.redis.llen('core_web_vitals');

      return {
        status: 'healthy',
        loadingStrategies: this.loadingStrategies.size,
        performanceMeasurements: performanceCount,
        coreWebVitalsMeasurements: vitalsCount,
        lazyLoadingEnabled: config.performance.lazyLoadingEnabled
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

module.exports = new LoadingOptimizationService();