const mongoose = require('mongoose');

// Historical Rate Sub-schema
const historicalRateSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true,
        index: true
    },
    rate: {
        type: Number,
        required: true,
        min: 0
    },
    source: {
        type: String,
        default: 'unknown'
    }
}, { _id: false });

// Exchange Rate Statistics Sub-schema
const statisticsSchema = new mongoose.Schema({
    period: {
        type: String,
        enum: ['1d', '7d', '30d', '90d', '1y'],
        required: true
    },
    high: {
        type: Number,
        min: 0
    },
    low: {
        type: Number,
        min: 0
    },
    average: {
        type: Number,
        min: 0
    },
    volatility: {
        type: Number,
        min: 0,
        max: 100
    },
    change: {
        type: Number
    },
    changePercent: {
        type: Number
    }
}, { _id: false });

// Main Exchange Rates Schema
const exchangeRatesSchema = new mongoose.Schema({
    fromCurrency: {
        type: String,
        required: true,
        uppercase: true,
        length: 3,
        index: true
    },
    toCurrency: {
        type: String,
        required: true,
        uppercase: true,
        length: 3,
        index: true
    },
    rate: {
        type: Number,
        required: true,
        min: 0,
        index: true
    },
    inverseRate: {
        type: Number,
        required: true,
        min: 0
    },
    date: {
        type: Date,
        required: true,
        default: Date.now,
        index: true
    },
    source: {
        provider: {
            type: String,
            required: true,
            enum: ['ecb', 'fed', 'boc', 'rba', 'exchangerate-api', 'fixer', 'openexchangerates', 'manual'],
            default: 'exchangerate-api'
        },
        url: {
            type: String,
            default: ''
        },
        lastUpdate: {
            type: Date,
            default: Date.now
        },
        nextUpdate: {
            type: Date
        },
        reliability: {
            type: String,
            enum: ['high', 'medium', 'low'],
            default: 'medium'
        }
    },
    metadata: {
        bid: {
            type: Number,
            min: 0
        },
        ask: {
            type: Number,
            min: 0
        },
        spread: {
            type: Number,
            min: 0
        },
        volume: {
            type: Number,
            min: 0
        },
        marketCap: {
            type: Number,
            min: 0
        }
    },
    historicalRates: [historicalRateSchema],
    statistics: [statisticsSchema],
    validFrom: {
        type: Date,
        required: true,
        default: Date.now
    },
    validTo: {
        type: Date,
        default: null // null means currently valid
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    isCurrent: {
        type: Boolean,
        default: true,
        index: true
    },
    tags: [{
        type: String,
        enum: ['official', 'market', 'spot', 'forward', 'cross', 'major', 'minor', 'exotic']
    }],
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

// Compound indexes for efficient queries
exchangeRatesSchema.index({ fromCurrency: 1, toCurrency: 1 }, { unique: true });
exchangeRatesSchema.index({ fromCurrency: 1, toCurrency: 1, date: -1 });
exchangeRatesSchema.index({ fromCurrency: 1, toCurrency: 1, isCurrent: 1 });
exchangeRatesSchema.index({ date: -1, isActive: 1 });
exchangeRatesSchema.index({ 'source.provider': 1, isActive: 1 });
exchangeRatesSchema.index({ validFrom: 1, validTo: 1 });

// Pre-save middleware
exchangeRatesSchema.pre('save', function(next) {
    this.updatedAt = new Date();

    // Calculate inverse rate
    if (this.rate > 0) {
        this.inverseRate = 1 / this.rate;
    }

    // Calculate spread if bid and ask are available
    if (this.metadata.bid && this.metadata.ask) {
        this.metadata.spread = this.metadata.ask - this.metadata.bid;
    }

    next();
});

// Virtual properties
exchangeRatesSchema.virtual('currencyPair').get(function() {
    return `${this.fromCurrency}/${this.toCurrency}`;
});

exchangeRatesSchema.virtual('age').get(function() {
    return Date.now() - this.date.getTime();
});

exchangeRatesSchema.virtual('isStale').get(function() {
    const maxAge = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
    return this.age > maxAge;
});

// Instance methods
exchangeRatesSchema.methods.convert = function(amount) {
    return amount * this.rate;
};

exchangeRatesSchema.methods.convertInverse = function(amount) {
    return amount * this.inverseRate;
};

exchangeRatesSchema.methods.addHistoricalRate = function(date, rate, source = 'unknown') {
    // Avoid duplicates
    const existingIndex = this.historicalRates.findIndex(hr =>
        hr.date.toDateString() === date.toDateString()
    );

    if (existingIndex >= 0) {
        this.historicalRates[existingIndex].rate = rate;
        this.historicalRates[existingIndex].source = source;
    } else {
        this.historicalRates.push({ date, rate, source });
        // Keep only last 365 days
        this.historicalRates = this.historicalRates
            .sort((a, b) => b.date - a.date)
            .slice(0, 365);
    }

    // Recalculate statistics
    this.calculateStatistics();
};

exchangeRatesSchema.methods.calculateStatistics = function() {
    if (this.historicalRates.length === 0) return;

    const periods = [
        { key: '1d', days: 1 },
        { key: '7d', days: 7 },
        { key: '30d', days: 30 },
        { key: '90d', days: 90 },
        { key: '1y', days: 365 }
    ];

    this.statistics = [];

    periods.forEach(period => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - period.days);

        const periodRates = this.historicalRates
            .filter(hr => hr.date >= cutoffDate)
            .map(hr => hr.rate);

        if (periodRates.length > 0) {
            const high = Math.max(...periodRates);
            const low = Math.min(...periodRates);
            const average = periodRates.reduce((sum, rate) => sum + rate, 0) / periodRates.length;

            // Calculate volatility (standard deviation)
            const variance = periodRates.reduce((sum, rate) => sum + Math.pow(rate - average, 2), 0) / periodRates.length;
            const volatility = Math.sqrt(variance) / average * 100;

            // Calculate change
            const firstRate = periodRates[periodRates.length - 1];
            const lastRate = periodRates[0];
            const change = lastRate - firstRate;
            const changePercent = (change / firstRate) * 100;

            this.statistics.push({
                period: period.key,
                high,
                low,
                average,
                volatility,
                change,
                changePercent
            });
        }
    });
};

exchangeRatesSchema.methods.getStatistics = function(period) {
    return this.statistics.find(stat => stat.period === period);
};

exchangeRatesSchema.methods.isValid = function() {
    const now = new Date();
    return this.isActive &&
           this.validFrom <= now &&
           (this.validTo === null || this.validTo > now);
};

// Static methods
exchangeRatesSchema.statics.findCurrentRate = function(fromCurrency, toCurrency) {
    return this.findOne({
        fromCurrency: fromCurrency.toUpperCase(),
        toCurrency: toCurrency.toUpperCase(),
        isCurrent: true,
        isActive: true
    });
};

exchangeRatesSchema.statics.findRateByDate = function(fromCurrency, toCurrency, date) {
    return this.findOne({
        fromCurrency: fromCurrency.toUpperCase(),
        toCurrency: toCurrency.toUpperCase(),
        date: {
            $lte: date
        },
        isActive: true
    }).sort({ date: -1 });
};

exchangeRatesSchema.statics.findMajorCurrencies = function() {
    const majorCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD'];
    return this.find({
        fromCurrency: { $in: majorCurrencies },
        toCurrency: { $in: majorCurrencies },
        isCurrent: true,
        isActive: true
    });
};

exchangeRatesSchema.statics.findByCurrency = function(currency) {
    const upperCurrency = currency.toUpperCase();
    return this.find({
        $or: [
            { fromCurrency: upperCurrency },
            { toCurrency: upperCurrency }
        ],
        isCurrent: true,
        isActive: true
    });
};

exchangeRatesSchema.statics.findStaleRates = function(maxAgeHours = 6) {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - maxAgeHours);

    return this.find({
        date: { $lt: cutoffDate },
        isCurrent: true,
        isActive: true
    });
};

exchangeRatesSchema.statics.convertAmount = async function(amount, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) {
        return amount;
    }

    // Try direct conversion
    let rate = await this.findCurrentRate(fromCurrency, toCurrency);
    if (rate) {
        return rate.convert(amount);
    }

    // Try inverse conversion
    rate = await this.findCurrentRate(toCurrency, fromCurrency);
    if (rate) {
        return rate.convertInverse(amount);
    }

    // Try via USD
    if (fromCurrency !== 'USD' && toCurrency !== 'USD') {
        const toUSD = await this.convertAmount(amount, fromCurrency, 'USD');
        if (toUSD !== null) {
            return await this.convertAmount(toUSD, 'USD', toCurrency);
        }
    }

    throw new Error(`No exchange rate found for ${fromCurrency} to ${toCurrency}`);
};

exchangeRatesSchema.statics.updateRates = async function(ratesData, source = 'api') {
    const updates = [];

    for (const [currencyPair, rate] of Object.entries(ratesData)) {
        const [fromCurrency, toCurrency] = currencyPair.split('/');

        // Mark old rate as not current
        await this.updateMany(
            {
                fromCurrency: fromCurrency.toUpperCase(),
                toCurrency: toCurrency.toUpperCase(),
                isCurrent: true
            },
            { isCurrent: false }
        );

        // Create new rate
        const newRate = new this({
            fromCurrency: fromCurrency.toUpperCase(),
            toCurrency: toCurrency.toUpperCase(),
            rate: parseFloat(rate),
            source: { provider: source },
            isCurrent: true
        });

        updates.push(newRate.save());
    }

    return Promise.all(updates);
};

// Export the model
module.exports = mongoose.model('ExchangeRates', exchangeRatesSchema);