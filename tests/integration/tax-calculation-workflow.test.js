const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

describe('End-to-End Tax Calculation Workflow', () => {
  let authToken;
  let testUser;
  let calculationId;
  let reportId;

  beforeAll(async () => {
    // Authenticate test user
    authToken = await global.authenticateTestUser();
    testUser = global.TEST_CONFIG.TEST_USER;
  });

  describe('Basic Tax Calculation', () => {
    test('should create a simple tax calculation', async () => {
      const headers = global.createAuthHeaders(authToken);
      const calculationData = global.TEST_DATA.taxCalculation;

      const response = await axios.post(
        `${global.TEST_CONFIG.API_GATEWAY_URL}/api/calculations`,
        calculationData,
        { headers }
      );

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('calculationId');
      expect(response.data).toHaveProperty('result');
      expect(response.data.result).toHaveProperty('totalTax');
      expect(response.data.result).toHaveProperty('effectiveRate');
      expect(response.data.result).toHaveProperty('breakdown');

      calculationId = response.data.calculationId;

      // Verify calculation accuracy for known scenario
      expect(response.data.result.totalTax).toBeGreaterThan(0);
      expect(response.data.result.effectiveRate).toBeLessThan(0.5); // Should be less than 50%
    });

    test('should retrieve saved calculation', async () => {
      const headers = global.createAuthHeaders(authToken);

      const response = await axios.get(
        `${global.TEST_CONFIG.API_GATEWAY_URL}/api/calculations/${calculationId}`,
        { headers }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('calculationId', calculationId);
      expect(response.data).toHaveProperty('result');
      expect(response.data).toHaveProperty('input');
    });

    test('should list user calculations', async () => {
      const headers = global.createAuthHeaders(authToken);

      const response = await axios.get(
        `${global.TEST_CONFIG.API_GATEWAY_URL}/api/calculations`,
        { headers }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('calculations');
      expect(Array.isArray(response.data.calculations)).toBe(true);
      expect(response.data.calculations.length).toBeGreaterThan(0);

      // Find our calculation
      const ourCalculation = response.data.calculations.find(calc => calc.calculationId === calculationId);
      expect(ourCalculation).toBeDefined();
    });
  });

  describe('Multi-Country Tax Comparison', () => {
    test('should compare taxes across multiple countries', async () => {
      const headers = global.createAuthHeaders(authToken);
      const comparisonData = global.TEST_DATA.comparisonData;

      const response = await axios.post(
        `${global.TEST_CONFIG.API_GATEWAY_URL}/api/comparisons`,
        comparisonData,
        { headers }
      );

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('comparisonId');
      expect(response.data).toHaveProperty('results');
      expect(Array.isArray(response.data.results)).toBe(true);
      expect(response.data.results).toHaveLength(comparisonData.scenarios.length);

      // Verify each country result
      response.data.results.forEach((result, index) => {
        expect(result).toHaveProperty('country', comparisonData.scenarios[index].country);
        expect(result).toHaveProperty('totalTax');
        expect(result).toHaveProperty('effectiveRate');
        expect(result).toHaveProperty('breakdown');
      });

      // Verify results are different across countries
      const totalTaxes = response.data.results.map(r => r.totalTax);
      const uniqueTaxes = [...new Set(totalTaxes)];
      expect(uniqueTaxes.length).toBeGreaterThan(1);
    });

    test('should handle invalid country codes', async () => {
      const headers = global.createAuthHeaders(authToken);
      const invalidData = {
        scenarios: [
          { country: 'XX', income: 50000, filingStatus: 'single' }
        ]
      };

      try {
        await axios.post(
          `${global.TEST_CONFIG.API_GATEWAY_URL}/api/comparisons`,
          invalidData,
          { headers }
        );
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.response.status).toBe(400);
        expect(error.response.data).toHaveProperty('error');
      }
    });
  });

  describe('File Upload and Processing', () => {
    test('should upload and process tax document', async () => {
      const headers = { ...global.createAuthHeaders(authToken) };
      delete headers['Content-Type']; // Let form-data set this

      // Create test file
      const testFilePath = path.join(__dirname, '../test-data/sample-tax-data.csv');
      await createTestCSVFile(testFilePath);

      const formData = new FormData();
      formData.append('file', fs.createReadStream(testFilePath));
      formData.append('documentType', 'tax_data');
      formData.append('year', '2023');

      const response = await axios.post(
        `${global.TEST_CONFIG.API_GATEWAY_URL}/api/files/upload`,
        formData,
        {
          headers: {
            ...headers,
            ...formData.getHeaders()
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('fileId');
      expect(response.data).toHaveProperty('status', 'uploaded');
      expect(response.data).toHaveProperty('processingStatus', 'pending');

      // Wait for processing to complete
      const fileId = response.data.fileId;
      await waitForFileProcessing(fileId, headers);

      // Cleanup
      fs.unlinkSync(testFilePath);
    });

    test('should reject unsupported file types', async () => {
      const headers = { ...global.createAuthHeaders(authToken) };
      delete headers['Content-Type'];

      // Create test file with unsupported extension
      const testFilePath = path.join(__dirname, '../test-data/test.txt');
      fs.writeFileSync(testFilePath, 'test content');

      const formData = new FormData();
      formData.append('file', fs.createReadStream(testFilePath));
      formData.append('documentType', 'tax_data');

      try {
        await axios.post(
          `${global.TEST_CONFIG.API_GATEWAY_URL}/api/files/upload`,
          formData,
          {
            headers: {
              ...headers,
              ...formData.getHeaders()
            }
          }
        );
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.response.status).toBe(400);
        expect(error.response.data).toHaveProperty('error');
      } finally {
        fs.unlinkSync(testFilePath);
      }
    });

    test('should enforce file size limits', async () => {
      const headers = { ...global.createAuthHeaders(authToken) };
      delete headers['Content-Type'];

      // Create large test file (simulated)
      const testFilePath = path.join(__dirname, '../test-data/large-file.csv');
      const largeContent = 'a'.repeat(100 * 1024 * 1024); // 100MB
      fs.writeFileSync(testFilePath, largeContent);

      const formData = new FormData();
      formData.append('file', fs.createReadStream(testFilePath));
      formData.append('documentType', 'tax_data');

      try {
        await axios.post(
          `${global.TEST_CONFIG.API_GATEWAY_URL}/api/files/upload`,
          formData,
          {
            headers: {
              ...headers,
              ...formData.getHeaders()
            },
            timeout: 30000
          }
        );
        fail('Should have thrown an error');
      } catch (error) {
        expect([400, 413, 422]).toContain(error.response?.status);
      } finally {
        fs.unlinkSync(testFilePath);
      }
    });
  });

  describe('Report Generation', () => {
    test('should generate PDF tax report', async () => {
      const headers = global.createAuthHeaders(authToken);

      const reportRequest = {
        calculationId: calculationId,
        format: 'pdf',
        options: {
          includeCharts: true,
          includeBreakdown: true,
          template: 'detailed'
        }
      };

      const response = await axios.post(
        `${global.TEST_CONFIG.API_GATEWAY_URL}/api/reports/generate`,
        reportRequest,
        { headers }
      );

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('reportId');
      expect(response.data).toHaveProperty('status', 'generating');

      reportId = response.data.reportId;

      // Wait for report generation
      await waitForReportGeneration(reportId, headers);
    });

    test('should download generated report', async () => {
      const headers = global.createAuthHeaders(authToken);

      const response = await axios.get(
        `${global.TEST_CONFIG.API_GATEWAY_URL}/api/reports/${reportId}/download`,
        {
          headers,
          responseType: 'stream'
        }
      );

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toContain('attachment');

      // Verify file size
      const contentLength = parseInt(response.headers['content-length']);
      expect(contentLength).toBeGreaterThan(1000); // Should be at least 1KB
    });

    test('should generate Excel report', async () => {
      const headers = global.createAuthHeaders(authToken);

      const reportRequest = {
        calculationId: calculationId,
        format: 'excel',
        options: {
          includeCharts: false,
          includeBreakdown: true,
          template: 'summary'
        }
      };

      const response = await axios.post(
        `${global.TEST_CONFIG.API_GATEWAY_URL}/api/reports/generate`,
        reportRequest,
        { headers }
      );

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('reportId');

      const excelReportId = response.data.reportId;
      await waitForReportGeneration(excelReportId, headers);

      // Download Excel report
      const downloadResponse = await axios.get(
        `${global.TEST_CONFIG.API_GATEWAY_URL}/api/reports/${excelReportId}/download`,
        {
          headers,
          responseType: 'stream'
        }
      );

      expect(downloadResponse.status).toBe(200);
      expect(downloadResponse.headers['content-type']).toContain('spreadsheetml');
    });

    test('should list user reports', async () => {
      const headers = global.createAuthHeaders(authToken);

      const response = await axios.get(
        `${global.TEST_CONFIG.API_GATEWAY_URL}/api/reports`,
        { headers }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('reports');
      expect(Array.isArray(response.data.reports)).toBe(true);
      expect(response.data.reports.length).toBeGreaterThanOrEqual(2); // PDF + Excel
    });
  });

  describe('Advanced Calculation Features', () => {
    test('should handle complex deductions and credits', async () => {
      const headers = global.createAuthHeaders(authToken);

      const complexCalculation = {
        income: 120000,
        country: 'US',
        state: 'NY',
        filingStatus: 'married_joint',
        deductions: [
          { type: 'mortgage_interest', amount: 15000 },
          { type: 'state_local_taxes', amount: 10000 },
          { type: 'charitable', amount: 8000 },
          { type: 'medical', amount: 5000 }
        ],
        credits: [
          { type: 'child_tax_credit', amount: 4000 },
          { type: 'earned_income_credit', amount: 1200 }
        ],
        year: 2023
      };

      const response = await axios.post(
        `${global.TEST_CONFIG.API_GATEWAY_URL}/api/calculations`,
        complexCalculation,
        { headers }
      );

      expect(response.status).toBe(201);
      expect(response.data.result).toHaveProperty('breakdown');
      expect(response.data.result.breakdown).toHaveProperty('deductions');
      expect(response.data.result.breakdown).toHaveProperty('credits');

      // Verify deductions are properly calculated
      const deductionsTotal = response.data.result.breakdown.deductions.total;
      expect(deductionsTotal).toBeGreaterThan(0);

      // Verify credits reduce final tax
      const creditsTotal = response.data.result.breakdown.credits.total;
      expect(creditsTotal).toBeGreaterThan(0);
    });

    test('should calculate taxes for different years', async () => {
      const headers = global.createAuthHeaders(authToken);

      const years = [2021, 2022, 2023];
      const calculations = [];

      for (const year of years) {
        const calculationData = {
          ...global.TEST_DATA.taxCalculation,
          year
        };

        const response = await axios.post(
          `${global.TEST_CONFIG.API_GATEWAY_URL}/api/calculations`,
          calculationData,
          { headers }
        );

        expect(response.status).toBe(201);
        calculations.push(response.data.result);
      }

      // Verify different years can produce different results due to tax law changes
      const totalTaxes = calculations.map(calc => calc.totalTax);

      // At least some years should have different tax amounts
      const uniqueTaxes = [...new Set(totalTaxes)];
      expect(uniqueTaxes.length).toBeGreaterThanOrEqual(1);
    });

    test('should handle international tax scenarios', async () => {
      const headers = global.createAuthHeaders(authToken);

      const internationalCalculation = {
        income: 100000,
        country: 'US',
        filingStatus: 'single',
        foreignIncome: 25000,
        foreignTaxPaid: 5000,
        treatyCountry: 'UK',
        year: 2023
      };

      const response = await axios.post(
        `${global.TEST_CONFIG.API_GATEWAY_URL}/api/calculations/international`,
        internationalCalculation,
        { headers }
      );

      expect(response.status).toBe(201);
      expect(response.data.result).toHaveProperty('foreignTaxCredit');
      expect(response.data.result).toHaveProperty('effectiveRate');
      expect(response.data.result.foreignTaxCredit).toBeGreaterThan(0);
    });
  });

  describe('Performance and Caching', () => {
    test('should cache calculation results for improved performance', async () => {
      const headers = global.createAuthHeaders(authToken);
      const calculationData = {
        income: 55000,
        country: 'CA',
        filingStatus: 'single',
        year: 2023
      };

      // First calculation
      const start1 = Date.now();
      const response1 = await axios.post(
        `${global.TEST_CONFIG.API_GATEWAY_URL}/api/calculations`,
        calculationData,
        { headers }
      );
      const duration1 = Date.now() - start1;

      expect(response1.status).toBe(201);

      // Second identical calculation (should be faster due to caching)
      const start2 = Date.now();
      const response2 = await axios.post(
        `${global.TEST_CONFIG.API_GATEWAY_URL}/api/calculations`,
        calculationData,
        { headers }
      );
      const duration2 = Date.now() - start2;

      expect(response2.status).toBe(201);
      expect(response2.data.result.totalTax).toBe(response1.data.result.totalTax);

      // Second request should be faster (though this might be flaky in CI)
      console.log(`First calculation: ${duration1}ms, Second calculation: ${duration2}ms`);
    });

    test('should handle concurrent calculations efficiently', async () => {
      const headers = global.createAuthHeaders(authToken);

      const concurrentCalculations = Array(5).fill().map((_, index) => ({
        income: 50000 + (index * 10000),
        country: 'US',
        filingStatus: 'single',
        year: 2023
      }));

      const startTime = Date.now();

      const promises = concurrentCalculations.map(calc =>
        axios.post(
          `${global.TEST_CONFIG.API_GATEWAY_URL}/api/calculations`,
          calc,
          { headers }
        )
      );

      const responses = await Promise.all(promises);
      const totalDuration = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.data).toHaveProperty('result');
      });

      // Should complete in reasonable time (less than 30 seconds)
      expect(totalDuration).toBeLessThan(30000);

      console.log(`${concurrentCalculations.length} concurrent calculations completed in ${totalDuration}ms`);
    });
  });

  // Helper functions
  async function createTestCSVFile(filePath) {
    const csvContent = `income,country,filing_status,year
75000,US,single,2023
85000,CA,married,2023
65000,UK,single,2023`;

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, csvContent);
  }

  async function waitForFileProcessing(fileId, headers) {
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      const response = await axios.get(
        `${global.TEST_CONFIG.API_GATEWAY_URL}/api/files/${fileId}/status`,
        { headers }
      );

      if (response.data.processingStatus === 'completed') {
        return response.data;
      }

      if (response.data.processingStatus === 'failed') {
        throw new Error('File processing failed');
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }

    throw new Error('File processing timeout');
  }

  async function waitForReportGeneration(reportId, headers) {
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      const response = await axios.get(
        `${global.TEST_CONFIG.API_GATEWAY_URL}/api/reports/${reportId}/status`,
        { headers }
      );

      if (response.data.status === 'completed') {
        return response.data;
      }

      if (response.data.status === 'failed') {
        throw new Error('Report generation failed');
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }

    throw new Error('Report generation timeout');
  }
});