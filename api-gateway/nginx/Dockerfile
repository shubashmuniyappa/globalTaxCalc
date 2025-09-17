# NGINX Dockerfile for production reverse proxy
FROM nginx:alpine

# Install additional packages for security and monitoring
RUN apk add --no-cache \
    openssl \
    certbot \
    certbot-nginx \
    curl \
    logrotate

# Create necessary directories
RUN mkdir -p /etc/nginx/ssl \
    /var/www/certbot \
    /var/log/nginx \
    /etc/nginx/conf.d

# Copy NGINX configuration
COPY nginx.conf /etc/nginx/nginx.conf
COPY default.conf /etc/nginx/conf.d/default.conf

# Copy SSL configuration (if exists)
COPY ssl/ /etc/nginx/ssl/ 2>/dev/null || true

# Create self-signed certificates for development
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/default.key \
    -out /etc/nginx/ssl/default.crt \
    -subj "/C=US/ST=State/L=City/O=GlobalTaxCalc/OU=IT/CN=localhost"

# Copy custom error pages
COPY error-pages/ /usr/share/nginx/html/errors/ 2>/dev/null || true

# Copy logrotate configuration
COPY logrotate.conf /etc/logrotate.d/nginx

# Set permissions
RUN chown -R nginx:nginx /var/log/nginx /etc/nginx/ssl /var/www/certbot

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

EXPOSE 80 443

# Use custom entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]