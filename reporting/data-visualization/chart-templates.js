class ChartTemplateLibrary {
    constructor() {
        this.templates = new Map();
        this.categories = new Set(['Tax Analysis', 'Financial Overview', 'Comparison', 'Trends', 'Geographic', 'Distribution']);
        this.initializeDefaultTemplates();
    }

    initializeDefaultTemplates() {
        const defaultTemplates = [
            {
                id: 'tax-breakdown-pie',
                name: 'Tax Breakdown Pie Chart',
                category: 'Tax Analysis',
                description: 'Visual breakdown of tax components',
                chartType: 'pie',
                thumbnail: '/assets/chart-templates/tax-pie.png',
                config: {
                    fieldMappings: {
                        category: 'taxType',
                        value: 'amount'
                    },
                    chartConfig: {
                        showLabels: true,
                        showPercentages: true,
                        innerRadius: 0.3
                    },
                    colorScheme: 'tax-specific',
                    interactions: {
                        tooltip: {
                            template: '<strong>{category}</strong><br/>Amount: ${value}<br/>Percentage: {percentage}%'
                        },
                        drilldown: {
                            enabled: true,
                            detailChart: 'tax-detail-bar'
                        }
                    }
                },
                sampleData: [
                    { taxType: 'Federal Income Tax', amount: 15000 },
                    { taxType: 'State Income Tax', amount: 3500 },
                    { taxType: 'Social Security', amount: 4200 },
                    { taxType: 'Medicare', amount: 980 },
                    { taxType: 'Property Tax', amount: 5500 }
                ]
            },
            {
                id: 'income-trend-line',
                name: 'Income Trend Analysis',
                category: 'Trends',
                description: 'Track income changes over time',
                chartType: 'line',
                thumbnail: '/assets/chart-templates/income-trend.png',
                config: {
                    fieldMappings: {
                        x: 'year',
                        y: 'income'
                    },
                    chartConfig: {
                        smooth: true,
                        showPoints: true,
                        fillArea: true,
                        lineWidth: 3
                    },
                    colorScheme: 'sequential',
                    interactions: {
                        tooltip: {
                            template: 'Year: {x}<br/>Income: ${y:,.0f}'
                        },
                        zoom: {
                            enabled: true,
                            showControls: true
                        },
                        brush: {
                            enabled: true,
                            onBrush: 'updatePeriodFilter'
                        }
                    }
                },
                sampleData: [
                    { year: 2018, income: 75000 },
                    { year: 2019, income: 78000 },
                    { year: 2020, income: 82000 },
                    { year: 2021, income: 85000 },
                    { year: 2022, income: 88000 },
                    { year: 2023, income: 92000 }
                ]
            },
            {
                id: 'tax-bracket-comparison',
                name: 'Tax Bracket Comparison',
                category: 'Comparison',
                description: 'Compare tax rates across brackets',
                chartType: 'bar',
                thumbnail: '/assets/chart-templates/tax-brackets.png',
                config: {
                    fieldMappings: {
                        x: 'bracket',
                        y: 'rate'
                    },
                    chartConfig: {
                        orientation: 'vertical',
                        showValues: true,
                        barWidth: 0.7
                    },
                    colorScheme: 'diverging',
                    interactions: {
                        tooltip: {
                            template: 'Tax Bracket: {x}<br/>Rate: {y}%<br/>Range: {incomeRange}'
                        },
                        filter: {
                            enabled: true,
                            fields: [
                                { field: 'rate', type: 'range', label: 'Tax Rate %' }
                            ]
                        }
                    }
                },
                sampleData: [
                    { bracket: '10%', rate: 10, incomeRange: '$0 - $10,275' },
                    { bracket: '12%', rate: 12, incomeRange: '$10,276 - $41,775' },
                    { bracket: '22%', rate: 22, incomeRange: '$41,776 - $89,450' },
                    { bracket: '24%', rate: 24, incomeRange: '$89,451 - $190,750' },
                    { bracket: '32%', rate: 32, incomeRange: '$190,751 - $418,850' },
                    { bracket: '35%', rate: 35, incomeRange: '$418,851 - $628,300' },
                    { bracket: '37%', rate: 37, incomeRange: '$628,301+' }
                ]
            },
            {
                id: 'state-tax-choropleth',
                name: 'State Tax Rate Map',
                category: 'Geographic',
                description: 'Geographic view of state tax rates',
                chartType: 'choropleth',
                thumbnail: '/assets/chart-templates/tax-map.png',
                config: {
                    fieldMappings: {
                        region: 'state',
                        value: 'taxRate'
                    },
                    chartConfig: {
                        projection: 'albersUsa',
                        colorScale: 'sequential',
                        showBorders: true
                    },
                    colorScheme: 'sequential',
                    interactions: {
                        tooltip: {
                            template: 'State: {region}<br/>Tax Rate: {value}%'
                        },
                        zoom: {
                            enabled: true
                        }
                    }
                },
                sampleData: [
                    { state: 'California', taxRate: 13.3 },
                    { state: 'New York', taxRate: 10.9 },
                    { state: 'Texas', taxRate: 0 },
                    { state: 'Florida', taxRate: 0 },
                    { state: 'Illinois', taxRate: 4.95 }
                ]
            },
            {
                id: 'deduction-analysis-bar',
                name: 'Deduction Analysis',
                category: 'Tax Analysis',
                description: 'Compare different tax deductions',
                chartType: 'bar',
                thumbnail: '/assets/chart-templates/deductions.png',
                config: {
                    fieldMappings: {
                        x: 'deductionType',
                        y: 'amount'
                    },
                    chartConfig: {
                        orientation: 'horizontal',
                        showValues: true,
                        sortBy: 'value'
                    },
                    colorScheme: 'categorical',
                    interactions: {
                        tooltip: {
                            template: '{x}: ${y:,.0f}<br/>Tax Savings: ${taxSavings:,.0f}'
                        },
                        drilldown: {
                            enabled: true
                        }
                    }
                },
                sampleData: [
                    { deductionType: 'Mortgage Interest', amount: 12000, taxSavings: 2880 },
                    { deductionType: 'Charitable Donations', amount: 5000, taxSavings: 1200 },
                    { deductionType: 'State Taxes', amount: 8000, taxSavings: 1920 },
                    { deductionType: 'Medical Expenses', amount: 3000, taxSavings: 720 },
                    { deductionType: 'Business Expenses', amount: 4500, taxSavings: 1080 }
                ]
            },
            {
                id: 'income-distribution-scatter',
                name: 'Income vs Tax Distribution',
                category: 'Distribution',
                description: 'Scatter plot of income vs tax paid',
                chartType: 'scatter',
                thumbnail: '/assets/chart-templates/income-scatter.png',
                config: {
                    fieldMappings: {
                        x: 'income',
                        y: 'taxPaid',
                        color: 'filingStatus',
                        size: 'deductions'
                    },
                    chartConfig: {
                        pointSize: 6,
                        showTrendline: true,
                        alpha: 0.7
                    },
                    colorScheme: 'categorical',
                    interactions: {
                        tooltip: {
                            template: 'Income: ${x:,.0f}<br/>Tax Paid: ${y:,.0f}<br/>Filing Status: {color}<br/>Deductions: ${size:,.0f}'
                        },
                        brush: {
                            enabled: true
                        },
                        zoom: {
                            enabled: true
                        }
                    }
                },
                sampleData: [
                    { income: 50000, taxPaid: 7500, filingStatus: 'Single', deductions: 12550 },
                    { income: 75000, taxPaid: 13500, filingStatus: 'Married', deductions: 25100 },
                    { income: 100000, taxPaid: 20000, filingStatus: 'Single', deductions: 15000 },
                    { income: 150000, taxPaid: 35000, filingStatus: 'Married', deductions: 30000 }
                ]
            },
            {
                id: 'quarterly-tax-area',
                name: 'Quarterly Tax Payments',
                category: 'Trends',
                description: 'Track quarterly tax payment trends',
                chartType: 'area',
                thumbnail: '/assets/chart-templates/quarterly-area.png',
                config: {
                    fieldMappings: {
                        x: 'quarter',
                        y: 'amount',
                        category: 'taxType'
                    },
                    chartConfig: {
                        stacking: 'normal',
                        smooth: false,
                        alpha: 0.8
                    },
                    colorScheme: 'tax-specific',
                    interactions: {
                        tooltip: {
                            template: 'Quarter: {x}<br/>Tax Type: {category}<br/>Amount: ${y:,.0f}'
                        },
                        legend: {
                            enabled: true,
                            interactive: true
                        }
                    }
                },
                sampleData: [
                    { quarter: 'Q1 2023', amount: 8000, taxType: 'Federal' },
                    { quarter: 'Q2 2023', amount: 8500, taxType: 'Federal' },
                    { quarter: 'Q3 2023', amount: 9000, taxType: 'Federal' },
                    { quarter: 'Q4 2023', amount: 9500, taxType: 'Federal' },
                    { quarter: 'Q1 2023', amount: 2000, taxType: 'State' },
                    { quarter: 'Q2 2023', amount: 2200, taxType: 'State' },
                    { quarter: 'Q3 2023', amount: 2400, taxType: 'State' },
                    { quarter: 'Q4 2023', amount: 2600, taxType: 'State' }
                ]
            },
            {
                id: 'effective-rate-heatmap',
                name: 'Effective Tax Rate Heatmap',
                category: 'Tax Analysis',
                description: 'Heatmap of effective tax rates by income and filing status',
                chartType: 'heatmap',
                thumbnail: '/assets/chart-templates/rate-heatmap.png',
                config: {
                    fieldMappings: {
                        x: 'incomeRange',
                        y: 'filingStatus',
                        value: 'effectiveRate'
                    },
                    chartConfig: {
                        colorScale: 'sequential',
                        showValues: true,
                        borderWidth: 1
                    },
                    colorScheme: 'sequential',
                    interactions: {
                        tooltip: {
                            template: 'Income: {x}<br/>Filing Status: {y}<br/>Effective Rate: {value}%'
                        }
                    }
                },
                sampleData: [
                    { incomeRange: '$0-25K', filingStatus: 'Single', effectiveRate: 5.2 },
                    { incomeRange: '$25K-50K', filingStatus: 'Single', effectiveRate: 8.9 },
                    { incomeRange: '$50K-100K', filingStatus: 'Single', effectiveRate: 14.1 },
                    { incomeRange: '$100K+', filingStatus: 'Single', effectiveRate: 22.8 },
                    { incomeRange: '$0-25K', filingStatus: 'Married', effectiveRate: 3.1 },
                    { incomeRange: '$25K-50K', filingStatus: 'Married', effectiveRate: 6.7 },
                    { incomeRange: '$50K-100K', filingStatus: 'Married', effectiveRate: 11.3 },
                    { incomeRange: '$100K+', filingStatus: 'Married', effectiveRate: 19.5 }
                ]
            }
        ];

        defaultTemplates.forEach(template => {
            this.addTemplate(template);
        });
    }

    addTemplate(templateData) {
        const template = {
            ...templateData,
            id: templateData.id || this.generateTemplateId(),
            createdAt: new Date().toISOString(),
            version: '1.0.0',
            tags: templateData.tags || [],
            isBuiltIn: templateData.isBuiltIn !== false
        };

        this.templates.set(template.id, template);
        this.categories.add(template.category);
        return template.id;
    }

    getTemplate(templateId) {
        return this.templates.get(templateId);
    }

    getAllTemplates() {
        return Array.from(this.templates.values());
    }

    getTemplatesByCategory(category) {
        return this.getAllTemplates().filter(template => template.category === category);
    }

    getTemplatesByChartType(chartType) {
        return this.getAllTemplates().filter(template => template.chartType === chartType);
    }

    searchTemplates(query) {
        const searchTerm = query.toLowerCase();
        return this.getAllTemplates().filter(template =>
            template.name.toLowerCase().includes(searchTerm) ||
            template.description.toLowerCase().includes(searchTerm) ||
            template.category.toLowerCase().includes(searchTerm) ||
            template.tags.some(tag => tag.toLowerCase().includes(searchTerm))
        );
    }

    cloneTemplate(templateId, newName) {
        const original = this.getTemplate(templateId);
        if (!original) return null;

        const cloned = {
            ...JSON.parse(JSON.stringify(original)), // Deep clone
            id: this.generateTemplateId(),
            name: newName || `${original.name} (Copy)`,
            createdAt: new Date().toISOString(),
            isBuiltIn: false
        };

        this.addTemplate(cloned);
        return cloned.id;
    }

    customizeTemplate(templateId, customizations) {
        const template = this.getTemplate(templateId);
        if (!template) return null;

        const customized = {
            ...JSON.parse(JSON.stringify(template)),
            id: this.generateTemplateId(),
            name: customizations.name || `${template.name} (Custom)`,
            config: this.mergeConfigurations(template.config, customizations.config || {}),
            createdAt: new Date().toISOString(),
            isBuiltIn: false,
            basedOn: templateId
        };

        this.addTemplate(customized);
        return customized.id;
    }

    mergeConfigurations(baseConfig, customConfig) {
        const merged = JSON.parse(JSON.stringify(baseConfig));

        // Merge field mappings
        if (customConfig.fieldMappings) {
            merged.fieldMappings = { ...merged.fieldMappings, ...customConfig.fieldMappings };
        }

        // Merge chart config
        if (customConfig.chartConfig) {
            merged.chartConfig = { ...merged.chartConfig, ...customConfig.chartConfig };
        }

        // Merge interactions
        if (customConfig.interactions) {
            merged.interactions = { ...merged.interactions, ...customConfig.interactions };
        }

        // Override color scheme if specified
        if (customConfig.colorScheme) {
            merged.colorScheme = customConfig.colorScheme;
        }

        return merged;
    }

    createChartFromTemplate(templateId, userData, containerId) {
        const template = this.getTemplate(templateId);
        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }

        const chartConfig = {
            chartType: template.chartType,
            data: userData || template.sampleData,
            fieldMappings: template.config.fieldMappings,
            chartConfig: template.config.chartConfig,
            colorScheme: template.config.colorScheme,
            interactions: template.config.interactions,
            containerId: containerId,
            dimensions: {
                width: 800,
                height: 600,
                margin: { top: 20, right: 20, bottom: 40, left: 40 }
            }
        };

        return chartConfig;
    }

    getTemplatePreview(templateId) {
        const template = this.getTemplate(templateId);
        if (!template) return null;

        return {
            id: template.id,
            name: template.name,
            description: template.description,
            category: template.category,
            chartType: template.chartType,
            thumbnail: template.thumbnail,
            features: this.extractTemplateFeatures(template),
            sampleData: template.sampleData?.slice(0, 3) // First 3 rows for preview
        };
    }

    extractTemplateFeatures(template) {
        const features = [];

        if (template.config.interactions?.tooltip) {
            features.push('Interactive Tooltips');
        }

        if (template.config.interactions?.zoom) {
            features.push('Zoom & Pan');
        }

        if (template.config.interactions?.brush) {
            features.push('Data Selection');
        }

        if (template.config.interactions?.filter) {
            features.push('Dynamic Filtering');
        }

        if (template.config.interactions?.drilldown) {
            features.push('Drill-down Analysis');
        }

        if (template.config.interactions?.crossfilter) {
            features.push('Cross-filtering');
        }

        if (template.config.chartConfig?.showTrendline) {
            features.push('Trend Analysis');
        }

        if (template.config.chartConfig?.stacking) {
            features.push('Stacked Data');
        }

        return features;
    }

    validateTemplateData(template, userData) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: []
        };

        if (!userData || !Array.isArray(userData)) {
            validation.isValid = false;
            validation.errors.push('Data must be provided as an array');
            return validation;
        }

        if (userData.length === 0) {
            validation.isValid = false;
            validation.errors.push('Data array cannot be empty');
            return validation;
        }

        // Validate required fields
        const requiredFields = Object.values(template.config.fieldMappings);
        const sampleRow = userData[0];

        requiredFields.forEach(field => {
            if (!(field in sampleRow)) {
                validation.errors.push(`Missing required field: ${field}`);
                validation.isValid = false;
            }
        });

        // Check data types
        this.validateDataTypes(userData, template.config.fieldMappings, validation);

        return validation;
    }

    validateDataTypes(data, fieldMappings, validation) {
        const sampleSize = Math.min(data.length, 10);
        const sample = data.slice(0, sampleSize);

        for (const [chartField, dataField] of Object.entries(fieldMappings)) {
            const values = sample.map(row => row[dataField]).filter(v => v != null);

            if (values.length === 0) {
                validation.warnings.push(`Field ${dataField} contains only null values`);
                continue;
            }

            const dataType = this.inferDataType(values);
            const expectedType = this.getExpectedDataType(chartField);

            if (!this.isCompatibleDataType(dataType, expectedType)) {
                validation.warnings.push(
                    `Field ${dataField} has type ${dataType} but ${expectedType} is expected for ${chartField}`
                );
            }
        }
    }

    inferDataType(values) {
        const firstValue = values[0];

        if (typeof firstValue === 'number') {
            return 'number';
        }

        if (typeof firstValue === 'string') {
            // Check if it's a date
            if (!isNaN(Date.parse(firstValue))) {
                return 'date';
            }
            // Check if it's a numeric string
            if (!isNaN(parseFloat(firstValue))) {
                return 'number';
            }
            return 'string';
        }

        if (firstValue instanceof Date) {
            return 'date';
        }

        return 'unknown';
    }

    getExpectedDataType(chartField) {
        const typeMap = {
            x: 'any',
            y: 'number',
            category: 'string',
            value: 'number',
            color: 'string',
            size: 'number',
            region: 'string'
        };

        return typeMap[chartField] || 'any';
    }

    isCompatibleDataType(actual, expected) {
        if (expected === 'any') return true;
        if (actual === expected) return true;

        // Allow string to be used as categorical data
        if (expected === 'string' && actual === 'string') return true;

        // Allow numbers to be used in any numeric context
        if (expected === 'number' && (actual === 'number' || actual === 'string')) return true;

        return false;
    }

    exportTemplate(templateId) {
        const template = this.getTemplate(templateId);
        if (!template) return null;

        return {
            ...template,
            exportedAt: new Date().toISOString(),
            exportVersion: '1.0'
        };
    }

    importTemplate(templateData) {
        try {
            const validation = this.validateTemplateStructure(templateData);
            if (!validation.isValid) {
                return { success: false, errors: validation.errors };
            }

            const templateId = this.addTemplate({
                ...templateData,
                isBuiltIn: false,
                importedAt: new Date().toISOString()
            });

            return { success: true, templateId };
        } catch (error) {
            return { success: false, errors: [error.message] };
        }
    }

    validateTemplateStructure(template) {
        const errors = [];

        // Required fields
        if (!template.name) errors.push('Template name is required');
        if (!template.category) errors.push('Template category is required');
        if (!template.chartType) errors.push('Chart type is required');
        if (!template.config) errors.push('Template configuration is required');

        // Configuration validation
        if (template.config) {
            if (!template.config.fieldMappings) {
                errors.push('Field mappings are required');
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    generateTemplateId() {
        return 'chart_template_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    getCategories() {
        return Array.from(this.categories);
    }

    renderTemplateGallery(containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="chart-template-gallery">
                <div class="gallery-header">
                    <h3>Chart Template Gallery</h3>
                    <div class="gallery-controls">
                        <input type="text" id="template-search" placeholder="Search templates...">
                        <select id="category-filter">
                            <option value="">All Categories</option>
                            ${this.getCategories().map(cat =>
                                `<option value="${cat}">${cat}</option>`
                            ).join('')}
                        </select>
                        <select id="chart-type-filter">
                            <option value="">All Chart Types</option>
                            <option value="bar">Bar Chart</option>
                            <option value="line">Line Chart</option>
                            <option value="pie">Pie Chart</option>
                            <option value="scatter">Scatter Plot</option>
                            <option value="area">Area Chart</option>
                            <option value="heatmap">Heatmap</option>
                        </select>
                    </div>
                </div>
                <div class="template-grid" id="template-grid">
                    ${this.renderTemplateGrid()}
                </div>
            </div>
        `;

        this.setupGalleryEvents();
    }

    renderTemplateGrid(templates = null) {
        const templatesToRender = templates || this.getAllTemplates();

        return templatesToRender.map(template => `
            <div class="template-card" data-template-id="${template.id}">
                <div class="template-preview">
                    <img src="${template.thumbnail || '/assets/templates/default-chart.png'}"
                         alt="${template.name}" loading="lazy">
                    <div class="chart-type-badge">${template.chartType}</div>
                </div>
                <div class="template-info">
                    <h4>${template.name}</h4>
                    <p>${template.description}</p>
                    <div class="template-meta">
                        <span class="category">${template.category}</span>
                        ${template.isBuiltIn ? '<span class="built-in">Built-in</span>' : ''}
                    </div>
                    <div class="template-features">
                        ${this.extractTemplateFeatures(template).slice(0, 3).map(feature =>
                            `<span class="feature-tag">${feature}</span>`
                        ).join('')}
                    </div>
                </div>
                <div class="template-actions">
                    <button class="use-template" data-template-id="${template.id}">Use Template</button>
                    <button class="preview-template" data-template-id="${template.id}">Preview</button>
                    <button class="customize-template" data-template-id="${template.id}">Customize</button>
                </div>
            </div>
        `).join('');
    }

    setupGalleryEvents() {
        const searchInput = document.getElementById('template-search');
        const categoryFilter = document.getElementById('category-filter');
        const chartTypeFilter = document.getElementById('chart-type-filter');
        const templateGrid = document.getElementById('template-grid');

        if (searchInput) {
            searchInput.addEventListener('input', () => this.filterTemplates());
        }

        if (categoryFilter) {
            categoryFilter.addEventListener('change', () => this.filterTemplates());
        }

        if (chartTypeFilter) {
            chartTypeFilter.addEventListener('change', () => this.filterTemplates());
        }

        if (templateGrid) {
            templateGrid.addEventListener('click', (e) => {
                const templateId = e.target.dataset.templateId;
                if (!templateId) return;

                if (e.target.classList.contains('use-template')) {
                    this.useTemplate(templateId);
                } else if (e.target.classList.contains('preview-template')) {
                    this.previewTemplate(templateId);
                } else if (e.target.classList.contains('customize-template')) {
                    this.customizeTemplateDialog(templateId);
                }
            });
        }
    }

    filterTemplates() {
        const searchQuery = document.getElementById('template-search')?.value || '';
        const category = document.getElementById('category-filter')?.value || '';
        const chartType = document.getElementById('chart-type-filter')?.value || '';

        let filteredTemplates = this.getAllTemplates();

        if (searchQuery) {
            filteredTemplates = this.searchTemplates(searchQuery);
        }

        if (category) {
            filteredTemplates = filteredTemplates.filter(t => t.category === category);
        }

        if (chartType) {
            filteredTemplates = filteredTemplates.filter(t => t.chartType === chartType);
        }

        const grid = document.getElementById('template-grid');
        if (grid) {
            grid.innerHTML = this.renderTemplateGrid(filteredTemplates);
        }
    }

    useTemplate(templateId) {
        const event = new CustomEvent('templateSelected', {
            detail: { templateId, template: this.getTemplate(templateId) }
        });
        document.dispatchEvent(event);
    }

    previewTemplate(templateId) {
        const template = this.getTemplate(templateId);
        if (!template) return;

        // Create preview modal
        const modal = this.createPreviewModal(template);
        document.body.appendChild(modal);
    }

    createPreviewModal(template) {
        const modal = document.createElement('div');
        modal.className = 'template-preview-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Template Preview: ${template.name}</h3>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="preview-chart" id="preview-chart-${template.id}"></div>
                    <div class="preview-details">
                        <h4>Template Details</h4>
                        <p><strong>Category:</strong> ${template.category}</p>
                        <p><strong>Chart Type:</strong> ${template.chartType}</p>
                        <p><strong>Description:</strong> ${template.description}</p>
                        <div class="features">
                            <strong>Features:</strong>
                            <ul>
                                ${this.extractTemplateFeatures(template).map(feature =>
                                    `<li>${feature}</li>`
                                ).join('')}
                            </ul>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="use-template-modal" data-template-id="${template.id}">Use This Template</button>
                    <button class="customize-template-modal" data-template-id="${template.id}">Customize</button>
                </div>
            </div>
        `;

        // Set up modal events
        modal.querySelector('.close-modal').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        modal.querySelector('.use-template-modal').addEventListener('click', () => {
            this.useTemplate(template.id);
            document.body.removeChild(modal);
        });

        return modal;
    }

    customizeTemplateDialog(templateId) {
        const template = this.getTemplate(templateId);
        if (!template) return;

        // Create customization dialog
        const dialog = this.createCustomizationDialog(template);
        document.body.appendChild(dialog);
    }

    createCustomizationDialog(template) {
        const dialog = document.createElement('div');
        dialog.className = 'template-customization-dialog';
        dialog.innerHTML = `
            <div class="dialog-content">
                <div class="dialog-header">
                    <h3>Customize Template: ${template.name}</h3>
                    <button class="close-dialog">&times;</button>
                </div>
                <div class="dialog-body">
                    <div class="customization-form">
                        <div class="form-group">
                            <label>Template Name:</label>
                            <input type="text" id="custom-name" value="${template.name} (Custom)">
                        </div>
                        <div class="form-group">
                            <label>Color Scheme:</label>
                            <select id="custom-color-scheme">
                                <option value="default">Default</option>
                                <option value="tax-specific">Tax Calculator</option>
                                <option value="categorical">Categorical</option>
                                <option value="sequential">Sequential</option>
                                <option value="diverging">Diverging</option>
                            </select>
                        </div>
                        <!-- Add more customization options here -->
                    </div>
                </div>
                <div class="dialog-footer">
                    <button class="create-custom-template">Create Custom Template</button>
                    <button class="cancel-customization">Cancel</button>
                </div>
            </div>
        `;

        // Set up dialog events
        dialog.querySelector('.close-dialog').addEventListener('click', () => {
            document.body.removeChild(dialog);
        });

        dialog.querySelector('.cancel-customization').addEventListener('click', () => {
            document.body.removeChild(dialog);
        });

        dialog.querySelector('.create-custom-template').addEventListener('click', () => {
            const customizations = this.gatherCustomizations(dialog);
            const customTemplateId = this.customizeTemplate(template.id, customizations);

            if (customTemplateId) {
                this.useTemplate(customTemplateId);
                document.body.removeChild(dialog);
            }
        });

        return dialog;
    }

    gatherCustomizations(dialog) {
        return {
            name: dialog.querySelector('#custom-name').value,
            config: {
                colorScheme: dialog.querySelector('#custom-color-scheme').value
            }
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChartTemplateLibrary;
}