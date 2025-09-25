/**
 * Tax API Data Source
 * Handles all tax calculation related API calls
 */

const BaseAPI = require('./baseAPI');

class TaxAPI extends BaseAPI {
  constructor() {
    super();
    this.baseURL = process.env.TAX_SERVICE_URL || 'http://localhost:3001/api/v1';
  }

  // Tax calculations
  async calculateTax(input) {
    const query = this.buildQueryString(input);
    return this.get(`/tax/calculate?${query}`);
  }

  async estimateTax(input) {
    const query = this.buildQueryString(input);
    return this.get(`/tax/estimate?${query}`);
  }

  async optimizeTax(input) {
    return this.post('/tax/optimize', input);
  }

  // Tax brackets and rates
  async getTaxBrackets(country, taxYear) {
    return this.get(`/tax/brackets/${country}/${taxYear}`);
  }

  async getTaxRates(input) {
    const query = this.buildQueryString(input);
    return this.get(`/tax/rates?${query}`);
  }

  // Deductions and credits
  async getStandardDeductions(country, taxYear, filingStatus) {
    return this.get(`/tax/deductions/standard/${country}/${taxYear}/${filingStatus}`);
  }

  async getAvailableDeductions(input) {
    const query = this.buildQueryString(input);
    return this.get(`/tax/deductions?${query}`);
  }

  async getTaxCredits(input) {
    const query = this.buildQueryString(input);
    return this.get(`/tax/credits?${query}`);
  }

  // Tax forms and documents
  async getTaxForms(country, taxYear, category) {
    const query = category ? `?category=${category}` : '';
    return this.get(`/tax/forms/${country}/${taxYear}${query}`);
  }

  async getTaxForm(id) {
    return this.get(`/tax/forms/${id}`);
  }

  // Tax planning and scenarios
  async getTaxScenarios(userId) {
    return this.get(`/tax/scenarios?userId=${userId}`);
  }

  async compareTaxScenarios(scenarios) {
    return this.post('/tax/scenarios/compare', { scenarios });
  }

  // International tax
  async getTreatyBenefits(input) {
    const query = this.buildQueryString(input);
    return this.get(`/tax/international/treaty-benefits?${query}`);
  }

  async getTransferPricing(input) {
    return this.post('/tax/international/transfer-pricing', input);
  }

  // Tax calendar and deadlines
  async getTaxCalendar(country, taxYear) {
    return this.get(`/tax/calendar/${country}/${taxYear}`);
  }

  async getTaxDeadlines(country, taxYear) {
    return this.get(`/tax/deadlines/${country}/${taxYear}`);
  }

  // Save and manage calculations
  async saveTaxCalculation(input, userId) {
    return this.post('/tax/calculations', { ...input, userId });
  }

  async updateTaxCalculation(id, input, userId) {
    return this.put(`/tax/calculations/${id}`, { ...input, userId });
  }

  async deleteTaxCalculation(id, userId) {
    return this.delete(`/tax/calculations/${id}?userId=${userId}`);
  }

  // Generate tax reports
  async generateTaxReport(input, userId) {
    return this.post('/tax/reports/generate', { ...input, userId });
  }

  async exportTaxData(input, userId) {
    return this.post('/tax/export', { ...input, userId });
  }

  // Import tax data
  async importTaxData(input, userId) {
    return this.post('/tax/import', { ...input, userId });
  }

  // Tax form operations
  async fillTaxForm(input, userId) {
    return this.post('/tax/forms/fill', { ...input, userId });
  }

  async submitTaxForm(input, userId) {
    return this.post('/tax/forms/submit', { ...input, userId });
  }

  // Tax planning
  async createTaxScenario(input, userId) {
    return this.post('/tax/scenarios', { ...input, userId });
  }

  async updateTaxScenario(id, input, userId) {
    return this.put(`/tax/scenarios/${id}`, { ...input, userId });
  }

  async deleteTaxScenario(id, userId) {
    return this.delete(`/tax/scenarios/${id}?userId=${userId}`);
  }

  // Additional helper methods
  async getTaxBreakdown(calculationId) {
    return this.get(`/tax/calculations/${calculationId}/breakdown`);
  }

  async getTaxOptimizations(calculationId) {
    return this.get(`/tax/calculations/${calculationId}/optimizations`);
  }

  async getFormFields(formId) {
    return this.get(`/tax/forms/${formId}/fields`);
  }

  async getFormInstructions(formId) {
    return this.get(`/tax/forms/${formId}/instructions`);
  }

  async getScenarioCalculations(scenarioId) {
    return this.get(`/tax/scenarios/${scenarioId}/calculations`);
  }

  async compareScenarios(scenarioId, compareWithId) {
    return this.get(`/tax/scenarios/${scenarioId}/compare/${compareWithId}`);
  }
}

module.exports = TaxAPI;