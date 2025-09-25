/**
 * Tax Calculation Resolvers
 * Handles all tax-related GraphQL operations
 */

const taxResolvers = {
  Query: {
    // Tax calculations
    calculateTax: async (_, { input }, { dataSources, user }) => {
      return await dataSources.taxAPI.calculateTax(input);
    },

    estimateTax: async (_, { input }, { dataSources, user }) => {
      return await dataSources.taxAPI.estimateTax(input);
    },

    optimizeTax: async (_, { input }, { dataSources, user }) => {
      return await dataSources.taxAPI.optimizeTax(input);
    },

    // Tax brackets and rates
    taxBrackets: async (_, { country, taxYear }, { dataSources }) => {
      return await dataSources.taxAPI.getTaxBrackets(country, taxYear);
    },

    taxRates: async (_, { input }, { dataSources }) => {
      return await dataSources.taxAPI.getTaxRates(input);
    },

    // Deductions and credits
    standardDeductions: async (_, { country, taxYear, filingStatus }, { dataSources }) => {
      return await dataSources.taxAPI.getStandardDeductions(country, taxYear, filingStatus);
    },

    availableDeductions: async (_, { input }, { dataSources }) => {
      return await dataSources.taxAPI.getAvailableDeductions(input);
    },

    taxCredits: async (_, { input }, { dataSources }) => {
      return await dataSources.taxAPI.getTaxCredits(input);
    },

    // Tax forms and documents
    taxForms: async (_, { country, taxYear, category }, { dataSources }) => {
      return await dataSources.taxAPI.getTaxForms(country, taxYear, category);
    },

    taxForm: async (_, { id }, { dataSources }) => {
      return await dataSources.taxAPI.getTaxForm(id);
    },

    // Tax planning and scenarios
    taxScenarios: async (_, { userId }, { dataSources, user }) => {
      return await dataSources.taxAPI.getTaxScenarios(userId);
    },

    compareTaxScenarios: async (_, { scenarios }, { dataSources, user }) => {
      return await dataSources.taxAPI.compareTaxScenarios(scenarios);
    },

    // International tax
    treatyBenefits: async (_, { input }, { dataSources }) => {
      return await dataSources.taxAPI.getTreatyBenefits(input);
    },

    transferPricing: async (_, { input }, { dataSources }) => {
      return await dataSources.taxAPI.getTransferPricing(input);
    },

    // Tax calendar and deadlines
    taxCalendar: async (_, { country, taxYear }, { dataSources }) => {
      return await dataSources.taxAPI.getTaxCalendar(country, taxYear);
    },

    taxDeadlines: async (_, { country, taxYear }, { dataSources }) => {
      return await dataSources.taxAPI.getTaxDeadlines(country, taxYear);
    }
  },

  Mutation: {
    // Save and manage calculations
    saveTaxCalculation: async (_, { input }, { dataSources, user }) => {
      return await dataSources.taxAPI.saveTaxCalculation(input, user.id);
    },

    updateTaxCalculation: async (_, { id, input }, { dataSources, user }) => {
      return await dataSources.taxAPI.updateTaxCalculation(id, input, user.id);
    },

    deleteTaxCalculation: async (_, { id }, { dataSources, user }) => {
      return await dataSources.taxAPI.deleteTaxCalculation(id, user.id);
    },

    // Generate tax reports
    generateTaxReport: async (_, { input }, { dataSources, user }) => {
      return await dataSources.taxAPI.generateTaxReport(input, user.id);
    },

    exportTaxData: async (_, { input }, { dataSources, user }) => {
      return await dataSources.taxAPI.exportTaxData(input, user.id);
    },

    // Import tax data
    importTaxData: async (_, { input }, { dataSources, user }) => {
      return await dataSources.taxAPI.importTaxData(input, user.id);
    },

    // Tax form operations
    fillTaxForm: async (_, { input }, { dataSources, user }) => {
      return await dataSources.taxAPI.fillTaxForm(input, user.id);
    },

    submitTaxForm: async (_, { input }, { dataSources, user }) => {
      return await dataSources.taxAPI.submitTaxForm(input, user.id);
    },

    // Tax planning
    createTaxScenario: async (_, { input }, { dataSources, user }) => {
      return await dataSources.taxAPI.createTaxScenario(input, user.id);
    },

    updateTaxScenario: async (_, { id, input }, { dataSources, user }) => {
      return await dataSources.taxAPI.updateTaxScenario(id, input, user.id);
    },

    deleteTaxScenario: async (_, { id }, { dataSources, user }) => {
      return await dataSources.taxAPI.deleteTaxScenario(id, user.id);
    }
  },

  Subscription: {
    // Real-time tax calculation updates
    taxCalculationUpdated: {
      subscribe: async (_, { userId }, { pubsub, user }) => {
        return pubsub.asyncIterator([`TAX_CALCULATION_UPDATED_${userId}`]);
      }
    },

    // Tax rate changes
    taxRateChanged: {
      subscribe: async (_, { country }, { pubsub }) => {
        return pubsub.asyncIterator([`TAX_RATE_CHANGED_${country}`]);
      }
    },

    // Tax deadline reminders
    taxDeadlineReminder: {
      subscribe: async (_, { userId }, { pubsub, user }) => {
        return pubsub.asyncIterator([`TAX_DEADLINE_REMINDER_${userId}`]);
      }
    }
  },

  // Type resolvers
  TaxCalculation: {
    user: async (parent, _, { dataSources }) => {
      return await dataSources.userAPI.getUser(parent.userId);
    },

    breakdown: async (parent, _, { dataSources }) => {
      return await dataSources.taxAPI.getTaxBreakdown(parent.id);
    },

    optimizations: async (parent, _, { dataSources }) => {
      return await dataSources.taxAPI.getTaxOptimizations(parent.id);
    }
  },

  TaxBracket: {
    effectiveRate: (parent) => {
      if (parent.income && parent.taxOwed) {
        return (parent.taxOwed / parent.income) * 100;
      }
      return 0;
    }
  },

  TaxForm: {
    fields: async (parent, _, { dataSources }) => {
      return await dataSources.taxAPI.getFormFields(parent.id);
    },

    instructions: async (parent, _, { dataSources }) => {
      return await dataSources.taxAPI.getFormInstructions(parent.id);
    }
  },

  TaxScenario: {
    calculations: async (parent, _, { dataSources }) => {
      return await dataSources.taxAPI.getScenarioCalculations(parent.id);
    },

    comparison: async (parent, args, { dataSources }) => {
      if (args.compareWith) {
        return await dataSources.taxAPI.compareScenarios(parent.id, args.compareWith);
      }
      return null;
    }
  }
};

module.exports = taxResolvers;