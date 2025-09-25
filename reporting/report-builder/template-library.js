class ReportTemplateLibrary {
    constructor() {
        this.templates = new Map();
        this.categories = new Set(['Financial', 'Tax', 'Analytics', 'Custom']);
        this.initializeDefaultTemplates();
    }

    initializeDefaultTemplates() {
        const defaultTemplates = [
            {
                id: 'tax-summary-report',
                name: 'Tax Summary Report',
                category: 'Tax',
                description: 'Comprehensive tax calculation summary with breakdowns',
                thumbnail: '/assets/templates/tax-summary.png',
                fields: [
                    { id: 'income', name: 'Total Income', type: 'currency', required: true },
                    { id: 'taxBracket', name: 'Tax Bracket', type: 'text', required: true },
                    { id: 'federalTax', name: 'Federal Tax', type: 'currency', required: true },
                    { id: 'stateTax', name: 'State Tax', type: 'currency', required: true },
                    { id: 'effectiveRate', name: 'Effective Tax Rate', type: 'percentage', required: true }
                ],
                layout: {
                    type: 'grouped',
                    sections: [
                        { title: 'Income Summary', fields: ['income', 'taxBracket'] },
                        { title: 'Tax Breakdown', fields: ['federalTax', 'stateTax'] },
                        { title: 'Analysis', fields: ['effectiveRate'] }
                    ]
                },
                styling: {
                    headerColor: '#2c3e50',
                    accentColor: '#3498db',
                    fontFamily: 'Arial, sans-serif'
                }
            },
            {
                id: 'income-analysis',
                name: 'Income Analysis Report',
                category: 'Financial',
                description: 'Detailed income breakdown and analysis',
                thumbnail: '/assets/templates/income-analysis.png',
                fields: [
                    { id: 'salary', name: 'Salary Income', type: 'currency', required: true },
                    { id: 'bonus', name: 'Bonus Income', type: 'currency', required: false },
                    { id: 'investment', name: 'Investment Income', type: 'currency', required: false },
                    { id: 'other', name: 'Other Income', type: 'currency', required: false }
                ],
                layout: {
                    type: 'tabular',
                    groupBy: 'incomeType'
                },
                calculations: [
                    {
                        id: 'totalIncome',
                        name: 'Total Income',
                        formula: 'salary + bonus + investment + other'
                    }
                ]
            },
            {
                id: 'comparative-analysis',
                name: 'Comparative Tax Analysis',
                category: 'Analytics',
                description: 'Compare tax scenarios across different jurisdictions',
                thumbnail: '/assets/templates/comparative.png',
                fields: [
                    { id: 'jurisdiction1', name: 'Jurisdiction 1', type: 'text', required: true },
                    { id: 'jurisdiction2', name: 'Jurisdiction 2', type: 'text', required: true },
                    { id: 'tax1', name: 'Tax Amount 1', type: 'currency', required: true },
                    { id: 'tax2', name: 'Tax Amount 2', type: 'currency', required: true }
                ],
                layout: {
                    type: 'comparison',
                    compareFields: ['tax1', 'tax2']
                },
                charts: [
                    {
                        type: 'bar',
                        title: 'Tax Comparison',
                        data: ['tax1', 'tax2']
                    }
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
            tags: templateData.tags || []
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

    searchTemplates(query) {
        const searchTerm = query.toLowerCase();
        return this.getAllTemplates().filter(template =>
            template.name.toLowerCase().includes(searchTerm) ||
            template.description.toLowerCase().includes(searchTerm) ||
            template.tags.some(tag => tag.toLowerCase().includes(searchTerm))
        );
    }

    deleteTemplate(templateId) {
        return this.templates.delete(templateId);
    }

    cloneTemplate(templateId, newName) {
        const original = this.getTemplate(templateId);
        if (!original) return null;

        const cloned = {
            ...original,
            id: this.generateTemplateId(),
            name: newName || `${original.name} (Copy)`,
            createdAt: new Date().toISOString()
        };

        this.addTemplate(cloned);
        return cloned.id;
    }

    exportTemplate(templateId) {
        const template = this.getTemplate(templateId);
        if (!template) return null;

        return {
            ...template,
            exportedAt: new Date().toISOString(),
            version: template.version
        };
    }

    importTemplate(templateData) {
        const validatedTemplate = this.validateTemplateStructure(templateData);
        if (validatedTemplate.isValid) {
            const templateId = this.addTemplate(templateData);
            return { success: true, templateId };
        }
        return { success: false, errors: validatedTemplate.errors };
    }

    validateTemplateStructure(template) {
        const errors = [];

        if (!template.name || typeof template.name !== 'string') {
            errors.push('Template name is required and must be a string');
        }

        if (!template.category || typeof template.category !== 'string') {
            errors.push('Template category is required and must be a string');
        }

        if (!template.fields || !Array.isArray(template.fields)) {
            errors.push('Template fields are required and must be an array');
        } else {
            template.fields.forEach((field, index) => {
                if (!field.id || !field.name || !field.type) {
                    errors.push(`Field at index ${index} is missing required properties (id, name, type)`);
                }
            });
        }

        if (!template.layout || typeof template.layout !== 'object') {
            errors.push('Template layout is required and must be an object');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    getTemplatePreview(templateId) {
        const template = this.getTemplate(templateId);
        if (!template) return null;

        return {
            name: template.name,
            description: template.description,
            fieldCount: template.fields.length,
            category: template.category,
            thumbnail: template.thumbnail,
            features: this.extractTemplateFeatures(template)
        };
    }

    extractTemplateFeatures(template) {
        const features = [];

        if (template.calculations && template.calculations.length > 0) {
            features.push('Calculated Fields');
        }

        if (template.charts && template.charts.length > 0) {
            features.push('Data Visualization');
        }

        if (template.layout.type === 'grouped') {
            features.push('Grouped Layout');
        }

        if (template.layout.type === 'comparison') {
            features.push('Comparison View');
        }

        return features;
    }

    generateTemplateId() {
        return 'template_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    getTemplateCategories() {
        return Array.from(this.categories);
    }

    updateTemplate(templateId, updates) {
        const template = this.getTemplate(templateId);
        if (!template) return false;

        const updatedTemplate = {
            ...template,
            ...updates,
            updatedAt: new Date().toISOString(),
            version: this.incrementVersion(template.version)
        };

        const validation = this.validateTemplateStructure(updatedTemplate);
        if (!validation.isValid) {
            throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
        }

        this.templates.set(templateId, updatedTemplate);
        return true;
    }

    incrementVersion(currentVersion) {
        const parts = currentVersion.split('.');
        const patch = parseInt(parts[2]) + 1;
        return `${parts[0]}.${parts[1]}.${patch}`;
    }

    renderTemplateLibrary(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="template-library">
                <div class="template-header">
                    <h3>Report Template Library</h3>
                    <div class="template-controls">
                        <input type="text" id="template-search" placeholder="Search templates...">
                        <select id="category-filter">
                            <option value="">All Categories</option>
                            ${this.getTemplateCategories().map(cat =>
                                `<option value="${cat}">${cat}</option>`
                            ).join('')}
                        </select>
                        <button id="create-template" class="btn-primary">Create New</button>
                    </div>
                </div>
                <div class="template-grid" id="template-grid">
                    ${this.renderTemplateGrid()}
                </div>
            </div>
        `;

        this.setupTemplateLibraryEvents();
    }

    renderTemplateGrid(templates = null) {
        const templatesToRender = templates || this.getAllTemplates();

        return templatesToRender.map(template => `
            <div class="template-card" data-template-id="${template.id}">
                <div class="template-thumbnail">
                    <img src="${template.thumbnail || '/assets/templates/default.png'}"
                         alt="${template.name}" loading="lazy">
                </div>
                <div class="template-info">
                    <h4>${template.name}</h4>
                    <p>${template.description}</p>
                    <div class="template-meta">
                        <span class="category">${template.category}</span>
                        <span class="field-count">${template.fields.length} fields</span>
                    </div>
                    <div class="template-features">
                        ${this.extractTemplateFeatures(template).map(feature =>
                            `<span class="feature-tag">${feature}</span>`
                        ).join('')}
                    </div>
                </div>
                <div class="template-actions">
                    <button class="use-template" data-template-id="${template.id}">Use Template</button>
                    <button class="preview-template" data-template-id="${template.id}">Preview</button>
                    <button class="clone-template" data-template-id="${template.id}">Clone</button>
                </div>
            </div>
        `).join('');
    }

    setupTemplateLibraryEvents() {
        const searchInput = document.getElementById('template-search');
        const categoryFilter = document.getElementById('category-filter');
        const templateGrid = document.getElementById('template-grid');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterTemplates(e.target.value, categoryFilter.value);
            });
        }

        if (categoryFilter) {
            categoryFilter.addEventListener('change', (e) => {
                this.filterTemplates(searchInput.value, e.target.value);
            });
        }

        if (templateGrid) {
            templateGrid.addEventListener('click', (e) => {
                const templateId = e.target.dataset.templateId;
                if (!templateId) return;

                if (e.target.classList.contains('use-template')) {
                    this.useTemplate(templateId);
                } else if (e.target.classList.contains('preview-template')) {
                    this.previewTemplate(templateId);
                } else if (e.target.classList.contains('clone-template')) {
                    this.cloneTemplateWithPrompt(templateId);
                }
            });
        }
    }

    filterTemplates(searchQuery, category) {
        let filteredTemplates = this.getAllTemplates();

        if (searchQuery) {
            filteredTemplates = this.searchTemplates(searchQuery);
        }

        if (category) {
            filteredTemplates = filteredTemplates.filter(t => t.category === category);
        }

        const grid = document.getElementById('template-grid');
        if (grid) {
            grid.innerHTML = this.renderTemplateGrid(filteredTemplates);
        }
    }

    useTemplate(templateId) {
        const template = this.getTemplate(templateId);
        if (!template) return;

        // Emit event for report builder to use this template
        const event = new CustomEvent('templateSelected', {
            detail: { template }
        });
        document.dispatchEvent(event);
    }

    previewTemplate(templateId) {
        const template = this.getTemplate(templateId);
        if (!template) return;

        // Create preview modal
        const modal = document.createElement('div');
        modal.className = 'template-preview-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Template Preview: ${template.name}</h3>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="preview-details">
                        <p><strong>Category:</strong> ${template.category}</p>
                        <p><strong>Description:</strong> ${template.description}</p>
                        <p><strong>Fields:</strong> ${template.fields.length}</p>
                        <div class="field-list">
                            <h4>Fields:</h4>
                            <ul>
                                ${template.fields.map(field =>
                                    `<li>${field.name} (${field.type})${field.required ? ' *' : ''}</li>`
                                ).join('')}
                            </ul>
                        </div>
                    </div>
                    <div class="preview-actions">
                        <button class="use-template-preview" data-template-id="${templateId}">Use This Template</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.close-modal').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        modal.querySelector('.use-template-preview').addEventListener('click', () => {
            this.useTemplate(templateId);
            document.body.removeChild(modal);
        });
    }

    cloneTemplateWithPrompt(templateId) {
        const template = this.getTemplate(templateId);
        if (!template) return;

        const newName = prompt(`Enter name for cloned template:`, `${template.name} (Copy)`);
        if (newName) {
            const clonedId = this.cloneTemplate(templateId, newName);
            if (clonedId) {
                this.refreshTemplateGrid();
                alert('Template cloned successfully!');
            }
        }
    }

    refreshTemplateGrid() {
        const grid = document.getElementById('template-grid');
        if (grid) {
            grid.innerHTML = this.renderTemplateGrid();
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReportTemplateLibrary;
}