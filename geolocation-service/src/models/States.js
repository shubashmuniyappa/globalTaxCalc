const mongoose = require('mongoose');

// Local Tax Rate Sub-schema
const localTaxRateSchema = new mongoose.Schema({
    jurisdictionType: {
        type: String,
        required: true,
        enum: ['city', 'county', 'municipality', 'district', 'region']
    },
    name: {
        type: String,
        required: true
    },
    code: {
        type: String,
        default: ''
    },
    taxType: {
        type: String,
        required: true,
        enum: ['income', 'sales', 'property', 'business', 'payroll', 'other']
    },
    rate: {
        type: Number,
        required: true,
        min: 0,
        max: 1
    },
    flatAmount: {
        type: Number,
        default: null,
        min: 0
    },
    description: {
        type: String,
        default: ''
    },
    effectiveDate: {
        type: Date,
        required: true
    },
    expirationDate: {
        type: Date,
        default: null
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { _id: false });

// Tax Rules Reference Sub-schema
const taxRulesReferenceSchema = new mongoose.Schema({
    year: {
        type: Number,
        required: true,
        min: 2020,
        max: 2030
    },
    hasIncomeTax: {
        type: Boolean,
        default: true
    },
    incomeTaxRate: {
        flat: { type: Number, min: 0, max: 1 },
        brackets: [{
            rate: { type: Number, required: true, min: 0, max: 1 },
            minIncome: { type: Number, required: true, min: 0 },
            maxIncome: { type: Number, default: null }
        }]
    },
    hasSalesTax: {
        type: Boolean,
        default: true
    },
    salesTaxRate: {
        type: Number,
        min: 0,
        max: 1,
        default: 0
    },
    hasPropertyTax: {
        type: Boolean,
        default: true
    },
    propertyTaxRate: {
        type: Number,
        min: 0,
        max: 1,
        default: 0
    },
    deductions: [{
        type: {
            type: String,
            enum: ['standard', 'itemized', 'personal']
        },
        amount: Number,
        filingStatus: String
    }],
    credits: [{
        name: String,
        amount: Number,
        refundable: Boolean,
        conditions: Map
    }],
    isActive: {
        type: Boolean,
        default: true
    }
}, { _id: false });

// Geographic Information Sub-schema
const geographicInfoSchema = new mongoose.Schema({
    coordinates: {
        latitude: {
            type: Number,
            min: -90,
            max: 90
        },
        longitude: {
            type: Number,
            min: -180,
            max: 180
        }
    },
    area: {
        type: Number,
        min: 0 // in square kilometers
    },
    population: {
        type: Number,
        min: 0
    },
    capital: {
        type: String,
        default: ''
    },
    majorCities: [{
        name: String,
        population: Number,
        isCapital: Boolean
    }],
    timeZone: {
        primary: String,
        others: [String]
    },
    borders: [String] // Array of neighboring state/province codes
}, { _id: false });

// Economic Information Sub-schema
const economicInfoSchema = new mongoose.Schema({
    gdp: {
        type: Number,
        min: 0
    },
    gdpPerCapita: {
        type: Number,
        min: 0
    },
    unemploymentRate: {
        type: Number,
        min: 0,
        max: 100
    },
    minimumWage: {
        amount: Number,
        period: {
            type: String,
            enum: ['hour', 'day', 'week', 'month', 'year'],
            default: 'hour'
        },
        effectiveDate: Date
    },
    costOfLivingIndex: {
        type: Number,
        min: 0
    },
    majorIndustries: [String]
}, { _id: false });

// Government Information Sub-schema
const governmentInfoSchema = new mongoose.Schema({
    governor: {
        name: String,
        party: String,
        termStart: Date,
        termEnd: Date
    },
    legislature: {
        type: {
            type: String,
            enum: ['unicameral', 'bicameral'],
            default: 'bicameral'
        },
        chambers: [{
            name: String,
            seats: Number,
            termLength: Number
        }]
    },
    taxDepartment: {
        name: String,
        website: String,
        phone: String,
        email: String,
        address: String
    },
    fiscalYear: {
        start: {
            month: { type: Number, min: 1, max: 12 },
            day: { type: Number, min: 1, max: 31 }
        },
        end: {
            month: { type: Number, min: 1, max: 12 },
            day: { type: Number, min: 1, max: 31 }
        }
    }
}, { _id: false });

// Main States Schema
const statesSchema = new mongoose.Schema({
    country: {
        type: String,
        required: true,
        uppercase: true,
        minlength: 2,
        maxlength: 3,
        index: true
    },
    code: {
        type: String,
        required: true,
        uppercase: true,
        minlength: 2,
        maxlength: 5,
        index: true
    },
    name: {
        type: String,
        required: true,
        index: true
    },
    officialName: {
        type: String,
        required: true
    },
    nativeName: {
        type: String,
        default: ''
    },
    type: {
        type: String,
        required: true,
        enum: ['state', 'province', 'territory', 'district', 'region', 'canton', 'county'],
        default: 'state'
    },
    abbreviation: {
        type: String,
        uppercase: true,
        maxlength: 10
    },
    postalCode: {
        type: String,
        uppercase: true,
        maxlength: 5
    },
    taxRules: [taxRulesReferenceSchema],
    localTaxRates: [localTaxRateSchema],
    geographic: geographicInfoSchema,
    economic: economicInfoSchema,
    government: governmentInfoSchema,
    isSupported: {
        type: Boolean,
        default: false,
        index: true
    },
    supportLevel: {
        type: String,
        enum: ['full', 'partial', 'basic', 'none'],
        default: 'none'
    },
    supportedTaxYears: [{
        year: {
            type: Number,
            min: 2020,
            max: 2030
        },
        status: {
            type: String,
            enum: ['active', 'deprecated', 'coming_soon'],
            default: 'active'
        }
    }],
    metadata: {
        fipsCode: String, // US FIPS code
        isoCode: String,  // ISO 3166-2 code
        geonameId: Number,
        lastUpdated: {
            type: Date,
            default: Date.now
        },
        dataSource: {
            type: String,
            default: 'manual'
        },
        version: {
            type: String,
            default: '1.0.0'
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
    }
}, {
    timestamps: true,
    versionKey: '__v'
});

// Compound indexes
statesSchema.index({ country: 1, code: 1 }, { unique: true });
statesSchema.index({ country: 1, name: 1 });
statesSchema.index({ country: 1, isSupported: 1 });
statesSchema.index({ country: 1, type: 1 });
statesSchema.index({ supportLevel: 1, isActive: 1 });

// Pre-save middleware
statesSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    this.metadata.lastUpdated = new Date();
    next();
});

// Virtual properties
statesSchema.virtual('fullCode').get(function() {
    return `${this.country}-${this.code}`;
});

statesSchema.virtual('displayName').get(function() {
    return `${this.name}, ${this.country}`;
});

statesSchema.virtual('hasFullSupport').get(function() {
    return this.isSupported && this.supportLevel === 'full';
});

// Instance methods
statesSchema.methods.getTaxRulesByYear = function(year) {
    return this.taxRules.find(tr => tr.year === year && tr.isActive);
};

statesSchema.methods.getSupportedYears = function() {
    return this.supportedTaxYears
        .filter(year => year.status === 'active')
        .map(year => year.year)
        .sort((a, b) => b - a);
};

statesSchema.methods.isTaxYearSupported = function(year) {
    return this.supportedTaxYears.some(ty =>
        ty.year === year && ty.status === 'active'
    );
};

statesSchema.methods.getLocalTaxRates = function(jurisdictionType = null, taxType = null) {
    let rates = this.localTaxRates.filter(rate => rate.isActive);

    if (jurisdictionType) {
        rates = rates.filter(rate => rate.jurisdictionType === jurisdictionType);
    }

    if (taxType) {
        rates = rates.filter(rate => rate.taxType === taxType);
    }

    return rates;
};

statesSchema.methods.getCombinedTaxRate = function(year, taxType = 'income') {
    const taxRules = this.getTaxRulesByYear(year);
    let rate = 0;

    if (taxRules) {
        switch (taxType) {
            case 'income':
                rate = taxRules.incomeTaxRate?.flat || 0;
                break;
            case 'sales':
                rate = taxRules.salesTaxRate || 0;
                break;
            case 'property':
                rate = taxRules.propertyTaxRate || 0;
                break;
        }
    }

    // Add local rates
    const localRates = this.getLocalTaxRates(null, taxType);
    const localTotal = localRates.reduce((sum, rate) => sum + rate.rate, 0);

    return rate + localTotal;
};

statesSchema.methods.hasIncomeTax = function(year) {
    const taxRules = this.getTaxRulesByYear(year);
    return taxRules ? taxRules.hasIncomeTax : false;
};

// Static methods
statesSchema.statics.findByCountry = function(country) {
    return this.find({
        country: country.toUpperCase(),
        isActive: true
    }).sort({ name: 1 });
};

statesSchema.statics.findSupportedByCountry = function(country) {
    return this.find({
        country: country.toUpperCase(),
        isSupported: true,
        isActive: true
    }).sort({ name: 1 });
};

statesSchema.statics.findByCode = function(country, code) {
    return this.findOne({
        country: country.toUpperCase(),
        code: code.toUpperCase(),
        isActive: true
    });
};

statesSchema.statics.findByName = function(country, name) {
    const regex = new RegExp(name, 'i');
    return this.find({
        country: country.toUpperCase(),
        $or: [
            { name: regex },
            { officialName: regex },
            { nativeName: regex }
        ],
        isActive: true
    }).sort({ name: 1 });
};

statesSchema.statics.findWithIncomeTax = function(country, year) {
    return this.find({
        country: country.toUpperCase(),
        'taxRules.year': year,
        'taxRules.hasIncomeTax': true,
        'taxRules.isActive': true,
        isActive: true
    }).sort({ name: 1 });
};

statesSchema.statics.searchByQuery = function(country, query) {
    const regex = new RegExp(query, 'i');
    return this.find({
        country: country.toUpperCase(),
        $or: [
            { name: regex },
            { officialName: regex },
            { code: regex },
            { abbreviation: regex }
        ],
        isActive: true
    }).sort({ name: 1 });
};

// Export the model
module.exports = mongoose.model('States', statesSchema);