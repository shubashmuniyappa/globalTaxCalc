const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class FrontendOptimizer {
  constructor(options = {}) {
    this.config = {
      // Asset optimization settings
      images: {
        quality: 85,
        progressive: true,
        mozjpeg: true,
        webp: {
          quality: 80,
          lossless: false
        },
        avif: {
          quality: 75,
          lossless: false
        },
        sizes: [320, 640, 960, 1280, 1920], // Responsive breakpoints
        formats: ['webp', 'jpg'], // Preferred formats
        lazy: true
      },

      // CSS optimization
      css: {
        critical: {
          width: 1300,
          height: 900,
          timeout: 30000,
          inline: true,
          extract: true,
          minify: true
        },
        minify: true,
        purge: true,
        autoprefixer: true
      },

      // JavaScript optimization
      javascript: {
        minify: true,
        splitChunks: true,
        treeshaking: true,
        preload: ['vendor', 'runtime'],
        prefetch: ['non-critical'],
        compression: 'brotli' // gzip, brotli
      },

      // Font optimization
      fonts: {
        preload: ['main', 'heading'],
        display: 'swap',
        subsetting: true,
        formats: ['woff2', 'woff'],
        unicodeRange: 'latin'
      },

      // Performance budgets
      budgets: {
        maxBundleSize: 250000, // 250KB
        maxImageSize: 500000,  // 500KB
        maxCSSSize: 50000,     // 50KB
        maxJSSize: 200000,     // 200KB
        lighthouse: {
          performance: 90,
          accessibility: 95,
          bestPractices: 90,
          seo: 95
        }
      },

      // Third-party optimization
      thirdParty: {
        defer: ['analytics', 'social', 'ads'],
        async: ['non-critical'],
        preconnect: ['fonts.googleapis.com', 'fonts.gstatic.com'],
        dnsPrefetch: ['www.googletagmanager.com']
      },

      ...options
    };

    this.optimizationCache = new Map();
    this.performanceMetrics = this.initializeMetrics();
  }

  /**
   * Optimize images with multiple formats and sizes
   */
  async optimizeImage(inputPath, outputDir, options = {}) {
    const {
      quality = this.config.images.quality,
      formats = this.config.images.formats,
      sizes = this.config.images.sizes,
      progressive = this.config.images.progressive
    } = options;

    try {
      const inputBuffer = await fs.readFile(inputPath);
      const inputInfo = await sharp(inputBuffer).metadata();
      const fileName = path.parse(inputPath).name;

      const optimizedImages = [];

      // Generate multiple formats and sizes
      for (const format of formats) {
        for (const size of sizes) {
          // Skip if target size is larger than original
          if (size > inputInfo.width) continue;

          const outputFileName = `${fileName}-${size}w.${format}`;
          const outputPath = path.join(outputDir, outputFileName);

          let pipeline = sharp(inputBuffer)
            .resize(size, null, {
              withoutEnlargement: true,
              fit: 'inside'
            });

          switch (format) {
            case 'webp':
              pipeline = pipeline.webp({
                quality: this.config.images.webp.quality,
                lossless: this.config.images.webp.lossless,
                progressive
              });
              break;

            case 'avif':
              pipeline = pipeline.avif({
                quality: this.config.images.avif.quality,
                lossless: this.config.images.avif.lossless
              });
              break;

            case 'jpg':
            case 'jpeg':
              pipeline = pipeline.jpeg({
                quality,
                progressive,
                mozjpeg: this.config.images.mozjpeg
              });
              break;

            case 'png':
              pipeline = pipeline.png({
                quality,
                progressive
              });
              break;
          }

          const outputBuffer = await pipeline.toBuffer();
          await fs.writeFile(outputPath, outputBuffer);

          optimizedImages.push({
            format,
            size,
            path: outputPath,
            originalSize: inputBuffer.length,
            optimizedSize: outputBuffer.length,
            savings: ((inputBuffer.length - outputBuffer.length) / inputBuffer.length) * 100
          });
        }
      }

      // Generate responsive image HTML
      const responsiveHTML = this.generateResponsiveImageHTML(fileName, optimizedImages);

      return {
        original: {
          path: inputPath,
          size: inputBuffer.length,
          dimensions: `${inputInfo.width}x${inputInfo.height}`
        },
        optimized: optimizedImages,
        html: responsiveHTML,
        totalSavings: optimizedImages.reduce((total, img) => total + img.savings, 0) / optimizedImages.length
      };

    } catch (error) {
      console.error('Error optimizing image:', error);
      throw error;
    }
  }

  /**
   * Generate responsive image HTML
   */
  generateResponsiveImageHTML(fileName, optimizedImages) {
    const formats = [...new Set(optimizedImages.map(img => img.format))];
    const sizes = [...new Set(optimizedImages.map(img => img.size))].sort((a, b) => a - b);

    let html = '<picture>\n';

    // Generate source elements for each format
    for (const format of formats) {
      if (format === 'jpg' || format === 'jpeg') continue; // Skip fallback format

      const formatImages = optimizedImages.filter(img => img.format === format);
      const srcset = formatImages
        .map(img => `${fileName}-${img.size}w.${format} ${img.size}w`)
        .join(', ');

      html += `  <source srcset="${srcset}" sizes="(max-width: 768px) 100vw, 50vw" type="image/${format}">\n`;
    }

    // Fallback img element
    const fallbackImages = optimizedImages.filter(img => img.format === 'jpg' || img.format === 'jpeg');
    if (fallbackImages.length > 0) {
      const srcset = fallbackImages
        .map(img => `${fileName}-${img.size}w.jpg ${img.size}w`)
        .join(', ');

      html += `  <img src="${fileName}-${sizes[Math.floor(sizes.length / 2)]}w.jpg" srcset="${srcset}" sizes="(max-width: 768px) 100vw, 50vw" alt="" loading="lazy" decoding="async">\n`;
    }

    html += '</picture>';

    return html;
  }

  /**
   * Extract and inline critical CSS
   */
  async extractCriticalCSS(html, css, options = {}) {
    const {
      width = this.config.css.critical.width,
      height = this.config.css.critical.height,
      timeout = this.config.css.critical.timeout,
      inline = this.config.css.critical.inline
    } = options;

    try {
      // Use critical CSS extraction (this would typically use a library like 'critical')
      const critical = require('critical');

      const result = await critical.generate({
        html,
        css,
        width,
        height,
        timeout,
        inline,
        extract: true,
        minify: true,
        ignore: {
          atrule: ['@font-face'],
          rule: [/\.hidden/],
          decl: (node, value) => /url\(/.test(value)
        }
      });

      return {
        critical: result.css || result.critical,
        remaining: result.uncritical || result.rest,
        inline: inline ? result.html : null
      };

    } catch (error) {
      console.error('Error extracting critical CSS:', error);
      // Fallback: return original CSS
      return {
        critical: css.substring(0, 1000), // First 1KB as fallback
        remaining: css.substring(1000),
        inline: null
      };
    }
  }

  /**
   * Optimize fonts for performance
   */
  async optimizeFonts(fontDir, options = {}) {
    const {
      formats = this.config.fonts.formats,
      subsetting = this.config.fonts.subsetting,
      unicodeRange = this.config.fonts.unicodeRange
    } = options;

    try {
      const fontFiles = await fs.readdir(fontDir);
      const optimizedFonts = [];

      for (const fontFile of fontFiles) {
        if (!fontFile.match(/\.(ttf|otf|woff|woff2)$/)) continue;

        const fontPath = path.join(fontDir, fontFile);
        const fontName = path.parse(fontFile).name;

        // Font optimization would typically use tools like:
        // - pyftsubset for subsetting
        // - woff2_compress for woff2 conversion
        // For this example, we'll simulate the process

        const optimizedFont = {
          name: fontName,
          original: fontFile,
          formats: [],
          preloadHint: this.generateFontPreloadHint(fontName, formats[0]),
          cssDeclaration: this.generateFontFaceCSS(fontName, formats)
        };

        optimizedFonts.push(optimizedFont);
      }

      return optimizedFonts;

    } catch (error) {
      console.error('Error optimizing fonts:', error);
      throw error;
    }
  }

  /**
   * Generate font preload hint
   */
  generateFontPreloadHint(fontName, format) {
    return `<link rel="preload" href="/fonts/${fontName}.${format}" as="font" type="font/${format}" crossorigin>`;
  }

  /**
   * Generate font-face CSS
   */
  generateFontFaceCSS(fontName, formats) {
    const srcEntries = formats.map(format => {
      const type = format === 'woff2' ? 'font/woff2' : `font/${format}`;
      return `url('/fonts/${fontName}.${format}') format('${format}')`;
    });

    return `
@font-face {
  font-family: '${fontName}';
  src: ${srcEntries.join(', ')};
  font-display: ${this.config.fonts.display};
}`;
  }

  /**
   * Generate JavaScript bundle analysis
   */
  analyzeBundles(bundleStatsPath) {
    try {
      const stats = require(bundleStatsPath);

      const analysis = {
        totalSize: 0,
        chunks: [],
        duplicates: [],
        largeModules: [],
        recommendations: []
      };

      // Analyze chunks
      stats.chunks.forEach(chunk => {
        const chunkSize = chunk.size || 0;
        analysis.totalSize += chunkSize;

        analysis.chunks.push({
          id: chunk.id,
          name: chunk.names[0] || 'unnamed',
          size: chunkSize,
          modules: chunk.modules?.length || 0,
          isEntry: chunk.entry,
          isInitial: chunk.initial
        });

        // Check against performance budget
        if (chunkSize > this.config.budgets.maxBundleSize) {
          analysis.recommendations.push({
            type: 'large_chunk',
            chunk: chunk.names[0],
            size: chunkSize,
            recommendation: 'Consider code splitting or removing unused code'
          });
        }
      });

      // Find large modules
      const allModules = stats.modules || [];
      analysis.largeModules = allModules
        .filter(module => module.size > 50000) // 50KB+
        .sort((a, b) => b.size - a.size)
        .slice(0, 10)
        .map(module => ({
          name: module.name,
          size: module.size,
          chunks: module.chunks
        }));

      return analysis;

    } catch (error) {
      console.error('Error analyzing bundles:', error);
      return null;
    }
  }

  /**
   * Generate service worker for caching
   */
  generateServiceWorker(options = {}) {
    const {
      cacheFirst = ['images', 'fonts', 'static'],
      networkFirst = ['api', 'dynamic'],
      cacheOnly = ['offline'],
      version = '1.0.0'
    } = options;

    const swCode = `
const CACHE_NAME = 'globaltaxcalc-v${version}';
const STATIC_CACHE = 'static-v${version}';
const API_CACHE = 'api-v${version}';

// Files to cache on install
const PRECACHE_URLS = [
  '/',
  '/css/critical.css',
  '/js/runtime.js',
  '/js/vendor.js',
  '/fonts/main.woff2',
  '/images/logo.webp',
  '/offline.html'
];

// Install event - precache critical resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE && cacheName !== API_CACHE)
            .map(cacheName => caches.delete(cacheName))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - handle requests with caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Cache first strategy for static assets
  if (${JSON.stringify(cacheFirst)}.some(type => request.url.includes(type))) {
    event.respondWith(cacheFirstStrategy(request));
  }
  // Network first strategy for API calls
  else if (${JSON.stringify(networkFirst)}.some(type => request.url.includes(type))) {
    event.respondWith(networkFirstStrategy(request));
  }
  // Default to network first
  else {
    event.respondWith(networkFirstStrategy(request));
  }
});

// Cache first strategy
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }
    throw error;
  }
}

// Network first strategy
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}`;

    return swCode;
  }

  /**
   * Generate resource hints for HTML
   */
  generateResourceHints(resources = {}) {
    const {
      preload = [],
      prefetch = [],
      preconnect = this.config.thirdParty.preconnect,
      dnsPrefetch = this.config.thirdParty.dnsPrefetch
    } = resources;

    let hints = '';

    // DNS prefetch hints
    dnsPrefetch.forEach(domain => {
      hints += `<link rel="dns-prefetch" href="//${domain}">\n`;
    });

    // Preconnect hints
    preconnect.forEach(domain => {
      hints += `<link rel="preconnect" href="https://${domain}" crossorigin>\n`;
    });

    // Preload hints
    preload.forEach(resource => {
      const { href, as, type, crossorigin } = resource;
      let hint = `<link rel="preload" href="${href}" as="${as}"`;
      if (type) hint += ` type="${type}"`;
      if (crossorigin) hint += ` crossorigin`;
      hint += '>\n';
      hints += hint;
    });

    // Prefetch hints
    prefetch.forEach(resource => {
      hints += `<link rel="prefetch" href="${resource.href}">\n`;
    });

    return hints;
  }

  /**
   * Optimize third-party scripts
   */
  optimizeThirdPartyScripts(scripts) {
    const optimized = [];

    scripts.forEach(script => {
      const { src, type = 'text/javascript', strategy = 'defer' } = script;

      // Determine loading strategy
      let optimizedScript = { ...script };

      if (this.config.thirdParty.defer.some(pattern => src.includes(pattern))) {
        optimizedScript.defer = true;
        optimizedScript.async = false;
      } else if (this.config.thirdParty.async.some(pattern => src.includes(pattern))) {
        optimizedScript.async = true;
        optimizedScript.defer = false;
      }

      // Add performance attributes
      optimizedScript.fetchpriority = script.critical ? 'high' : 'low';

      optimized.push(optimizedScript);
    });

    return optimized;
  }

  /**
   * Check performance budgets
   */
  checkPerformanceBudgets(metrics) {
    const violations = [];

    // Check bundle size budget
    if (metrics.bundleSize > this.config.budgets.maxBundleSize) {
      violations.push({
        type: 'bundle_size',
        actual: metrics.bundleSize,
        budget: this.config.budgets.maxBundleSize,
        message: 'Bundle size exceeds budget'
      });
    }

    // Check image size budget
    if (metrics.imageSize > this.config.budgets.maxImageSize) {
      violations.push({
        type: 'image_size',
        actual: metrics.imageSize,
        budget: this.config.budgets.maxImageSize,
        message: 'Image size exceeds budget'
      });
    }

    // Check Lighthouse scores
    const lighthouseChecks = ['performance', 'accessibility', 'bestPractices', 'seo'];
    lighthouseChecks.forEach(metric => {
      if (metrics.lighthouse && metrics.lighthouse[metric] < this.config.budgets.lighthouse[metric]) {
        violations.push({
          type: 'lighthouse_score',
          metric,
          actual: metrics.lighthouse[metric],
          budget: this.config.budgets.lighthouse[metric],
          message: `Lighthouse ${metric} score below budget`
        });
      }
    });

    return violations;
  }

  /**
   * Initialize performance metrics
   */
  initializeMetrics() {
    return {
      imagesOptimized: 0,
      totalImageSavings: 0,
      cssOptimized: 0,
      jsOptimized: 0,
      fontsOptimized: 0,
      budgetViolations: 0
    };
  }

  /**
   * Get optimization summary
   */
  getOptimizationSummary() {
    return {
      metrics: this.performanceMetrics,
      recommendations: this.generateRecommendations(),
      cacheSize: this.optimizationCache.size
    };
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations() {
    const recommendations = [];

    if (this.performanceMetrics.imagesOptimized === 0) {
      recommendations.push({
        type: 'images',
        priority: 'high',
        message: 'Optimize images with WebP/AVIF formats and responsive sizes'
      });
    }

    if (this.performanceMetrics.cssOptimized === 0) {
      recommendations.push({
        type: 'css',
        priority: 'medium',
        message: 'Extract and inline critical CSS for faster rendering'
      });
    }

    if (this.performanceMetrics.budgetViolations > 0) {
      recommendations.push({
        type: 'budget',
        priority: 'high',
        message: 'Address performance budget violations'
      });
    }

    return recommendations;
  }
}

module.exports = FrontendOptimizer;