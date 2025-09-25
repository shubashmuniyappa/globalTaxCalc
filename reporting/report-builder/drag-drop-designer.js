/**
 * Drag-and-Drop Report Designer
 * Interactive visual report builder with drag-and-drop interface
 */

class DragDropReportDesigner {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            allowCustomFields: true,
            maxFields: 50,
            enablePreview: true,
            autoSave: true,
            autoSaveInterval: 30000, // 30 seconds
            ...options
        };

        this.currentReport = null;
        this.availableFields = [];
        this.selectedFields = [];
        this.draggedElement = null;
        this.dropZones = [];

        this.init();
    }

    init() {
        this.createDesignerLayout();
        this.setupEventListeners();
        this.loadAvailableFields();

        if (this.options.autoSave) {
            this.setupAutoSave();
        }
    }

    createDesignerLayout() {
        this.container.innerHTML = `
            <div class="report-designer">
                <!-- Toolbar -->
                <div class="designer-toolbar">
                    <div class="toolbar-section">
                        <button id="save-report" class="btn btn-primary">
                            <i class="fas fa-save"></i> Save Report
                        </button>
                        <button id="preview-report" class="btn btn-secondary">
                            <i class="fas fa-eye"></i> Preview
                        </button>
                        <button id="export-report" class="btn btn-outline-primary">
                            <i class="fas fa-download"></i> Export
                        </button>
                    </div>
                    <div class="toolbar-section">
                        <select id="layout-type" class="form-control">
                            <option value="tabular">Tabular Report</option>
                            <option value="dashboard">Dashboard</option>
                            <option value="pivot">Pivot Table</option>
                            <option value="chart">Chart Report</option>
                        </select>
                    </div>
                    <div class="toolbar-section">
                        <button id="undo" class="btn btn-outline-secondary">
                            <i class="fas fa-undo"></i>
                        </button>
                        <button id="redo" class="btn btn-outline-secondary">
                            <i class="fas fa-redo"></i>
                        </button>
                    </div>
                </div>

                <!-- Main Designer Area -->
                <div class="designer-main">
                    <!-- Fields Palette -->
                    <div class="fields-palette">
                        <div class="palette-header">
                            <h3>Available Fields</h3>
                            <div class="search-box">
                                <input type="text" id="field-search" placeholder="Search fields..." class="form-control">
                            </div>
                        </div>

                        <div class="field-categories">
                            <div class="category-tab active" data-category="all">All Fields</div>
                            <div class="category-tab" data-category="basic">Basic Info</div>
                            <div class="category-tab" data-category="income">Income</div>
                            <div class="category-tab" data-category="deductions">Deductions</div>
                            <div class="category-tab" data-category="tax">Tax Calculations</div>
                            <div class="category-tab" data-category="calculated">Calculated</div>
                        </div>

                        <div class="fields-list" id="available-fields">
                            <!-- Available fields will be populated here -->
                        </div>

                        <div class="calculated-field-section">
                            <button id="add-calculated-field" class="btn btn-outline-primary btn-sm">
                                <i class="fas fa-plus"></i> Add Calculated Field
                            </button>
                        </div>
                    </div>

                    <!-- Design Canvas -->
                    <div class="design-canvas">
                        <div class="canvas-header">
                            <h3>Report Design</h3>
                            <div class="canvas-tools">
                                <button id="clear-canvas" class="btn btn-outline-danger btn-sm">
                                    <i class="fas fa-trash"></i> Clear
                                </button>
                                <button id="toggle-grid" class="btn btn-outline-secondary btn-sm">
                                    <i class="fas fa-th"></i> Grid
                                </button>
                            </div>
                        </div>

                        <!-- Report Header Section -->
                        <div class="report-section" data-section="header">
                            <div class="section-title">
                                <i class="fas fa-grip-vertical drag-handle"></i>
                                Header
                                <button class="section-config-btn" data-section="header">
                                    <i class="fas fa-cog"></i>
                                </button>
                            </div>
                            <div class="drop-zone" data-zone="header" data-accepts="field,text,image">
                                <div class="drop-placeholder">
                                    Drop fields here for report header
                                </div>
                                <div class="dropped-fields" id="header-fields">
                                    <!-- Header fields will appear here -->
                                </div>
                            </div>
                        </div>

                        <!-- Report Body Section -->
                        <div class="report-section" data-section="body">
                            <div class="section-title">
                                <i class="fas fa-grip-vertical drag-handle"></i>
                                Report Content
                                <button class="section-config-btn" data-section="body">
                                    <i class="fas fa-cog"></i>
                                </button>
                            </div>
                            <div class="drop-zone main-drop-zone" data-zone="body" data-accepts="field,chart,table,text">
                                <div class="drop-placeholder">
                                    Drop fields here to build your report
                                </div>
                                <div class="dropped-fields" id="body-fields">
                                    <!-- Main report fields will appear here -->
                                </div>
                            </div>
                        </div>

                        <!-- Report Footer Section -->
                        <div class="report-section" data-section="footer">
                            <div class="section-title">
                                <i class="fas fa-grip-vertical drag-handle"></i>
                                Footer
                                <button class="section-config-btn" data-section="footer">
                                    <i class="fas fa-cog"></i>
                                </button>
                            </div>
                            <div class="drop-zone" data-zone="footer" data-accepts="field,text">
                                <div class="drop-placeholder">
                                    Drop fields here for report footer
                                </div>
                                <div class="dropped-fields" id="footer-fields">
                                    <!-- Footer fields will appear here -->
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Properties Panel -->
                    <div class="properties-panel">
                        <div class="panel-header">
                            <h3>Properties</h3>
                        </div>

                        <div class="property-sections">
                            <!-- Field Properties -->
                            <div class="property-section" id="field-properties" style="display: none;">
                                <h4>Field Properties</h4>
                                <div class="form-group">
                                    <label>Display Name</label>
                                    <input type="text" id="field-display-name" class="form-control">
                                </div>
                                <div class="form-group">
                                    <label>Width</label>
                                    <input type="number" id="field-width" class="form-control" placeholder="Auto">
                                </div>
                                <div class="form-group">
                                    <label>Alignment</label>
                                    <select id="field-alignment" class="form-control">
                                        <option value="left">Left</option>
                                        <option value="center">Center</option>
                                        <option value="right">Right</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Format</label>
                                    <select id="field-format" class="form-control">
                                        <option value="default">Default</option>
                                        <option value="currency">Currency</option>
                                        <option value="percentage">Percentage</option>
                                        <option value="date">Date</option>
                                        <option value="number">Number</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Aggregation</label>
                                    <select id="field-aggregation" class="form-control">
                                        <option value="none">None</option>
                                        <option value="sum">Sum</option>
                                        <option value="avg">Average</option>
                                        <option value="count">Count</option>
                                        <option value="min">Minimum</option>
                                        <option value="max">Maximum</option>
                                    </select>
                                </div>
                                <div class="checkbox-group">
                                    <label>
                                        <input type="checkbox" id="field-visible"> Visible
                                    </label>
                                    <label>
                                        <input type="checkbox" id="field-sortable"> Sortable
                                    </label>
                                    <label>
                                        <input type="checkbox" id="field-filterable"> Filterable
                                    </label>
                                </div>
                            </div>

                            <!-- Report Properties -->
                            <div class="property-section" id="report-properties">
                                <h4>Report Properties</h4>
                                <div class="form-group">
                                    <label>Report Name</label>
                                    <input type="text" id="report-name" class="form-control">
                                </div>
                                <div class="form-group">
                                    <label>Description</label>
                                    <textarea id="report-description" class="form-control" rows="3"></textarea>
                                </div>
                                <div class="form-group">
                                    <label>Page Orientation</label>
                                    <select id="page-orientation" class="form-control">
                                        <option value="portrait">Portrait</option>
                                        <option value="landscape">Landscape</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Page Size</label>
                                    <select id="page-size" class="form-control">
                                        <option value="letter">Letter</option>
                                        <option value="legal">Legal</option>
                                        <option value="a4">A4</option>
                                        <option value="tabloid">Tabloid</option>
                                    </select>
                                </div>
                            </div>

                            <!-- Styling Properties -->
                            <div class="property-section" id="styling-properties">
                                <h4>Styling</h4>
                                <div class="form-group">
                                    <label>Theme</label>
                                    <select id="report-theme" class="form-control">
                                        <option value="default">Default</option>
                                        <option value="professional">Professional</option>
                                        <option value="modern">Modern</option>
                                        <option value="minimal">Minimal</option>
                                        <option value="corporate">Corporate</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Primary Color</label>
                                    <input type="color" id="primary-color" class="form-control">
                                </div>
                                <div class="form-group">
                                    <label>Font Family</label>
                                    <select id="font-family" class="form-control">
                                        <option value="Arial">Arial</option>
                                        <option value="Helvetica">Helvetica</option>
                                        <option value="Times New Roman">Times New Roman</option>
                                        <option value="Calibri">Calibri</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Modals -->
                <div id="calculated-field-modal" class="modal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>Create Calculated Field</h3>
                            <button class="modal-close">&times;</button>
                        </div>
                        <div class="modal-body">
                            <div class="form-group">
                                <label>Field Name</label>
                                <input type="text" id="calc-field-name" class="form-control">
                            </div>
                            <div class="form-group">
                                <label>Display Name</label>
                                <input type="text" id="calc-field-display-name" class="form-control">
                            </div>
                            <div class="form-group">
                                <label>Formula</label>
                                <textarea id="calc-field-formula" class="form-control" rows="4"
                                    placeholder="e.g., total_income - total_deductions"></textarea>
                                <small class="help-text">Use field names and operators (+, -, *, /, %, etc.)</small>
                            </div>
                            <div class="form-group">
                                <label>Data Type</label>
                                <select id="calc-field-type" class="form-control">
                                    <option value="number">Number</option>
                                    <option value="currency">Currency</option>
                                    <option value="percentage">Percentage</option>
                                    <option value="text">Text</option>
                                    <option value="date">Date</option>
                                </select>
                            </div>
                            <div class="available-fields-reference">
                                <h5>Available Fields:</h5>
                                <div id="formula-field-list" class="field-reference-list">
                                    <!-- Field references will be populated here -->
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button id="validate-formula" class="btn btn-outline-primary">Validate</button>
                            <button id="save-calculated-field" class="btn btn-primary">Save Field</button>
                            <button class="btn btn-secondary modal-close">Cancel</button>
                        </div>
                    </div>
                </div>

                <!-- Preview Modal -->
                <div id="preview-modal" class="modal large-modal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>Report Preview</h3>
                            <button class="modal-close">&times;</button>
                        </div>
                        <div class="modal-body">
                            <div class="preview-toolbar">
                                <select id="preview-format" class="form-control">
                                    <option value="html">HTML</option>
                                    <option value="pdf">PDF</option>
                                    <option value="excel">Excel</option>
                                </select>
                                <button id="refresh-preview" class="btn btn-outline-primary">
                                    <i class="fas fa-refresh"></i> Refresh
                                </button>
                            </div>
                            <div id="preview-content" class="preview-content">
                                <!-- Preview will be rendered here -->
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button id="download-preview" class="btn btn-primary">Download</button>
                            <button class="btn btn-secondary modal-close">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add CSS styles
        this.addDesignerStyles();
    }

    addDesignerStyles() {
        const styles = `
            <style>
                .report-designer {
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                    background: #f5f5f5;
                }

                .designer-toolbar {
                    background: white;
                    border-bottom: 1px solid #ddd;
                    padding: 10px 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 15px;
                }

                .toolbar-section {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .designer-main {
                    flex: 1;
                    display: flex;
                    overflow: hidden;
                }

                .fields-palette {
                    width: 280px;
                    background: white;
                    border-right: 1px solid #ddd;
                    display: flex;
                    flex-direction: column;
                }

                .palette-header {
                    padding: 15px;
                    border-bottom: 1px solid #eee;
                }

                .palette-header h3 {
                    margin: 0 0 10px 0;
                    font-size: 16px;
                }

                .search-box input {
                    font-size: 14px;
                    padding: 8px;
                }

                .field-categories {
                    display: flex;
                    flex-wrap: wrap;
                    padding: 10px;
                    gap: 5px;
                    border-bottom: 1px solid #eee;
                }

                .category-tab {
                    padding: 6px 12px;
                    background: #f8f9fa;
                    border: 1px solid #dee2e6;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.2s;
                }

                .category-tab.active {
                    background: #007bff;
                    color: white;
                }

                .fields-list {
                    flex: 1;
                    overflow-y: auto;
                    padding: 10px;
                }

                .field-item {
                    padding: 10px;
                    margin: 5px 0;
                    background: white;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    cursor: grab;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .field-item:hover {
                    background: #f8f9fa;
                    border-color: #007bff;
                    transform: translateY(-1px);
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }

                .field-item.dragging {
                    opacity: 0.5;
                    transform: rotate(5deg);
                }

                .field-icon {
                    width: 16px;
                    height: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .field-info {
                    flex: 1;
                }

                .field-name {
                    font-weight: 500;
                    font-size: 13px;
                }

                .field-type {
                    font-size: 11px;
                    color: #666;
                }

                .design-canvas {
                    flex: 1;
                    padding: 20px;
                    overflow-y: auto;
                    background: #fafafa;
                }

                .canvas-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }

                .canvas-header h3 {
                    margin: 0;
                }

                .canvas-tools {
                    display: flex;
                    gap: 10px;
                }

                .report-section {
                    background: white;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    min-height: 120px;
                }

                .section-title {
                    padding: 10px 15px;
                    background: #f8f9fa;
                    border-bottom: 1px solid #ddd;
                    border-radius: 8px 8px 0 0;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-weight: 500;
                }

                .drag-handle {
                    cursor: grab;
                    color: #999;
                }

                .section-config-btn {
                    margin-left: auto;
                    background: none;
                    border: none;
                    color: #666;
                    cursor: pointer;
                    padding: 4px;
                }

                .drop-zone {
                    padding: 20px;
                    min-height: 80px;
                    position: relative;
                    transition: all 0.3s;
                }

                .drop-zone.drag-over {
                    background: #e3f2fd;
                    border: 2px dashed #2196f3;
                }

                .drop-placeholder {
                    text-align: center;
                    color: #999;
                    font-style: italic;
                    padding: 20px;
                    border: 2px dashed #ddd;
                    border-radius: 4px;
                    transition: all 0.3s;
                }

                .drop-zone.has-fields .drop-placeholder {
                    display: none;
                }

                .dropped-fields {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                }

                .dropped-field {
                    background: #f8f9fa;
                    border: 1px solid #dee2e6;
                    border-radius: 4px;
                    padding: 8px 12px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    position: relative;
                }

                .dropped-field:hover {
                    background: #e9ecef;
                    border-color: #007bff;
                }

                .dropped-field.selected {
                    background: #cce5ff;
                    border-color: #007bff;
                }

                .field-remove {
                    background: #dc3545;
                    color: white;
                    border: none;
                    border-radius: 50%;
                    width: 18px;
                    height: 18px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    font-size: 10px;
                    margin-left: 5px;
                }

                .properties-panel {
                    width: 300px;
                    background: white;
                    border-left: 1px solid #ddd;
                    display: flex;
                    flex-direction: column;
                }

                .panel-header {
                    padding: 15px;
                    border-bottom: 1px solid #eee;
                }

                .panel-header h3 {
                    margin: 0;
                    font-size: 16px;
                }

                .property-sections {
                    flex: 1;
                    overflow-y: auto;
                    padding: 15px;
                }

                .property-section {
                    margin-bottom: 25px;
                }

                .property-section h4 {
                    margin: 0 0 15px 0;
                    font-size: 14px;
                    color: #333;
                    border-bottom: 1px solid #eee;
                    padding-bottom: 5px;
                }

                .form-group {
                    margin-bottom: 15px;
                }

                .form-group label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: 500;
                    font-size: 13px;
                }

                .form-control {
                    width: 100%;
                    padding: 8px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-size: 13px;
                }

                .checkbox-group {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .checkbox-group label {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-weight: normal;
                    margin-bottom: 0;
                }

                .modal {
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    z-index: 1000;
                    align-items: center;
                    justify-content: center;
                }

                .modal.show {
                    display: flex;
                }

                .modal-content {
                    background: white;
                    border-radius: 8px;
                    width: 90%;
                    max-width: 600px;
                    max-height: 90vh;
                    overflow-y: auto;
                }

                .large-modal .modal-content {
                    max-width: 90%;
                    max-height: 90vh;
                }

                .modal-header {
                    padding: 20px;
                    border-bottom: 1px solid #eee;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .modal-header h3 {
                    margin: 0;
                }

                .modal-close {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #999;
                }

                .modal-body {
                    padding: 20px;
                }

                .modal-footer {
                    padding: 20px;
                    border-top: 1px solid #eee;
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                }

                .btn {
                    padding: 8px 16px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    text-decoration: none;
                    background: white;
                    color: #333;
                    transition: all 0.2s;
                }

                .btn:hover {
                    background: #f8f9fa;
                }

                .btn-primary {
                    background: #007bff;
                    color: white;
                    border-color: #007bff;
                }

                .btn-primary:hover {
                    background: #0056b3;
                    border-color: #0056b3;
                }

                .btn-secondary {
                    background: #6c757d;
                    color: white;
                    border-color: #6c757d;
                }

                .btn-outline-primary {
                    color: #007bff;
                    border-color: #007bff;
                }

                .btn-outline-danger {
                    color: #dc3545;
                    border-color: #dc3545;
                }

                .btn-sm {
                    padding: 4px 8px;
                    font-size: 12px;
                }

                .help-text {
                    color: #666;
                    font-size: 12px;
                }

                .field-reference-list {
                    max-height: 150px;
                    overflow-y: auto;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    padding: 10px;
                }

                .preview-content {
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    background: white;
                    min-height: 400px;
                    padding: 20px;
                }

                .preview-toolbar {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 15px;
                    align-items: center;
                }

                @media (max-width: 768px) {
                    .designer-main {
                        flex-direction: column;
                    }

                    .fields-palette,
                    .properties-panel {
                        width: 100%;
                        height: auto;
                    }

                    .properties-panel {
                        order: -1;
                    }
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }

    setupEventListeners() {
        // Toolbar events
        document.getElementById('save-report').addEventListener('click', () => this.saveReport());
        document.getElementById('preview-report').addEventListener('click', () => this.previewReport());
        document.getElementById('export-report').addEventListener('click', () => this.exportReport());
        document.getElementById('layout-type').addEventListener('change', (e) => this.changeLayoutType(e.target.value));
        document.getElementById('clear-canvas').addEventListener('click', () => this.clearCanvas());

        // Field search
        document.getElementById('field-search').addEventListener('input', (e) => this.filterFields(e.target.value));

        // Category tabs
        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchCategory(e.target.dataset.category));
        });

        // Calculated field modal
        document.getElementById('add-calculated-field').addEventListener('click', () => this.showCalculatedFieldModal());
        document.getElementById('save-calculated-field').addEventListener('click', () => this.saveCalculatedField());
        document.getElementById('validate-formula').addEventListener('click', () => this.validateFormula());

        // Modal close events
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => this.closeModal(e.target.closest('.modal')));
        });

        // Property change events
        this.setupPropertyEventListeners();

        // Drag and drop events will be set up when fields are loaded
    }

    setupPropertyEventListeners() {
        const propertyInputs = [
            'field-display-name', 'field-width', 'field-alignment', 'field-format',
            'field-aggregation', 'field-visible', 'field-sortable', 'field-filterable',
            'report-name', 'report-description', 'page-orientation', 'page-size',
            'report-theme', 'primary-color', 'font-family'
        ];

        propertyInputs.forEach(inputId => {
            const element = document.getElementById(inputId);
            if (element) {
                element.addEventListener('change', () => this.updateProperty(inputId, element));
                element.addEventListener('input', () => this.updateProperty(inputId, element));
            }
        });
    }

    async loadAvailableFields() {
        try {
            // This would typically make an API call to get available fields
            this.availableFields = [
                // Basic Information
                { id: 'client_name', name: 'client_name', displayName: 'Client Name', dataType: 'text', category: 'basic', icon: 'user' },
                { id: 'client_id', name: 'client_id', displayName: 'Client ID', dataType: 'text', category: 'basic', icon: 'id-card' },
                { id: 'filing_status', name: 'filing_status', displayName: 'Filing Status', dataType: 'text', category: 'basic', icon: 'file' },
                { id: 'tax_year', name: 'tax_year', displayName: 'Tax Year', dataType: 'number', category: 'basic', icon: 'calendar' },

                // Income Fields
                { id: 'total_income', name: 'total_income', displayName: 'Total Income', dataType: 'currency', category: 'income', icon: 'dollar-sign' },
                { id: 'wages', name: 'wages', displayName: 'Wages', dataType: 'currency', category: 'income', icon: 'briefcase' },
                { id: 'business_income', name: 'business_income', displayName: 'Business Income', dataType: 'currency', category: 'income', icon: 'building' },
                { id: 'investment_income', name: 'investment_income', displayName: 'Investment Income', dataType: 'currency', category: 'income', icon: 'chart-line' },

                // Deductions
                { id: 'standard_deduction', name: 'standard_deduction', displayName: 'Standard Deduction', dataType: 'currency', category: 'deductions', icon: 'minus' },
                { id: 'itemized_deductions', name: 'itemized_deductions', displayName: 'Itemized Deductions', dataType: 'currency', category: 'deductions', icon: 'list' },
                { id: 'business_expenses', name: 'business_expenses', displayName: 'Business Expenses', dataType: 'currency', category: 'deductions', icon: 'receipt' },

                // Tax Calculations
                { id: 'adjusted_gross_income', name: 'adjusted_gross_income', displayName: 'Adjusted Gross Income', dataType: 'currency', category: 'tax', icon: 'calculator' },
                { id: 'taxable_income', name: 'taxable_income', displayName: 'Taxable Income', dataType: 'currency', category: 'tax', icon: 'money-bill' },
                { id: 'total_tax', name: 'total_tax', displayName: 'Total Tax', dataType: 'currency', category: 'tax', icon: 'hand-holding-usd' },
                { id: 'effective_rate', name: 'effective_rate', displayName: 'Effective Rate', dataType: 'percentage', category: 'tax', icon: 'percent' }
            ];

            this.renderAvailableFields();

        } catch (error) {
            console.error('Error loading available fields:', error);
        }
    }

    renderAvailableFields(category = 'all', searchTerm = '') {
        const fieldsContainer = document.getElementById('available-fields');
        let filteredFields = this.availableFields;

        // Filter by category
        if (category !== 'all') {
            filteredFields = filteredFields.filter(field => field.category === category);
        }

        // Filter by search term
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filteredFields = filteredFields.filter(field =>
                field.name.toLowerCase().includes(term) ||
                field.displayName.toLowerCase().includes(term)
            );
        }

        fieldsContainer.innerHTML = filteredFields.map(field => `
            <div class="field-item" draggable="true" data-field-id="${field.id}" data-field='${JSON.stringify(field)}'>
                <div class="field-icon">
                    <i class="fas fa-${field.icon}"></i>
                </div>
                <div class="field-info">
                    <div class="field-name">${field.displayName}</div>
                    <div class="field-type">${field.dataType}</div>
                </div>
            </div>
        `).join('');

        // Setup drag events for field items
        this.setupFieldDragEvents();
    }

    setupFieldDragEvents() {
        const fieldItems = document.querySelectorAll('.field-item');

        fieldItems.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                this.draggedElement = e.target;
                e.target.classList.add('dragging');
                e.dataTransfer.setData('text/plain', e.target.dataset.field);
            });

            item.addEventListener('dragend', (e) => {
                e.target.classList.remove('dragging');
                this.draggedElement = null;
            });
        });

        // Setup drop zones
        this.setupDropZones();
    }

    setupDropZones() {
        const dropZones = document.querySelectorAll('.drop-zone');

        dropZones.forEach(zone => {
            zone.addEventListener('dragover', (e) => {
                e.preventDefault();
                zone.classList.add('drag-over');
            });

            zone.addEventListener('dragleave', (e) => {
                if (!zone.contains(e.relatedTarget)) {
                    zone.classList.remove('drag-over');
                }
            });

            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                zone.classList.remove('drag-over');

                try {
                    const fieldData = JSON.parse(e.dataTransfer.getData('text/plain'));
                    this.addFieldToZone(fieldData, zone);
                } catch (error) {
                    console.error('Error dropping field:', error);
                }
            });
        });
    }

    addFieldToZone(fieldData, dropZone) {
        const zoneType = dropZone.dataset.zone;
        const fieldsContainer = dropZone.querySelector('.dropped-fields');

        // Check if field already exists in this zone
        const existingField = fieldsContainer.querySelector(`[data-field-id="${fieldData.id}"]`);
        if (existingField) {
            this.showMessage('Field already exists in this section', 'warning');
            return;
        }

        // Create field element
        const fieldElement = document.createElement('div');
        fieldElement.className = 'dropped-field';
        fieldElement.dataset.fieldId = fieldData.id;
        fieldElement.dataset.zone = zoneType;
        fieldElement.innerHTML = `
            <i class="fas fa-${fieldData.icon}"></i>
            <span>${fieldData.displayName}</span>
            <button class="field-remove" title="Remove field">×</button>
        `;

        // Add field to container
        fieldsContainer.appendChild(fieldElement);

        // Update zone state
        dropZone.classList.add('has-fields');

        // Setup field events
        this.setupFieldEvents(fieldElement, fieldData);

        // Update selected fields array
        this.selectedFields.push({
            ...fieldData,
            zone: zoneType,
            element: fieldElement
        });

        // Auto-save if enabled
        if (this.options.autoSave) {
            this.autoSave();
        }
    }

    setupFieldEvents(fieldElement, fieldData) {
        // Click to select field
        fieldElement.addEventListener('click', () => {
            this.selectField(fieldElement, fieldData);
        });

        // Remove field button
        const removeBtn = fieldElement.querySelector('.field-remove');
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeField(fieldElement);
        });
    }

    selectField(fieldElement, fieldData) {
        // Clear previous selection
        document.querySelectorAll('.dropped-field.selected').forEach(el => {
            el.classList.remove('selected');
        });

        // Select current field
        fieldElement.classList.add('selected');

        // Show field properties
        this.showFieldProperties(fieldData);
    }

    showFieldProperties(fieldData) {
        const propertiesPanel = document.getElementById('field-properties');
        propertiesPanel.style.display = 'block';

        // Populate field properties
        document.getElementById('field-display-name').value = fieldData.displayName || fieldData.name;
        document.getElementById('field-width').value = fieldData.width || '';
        document.getElementById('field-alignment').value = fieldData.alignment || 'left';
        document.getElementById('field-format').value = fieldData.format || 'default';
        document.getElementById('field-aggregation').value = fieldData.aggregation || 'none';
        document.getElementById('field-visible').checked = fieldData.visible !== false;
        document.getElementById('field-sortable').checked = fieldData.sortable !== false;
        document.getElementById('field-filterable').checked = fieldData.filterable !== false;

        this.selectedFieldData = fieldData;
    }

    removeField(fieldElement) {
        const fieldId = fieldElement.dataset.fieldId;
        const zone = fieldElement.dataset.zone;

        // Remove from DOM
        fieldElement.remove();

        // Remove from selected fields
        this.selectedFields = this.selectedFields.filter(field => field.id !== fieldId || field.zone !== zone);

        // Update zone state
        const dropZone = document.querySelector(`[data-zone="${zone}"]`);
        const remainingFields = dropZone.querySelectorAll('.dropped-field');
        if (remainingFields.length === 0) {
            dropZone.classList.remove('has-fields');
        }

        // Hide properties if this was the selected field
        const selectedField = document.querySelector('.dropped-field.selected');
        if (!selectedField) {
            document.getElementById('field-properties').style.display = 'none';
        }

        // Auto-save
        if (this.options.autoSave) {
            this.autoSave();
        }
    }

    updateProperty(inputId, element) {
        if (!this.selectedFieldData) return;

        const propertyMap = {
            'field-display-name': 'displayName',
            'field-width': 'width',
            'field-alignment': 'alignment',
            'field-format': 'format',
            'field-aggregation': 'aggregation',
            'field-visible': 'visible',
            'field-sortable': 'sortable',
            'field-filterable': 'filterable'
        };

        const property = propertyMap[inputId];
        if (property) {
            let value = element.type === 'checkbox' ? element.checked : element.value;

            // Convert to appropriate type
            if (property === 'width' && value) {
                value = parseInt(value);
            }

            this.selectedFieldData[property] = value;

            // Update the visual element if it's the display name
            if (property === 'displayName') {
                const selectedElement = document.querySelector('.dropped-field.selected');
                if (selectedElement) {
                    const nameSpan = selectedElement.querySelector('span');
                    nameSpan.textContent = value;
                }
            }

            // Auto-save
            if (this.options.autoSave) {
                this.autoSave();
            }
        }
    }

    switchCategory(category) {
        // Update active tab
        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-category="${category}"]`).classList.add('active');

        // Filter fields
        this.renderAvailableFields(category);
    }

    filterFields(searchTerm) {
        const activeCategory = document.querySelector('.category-tab.active').dataset.category;
        this.renderAvailableFields(activeCategory, searchTerm);
    }

    changeLayoutType(layoutType) {
        // Update canvas based on layout type
        // This would modify the available sections and their behavior
        console.log('Changing layout to:', layoutType);
    }

    clearCanvas() {
        if (confirm('Are you sure you want to clear the entire report design?')) {
            document.querySelectorAll('.dropped-fields').forEach(container => {
                container.innerHTML = '';
            });

            document.querySelectorAll('.drop-zone').forEach(zone => {
                zone.classList.remove('has-fields');
            });

            this.selectedFields = [];
            document.getElementById('field-properties').style.display = 'none';
        }
    }

    showCalculatedFieldModal() {
        const modal = document.getElementById('calculated-field-modal');
        modal.classList.add('show');

        // Populate available fields reference
        const fieldList = document.getElementById('formula-field-list');
        fieldList.innerHTML = this.availableFields.map(field =>
            `<div class="field-ref" data-field="${field.name}">${field.displayName} (${field.name})</div>`
        ).join('');

        // Add click events to field references
        fieldList.querySelectorAll('.field-ref').forEach(ref => {
            ref.addEventListener('click', () => {
                const formulaTextarea = document.getElementById('calc-field-formula');
                formulaTextarea.value += ref.dataset.field;
                formulaTextarea.focus();
            });
        });
    }

    closeModal(modal) {
        modal.classList.remove('show');
    }

    async validateFormula() {
        const formula = document.getElementById('calc-field-formula').value;

        if (!formula.trim()) {
            this.showMessage('Please enter a formula', 'error');
            return;
        }

        try {
            // This would make an API call to validate the formula
            const validation = await this.callAPI('/api/reports/validate-formula', {
                method: 'POST',
                body: JSON.stringify({ formula })
            });

            if (validation.isValid) {
                this.showMessage('Formula is valid', 'success');
            } else {
                this.showMessage(`Formula errors: ${validation.errors.join(', ')}`, 'error');
            }

        } catch (error) {
            this.showMessage('Error validating formula', 'error');
        }
    }

    async saveCalculatedField() {
        const name = document.getElementById('calc-field-name').value;
        const displayName = document.getElementById('calc-field-display-name').value;
        const formula = document.getElementById('calc-field-formula').value;
        const dataType = document.getElementById('calc-field-type').value;

        if (!name || !formula) {
            this.showMessage('Please fill in all required fields', 'error');
            return;
        }

        try {
            const fieldData = {
                name: name,
                displayName: displayName || name,
                formula: formula,
                dataType: dataType,
                category: 'calculated',
                icon: 'calculator'
            };

            // This would make an API call to save the field
            const savedField = await this.callAPI('/api/reports/calculated-fields', {
                method: 'POST',
                body: JSON.stringify(fieldData)
            });

            // Add to available fields
            this.availableFields.push(savedField);
            this.renderAvailableFields();

            // Close modal
            this.closeModal(document.getElementById('calculated-field-modal'));
            this.showMessage('Calculated field created successfully', 'success');

            // Clear form
            document.getElementById('calc-field-name').value = '';
            document.getElementById('calc-field-display-name').value = '';
            document.getElementById('calc-field-formula').value = '';

        } catch (error) {
            this.showMessage('Error creating calculated field', 'error');
        }
    }

    async previewReport() {
        const reportDefinition = this.buildReportDefinition();

        try {
            // This would make an API call to generate preview
            const preview = await this.callAPI('/api/reports/preview', {
                method: 'POST',
                body: JSON.stringify(reportDefinition)
            });

            const modal = document.getElementById('preview-modal');
            const previewContent = document.getElementById('preview-content');

            previewContent.innerHTML = preview.html;
            modal.classList.add('show');

        } catch (error) {
            this.showMessage('Error generating preview', 'error');
        }
    }

    async saveReport() {
        const reportDefinition = this.buildReportDefinition();

        if (!reportDefinition.name) {
            this.showMessage('Please enter a report name', 'error');
            return;
        }

        if (this.selectedFields.length === 0) {
            this.showMessage('Please add at least one field to the report', 'error');
            return;
        }

        try {
            // This would make an API call to save the report
            const savedReport = await this.callAPI('/api/reports', {
                method: 'POST',
                body: JSON.stringify(reportDefinition)
            });

            this.currentReport = savedReport;
            this.showMessage('Report saved successfully', 'success');

        } catch (error) {
            this.showMessage('Error saving report', 'error');
        }
    }

    buildReportDefinition() {
        return {
            name: document.getElementById('report-name').value || 'Untitled Report',
            description: document.getElementById('report-description').value,
            layout: {
                type: document.getElementById('layout-type').value,
                orientation: document.getElementById('page-orientation').value,
                pageSize: document.getElementById('page-size').value
            },
            fields: this.selectedFields.map(field => ({
                id: field.id,
                name: field.name,
                displayName: field.displayName,
                dataType: field.dataType,
                zone: field.zone,
                width: field.width,
                alignment: field.alignment,
                format: field.format,
                aggregation: field.aggregation,
                visible: field.visible,
                sortable: field.sortable,
                filterable: field.filterable
            })),
            styling: {
                theme: document.getElementById('report-theme').value,
                primaryColor: document.getElementById('primary-color').value,
                fontFamily: document.getElementById('font-family').value
            }
        };
    }

    setupAutoSave() {
        setInterval(() => {
            if (this.selectedFields.length > 0) {
                this.autoSave();
            }
        }, this.options.autoSaveInterval);
    }

    autoSave() {
        const reportDefinition = this.buildReportDefinition();

        // Save to localStorage as backup
        localStorage.setItem('reportDesigner_autoSave', JSON.stringify({
            timestamp: new Date().toISOString(),
            reportDefinition: reportDefinition
        }));

        console.log('Report auto-saved');
    }

    showMessage(message, type = 'info') {
        // Create and show a toast message
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        Object.assign(toast.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '4px',
            zIndex: '9999',
            opacity: '0',
            transform: 'translateX(100%)',
            transition: 'all 0.3s ease'
        });

        document.body.appendChild(toast);

        // Animate in
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        }, 10);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }

    async callAPI(endpoint, options = {}) {
        try {
            const response = await fetch(endpoint, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`API call failed: ${response.statusText}`);
            }

            return await response.json();

        } catch (error) {
            console.error('API call error:', error);
            throw error;
        }
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DragDropReportDesigner;
}

// Auto-initialize if DOM is ready
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        // The designer will be initialized by the parent application
        window.DragDropReportDesigner = DragDropReportDesigner;
    });
}