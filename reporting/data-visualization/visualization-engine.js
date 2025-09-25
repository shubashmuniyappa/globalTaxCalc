class DataVisualizationEngine {
    constructor() {
        this.chartTypes = new Map();
        this.dataProcessors = new Map();
        this.colorSchemes = new Map();
        this.animations = new Map();
        this.interactivity = new Map();
        this.initializeChartTypes();
        this.initializeColorSchemes();
        this.initializeAnimations();
    }

    initializeChartTypes() {
        // Bar Chart Configuration
        this.chartTypes.set('bar', {
            name: 'Bar Chart',
            description: 'Compare values across categories',
            requiredFields: {
                x: { type: 'categorical', required: true },
                y: { type: 'numerical', required: true }
            },
            optionalFields: {
                color: { type: 'categorical', required: false },
                size: { type: 'numerical', required: false }
            },
            defaultConfig: {
                orientation: 'vertical',
                stacking: 'none',
                barWidth: 0.8,
                showValues: false,
                sortBy: 'none'
            },
            supportedInteractions: ['hover', 'click', 'zoom', 'filter']
        });

        // Line Chart Configuration
        this.chartTypes.set('line', {
            name: 'Line Chart',
            description: 'Show trends over time or continuous data',
            requiredFields: {
                x: { type: 'continuous', required: true },
                y: { type: 'numerical', required: true }
            },
            optionalFields: {
                color: { type: 'categorical', required: false },
                size: { type: 'numerical', required: false }
            },
            defaultConfig: {
                smooth: false,
                showPoints: true,
                fillArea: false,
                lineWidth: 2,
                pointSize: 4
            },
            supportedInteractions: ['hover', 'click', 'zoom', 'brush']
        });

        // Pie Chart Configuration
        this.chartTypes.set('pie', {
            name: 'Pie Chart',
            description: 'Show proportions of a whole',
            requiredFields: {
                category: { type: 'categorical', required: true },
                value: { type: 'numerical', required: true }
            },
            optionalFields: {},
            defaultConfig: {
                innerRadius: 0,
                showLabels: true,
                showPercentages: true,
                explodeSlices: false
            },
            supportedInteractions: ['hover', 'click', 'explode']
        });

        // Scatter Plot Configuration
        this.chartTypes.set('scatter', {
            name: 'Scatter Plot',
            description: 'Show relationship between two variables',
            requiredFields: {
                x: { type: 'numerical', required: true },
                y: { type: 'numerical', required: true }
            },
            optionalFields: {
                color: { type: 'categorical', required: false },
                size: { type: 'numerical', required: false }
            },
            defaultConfig: {
                pointSize: 6,
                showTrendline: false,
                trendlineType: 'linear',
                alpha: 0.8
            },
            supportedInteractions: ['hover', 'click', 'zoom', 'brush', 'select']
        });

        // Heatmap Configuration
        this.chartTypes.set('heatmap', {
            name: 'Heatmap',
            description: 'Show data density or correlation patterns',
            requiredFields: {
                x: { type: 'categorical', required: true },
                y: { type: 'categorical', required: true },
                value: { type: 'numerical', required: true }
            },
            optionalFields: {},
            defaultConfig: {
                colorScale: 'sequential',
                showValues: false,
                borderWidth: 1,
                cornerRadius: 0
            },
            supportedInteractions: ['hover', 'click', 'zoom']
        });

        // Area Chart Configuration
        this.chartTypes.set('area', {
            name: 'Area Chart',
            description: 'Show cumulative values over time',
            requiredFields: {
                x: { type: 'continuous', required: true },
                y: { type: 'numerical', required: true }
            },
            optionalFields: {
                category: { type: 'categorical', required: false }
            },
            defaultConfig: {
                stacking: 'normal',
                smooth: false,
                showLine: true,
                alpha: 0.7
            },
            supportedInteractions: ['hover', 'click', 'zoom', 'brush']
        });

        // Box Plot Configuration
        this.chartTypes.set('boxplot', {
            name: 'Box Plot',
            description: 'Show distribution statistics',
            requiredFields: {
                category: { type: 'categorical', required: true },
                value: { type: 'numerical', required: true }
            },
            optionalFields: {},
            defaultConfig: {
                showOutliers: true,
                showMean: false,
                orientation: 'vertical',
                boxWidth: 0.6
            },
            supportedInteractions: ['hover', 'click']
        });

        // Geographic Map Configuration
        this.chartTypes.set('choropleth', {
            name: 'Choropleth Map',
            description: 'Show geographic data with color-coded regions',
            requiredFields: {
                region: { type: 'geographic', required: true },
                value: { type: 'numerical', required: true }
            },
            optionalFields: {},
            defaultConfig: {
                projection: 'mercator',
                colorScale: 'sequential',
                showBorders: true,
                borderColor: '#ffffff'
            },
            supportedInteractions: ['hover', 'click', 'zoom', 'pan']
        });
    }

    initializeColorSchemes() {
        this.colorSchemes.set('default', {
            name: 'Default',
            colors: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f']
        });

        this.colorSchemes.set('categorical', {
            name: 'Categorical',
            colors: ['#3366cc', '#dc3912', '#ff9900', '#109618', '#990099', '#0099c6', '#dd4477', '#66aa00']
        });

        this.colorSchemes.set('sequential', {
            name: 'Sequential',
            colors: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#084594']
        });

        this.colorSchemes.set('diverging', {
            name: 'Diverging',
            colors: ['#8c510a', '#bf812d', '#dfc27d', '#f6e8c3', '#c7eae5', '#80cdc1', '#35978f', '#01665e']
        });

        this.colorSchemes.set('tax-specific', {
            name: 'Tax Calculator',
            colors: ['#2c3e50', '#3498db', '#e74c3c', '#f39c12', '#27ae60', '#9b59b6', '#1abc9c', '#34495e']
        });
    }

    initializeAnimations() {
        this.animations.set('fadeIn', {
            name: 'Fade In',
            duration: 800,
            easing: 'easeOutCubic',
            apply: (element) => {
                element.style.opacity = '0';
                element.animate([
                    { opacity: 0 },
                    { opacity: 1 }
                ], { duration: 800, easing: 'ease-out', fill: 'forwards' });
            }
        });

        this.animations.set('slideInFromLeft', {
            name: 'Slide In From Left',
            duration: 600,
            easing: 'easeOutBack',
            apply: (element) => {
                element.animate([
                    { transform: 'translateX(-100%)', opacity: 0 },
                    { transform: 'translateX(0)', opacity: 1 }
                ], { duration: 600, easing: 'ease-out', fill: 'forwards' });
            }
        });

        this.animations.set('bounceIn', {
            name: 'Bounce In',
            duration: 1000,
            easing: 'easeOutBounce',
            apply: (element) => {
                element.animate([
                    { transform: 'scale(0)', opacity: 0 },
                    { transform: 'scale(1.1)', opacity: 1, offset: 0.6 },
                    { transform: 'scale(1)', opacity: 1 }
                ], { duration: 1000, easing: 'ease-out', fill: 'forwards' });
            }
        });
    }

    createVisualization(config) {
        try {
            this.validateConfig(config);
            const processedData = this.processData(config.data, config.chartType, config.fieldMappings);
            const chartInstance = this.buildChart(config.chartType, processedData, config);

            if (config.animations && config.animations.enabled) {
                this.applyAnimations(chartInstance, config.animations);
            }

            if (config.interactivity) {
                this.setupInteractivity(chartInstance, config.interactivity);
            }

            return {
                success: true,
                chart: chartInstance,
                metadata: {
                    chartType: config.chartType,
                    dataPoints: processedData.length,
                    fieldMappings: config.fieldMappings,
                    createdAt: new Date().toISOString()
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                details: error.stack
            };
        }
    }

    validateConfig(config) {
        if (!config.chartType) {
            throw new Error('Chart type is required');
        }

        if (!this.chartTypes.has(config.chartType)) {
            throw new Error(`Unsupported chart type: ${config.chartType}`);
        }

        if (!config.data || !Array.isArray(config.data)) {
            throw new Error('Data must be provided as an array');
        }

        if (config.data.length === 0) {
            throw new Error('Data array cannot be empty');
        }

        const chartSpec = this.chartTypes.get(config.chartType);
        const requiredFields = chartSpec.requiredFields;

        for (const [fieldName, fieldSpec] of Object.entries(requiredFields)) {
            if (fieldSpec.required && !config.fieldMappings[fieldName]) {
                throw new Error(`Required field mapping missing: ${fieldName}`);
            }
        }
    }

    processData(rawData, chartType, fieldMappings) {
        const processor = this.dataProcessors.get(chartType) || this.defaultDataProcessor;
        return processor(rawData, fieldMappings);
    }

    defaultDataProcessor(data, fieldMappings) {
        return data.map(item => {
            const processedItem = {};
            for (const [chartField, dataField] of Object.entries(fieldMappings)) {
                processedItem[chartField] = item[dataField];
            }
            return processedItem;
        });
    }

    buildChart(chartType, data, config) {
        const chartBuilder = this.getChartBuilder(chartType);
        return chartBuilder(data, config);
    }

    getChartBuilder(chartType) {
        const builders = {
            'bar': this.buildBarChart.bind(this),
            'line': this.buildLineChart.bind(this),
            'pie': this.buildPieChart.bind(this),
            'scatter': this.buildScatterPlot.bind(this),
            'heatmap': this.buildHeatmap.bind(this),
            'area': this.buildAreaChart.bind(this),
            'boxplot': this.buildBoxPlot.bind(this),
            'choropleth': this.buildChoroplethMap.bind(this)
        };

        return builders[chartType] || this.buildGenericChart.bind(this);
    }

    buildBarChart(data, config) {
        const container = document.getElementById(config.containerId);
        if (!container) throw new Error('Container element not found');

        const chartConfig = { ...this.chartTypes.get('bar').defaultConfig, ...config.chartConfig };
        const colorScheme = this.colorSchemes.get(config.colorScheme || 'default');

        // Create SVG
        const svg = this.createSVG(container, config.dimensions);
        const { width, height, margin } = this.calculateDimensions(config.dimensions);

        // Process data for bar chart
        const processedData = this.aggregateData(data, config.fieldMappings);

        // Create scales
        const xScale = this.createScale('band', processedData.map(d => d.x), [0, width]);
        const yScale = this.createScale('linear', [0, Math.max(...processedData.map(d => d.y))], [height, 0]);

        // Draw bars
        const bars = svg.append('g')
            .selectAll('rect')
            .data(processedData)
            .enter()
            .append('rect')
            .attr('x', d => xScale(d.x))
            .attr('y', d => yScale(d.y))
            .attr('width', xScale.bandwidth() * chartConfig.barWidth)
            .attr('height', d => height - yScale(d.y))
            .attr('fill', (d, i) => colorScheme.colors[i % colorScheme.colors.length]);

        // Add axes
        this.addAxes(svg, xScale, yScale, width, height);

        // Add labels if configured
        if (chartConfig.showValues) {
            this.addValueLabels(svg, processedData, xScale, yScale, chartConfig);
        }

        return {
            svg,
            data: processedData,
            scales: { x: xScale, y: yScale },
            elements: { bars },
            config: chartConfig
        };
    }

    buildLineChart(data, config) {
        const container = document.getElementById(config.containerId);
        if (!container) throw new Error('Container element not found');

        const chartConfig = { ...this.chartTypes.get('line').defaultConfig, ...config.chartConfig };
        const colorScheme = this.colorSchemes.get(config.colorScheme || 'default');

        const svg = this.createSVG(container, config.dimensions);
        const { width, height } = this.calculateDimensions(config.dimensions);

        const processedData = this.sortData(data, config.fieldMappings.x);

        // Create scales
        const xScale = this.createScale('linear',
            [Math.min(...processedData.map(d => d.x)), Math.max(...processedData.map(d => d.x))],
            [0, width]);
        const yScale = this.createScale('linear',
            [Math.min(...processedData.map(d => d.y)), Math.max(...processedData.map(d => d.y))],
            [height, 0]);

        // Create line generator
        const line = d3.line()
            .x(d => xScale(d.x))
            .y(d => yScale(d.y));

        if (chartConfig.smooth) {
            line.curve(d3.curveCardinal);
        }

        // Draw line
        const path = svg.append('path')
            .datum(processedData)
            .attr('fill', 'none')
            .attr('stroke', colorScheme.colors[0])
            .attr('stroke-width', chartConfig.lineWidth)
            .attr('d', line);

        // Add points if configured
        const points = chartConfig.showPoints ? svg.selectAll('.point')
            .data(processedData)
            .enter()
            .append('circle')
            .attr('class', 'point')
            .attr('cx', d => xScale(d.x))
            .attr('cy', d => yScale(d.y))
            .attr('r', chartConfig.pointSize)
            .attr('fill', colorScheme.colors[0]) : null;

        // Add area fill if configured
        if (chartConfig.fillArea) {
            const area = d3.area()
                .x(d => xScale(d.x))
                .y0(height)
                .y1(d => yScale(d.y));

            svg.append('path')
                .datum(processedData)
                .attr('fill', colorScheme.colors[0])
                .attr('opacity', 0.3)
                .attr('d', area);
        }

        this.addAxes(svg, xScale, yScale, width, height);

        return {
            svg,
            data: processedData,
            scales: { x: xScale, y: yScale },
            elements: { path, points },
            config: chartConfig
        };
    }

    buildPieChart(data, config) {
        const container = document.getElementById(config.containerId);
        if (!container) throw new Error('Container element not found');

        const chartConfig = { ...this.chartTypes.get('pie').defaultConfig, ...config.chartConfig };
        const colorScheme = this.colorSchemes.get(config.colorScheme || 'default');

        const svg = this.createSVG(container, config.dimensions);
        const { width, height } = this.calculateDimensions(config.dimensions);
        const radius = Math.min(width, height) / 2;

        const g = svg.append('g')
            .attr('transform', `translate(${width / 2}, ${height / 2})`);

        const pie = d3.pie()
            .value(d => d.value)
            .sort(null);

        const arc = d3.arc()
            .innerRadius(chartConfig.innerRadius * radius)
            .outerRadius(radius);

        const arcs = g.selectAll('.arc')
            .data(pie(data))
            .enter()
            .append('g')
            .attr('class', 'arc');

        arcs.append('path')
            .attr('d', arc)
            .attr('fill', (d, i) => colorScheme.colors[i % colorScheme.colors.length]);

        if (chartConfig.showLabels) {
            arcs.append('text')
                .attr('transform', d => `translate(${arc.centroid(d)})`)
                .attr('text-anchor', 'middle')
                .text(d => d.data.category);
        }

        return {
            svg,
            data,
            elements: { arcs },
            config: chartConfig
        };
    }

    buildScatterPlot(data, config) {
        const container = document.getElementById(config.containerId);
        const chartConfig = { ...this.chartTypes.get('scatter').defaultConfig, ...config.chartConfig };
        const colorScheme = this.colorSchemes.get(config.colorScheme || 'default');

        const svg = this.createSVG(container, config.dimensions);
        const { width, height } = this.calculateDimensions(config.dimensions);

        const xScale = this.createScale('linear',
            d3.extent(data, d => d.x), [0, width]);
        const yScale = this.createScale('linear',
            d3.extent(data, d => d.y), [height, 0]);

        const points = svg.selectAll('.point')
            .data(data)
            .enter()
            .append('circle')
            .attr('class', 'point')
            .attr('cx', d => xScale(d.x))
            .attr('cy', d => yScale(d.y))
            .attr('r', d => d.size ? d.size : chartConfig.pointSize)
            .attr('fill', (d, i) => d.color ? d.color : colorScheme.colors[i % colorScheme.colors.length])
            .attr('opacity', chartConfig.alpha);

        this.addAxes(svg, xScale, yScale, width, height);

        return {
            svg,
            data,
            scales: { x: xScale, y: yScale },
            elements: { points },
            config: chartConfig
        };
    }

    buildHeatmap(data, config) {
        // Heatmap implementation
        const container = document.getElementById(config.containerId);
        const chartConfig = { ...this.chartTypes.get('heatmap').defaultConfig, ...config.chartConfig };

        // Implementation details for heatmap
        return this.buildGenericChart(data, config);
    }

    buildAreaChart(data, config) {
        // Area chart implementation
        return this.buildGenericChart(data, config);
    }

    buildBoxPlot(data, config) {
        // Box plot implementation
        return this.buildGenericChart(data, config);
    }

    buildChoroplethMap(data, config) {
        // Choropleth map implementation
        return this.buildGenericChart(data, config);
    }

    buildGenericChart(data, config) {
        // Fallback implementation
        const container = document.getElementById(config.containerId);
        const svg = this.createSVG(container, config.dimensions);

        return {
            svg,
            data,
            config,
            type: 'generic'
        };
    }

    // Utility methods
    createSVG(container, dimensions) {
        const svg = d3.select(container)
            .append('svg')
            .attr('width', dimensions.width || 800)
            .attr('height', dimensions.height || 600);

        return svg;
    }

    calculateDimensions(dimensions) {
        const margin = dimensions.margin || { top: 20, right: 20, bottom: 40, left: 40 };
        const width = (dimensions.width || 800) - margin.left - margin.right;
        const height = (dimensions.height || 600) - margin.top - margin.bottom;

        return { width, height, margin };
    }

    createScale(type, domain, range) {
        switch (type) {
            case 'linear':
                return d3.scaleLinear().domain(domain).range(range);
            case 'band':
                return d3.scaleBand().domain(domain).range(range).padding(0.1);
            case 'ordinal':
                return d3.scaleOrdinal().domain(domain).range(range);
            default:
                return d3.scaleLinear().domain(domain).range(range);
        }
    }

    addAxes(svg, xScale, yScale, width, height) {
        // X axis
        svg.append('g')
            .attr('transform', `translate(0, ${height})`)
            .call(d3.axisBottom(xScale));

        // Y axis
        svg.append('g')
            .call(d3.axisLeft(yScale));
    }

    aggregateData(data, fieldMappings) {
        return data.map(item => ({
            x: item[fieldMappings.x],
            y: item[fieldMappings.y]
        }));
    }

    sortData(data, field) {
        return data.sort((a, b) => a[field] - b[field]);
    }

    addValueLabels(svg, data, xScale, yScale, config) {
        svg.selectAll('.value-label')
            .data(data)
            .enter()
            .append('text')
            .attr('class', 'value-label')
            .attr('x', d => xScale(d.x) + xScale.bandwidth() / 2)
            .attr('y', d => yScale(d.y) - 5)
            .attr('text-anchor', 'middle')
            .text(d => d.y);
    }

    applyAnimations(chartInstance, animationConfig) {
        const animation = this.animations.get(animationConfig.type);
        if (animation && chartInstance.svg) {
            animation.apply(chartInstance.svg.node());
        }
    }

    setupInteractivity(chartInstance, interactivityConfig) {
        if (interactivityConfig.hover) {
            this.setupHoverEffects(chartInstance);
        }

        if (interactivityConfig.click) {
            this.setupClickHandlers(chartInstance, interactivityConfig.click);
        }

        if (interactivityConfig.zoom) {
            this.setupZoomBehavior(chartInstance);
        }
    }

    setupHoverEffects(chartInstance) {
        if (chartInstance.elements) {
            Object.values(chartInstance.elements).forEach(element => {
                if (element) {
                    element.on('mouseover', function(event, d) {
                        d3.select(this).style('opacity', 0.8);
                        // Show tooltip
                    }).on('mouseout', function(event, d) {
                        d3.select(this).style('opacity', 1);
                        // Hide tooltip
                    });
                }
            });
        }
    }

    setupClickHandlers(chartInstance, clickConfig) {
        if (chartInstance.elements && clickConfig.callback) {
            Object.values(chartInstance.elements).forEach(element => {
                if (element) {
                    element.on('click', clickConfig.callback);
                }
            });
        }
    }

    setupZoomBehavior(chartInstance) {
        const zoom = d3.zoom()
            .scaleExtent([0.5, 10])
            .on('zoom', (event) => {
                chartInstance.svg.selectAll('g').attr('transform', event.transform);
            });

        chartInstance.svg.call(zoom);
    }

    getAvailableChartTypes() {
        return Array.from(this.chartTypes.keys());
    }

    getChartTypeInfo(chartType) {
        return this.chartTypes.get(chartType);
    }

    getColorSchemes() {
        return Array.from(this.colorSchemes.keys());
    }

    getAnimationTypes() {
        return Array.from(this.animations.keys());
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataVisualizationEngine;
}