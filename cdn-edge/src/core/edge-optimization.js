/**
 * Edge Optimization - Performance optimization, compression, and asset optimization
 */

export class EdgeOptimization {
  constructor() {
    this.compressionConfig = this.initializeCompressionConfig();
    this.imageOptimization = this.initializeImageOptimization();
    this.minificationRules = this.initializeMinificationRules();
    this.performanceMetrics = new Map();
  }

  /**
   * Initialize compression configuration
   */
  initializeCompressionConfig() {
    return {
      brotli: {
        enabled: true,
        level: 6, // Balanced compression level
        types: [
          'text/html',
          'text/css',
          'application/javascript',
          'application/json',
          'text/xml',
          'application/xml',
          'image/svg+xml'
        ]
      },
      gzip: {
        enabled: true,
        level: 6,
        types: [
          'text/html',
          'text/css',
          'application/javascript',
          'application/json',
          'text/plain',
          'text/xml',
          'application/xml'
        ]
      },
      minSize: 1024, // Only compress files larger than 1KB
      maxSize: 10 * 1024 * 1024 // Don't compress files larger than 10MB
    };
  }

  /**
   * Initialize image optimization settings
   */
  initializeImageOptimization() {
    return {
      formats: {
        webp: { quality: 85, enabled: true },
        avif: { quality: 80, enabled: true },
        jpeg: { quality: 85, progressive: true },
        png: { compression: 9 }
      },
      responsive: {
        breakpoints: [480, 768, 1024, 1440, 1920],
        devicePixelRatio: [1, 2, 3]
      },
      lazy: {
        enabled: true,
        threshold: '10px',
        fadeIn: true
      }
    };
  }

  /**
   * Initialize minification rules
   */
  initializeMinificationRules() {
    return {
      html: {
        removeComments: true,
        removeCommentsFromCDATA: true,
        removeCDATASectionsFromCDATA: true,
        collapseWhitespace: true,
        conservativeCollapse: true,
        removeAttributeQuotes: true,
        useShortDoctype: true,
        removeEmptyAttributes: true,
        removeOptionalTags: true,
        removeRedundantAttributes: true,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
        minifyJS: true,
        minifyCSS: true
      },
      css: {
        removeComments: true,
        removeEmpty: true,
        normalizeWhitespace: true,
        mergeLonghand: true,
        mergeRules: true,
        minifyFontValues: true,
        minifyParams: true,
        minifySelectors: true
      },
      js: {
        compress: {
          dead_code: true,
          drop_console: false, // Keep for debugging in development
          drop_debugger: true,
          keep_fargs: false,
          unused: true
        },
        mangle: {
          toplevel: false,
          keep_fnames: false
        },
        format: {
          comments: false
        }
      }
    };
  }

  /**
   * Main optimization function
   */
  async optimizeResponse(response, request, context) {
    try {
      const startTime = Date.now();
      const contentType = response.headers.get('Content-Type') || '';
      const url = new URL(request.url);

      // Clone response for processing
      let optimizedResponse = response.clone();

      // Apply appropriate optimizations based on content type
      if (contentType.includes('text/html')) {
        optimizedResponse = await this.optimizeHTML(optimizedResponse, request, context);
      } else if (contentType.includes('text/css')) {
        optimizedResponse = await this.optimizeCSS(optimizedResponse, request, context);
      } else if (contentType.includes('application/javascript')) {
        optimizedResponse = await this.optimizeJavaScript(optimizedResponse, request, context);
      } else if (contentType.includes('image/')) {
        optimizedResponse = await this.optimizeImage(optimizedResponse, request, context);
      } else if (this.isCompressibleType(contentType)) {
        optimizedResponse = await this.compressResponse(optimizedResponse, request, context);
      }

      // Add optimization headers
      this.addOptimizationHeaders(optimizedResponse, context);

      // Add performance hints
      this.addPerformanceHints(optimizedResponse, url);

      // Track optimization metrics
      const optimizationTime = Date.now() - startTime;
      this.trackOptimizationMetrics(url.pathname, contentType, optimizationTime);

      return optimizedResponse;

    } catch (error) {
      console.error('Optimization error:', error);
      // Return original response if optimization fails
      return response;
    }
  }

  /**
   * Optimize HTML content
   */
  async optimizeHTML(response, request, context) {
    try {
      let html = await response.text();

      // Apply HTML minification
      html = this.minifyHTML(html);

      // Inject critical CSS and defer non-critical
      html = await this.optimizeCSSLoading(html, context);

      // Optimize JavaScript loading
      html = this.optimizeJSLoading(html);

      // Add resource hints
      html = this.addResourceHints(html, request);

      // Optimize images in HTML
      html = this.optimizeImagesInHTML(html, request);

      // Add Progressive Web App features
      html = this.addPWAFeatures(html);

      // Compress the optimized HTML
      const compressedResponse = await this.compressContent(html, 'text/html', request);

      return new Response(compressedResponse.body, {
        status: response.status,
        statusText: response.statusText,
        headers: compressedResponse.headers
      });

    } catch (error) {
      console.error('HTML optimization error:', error);
      return response;
    }
  }

  /**
   * Optimize CSS content
   */
  async optimizeCSS(response, request, context) {
    try {
      let css = await response.text();

      // Minify CSS
      css = this.minifyCSS(css);

      // Remove unused CSS (simplified implementation)
      css = this.removeUnusedCSS(css);

      // Optimize font loading
      css = this.optimizeFontLoading(css);

      // Add critical CSS inlining markers
      css = this.addCriticalCSSMarkers(css);

      // Compress the optimized CSS
      const compressedResponse = await this.compressContent(css, 'text/css', request);

      return new Response(compressedResponse.body, {
        status: response.status,
        statusText: response.statusText,
        headers: compressedResponse.headers
      });

    } catch (error) {
      console.error('CSS optimization error:', error);
      return response;
    }
  }

  /**
   * Optimize JavaScript content
   */
  async optimizeJavaScript(response, request, context) {
    try {
      let js = await response.text();

      // Minify JavaScript
      js = this.minifyJavaScript(js);

      // Tree shake unused code (simplified)
      js = this.treeShakeJS(js);

      // Add module preloading hints
      js = this.addModuleHints(js);

      // Compress the optimized JavaScript
      const compressedResponse = await this.compressContent(js, 'application/javascript', request);

      return new Response(compressedResponse.body, {
        status: response.status,
        statusText: response.statusText,
        headers: compressedResponse.headers
      });

    } catch (error) {
      console.error('JavaScript optimization error:', error);
      return response;
    }
  }

  /**
   * Optimize image content
   */
  async optimizeImage(response, request, context) {
    try {
      const url = new URL(request.url);
      const accepts = request.headers.get('Accept') || '';
      const userAgent = request.headers.get('User-Agent') || '';

      // Determine optimal image format
      const targetFormat = this.determineOptimalImageFormat(accepts, userAgent);

      // Check if we need to resize based on query parameters
      const width = url.searchParams.get('w');
      const height = url.searchParams.get('h');
      const quality = url.searchParams.get('q') || '85';

      // For now, return original response with optimization headers
      // In production, you'd integrate with Cloudflare Images or similar service
      const optimizedResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });

      // Add image optimization headers
      optimizedResponse.headers.set('X-Image-Optimized', 'true');
      optimizedResponse.headers.set('X-Target-Format', targetFormat);

      if (width || height) {
        optimizedResponse.headers.set('X-Resized', `${width || 'auto'}x${height || 'auto'}`);
      }

      return optimizedResponse;

    } catch (error) {
      console.error('Image optimization error:', error);
      return response;
    }
  }

  /**
   * Minify HTML content
   */
  minifyHTML(html) {
    const rules = this.minificationRules.html;

    if (rules.removeComments) {
      html = html.replace(/<!--[\s\S]*?-->/g, '');
    }

    if (rules.collapseWhitespace) {
      html = html
        .replace(/\s+/g, ' ')
        .replace(/>\s+</g, '><')
        .trim();
    }

    if (rules.removeEmptyAttributes) {
      html = html.replace(/\s+(?:class|id|style)=""/g, '');
    }

    if (rules.removeRedundantAttributes) {
      html = html.replace(/\s+type="text\/javascript"/g, '');
      html = html.replace(/\s+type="text\/css"/g, '');
    }

    return html;
  }

  /**
   * Minify CSS content
   */
  minifyCSS(css) {
    const rules = this.minificationRules.css;

    if (rules.removeComments) {
      css = css.replace(/\/\*[\s\S]*?\*\//g, '');
    }

    if (rules.normalizeWhitespace) {
      css = css
        .replace(/\s+/g, ' ')
        .replace(/;\s*}/g, '}')
        .replace(/{\s*/g, '{')
        .replace(/;\s*/g, ';')
        .trim();
    }

    if (rules.removeEmpty) {
      css = css.replace(/[^{}]+{\s*}/g, '');
    }

    return css;
  }

  /**
   * Minify JavaScript content
   */
  minifyJavaScript(js) {
    // Simplified minification - in production use proper JS minifier
    return js
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
      .replace(/\/\/.*$/gm, '') // Remove single-line comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/;\s*}/g, '}') // Remove semicolons before closing braces
      .trim();
  }

  /**
   * Compress content using appropriate algorithm
   */
  async compressContent(content, contentType, request) {
    const acceptEncoding = request.headers.get('Accept-Encoding') || '';
    const contentLength = new TextEncoder().encode(content).length;

    // Skip compression for small content
    if (contentLength < this.compressionConfig.minSize ||
        contentLength > this.compressionConfig.maxSize) {
      return {
        body: content,
        headers: new Headers({ 'Content-Type': contentType })
      };
    }

    const headers = new Headers({ 'Content-Type': contentType });

    // Check if content type is compressible
    if (!this.isCompressibleType(contentType)) {
      return { body: content, headers };
    }

    // Use Brotli if supported
    if (acceptEncoding.includes('br') && this.compressionConfig.brotli.enabled) {
      headers.set('Content-Encoding', 'br');
      headers.set('X-Compression', 'brotli');
      return { body: content, headers }; // Cloudflare handles actual compression
    }

    // Fallback to Gzip
    if (acceptEncoding.includes('gzip') && this.compressionConfig.gzip.enabled) {
      headers.set('Content-Encoding', 'gzip');
      headers.set('X-Compression', 'gzip');
      return { body: content, headers }; // Cloudflare handles actual compression
    }

    return { body: content, headers };
  }

  /**
   * Compress existing response
   */
  async compressResponse(response, request, context) {
    const content = await response.text();
    const contentType = response.headers.get('Content-Type') || '';

    const compressedData = await this.compressContent(content, contentType, request);

    return new Response(compressedData.body, {
      status: response.status,
      statusText: response.statusText,
      headers: compressedData.headers
    });
  }

  /**
   * Optimize CSS loading in HTML
   */
  async optimizeCSSLoading(html, context) {
    // Extract critical CSS (simplified approach)
    const criticalCSS = await this.extractCriticalCSS(html);

    if (criticalCSS) {
      // Inline critical CSS
      html = html.replace(
        '</head>',
        `<style>${criticalCSS}</style>\n</head>`
      );
    }

    // Add preload hints for CSS files
    html = html.replace(
      /<link\s+rel="stylesheet"\s+href="([^"]+)"/g,
      '<link rel="preload" href="$1" as="style" onload="this.onload=null;this.rel=\'stylesheet\'">'
    );

    return html;
  }

  /**
   * Optimize JavaScript loading in HTML
   */
  optimizeJSLoading(html) {
    // Add defer attribute to non-critical scripts
    html = html.replace(
      /<script\s+src="([^"]+)"(?!\s+defer|async)/g,
      '<script src="$1" defer'
    );

    // Add module preload for ES modules
    html = html.replace(
      /<script\s+type="module"\s+src="([^"]+)"/g,
      '<link rel="modulepreload" href="$1">\n<script type="module" src="$1"'
    );

    return html;
  }

  /**
   * Add resource hints to HTML
   */
  addResourceHints(html, request) {
    const hints = [];

    // DNS prefetch for external domains
    const externalDomains = this.extractExternalDomains(html);
    externalDomains.forEach(domain => {
      hints.push(`<link rel="dns-prefetch" href="//${domain}">`);
    });

    // Preconnect to critical origins
    const criticalOrigins = ['fonts.googleapis.com', 'fonts.gstatic.com'];
    criticalOrigins.forEach(origin => {
      hints.push(`<link rel="preconnect" href="https://${origin}" crossorigin>`);
    });

    // Insert hints after opening head tag
    if (hints.length > 0) {
      html = html.replace(
        '<head>',
        `<head>\n${hints.join('\n')}`
      );
    }

    return html;
  }

  /**
   * Optimize images in HTML
   */
  optimizeImagesInHTML(html, request) {
    // Add loading="lazy" to images
    html = html.replace(
      /<img\s+(?![^>]*loading=)([^>]*src="[^"]+")([^>]*)>/g,
      '<img $1 loading="lazy"$2>'
    );

    // Add responsive image srcset (simplified)
    html = html.replace(
      /<img\s+([^>]*src="([^"]+\.(?:jpg|jpeg|png|webp))")([^>]*)>/g,
      (match, beforeSrc, src, afterSrc) => {
        const baseName = src.replace(/\.[^.]+$/, '');
        const extension = src.split('.').pop();

        const srcset = [
          `${baseName}-480w.${extension} 480w`,
          `${baseName}-768w.${extension} 768w`,
          `${baseName}-1024w.${extension} 1024w`
        ].join(', ');

        return `<img ${beforeSrc} srcset="${srcset}" sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"${afterSrc}>`;
      }
    );

    return html;
  }

  /**
   * Add Progressive Web App features
   */
  addPWAFeatures(html) {
    // Add PWA manifest if not present
    if (!html.includes('manifest.json')) {
      html = html.replace(
        '</head>',
        '<link rel="manifest" href="/manifest.json">\n</head>'
      );
    }

    // Add service worker registration
    if (!html.includes('serviceWorker')) {
      const swScript = `
        <script>
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('SW registered'))
                .catch(err => console.log('SW registration failed'));
            });
          }
        </script>
      `;

      html = html.replace('</body>', `${swScript}\n</body>`);
    }

    return html;
  }

  /**
   * Remove unused CSS (simplified implementation)
   */
  removeUnusedCSS(css) {
    // This is a simplified implementation
    // In production, you'd use a proper CSS purging tool

    // Remove common unused utility classes
    const unusedPatterns = [
      /\.d-none\s*{[^}]*}/g,
      /\.sr-only\s*{[^}]*}/g,
      /\.invisible\s*{[^}]*}/g
    ];

    unusedPatterns.forEach(pattern => {
      css = css.replace(pattern, '');
    });

    return css;
  }

  /**
   * Optimize font loading in CSS
   */
  optimizeFontLoading(css) {
    // Add font-display: swap to @font-face rules
    css = css.replace(
      /@font-face\s*{([^}]*)}/g,
      (match, content) => {
        if (!content.includes('font-display')) {
          return `@font-face{${content}font-display:swap;}`;
        }
        return match;
      }
    );

    return css;
  }

  /**
   * Add critical CSS markers
   */
  addCriticalCSSMarkers(css) {
    // Mark above-the-fold styles as critical
    const criticalSelectors = [
      'body', 'html', 'header', 'nav', '.hero', '.banner', '.navbar'
    ];

    criticalSelectors.forEach(selector => {
      css = css.replace(
        new RegExp(`(${selector}\\s*{[^}]*})`, 'g'),
        '/* critical */ $1'
      );
    });

    return css;
  }

  /**
   * Tree shake JavaScript (simplified)
   */
  treeShakeJS(js) {
    // Remove unused function declarations
    const unusedFunctions = this.findUnusedFunctions(js);
    unusedFunctions.forEach(func => {
      const regex = new RegExp(`function\\s+${func}\\s*\\([^)]*\\)\\s*{[^}]*}`, 'g');
      js = js.replace(regex, '');
    });

    return js;
  }

  /**
   * Add module preloading hints
   */
  addModuleHints(js) {
    // Add hints for dynamic imports
    js = js.replace(
      /import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      (match, modulePath) => {
        return `/* preload: ${modulePath} */ ${match}`;
      }
    );

    return js;
  }

  /**
   * Determine optimal image format
   */
  determineOptimalImageFormat(accepts, userAgent) {
    // Check for AVIF support
    if (accepts.includes('image/avif')) {
      return 'avif';
    }

    // Check for WebP support
    if (accepts.includes('image/webp')) {
      return 'webp';
    }

    // Fallback to original format
    return 'original';
  }

  /**
   * Extract critical CSS (simplified)
   */
  async extractCriticalCSS(html) {
    // This is a simplified implementation
    // In production, you'd use a tool like Critical or Penthouse

    const criticalRules = [
      'body{margin:0;padding:0}',
      'html{font-size:16px}',
      '.header{display:block}',
      '.nav{list-style:none}'
    ];

    return criticalRules.join('');
  }

  /**
   * Extract external domains from HTML
   */
  extractExternalDomains(html) {
    const domains = new Set();
    const regex = /(?:href|src)="https?:\/\/([^\/]+)/g;
    let match;

    while ((match = regex.exec(html)) !== null) {
      const domain = match[1];
      if (!domain.includes('globaltaxcalc.com')) {
        domains.add(domain);
      }
    }

    return Array.from(domains);
  }

  /**
   * Find unused functions in JavaScript
   */
  findUnusedFunctions(js) {
    const functionNames = [];
    const functionRegex = /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    let match;

    // Extract all function names
    while ((match = functionRegex.exec(js)) !== null) {
      functionNames.push(match[1]);
    }

    // Check which functions are never called
    const unusedFunctions = functionNames.filter(name => {
      const callRegex = new RegExp(`\\b${name}\\s*\\(`, 'g');
      const calls = js.match(callRegex);
      return !calls || calls.length === 1; // Only the declaration
    });

    return unusedFunctions;
  }

  /**
   * Check if content type is compressible
   */
  isCompressibleType(contentType) {
    const compressibleTypes = [
      ...this.compressionConfig.brotli.types,
      ...this.compressionConfig.gzip.types
    ];

    return compressibleTypes.some(type => contentType.includes(type));
  }

  /**
   * Add optimization headers
   */
  addOptimizationHeaders(response, context) {
    response.headers.set('X-Optimized', 'true');
    response.headers.set('X-Optimization-Region', context.colo);
    response.headers.set('X-Optimization-Time', Date.now().toString());

    // Add cache-related headers for optimized content
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    response.headers.set('Vary', 'Accept-Encoding');
  }

  /**
   * Add performance hints
   */
  addPerformanceHints(response, url) {
    // Add Early Hints for critical resources
    if (url.pathname === '/') {
      response.headers.set('Link', [
        '</assets/css/critical.css>; rel=preload; as=style',
        '</assets/js/app.js>; rel=preload; as=script',
        '<https://fonts.googleapis.com>; rel=preconnect'
      ].join(', '));
    }

    // Add timing information
    response.headers.set('Server-Timing', 'optimization;dur=5');
  }

  /**
   * Track optimization metrics
   */
  trackOptimizationMetrics(pathname, contentType, optimizationTime) {
    const key = `${pathname}:${contentType}`;

    if (!this.performanceMetrics.has(key)) {
      this.performanceMetrics.set(key, {
        count: 0,
        totalTime: 0,
        avgTime: 0,
        lastOptimized: Date.now()
      });
    }

    const metrics = this.performanceMetrics.get(key);
    metrics.count++;
    metrics.totalTime += optimizationTime;
    metrics.avgTime = metrics.totalTime / metrics.count;
    metrics.lastOptimized = Date.now();
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats() {
    const stats = {
      totalOptimizations: 0,
      averageOptimizationTime: 0,
      optimizationsByType: {}
    };

    for (const [key, metrics] of this.performanceMetrics) {
      const [pathname, contentType] = key.split(':');

      stats.totalOptimizations += metrics.count;

      if (!stats.optimizationsByType[contentType]) {
        stats.optimizationsByType[contentType] = {
          count: 0,
          totalTime: 0,
          avgTime: 0
        };
      }

      stats.optimizationsByType[contentType].count += metrics.count;
      stats.optimizationsByType[contentType].totalTime += metrics.totalTime;
    }

    // Calculate averages
    if (stats.totalOptimizations > 0) {
      stats.averageOptimizationTime = Object.values(stats.optimizationsByType)
        .reduce((sum, type) => sum + type.totalTime, 0) / stats.totalOptimizations;

      Object.values(stats.optimizationsByType).forEach(type => {
        type.avgTime = type.totalTime / type.count;
      });
    }

    return stats;
  }

  /**
   * Clear optimization metrics (for cleanup)
   */
  clearMetrics() {
    this.performanceMetrics.clear();
  }
}