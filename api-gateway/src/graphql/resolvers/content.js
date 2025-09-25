/**
 * Content Management Resolvers
 * Handles all content-related GraphQL operations
 */

const contentResolvers = {
  Query: {
    // Articles
    articles: async (_, { input }, { dataSources }) => {
      return await dataSources.contentAPI.getArticles(input);
    },

    article: async (_, { id }, { dataSources }) => {
      return await dataSources.contentAPI.getArticle(id);
    },

    articleBySlug: async (_, { slug }, { dataSources }) => {
      return await dataSources.contentAPI.getArticleBySlug(slug);
    },

    // Guides
    guides: async (_, { input }, { dataSources }) => {
      return await dataSources.contentAPI.getGuides(input);
    },

    guide: async (_, { id }, { dataSources }) => {
      return await dataSources.contentAPI.getGuide(id);
    },

    guideBySlug: async (_, { slug }, { dataSources }) => {
      return await dataSources.contentAPI.getGuideBySlug(slug);
    },

    // FAQs
    faqs: async (_, { input }, { dataSources }) => {
      return await dataSources.contentAPI.getFAQs(input);
    },

    faq: async (_, { id }, { dataSources }) => {
      return await dataSources.contentAPI.getFAQ(id);
    },

    faqCategories: async (_, __, { dataSources }) => {
      return await dataSources.contentAPI.getFAQCategories();
    },

    // Templates
    templates: async (_, { input }, { dataSources }) => {
      return await dataSources.contentAPI.getTemplates(input);
    },

    template: async (_, { id }, { dataSources }) => {
      return await dataSources.contentAPI.getTemplate(id);
    },

    templateBySlug: async (_, { slug }, { dataSources }) => {
      return await dataSources.contentAPI.getTemplateBySlug(slug);
    },

    // Glossary
    glossaryTerms: async (_, { input }, { dataSources }) => {
      return await dataSources.contentAPI.getGlossaryTerms(input);
    },

    glossaryTerm: async (_, { id }, { dataSources }) => {
      return await dataSources.contentAPI.getGlossaryTerm(id);
    },

    glossaryTermBySlug: async (_, { slug }, { dataSources }) => {
      return await dataSources.contentAPI.getGlossaryTermBySlug(slug);
    },

    // Search
    searchContent: async (_, { input }, { dataSources }) => {
      return await dataSources.contentAPI.searchContent(input);
    },

    // Categories and tags
    contentCategories: async (_, { type }, { dataSources }) => {
      return await dataSources.contentAPI.getContentCategories(type);
    },

    contentTags: async (_, { input }, { dataSources }) => {
      return await dataSources.contentAPI.getContentTags(input);
    },

    // Analytics
    contentAnalytics: async (_, { input }, { dataSources, user }) => {
      return await dataSources.analyticsAPI.getContentAnalytics(input, user);
    },

    popularContent: async (_, { input }, { dataSources }) => {
      return await dataSources.contentAPI.getPopularContent(input);
    },

    // User interactions
    userBookmarks: async (_, __, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.contentAPI.getUserBookmarks(user.id);
    },

    userHistory: async (_, { input }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.contentAPI.getUserHistory(user.id, input);
    },

    // Localization
    localizedContent: async (_, { input }, { dataSources }) => {
      return await dataSources.contentAPI.getLocalizedContent(input);
    }
  },

  Mutation: {
    // Article management
    createArticle: async (_, { input }, { dataSources, user }) => {
      return await dataSources.contentAPI.createArticle(input, user);
    },

    updateArticle: async (_, { id, input }, { dataSources, user }) => {
      return await dataSources.contentAPI.updateArticle(id, input, user);
    },

    deleteArticle: async (_, { id }, { dataSources, user }) => {
      return await dataSources.contentAPI.deleteArticle(id, user);
    },

    publishArticle: async (_, { id }, { dataSources, user }) => {
      return await dataSources.contentAPI.publishArticle(id, user);
    },

    unpublishArticle: async (_, { id }, { dataSources, user }) => {
      return await dataSources.contentAPI.unpublishArticle(id, user);
    },

    // Guide management
    createGuide: async (_, { input }, { dataSources, user }) => {
      return await dataSources.contentAPI.createGuide(input, user);
    },

    updateGuide: async (_, { id, input }, { dataSources, user }) => {
      return await dataSources.contentAPI.updateGuide(id, input, user);
    },

    deleteGuide: async (_, { id }, { dataSources, user }) => {
      return await dataSources.contentAPI.deleteGuide(id, user);
    },

    // FAQ management
    createFAQ: async (_, { input }, { dataSources, user }) => {
      return await dataSources.contentAPI.createFAQ(input, user);
    },

    updateFAQ: async (_, { id, input }, { dataSources, user }) => {
      return await dataSources.contentAPI.updateFAQ(id, input, user);
    },

    deleteFAQ: async (_, { id }, { dataSources, user }) => {
      return await dataSources.contentAPI.deleteFAQ(id, user);
    },

    // Template management
    createTemplate: async (_, { input }, { dataSources, user }) => {
      return await dataSources.contentAPI.createTemplate(input, user);
    },

    updateTemplate: async (_, { id, input }, { dataSources, user }) => {
      return await dataSources.contentAPI.updateTemplate(id, input, user);
    },

    deleteTemplate: async (_, { id }, { dataSources, user }) => {
      return await dataSources.contentAPI.deleteTemplate(id, user);
    },

    // Glossary management
    createGlossaryTerm: async (_, { input }, { dataSources, user }) => {
      return await dataSources.contentAPI.createGlossaryTerm(input, user);
    },

    updateGlossaryTerm: async (_, { id, input }, { dataSources, user }) => {
      return await dataSources.contentAPI.updateGlossaryTerm(id, input, user);
    },

    deleteGlossaryTerm: async (_, { id }, { dataSources, user }) => {
      return await dataSources.contentAPI.deleteGlossaryTerm(id, user);
    },

    // User interactions
    bookmarkContent: async (_, { input }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.contentAPI.bookmarkContent(user.id, input);
    },

    unbookmarkContent: async (_, { contentId, contentType }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.contentAPI.unbookmarkContent(user.id, contentId, contentType);
    },

    rateContent: async (_, { input }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.contentAPI.rateContent(user.id, input);
    },

    commentOnContent: async (_, { input }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.contentAPI.commentOnContent(user.id, input);
    },

    reportContent: async (_, { input }, { dataSources, user }) => {
      if (!user) throw new Error('Not authenticated');
      return await dataSources.contentAPI.reportContent(user.id, input);
    },

    // Content analytics
    trackContentView: async (_, { input }, { dataSources, user }) => {
      return await dataSources.analyticsAPI.trackContentView(input, user?.id);
    },

    // Bulk operations
    bulkUpdateContent: async (_, { input }, { dataSources, user }) => {
      return await dataSources.contentAPI.bulkUpdateContent(input, user);
    },

    bulkDeleteContent: async (_, { ids }, { dataSources, user }) => {
      return await dataSources.contentAPI.bulkDeleteContent(ids, user);
    },

    // Import/Export
    importContent: async (_, { input }, { dataSources, user }) => {
      return await dataSources.contentAPI.importContent(input, user);
    },

    exportContent: async (_, { input }, { dataSources, user }) => {
      return await dataSources.contentAPI.exportContent(input, user);
    }
  },

  Subscription: {
    // Content updates
    contentUpdated: {
      subscribe: async (_, { contentType }, { pubsub }) => {
        return pubsub.asyncIterator([`CONTENT_UPDATED_${contentType || 'ALL'}`]);
      }
    },

    // New content notifications
    newContent: {
      subscribe: async (_, { categories }, { pubsub, user }) => {
        const channels = categories
          ? categories.map(cat => `NEW_CONTENT_${cat}`)
          : ['NEW_CONTENT_ALL'];
        return pubsub.asyncIterator(channels);
      }
    },

    // Content analytics updates
    contentAnalyticsUpdate: {
      subscribe: async (_, { contentId }, { pubsub, user }) => {
        return pubsub.asyncIterator([`CONTENT_ANALYTICS_${contentId}`]);
      }
    }
  },

  // Type resolvers
  Article: {
    author: async (parent, _, { dataSources }) => {
      return await dataSources.userAPI.getUser(parent.authorId);
    },

    category: async (parent, _, { dataSources }) => {
      if (parent.categoryId) {
        return await dataSources.contentAPI.getContentCategory(parent.categoryId);
      }
      return null;
    },

    tags: async (parent, _, { dataSources }) => {
      return await dataSources.contentAPI.getContentTags({ contentId: parent.id });
    },

    comments: async (parent, args, { dataSources }) => {
      return await dataSources.contentAPI.getContentComments(parent.id, args.input);
    },

    ratings: async (parent, _, { dataSources }) => {
      return await dataSources.contentAPI.getContentRatings(parent.id);
    },

    analytics: async (parent, _, { dataSources }) => {
      return await dataSources.analyticsAPI.getContentAnalytics({ contentId: parent.id });
    },

    relatedContent: async (parent, _, { dataSources }) => {
      return await dataSources.contentAPI.getRelatedContent(parent.id);
    }
  },

  Guide: {
    author: async (parent, _, { dataSources }) => {
      return await dataSources.userAPI.getUser(parent.authorId);
    },

    category: async (parent, _, { dataSources }) => {
      if (parent.categoryId) {
        return await dataSources.contentAPI.getContentCategory(parent.categoryId);
      }
      return null;
    },

    tags: async (parent, _, { dataSources }) => {
      return await dataSources.contentAPI.getContentTags({ contentId: parent.id });
    },

    steps: async (parent, _, { dataSources }) => {
      return await dataSources.contentAPI.getGuideSteps(parent.id);
    },

    prerequisites: async (parent, _, { dataSources }) => {
      return await dataSources.contentAPI.getGuidePrerequisites(parent.id);
    },

    relatedGuides: async (parent, _, { dataSources }) => {
      return await dataSources.contentAPI.getRelatedGuides(parent.id);
    }
  },

  FAQ: {
    category: async (parent, _, { dataSources }) => {
      if (parent.categoryId) {
        return await dataSources.contentAPI.getFAQCategory(parent.categoryId);
      }
      return null;
    },

    tags: async (parent, _, { dataSources }) => {
      return await dataSources.contentAPI.getContentTags({ contentId: parent.id });
    },

    relatedFAQs: async (parent, _, { dataSources }) => {
      return await dataSources.contentAPI.getRelatedFAQs(parent.id);
    }
  },

  Template: {
    author: async (parent, _, { dataSources }) => {
      return await dataSources.userAPI.getUser(parent.authorId);
    },

    category: async (parent, _, { dataSources }) => {
      if (parent.categoryId) {
        return await dataSources.contentAPI.getContentCategory(parent.categoryId);
      }
      return null;
    },

    tags: async (parent, _, { dataSources }) => {
      return await dataSources.contentAPI.getContentTags({ contentId: parent.id });
    },

    usage: async (parent, _, { dataSources }) => {
      return await dataSources.analyticsAPI.getTemplateUsage(parent.id);
    }
  },

  GlossaryTerm: {
    relatedTerms: async (parent, _, { dataSources }) => {
      return await dataSources.contentAPI.getRelatedGlossaryTerms(parent.id);
    },

    usage: async (parent, _, { dataSources }) => {
      return await dataSources.analyticsAPI.getGlossaryTermUsage(parent.id);
    }
  },

  ContentBookmark: {
    user: async (parent, _, { dataSources }) => {
      return await dataSources.userAPI.getUser(parent.userId);
    },

    content: async (parent, _, { dataSources }) => {
      switch (parent.contentType) {
        case 'ARTICLE':
          return await dataSources.contentAPI.getArticle(parent.contentId);
        case 'GUIDE':
          return await dataSources.contentAPI.getGuide(parent.contentId);
        case 'FAQ':
          return await dataSources.contentAPI.getFAQ(parent.contentId);
        case 'TEMPLATE':
          return await dataSources.contentAPI.getTemplate(parent.contentId);
        default:
          return null;
      }
    }
  },

  ContentComment: {
    user: async (parent, _, { dataSources }) => {
      return await dataSources.userAPI.getUser(parent.userId);
    },

    replies: async (parent, _, { dataSources }) => {
      return await dataSources.contentAPI.getCommentReplies(parent.id);
    }
  },

  ContentRating: {
    user: async (parent, _, { dataSources }) => {
      return await dataSources.userAPI.getUser(parent.userId);
    }
  }
};

module.exports = contentResolvers;