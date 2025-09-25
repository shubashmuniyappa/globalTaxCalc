const responseTime = require('response-time');
const onFinished = require('on-finished');
const { recordHttpRequest } = require('./prometheus');

const createMetricsMiddleware = () => {
  return responseTime((req, res, time) => {
    const route = req.route?.path || req.path || 'unknown';
    const method = req.method;
    const statusCode = res.statusCode;
    const duration = time / 1000;

    recordHttpRequest(method, route, statusCode, duration);
  });
};

const createRequestLogger = () => {
  return (req, res, next) => {
    const startTime = Date.now();

    onFinished(res, (err, res) => {
      const duration = (Date.now() - startTime) / 1000;
      const route = req.route?.path || req.path || 'unknown';
      const method = req.method;
      const statusCode = res.statusCode;

      recordHttpRequest(method, route, statusCode, duration);

      if (err) {
        console.error(`Request finished with error: ${err.message}`, {
          method,
          route,
          statusCode,
          duration,
          error: err.message
        });
      }
    });

    next();
  };
};

const createDbMetricsWrapper = (dbClient, database = 'default') => {
  const originalQuery = dbClient.query;

  dbClient.query = function(sql, params, callback) {
    const startTime = Date.now();
    const queryType = sql.trim().split(' ')[0].toUpperCase();
    let table = 'unknown';

    try {
      const tableMatch = sql.match(/FROM\s+(\w+)|INTO\s+(\w+)|UPDATE\s+(\w+)|DELETE\s+FROM\s+(\w+)/i);
      if (tableMatch) {
        table = tableMatch[1] || tableMatch[2] || tableMatch[3] || tableMatch[4];
      }
    } catch (e) {
      console.warn('Could not extract table name from query');
    }

    const wrappedCallback = function(err, result) {
      const duration = (Date.now() - startTime) / 1000;
      const { recordDbQuery } = require('./prometheus');

      recordDbQuery(queryType, table, 'execute', duration, database);

      if (callback) {
        callback(err, result);
      }
    };

    if (typeof params === 'function') {
      return originalQuery.call(this, sql, wrappedCallback);
    } else {
      return originalQuery.call(this, sql, params, wrappedCallback);
    }
  };

  return dbClient;
};

const createBusinessMetricsWrapper = () => {
  const { recordBusinessCalculation, recordBusinessConversion, updateBusinessRevenue } = require('./prometheus');

  return {
    recordCalculation: (type, country, success = true) => {
      recordBusinessCalculation(type, country, success);
    },

    recordConversion: (type, source, country) => {
      recordBusinessConversion(type, source, country);
    },

    updateRevenue: (amount, currency = 'USD', subscriptionType = 'premium', country = 'US') => {
      updateBusinessRevenue(amount, currency, subscriptionType, country);
    }
  };
};

module.exports = {
  createMetricsMiddleware,
  createRequestLogger,
  createDbMetricsWrapper,
  createBusinessMetricsWrapper
};