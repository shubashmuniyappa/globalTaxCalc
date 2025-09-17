module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/blog-posts',
      handler: 'blog-post.find',
      config: {
        policies: ['global::rate-limit'],
        middlewares: ['global::seo-middleware']
      }
    },
    {
      method: 'GET',
      path: '/blog-posts/:id',
      handler: 'blog-post.findOne',
      config: {
        policies: ['global::rate-limit'],
        middlewares: ['global::seo-middleware']
      }
    },
    {
      method: 'GET',
      path: '/blog-posts/:id/related',
      handler: 'blog-post.getRelated',
      config: {
        policies: ['global::rate-limit']
      }
    },
    {
      method: 'GET',
      path: '/blog-posts/search',
      handler: 'blog-post.search',
      config: {
        policies: ['global::rate-limit']
      }
    },
    {
      method: 'GET',
      path: '/blog-posts/featured',
      handler: 'blog-post.getFeatured',
      config: {
        policies: ['global::rate-limit']
      }
    },
    {
      method: 'GET',
      path: '/blog-posts/popular',
      handler: 'blog-post.getPopular',
      config: {
        policies: ['global::rate-limit']
      }
    }
  ]
};