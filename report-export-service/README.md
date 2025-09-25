# GlobalTaxCalc Report & Export Service

A comprehensive report generation and export service for GlobalTaxCalc.com that creates professional, branded tax reports with data visualizations and multi-format export capabilities.

## Features

- **PDF Report Generation**: Professional tax reports using Puppeteer and PDFKit
- **Data Visualization**: Interactive charts using Chart.js with tax bracket analysis, income breakdowns, and year-over-year comparisons
- **Multi-Format Export**: CSV, Excel, JSON, and bulk export capabilities
- **Multi-Language Support**: Localized reports in English, Spanish, French, German, and Italian
- **Branded Reports**: Customizable branding with logos, color schemes, and professional styling
- **Report Customization**: User-selectable sections, privacy options, and accessibility features
- **Template System**: Multiple report templates (Standard, Executive, Detailed, Minimal, Comparison)
- **Tier-Based Features**: Different feature sets for Free, Basic, Premium, and Enterprise users

## Tech Stack

- **Backend**: Node.js + Express.js
- **PDF Generation**: Puppeteer for HTML-to-PDF + PDFKit for programmatic PDFs
- **Charts**: Chart.js with Chart.js plugins for data visualization
- **Templates**: Handlebars for dynamic HTML templates
- **Export**: ExcelJS for Excel files, csv-writer for CSV, archiver for bulk exports
- **Localization**: i18next with filesystem backend
- **Security**: Helmet, CORS, rate limiting, API key authentication

## Quick Start

### Installation

```bash
# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit configuration
nano .env
```

### Configuration

Key environment variables in `.env`:

```bash
# Server
PORT=3003
NODE_ENV=development

# Branding
COMPANY_NAME="GlobalTaxCalc"
COMPANY_LOGO_PATH=./assets/logos/company-logo.png
DEFAULT_BRAND_COLOR=#2563eb

# Localization
DEFAULT_LANGUAGE=en
SUPPORTED_LANGUAGES=en,es,fr,de,it
DEFAULT_CURRENCY=USD

# Features
WATERMARK_ENABLED=true
PREMIUM_WATERMARK_DISABLED=true
```

### Running the Service

```bash
# Development
npm run dev

# Production
npm start

# With Docker
docker-compose up -d
```

## API Usage

### Generate Tax Report

```bash
curl -X POST http://localhost:3003/api/reports/generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "taxData": {
      "taxYear": 2023,
      "grossIncome": 100000,
      "totalTax": 22000,
      "federalTax": 18000,
      "stateTax": 4000,
      "filingStatus": "single",
      "state": "CA"
    },
    "options": {
      "locale": "en",
      "currency": "USD",
      "template": "standard",
      "includeCharts": true,
      "userTier": "premium"
    }
  }' \
  --output tax-report.pdf
```

### Export to CSV

```bash
curl -X POST http://localhost:3003/api/exports/csv \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "taxData": {
      "taxYear": 2023,
      "grossIncome": 100000,
      "totalTax": 22000
    },
    "locale": "en",
    "includeDetails": true
  }' \
  --output tax-data.csv
```

### Export to Excel

```bash
curl -X POST http://localhost:3003/api/exports/excel \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "taxData": {
      "taxYear": 2023,
      "grossIncome": 100000,
      "totalTax": 22000,
      "deductions": {
        "mortgage_interest": 12000,
        "charitable_donations": 5000
      }
    },
    "multipleSheets": true
  }' \
  --output tax-data.xlsx
```

### Bulk Export

```bash
curl -X POST http://localhost:3003/api/exports/bulk \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "taxData": {
      "taxYear": 2023,
      "grossIncome": 100000,
      "totalTax": 22000
    },
    "formats": ["csv", "excel", "json"]
  }' \
  --output tax-exports.zip
```

## Report Templates

### Standard Template
Complete tax summary with all sections:
- Tax Summary Overview
- Tax Calculation Details
- Tax Brackets Analysis
- Deductions and Credits
- Tax Optimization Recommendations
- Year-over-Year Comparison

### Executive Template
High-level overview for executives:
- Tax Summary Overview
- Executive Summary
- Recommendations

### Detailed Template
Comprehensive analysis with all details:
- All Standard sections plus detailed analysis

### Minimal Template
Basic tax information only:
- Tax Summary Overview
- Tax Calculation Details

### Comparison Template
Focus on year-over-year comparisons:
- Tax Summary Overview
- Year-over-Year Comparison
- Analysis and Recommendations

## Customization Options

### Report Options
- **Format**: A4, Letter, A3, Legal
- **Orientation**: Portrait or Landscape
- **Language**: en, es, fr, de, it
- **Currency**: USD, EUR, GBP, CAD, etc.
- **Template**: Standard, Executive, Detailed, Minimal, Comparison

### Visual Customization
- **Color Schemes**: Default, Dark, Corporate, Professional, Accessible
- **Custom Branding**: Logo, colors, company name
- **Typography**: Font family, size, line height
- **Charts**: Include/exclude, custom colors

### Privacy & Accessibility
- **Privacy**: Mask SSN, bank accounts, hide personal info
- **Accessibility**: High contrast, large text, alternative text
- **Watermarks**: Show/hide, custom text (tier-based)

### User Tier Features

#### Free Tier
- Basic PDF reports with watermark
- Standard template only
- No charts or recommendations
- Export to CSV only

#### Basic Tier
- PDF reports without watermark
- Charts and recommendations included
- All templates available
- Export to CSV and JSON

#### Premium Tier
- All Basic features
- Excel export
- Custom color schemes
- Year-over-year comparisons
- Bulk exports

#### Enterprise Tier
- All Premium features
- Custom branding (logo, colors)
- Advanced customization
- Priority processing
- API access

## Localization

### Supported Languages
- **English (en)**: Default
- **Spanish (es)**: Full translation
- **French (fr)**: Full translation
- **German (de)**: Full translation
- **Italian (it)**: Full translation

### Currency Support
- USD (US Dollar) - Default
- EUR (Euro)
- GBP (British Pound)
- CAD (Canadian Dollar)
- JPY (Japanese Yen)
- AUD (Australian Dollar)

### Date & Number Formats
Automatic formatting based on locale:
- Date formats (MM/DD/YYYY vs DD/MM/YYYY)
- Number separators (comma vs period)
- Currency symbols and positioning

## Data Visualization

### Available Charts
1. **Income vs Tax Breakdown**: Doughnut chart showing net income, federal tax, state tax, and deductions
2. **Tax Brackets Visualization**: Bar chart showing tax rates by income bracket
3. **Year-over-Year Comparison**: Line chart comparing income, taxes, and net income across years
4. **State Tax Comparison**: Bar chart comparing tax burden across states
5. **Deduction Categories**: Pie chart breaking down deduction types

### Chart Features
- Interactive tooltips
- Responsive design
- Print-friendly colors
- Accessibility support
- Custom branding colors

## API Endpoints

### Reports
- `POST /api/reports/generate` - Generate tax report PDF
- `GET /api/reports/download/:reportId` - Download generated report
- `GET /api/reports/templates` - Get available templates

### Exports
- `POST /api/exports/csv` - Export to CSV format
- `POST /api/exports/excel` - Export to Excel format
- `POST /api/exports/json` - Export to JSON format
- `POST /api/exports/bulk` - Bulk export multiple formats

### Utility
- `GET /health` - Health check
- `GET /api/status` - Service status
- `POST /api/upload` - Upload custom assets

## Development

### Project Structure
```
src/
├── config/           # Configuration management
├── locales/          # Translation files
├── services/         # Core business logic
├── templates/        # Handlebars templates
├── utils/           # Utilities and helpers
└── server.js        # Express server
```

### Key Services
- **ReportGenerator**: Main report generation orchestrator
- **PDFGenerator**: PDF creation using Puppeteer and PDFKit
- **ChartGenerator**: Chart creation using Chart.js and Canvas
- **ExportService**: Multi-format data export
- **TemplateEngine**: Handlebars template management
- **LocalizationService**: i18next integration
- **CustomizationService**: User customization options

### Running Tests
```bash
npm test
```

### Code Quality
```bash
npm run lint
npm run lint:fix
```

## Deployment

### Docker
```bash
# Build image
docker build -t globaltaxcalc-report-service .

# Run container
docker run -p 3003:3003 \
  -e NODE_ENV=production \
  -e API_KEY=your-production-key \
  globaltaxcalc-report-service
```

### Docker Compose
```bash
docker-compose up -d
```

### Production Considerations
1. **Environment Variables**: Use secure key management
2. **File Storage**: Consider cloud storage for generated files
3. **Caching**: Implement Redis for template and asset caching
4. **Load Balancing**: Use nginx or cloud load balancer
5. **Monitoring**: Set up application monitoring
6. **Rate Limiting**: Configure appropriate limits per user tier

## Security

### Features
- API key authentication
- CORS protection
- Request rate limiting
- Input validation with Joi
- Helmet.js security headers
- File upload restrictions

### Best Practices
- Secure API keys in production
- Use HTTPS in production
- Implement proper user authentication
- Validate all input data
- Sanitize file uploads
- Monitor for suspicious activity

## Performance

### Optimization Features
- Template caching
- PDF generation pooling
- Chart rendering optimization
- Compressed responses
- Efficient memory management

### Monitoring
- Request/response logging
- Performance metrics
- Error tracking
- Resource usage monitoring

## Troubleshooting

### Common Issues

1. **PDF Generation Fails**
   - Check Puppeteer installation
   - Verify Chrome/Chromium availability
   - Increase memory limits

2. **Charts Not Rendering**
   - Verify Chart.js CDN availability
   - Check Canvas dependencies
   - Increase render timeout

3. **Template Errors**
   - Verify Handlebars syntax
   - Check localization files
   - Validate template data

4. **Export Failures**
   - Check disk space
   - Verify write permissions
   - Monitor memory usage

### Debug Mode
Set `NODE_ENV=development` for detailed logging and error messages.

## Support

- **Documentation**: See `/docs` folder for detailed API documentation
- **Issues**: Report bugs via GitHub issues
- **Feature Requests**: Submit via GitHub discussions
- **Support**: Contact support@globaltaxcalc.com

## License

This project is licensed under the MIT License. See LICENSE file for details.

## Changelog

### v1.0.0
- Initial release with complete report generation
- Multi-language support (5 languages)
- Multi-format export capabilities
- Branded report templates
- Data visualization with Chart.js
- User tier-based features
- API endpoints for all functionality