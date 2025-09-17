const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::blog-post.blog-post', ({ strapi }) => ({
  // Custom service methods for blog posts

  async findWithAnalytics(params) {
    // Add analytics data to blog post queries
    const results = await super.find(params);

    if (Array.isArray(results.results || results)) {
      const posts = results.results || results;

      // Add analytics data for each post
      for (let post of posts) {
        post.analytics = {
          viewsLastWeek: await this.getViewsInPeriod(post.id, 7),
          viewsLastMonth: await this.getViewsInPeriod(post.id, 30),
          avgReadingTime: post.readingTime || 0,
          engagementScore: this.calculateEngagementScore(post)
        };
      }
    }

    return results;
  },

  async getViewsInPeriod(postId, days) {
    // In a real implementation, you'd query an analytics database
    // For now, we'll simulate this
    const post = await super.findOne(postId, {});
    if (!post) return 0;

    // Simulate period-based views (this would come from analytics)
    const totalViews = post.views || 0;
    const dailyAverage = totalViews / 30; // Assume 30-day average
    return Math.floor(dailyAverage * days);
  },

  calculateEngagementScore(post) {
    // Simple engagement score calculation
    const views = post.views || 0;
    const readingTime = post.readingTime || 1;
    const daysOld = post.publishedAt
      ? Math.floor((Date.now() - new Date(post.publishedAt)) / (1000 * 60 * 60 * 24))
      : 1;

    // Engagement score formula (can be customized)
    const score = (views / Math.max(daysOld, 1)) * (readingTime / 5);
    return Math.round(score * 100) / 100;
  },

  async generateTableOfContents(content) {
    if (!content) return null;

    // Extract headings from rich text content
    const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi;
    const headings = [];
    let match;

    while ((match = headingRegex.exec(content)) !== null) {
      const level = parseInt(match[1]);
      const text = match[2].replace(/<[^>]*>/g, ''); // Strip HTML tags
      const slug = this.createSlug(text);

      headings.push({
        level,
        text,
        slug,
        children: []
      });
    }

    // Build hierarchical structure
    return this.buildTOCHierarchy(headings);
  },

  buildTOCHierarchy(headings) {
    const toc = [];
    const stack = [];

    for (let heading of headings) {
      // Find the appropriate parent level
      while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
        stack.pop();
      }

      if (stack.length === 0) {
        toc.push(heading);
      } else {
        stack[stack.length - 1].children.push(heading);
      }

      stack.push(heading);
    }

    return toc;
  },

  createSlug(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();
  },

  async getRecommendations(postId, limit = 5) {
    const post = await super.findOne(postId, {
      populate: ['category', 'tags']
    });

    if (!post) return [];

    // Get posts with similar categories and tags
    const recommendations = await super.find({
      filters: {
        id: { $ne: postId },
        publishedAt: { $notNull: true },
        $or: [
          { category: post.category?.id },
          { tags: { id: { $in: post.tags?.map(tag => tag.id) || [] } } }
        ]
      },
      populate: {
        featuredImage: true,
        category: true
      },
      sort: { views: 'desc' },
      pagination: { limit }
    });

    return recommendations.results || [];
  },

  async updateViewCount(postId) {
    const post = await super.findOne(postId, {});
    if (!post) return null;

    return await super.update(postId, {
      data: { views: (post.views || 0) + 1 }
    });
  },

  async getArchive(year, month = null) {
    const startDate = new Date(year, month ? month - 1 : 0, 1);
    const endDate = month
      ? new Date(year, month, 0) // Last day of month
      : new Date(year + 1, 0, 0); // Last day of year

    return await super.find({
      filters: {
        publishedAt: {
          $gte: startDate.toISOString(),
          $lte: endDate.toISOString()
        }
      },
      populate: {
        featuredImage: true,
        category: true
      },
      sort: { publishedAt: 'desc' }
    });
  }
}));