# GlobalTaxCalc File Processing Service

A comprehensive document processing service for tax forms with OCR, form recognition, and data extraction capabilities.

## Features

- **File Upload & Management**: Secure file upload with validation, virus scanning, and automatic expiration
- **OCR Processing**: Advanced text extraction using Tesseract with image preprocessing
- **Form Recognition**: Intelligent tax form type identification (W-2, 1099, T4, P60, etc.)
- **Data Extraction**: Structured data extraction with confidence scoring and validation
- **Auto-fill Integration**: Seamless integration with tax calculators
- **Background Processing**: Async job processing with Celery task queue
- **Security & Compliance**: File encryption, GDPR compliance, and audit logging
- **API Endpoints**: RESTful API for file management and processing

## Tech Stack

- **Backend**: Python 3.11, FastAPI
- **OCR**: Tesseract, OpenCV, PIL
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Task Queue**: Celery with Redis
- **Security**: ClamAV virus scanning, file encryption
- **Containerization**: Docker with Docker Compose

## Supported File Types

- **Documents**: PDF
- **Images**: JPG, JPEG, PNG, TIFF

## Supported Tax Forms

### United States
- W-2 (Wage and Tax Statement)
- 1099-MISC (Miscellaneous Income)
- 1099-INT (Interest Income)
- 1099-DIV (Dividends and Distributions)

### Canada
- T4 (Statement of Remuneration Paid)
- T4A (Statement of Pension, Retirement, Annuity, and Other Income)

### United Kingdom
- P60 (End of Year Certificate)
- P45 (Details of Employee Leaving Work)

## Quick Start

### Using Docker Compose (Recommended)

1. **Clone and setup**:
   ```bash
   git clone <repository>
   cd file-processing-service
   cp .env.example .env
   ```

2. **Configure environment**:
   Edit `.env` file with your settings:
   ```bash
   # Database
   DATABASE_URL=postgresql://user:password@postgres:5432/file_processing

   # Redis
   REDIS_URL=redis://redis:6379/0
   CELERY_BROKER_URL=redis://redis:6379/0

   # File encryption (generate secure keys in production)
   FILE_ENCRYPTION_ENABLED=true
   FILE_ENCRYPTION_PASSWORD=your-secure-password

   # Security
   CLAMAV_ENABLED=true
   ALLOWED_ORIGINS=["http://localhost:3000"]
   ```

3. **Start services**:
   ```bash
   docker-compose up -d
   ```

4. **Initialize database**:
   ```bash
   docker-compose exec file-processing-api python -c "
   from app.database import create_tables
   create_tables()
   "
   ```

5. **Access services**:
   - API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs
   - Celery Monitoring: http://localhost:5555

### Manual Installation

1. **Install system dependencies**:
   ```bash
   # Ubuntu/Debian
   sudo apt-get update
   sudo apt-get install tesseract-ocr tesseract-ocr-eng poppler-utils

   # macOS
   brew install tesseract poppler
   ```

2. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Setup database**:
   ```bash
   # Create PostgreSQL database
   createdb file_processing

   # Run migrations
   python -c "from app.database import create_tables; create_tables()"
   ```

4. **Start Redis**:
   ```bash
   redis-server
   ```

5. **Start services**:
   ```bash
   # Terminal 1: API server
   python main.py

   # Terminal 2: Celery worker
   python start_celery_worker.py

   # Terminal 3: Celery beat scheduler
   python start_celery_beat.py
   ```

## API Usage

### Upload File
```bash
curl -X POST "http://localhost:8000/upload" \
     -H "accept: application/json" \
     -H "Content-Type: multipart/form-data" \
     -F "file=@tax_document.pdf"
```

### Check Processing Status
```bash
curl -X GET "http://localhost:8000/files/{file_id}/status" \
     -H "accept: application/json"
```

### Get Processing Results
```bash
curl -X GET "http://localhost:8000/files/{file_id}/results" \
     -H "accept: application/json"
```

### List Files
```bash
curl -X GET "http://localhost:8000/files" \
     -H "accept: application/json"
```

### Delete File
```bash
curl -X DELETE "http://localhost:8000/files/{file_id}" \
     -H "accept: application/json"
```

## Configuration

Key configuration options in `.env`:

### OCR Settings
```bash
TESSERACT_LANG=eng+fra+deu+spa  # Languages
OCR_DPI=300                     # Image DPI
OCR_CONFIDENCE_THRESHOLD=30     # Min confidence
```

### Processing Settings
```bash
MAX_FILE_SIZE_MB=50            # Max upload size
FILE_RETENTION_HOURS=24        # Auto-deletion time
TASK_TIME_LIMIT=1800          # Max processing time
```

### Security Settings
```bash
FILE_ENCRYPTION_ENABLED=true
CLAMAV_ENABLED=true
AUDIT_LOGGING_ENABLED=true
```

## Architecture

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   FastAPI       │    │    Celery    │    │   PostgreSQL    │
│   Web Server    │───▶│   Workers    │───▶│   Database      │
└─────────────────┘    └──────────────┘    └─────────────────┘
         │                       │                    │
         │              ┌──────────────┐             │
         │              │    Redis     │             │
         │              │  Task Queue  │             │
         │              └──────────────┘             │
         │                                           │
         ▼                                           │
┌─────────────────┐    ┌──────────────┐             │
│  File Storage   │    │   ClamAV     │             │
│   (Encrypted)   │    │ Virus Scan   │             │
└─────────────────┘    └──────────────┘             │
                                                    │
                       ┌──────────────┐             │
                       │  Tesseract   │             │
                       │     OCR      │─────────────┘
                       └──────────────┘
```

## Processing Pipeline

1. **File Upload**: Upload validation, virus scanning, encryption
2. **Queue Job**: Submit to Celery task queue
3. **OCR Processing**: Text extraction with preprocessing
4. **Form Recognition**: Identify document type and structure
5. **Data Extraction**: Extract structured fields with validation
6. **Auto-fill Generation**: Map to calculator fields
7. **Result Storage**: Store results with audit logging

## Security Features

- **File Encryption**: AES encryption for stored files
- **Virus Scanning**: ClamAV integration for malware detection
- **Secure Deletion**: Multi-pass overwrite for file removal
- **Audit Logging**: Comprehensive activity tracking
- **GDPR Compliance**: Data export and deletion endpoints
- **Input Validation**: File type, size, and content validation

## Monitoring & Maintenance

### Health Checks
```bash
curl http://localhost:8000/health
```

### System Statistics
```bash
curl http://localhost:8000/stats
```

### Celery Monitoring
Access Flower web interface at http://localhost:5555

### Log Files
- Application: `logs/app.log`
- Celery Workers: `logs/celery.log`
- Audit: `logs/audit.log`

## Troubleshooting

### Common Issues

1. **Tesseract not found**:
   ```bash
   # Set path in .env
   TESSERACT_PATH=/usr/bin/tesseract
   ```

2. **ClamAV connection failed**:
   ```bash
   # Disable if not needed
   CLAMAV_ENABLED=false
   ```

3. **Database connection error**:
   ```bash
   # Check DATABASE_URL format
   DATABASE_URL=postgresql://user:pass@host:port/db
   ```

4. **Redis connection error**:
   ```bash
   # Check Redis URL
   REDIS_URL=redis://localhost:6379/0
   ```

### Performance Tuning

- **Celery Workers**: Adjust `--concurrency` based on CPU cores
- **Database**: Configure connection pooling
- **OCR**: Optimize image preprocessing settings
- **File Storage**: Use SSD for better I/O performance

## Development

### Running Tests
```bash
pytest tests/
```

### Code Quality
```bash
# Linting
flake8 app/
black app/

# Type checking
mypy app/
```

### Database Migrations
```bash
# Generate migration
alembic revision --autogenerate -m "description"

# Apply migration
alembic upgrade head
```

## Deployment

### Production Considerations

1. **Environment Variables**: Use secure key management
2. **Database**: Use managed PostgreSQL service
3. **File Storage**: Consider cloud storage (S3, etc.)
4. **Load Balancing**: Use nginx or cloud load balancer
5. **Monitoring**: Set up application monitoring
6. **Backups**: Regular database and file backups
7. **SSL/TLS**: Enable HTTPS in production

### Docker Production
```bash
# Build production image
docker build -t file-processing-service:prod .

# Run with production compose
docker-compose -f docker-compose.prod.yml up -d
```

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Contact: support@globaltaxcalc.com

## Changelog

### v1.0.0
- Initial release with full document processing pipeline
- Support for US, Canadian, and UK tax forms
- Complete API with GDPR compliance
- Docker deployment configuration