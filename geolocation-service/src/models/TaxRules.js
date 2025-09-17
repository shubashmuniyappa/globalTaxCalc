const mongoose = require('mongoose');

// Tax Bracket Sub-schema
const taxBracketSchema = new mongoose.Schema({
    rate: {
        type: Number,
        required: true,
        min: 0,
        max: 1,
        validate: {
            validator: function(v) {
                return v >= 0 && v <= 1;
            },
            message: 'Tax rate must be between 0 and 1'
        }
    },
    minIncome: {
        type: Number,
        required: true,
        min: 0
    },
    maxIncome: {
        type: Number,
        default: null, // null means no upper limit
        validate: {
            validator: function(v) {
                return v === null || v > this.minIncome;
            },
            message: 'Max income must be greater than min income'
        }
    },
    description: {
        type: String,
        default: ''
    }
}, { _id: false });

// Deduction Sub-schema
const deductionSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: ['standard', 'itemized', 'personal_allowance', 'basic_exemption']
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    filingStatus: {
        type: String,
        required: true,
        enum: ['single', 'married_filing_jointly', 'married_filing_separately', 'head_of_household', 'all']
    },
    description: {
        type: String,
        default: ''
    },
    conditions: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: new Map()
    }
}, { _id: false });

// Tax Credit Sub-schema
const taxCreditSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    refundable: {
        type: Boolean,
        default: false
    },
    phaseOutStart: {
        type: Number,
        default: null
    },
    phaseOutEnd: {
        type: Number,
        default: null
    },
    eligibilityRules: [{
        condition: String,
        value: mongoose.Schema.Types.Mixed
    }],
    description: {
        type: String,
        default: ''
    }
}, { _id: false });

// Social Insurance Sub-schema
const socialInsuranceSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: ['social_security', 'medicare', 'unemployment', 'disability', 'cpp', 'ei', 'national_insurance']
    },
    employeeRate: {
        type: Number,
        required: true,
        min: 0,
        max: 1
    },
    employerRate: {
        type: Number,
        required: true,
        min: 0,
        max: 1
    },
    wageBase: {
        type: Number,
        default: null // null means no wage base limit
    },
    description: {
        type: String,
        default: ''
    }
}, { _id: false });

// Federal Tax Rules Sub-schema
const federalTaxRulesSchema = new mongoose.Schema({
    taxBrackets: {
        single: [taxBracketSchema],
        marriedFilingJointly: [taxBracketSchema],
        marriedFilingSeparately: [taxBracketSchema],
        headOfHousehold: [taxBracketSchema]
    },
    deductions: [deductionSchema],
    credits: [taxCreditSchema],
    socialInsurance: [socialInsuranceSchema],
    alternativeMinimumTax: {
        enabled: { type: Boolean, default: false },
        exemption: { type: Number, default: 0 },
        rate: { type: Number, default: 0 }
    }
}, { _id: false });

// State/Provincial Tax Rules Sub-schema
const stateProvincialTaxRulesSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        uppercase: true,
        minlength: 2,
        maxlength: 3
    },
    name: {
        type: String,
        required: true
    },
    hasIncomeTax: {
        type: Boolean,
        default: true
    },
    taxBrackets: {
        single: [taxBracketSchema],
        marriedFilingJointly: [taxBracketSchema],
        marriedFilingSeparately: [taxBracketSchema],
        headOfHousehold: [taxBracketSchema]
    },
    deductions: [deductionSchema],
    credits: [taxCreditSchema],
    localTaxRates: [{
        city: String,
        county: String,
        rate: Number,
        description: String
    }]
}, { _id: false });

// Main Tax Rules Schema
const taxRulesSchema = new mongoose.Schema({
    country: {
        type: String,
        required: true,
        uppercase: true,
        minlength: 2,
        maxlength: 3,
        index: true
    },
    year: {
        type: Number,
        required: true,
        min: 2020,
        max: 2030,
        index: true
    },
    currency: {
        type: String,
        required: true,
        uppercase: true,
        length: 3
    },
    version: {
        type: String,
        required: true,
        default: '1.0.0'
    },
    effectiveDate: {
        type: Date,
        required: true
    },
    expirationDate: {
        type: Date,
        default: null
    },
    federal: federalTaxRulesSchema,
    statesProvinces: [stateProvincialTaxRulesSchema],
    metadata: {
        source: {
            type: String,
            default: ''
        },
        lastUpdated: {
            type: Date,
            default: Date.now
        },
        updateFrequency: {
            type: String,
            enum: ['manual', 'daily', 'weekly', 'monthly', 'yearly'],
            default: 'manual'
        },
        dataQuality: {
            type: String,
            enum: ['draft', 'verified', 'official'],
            default: 'draft'
        },
        notes: {
            type: String,
            default: ''
        }
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    createdBy: {
        type: String,
        default: 'system'
    },
    updatedBy: {
        type: String,
        default: 'system'
    }
}, {
    timestamps: true,
    versionKey: '__v'
});

// Compound indexes for efficient queries
taxRulesSchema.index({ country: 1, year: 1 }, { unique: true });
taxRulesSchema.index({ country: 1, year: 1, isActive: 1 });
taxRulesSchema.index({ effectiveDate: 1, expirationDate: 1 });
taxRulesSchema.index({ 'metadata.dataQuality': 1, isActive: 1 });

// Pre-save middleware to update timestamps
taxRulesSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Virtual for full country-year identifier
taxRulesSchema.virtual('identifier').get(function() {
    return `${this.country}-${this.year}`;
});

// Instance methods
taxRulesSchema.methods.getTaxBrackets = function(filingStatus, stateProvince = null) {
    let brackets = [];

    // Get federal brackets
    if (this.federal && this.federal.taxBrackets && this.federal.taxBrackets[filingStatus]) {
        brackets = this.federal.taxBrackets[filingStatus];
    }

    // Add state/provincial brackets if requested
    if (stateProvince && this.statesProvinces) {
        const state = this.statesProvinces.find(s => s.code === stateProvince.toUpperCase());
        if (state && state.taxBrackets && state.taxBrackets[filingStatus]) {
            return {
                federal: brackets,
                state: state.taxBrackets[filingStatus]
            };
        }
    }

    return { federal: brackets, state: [] };
};

taxRulesSchema.methods.getDeductions = function(filingStatus, stateProvince = null) {
    let deductions = [];

    // Get federal deductions
    if (this.federal && this.federal.deductions) {
        deductions = this.federal.deductions.filter(d =>
            d.filingStatus === filingStatus || d.filingStatus === 'all'
        );
    }

    // Add state deductions if requested
    if (stateProvince && this.statesProvinces) {
        const state = this.statesProvinces.find(s => s.code === stateProvince.toUpperCase());
        if (state && state.deductions) {
            const stateDeductions = state.deductions.filter(d =>
                d.filingStatus === filingStatus || d.filingStatus === 'all'
            );
            return {
                federal: deductions,
                state: stateDeductions
            };
        }
    }

    return { federal: deductions, state: [] };
};

taxRulesSchema.methods.isValid = function() {
    const now = new Date();
    return this.isActive &&
           this.effectiveDate <= now &&
           (this.expirationDate === null || this.expirationDate > now);
};

// Static methods
taxRulesSchema.statics.findByCountryYear = function(country, year) {
    return this.findOne({
        country: country.toUpperCase(),
        year: year,
        isActive: true
    });
};

taxRulesSchema.statics.findActiveRules = function() {
    return this.find({ isActive: true }).sort({ country: 1, year: -1 });
};

taxRulesSchema.statics.findLatestByCountry = function(country) {
    return this.findOne({
        country: country.toUpperCase(),
        isActive: true
    }).sort({ year: -1 });
};

// Export the model
module.exports = mongoose.model('TaxRules', taxRulesSchema);