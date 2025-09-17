#!/bin/sh

# NGINX Entrypoint Script
# Handles SSL certificate generation, configuration validation, and graceful startup

set -e

echo "Starting NGINX entrypoint..."

# Function to generate self-signed certificates for development
generate_dev_certs() {
    echo "Generating development SSL certificates..."

    # Create certificate for main domain
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/nginx/ssl/globaltaxcalc.com.key \
        -out /etc/nginx/ssl/globaltaxcalc.com.crt \
        -subj "/C=US/ST=State/L=City/O=GlobalTaxCalc/OU=IT/CN=globaltaxcalc.com" \
        -extensions v3_req \
        -config <(
            echo '[req]'
            echo 'distinguished_name = req_distinguished_name'
            echo 'req_extensions = v3_req'
            echo 'prompt = no'
            echo '[req_distinguished_name]'
            echo 'C = US'
            echo 'ST = State'
            echo 'L = City'
            echo 'O = GlobalTaxCalc'
            echo 'OU = IT'
            echo 'CN = globaltaxcalc.com'
            echo '[v3_req]'
            echo 'keyUsage = keyEncipherment, dataEncipherment'
            echo 'extendedKeyUsage = serverAuth'
            echo 'subjectAltName = @alt_names'
            echo '[alt_names]'
            echo 'DNS.1 = globaltaxcalc.com'
            echo 'DNS.2 = www.globaltaxcalc.com'
            echo 'DNS.3 = api.globaltaxcalc.com'
            echo 'DNS.4 = localhost'
        )

    # Copy for API subdomain
    cp /etc/nginx/ssl/globaltaxcalc.com.crt /etc/nginx/ssl/api.globaltaxcalc.com.crt
    cp /etc/nginx/ssl/globaltaxcalc.com.key /etc/nginx/ssl/api.globaltaxcalc.com.key
}

# Function to wait for services
wait_for_services() {
    echo "Waiting for backend services..."

    # Wait for API Gateway
    until curl -f http://api-gateway:3000/health 2>/dev/null; do
        echo "Waiting for API Gateway..."
        sleep 5
    done

    # Wait for Frontend
    until curl -f http://frontend:3009/health 2>/dev/null; do
        echo "Waiting for Frontend..."
        sleep 5
    done

    echo "Backend services are ready!"
}

# Function to validate NGINX configuration
validate_config() {
    echo "Validating NGINX configuration..."

    nginx -t

    if [ $? -eq 0 ]; then
        echo "NGINX configuration is valid"
    else
        echo "NGINX configuration is invalid!"
        exit 1
    fi
}

# Function to setup log rotation
setup_logrotate() {
    echo "Setting up log rotation..."

    cat > /etc/logrotate.d/nginx << EOF
/var/log/nginx/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 0644 nginx nginx
    postrotate
        if [ -f /var/run/nginx.pid ]; then
            nginx -s reload
        fi
    endscript
}
EOF
}

# Function to create custom error pages
create_error_pages() {
    echo "Creating custom error pages..."

    mkdir -p /usr/share/nginx/html/errors

    # 404 Error Page
    cat > /usr/share/nginx/html/errors/404.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Page Not Found - GlobalTaxCalc</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .error-code { font-size: 72px; color: #e74c3c; margin: 0; }
        .error-message { font-size: 24px; color: #2c3e50; margin: 20px 0; }
        .error-description { color: #7f8c8d; margin: 20px 0; }
        .back-link { display: inline-block; margin-top: 20px; padding: 10px 20px; background: #3498db; color: white; text-decoration: none; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <h1 class="error-code">404</h1>
        <h2 class="error-message">Page Not Found</h2>
        <p class="error-description">The page you're looking for doesn't exist or has been moved.</p>
        <a href="/" class="back-link">Go Home</a>
    </div>
</body>
</html>
EOF

    # 500 Error Page
    cat > /usr/share/nginx/html/errors/500.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Server Error - GlobalTaxCalc</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .error-code { font-size: 72px; color: #e74c3c; margin: 0; }
        .error-message { font-size: 24px; color: #2c3e50; margin: 20px 0; }
        .error-description { color: #7f8c8d; margin: 20px 0; }
        .back-link { display: inline-block; margin-top: 20px; padding: 10px 20px; background: #3498db; color: white; text-decoration: none; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <h1 class="error-code">500</h1>
        <h2 class="error-message">Internal Server Error</h2>
        <p class="error-description">Something went wrong on our end. Please try again later.</p>
        <a href="/" class="back-link">Go Home</a>
    </div>
</body>
</html>
EOF

    # 503 Error Page
    cat > /usr/share/nginx/html/errors/503.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Service Unavailable - GlobalTaxCalc</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .error-code { font-size: 72px; color: #f39c12; margin: 0; }
        .error-message { font-size: 24px; color: #2c3e50; margin: 20px 0; }
        .error-description { color: #7f8c8d; margin: 20px 0; }
        .back-link { display: inline-block; margin-top: 20px; padding: 10px 20px; background: #3498db; color: white; text-decoration: none; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <h1 class="error-code">503</h1>
        <h2 class="error-message">Service Unavailable</h2>
        <p class="error-description">We're currently experiencing high traffic. Please try again in a few minutes.</p>
        <a href="/" class="back-link">Go Home</a>
    </div>
</body>
</html>
EOF
}

# Function to create monitoring script
create_monitoring() {
    echo "Setting up monitoring script..."

    cat > /usr/local/bin/nginx-monitor.sh << 'EOF'
#!/bin/sh

# NGINX Monitoring Script
# Checks NGINX status and logs metrics

LOG_FILE="/var/log/nginx/monitor.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

# Check NGINX process
if ! pgrep nginx > /dev/null; then
    echo "[$DATE] ERROR: NGINX process not running" >> $LOG_FILE
    exit 1
fi

# Check NGINX configuration
if ! nginx -t 2>/dev/null; then
    echo "[$DATE] ERROR: NGINX configuration invalid" >> $LOG_FILE
    exit 1
fi

# Check upstream servers
if ! curl -f http://api-gateway:3000/health > /dev/null 2>&1; then
    echo "[$DATE] WARNING: API Gateway health check failed" >> $LOG_FILE
fi

if ! curl -f http://frontend:3009/health > /dev/null 2>&1; then
    echo "[$DATE] WARNING: Frontend health check failed" >> $LOG_FILE
fi

echo "[$DATE] INFO: All checks passed" >> $LOG_FILE
EOF

    chmod +x /usr/local/bin/nginx-monitor.sh
}

# Main execution
echo "Environment: ${ENVIRONMENT:-production}"

# Generate SSL certificates if not in production
if [ "${ENVIRONMENT}" != "production" ]; then
    generate_dev_certs
fi

# Setup error pages
create_error_pages

# Setup log rotation
setup_logrotate

# Setup monitoring
create_monitoring

# Validate configuration
validate_config

# Wait for backend services in development
if [ "${ENVIRONMENT}" = "development" ]; then
    wait_for_services
fi

echo "Starting NGINX..."

# Start log rotation daemon in background
crond

# Start monitoring in background
(while true; do
    /usr/local/bin/nginx-monitor.sh
    sleep 60
done) &

# Execute the main command
exec "$@"