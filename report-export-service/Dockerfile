# Use Node.js 18 LTS as base image
FROM node:18-slim

# Install system dependencies for Puppeteer and Canvas
RUN apt-get update && apt-get install -y \
    # Puppeteer dependencies
    chromium \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    # Canvas dependencies
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    # Additional fonts for better PDF rendering
    fonts-noto \
    fonts-noto-color-emoji \
    fonts-dejavu-core \
    fonts-freefont-ttf \
    # Utilities
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p \
    /app/temp \
    /app/reports \
    /app/uploads \
    /app/logs \
    /app/assets/logos \
    /app/assets/fonts

# Set permissions
RUN chown -R node:node /app
RUN chmod +x /app/src/server.js

# Create non-root user for security
USER node

# Set environment variables
ENV NODE_ENV=production
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Expose port
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3003/health || exit 1

# Start the application
CMD ["node", "src/server.js"]