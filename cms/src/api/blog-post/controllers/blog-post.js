const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::blog-post.blog-post', ({ strapi }) => ({
  // Find blog posts with enhanced filtering and SEO
  async find(ctx) {
    const { query } = ctx;

    // Add default population for SEO and relations
    const defaultPopulate = {
      seo: true,
      featuredImage: true,
      author: {
        fields: ['firstname', 'lastname', 'email']
      },
      category: {
        fields: ['name', 'slug', 'color']
      },
      tags: {
        fields: ['name', 'slug', 'color']
      }
    };

    // Merge with user-provided populate
    const populate = query.populate || defaultPopulate;

    // Enhanced filtering
    const filters = {
      ...query.filters,
      publishedAt: { $notNull: true }
    };

    const sanitizedQuery = await this.sanitizeQuery(ctx);
    const { results, pagination } = await strapi
      .service('api::blog-post.blog-post')
      .find({
        ...sanitizedQuery,
        populate,
        filters
      });

    const sanitizedResults = await this.sanitizeOutput(results, ctx);

    return this.transformResponse(sanitizedResults, { pagination });
  },

  // Find one blog post with view tracking
  async findOne(ctx) {
    const { id } = ctx.params;

    const entity = await strapi.service('api::blog-post.blog-post').findOne(id, {
      populate: {
        seo: true,
        featuredImage: true,
        gallery: true,
        author: {
          fields: ['firstname', 'lastname', 'email']
        },
        category: {
          fields: ['name', 'slug', 'color']
        },
        tags: {
          fields: ['name', 'slug', 'color']
        },
        relatedPosts: {
          fields: ['title', 'slug', 'excerpt'],
          populate: {
            featuredImage: true
          }
        }
      }
    });

    if (!entity) {
      return ctx.notFound('Blog post not found');
    }

    // Increment view count (async, don't wait)
    setImmediate(async () => {
      try {
        await strapi.service('api::blog-post.blog-post').update(id, {
          data: { views: (entity.views || 0) + 1 }
        });
      } catch (error) {
        strapi.log.error('Failed to update view count:', error);
      }
    });

    const sanitizedEntity = await this.sanitizeOutput(entity, ctx);
    return this.transformResponse(sanitizedEntity);
  },

  // Get related posts
  async getRelated(ctx) {
    const { id } = ctx.params;
    const { limit = 5 } = ctx.query;

    const currentPost = await strapi.service('api::blog-post.blog-post').findOne(id, {
      populate: ['category', 'tags']
    });

    if (!currentPost) {
      return ctx.notFound('Blog post not found');
    }

    // Find related posts by category and tags
    const relatedPosts = await strapi.service('api::blog-post.blog-post').find({
      filters: {
        id: { $ne: id },
        publishedAt: { $notNull: true },
        $or: [
          { category: currentPost.category?.id },
          { tags: { id: { $in: currentPost.tags?.map(tag => tag.id) || [] } } }
        ]
      },
      populate: {
        featuredImage: true,
        category: {
          fields: ['name', 'slug']
        }
      },
      sort: { publishedAt: 'desc' },
      pagination: { limit: parseInt(limit) }
    });

    const sanitizedResults = await this.sanitizeOutput(relatedPosts.results, ctx);
    return this.transformResponse(sanitizedResults);
  },

  // Search blog posts
  async search(ctx) {
    const { q, category, tags, author } = ctx.query;

    if (!q || q.length < 2) {
      return ctx.badRequest('Search query must be at least 2 characters');
    }

    const filters = {
      publishedAt: { $notNull: true },
      $or: [
        { title: { $containsi: q } },
        { excerpt: { $containsi: q } },
        { content: { $containsi: q } }
      ]
    };

    // Add additional filters
    if (category) {
      filters.category = { slug: category };
    }

    if (tags) {
      const tagList = Array.isArray(tags) ? tags : [tags];
      filters.tags = { slug: { $in: tagList } };
    }

    if (author) {
      filters.author = author;
    }

    const results = await strapi.service('api::blog-post.blog-post').find({
      filters,
      populate: {
        featuredImage: true,
        category: {
          fields: ['name', 'slug']
        },
        tags: {
          fields: ['name', 'slug']
        }
      },
      sort: { publishedAt: 'desc' },
      pagination: {
        page: ctx.query.page || 1,
        pageSize: ctx.query.pageSize || 10
      }
    });

    const sanitizedResults = await this.sanitizeOutput(results.results, ctx);
    return this.transformResponse(sanitizedResults, { pagination: results.pagination });
  },

  // Get featured posts
  async getFeatured(ctx) {
    const { limit = 6 } = ctx.query;

    const results = await strapi.service('api::blog-post.blog-post').find({
      filters: {
        featured: true,
        publishedAt: { $notNull: true }
      },
      populate: {
        featuredImage: true,
        category: {
          fields: ['name', 'slug', 'color']
        },
        author: {
          fields: ['firstname', 'lastname']
        }
      },
      sort: { publishedAt: 'desc' },
      pagination: { limit: parseInt(limit) }
    });

    const sanitizedResults = await this.sanitizeOutput(results.results, ctx);
    return this.transformResponse(sanitizedResults);
  },

  // Get popular posts (by views)
  async getPopular(ctx) {
    const { limit = 10, period = '30' } = ctx.query;

    let dateFilter = {};
    if (period !== 'all') {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(period));
      dateFilter = { publishedAt: { $gte: daysAgo.toISOString() } };
    }

    const results = await strapi.service('api::blog-post.blog-post').find({
      filters: {
        ...dateFilter,
        publishedAt: { $notNull: true }
      },
      populate: {
        featuredImage: true,
        category: {
          fields: ['name', 'slug']
        }
      },
      sort: { views: 'desc' },
      pagination: { limit: parseInt(limit) }
    });

    const sanitizedResults = await this.sanitizeOutput(results.results, ctx);
    return this.transformResponse(sanitizedResults);
  }
}));