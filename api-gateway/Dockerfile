# Multi-stage Dockerfile for production optimization
FROM node:18-alpine AS base

# Install build dependencies
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Development stage
FROM base AS development
RUN npm ci --include=dev
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Production dependencies stage
FROM base AS production-deps
RUN npm ci --only=production && npm cache clean --force

# Production build stage
FROM base AS production
ENV NODE_ENV=production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S apigateway -u 1001

# Copy production dependencies
COPY --from=production-deps /app/node_modules ./node_modules

# Copy application code
COPY --chown=apigateway:nodejs . .

# Create directories with proper permissions
RUN mkdir -p logs generated-docs && \
    chown -R apigateway:nodejs logs generated-docs

# Switch to non-root user
USER apigateway

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["node", "src/index.js"]