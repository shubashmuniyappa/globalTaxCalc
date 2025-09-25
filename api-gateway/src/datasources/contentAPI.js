/**
 * Content API Data Source
 * Handles all content management related API calls
 */

const BaseAPI = require('./baseAPI');

class ContentAPI extends BaseAPI {
  constructor() {
    super();
    this.baseURL = process.env.CONTENT_SERVICE_URL || 'http://localhost:3005/api/v1';
  }

  // Articles
  async getArticles(input) {
    const query = this.buildQueryString(input);
    return this.get(`/articles?${query}`);
  }

  async getArticle(id) {
    return this.get(`/articles/${id}`);
  }

  async getArticleBySlug(slug) {
    return this.get(`/articles/slug/${slug}`);
  }

  // Guides
  async getGuides(input) {
    const query = this.buildQueryString(input);
    return this.get(`/guides?${query}`);
  }

  async getGuide(id) {
    return this.get(`/guides/${id}`);
  }

  async getGuideBySlug(slug) {
    return this.get(`/guides/slug/${slug}`);
  }

  // FAQs
  async getFAQs(input) {
    const query = this.buildQueryString(input);
    return this.get(`/faqs?${query}`);
  }

  async getFAQ(id) {
    return this.get(`/faqs/${id}`);
  }

  async getFAQCategories() {
    return this.get('/faqs/categories');
  }

  async getFAQCategory(categoryId) {
    return this.get(`/faqs/categories/${categoryId}`);
  }

  // Templates
  async getTemplates(input) {
    const query = this.buildQueryString(input);
    return this.get(`/templates?${query}`);
  }

  async getTemplate(id) {
    return this.get(`/templates/${id}`);
  }

  async getTemplateBySlug(slug) {
    return this.get(`/templates/slug/${slug}`);
  }

  // Glossary
  async getGlossaryTerms(input) {
    const query = this.buildQueryString(input);
    return this.get(`/glossary?${query}`);
  }

  async getGlossaryTerm(id) {
    return this.get(`/glossary/${id}`);
  }

  async getGlossaryTermBySlug(slug) {
    return this.get(`/glossary/slug/${slug}`);
  }

  // Search
  async searchContent(input) {
    return this.post('/search', input);
  }

  // Categories and tags
  async getContentCategories(type) {
    const query = type ? `?type=${type}` : '';
    return this.get(`/categories${query}`);
  }

  async getContentCategory(categoryId) {
    return this.get(`/categories/${categoryId}`);
  }

  async getContentTags(input) {
    const query = this.buildQueryString(input);
    return this.get(`/tags?${query}`);
  }

  // Popular content
  async getPopularContent(input) {
    const query = this.buildQueryString(input);
    return this.get(`/popular?${query}`);
  }

  // User interactions
  async getUserBookmarks(userId) {
    return this.get(`/users/${userId}/bookmarks`);
  }

  async getUserHistory(userId, input) {
    const query = this.buildQueryString(input);
    return this.get(`/users/${userId}/history?${query}`);
  }

  // Localization
  async getLocalizedContent(input) {
    const query = this.buildQueryString(input);
    return this.get(`/localized?${query}`);
  }

  // Article management
  async createArticle(input, user) {
    return this.post('/articles', { ...input, authorId: user.id });
  }

  async updateArticle(id, input, user) {
    return this.put(`/articles/${id}`, { ...input, updatedBy: user.id });
  }

  async deleteArticle(id, user) {
    return this.delete(`/articles/${id}?userId=${user.id}`);
  }

  async publishArticle(id, user) {
    return this.post(`/articles/${id}/publish`, { publishedBy: user.id });
  }

  async unpublishArticle(id, user) {
    return this.post(`/articles/${id}/unpublish`, { unpublishedBy: user.id });
  }

  // Guide management
  async createGuide(input, user) {
    return this.post('/guides', { ...input, authorId: user.id });
  }

  async updateGuide(id, input, user) {
    return this.put(`/guides/${id}`, { ...input, updatedBy: user.id });
  }

  async deleteGuide(id, user) {
    return this.delete(`/guides/${id}?userId=${user.id}`);
  }

  // FAQ management
  async createFAQ(input, user) {
    return this.post('/faqs', { ...input, createdBy: user.id });
  }

  async updateFAQ(id, input, user) {
    return this.put(`/faqs/${id}`, { ...input, updatedBy: user.id });
  }

  async deleteFAQ(id, user) {
    return this.delete(`/faqs/${id}?userId=${user.id}`);
  }

  // Template management
  async createTemplate(input, user) {
    return this.post('/templates', { ...input, authorId: user.id });
  }

  async updateTemplate(id, input, user) {
    return this.put(`/templates/${id}`, { ...input, updatedBy: user.id });
  }

  async deleteTemplate(id, user) {
    return this.delete(`/templates/${id}?userId=${user.id}`);
  }

  // Glossary management
  async createGlossaryTerm(input, user) {
    return this.post('/glossary', { ...input, createdBy: user.id });
  }

  async updateGlossaryTerm(id, input, user) {
    return this.put(`/glossary/${id}`, { ...input, updatedBy: user.id });
  }

  async deleteGlossaryTerm(id, user) {
    return this.delete(`/glossary/${id}?userId=${user.id}`);
  }

  // User interactions
  async bookmarkContent(userId, input) {
    return this.post(`/users/${userId}/bookmarks`, input);
  }

  async unbookmarkContent(userId, contentId, contentType) {
    return this.delete(`/users/${userId}/bookmarks/${contentType}/${contentId}`);
  }

  async rateContent(userId, input) {
    return this.post(`/users/${userId}/ratings`, input);
  }

  async commentOnContent(userId, input) {
    return this.post(`/users/${userId}/comments`, input);
  }

  async reportContent(userId, input) {
    return this.post(`/users/${userId}/reports`, input);
  }

  // Bulk operations
  async bulkUpdateContent(input, user) {
    return this.post('/bulk/update', { ...input, updatedBy: user.id });
  }

  async bulkDeleteContent(ids, user) {
    return this.post('/bulk/delete', { ids, deletedBy: user.id });
  }

  // Import/Export
  async importContent(input, user) {
    return this.post('/import', { ...input, importedBy: user.id });
  }

  async exportContent(input, user) {
    return this.post('/export', { ...input, exportedBy: user.id });
  }

  // Helper methods for resolvers
  async getContentComments(contentId, input) {
    const query = this.buildQueryString(input);
    return this.get(`/content/${contentId}/comments?${query}`);
  }

  async getContentRatings(contentId) {
    return this.get(`/content/${contentId}/ratings`);
  }

  async getRelatedContent(contentId) {
    return this.get(`/content/${contentId}/related`);
  }

  async getGuideSteps(guideId) {
    return this.get(`/guides/${guideId}/steps`);
  }

  async getGuidePrerequisites(guideId) {
    return this.get(`/guides/${guideId}/prerequisites`);
  }

  async getRelatedGuides(guideId) {
    return this.get(`/guides/${guideId}/related`);
  }

  async getRelatedFAQs(faqId) {
    return this.get(`/faqs/${faqId}/related`);
  }

  async getRelatedGlossaryTerms(termId) {
    return this.get(`/glossary/${termId}/related`);
  }

  async getCommentReplies(commentId) {
    return this.get(`/comments/${commentId}/replies`);
  }
}

module.exports = ContentAPI;