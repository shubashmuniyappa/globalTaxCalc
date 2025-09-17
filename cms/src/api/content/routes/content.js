module.exports = {
  routes: [
    // Blog content endpoints
    {
      method: 'GET',
      path: '/content/blog',
      handler: 'content.getBlogPosts',
      config: {
        policies: ['global::rate-limit'],
        middlewares: ['global::i18n-middleware', 'global::seo-middleware']
      }
    },
    {
      method: 'GET',
      path: '/content/blog/:slug',
      handler: 'content.getBlogPost',
      config: {
        policies: ['global::rate-limit'],
        middlewares: ['global::i18n-middleware', 'global::seo-middleware']
      }
    },

    // Tax guides endpoints
    {
      method: 'GET',
      path: '/content/guides',
      handler: 'content.getTaxGuides',
      config: {
        policies: ['global::rate-limit'],
        middlewares: ['global::i18n-middleware']
      }
    },
    {
      method: 'GET',
      path: '/content/guides/:country',
      handler: 'content.getTaxGuidesByCountry',
      config: {
        policies: ['global::rate-limit'],
        middlewares: ['global::i18n-middleware']
      }
    },
    {
      method: 'GET',
      path: '/content/guides/:country/:year',
      handler: 'content.getTaxGuideByCountryYear',
      config: {
        policies: ['global::rate-limit'],
        middlewares: ['global::i18n-middleware']
      }
    },

    // FAQ endpoints
    {
      method: 'GET',
      path: '/content/faq',
      handler: 'content.getFAQItems',
      config: {
        policies: ['global::rate-limit'],
        middlewares: ['global::i18n-middleware']
      }
    },
    {
      method: 'GET',
      path: '/content/faq/categories',
      handler: 'content.getFAQCategories',
      config: {
        policies: ['global::rate-limit'],
        middlewares: ['global::i18n-middleware']
      }
    },

    // Page content endpoints
    {
      method: 'GET',
      path: '/content/page/:slug',
      handler: 'content.getPage',
      config: {
        policies: ['global::rate-limit'],
        middlewares: ['global::i18n-middleware', 'global::seo-middleware']
      }
    },
    {
      method: 'GET',
      path: '/content/country/:country',
      handler: 'content.getCountryPage',
      config: {
        policies: ['global::rate-limit'],
        middlewares: ['global::i18n-middleware', 'global::seo-middleware']
      }
    },

    // Tool descriptions
    {
      method: 'GET',
      path: '/content/tools',
      handler: 'content.getToolDescriptions',
      config: {
        policies: ['global::rate-limit'],
        middlewares: ['global::i18n-middleware']
      }
    },
    {
      method: 'GET',
      path: '/content/tools/:slug',
      handler: 'content.getToolDescription',
      config: {
        policies: ['global::rate-limit'],
        middlewares: ['global::i18n-middleware']
      }
    },

    // Search endpoints
    {
      method: 'POST',
      path: '/content/search',
      handler: 'content.search',
      config: {
        policies: ['global::rate-limit'],
        middlewares: ['global::i18n-middleware']
      }
    },

    // Navigation and metadata
    {
      method: 'GET',
      path: '/content/navigation',
      handler: 'content.getNavigation',
      config: {
        policies: ['global::rate-limit'],
        middlewares: ['global::i18n-middleware']
      }
    },
    {
      method: 'GET',
      path: '/content/sitemap',
      handler: 'content.getSitemap',
      config: {
        policies: ['global::rate-limit']
      }
    },
    {
      method: 'GET',
      path: '/content/metadata',
      handler: 'content.getMetadata',
      config: {
        policies: ['global::rate-limit'],
        middlewares: ['global::i18n-middleware']
      }
    },

    // Analytics and popular content
    {
      method: 'GET',
      path: '/content/popular',
      handler: 'content.getPopularContent',
      config: {
        policies: ['global::rate-limit'],
        middlewares: ['global::i18n-middleware']
      }
    },
    {
      method: 'GET',
      path: '/content/recent',
      handler: 'content.getRecentContent',
      config: {
        policies: ['global::rate-limit'],
        middlewares: ['global::i18n-middleware']
      }
    },

    // Related content
    {
      method: 'GET',
      path: '/content/related/:type/:id',
      handler: 'content.getRelatedContent',
      config: {
        policies: ['global::rate-limit'],
        middlewares: ['global::i18n-middleware']
      }
    }
  ]
};