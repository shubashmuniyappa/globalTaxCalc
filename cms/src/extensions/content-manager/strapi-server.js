module.exports = (plugin) => {
  // Custom SEO field validation
  plugin.controllers['collection-types'].update = async (ctx) => {
    const { body } = ctx.request;
    const { model } = ctx.params;

    // Auto-generate SEO fields if missing
    if (body.data && !body.data.seo) {
      body.data.seo = await generateSEOFields(body.data, model);
    }

    // Auto-generate slug if missing
    if (body.data && body.data.title && !body.data.slug) {
      const slugify = require('slugify');
      body.data.slug = slugify(body.data.title, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g
      });
    }

    // Update reading time for blog posts
    if (model === 'blog-post' && body.data.content) {
      body.data.readingTime = calculateReadingTime(body.data.content);
    }

    // Update last updated timestamp
    body.data.lastUpdated = new Date().toISOString();

    return strapi.controller('admin::content-manager.collection-types').update(ctx);
  };

  plugin.controllers['collection-types'].create = async (ctx) => {
    const { body } = ctx.request;
    const { model } = ctx.params;

    // Auto-generate SEO fields
    if (body.data && !body.data.seo) {
      body.data.seo = await generateSEOFields(body.data, model);
    }

    // Auto-generate slug
    if (body.data && body.data.title && !body.data.slug) {
      const slugify = require('slugify');
      body.data.slug = slugify(body.data.title, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g
      });
    }

    // Calculate reading time for blog posts
    if (model === 'blog-post' && body.data.content) {
      body.data.readingTime = calculateReadingTime(body.data.content);
    }

    return strapi.controller('admin::content-manager.collection-types').create(ctx);
  };

  return plugin;
};

// Helper function to generate SEO fields
async function generateSEOFields(data, model) {
  const seo = {};

  if (data.title) {
    seo.metaTitle = data.title.length > 60
      ? data.title.substring(0, 57) + '...'
      : data.title;
  }

  if (data.excerpt) {
    seo.metaDescription = data.excerpt.length > 160
      ? data.excerpt.substring(0, 157) + '...'
      : data.excerpt;
  } else if (data.description) {
    seo.metaDescription = data.description.length > 160
      ? data.description.substring(0, 157) + '...'
      : data.description;
  }

  // Generate keywords based on title and tags
  if (data.title) {
    const titleWords = data.title.toLowerCase()
      .split(' ')
      .filter(word => word.length > 3)
      .slice(0, 5);
    seo.keywords = titleWords.join(', ');
  }

  seo.metaRobots = 'index,follow';
  seo.canonicalURL = '';

  // Generate structured data based on content type
  if (model === 'blog-post') {
    seo.structuredData = {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": data.title,
      "description": data.excerpt || data.description,
      "author": {
        "@type": "Organization",
        "name": "GlobalTaxCalc"
      },
      "publisher": {
        "@type": "Organization",
        "name": "GlobalTaxCalc",
        "logo": {
          "@type": "ImageObject",
          "url": "https://globaltaxcalc.com/logo.png"
        }
      }
    };
  } else if (model === 'tax-guide') {
    seo.structuredData = {
      "@context": "https://schema.org",
      "@type": "HowTo",
      "name": data.title,
      "description": data.description,
      "publisher": {
        "@type": "Organization",
        "name": "GlobalTaxCalc"
      }
    };
  }

  return seo;
}

// Helper function to calculate reading time
function calculateReadingTime(content) {
  if (!content) return 1;

  // Remove HTML tags and count words
  const text = content.replace(/<[^>]*>/g, '');
  const wordCount = text.split(/\s+/).length;

  // Average reading speed: 200 words per minute
  const readingTime = Math.ceil(wordCount / 200);

  return Math.max(1, readingTime);
}