const localeConfig = require('../../config/locales');

module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    // Skip non-API requests
    if (!ctx.url.startsWith('/api/')) {
      return await next();
    }

    // Detect locale from various sources
    const detectedLocale = detectLocale(ctx);

    // Set locale in context
    ctx.state.locale = detectedLocale;

    // Add locale to query if not present
    if (!ctx.query.locale) {
      ctx.query.locale = detectedLocale;
    }

    // Add locale-specific headers
    ctx.set('Content-Language', detectedLocale);
    ctx.set('Vary', 'Accept-Language');

    // Set cache headers based on locale
    const cacheKey = `${ctx.path}_${detectedLocale}`;
    ctx.set('Cache-Key', cacheKey);

    await next();

    // Add hreflang links for SEO
    if (ctx.response.body && ctx.response.body.data) {
      addHreflangHeaders(ctx, detectedLocale);
    }
  };
};

function detectLocale(ctx) {
  const { locales, defaultLocale, detection } = localeConfig;

  if (!detection.enabled) {
    return defaultLocale;
  }

  for (const method of detection.order) {
    let locale = null;

    switch (method) {
      case 'querystring':
        locale = ctx.query.locale || ctx.query.lang;
        break;

      case 'cookie':
        locale = ctx.cookies.get(detection.cookieName);
        break;

      case 'header':
        const acceptLanguage = ctx.get('Accept-Language');
        if (acceptLanguage) {
          // Parse Accept-Language header
          const languages = acceptLanguage
            .split(',')
            .map(lang => {
              const [code, q = '1'] = lang.trim().split(';q=');
              return { code: code.toLowerCase(), quality: parseFloat(q) };
            })
            .sort((a, b) => b.quality - a.quality);

          // Find best matching locale
          for (const { code } of languages) {
            const matchingLocale = locales.find(l =>
              l.code.toLowerCase() === code ||
              l.code.toLowerCase().startsWith(code.split('-')[0])
            );
            if (matchingLocale) {
              locale = matchingLocale.code;
              break;
            }
          }
        }
        break;

      case 'path':
        // Extract locale from URL path
        const pathSegments = ctx.path.split('/').filter(Boolean);
        if (pathSegments.length > 1 && pathSegments[0] === 'api' && pathSegments[1]) {
          const potentialLocale = pathSegments[1];
          const foundLocale = locales.find(l => l.code === potentialLocale);
          if (foundLocale) {
            locale = foundLocale.code;
          }
        }
        break;
    }

    // Validate locale
    if (locale && locales.find(l => l.code === locale)) {
      // Set cookie if using cookie caching
      if (detection.caches.includes('cookie')) {
        ctx.cookies.set(detection.cookieName, locale, detection.cookieOptions);
      }
      return locale;
    }
  }

  return defaultLocale;
}

function addHreflangHeaders(ctx, currentLocale) {
  const { locales, urlStructure } = localeConfig;
  const baseUrl = `${ctx.protocol}://${ctx.host}`;
  const path = ctx.path.replace('/api', ''); // Remove API prefix for frontend URLs

  const hreflangs = locales.map(locale => {
    let url;

    if (urlStructure.strategy === 'prefix') {
      const prefix = urlStructure.prefixes[locale.code];
      url = prefix ? `${baseUrl}/${prefix}${path}` : `${baseUrl}${path}`;
    } else {
      url = `${baseUrl}${path}?locale=${locale.code}`;
    }

    return `<${url}>; rel="alternate"; hreflang="${locale.code}"`;
  });

  // Add x-default for default locale
  const defaultLocale = locales.find(l => l.isDefault);
  if (defaultLocale) {
    const defaultUrl = urlStructure.prefixes[defaultLocale.code]
      ? `${baseUrl}/${urlStructure.prefixes[defaultLocale.code]}${path}`
      : `${baseUrl}${path}`;
    hreflangs.push(`<${defaultUrl}>; rel="alternate"; hreflang="x-default"`);
  }

  if (hreflangs.length > 0) {
    ctx.set('Link', hreflangs.join(', '));
  }
}

// Utility function to get locale direction
function getLocaleDirection(localeCode) {
  const locale = localeConfig.locales.find(l => l.code === localeCode);
  return locale ? locale.direction : 'ltr';
}

// Utility function to get locale native name
function getLocaleNativeName(localeCode) {
  const locale = localeConfig.locales.find(l => l.code === localeCode);
  return locale ? locale.nativeName : localeCode;
}

module.exports.getLocaleDirection = getLocaleDirection;
module.exports.getLocaleNativeName = getLocaleNativeName;