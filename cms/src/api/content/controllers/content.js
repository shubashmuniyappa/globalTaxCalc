module.exports = {
  // Blog Posts
  async getBlogPosts(ctx) {
    try {
      const {
        page = 1,
        pageSize = 10,
        category,
        tags,
        featured,
        sort = 'publishedAt:desc'
      } = ctx.query;

      const filters = {
        publishedAt: { $notNull: true }
      };

      if (category) {
        filters.category = { slug: category };
      }

      if (tags) {
        const tagList = Array.isArray(tags) ? tags : [tags];
        filters.tags = { slug: { $in: tagList } };
      }

      if (featured !== undefined) {
        filters.featured = featured === 'true';
      }

      const results = await strapi.entityService.findMany('api::blog-post.blog-post', {
        filters,
        populate: {
          seo: true,
          featuredImage: true,
          category: { fields: ['name', 'slug', 'color'] },
          tags: { fields: ['name', 'slug'] },
          author: { fields: ['firstname', 'lastname'] }
        },
        sort: [sort],
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize)
        },
        locale: ctx.state.locale
      });

      return {
        data: results,
        meta: {
          pagination: {
            page: parseInt(page),
            pageSize: parseInt(pageSize)
          }
        }
      };
    } catch (error) {
      ctx.throw(500, 'Failed to fetch blog posts', { error: error.message });
    }
  },

  async getBlogPost(ctx) {
    try {
      const { slug } = ctx.params;

      const post = await strapi.entityService.findMany('api::blog-post.blog-post', {
        filters: { slug, publishedAt: { $notNull: true } },
        populate: {
          seo: true,
          featuredImage: true,
          gallery: true,
          category: { fields: ['name', 'slug', 'color'] },
          tags: { fields: ['name', 'slug'] },
          author: { fields: ['firstname', 'lastname', 'email'] },
          relatedPosts: {
            fields: ['title', 'slug', 'excerpt'],
            populate: { featuredImage: true }
          }
        },
        locale: ctx.state.locale
      });

      if (!post || post.length === 0) {
        return ctx.notFound('Blog post not found');
      }

      // Increment view count
      setTimeout(async () => {
        try {
          await strapi.entityService.update('api::blog-post.blog-post', post[0].id, {
            data: { views: (post[0].views || 0) + 1 }
          });
        } catch (error) {
          strapi.log.error('Failed to update view count:', error);
        }
      }, 0);

      return { data: post[0] };
    } catch (error) {
      ctx.throw(500, 'Failed to fetch blog post', { error: error.message });
    }
  },

  // Tax Guides
  async getTaxGuides(ctx) {
    try {
      const { page = 1, pageSize = 20, country, year, type } = ctx.query;

      const filters = {
        publishedAt: { $notNull: true }
      };

      if (country) {
        filters.country = { code: country.toUpperCase() };
      }

      if (year) {
        filters.taxYear = parseInt(year);
      }

      if (type) {
        filters.guideType = type;
      }

      const results = await strapi.entityService.findMany('api::tax-guide.tax-guide', {
        filters,
        populate: {
          seo: true,
          featuredImage: true,
          country: { fields: ['name', 'code', 'currency'] },
          tags: { fields: ['name', 'slug'] }
        },
        sort: ['priority:desc', 'lastUpdated:desc'],
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize)
        },
        locale: ctx.state.locale
      });

      return {
        data: results,
        meta: {
          pagination: {
            page: parseInt(page),
            pageSize: parseInt(pageSize)
          }
        }
      };
    } catch (error) {
      ctx.throw(500, 'Failed to fetch tax guides', { error: error.message });
    }
  },

  async getTaxGuidesByCountry(ctx) {
    try {
      const { country } = ctx.params;
      const { year, type } = ctx.query;

      const filters = {
        publishedAt: { $notNull: true },
        country: { code: country.toUpperCase() }
      };

      if (year) {
        filters.taxYear = parseInt(year);
      }

      if (type) {
        filters.guideType = type;
      }

      const results = await strapi.entityService.findMany('api::tax-guide.tax-guide', {
        filters,
        populate: {
          seo: true,
          featuredImage: true,
          country: { fields: ['name', 'code', 'currency'] },
          tags: { fields: ['name', 'slug'] }
        },
        sort: ['taxYear:desc', 'priority:desc'],
        locale: ctx.state.locale
      });

      return { data: results };
    } catch (error) {
      ctx.throw(500, 'Failed to fetch tax guides by country', { error: error.message });
    }
  },

  // FAQ
  async getFAQItems(ctx) {
    try {
      const { category, country, limit = 50 } = ctx.query;

      const filters = {
        publishedAt: { $notNull: true }
      };

      if (category) {
        filters.category = { slug: category };
      }

      if (country) {
        filters.relatedCountries = { code: country.toUpperCase() };
      }

      const results = await strapi.entityService.findMany('api::faq-item.faq-item', {
        filters,
        populate: {
          category: { fields: ['name', 'slug', 'color'] },
          relatedCountries: { fields: ['name', 'code'] },
          relatedTopics: { fields: ['name', 'slug'] }
        },
        sort: ['priority:desc', 'featured:desc'],
        pagination: { limit: parseInt(limit) },
        locale: ctx.state.locale
      });

      return { data: results };
    } catch (error) {
      ctx.throw(500, 'Failed to fetch FAQ items', { error: error.message });
    }
  },

  // Country Pages
  async getCountryPage(ctx) {
    try {
      const { country } = ctx.params;

      const page = await strapi.entityService.findMany('api::country-page.country-page', {
        filters: {
          publishedAt: { $notNull: true },
          country: { code: country.toUpperCase() }
        },
        populate: {
          seo: true,
          featuredImage: true,
          flagImage: true,
          country: { fields: ['name', 'code', 'currency', 'region'] },
          relatedGuides: {
            fields: ['title', 'slug', 'description'],
            populate: { featuredImage: true }
          },
          relatedPosts: {
            fields: ['title', 'slug', 'excerpt'],
            populate: { featuredImage: true }
          }
        },
        locale: ctx.state.locale
      });

      if (!page || page.length === 0) {
        return ctx.notFound('Country page not found');
      }

      return { data: page[0] };
    } catch (error) {
      ctx.throw(500, 'Failed to fetch country page', { error: error.message });
    }
  },

  // Tool Descriptions
  async getToolDescriptions(ctx) {
    try {
      const { category, country, featured } = ctx.query;

      const filters = {
        publishedAt: { $notNull: true }
      };

      if (category) {
        filters.category = category;
      }

      if (country) {
        filters.supportedCountries = { code: country.toUpperCase() };
      }

      if (featured !== undefined) {
        filters.featured = featured === 'true';
      }

      const results = await strapi.entityService.findMany('api::tool-description.tool-description', {
        filters,
        populate: {
          seo: true,
          featuredImage: true,
          supportedCountries: { fields: ['name', 'code'] },
          tags: { fields: ['name', 'slug'] }
        },
        sort: ['priority:desc', 'usageCount:desc'],
        locale: ctx.state.locale
      });

      return { data: results };
    } catch (error) {
      ctx.throw(500, 'Failed to fetch tool descriptions', { error: error.message });
    }
  },

  // Search
  async search(ctx) {
    try {
      const { q, type, locale } = ctx.request.body;

      if (!q || q.length < 2) {
        return ctx.badRequest('Search query must be at least 2 characters');
      }

      const searchResults = {
        blogPosts: [],
        taxGuides: [],
        faqItems: [],
        toolDescriptions: []
      };

      const searchLocale = locale || ctx.state.locale;

      // Search blog posts
      if (!type || type === 'blog') {
        searchResults.blogPosts = await strapi.entityService.findMany('api::blog-post.blog-post', {
          filters: {
            publishedAt: { $notNull: true },
            $or: [
              { title: { $containsi: q } },
              { excerpt: { $containsi: q } },
              { content: { $containsi: q } }
            ]
          },
          populate: {
            featuredImage: true,
            category: { fields: ['name', 'slug'] }
          },
          sort: ['views:desc'],
          pagination: { limit: 10 },
          locale: searchLocale
        });
      }

      // Search tax guides
      if (!type || type === 'guides') {
        searchResults.taxGuides = await strapi.entityService.findMany('api::tax-guide.tax-guide', {
          filters: {
            publishedAt: { $notNull: true },
            $or: [
              { title: { $containsi: q } },
              { description: { $containsi: q } },
              { content: { $containsi: q } }
            ]
          },
          populate: {
            featuredImage: true,
            country: { fields: ['name', 'code'] }
          },
          sort: ['priority:desc'],
          pagination: { limit: 10 },
          locale: searchLocale
        });
      }

      // Search FAQ items
      if (!type || type === 'faq') {
        searchResults.faqItems = await strapi.entityService.findMany('api::faq-item.faq-item', {
          filters: {
            publishedAt: { $notNull: true },
            $or: [
              { question: { $containsi: q } },
              { answer: { $containsi: q } }
            ]
          },
          populate: {
            category: { fields: ['name', 'slug'] }
          },
          sort: ['priority:desc'],
          pagination: { limit: 10 },
          locale: searchLocale
        });
      }

      // Search tool descriptions
      if (!type || type === 'tools') {
        searchResults.toolDescriptions = await strapi.entityService.findMany('api::tool-description.tool-description', {
          filters: {
            publishedAt: { $notNull: true },
            $or: [
              { toolName: { $containsi: q } },
              { shortDescription: { $containsi: q } },
              { keywords: { $containsi: q } }
            ]
          },
          populate: {
            featuredImage: true
          },
          sort: ['usageCount:desc'],
          pagination: { limit: 10 },
          locale: searchLocale
        });
      }

      return {
        data: searchResults,
        meta: {
          query: q,
          type: type || 'all',
          locale: searchLocale,
          totalResults: Object.values(searchResults).reduce((total, results) => total + results.length, 0)
        }
      };
    } catch (error) {
      ctx.throw(500, 'Search failed', { error: error.message });
    }
  },

  // Navigation and Metadata
  async getNavigation(ctx) {
    try {
      // Get featured countries for navigation
      const countries = await strapi.entityService.findMany('api::country.country', {
        filters: { featured: true },
        fields: ['name', 'code', 'currency'],
        sort: ['priority:desc'],
        pagination: { limit: 10 },
        locale: ctx.state.locale
      });

      // Get blog categories for navigation
      const blogCategories = await strapi.entityService.findMany('api::blog-category.blog-category', {
        filters: { featured: true },
        fields: ['name', 'slug', 'color'],
        sort: ['priority:desc'],
        pagination: { limit: 8 },
        locale: ctx.state.locale
      });

      // Get FAQ categories
      const faqCategories = await strapi.entityService.findMany('api::faq-category.faq-category', {
        fields: ['name', 'slug', 'color'],
        sort: ['priority:desc'],
        pagination: { limit: 6 },
        locale: ctx.state.locale
      });

      return {
        data: {
          countries,
          blogCategories,
          faqCategories
        }
      };
    } catch (error) {
      ctx.throw(500, 'Failed to fetch navigation data', { error: error.message });
    }
  },

  async getSitemap(ctx) {
    try {
      const sitemap = {
        blogPosts: [],
        taxGuides: [],
        countryPages: [],
        toolDescriptions: []
      };

      // Get all published content URLs
      const [blogPosts, taxGuides, countryPages, toolDescriptions] = await Promise.all([
        strapi.entityService.findMany('api::blog-post.blog-post', {
          filters: { publishedAt: { $notNull: true } },
          fields: ['slug', 'updatedAt'],
          locale: 'all'
        }),
        strapi.entityService.findMany('api::tax-guide.tax-guide', {
          filters: { publishedAt: { $notNull: true } },
          fields: ['slug', 'updatedAt'],
          locale: 'all'
        }),
        strapi.entityService.findMany('api::country-page.country-page', {
          filters: { publishedAt: { $notNull: true } },
          fields: ['slug', 'updatedAt'],
          locale: 'all'
        }),
        strapi.entityService.findMany('api::tool-description.tool-description', {
          filters: { publishedAt: { $notNull: true } },
          fields: ['slug', 'updatedAt'],
          locale: 'all'
        })
      ]);

      return {
        data: {
          blogPosts,
          taxGuides,
          countryPages,
          toolDescriptions
        },
        meta: {
          totalUrls: blogPosts.length + taxGuides.length + countryPages.length + toolDescriptions.length,
          lastUpdated: new Date().toISOString()
        }
      };
    } catch (error) {
      ctx.throw(500, 'Failed to generate sitemap', { error: error.message });
    }
  }
};