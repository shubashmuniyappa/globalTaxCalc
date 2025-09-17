const mongoose = require('mongoose');

// Tax System Information Sub-schema
const taxSystemSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: ['progressive', 'flat', 'regressive', 'mixed'],
        default: 'progressive'
    },
    levels: {
        type: [String],
        required: true,
        enum: ['federal', 'state', 'provincial', 'local', 'municipal'],
        default: ['federal']
    },
    filingStatuses: {
        type: [String],
        required: true,
        enum: ['single', 'married_filing_jointly', 'married_filing_separately', 'head_of_household'],
        default: ['single']
    },
    taxYear: {
        type: String,
        enum: ['calendar', 'fiscal_april', 'fiscal_july'],
        default: 'calendar'
    },
    features: {
        hasStateTax: { type: Boolean, default: false },
        hasLocalTax: { type: Boolean, default: false },
        hasSocialSecurity: { type: Boolean, default: true },
        hasUnemploymentTax: { type: Boolean, default: true },
        hasCapitalGainsTax: { type: Boolean, default: true },
        hasInheritanceTax: { type: Boolean, default: false },
        hasWealthTax: { type: Boolean, default: false },
        hasVAT: { type: Boolean, default: false },
        hasSalesTax: { type: Boolean, default: false }
    }
}, { _id: false });

// Currency Information Sub-schema
const currencySchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        uppercase: true,
        length: 3
    },
    name: {
        type: String,
        required: true
    },
    symbol: {
        type: String,
        required: true
    },
    decimals: {
        type: Number,
        default: 2,
        min: 0,
        max: 8
    }
}, { _id: false });

// Geographic Information Sub-schema
const geographicSchema = new mongoose.Schema({
    continent: {
        type: String,
        required: true,
        enum: ['North America', 'South America', 'Europe', 'Asia', 'Africa', 'Australia', 'Antarctica']
    },
    region: {
        type: String,
        default: ''
    },
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
    timeZones: [{
        zone: String,
        offset: String,
        dst: Boolean
    }],
    neighbors: [{
        countryCode: String,
        countryName: String
    }]
}, { _id: false });

// Government Information Sub-schema
const governmentSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['federal_republic', 'constitutional_monarchy', 'republic', 'monarchy', 'federation'],
        default: 'republic'
    },
    taxAuthority: {
        name: { type: String, required: true },
        website: { type: String, default: '' },
        apiEndpoint: { type: String, default: '' },
        contact: {
            phone: String,
            email: String,
            address: String
        }
    },
    fiscalYear: {
        start: {
            month: { type: Number, min: 1, max: 12, default: 1 },
            day: { type: Number, min: 1, max: 31, default: 1 }
        },
        end: {
            month: { type: Number, min: 1, max: 12, default: 12 },
            day: { type: Number, min: 1, max: 31, default: 31 }
        }
    },
    languages: {
        official: [String],
        common: [String]
    }
}, { _id: false });

// Economic Information Sub-schema
const economicSchema = new mongoose.Schema({
    gdpPerCapita: {
        type: Number,
        min: 0
    },
    gdpGrowthRate: {
        type: Number
    },
    inflationRate: {
        type: Number
    },
    unemploymentRate: {
        type: Number,
        min: 0,
        max: 100
    },
    corporateTaxRate: {
        type: Number,
        min: 0,
        max: 100
    },
    vatRate: {
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
        }
    }
}, { _id: false });

// Main Countries Schema
const countriesSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        minlength: 2,
        maxlength: 3,
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
    alpha2Code: {
        type: String,
        required: true,
        uppercase: true,
        length: 2,
        index: true
    },
    alpha3Code: {
        type: String,
        required: true,
        uppercase: true,
        length: 3,
        index: true
    },
    numericCode: {
        type: String,
        length: 3
    },
    currency: currencySchema,
    taxSystem: taxSystemSchema,
    geographic: geographicSchema,
    government: governmentSchema,
    economic: economicSchema,
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
    flags: {
        svg: String,
        png: String,
        emoji: String
    },
    metadata: {
        population: {
            type: Number,
            min: 0
        },
        area: {
            type: Number,
            min: 0
        },
        capital: String,
        callingCode: String,
        internetTLD: String,
        iso3166: {
            alpha2: String,
            alpha3: String,
            numeric: String
        },
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

// Indexes
countriesSchema.index({ 'taxSystem.type': 1, isSupported: 1 });
countriesSchema.index({ 'geographic.continent': 1, isActive: 1 });
countriesSchema.index({ supportLevel: 1, isActive: 1 });
countriesSchema.index({ 'currency.code': 1 });

// Pre-save middleware
countriesSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    this.metadata.lastUpdated = new Date();
    next();
});

// Virtual properties
countriesSchema.virtual('displayName').get(function() {
    return this.name;
});

countriesSchema.virtual('hasFullSupport').get(function() {
    return this.isSupported && this.supportLevel === 'full';
});

// Instance methods
countriesSchema.methods.getSupportedYears = function() {
    return this.supportedTaxYears
        .filter(year => year.status === 'active')
        .map(year => year.year)
        .sort((a, b) => b - a);
};

countriesSchema.methods.isTaxYearSupported = function(year) {
    return this.supportedTaxYears.some(ty =>
        ty.year === year && ty.status === 'active'
    );
};

countriesSchema.methods.getCurrencyInfo = function() {
    return {
        code: this.currency.code,
        name: this.currency.name,
        symbol: this.currency.symbol,
        decimals: this.currency.decimals
    };
};

countriesSchema.methods.getTaxSystemInfo = function() {
    return {
        type: this.taxSystem.type,
        levels: this.taxSystem.levels,
        filingStatuses: this.taxSystem.filingStatuses,
        features: this.taxSystem.features
    };
};

// Static methods
countriesSchema.statics.findSupported = function() {
    return this.find({ isSupported: true, isActive: true })
        .sort({ name: 1 });
};

countriesSchema.statics.findByCode = function(code) {
    const upperCode = code.toUpperCase();
    return this.findOne({
        $or: [
            { code: upperCode },
            { alpha2Code: upperCode },
            { alpha3Code: upperCode }
        ],
        isActive: true
    });
};

countriesSchema.statics.findByCurrency = function(currencyCode) {
    return this.find({
        'currency.code': currencyCode.toUpperCase(),
        isActive: true
    });
};

countriesSchema.statics.findByContinent = function(continent) {
    return this.find({
        'geographic.continent': continent,
        isActive: true
    }).sort({ name: 1 });
};

countriesSchema.statics.findByTaxSystemType = function(type) {
    return this.find({
        'taxSystem.type': type,
        isActive: true
    }).sort({ name: 1 });
};

countriesSchema.statics.searchByName = function(query) {
    const regex = new RegExp(query, 'i');
    return this.find({
        $or: [
            { name: regex },
            { officialName: regex },
            { nativeName: regex }
        ],
        isActive: true
    }).sort({ name: 1 });
};

// Export the model
module.exports = mongoose.model('Countries', countriesSchema);