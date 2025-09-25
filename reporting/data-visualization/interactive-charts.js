class InteractiveChartBuilder {
    constructor(visualizationEngine) {
        this.engine = visualizationEngine;
        this.tooltips = new Map();
        this.legends = new Map();
        this.brushes = new Map();
        this.crossfilters = new Map();
        this.drilldowns = new Map();
        this.initializeInteractionTypes();
    }

    initializeInteractionTypes() {
        this.interactionTypes = {
            tooltip: {
                name: 'Tooltip',
                description: 'Show details on hover',
                supported: ['bar', 'line', 'scatter', 'pie', 'area']
            },
            zoom: {
                name: 'Zoom & Pan',
                description: 'Zoom and pan chart area',
                supported: ['bar', 'line', 'scatter', 'area', 'heatmap']
            },
            brush: {
                name: 'Brush Selection',
                description: 'Select data ranges',
                supported: ['line', 'area', 'scatter']
            },
            filter: {
                name: 'Interactive Filter',
                description: 'Filter data dynamically',
                supported: ['bar', 'line', 'scatter', 'pie']
            },
            drilldown: {
                name: 'Drill Down',
                description: 'Navigate to detailed views',
                supported: ['bar', 'pie', 'treemap']
            },
            crossfilter: {
                name: 'Cross Filter',
                description: 'Link multiple charts',
                supported: ['bar', 'line', 'scatter', 'pie']
            }
        };
    }

    createInteractiveChart(config) {
        // Create base chart using visualization engine
        const baseChart = this.engine.createVisualization(config);

        if (!baseChart.success) {
            return baseChart;
        }

        // Add interactive features
        const interactiveChart = {
            ...baseChart,
            interactions: {},
            filters: new Map(),
            selections: new Set(),
            linkedCharts: new Set()
        };

        // Setup requested interactions
        if (config.interactions) {
            this.setupInteractions(interactiveChart, config.interactions);
        }

        // Add default interactions based on chart type
        this.addDefaultInteractions(interactiveChart, config.chartType);

        return interactiveChart;
    }

    setupInteractions(chart, interactionConfig) {
        if (interactionConfig.tooltip) {
            this.addTooltip(chart, interactionConfig.tooltip);
        }

        if (interactionConfig.zoom) {
            this.addZoomPan(chart, interactionConfig.zoom);
        }

        if (interactionConfig.brush) {
            this.addBrushSelection(chart, interactionConfig.brush);
        }

        if (interactionConfig.filter) {
            this.addInteractiveFilter(chart, interactionConfig.filter);
        }

        if (interactionConfig.drilldown) {
            this.addDrilldown(chart, interactionConfig.drilldown);
        }

        if (interactionConfig.crossfilter) {
            this.addCrossfilter(chart, interactionConfig.crossfilter);
        }

        if (interactionConfig.legend) {
            this.addInteractiveLegend(chart, interactionConfig.legend);
        }
    }

    addTooltip(chart, tooltipConfig) {
        const tooltip = d3.select('body')
            .append('div')
            .attr('class', 'chart-tooltip')
            .style('position', 'absolute')
            .style('visibility', 'hidden')
            .style('background', 'rgba(0, 0, 0, 0.8)')
            .style('color', 'white')
            .style('padding', '8px 12px')
            .style('border-radius', '4px')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .style('z-index', '1000');

        // Add tooltip behavior to chart elements
        if (chart.elements) {
            Object.values(chart.elements).forEach(elementGroup => {
                if (elementGroup) {
                    elementGroup
                        .on('mouseover', (event, d) => {
                            const content = this.generateTooltipContent(d, tooltipConfig);
                            tooltip
                                .style('visibility', 'visible')
                                .html(content);
                        })
                        .on('mousemove', (event) => {
                            tooltip
                                .style('top', (event.pageY - 10) + 'px')
                                .style('left', (event.pageX + 10) + 'px');
                        })
                        .on('mouseout', () => {
                            tooltip.style('visibility', 'hidden');
                        });
                }
            });
        }

        chart.interactions.tooltip = tooltip;
        this.tooltips.set(chart.metadata.id, tooltip);
    }

    generateTooltipContent(data, tooltipConfig) {
        if (tooltipConfig.template) {
            return this.processTooltipTemplate(tooltipConfig.template, data);
        }

        // Default tooltip content
        let content = '';
        if (typeof data === 'object') {
            for (const [key, value] of Object.entries(data)) {
                if (key !== 'data' && value !== undefined) {
                    content += `<div><strong>${key}:</strong> ${this.formatValue(value)}</div>`;
                }
            }
        } else {
            content = this.formatValue(data);
        }

        return content;
    }

    processTooltipTemplate(template, data) {
        return template.replace(/\{(\w+)\}/g, (match, key) => {
            return this.formatValue(data[key] || data.data?.[key] || '');
        });
    }

    formatValue(value) {
        if (typeof value === 'number') {
            if (value % 1 === 0) {
                return value.toLocaleString();
            } else {
                return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
            }
        }
        return value;
    }

    addZoomPan(chart, zoomConfig) {
        const zoom = d3.zoom()
            .scaleExtent(zoomConfig.scaleExtent || [0.1, 10])
            .on('zoom', (event) => {
                this.handleZoom(chart, event.transform);

                if (zoomConfig.onZoom) {
                    zoomConfig.onZoom(event.transform);
                }
            });

        chart.svg.call(zoom);
        chart.interactions.zoom = zoom;

        // Add zoom controls
        if (zoomConfig.showControls) {
            this.addZoomControls(chart, zoom);
        }
    }

    handleZoom(chart, transform) {
        // Update chart elements based on zoom transform
        if (chart.elements) {
            Object.values(chart.elements).forEach(elementGroup => {
                if (elementGroup) {
                    elementGroup.attr('transform', transform);
                }
            });
        }

        // Update axes if present
        if (chart.scales) {
            this.updateAxesForZoom(chart, transform);
        }
    }

    updateAxesForZoom(chart, transform) {
        if (chart.scales.x) {
            const newXScale = transform.rescaleX(chart.scales.x);
            chart.svg.select('.x-axis').call(d3.axisBottom(newXScale));
        }

        if (chart.scales.y) {
            const newYScale = transform.rescaleY(chart.scales.y);
            chart.svg.select('.y-axis').call(d3.axisLeft(newYScale));
        }
    }

    addZoomControls(chart, zoom) {
        const controls = chart.svg.append('g')
            .attr('class', 'zoom-controls')
            .attr('transform', 'translate(10, 10)');

        // Zoom in button
        const zoomInButton = controls.append('g')
            .attr('class', 'zoom-control zoom-in')
            .style('cursor', 'pointer');

        zoomInButton.append('rect')
            .attr('width', 30)
            .attr('height', 30)
            .attr('fill', '#f8f9fa')
            .attr('stroke', '#dee2e6')
            .attr('rx', 3);

        zoomInButton.append('text')
            .attr('x', 15)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .attr('font-size', '16px')
            .text('+');

        zoomInButton.on('click', () => {
            chart.svg.transition().call(zoom.scaleBy, 1.5);
        });

        // Zoom out button
        const zoomOutButton = controls.append('g')
            .attr('class', 'zoom-control zoom-out')
            .attr('transform', 'translate(0, 35)')
            .style('cursor', 'pointer');

        zoomOutButton.append('rect')
            .attr('width', 30)
            .attr('height', 30)
            .attr('fill', '#f8f9fa')
            .attr('stroke', '#dee2e6')
            .attr('rx', 3);

        zoomOutButton.append('text')
            .attr('x', 15)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .attr('font-size', '16px')
            .text('−');

        zoomOutButton.on('click', () => {
            chart.svg.transition().call(zoom.scaleBy, 0.75);
        });

        // Reset button
        const resetButton = controls.append('g')
            .attr('class', 'zoom-control zoom-reset')
            .attr('transform', 'translate(0, 70)')
            .style('cursor', 'pointer');

        resetButton.append('rect')
            .attr('width', 30)
            .attr('height', 30)
            .attr('fill', '#f8f9fa')
            .attr('stroke', '#dee2e6')
            .attr('rx', 3);

        resetButton.append('text')
            .attr('x', 15)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .text('⌂');

        resetButton.on('click', () => {
            chart.svg.transition().call(zoom.transform, d3.zoomIdentity);
        });
    }

    addBrushSelection(chart, brushConfig) {
        const brush = d3.brush()
            .extent([[0, 0], [chart.config.dimensions.width, chart.config.dimensions.height]])
            .on('start brush end', (event) => {
                this.handleBrushSelection(chart, event, brushConfig);
            });

        const brushGroup = chart.svg.append('g')
            .attr('class', 'brush')
            .call(brush);

        chart.interactions.brush = brush;
        this.brushes.set(chart.metadata.id, brush);
    }

    handleBrushSelection(chart, event, brushConfig) {
        const selection = event.selection;

        if (!selection) {
            // Clear selection
            chart.selections.clear();
            this.highlightSelectedData(chart, []);
            return;
        }

        // Determine selected data points
        const selectedData = this.getDataInBrush(chart, selection);
        chart.selections = new Set(selectedData);

        // Highlight selected data
        this.highlightSelectedData(chart, selectedData);

        // Trigger callback if provided
        if (brushConfig.onBrush) {
            brushConfig.onBrush(selectedData, selection);
        }

        // Update linked charts if cross-filtering is enabled
        if (chart.linkedCharts.size > 0) {
            this.updateLinkedCharts(chart, selectedData);
        }
    }

    getDataInBrush(chart, selection) {
        const [[x0, y0], [x1, y1]] = selection;
        const selectedData = [];

        // This would depend on the chart type and data structure
        chart.data.forEach((d, i) => {
            const x = chart.scales.x(d.x);
            const y = chart.scales.y(d.y);

            if (x >= x0 && x <= x1 && y >= y0 && y <= y1) {
                selectedData.push({ data: d, index: i });
            }
        });

        return selectedData;
    }

    highlightSelectedData(chart, selectedData) {
        const selectedIndices = new Set(selectedData.map(d => d.index));

        // Update visual styling for selected/unselected data
        if (chart.elements) {
            Object.values(chart.elements).forEach(elementGroup => {
                if (elementGroup) {
                    elementGroup.style('opacity', (d, i) => {
                        return selectedIndices.size === 0 || selectedIndices.has(i) ? 1 : 0.3;
                    });
                }
            });
        }
    }

    addInteractiveFilter(chart, filterConfig) {
        const filterPanel = this.createFilterPanel(chart, filterConfig);
        chart.interactions.filter = filterPanel;
    }

    createFilterPanel(chart, filterConfig) {
        const container = d3.select(`#${filterConfig.containerId}`)
            .append('div')
            .attr('class', 'chart-filter-panel');

        // Create filters based on data fields
        filterConfig.fields.forEach(field => {
            this.createFieldFilter(container, chart, field);
        });

        return container;
    }

    createFieldFilter(container, chart, fieldConfig) {
        const filterGroup = container.append('div')
            .attr('class', 'filter-group');

        filterGroup.append('label')
            .text(fieldConfig.label)
            .attr('class', 'filter-label');

        if (fieldConfig.type === 'range') {
            this.createRangeFilter(filterGroup, chart, fieldConfig);
        } else if (fieldConfig.type === 'select') {
            this.createSelectFilter(filterGroup, chart, fieldConfig);
        } else if (fieldConfig.type === 'multiselect') {
            this.createMultiSelectFilter(filterGroup, chart, fieldConfig);
        }
    }

    createRangeFilter(container, chart, fieldConfig) {
        const data = chart.data.map(d => d[fieldConfig.field]);
        const extent = d3.extent(data);

        const slider = container.append('div')
            .attr('class', 'range-slider');

        // This would typically use a slider library
        // For simplicity, using input range elements
        const minInput = slider.append('input')
            .attr('type', 'range')
            .attr('min', extent[0])
            .attr('max', extent[1])
            .attr('value', extent[0])
            .on('input', () => this.updateFilter(chart, fieldConfig, [minInput.node().value, maxInput.node().value]));

        const maxInput = slider.append('input')
            .attr('type', 'range')
            .attr('min', extent[0])
            .attr('max', extent[1])
            .attr('value', extent[1])
            .on('input', () => this.updateFilter(chart, fieldConfig, [minInput.node().value, maxInput.node().value]));
    }

    createSelectFilter(container, chart, fieldConfig) {
        const uniqueValues = [...new Set(chart.data.map(d => d[fieldConfig.field]))];

        const select = container.append('select')
            .attr('class', 'filter-select')
            .on('change', () => {
                const selectedValue = select.node().value;
                this.updateFilter(chart, fieldConfig, selectedValue);
            });

        select.append('option')
            .attr('value', '')
            .text('All');

        select.selectAll('.option')
            .data(uniqueValues)
            .enter()
            .append('option')
            .attr('value', d => d)
            .text(d => d);
    }

    updateFilter(chart, fieldConfig, value) {
        chart.filters.set(fieldConfig.field, {
            type: fieldConfig.type,
            value: value
        });

        // Apply all filters and update chart
        const filteredData = this.applyFilters(chart.data, chart.filters);
        this.updateChartData(chart, filteredData);
    }

    applyFilters(data, filters) {
        return data.filter(item => {
            for (const [field, filter] of filters) {
                if (!this.passesFilter(item[field], filter)) {
                    return false;
                }
            }
            return true;
        });
    }

    passesFilter(value, filter) {
        switch (filter.type) {
            case 'range':
                return value >= filter.value[0] && value <= filter.value[1];
            case 'select':
                return filter.value === '' || value === filter.value;
            case 'multiselect':
                return filter.value.length === 0 || filter.value.includes(value);
            default:
                return true;
        }
    }

    updateChartData(chart, newData) {
        // Update chart visualization with new data
        // This would depend on the specific chart type
        chart.data = newData;

        // Recreate chart elements with new data
        // Implementation would vary by chart type
        this.redrawChart(chart);
    }

    redrawChart(chart) {
        // Clear existing chart elements
        if (chart.elements) {
            Object.values(chart.elements).forEach(elementGroup => {
                if (elementGroup) {
                    elementGroup.remove();
                }
            });
        }

        // Redraw with new data
        // This would call the appropriate chart builder method
        const newChart = this.engine.buildChart(chart.metadata.chartType, chart.data, chart.config);

        // Update chart reference
        Object.assign(chart, newChart);
    }

    addDrilldown(chart, drilldownConfig) {
        // Add click handlers for drill-down functionality
        if (chart.elements) {
            Object.values(chart.elements).forEach(elementGroup => {
                if (elementGroup) {
                    elementGroup
                        .style('cursor', 'pointer')
                        .on('click', (event, d) => {
                            this.handleDrilldown(chart, d, drilldownConfig);
                        });
                }
            });
        }

        chart.interactions.drilldown = drilldownConfig;
    }

    handleDrilldown(chart, data, drilldownConfig) {
        if (drilldownConfig.callback) {
            drilldownConfig.callback(data, chart);
        }

        // Default drill-down behavior
        if (drilldownConfig.detailChart) {
            this.createDetailChart(chart, data, drilldownConfig.detailChart);
        }
    }

    createDetailChart(parentChart, data, detailConfig) {
        // Create a detailed view chart based on selected data
        const detailChartConfig = {
            ...detailConfig,
            data: this.getDetailData(data, detailConfig.dataSource),
            containerId: detailConfig.containerId
        };

        return this.createInteractiveChart(detailChartConfig);
    }

    getDetailData(selectedData, dataSource) {
        // Fetch or generate detailed data based on selection
        // This would typically involve API calls or data transformation
        return dataSource.getData(selectedData);
    }

    addCrossfilter(chart, crossfilterConfig) {
        // Link chart with other charts for cross-filtering
        crossfilterConfig.linkedCharts.forEach(chartId => {
            chart.linkedCharts.add(chartId);
        });

        chart.interactions.crossfilter = crossfilterConfig;
        this.crossfilters.set(chart.metadata.id, crossfilterConfig);
    }

    updateLinkedCharts(sourceChart, selectedData) {
        sourceChart.linkedCharts.forEach(chartId => {
            const linkedChart = this.getChartById(chartId);
            if (linkedChart) {
                this.applySelectionToChart(linkedChart, selectedData, sourceChart.interactions.crossfilter);
            }
        });
    }

    applySelectionToChart(chart, selectedData, crossfilterConfig) {
        // Apply cross-filter selection to linked chart
        const filterField = crossfilterConfig.filterField;
        const selectedValues = selectedData.map(d => d.data[filterField]);

        // Update chart to highlight related data
        this.highlightRelatedData(chart, filterField, selectedValues);
    }

    highlightRelatedData(chart, field, values) {
        if (chart.elements) {
            Object.values(chart.elements).forEach(elementGroup => {
                if (elementGroup) {
                    elementGroup.style('opacity', (d) => {
                        return values.includes(d[field]) ? 1 : 0.3;
                    });
                }
            });
        }
    }

    addInteractiveLegend(chart, legendConfig) {
        const legend = this.createLegend(chart, legendConfig);
        chart.interactions.legend = legend;
        this.legends.set(chart.metadata.id, legend);
    }

    createLegend(chart, legendConfig) {
        const legendContainer = chart.svg.append('g')
            .attr('class', 'chart-legend')
            .attr('transform', `translate(${legendConfig.x || 0}, ${legendConfig.y || 0})`);

        // Create legend items based on chart data
        const legendItems = this.getLegendItems(chart);

        const items = legendContainer.selectAll('.legend-item')
            .data(legendItems)
            .enter()
            .append('g')
            .attr('class', 'legend-item')
            .attr('transform', (d, i) => `translate(0, ${i * 20})`)
            .style('cursor', 'pointer')
            .on('click', (event, d) => {
                this.toggleLegendItem(chart, d);
            });

        items.append('rect')
            .attr('width', 12)
            .attr('height', 12)
            .attr('fill', d => d.color);

        items.append('text')
            .attr('x', 16)
            .attr('y', 9)
            .attr('dy', '0.35em')
            .text(d => d.label);

        return legendContainer;
    }

    getLegendItems(chart) {
        // Extract legend items from chart data
        // This would depend on the chart type and data structure
        return [];
    }

    toggleLegendItem(chart, legendItem) {
        // Toggle visibility of data series
        legendItem.visible = !legendItem.visible;

        // Update chart visualization
        this.updateSeriesVisibility(chart, legendItem);
    }

    updateSeriesVisibility(chart, legendItem) {
        // Update chart elements based on legend item visibility
        if (chart.elements) {
            Object.values(chart.elements).forEach(elementGroup => {
                if (elementGroup) {
                    elementGroup
                        .filter(d => d.series === legendItem.series)
                        .style('opacity', legendItem.visible ? 1 : 0);
                }
            });
        }
    }

    addDefaultInteractions(chart, chartType) {
        // Add default interactions based on chart type
        const defaults = {
            bar: ['tooltip', 'filter'],
            line: ['tooltip', 'zoom', 'brush'],
            scatter: ['tooltip', 'zoom', 'brush'],
            pie: ['tooltip', 'drilldown'],
            area: ['tooltip', 'zoom', 'brush']
        };

        const defaultInteractions = defaults[chartType] || ['tooltip'];

        defaultInteractions.forEach(interaction => {
            if (!chart.interactions[interaction]) {
                this.addDefaultInteraction(chart, interaction);
            }
        });
    }

    addDefaultInteraction(chart, interactionType) {
        const defaultConfigs = {
            tooltip: { template: null },
            zoom: { scaleExtent: [0.1, 10], showControls: false },
            brush: { onBrush: null },
            filter: { fields: [] }
        };

        const config = defaultConfigs[interactionType];
        if (config) {
            this.setupInteractions(chart, { [interactionType]: config });
        }
    }

    getChartById(chartId) {
        // Retrieve chart instance by ID
        // This would typically be maintained in a chart registry
        return null;
    }

    destroyInteractions(chart) {
        // Clean up interactions when chart is destroyed
        if (chart.interactions.tooltip) {
            chart.interactions.tooltip.remove();
        }

        // Remove from registries
        this.tooltips.delete(chart.metadata.id);
        this.legends.delete(chart.metadata.id);
        this.brushes.delete(chart.metadata.id);
        this.crossfilters.delete(chart.metadata.id);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InteractiveChartBuilder;
}