# GlobalTaxCalc Development Environment Setup Script for Windows
# PowerShell version of setup script

param(
    [switch]$SkipDependencies,
    [switch]$SkipDatabases
)

# Colors for output
$colors = @{
    Red = "Red"
    Green = "Green"
    Yellow = "Yellow"
    Blue = "Blue"
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor $colors.Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor $colors.Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor $colors.Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $colors.Red
}

# Check if command exists
function Test-Command {
    param([string]$CommandName)
    try {
        Get-Command $CommandName -ErrorAction Stop | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

# Check prerequisites
function Test-Prerequisites {
    Write-Info "Checking prerequisites..."

    $missingDeps = @()

    if (!(Test-Command "docker")) {
        $missingDeps += "docker"
    }

    if (!(Test-Command "docker-compose")) {
        $missingDeps += "docker-compose"
    }

    if (!(Test-Command "git")) {
        $missingDeps += "git"
    }

    if (!(Test-Command "node")) {
        $missingDeps += "node"
    }
    else {
        $nodeVersion = (node --version).Replace("v", "")
        $requiredVersion = [version]"18.0.0"
        $currentVersion = [version]$nodeVersion
        if ($currentVersion -lt $requiredVersion) {
            Write-Warning "Node.js version $nodeVersion found, but v18+ is recommended"
        }
    }

    if (!(Test-Command "python")) {
        $missingDeps += "python"
    }
    else {
        $pythonVersion = (python --version).Split(" ")[1]
        $requiredVersion = [version]"3.11.0"
        $currentVersion = [version]$pythonVersion
        if ($currentVersion -lt $requiredVersion) {
            Write-Warning "Python version $pythonVersion found, but v3.11+ is recommended"
        }
    }

    if ($missingDeps.Count -gt 0) {
        Write-Error "Missing required dependencies: $($missingDeps -join ', ')"
        Write-Info "Please install the missing dependencies and run this script again."
        exit 1
    }

    Write-Success "All prerequisites met!"
}

# Generate random JWT secret
function New-JwtSecret {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($bytes)
    return [Convert]::ToBase64String($bytes)
}

# Create environment files
function New-Environment {
    Write-Info "Setting up environment files..."

    if (!(Test-Path ".env")) {
        $jwtSecret = New-JwtSecret

        $envContent = @"
# Database URLs
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/globaltaxcalc
MONGODB_URL=mongodb://mongo:mongo@localhost:27017/globaltaxcalc
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=$jwtSecret
JWT_EXPIRES_IN=7d
JWT_COOKIE_EXPIRES_IN=7

# Environment
NODE_ENV=development
PYTHON_ENV=development
LOG_LEVEL=info

# API Keys (Add your keys here)
OPENAI_API_KEY=your-openai-api-key-here
GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here

# Email Configuration
EMAIL_FROM=noreply@globaltaxcalc.com
SENDGRID_API_KEY=your-sendgrid-api-key-here

# AWS Configuration
AWS_ACCESS_KEY_ID=your-aws-access-key-here
AWS_SECRET_ACCESS_KEY=your-aws-secret-key-here
AWS_REGION=us-east-1
AWS_S3_BUCKET=globaltaxcalc-files

# SMS Configuration
TWILIO_ACCOUNT_SID=your-twilio-sid-here
TWILIO_AUTH_TOKEN=your-twilio-token-here

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# Service URLs
API_GATEWAY_URL=http://localhost:3000
AUTH_SERVICE_URL=http://localhost:3001
TAX_ENGINE_URL=http://localhost:8000
GEOLOCATION_SERVICE_URL=http://localhost:3002
AI_SERVICE_URL=http://localhost:8001

# CORS
CORS_ORIGIN=http://localhost:3009

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3000
"@

        Set-Content -Path ".env" -Value $envContent
        Write-Success "Created .env file"
    }
    else {
        Write-Warning ".env file already exists, skipping..."
    }
}

# Install Node.js dependencies
function Install-NodeDependencies {
    if ($SkipDependencies) {
        Write-Info "Skipping Node.js dependencies installation"
        return
    }

    Write-Info "Installing Node.js dependencies..."

    $nodeServices = @(
        "api-gateway",
        "auth-service",
        "geolocation-service",
        "content-service",
        "analytics-service",
        "notification-service",
        "ad-service",
        "file-service",
        "monitoring-service",
        "frontend"
    )

    foreach ($service in $nodeServices) {
        if ((Test-Path $service) -and (Test-Path "$service\package.json")) {
            Write-Info "Installing dependencies for $service..."
            Push-Location $service
            try {
                npm install
                Write-Success "Dependencies installed for $service"
            }
            catch {
                Write-Warning "Failed to install dependencies for $service"
            }
            finally {
                Pop-Location
            }
        }
        else {
            Write-Warning "Skipping $service (directory or package.json not found)"
        }
    }
}

# Install Python dependencies
function Install-PythonDependencies {
    if ($SkipDependencies) {
        Write-Info "Skipping Python dependencies installation"
        return
    }

    Write-Info "Installing Python dependencies..."

    $pythonServices = @(
        "tax-engine",
        "ai-service",
        "report-service"
    )

    foreach ($service in $pythonServices) {
        if ((Test-Path $service) -and (Test-Path "$service\requirements.txt")) {
            Write-Info "Installing dependencies for $service..."
            Push-Location $service

            try {
                # Create virtual environment if it doesn't exist
                if (!(Test-Path "venv")) {
                    python -m venv venv
                }

                # Activate virtual environment and install dependencies
                & "venv\Scripts\Activate.ps1"
                python -m pip install --upgrade pip
                pip install -r requirements.txt
                deactivate

                Write-Success "Dependencies installed for $service"
            }
            catch {
                Write-Warning "Failed to install dependencies for $service"
            }
            finally {
                Pop-Location
            }
        }
        else {
            Write-Warning "Skipping $service (directory or requirements.txt not found)"
        }
    }
}

# Create log directories
function New-LogDirectories {
    Write-Info "Creating log directories..."

    $services = @(
        "api-gateway", "auth-service", "tax-engine", "geolocation-service",
        "ai-service", "content-service", "analytics-service", "notification-service",
        "ad-service", "file-service", "report-service", "monitoring-service"
    )

    foreach ($service in $services) {
        if (Test-Path $service) {
            $logPath = Join-Path $service "logs"
            if (!(Test-Path $logPath)) {
                New-Item -ItemType Directory -Path $logPath -Force | Out-Null
            }
        }
    }

    Write-Success "Log directories created"
}

# Setup databases with Docker
function Initialize-Databases {
    if ($SkipDatabases) {
        Write-Info "Skipping database setup"
        return
    }

    Write-Info "Setting up databases with Docker..."

    # Check if Docker is running
    try {
        docker info | Out-Null
    }
    catch {
        Write-Error "Docker is not running. Please start Docker and try again."
        exit 1
    }

    # Start only database services
    docker-compose up -d postgres mongodb redis

    Write-Info "Waiting for databases to be ready..."
    Start-Sleep 10

    # Check if PostgreSQL is ready
    $maxAttempts = 30
    $attempt = 1

    while ($attempt -le $maxAttempts) {
        try {
            docker-compose exec -T postgres pg_isready -U postgres | Out-Null
            Write-Success "PostgreSQL is ready"
            break
        }
        catch {
            Write-Info "Waiting for PostgreSQL... (attempt $attempt/$maxAttempts)"
            Start-Sleep 2
            $attempt++
        }
    }

    if ($attempt -gt $maxAttempts) {
        Write-Error "PostgreSQL failed to start after $maxAttempts attempts"
        exit 1
    }

    Write-Success "Databases are ready!"
}

# Create development scripts
function New-DevScripts {
    Write-Info "Creating development scripts..."

    # Ensure scripts directory exists
    if (!(Test-Path "scripts")) {
        New-Item -ItemType Directory -Path "scripts" | Out-Null
    }

    # Create start script
    $startScript = @'
# Start GlobalTaxCalc development environment
Write-Host "Starting GlobalTaxCalc development environment..."

# Start databases first
docker-compose up -d postgres mongodb redis

Write-Host "Waiting for databases..."
Start-Sleep 5

# Start all services
docker-compose up api-gateway auth-service tax-engine geolocation-service ai-service content-service analytics-service notification-service ad-service file-service report-service monitoring-service frontend
'@

    Set-Content -Path "scripts\start-dev.ps1" -Value $startScript

    # Create stop script
    $stopScript = @'
# Stop GlobalTaxCalc development environment
Write-Host "Stopping GlobalTaxCalc development environment..."
docker-compose down
'@

    Set-Content -Path "scripts\stop-dev.ps1" -Value $stopScript

    Write-Success "Development scripts created"
}

# Main setup function
function Start-Setup {
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host "    GlobalTaxCalc Development Environment Setup" -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host ""

    Test-Prerequisites
    New-Environment
    New-LogDirectories
    Install-NodeDependencies
    Install-PythonDependencies
    Initialize-Databases
    New-DevScripts

    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Success "Setup completed successfully!"
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Edit .env file with your API keys and configuration"
    Write-Host "2. Start the development environment:"
    Write-Host "   .\scripts\start-dev.ps1"
    Write-Host ""
    Write-Host "3. Access the application:"
    Write-Host "   - Frontend: http://localhost:3009"
    Write-Host "   - API Gateway: http://localhost:3000"
    Write-Host "   - Monitoring: http://localhost:3008"
    Write-Host ""
    Write-Host "4. Stop the environment:"
    Write-Host "   .\scripts\stop-dev.ps1"
    Write-Host ""
    Write-Host "For more information, see README.md"
    Write-Host "=================================================="
}

# Run main setup
Start-Setup