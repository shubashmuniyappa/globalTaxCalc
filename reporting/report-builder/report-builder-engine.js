/**
 * Custom Report Builder Engine
 * Drag-and-drop report designer with advanced field selection and template management
 */

const { v4: uuidv4 } = require('uuid');

class ReportBuilderEngine {
    constructor() {
        this.reportTemplates = new Map();
        this.customFields = new Map();
        this.dataConnections = new Map();
        this.calculatedFields = new Map();
        this.reportDefinitions = new Map();
        this.initializeDefaultTemplates();
        this.initializeCalculatedFieldLibrary();
    }

    initializeDefaultTemplates() {
        const defaultTemplates = [
            {
                id: 'tax_summary_report',
                name: 'Tax Summary Report',
                description: 'Comprehensive overview of tax calculations and liabilities',
                category: 'tax_analysis',
                layout: {
                    type: 'tabular',
                    orientation: 'portrait',
                    pageSize: 'letter'
                },
                sections: [
                    {
                        id: 'header',
                        type: 'header',
                        fields: ['client_name', 'tax_year', 'filing_status', 'report_date']
                    },
                    {
                        id: 'income_summary',
                        type: 'section',
                        title: 'Income Summary',
                        fields: ['total_income', 'wages', 'business_income', 'investment_income']
                    },
                    {
                        id: 'deductions',
                        type: 'section',
                        title: 'Deductions',
                        fields: ['standard_deduction', 'itemized_deductions', 'business_expenses']
                    },
                    {
                        id: 'tax_calculation',
                        type: 'section',
                        title: 'Tax Calculation',
                        fields: ['adjusted_gross_income', 'taxable_income', 'total_tax', 'effective_rate']
                    }
                ],
                filters: [
                    { field: 'tax_year', type: 'year_range', required: true },
                    { field: 'client_type', type: 'multiselect', options: ['individual', 'business'] }
                ],
                grouping: ['client_type', 'tax_year'],
                sorting: [{ field: 'client_name', direction: 'asc' }]
            },
            {
                id: 'business_analysis_report',
                name: 'Business Tax Analysis',
                description: 'Detailed analysis of business tax calculations and deductions',
                category: 'business_analysis',
                layout: {
                    type: 'dashboard',
                    orientation: 'landscape',
                    pageSize: 'legal'
                },
                sections: [
                    {
                        id: 'business_overview',
                        type: 'kpi_cards',
                        fields: ['total_revenue', 'total_expenses', 'net_profit', 'tax_liability']
                    },
                    {
                        id: 'revenue_breakdown',
                        type: 'chart',
                        chartType: 'pie',
                        fields: ['sales_revenue', 'service_revenue', 'other_revenue']
                    },
                    {
                        id: 'expense_analysis',
                        type: 'chart',
                        chartType: 'bar',
                        fields: ['cost_of_goods', 'operating_expenses', 'depreciation']
                    },
                    {
                        id: 'quarterly_trends',
                        type: 'chart',
                        chartType: 'line',
                        fields: ['q1_profit', 'q2_profit', 'q3_profit', 'q4_profit']
                    }
                ]
            },
            {
                id: 'compliance_report',
                name: 'Tax Compliance Report',
                description: 'Compliance status and audit trail for tax filings',
                category: 'compliance',
                layout: {
                    type: 'detailed',
                    orientation: 'portrait',
                    pageSize: 'letter'
                },
                sections: [
                    {
                        id: 'filing_status',
                        type: 'section',
                        title: 'Filing Status',
                        fields: ['filing_date', 'due_date', 'extension_status', 'payment_status']
                    },
                    {
                        id: 'audit_trail',
                        type: 'table',
                        title: 'Calculation Audit Trail',
                        fields: ['calculation_date', 'user', 'changes_made', 'verification_status']
                    }
                ]
            }
        ];

        defaultTemplates.forEach(template => {
            this.reportTemplates.set(template.id, template);
        });
    }

    initializeCalculatedFieldLibrary() {
        const calculatedFields = [
            {
                id: 'effective_tax_rate',
                name: 'Effective Tax Rate',
                formula: '(total_tax / adjusted_gross_income) * 100',
                dataType: 'percentage',
                category: 'tax_metrics'
            },
            {
                id: 'marginal_tax_rate',
                name: 'Marginal Tax Rate',
                formula: 'getMarginalRate(taxable_income, filing_status)',
                dataType: 'percentage',
                category: 'tax_metrics'
            },
            {
                id: 'net_profit_margin',
                name: 'Net Profit Margin',
                formula: '(net_profit / total_revenue) * 100',
                dataType: 'percentage',
                category: 'business_metrics'
            },
            {
                id: 'tax_savings',
                name: 'Tax Savings',
                formula: 'previous_year_tax - current_year_tax',
                dataType: 'currency',
                category: 'comparative_metrics'
            },
            {
                id: 'deduction_utilization',
                name: 'Deduction Utilization Rate',
                formula: '(itemized_deductions / standard_deduction) * 100',
                dataType: 'percentage',
                category: 'optimization_metrics'
            }
        ];

        calculatedFields.forEach(field => {
            this.calculatedFields.set(field.id, field);
        });
    }

    /**
     * Report Definition Management
     */
    async createReportDefinition(reportData) {
        try {
            const reportDefinition = {
                id: uuidv4(),
                name: reportData.name,
                description: reportData.description,
                category: reportData.category || 'custom',
                tenantId: reportData.tenantId,
                createdBy: reportData.createdBy,
                isPublic: reportData.isPublic || false,

                // Data Configuration
                dataSource: {
                    type: reportData.dataSource.type || 'database',
                    connectionId: reportData.dataSource.connectionId,
                    tables: reportData.dataSource.tables || [],
                    joins: reportData.dataSource.joins || [],
                    customQuery: reportData.dataSource.customQuery
                },

                // Layout Configuration
                layout: {
                    type: reportData.layout.type || 'tabular', // tabular, dashboard, pivot, chart
                    orientation: reportData.layout.orientation || 'portrait',
                    pageSize: reportData.layout.pageSize || 'letter',
                    margins: reportData.layout.margins || { top: 20, right: 20, bottom: 20, left: 20 },
                    headerHeight: reportData.layout.headerHeight || 50,
                    footerHeight: reportData.layout.footerHeight || 30
                },

                // Fields Configuration
                fields: reportData.fields.map(field => ({
                    id: field.id || uuidv4(),
                    name: field.name,
                    displayName: field.displayName || field.name,
                    dataType: field.dataType,
                    source: field.source, // database_field, calculated_field, parameter
                    formula: field.formula,
                    aggregation: field.aggregation, // sum, avg, count, min, max
                    formatting: field.formatting,
                    width: field.width,
                    alignment: field.alignment || 'left',
                    visible: field.visible !== false,
                    sortable: field.sortable !== false,
                    filterable: field.filterable !== false
                })),

                // Filters Configuration
                filters: reportData.filters.map(filter => ({
                    id: filter.id || uuidv4(),
                    field: filter.field,
                    type: filter.type, // text, number, date, select, multiselect
                    operator: filter.operator || 'equals',
                    value: filter.value,
                    required: filter.required || false,
                    options: filter.options,
                    label: filter.label,
                    placeholder: filter.placeholder
                })),

                // Grouping and Sorting
                grouping: reportData.grouping || [],
                sorting: reportData.sorting || [],

                // Sections (for complex layouts)
                sections: reportData.sections || [],

                // Styling
                styling: {
                    theme: reportData.styling?.theme || 'default',
                    colors: reportData.styling?.colors || {},
                    fonts: reportData.styling?.fonts || {},
                    customCss: reportData.styling?.customCss || ''
                },

                // Export Options
                exportOptions: {
                    formats: reportData.exportOptions?.formats || ['pdf', 'excel', 'csv'],
                    defaultFormat: reportData.exportOptions?.defaultFormat || 'pdf',
                    includeCharts: reportData.exportOptions?.includeCharts !== false,
                    paperSize: reportData.exportOptions?.paperSize || 'letter'
                },

                // Performance Settings
                performance: {
                    cacheEnabled: reportData.performance?.cacheEnabled !== false,
                    cacheDuration: reportData.performance?.cacheDuration || 3600, // 1 hour
                    maxRows: reportData.performance?.maxRows || 10000,
                    timeout: reportData.performance?.timeout || 30000 // 30 seconds
                },

                // Metadata
                version: 1,
                createdAt: new Date(),
                updatedAt: new Date(),
                tags: reportData.tags || [],
                permissions: reportData.permissions || []
            };

            // Validate report definition
            await this.validateReportDefinition(reportDefinition);

            // Save report definition
            await this.saveReportDefinition(reportDefinition);

            console.log(`Report definition created: ${reportDefinition.name} (${reportDefinition.id})`);
            return reportDefinition;

        } catch (error) {
            console.error('Error creating report definition:', error);
            throw error;
        }
    }

    async updateReportDefinition(reportId, updates) {
        try {
            const reportDefinition = await this.getReportDefinition(reportId);
            if (!reportDefinition) {
                throw new Error('Report definition not found');
            }

            const updatedDefinition = {
                ...reportDefinition,
                ...updates,
                version: reportDefinition.version + 1,
                updatedAt: new Date()
            };

            await this.validateReportDefinition(updatedDefinition);
            await this.saveReportDefinition(updatedDefinition);

            console.log(`Report definition updated: ${reportId}`);
            return updatedDefinition;

        } catch (error) {
            console.error('Error updating report definition:', error);
            throw error;
        }
    }

    /**
     * Field Management
     */
    async getAvailableFields(dataSourceId, tenantId) {
        try {
            const dataSource = await this.getDataSource(dataSourceId, tenantId);
            if (!dataSource) {
                throw new Error('Data source not found');
            }

            const fields = [];

            // Get database fields
            for (const table of dataSource.tables) {
                const tableFields = await this.getTableFields(table, tenantId);
                fields.push(...tableFields);
            }

            // Get calculated fields
            const calculatedFields = Array.from(this.calculatedFields.values());
            fields.push(...calculatedFields.map(field => ({
                ...field,
                source: 'calculated_field'
            })));

            // Get custom fields for tenant
            const customFields = await this.getCustomFields(tenantId);
            fields.push(...customFields);

            return fields;

        } catch (error) {
            console.error('Error getting available fields:', error);
            throw error;
        }
    }

    async createCalculatedField(fieldData, tenantId) {
        try {
            const calculatedField = {
                id: uuidv4(),
                tenantId: tenantId,
                name: fieldData.name,
                displayName: fieldData.displayName || fieldData.name,
                formula: fieldData.formula,
                dataType: fieldData.dataType,
                category: fieldData.category || 'custom',
                description: fieldData.description,
                dependencies: this.extractFormulaDependencies(fieldData.formula),
                validation: {
                    isValid: false,
                    errors: []
                },
                createdBy: fieldData.createdBy,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Validate formula
            const validationResult = await this.validateFormula(calculatedField.formula, tenantId);
            calculatedField.validation = validationResult;

            if (!validationResult.isValid) {
                throw new Error(`Invalid formula: ${validationResult.errors.join(', ')}`);
            }

            await this.saveCalculatedField(calculatedField);

            console.log(`Calculated field created: ${calculatedField.name}`);
            return calculatedField;

        } catch (error) {
            console.error('Error creating calculated field:', error);
            throw error;
        }
    }

    extractFormulaDependencies(formula) {
        // Extract field names from formula (simplified regex-based extraction)
        const fieldPattern = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
        const matches = formula.match(fieldPattern) || [];

        // Filter out function names and keywords
        const functionNames = ['sum', 'avg', 'count', 'min', 'max', 'if', 'case', 'when', 'then', 'else'];
        const keywords = ['and', 'or', 'not', 'in', 'is', 'null', 'true', 'false'];

        return matches.filter(match =>
            !functionNames.includes(match.toLowerCase()) &&
            !keywords.includes(match.toLowerCase())
        );
    }

    async validateFormula(formula, tenantId) {
        try {
            const validation = {
                isValid: true,
                errors: [],
                warnings: []
            };

            // Basic syntax validation
            if (!formula || formula.trim() === '') {
                validation.isValid = false;
                validation.errors.push('Formula cannot be empty');
                return validation;
            }

            // Check for balanced parentheses
            const openParens = (formula.match(/\(/g) || []).length;
            const closeParens = (formula.match(/\)/g) || []).length;
            if (openParens !== closeParens) {
                validation.isValid = false;
                validation.errors.push('Unbalanced parentheses in formula');
            }

            // Check for valid field references
            const dependencies = this.extractFormulaDependencies(formula);
            const availableFields = await this.getAvailableFields('default', tenantId);
            const availableFieldNames = availableFields.map(f => f.name);

            for (const dependency of dependencies) {
                if (!availableFieldNames.includes(dependency)) {
                    validation.warnings.push(`Field '${dependency}' not found in available fields`);
                }
            }

            // Check for circular dependencies (simplified)
            // In a real implementation, this would be more sophisticated
            if (dependencies.length > 10) {
                validation.warnings.push('Formula has many dependencies, consider simplifying');
            }

            return validation;

        } catch (error) {
            return {
                isValid: false,
                errors: [error.message],
                warnings: []
            };
        }
    }

    /**
     * Report Template Management
     */
    async createReportTemplate(templateData) {
        try {
            const template = {
                id: uuidv4(),
                name: templateData.name,
                description: templateData.description,
                category: templateData.category,
                tenantId: templateData.tenantId,
                isPublic: templateData.isPublic || false,
                thumbnail: templateData.thumbnail,

                // Template configuration
                layout: templateData.layout,
                sections: templateData.sections,
                defaultFields: templateData.defaultFields || [],
                defaultFilters: templateData.defaultFilters || [],
                styling: templateData.styling || {},

                // Usage statistics
                usage: {
                    timesUsed: 0,
                    lastUsed: null,
                    averageRating: 0,
                    ratingCount: 0
                },

                createdBy: templateData.createdBy,
                createdAt: new Date(),
                updatedAt: new Date(),
                tags: templateData.tags || []
            };

            await this.saveReportTemplate(template);

            console.log(`Report template created: ${template.name}`);
            return template;

        } catch (error) {
            console.error('Error creating report template:', error);
            throw error;
        }
    }

    async getReportTemplates(filters = {}) {
        try {
            let templates = Array.from(this.reportTemplates.values());

            // Apply filters
            if (filters.category) {
                templates = templates.filter(t => t.category === filters.category);
            }

            if (filters.tenantId) {
                templates = templates.filter(t => t.tenantId === filters.tenantId || t.isPublic);
            }

            if (filters.search) {
                const searchTerm = filters.search.toLowerCase();
                templates = templates.filter(t =>
                    t.name.toLowerCase().includes(searchTerm) ||
                    t.description.toLowerCase().includes(searchTerm) ||
                    t.tags.some(tag => tag.toLowerCase().includes(searchTerm))
                );
            }

            // Sort by usage or creation date
            if (filters.sortBy === 'popular') {
                templates.sort((a, b) => (b.usage?.timesUsed || 0) - (a.usage?.timesUsed || 0));
            } else {
                templates.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            }

            return templates;

        } catch (error) {
            console.error('Error getting report templates:', error);
            throw error;
        }
    }

    /**
     * Report Building Workflow
     */
    async buildReportFromTemplate(templateId, customizations = {}) {
        try {
            const template = await this.getReportTemplate(templateId);
            if (!template) {
                throw new Error('Template not found');
            }

            // Create report definition from template
            const reportDefinition = {
                name: customizations.name || `${template.name} - ${new Date().toLocaleDateString()}`,
                description: customizations.description || template.description,
                category: template.category,
                tenantId: customizations.tenantId,
                createdBy: customizations.createdBy,

                // Use template configuration as base
                layout: { ...template.layout, ...customizations.layout },
                sections: customizations.sections || template.sections,
                fields: customizations.fields || template.defaultFields,
                filters: customizations.filters || template.defaultFilters,
                styling: { ...template.styling, ...customizations.styling },

                // Data source configuration
                dataSource: customizations.dataSource || {
                    type: 'database',
                    connectionId: 'default'
                },

                // Export and performance settings
                exportOptions: customizations.exportOptions || {},
                performance: customizations.performance || {}
            };

            const createdReport = await this.createReportDefinition(reportDefinition);

            // Update template usage statistics
            await this.updateTemplateUsage(templateId);

            return createdReport;

        } catch (error) {
            console.error('Error building report from template:', error);
            throw error;
        }
    }

    /**
     * Data Source Management
     */
    async registerDataSource(dataSourceConfig) {
        try {
            const dataSource = {
                id: uuidv4(),
                name: dataSourceConfig.name,
                type: dataSourceConfig.type, // database, api, file, custom
                tenantId: dataSourceConfig.tenantId,

                connection: {
                    host: dataSourceConfig.connection?.host,
                    port: dataSourceConfig.connection?.port,
                    database: dataSourceConfig.connection?.database,
                    username: dataSourceConfig.connection?.username,
                    password: dataSourceConfig.connection?.password, // Should be encrypted
                    ssl: dataSourceConfig.connection?.ssl || false,
                    timeout: dataSourceConfig.connection?.timeout || 30000
                },

                schema: {
                    tables: dataSourceConfig.schema?.tables || [],
                    views: dataSourceConfig.schema?.views || [],
                    procedures: dataSourceConfig.schema?.procedures || []
                },

                configuration: {
                    maxConnections: dataSourceConfig.configuration?.maxConnections || 10,
                    queryTimeout: dataSourceConfig.configuration?.queryTimeout || 30000,
                    cacheEnabled: dataSourceConfig.configuration?.cacheEnabled !== false,
                    cacheDuration: dataSourceConfig.configuration?.cacheDuration || 3600
                },

                permissions: dataSourceConfig.permissions || [],
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Test connection
            const connectionTest = await this.testDataSourceConnection(dataSource);
            if (!connectionTest.success) {
                throw new Error(`Data source connection failed: ${connectionTest.error}`);
            }

            await this.saveDataSource(dataSource);

            console.log(`Data source registered: ${dataSource.name}`);
            return dataSource;

        } catch (error) {
            console.error('Error registering data source:', error);
            throw error;
        }
    }

    /**
     * Validation Methods
     */
    async validateReportDefinition(reportDefinition) {
        const errors = [];

        // Required fields validation
        if (!reportDefinition.name || reportDefinition.name.trim() === '') {
            errors.push('Report name is required');
        }

        if (!reportDefinition.dataSource || !reportDefinition.dataSource.type) {
            errors.push('Data source configuration is required');
        }

        if (!reportDefinition.fields || reportDefinition.fields.length === 0) {
            errors.push('At least one field is required');
        }

        // Field validation
        for (const field of reportDefinition.fields || []) {
            if (!field.name) {
                errors.push(`Field missing name: ${JSON.stringify(field)}`);
            }

            if (field.source === 'calculated_field' && !field.formula) {
                errors.push(`Calculated field '${field.name}' missing formula`);
            }
        }

        // Filter validation
        for (const filter of reportDefinition.filters || []) {
            if (!filter.field) {
                errors.push(`Filter missing field reference: ${JSON.stringify(filter)}`);
            }
        }

        if (errors.length > 0) {
            throw new Error(`Report validation failed: ${errors.join(', ')}`);
        }

        return true;
    }

    /**
     * Utility Methods
     */
    generateReportPreview(reportDefinition, sampleData) {
        // Generate a preview of how the report will look
        return {
            reportId: reportDefinition.id,
            previewHtml: this.generatePreviewHtml(reportDefinition, sampleData),
            fieldSummary: this.generateFieldSummary(reportDefinition),
            estimatedSize: this.estimateReportSize(reportDefinition, sampleData)
        };
    }

    generatePreviewHtml(reportDefinition, sampleData) {
        // Generate HTML preview (simplified)
        let html = `<div class="report-preview">`;
        html += `<h1>${reportDefinition.name}</h1>`;
        html += `<div class="report-content">`;

        // Add sections based on layout type
        if (reportDefinition.layout.type === 'tabular') {
            html += this.generateTablePreview(reportDefinition.fields, sampleData);
        } else if (reportDefinition.layout.type === 'dashboard') {
            html += this.generateDashboardPreview(reportDefinition.sections, sampleData);
        }

        html += `</div></div>`;
        return html;
    }

    generateTablePreview(fields, sampleData) {
        let html = `<table class="report-table">`;

        // Header
        html += `<thead><tr>`;
        fields.forEach(field => {
            if (field.visible !== false) {
                html += `<th>${field.displayName || field.name}</th>`;
            }
        });
        html += `</tr></thead>`;

        // Sample rows
        html += `<tbody>`;
        for (let i = 0; i < Math.min(5, sampleData.length); i++) {
            html += `<tr>`;
            fields.forEach(field => {
                if (field.visible !== false) {
                    const value = sampleData[i]?.[field.name] || 'Sample Data';
                    html += `<td>${value}</td>`;
                }
            });
            html += `</tr>`;
        }
        html += `</tbody></table>`;

        return html;
    }

    generateDashboardPreview(sections, sampleData) {
        let html = `<div class="dashboard-preview">`;

        sections.forEach(section => {
            html += `<div class="dashboard-section">`;
            html += `<h3>${section.title || section.id}</h3>`;

            if (section.type === 'chart') {
                html += `<div class="chart-placeholder">[${section.chartType} Chart]</div>`;
            } else if (section.type === 'kpi_cards') {
                html += `<div class="kpi-cards">`;
                section.fields.forEach(field => {
                    html += `<div class="kpi-card">${field}: Sample Value</div>`;
                });
                html += `</div>`;
            }

            html += `</div>`;
        });

        html += `</div>`;
        return html;
    }

    /**
     * Placeholder methods for database operations
     */
    async saveReportDefinition(reportDefinition) {
        console.log(`Saving report definition: ${reportDefinition.name}`);
        this.reportDefinitions.set(reportDefinition.id, reportDefinition);
    }

    async getReportDefinition(reportId) {
        console.log(`Getting report definition: ${reportId}`);
        return this.reportDefinitions.get(reportId);
    }

    async saveReportTemplate(template) {
        console.log(`Saving report template: ${template.name}`);
        this.reportTemplates.set(template.id, template);
    }

    async getReportTemplate(templateId) {
        console.log(`Getting report template: ${templateId}`);
        return this.reportTemplates.get(templateId);
    }

    async saveCalculatedField(field) {
        console.log(`Saving calculated field: ${field.name}`);
        this.calculatedFields.set(field.id, field);
    }

    async saveDataSource(dataSource) {
        console.log(`Saving data source: ${dataSource.name}`);
        this.dataConnections.set(dataSource.id, dataSource);
    }

    async getDataSource(dataSourceId, tenantId) {
        console.log(`Getting data source: ${dataSourceId} for tenant ${tenantId}`);
        return this.dataConnections.get(dataSourceId);
    }

    async getTableFields(tableName, tenantId) {
        console.log(`Getting fields for table: ${tableName}`);
        // Mock table fields
        return [
            { name: 'id', dataType: 'integer', source: 'database_field' },
            { name: 'name', dataType: 'string', source: 'database_field' },
            { name: 'created_at', dataType: 'datetime', source: 'database_field' }
        ];
    }

    async getCustomFields(tenantId) {
        console.log(`Getting custom fields for tenant: ${tenantId}`);
        return [];
    }

    async testDataSourceConnection(dataSource) {
        console.log(`Testing connection for data source: ${dataSource.name}`);
        return { success: true };
    }

    async updateTemplateUsage(templateId) {
        console.log(`Updating template usage: ${templateId}`);
        const template = this.reportTemplates.get(templateId);
        if (template) {
            template.usage.timesUsed++;
            template.usage.lastUsed = new Date();
        }
    }
}

module.exports = ReportBuilderEngine;