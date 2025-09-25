/**
 * GlobalTaxCalc JavaScript SDK Template
 * Official SDK for the GlobalTaxCalc API
 */

class GlobalTaxCalcSDK {
  constructor(options = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl || 'https://api.globaltaxcalc.com';
    this.version = options.version || '2.0.0';
    this.timeout = options.timeout || 30000;

    if (!this.apiKey) {
      throw new Error('API key is required. Get one at https://portal.globaltaxcalc.com');
    }

    this.client = this.createHTTPClient();
    this.graphql = this.createGraphQLClient();
  }

  createHTTPClient() {
    return {
      request: async (method, endpoint, data = null) => {
        const url = `${this.baseUrl}${endpoint}`;
        const options = {
          method,
          headers: {
            'X-API-Key': this.apiKey,
            'API-Version': this.version,
            'Content-Type': 'application/json',
            'User-Agent': `GlobalTaxCalc-JS-SDK/1.0.0`
          }
        };

        if (data) {
          options.body = JSON.stringify(data);
        }

        try {
          const response = await fetch(url, options);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          return await response.json();
        } catch (error) {
          throw new Error(`Request failed: ${error.message}`);
        }
      }
    };
  }

  createGraphQLClient() {
    return {
      query: async (query, variables = {}) => {
        return await this.client.request('POST', '/graphql', {
          query,
          variables
        });
      },

      mutate: async (mutation, variables = {}) => {
        return await this.client.request('POST', '/graphql', {
          query: mutation,
          variables
        });
      },

      subscribe: (subscription, variables = {}, callback) => {
        // WebSocket implementation for subscriptions
        const ws = new WebSocket(`${this.baseUrl.replace('http', 'ws')}/graphql`);

        ws.onopen = () => {
          ws.send(JSON.stringify({
            type: 'connection_init',
            payload: {
              authorization: `Bearer ${this.apiKey}`
            }
          }));
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === 'data') {
            callback(null, data.payload);
          }
        };

        ws.onerror = (error) => {
          callback(error, null);
        };

        return () => ws.close();
      }
    };
  }

  // Tax Calculation Methods
  async calculateTax(input) {
    const query = `
      query CalculateTax($input: TaxCalculationInput!) {
        calculateTax(input: $input) {
          id
          totalTax
          effectiveRate
          marginalRate
          breakdown {
            federalTax
            stateTax
            localTax
            socialSecurity
            medicare
          }
          deductions {
            standard
            itemized
            total
          }
          credits {
            childCredit
            educationCredit
            otherCredits
            total
          }
        }
      }
    `;

    const response = await this.graphql.query(query, { input });
    return response.data.calculateTax;
  }

  async estimateTax(input) {
    const query = `
      query EstimateTax($input: TaxEstimateInput!) {
        estimateTax(input: $input) {
          estimatedTax
          confidence
          breakdown {
            federalTax
            stateTax
            localTax
          }
          recommendations
        }
      }
    `;

    const response = await this.graphql.query(query, { input });
    return response.data.estimateTax;
  }

  async optimizeTax(input) {
    const mutation = `
      mutation OptimizeTax($input: TaxOptimizationInput!) {
        optimizeTax(input: $input) {
          originalTax
          optimizedTax
          savings
          strategies {
            name
            description
            savings
            complexity
          }
        }
      }
    `;

    const response = await this.graphql.mutate(mutation, { input });
    return response.data.optimizeTax;
  }

  // User Management Methods
  async getProfile() {
    const query = `
      query GetProfile {
        me {
          id
          email
          profile {
            firstName
            lastName
            country
            currency
          }
          preferences {
            language
            timezone
            notifications
          }
        }
      }
    `;

    const response = await this.graphql.query(query);
    return response.data.me;
  }

  async updateProfile(profileData) {
    const mutation = `
      mutation UpdateProfile($input: ProfileUpdateInput!) {
        updateProfile(input: $input) {
          success
          user {
            id
            profile {
              firstName
              lastName
              country
            }
          }
        }
      }
    `;

    const response = await this.graphql.mutate(mutation, { input: profileData });
    return response.data.updateProfile;
  }

  // Subscription Management Methods
  async getSubscription() {
    const query = `
      query GetSubscription {
        userSubscription {
          id
          plan {
            name
            price
            features
          }
          status
          currentPeriodEnd
          usage {
            requests
            calculations
            limit
          }
        }
      }
    `;

    const response = await this.graphql.query(query);
    return response.data.userSubscription;
  }

  async getUsageMetrics(timeRange = '30d') {
    const query = `
      query GetUsageMetrics($input: UsageMetricsInput!) {
        usageMetrics(input: $input) {
          requests
          calculations
          dataTransfer
          period {
            start
            end
          }
          breakdown {
            date
            requests
            calculations
          }
        }
      }
    `;

    const response = await this.graphql.query(query, {
      input: { timeRange }
    });
    return response.data.usageMetrics;
  }

  // Real-time Subscriptions
  subscribeTaxCalculations(callback) {
    const subscription = `
      subscription TaxCalculationUpdated {
        taxCalculationUpdated {
          id
          status
          totalTax
          timestamp
        }
      }
    `;

    return this.graphql.subscribe(subscription, {}, callback);
  }

  subscribeUsageAlerts(callback) {
    const subscription = `
      subscription UsageAlert {
        usageAlert {
          type
          message
          utilization
          limit
          timestamp
        }
      }
    `;

    return this.graphql.subscribe(subscription, {}, callback);
  }

  // Webhook Management
  async createWebhook(webhookData) {
    const mutation = `
      mutation CreateWebhook($input: WebhookInput!) {
        createWebhook(input: $input) {
          id
          url
          events
          secret
          status
        }
      }
    `;

    const response = await this.graphql.mutate(mutation, { input: webhookData });
    return response.data.createWebhook;
  }

  // Utility Methods
  async validateApiKey() {
    try {
      const response = await this.client.request('GET', '/health');
      return response.status === 'OK';
    } catch (error) {
      return false;
    }
  }

  async getApiInfo() {
    const query = `
      query GetApiInfo {
        apiInfo {
          version
          description
          features
          endpoints {
            graphql
            rest
          }
          rateLimit {
            requests
            window
          }
        }
      }
    `;

    const response = await this.graphql.query(query);
    return response.data.apiInfo;
  }

  // Helper Methods
  createTaxCalculationInput(options) {
    const {
      income,
      country = 'US',
      state = null,
      filingStatus = 'SINGLE',
      taxYear = new Date().getFullYear(),
      deductions = {},
      credits = {},
      dependents = 0
    } = options;

    return {
      income: parseFloat(income),
      country,
      state,
      filingStatus,
      taxYear: parseInt(taxYear),
      deductions,
      credits,
      dependents: parseInt(dependents)
    };
  }

  formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  formatPercentage(rate) {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(rate / 100);
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GlobalTaxCalcSDK;
} else if (typeof window !== 'undefined') {
  window.GlobalTaxCalcSDK = GlobalTaxCalcSDK;
}

// Usage Examples (commented out)
/*
// Initialize SDK
const sdk = new GlobalTaxCalcSDK({
  apiKey: 'your-api-key-here',
  baseUrl: 'https://api.globaltaxcalc.com' // optional
});

// Calculate tax
const taxResult = await sdk.calculateTax({
  income: 75000,
  country: 'US',
  state: 'CA',
  filingStatus: 'SINGLE'
});

console.log('Tax owed:', sdk.formatCurrency(taxResult.totalTax));
console.log('Effective rate:', sdk.formatPercentage(taxResult.effectiveRate));

// Subscribe to real-time updates
const unsubscribe = sdk.subscribeTaxCalculations((error, data) => {
  if (error) {
    console.error('Subscription error:', error);
  } else {
    console.log('Tax calculation updated:', data);
  }
});

// Unsubscribe when done
// unsubscribe();

// Get usage metrics
const usage = await sdk.getUsageMetrics('7d');
console.log('API usage last 7 days:', usage);
*/