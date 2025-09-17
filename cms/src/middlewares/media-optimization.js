const sharp = require('sharp');

module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    await next();

    // Only process media responses
    if (!ctx.url.includes('/uploads/') && !ctx.url.includes('/api/upload/')) {
      return;
    }

    // Add optimization headers for images
    if (ctx.response.body && ctx.response.get('Content-Type')?.startsWith('image/')) {
      addImageHeaders(ctx);
    }

    // Handle image transformation requests
    if (ctx.url.includes('/uploads/') && ctx.query.transform) {
      await handleImageTransformation(ctx);
    }
  };
};

function addImageHeaders(ctx) {
  // Add cache headers for images
  ctx.set('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year
  ctx.set('X-Content-Type-Options', 'nosniff');

  // Add responsive image hints
  ctx.set('Accept-CH', 'DPR, Viewport-Width, Width');
  ctx.set('Vary', 'Accept, DPR, Viewport-Width, Width');

  // Add performance hints
  ctx.set('X-Image-Optimization', 'enabled');
}

async function handleImageTransformation(ctx) {
  try {
    const {
      w: width,
      h: height,
      q: quality = 80,
      f: format,
      fit = 'cover',
      bg: background = 'ffffff'
    } = ctx.query.transform ? JSON.parse(ctx.query.transform) : ctx.query;

    // Get original image URL
    const originalUrl = ctx.url.split('?')[0];

    // Generate cache key
    const cacheKey = generateCacheKey(originalUrl, {
      width, height, quality, format, fit, background
    });

    // Check cache first (implement your cache strategy)
    const cached = await getCachedImage(cacheKey);
    if (cached) {
      ctx.body = cached.buffer;
      ctx.set('Content-Type', cached.contentType);
      ctx.set('X-Cache', 'HIT');
      return;
    }

    // Transform image
    const transformedImage = await transformImage(originalUrl, {
      width: width ? parseInt(width) : undefined,
      height: height ? parseInt(height) : undefined,
      quality: parseInt(quality),
      format,
      fit,
      background
    });

    // Cache the result
    await setCachedImage(cacheKey, transformedImage);

    // Send response
    ctx.body = transformedImage.buffer;
    ctx.set('Content-Type', transformedImage.contentType);
    ctx.set('X-Cache', 'MISS');
    ctx.set('X-Transform-Time', `${transformedImage.processingTime}ms`);

  } catch (error) {
    strapi.log.error('Image transformation error:', error);
    // Continue with original image
  }
}

async function transformImage(imageUrl, options = {}) {
  const startTime = Date.now();

  try {
    // Fetch original image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    let image = sharp(Buffer.from(buffer));

    // Apply transformations
    const {
      width,
      height,
      quality = 80,
      format,
      fit = 'cover',
      background = '#ffffff'
    } = options;

    // Resize if dimensions provided
    if (width || height) {
      const resizeOptions = {
        fit: fit,
        background: background,
        withoutEnlargement: true
      };

      image = image.resize(width, height, resizeOptions);
    }

    // Auto-optimize based on format
    let outputFormat = format;
    let contentType = 'image/jpeg';

    if (format) {
      switch (format.toLowerCase()) {
        case 'webp':
          image = image.webp({ quality, effort: 4 });
          contentType = 'image/webp';
          break;
        case 'avif':
          image = image.avif({ quality, effort: 4 });
          contentType = 'image/avif';
          break;
        case 'png':
          image = image.png({ quality, compressionLevel: 8 });
          contentType = 'image/png';
          break;
        case 'jpeg':
        case 'jpg':
        default:
          image = image.jpeg({ quality, mozjpeg: true });
          contentType = 'image/jpeg';
          break;
      }
    } else {
      // Default to JPEG optimization
      image = image.jpeg({ quality, mozjpeg: true });
    }

    const transformedBuffer = await image.toBuffer();
    const processingTime = Date.now() - startTime;

    return {
      buffer: transformedBuffer,
      contentType,
      processingTime,
      size: transformedBuffer.length
    };

  } catch (error) {
    throw new Error(`Image transformation failed: ${error.message}`);
  }
}

function generateCacheKey(url, params) {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((result, key) => {
      if (params[key] !== undefined) {
        result[key] = params[key];
      }
      return result;
    }, {});

  const paramString = JSON.stringify(sortedParams);
  return `${url}_${Buffer.from(paramString).toString('base64')}`;
}

async function getCachedImage(cacheKey) {
  // Implement your cache strategy (Redis, filesystem, etc.)
  // For now, we'll use a simple in-memory cache
  const cache = strapi.cache || new Map();
  return cache.get(cacheKey);
}

async function setCachedImage(cacheKey, imageData) {
  // Implement your cache strategy
  const cache = strapi.cache || new Map();

  // Add TTL (time to live) - 24 hours
  const ttl = 24 * 60 * 60 * 1000;
  const cacheEntry = {
    ...imageData,
    expires: Date.now() + ttl
  };

  cache.set(cacheKey, cacheEntry);

  // Clean up expired entries periodically
  if (Math.random() < 0.01) { // 1% chance
    cleanupExpiredCache(cache);
  }
}

function cleanupExpiredCache(cache) {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (value.expires && value.expires < now) {
      cache.delete(key);
    }
  }
}

// Image format detection based on user agent
function detectOptimalFormat(userAgent, acceptHeader) {
  if (!userAgent || !acceptHeader) return 'jpeg';

  // Check for AVIF support
  if (acceptHeader.includes('image/avif')) {
    return 'avif';
  }

  // Check for WebP support
  if (acceptHeader.includes('image/webp')) {
    return 'webp';
  }

  // Fallback to JPEG
  return 'jpeg';
}

// Responsive image suggestions
function generateResponsiveSizes(originalWidth, originalHeight) {
  const breakpoints = [320, 640, 768, 1024, 1280, 1536];
  const sizes = [];

  for (const breakpoint of breakpoints) {
    if (originalWidth > breakpoint) {
      const aspectRatio = originalHeight / originalWidth;
      sizes.push({
        width: breakpoint,
        height: Math.round(breakpoint * aspectRatio),
        descriptor: `${breakpoint}w`
      });
    }
  }

  return sizes;
}