class ReportFieldValidator {
    constructor() {
        this.validationRules = new Map();
        this.customValidators = new Map();
        this.initializeDefaultRules();
    }

    initializeDefaultRules() {
        // Currency field validation
        this.addValidationRule('currency', {
            required: (value) => value !== null && value !== undefined && value !== '',
            format: (value) => this.validateCurrencyFormat(value),
            range: (value, min = 0, max = Number.MAX_SAFE_INTEGER) =>
                this.validateNumberRange(parseFloat(value), min, max)
        });

        // Percentage field validation
        this.addValidationRule('percentage', {
            required: (value) => value !== null && value !== undefined && value !== '',
            format: (value) => this.validatePercentageFormat(value),
            range: (value, min = 0, max = 100) =>
                this.validateNumberRange(parseFloat(value), min, max)
        });

        // Text field validation
        this.addValidationRule('text', {
            required: (value) => value !== null && value !== undefined && value.trim() !== '',
            minLength: (value, min) => value.length >= min,
            maxLength: (value, max) => value.length <= max,
            pattern: (value, regex) => new RegExp(regex).test(value)
        });

        // Number field validation
        this.addValidationRule('number', {
            required: (value) => value !== null && value !== undefined && !isNaN(value),
            integer: (value) => Number.isInteger(parseFloat(value)),
            positive: (value) => parseFloat(value) > 0,
            range: (value, min, max) => this.validateNumberRange(parseFloat(value), min, max)
        });

        // Date field validation
        this.addValidationRule('date', {
            required: (value) => value !== null && value !== undefined && value !== '',
            format: (value) => this.validateDateFormat(value),
            futureDate: (value) => new Date(value) > new Date(),
            pastDate: (value) => new Date(value) < new Date(),
            dateRange: (value, startDate, endDate) =>
                this.validateDateRange(value, startDate, endDate)
        });

        // Email field validation
        this.addValidationRule('email', {
            required: (value) => value !== null && value !== undefined && value.trim() !== '',
            format: (value) => this.validateEmailFormat(value)
        });

        // Formula field validation
        this.addValidationRule('formula', {
            required: (value) => value !== null && value !== undefined && value.trim() !== '',
            syntax: (value) => this.validateFormulaSyntax(value),
            dependencies: (value, availableFields) => this.validateFormulaDependencies(value, availableFields)
        });
    }

    addValidationRule(fieldType, rules) {
        this.validationRules.set(fieldType, rules);
    }

    addCustomValidator(name, validatorFunction) {
        this.customValidators.set(name, validatorFunction);
    }

    validateField(field, value, context = {}) {
        const errors = [];
        const warnings = [];
        const fieldType = field.type;
        const rules = this.validationRules.get(fieldType);

        if (!rules) {
            warnings.push(`No validation rules found for field type: ${fieldType}`);
            return { isValid: true, errors, warnings };
        }

        // Check required validation
        if (field.required && rules.required) {
            if (!rules.required(value)) {
                errors.push(`${field.name} is required`);
                return { isValid: false, errors, warnings };
            }
        }

        // Skip other validations if field is not required and value is empty
        if (!field.required && (value === null || value === undefined || value === '')) {
            return { isValid: true, errors, warnings };
        }

        // Apply field-specific validations
        for (const [ruleName, ruleFunction] of Object.entries(rules)) {
            if (ruleName === 'required') continue; // Already handled

            const validation = field.validation || {};
            const ruleConfig = validation[ruleName];

            if (ruleConfig !== undefined) {
                let isValid;

                if (typeof ruleConfig === 'object' && ruleConfig.enabled === false) {
                    continue; // Skip disabled validations
                }

                if (typeof ruleConfig === 'boolean' && ruleConfig) {
                    isValid = ruleFunction(value);
                } else if (typeof ruleConfig === 'object') {
                    isValid = ruleFunction(value, ...Object.values(ruleConfig));
                } else if (ruleConfig !== false) {
                    isValid = ruleFunction(value, ruleConfig);
                }

                if (isValid === false) {
                    errors.push(this.getValidationMessage(field, ruleName, ruleConfig));
                }
            }
        }

        // Apply custom validators
        if (field.customValidators) {
            field.customValidators.forEach(validatorName => {
                const validator = this.customValidators.get(validatorName);
                if (validator) {
                    const result = validator(value, field, context);
                    if (!result.isValid) {
                        errors.push(result.message || `Custom validation failed: ${validatorName}`);
                    }
                }
            });
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    validateReport(reportDefinition, data) {
        const validationResults = {
            isValid: true,
            fieldResults: {},
            globalErrors: [],
            warnings: []
        };

        // Validate each field
        reportDefinition.fields.forEach(field => {
            const fieldValue = data[field.id];
            const result = this.validateField(field, fieldValue, { reportDefinition, data });

            validationResults.fieldResults[field.id] = result;

            if (!result.isValid) {
                validationResults.isValid = false;
            }

            validationResults.warnings.push(...result.warnings);
        });

        // Validate calculated fields
        if (reportDefinition.calculatedFields) {
            reportDefinition.calculatedFields.forEach(calcField => {
                const result = this.validateCalculatedField(calcField, data, reportDefinition.fields);
                validationResults.fieldResults[calcField.id] = result;

                if (!result.isValid) {
                    validationResults.isValid = false;
                }
            });
        }

        // Validate field dependencies
        const dependencyResult = this.validateFieldDependencies(reportDefinition);
        if (!dependencyResult.isValid) {
            validationResults.isValid = false;
            validationResults.globalErrors.push(...dependencyResult.errors);
        }

        return validationResults;
    }

    validateCalculatedField(calculatedField, data, baseFields) {
        const errors = [];

        // Validate formula syntax
        const syntaxResult = this.validateFormulaSyntax(calculatedField.formula);
        if (!syntaxResult.isValid) {
            errors.push(`Formula syntax error: ${syntaxResult.message}`);
        }

        // Validate field dependencies
        const dependencies = this.extractFormulaDependencies(calculatedField.formula);
        const availableFields = baseFields.map(f => f.id);

        dependencies.forEach(dep => {
            if (!availableFields.includes(dep)) {
                errors.push(`Unknown field reference in formula: ${dep}`);
            }
        });

        // Test formula execution with sample data
        try {
            this.evaluateFormula(calculatedField.formula, data);
        } catch (error) {
            errors.push(`Formula execution error: ${error.message}`);
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    validateFieldDependencies(reportDefinition) {
        const errors = [];
        const fieldIds = reportDefinition.fields.map(f => f.id);

        // Check for circular dependencies in calculated fields
        if (reportDefinition.calculatedFields) {
            const dependencyGraph = this.buildDependencyGraph(reportDefinition.calculatedFields);
            const circularDeps = this.detectCircularDependencies(dependencyGraph);

            if (circularDeps.length > 0) {
                errors.push(`Circular dependencies detected: ${circularDeps.join(', ')}`);
            }
        }

        // Validate filter dependencies
        if (reportDefinition.filters) {
            reportDefinition.filters.forEach(filter => {
                if (!fieldIds.includes(filter.fieldId)) {
                    errors.push(`Filter references unknown field: ${filter.fieldId}`);
                }
            });
        }

        // Validate grouping dependencies
        if (reportDefinition.groupBy) {
            reportDefinition.groupBy.forEach(groupField => {
                if (!fieldIds.includes(groupField)) {
                    errors.push(`Grouping references unknown field: ${groupField}`);
                }
            });
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Validation helper methods
    validateCurrencyFormat(value) {
        if (typeof value === 'number') return !isNaN(value);
        if (typeof value === 'string') {
            const cleanValue = value.replace(/[$,\s]/g, '');
            return !isNaN(parseFloat(cleanValue));
        }
        return false;
    }

    validatePercentageFormat(value) {
        const numValue = parseFloat(value);
        return !isNaN(numValue) && isFinite(numValue);
    }

    validateNumberRange(value, min, max) {
        return !isNaN(value) && value >= min && value <= max;
    }

    validateDateFormat(value) {
        const date = new Date(value);
        return date instanceof Date && !isNaN(date);
    }

    validateDateRange(value, startDate, endDate) {
        const date = new Date(value);
        const start = new Date(startDate);
        const end = new Date(endDate);
        return date >= start && date <= end;
    }

    validateEmailFormat(value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value);
    }

    validateFormulaSyntax(formula) {
        try {
            // Basic syntax validation - check for balanced parentheses
            const openParens = (formula.match(/\(/g) || []).length;
            const closeParens = (formula.match(/\)/g) || []).length;

            if (openParens !== closeParens) {
                return { isValid: false, message: 'Unbalanced parentheses' };
            }

            // Check for invalid characters
            const validChars = /^[a-zA-Z0-9_+\-*/().\s,]+$/;
            if (!validChars.test(formula)) {
                return { isValid: false, message: 'Invalid characters in formula' };
            }

            return { isValid: true };
        } catch (error) {
            return { isValid: false, message: error.message };
        }
    }

    validateFormulaDependencies(formula, availableFields) {
        const dependencies = this.extractFormulaDependencies(formula);
        const missingFields = dependencies.filter(dep => !availableFields.includes(dep));
        return missingFields.length === 0;
    }

    extractFormulaDependencies(formula) {
        const fieldPattern = /\b[a-zA-Z][a-zA-Z0-9_]*\b/g;
        const matches = formula.match(fieldPattern) || [];
        const keywords = ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX', 'IF', 'AND', 'OR', 'NOT'];
        return [...new Set(matches.filter(match => !keywords.includes(match.toUpperCase())))];
    }

    buildDependencyGraph(calculatedFields) {
        const graph = {};

        calculatedFields.forEach(field => {
            const dependencies = this.extractFormulaDependencies(field.formula);
            graph[field.id] = dependencies.filter(dep =>
                calculatedFields.some(cf => cf.id === dep)
            );
        });

        return graph;
    }

    detectCircularDependencies(graph) {
        const visited = new Set();
        const recursionStack = new Set();
        const circularDeps = [];

        const dfs = (node) => {
            visited.add(node);
            recursionStack.add(node);

            const neighbors = graph[node] || [];
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    if (dfs(neighbor)) {
                        circularDeps.push(`${neighbor} -> ${node}`);
                        return true;
                    }
                } else if (recursionStack.has(neighbor)) {
                    circularDeps.push(`${neighbor} -> ${node}`);
                    return true;
                }
            }

            recursionStack.delete(node);
            return false;
        };

        for (const node in graph) {
            if (!visited.has(node)) {
                dfs(node);
            }
        }

        return circularDeps;
    }

    evaluateFormula(formula, data) {
        // Simple formula evaluation - replace field references with values
        let evaluatedFormula = formula;

        for (const [fieldId, value] of Object.entries(data)) {
            const regex = new RegExp(`\\b${fieldId}\\b`, 'g');
            evaluatedFormula = evaluatedFormula.replace(regex, value || 0);
        }

        // Use Function constructor for safe evaluation
        try {
            return new Function('return ' + evaluatedFormula)();
        } catch (error) {
            throw new Error(`Formula evaluation failed: ${error.message}`);
        }
    }

    getValidationMessage(field, ruleName, ruleConfig) {
        const messages = {
            format: `${field.name} has invalid format`,
            range: `${field.name} is outside the allowed range`,
            minLength: `${field.name} is too short`,
            maxLength: `${field.name} is too long`,
            pattern: `${field.name} doesn't match the required pattern`,
            integer: `${field.name} must be a whole number`,
            positive: `${field.name} must be positive`,
            futureDate: `${field.name} must be a future date`,
            pastDate: `${field.name} must be a past date`,
            dateRange: `${field.name} is outside the allowed date range`,
            syntax: `${field.name} contains syntax errors`,
            dependencies: `${field.name} references unknown fields`
        };

        return messages[ruleName] || `${field.name} validation failed`;
    }

    getFieldValidationSchema(fieldType) {
        return this.validationRules.get(fieldType) || {};
    }

    getAllValidationRules() {
        const rules = {};
        for (const [type, typeRules] of this.validationRules) {
            rules[type] = Object.keys(typeRules);
        }
        return rules;
    }

    validateFieldConfiguration(fieldConfig) {
        const errors = [];

        if (!fieldConfig.id || typeof fieldConfig.id !== 'string') {
            errors.push('Field ID is required and must be a string');
        }

        if (!fieldConfig.name || typeof fieldConfig.name !== 'string') {
            errors.push('Field name is required and must be a string');
        }

        if (!fieldConfig.type || typeof fieldConfig.type !== 'string') {
            errors.push('Field type is required and must be a string');
        }

        if (!this.validationRules.has(fieldConfig.type)) {
            errors.push(`Unknown field type: ${fieldConfig.type}`);
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReportFieldValidator;
}