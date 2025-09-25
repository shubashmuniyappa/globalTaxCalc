class BusinessIntelligenceDashboard {
    constructor() {
        this.dashboards = new Map();
        this.widgets = new Map();
        this.dataSources = new Map();
        this.templates = new Map();
        this.kpiCalculators = new Map();
        this.alertRules = new Map();
        this.initializeDefaultTemplates();
        this.initializeKPICalculators();
    }

    initializeDefaultTemplates() {
        // Executive Dashboard Template
        this.templates.set('executive', {
            name: 'Executive Dashboard',
            description: 'High-level overview for executives and managers',
            category: 'executive',
            layout: {
                type: 'grid',
                columns: 12,
                rows: 8
            },
            widgets: [
                {
                    type: 'kpi-card',
                    title: 'Total Tax Liability',
                    position: { x: 0, y: 0, w: 3, h: 2 },
                    config: { kpi: 'total-tax-liability', format: 'currency' }
                },
                {
                    type: 'kpi-card',
                    title: 'Effective Tax Rate',
                    position: { x: 3, y: 0, w: 3, h: 2 },
                    config: { kpi: 'effective-tax-rate', format: 'percentage' }
                },
                {
                    type: 'kpi-card',
                    title: 'Tax Savings',
                    position: { x: 6, y: 0, w: 3, h: 2 },
                    config: { kpi: 'tax-savings', format: 'currency' }
                },
                {
                    type: 'kpi-card',
                    title: 'Compliance Score',
                    position: { x: 9, y: 0, w: 3, h: 2 },
                    config: { kpi: 'compliance-score', format: 'score' }
                },
                {
                    type: 'chart',
                    title: 'Tax Trend Analysis',
                    position: { x: 0, y: 2, w: 6, h: 3 },
                    config: { chartType: 'line', dataSource: 'tax-trends' }
                },
                {
                    type: 'chart',
                    title: 'Tax Breakdown',
                    position: { x: 6, y: 2, w: 6, h: 3 },
                    config: { chartType: 'pie', dataSource: 'tax-breakdown' }
                },
                {
                    type: 'table',
                    title: 'Recent Calculations',
                    position: { x: 0, y: 5, w: 12, h: 3 },
                    config: { dataSource: 'recent-calculations', maxRows: 10 }
                }
            ]
        });

        // Tax Analyst Dashboard Template
        this.templates.set('analyst', {
            name: 'Tax Analyst Dashboard',
            description: 'Detailed analysis tools for tax professionals',
            category: 'professional',
            layout: {
                type: 'grid',
                columns: 12,
                rows: 10
            },
            widgets: [
                {
                    type: 'filter-panel',
                    title: 'Data Filters',
                    position: { x: 0, y: 0, w: 12, h: 1 },
                    config: { filters: ['date-range', 'income-range', 'filing-status', 'state'] }
                },
                {
                    type: 'chart',
                    title: 'Income Distribution Analysis',
                    position: { x: 0, y: 1, w: 6, h: 3 },
                    config: { chartType: 'histogram', dataSource: 'income-distribution' }
                },
                {
                    type: 'chart',
                    title: 'Tax Rate by Income Bracket',
                    position: { x: 6, y: 1, w: 6, h: 3 },
                    config: { chartType: 'bar', dataSource: 'tax-rates-by-bracket' }
                },
                {
                    type: 'chart',
                    title: 'State Tax Comparison',
                    position: { x: 0, y: 4, w: 8, h: 3 },
                    config: { chartType: 'choropleth', dataSource: 'state-tax-comparison' }
                },
                {
                    type: 'kpi-panel',
                    title: 'Key Metrics',
                    position: { x: 8, y: 4, w: 4, h: 3 },
                    config: { kpis: ['avg-tax-rate', 'median-income', 'total-deductions'] }
                },
                {
                    type: 'chart',
                    title: 'Deduction Utilization',
                    position: { x: 0, y: 7, w: 6, h: 3 },
                    config: { chartType: 'scatter', dataSource: 'deduction-analysis' }
                },
                {
                    type: 'table',
                    title: 'Detailed Breakdown',
                    position: { x: 6, y: 7, w: 6, h: 3 },
                    config: { dataSource: 'detailed-calculations' }
                }
            ]
        });

        // Operations Dashboard Template
        this.templates.set('operations', {
            name: 'Operations Dashboard',
            description: 'System performance and usage analytics',
            category: 'operations',
            layout: {
                type: 'grid',
                columns: 12,
                rows: 8
            },
            widgets: [
                {
                    type: 'kpi-card',
                    title: 'Daily Active Users',
                    position: { x: 0, y: 0, w: 3, h: 2 },
                    config: { kpi: 'daily-active-users', format: 'number' }
                },
                {
                    type: 'kpi-card',
                    title: 'Calculations Today',
                    position: { x: 3, y: 0, w: 3, h: 2 },
                    config: { kpi: 'calculations-today', format: 'number' }
                },
                {
                    type: 'kpi-card',
                    title: 'System Uptime',
                    position: { x: 6, y: 0, w: 3, h: 2 },
                    config: { kpi: 'system-uptime', format: 'percentage' }
                },
                {
                    type: 'kpi-card',
                    title: 'Error Rate',
                    position: { x: 9, y: 0, w: 3, h: 2 },
                    config: { kpi: 'error-rate', format: 'percentage' }
                },
                {
                    type: 'chart',
                    title: 'Usage Trends',
                    position: { x: 0, y: 2, w: 8, h: 3 },
                    config: { chartType: 'line', dataSource: 'usage-trends' }
                },
                {
                    type: 'chart',
                    title: 'Feature Usage',
                    position: { x: 8, y: 2, w: 4, h: 3 },
                    config: { chartType: 'bar', dataSource: 'feature-usage' }
                },
                {
                    type: 'table',
                    title: 'Recent Errors',
                    position: { x: 0, y: 5, w: 6, h: 3 },
                    config: { dataSource: 'recent-errors' }
                },
                {
                    type: 'chart',
                    title: 'Performance Metrics',
                    position: { x: 6, y: 5, w: 6, h: 3 },
                    config: { chartType: 'gauge', dataSource: 'performance-metrics' }
                }
            ]
        });
    }

    initializeKPICalculators() {
        // Tax-related KPIs
        this.kpiCalculators.set('total-tax-liability', {
            name: 'Total Tax Liability',
            description: 'Sum of all tax obligations',
            calculate: (data) => {
                return data.reduce((sum, record) => sum + (record.federalTax || 0) + (record.stateTax || 0) + (record.localTax || 0), 0);
            },
            format: 'currency'
        });

        this.kpiCalculators.set('effective-tax-rate', {
            name: 'Effective Tax Rate',
            description: 'Average effective tax rate across all calculations',
            calculate: (data) => {
                const totalTax = data.reduce((sum, record) => sum + (record.totalTax || 0), 0);
                const totalIncome = data.reduce((sum, record) => sum + (record.income || 0), 0);
                return totalIncome > 0 ? (totalTax / totalIncome) * 100 : 0;
            },
            format: 'percentage'
        });

        this.kpiCalculators.set('tax-savings', {
            name: 'Tax Savings',
            description: 'Total tax savings from deductions and credits',
            calculate: (data) => {
                return data.reduce((sum, record) => sum + (record.deductions || 0) + (record.credits || 0), 0);
            },
            format: 'currency'
        });

        this.kpiCalculators.set('compliance-score', {
            name: 'Compliance Score',
            description: 'Overall compliance rating based on completeness and accuracy',
            calculate: (data) => {
                let totalScore = 0;
                let count = 0;

                data.forEach(record => {
                    let score = 100;
                    if (!record.hasW2) score -= 20;
                    if (!record.has1099) score -= 15;
                    if (!record.hasDeductions) score -= 10;
                    if (record.hasErrors) score -= 25;

                    totalScore += Math.max(0, score);
                    count++;
                });

                return count > 0 ? totalScore / count : 0;
            },
            format: 'score'
        });

        // Usage KPIs
        this.kpiCalculators.set('daily-active-users', {
            name: 'Daily Active Users',
            description: 'Number of unique users active today',
            calculate: (data) => {
                const today = new Date().toDateString();
                const uniqueUsers = new Set();
                data.forEach(record => {
                    if (new Date(record.timestamp).toDateString() === today) {
                        uniqueUsers.add(record.userId);
                    }
                });
                return uniqueUsers.size;
            },
            format: 'number'
        });

        this.kpiCalculators.set('calculations-today', {
            name: 'Calculations Today',
            description: 'Total number of tax calculations performed today',
            calculate: (data) => {
                const today = new Date().toDateString();
                return data.filter(record => new Date(record.timestamp).toDateString() === today).length;
            },
            format: 'number'
        });

        this.kpiCalculators.set('system-uptime', {
            name: 'System Uptime',
            description: 'System availability percentage',
            calculate: (data) => {
                // This would typically come from monitoring systems
                return 99.95; // Mock value
            },
            format: 'percentage'
        });

        this.kpiCalculators.set('error-rate', {
            name: 'Error Rate',
            description: 'Percentage of calculations that resulted in errors',
            calculate: (data) => {
                const totalCalculations = data.length;
                const errorCalculations = data.filter(record => record.hasErrors).length;
                return totalCalculations > 0 ? (errorCalculations / totalCalculations) * 100 : 0;
            },
            format: 'percentage'
        });
    }

    createDashboard(dashboardConfig) {
        try {
            const validatedConfig = this.validateDashboardConfig(dashboardConfig);
            const dashboardId = this.generateDashboardId();

            const dashboard = {
                id: dashboardId,
                name: validatedConfig.name,
                description: validatedConfig.description,
                category: validatedConfig.category || 'custom',
                layout: validatedConfig.layout || { type: 'grid', columns: 12, rows: 8 },
                widgets: validatedConfig.widgets || [],
                filters: validatedConfig.filters || {},
                refreshInterval: validatedConfig.refreshInterval || 300000, // 5 minutes
                isPublic: validatedConfig.isPublic || false,
                permissions: validatedConfig.permissions || [],
                createdAt: new Date().toISOString(),
                createdBy: validatedConfig.createdBy,
                lastModified: new Date().toISOString(),
                viewCount: 0,
                settings: {
                    autoRefresh: validatedConfig.autoRefresh !== false,
                    showFilters: validatedConfig.showFilters !== false,
                    allowExport: validatedConfig.allowExport !== false,
                    theme: validatedConfig.theme || 'light'
                }
            };

            this.dashboards.set(dashboardId, dashboard);

            // Create individual widgets
            dashboard.widgets.forEach((widgetConfig, index) => {
                const widgetId = this.generateWidgetId();
                const widget = this.createWidget(widgetId, widgetConfig, dashboardId);
                dashboard.widgets[index].id = widgetId;
                this.widgets.set(widgetId, widget);
            });

            return {
                success: true,
                dashboardId,
                dashboard
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    createWidget(widgetId, widgetConfig, dashboardId) {
        return {
            id: widgetId,
            dashboardId,
            type: widgetConfig.type,
            title: widgetConfig.title,
            position: widgetConfig.position,
            config: widgetConfig.config,
            dataSource: widgetConfig.dataSource,
            lastUpdated: null,
            cache: null,
            refreshInterval: widgetConfig.refreshInterval || 300000
        };
    }

    validateDashboardConfig(config) {
        if (!config.name || typeof config.name !== 'string') {
            throw new Error('Dashboard name is required');
        }

        if (config.widgets && !Array.isArray(config.widgets)) {
            throw new Error('Widgets must be an array');
        }

        // Validate widget configurations
        if (config.widgets) {
            config.widgets.forEach((widget, index) => {
                if (!widget.type) {
                    throw new Error(`Widget at index ${index} is missing type`);
                }
                if (!widget.title) {
                    throw new Error(`Widget at index ${index} is missing title`);
                }
                if (!widget.position) {
                    throw new Error(`Widget at index ${index} is missing position`);
                }
            });
        }

        return config;
    }

    createDashboardFromTemplate(templateId, customization = {}) {
        const template = this.templates.get(templateId);
        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }

        const dashboardConfig = {
            name: customization.name || template.name,
            description: customization.description || template.description,
            category: template.category,
            layout: { ...template.layout, ...customization.layout },
            widgets: template.widgets.map(widget => ({
                ...widget,
                ...customization.widgetOverrides?.[widget.title]
            })),
            ...customization
        };

        return this.createDashboard(dashboardConfig);
    }

    getDashboard(dashboardId) {
        const dashboard = this.dashboards.get(dashboardId);
        if (dashboard) {
            dashboard.viewCount++;
            dashboard.lastViewed = new Date().toISOString();
        }
        return dashboard;
    }

    getAllDashboards() {
        return Array.from(this.dashboards.values());
    }

    getUserDashboards(userId) {
        return this.getAllDashboards().filter(dashboard =>
            dashboard.createdBy === userId ||
            dashboard.isPublic ||
            dashboard.permissions.some(p => p.userId === userId)
        );
    }

    getDashboardsByCategory(category) {
        return this.getAllDashboards().filter(dashboard => dashboard.category === category);
    }

    updateDashboard(dashboardId, updates) {
        const dashboard = this.dashboards.get(dashboardId);
        if (!dashboard) {
            throw new Error('Dashboard not found');
        }

        // Update dashboard properties
        Object.assign(dashboard, updates, {
            lastModified: new Date().toISOString()
        });

        // Handle widget updates
        if (updates.widgets) {
            // Remove old widgets
            dashboard.widgets.forEach(widget => {
                if (widget.id) {
                    this.widgets.delete(widget.id);
                }
            });

            // Create new widgets
            updates.widgets.forEach((widgetConfig, index) => {
                const widgetId = this.generateWidgetId();
                const widget = this.createWidget(widgetId, widgetConfig, dashboardId);
                dashboard.widgets[index].id = widgetId;
                this.widgets.set(widgetId, widget);
            });
        }

        return dashboard;
    }

    deleteDashboard(dashboardId) {
        const dashboard = this.dashboards.get(dashboardId);
        if (!dashboard) {
            throw new Error('Dashboard not found');
        }

        // Delete associated widgets
        dashboard.widgets.forEach(widget => {
            if (widget.id) {
                this.widgets.delete(widget.id);
            }
        });

        // Delete dashboard
        this.dashboards.delete(dashboardId);
        return true;
    }

    addWidget(dashboardId, widgetConfig) {
        const dashboard = this.dashboards.get(dashboardId);
        if (!dashboard) {
            throw new Error('Dashboard not found');
        }

        const widgetId = this.generateWidgetId();
        const widget = this.createWidget(widgetId, widgetConfig, dashboardId);

        dashboard.widgets.push({ ...widgetConfig, id: widgetId });
        this.widgets.set(widgetId, widget);
        dashboard.lastModified = new Date().toISOString();

        return widget;
    }

    removeWidget(dashboardId, widgetId) {
        const dashboard = this.dashboards.get(dashboardId);
        if (!dashboard) {
            throw new Error('Dashboard not found');
        }

        dashboard.widgets = dashboard.widgets.filter(w => w.id !== widgetId);
        this.widgets.delete(widgetId);
        dashboard.lastModified = new Date().toISOString();

        return true;
    }

    updateWidget(widgetId, updates) {
        const widget = this.widgets.get(widgetId);
        if (!widget) {
            throw new Error('Widget not found');
        }

        Object.assign(widget, updates);

        // Update in dashboard as well
        const dashboard = this.dashboards.get(widget.dashboardId);
        if (dashboard) {
            const widgetIndex = dashboard.widgets.findIndex(w => w.id === widgetId);
            if (widgetIndex !== -1) {
                Object.assign(dashboard.widgets[widgetIndex], updates);
            }
            dashboard.lastModified = new Date().toISOString();
        }

        return widget;
    }

    async refreshDashboardData(dashboardId) {
        const dashboard = this.dashboards.get(dashboardId);
        if (!dashboard) {
            throw new Error('Dashboard not found');
        }

        const refreshPromises = dashboard.widgets.map(widgetConfig => {
            const widget = this.widgets.get(widgetConfig.id);
            if (widget) {
                return this.refreshWidgetData(widget.id);
            }
        });

        await Promise.all(refreshPromises);
        dashboard.lastRefresh = new Date().toISOString();

        return dashboard;
    }

    async refreshWidgetData(widgetId) {
        const widget = this.widgets.get(widgetId);
        if (!widget) {
            throw new Error('Widget not found');
        }

        try {
            let data;

            switch (widget.type) {
                case 'kpi-card':
                    data = await this.calculateKPI(widget.config.kpi);
                    break;
                case 'chart':
                    data = await this.getChartData(widget.config.dataSource, widget.config);
                    break;
                case 'table':
                    data = await this.getTableData(widget.config.dataSource, widget.config);
                    break;
                case 'kpi-panel':
                    data = await this.calculateMultipleKPIs(widget.config.kpis);
                    break;
                default:
                    data = await this.getGenericData(widget.config.dataSource);
            }

            widget.cache = data;
            widget.lastUpdated = new Date().toISOString();

            return data;
        } catch (error) {
            widget.error = error.message;
            widget.lastUpdated = new Date().toISOString();
            throw error;
        }
    }

    async calculateKPI(kpiId) {
        const calculator = this.kpiCalculators.get(kpiId);
        if (!calculator) {
            throw new Error(`KPI calculator not found: ${kpiId}`);
        }

        // Get data for KPI calculation
        const data = await this.getDataForKPI(kpiId);
        const value = calculator.calculate(data);

        return {
            value,
            format: calculator.format,
            name: calculator.name,
            description: calculator.description,
            timestamp: new Date().toISOString()
        };
    }

    async calculateMultipleKPIs(kpiIds) {
        const kpiPromises = kpiIds.map(kpiId => this.calculateKPI(kpiId));
        const kpiResults = await Promise.all(kpiPromises);

        return kpiResults.reduce((acc, kpi, index) => {
            acc[kpiIds[index]] = kpi;
            return acc;
        }, {});
    }

    async getChartData(dataSourceId, config) {
        const dataSource = this.dataSources.get(dataSourceId);
        if (!dataSource) {
            throw new Error(`Data source not found: ${dataSourceId}`);
        }

        // Mock data retrieval - in real implementation, this would query actual data sources
        const rawData = await this.queryDataSource(dataSource, config);
        return this.processChartData(rawData, config);
    }

    async getTableData(dataSourceId, config) {
        const dataSource = this.dataSources.get(dataSourceId);
        if (!dataSource) {
            throw new Error(`Data source not found: ${dataSourceId}`);
        }

        const rawData = await this.queryDataSource(dataSource, config);
        return this.processTableData(rawData, config);
    }

    async getDataForKPI(kpiId) {
        // Mock data for KPI calculations
        // In real implementation, this would query the appropriate data sources
        return [
            { income: 75000, federalTax: 12000, stateTax: 3000, deductions: 12550, hasW2: true, hasErrors: false },
            { income: 85000, federalTax: 14500, stateTax: 3500, deductions: 15000, hasW2: true, hasErrors: false },
            { income: 65000, federalTax: 9500, stateTax: 2500, deductions: 12550, hasW2: true, hasErrors: true }
        ];
    }

    processChartData(rawData, config) {
        // Process raw data for chart consumption
        switch (config.chartType) {
            case 'line':
                return rawData.map(d => ({ x: d.date, y: d.value }));
            case 'bar':
                return rawData.map(d => ({ category: d.category, value: d.value }));
            case 'pie':
                return rawData.map(d => ({ label: d.label, value: d.value }));
            default:
                return rawData;
        }
    }

    processTableData(rawData, config) {
        let processedData = rawData;

        // Apply pagination
        if (config.maxRows) {
            processedData = processedData.slice(0, config.maxRows);
        }

        // Apply sorting
        if (config.sortBy) {
            processedData.sort((a, b) => {
                const aVal = a[config.sortBy];
                const bVal = b[config.sortBy];
                return config.sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
            });
        }

        return {
            data: processedData,
            totalRows: rawData.length,
            columns: Object.keys(rawData[0] || {})
        };
    }

    async queryDataSource(dataSource, config) {
        // Mock query implementation
        // In real implementation, this would connect to databases, APIs, etc.
        return [
            { date: '2023-01-01', value: 100, category: 'Federal', label: 'Income Tax' },
            { date: '2023-02-01', value: 120, category: 'State', label: 'State Tax' },
            { date: '2023-03-01', value: 90, category: 'Local', label: 'Local Tax' }
        ];
    }

    addDataSource(dataSourceId, dataSourceConfig) {
        const dataSource = {
            id: dataSourceId,
            name: dataSourceConfig.name,
            type: dataSourceConfig.type, // 'database', 'api', 'file', etc.
            connection: dataSourceConfig.connection,
            query: dataSourceConfig.query,
            refreshInterval: dataSourceConfig.refreshInterval || 3600000, // 1 hour
            lastRefresh: null,
            isActive: true
        };

        this.dataSources.set(dataSourceId, dataSource);
        return dataSource;
    }

    getDataSource(dataSourceId) {
        return this.dataSources.get(dataSourceId);
    }

    getAllDataSources() {
        return Array.from(this.dataSources.values());
    }

    cloneDashboard(dashboardId, newName) {
        const originalDashboard = this.getDashboard(dashboardId);
        if (!originalDashboard) {
            throw new Error('Dashboard not found');
        }

        const clonedConfig = {
            ...originalDashboard,
            name: newName || `${originalDashboard.name} (Copy)`,
            id: undefined,
            createdAt: undefined,
            lastModified: undefined,
            viewCount: 0
        };

        return this.createDashboard(clonedConfig);
    }

    exportDashboard(dashboardId) {
        const dashboard = this.getDashboard(dashboardId);
        if (!dashboard) {
            throw new Error('Dashboard not found');
        }

        return {
            dashboard: {
                ...dashboard,
                // Remove runtime data
                viewCount: undefined,
                lastViewed: undefined,
                lastRefresh: undefined
            },
            widgets: dashboard.widgets.map(w => this.widgets.get(w.id)),
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };
    }

    importDashboard(importData) {
        if (!importData.dashboard) {
            throw new Error('Invalid import data: missing dashboard');
        }

        const dashboardConfig = {
            ...importData.dashboard,
            createdAt: undefined,
            lastModified: undefined
        };

        return this.createDashboard(dashboardConfig);
    }

    getDashboardAnalytics() {
        const dashboards = this.getAllDashboards();

        return {
            totalDashboards: dashboards.length,
            dashboardsByCategory: this.groupDashboardsByCategory(dashboards),
            mostViewedDashboards: dashboards
                .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
                .slice(0, 10),
            recentlyCreated: dashboards
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 5),
            totalWidgets: this.widgets.size,
            widgetsByType: this.groupWidgetsByType(),
            avgWidgetsPerDashboard: dashboards.length > 0 ?
                Math.round(this.widgets.size / dashboards.length * 100) / 100 : 0
        };
    }

    groupDashboardsByCategory(dashboards) {
        return dashboards.reduce((acc, dashboard) => {
            const category = dashboard.category || 'uncategorized';
            acc[category] = (acc[category] || 0) + 1;
            return acc;
        }, {});
    }

    groupWidgetsByType() {
        const widgets = Array.from(this.widgets.values());
        return widgets.reduce((acc, widget) => {
            acc[widget.type] = (acc[widget.type] || 0) + 1;
            return acc;
        }, {});
    }

    generateDashboardId() {
        return 'dashboard_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    generateWidgetId() {
        return 'widget_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    getAvailableTemplates() {
        return Array.from(this.templates.entries()).map(([id, template]) => ({
            id,
            ...template
        }));
    }

    getTemplatesByCategory(category) {
        return this.getAvailableTemplates().filter(template => template.category === category);
    }

    addKPICalculator(kpiId, calculator) {
        this.kpiCalculators.set(kpiId, calculator);
        return calculator;
    }

    getAvailableKPIs() {
        return Array.from(this.kpiCalculators.entries()).map(([id, calculator]) => ({
            id,
            ...calculator
        }));
    }

    setupAlerts(dashboardId, alertRules) {
        alertRules.forEach(rule => {
            const alertId = this.generateAlertId();
            this.alertRules.set(alertId, {
                ...rule,
                dashboardId,
                id: alertId,
                createdAt: new Date().toISOString()
            });
        });
    }

    checkAlerts(dashboardId) {
        const alerts = Array.from(this.alertRules.values())
            .filter(rule => rule.dashboardId === dashboardId);

        const triggeredAlerts = [];

        alerts.forEach(async (rule) => {
            try {
                const value = await this.calculateKPI(rule.kpi);
                const triggered = this.evaluateAlertCondition(value.value, rule.condition, rule.threshold);

                if (triggered) {
                    triggeredAlerts.push({
                        alertId: rule.id,
                        kpi: rule.kpi,
                        currentValue: value.value,
                        threshold: rule.threshold,
                        condition: rule.condition,
                        message: rule.message,
                        severity: rule.severity || 'warning',
                        timestamp: new Date().toISOString()
                    });
                }
            } catch (error) {
                console.error(`Error checking alert ${rule.id}:`, error);
            }
        });

        return triggeredAlerts;
    }

    evaluateAlertCondition(value, condition, threshold) {
        switch (condition) {
            case 'greater_than':
                return value > threshold;
            case 'less_than':
                return value < threshold;
            case 'equals':
                return value === threshold;
            case 'greater_than_or_equal':
                return value >= threshold;
            case 'less_than_or_equal':
                return value <= threshold;
            default:
                return false;
        }
    }

    generateAlertId() {
        return 'alert_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BusinessIntelligenceDashboard;
}