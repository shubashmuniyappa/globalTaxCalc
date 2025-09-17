const slugify = require('slugify');

module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    await next();

    // Only process API responses
    if (!ctx.url.startsWith('/api/')) return;

    // Add SEO headers to responses
    if (ctx.response.body && ctx.response.body.data) {
      const data = ctx.response.body.data;

      // Single item response
      if (data.attributes && data.attributes.seo) {
        addSEOHeaders(ctx, data.attributes.seo);
      }

      // Collection response
      if (Array.isArray(data)) {
        data.forEach(item => {
          if (item.attributes && item.attributes.seo) {
            // For collections, we'll add pagination SEO later
            addPaginationSEO(ctx, item.attributes.seo);
          }
        });
      }
    }
  };
};

function addSEOHeaders(ctx, seo) {
  if (!seo) return;

  // Add canonical URL header
  if (seo.canonicalURL) {
    ctx.set('Link', `<${seo.canonicalURL}>; rel="canonical"`);
  }

  // Add robots header
  if (seo.metaRobots) {
    ctx.set('X-Robots-Tag', seo.metaRobots);
  }

  // Add cache control for SEO
  ctx.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
}

function addPaginationSEO(ctx, seo) {
  const { query } = ctx.request;
  const page = parseInt(query['pagination[page]']) || 1;
  const pageSize = parseInt(query['pagination[pageSize]']) || 25;

  // Add pagination headers
  const baseUrl = `${ctx.protocol}://${ctx.host}${ctx.path}`;

  if (page > 1) {
    const prevPage = page - 1;
    const prevUrl = `${baseUrl}?pagination[page]=${prevPage}&pagination[pageSize]=${pageSize}`;
    ctx.set('Link', `<${prevUrl}>; rel="prev"`);
  }

  // Note: We'd need total count to add "next" link properly
  // This would require modifying the response structure
}