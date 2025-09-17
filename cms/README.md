# GlobalTaxCalc CMS

A comprehensive Content Management System built with Strapi for GlobalTaxCalc.com, providing multi-language content management, SEO optimization, and API endpoints for tax-related content.

## 🚀 Features

### Content Management
- **Blog Posts**: Tax tips, guides, and news articles
- **Tax Guides**: Country-specific tax documentation
- **Country Pages**: Landing pages for different countries
- **Tool Descriptions**: Documentation for tax calculators
- **FAQ System**: Frequently asked questions with categorization

### SEO & Performance
- **SEO Optimization**: Auto-generated meta tags, structured data
- **Multi-language Support**: 12 languages with proper i18n
- **Media Optimization**: Automatic image compression and responsive variants
- **Caching**: Intelligent caching for improved performance

### API Features
- **RESTful APIs**: Well-documented endpoints for all content types
- **Search Functionality**: Full-text search across all content
- **Rate Limiting**: API protection and usage monitoring
- **Content Scheduling**: Publish content at specific times

## 📋 Prerequisites

- Node.js 18+ and npm
- PostgreSQL 12+ (or SQLite for development)
- Cloudinary account (for media management)
- SendGrid account (for email notifications)

## 🛠️ Installation

1. **Clone and setup**:
   ```bash
   cd cms
   npm install
   ```

2. **Environment Configuration**:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your configuration:
   ```env
   # Database
   DATABASE_CLIENT=postgres
   DATABASE_HOST=localhost
   DATABASE_PORT=5432
   DATABASE_NAME=globaltaxcalc_cms
   DATABASE_USERNAME=postgres
   DATABASE_PASSWORD=your_password

   # Security
   APP_KEYS=key1,key2,key3,key4
   ADMIN_JWT_SECRET=your_admin_secret
   API_TOKEN_SALT=your_api_token_salt

   # Media
   CLOUDINARY_NAME=your_cloud_name
   CLOUDINARY_KEY=your_api_key
   CLOUDINARY_SECRET=your_api_secret

   # Email
   SENDGRID_API_KEY=your_sendgrid_key
   ```

3. **Database Setup**:
   ```bash
   # Create PostgreSQL database
   createdb globaltaxcalc_cms

   # Or use SQLite (development)
   # No additional setup needed
   ```

4. **Start Development**:
   ```bash
   npm run develop
   ```

5. **Seed Initial Content**:
   ```bash
   npm run seed
   ```

## 🎯 Content Types

### Blog Posts (`blog-post`)
- Multi-language blog articles
- SEO optimization
- Category and tag system
- Reading time calculation
- View tracking
- Related posts

### Tax Guides (`tax-guide`)
- Country-specific tax documentation
- Year-based versioning
- Different guide types (Individual, Business, etc.)
- Tax bracket information
- Deadline tracking

### Country Pages (`country-page`)
- Landing pages for each supported country
- Tax system overviews
- Key rates and deadlines
- Related content linking

### Tool Descriptions (`tool-description`)
- Calculator documentation
- Usage instructions
- Examples and limitations
- Country support information

### FAQ Items (`faq-item`)
- Categorized questions and answers
- Voting system
- Difficulty levels
- Country-specific FAQs

## 🌐 API Endpoints

### Content APIs
```
GET /api/content/blog                 # Blog posts with filtering
GET /api/content/blog/:slug           # Single blog post
GET /api/content/guides               # Tax guides
GET /api/content/guides/:country      # Country-specific guides
GET /api/content/faq                  # FAQ items
GET /api/content/country/:country     # Country page
GET /api/content/tools                # Tool descriptions
POST /api/content/search              # Content search
```

### Utility APIs
```
GET /api/content/navigation           # Navigation data
GET /api/content/sitemap              # Sitemap generation
GET /api/content/popular              # Popular content
GET /api/content/recent               # Recent content
```

### Example API Usage

**Get blog posts:**
```javascript
const response = await fetch('/api/content/blog?page=1&pageSize=10&category=tax-tips');
const { data, meta } = await response.json();
```

**Search content:**
```javascript
const response = await fetch('/api/content/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ q: 'tax deductions', type: 'blog' })
});
```

## 🌍 Multi-language Support

### Supported Languages
- English (en) - Default
- Spanish (es)
- French (fr)
- German (de)
- Italian (it)
- Portuguese (pt)
- Chinese Simplified (zh-Hans)
- Japanese (ja)
- Korean (ko)
- Arabic (ar)
- Hindi (hi)
- Russian (ru)

### Language Detection
Content language is detected via:
1. Query parameter (`?locale=es`)
2. Cookie (`strapi_locale`)
3. Accept-Language header
4. URL prefix (configurable)

### API with Languages
```javascript
// Get content in Spanish
fetch('/api/content/blog?locale=es')

// Get all available locales for a post
fetch('/api/content/blog/tax-deductions-guide')
```

## 🎨 Admin Panel

Access the admin panel at `http://localhost:1337/admin`

### Default Admin Features
- Content creation and editing
- Media library management
- User and role management
- API documentation
- Content scheduling
- SEO preview

### Custom Features
- Auto-generated SEO fields
- Reading time calculation
- Content analytics
- Bulk operations
- Translation workflow

## 🔧 Configuration

### SEO Configuration
SEO settings are auto-generated but can be customized:

```javascript
// Auto-generated for each content type
{
  metaTitle: "Auto-generated from title",
  metaDescription: "Auto-generated from excerpt/description",
  keywords: "Extracted from content",
  structuredData: {}, // Schema.org markup
  canonicalURL: "", // Auto-generated
  metaRobots: "index,follow"
}
```

### Media Configuration
Images are automatically optimized:

```javascript
// Automatic processing
- Auto-rotation based on EXIF
- Compression (JPEG: 85%, PNG: 85%, WebP: 85%)
- Resize if width > 2048px
- Responsive variants generation
- Alt text suggestions
```

### Rate Limiting
API endpoints are protected:

```javascript
// Default limits
{
  max: 100,        // requests per window
  window: 3600000, // 1 hour
  skipSuccessfulRequests: false
}
```

## 🚀 Deployment

### Production Environment
1. **Set environment variables**:
   ```bash
   NODE_ENV=production
   DATABASE_URL=postgresql://user:pass@host:port/db
   CLOUDINARY_NAME=production_cloud
   # ... other production configs
   ```

2. **Build and start**:
   ```bash
   npm run build
   npm start
   ```

### Database Migration
```bash
# Export data from development
npm run export -- --file backup.tar.gz

# Import to production
npm run import -- --file backup.tar.gz
```

### CDN Configuration
Configure Cloudinary for global CDN:
```javascript
// Automatic image transformations
/uploads/image.jpg?transform={"w":800,"q":80,"f":"webp"}
```

## 📊 Analytics & Monitoring

### Built-in Analytics
- Content view tracking
- Search query analytics
- Popular content identification
- User engagement metrics

### Performance Monitoring
- API response times
- Cache hit rates
- Image optimization metrics
- Database query performance

## 🔒 Security

### Authentication
- JWT-based admin authentication
- API token authentication for external access
- Role-based permissions

### Data Protection
- Input sanitization
- XSS protection
- CSRF protection
- Rate limiting
- File upload restrictions

### GDPR Compliance
- Data anonymization options
- User data export
- Right to deletion
- Cookie consent management

## 🛠️ Development

### Custom Plugins
Create custom functionality:
```bash
npx strapi generate plugin my-plugin
```

### Extending APIs
Add custom endpoints:
```javascript
// src/api/custom/routes/custom.js
module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/custom-endpoint',
      handler: 'custom.myMethod'
    }
  ]
};
```

### Lifecycle Hooks
Customize content behavior:
```javascript
// Auto-update related content
module.exports = {
  async afterCreate(event) {
    // Custom logic after content creation
  }
};
```

## 📚 Documentation

- [Strapi Documentation](https://docs.strapi.io/)
- [API Reference](http://localhost:1337/documentation)
- [Content Type Schemas](./src/api/)
- [Plugin Documentation](./src/plugins/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Contact the development team

---

**GlobalTaxCalc CMS** - Powering tax content management for millions of users worldwide.