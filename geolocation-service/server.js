require('dotenv').config();

const GeolocationApp = require('./src/app');
const logger = require('./src/config/logger');

// Create and start the application
const app = new GeolocationApp();

app.start()
    .catch((error) => {
        logger.error('Failed to start Geolocation & Tax Rules Service:', error);
        process.exit(1);
    });