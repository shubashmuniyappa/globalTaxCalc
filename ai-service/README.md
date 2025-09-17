# AI/LLM Integration Service for GlobalTaxCalc.com

This service provides natural language processing, voice input parsing, and intelligent tax optimization suggestions using free-tier AI APIs and Hugging Face Transformers.

## Features

### 🧠 Natural Language Processing
- Parse user input like "I make 75k, married with 2 kids in California"
- Extract structured data: income, filing status, dependents, location
- Handle various input formats and ambiguities
- Input validation and sanitization

### 🎤 Voice Input Processing
- Voice-to-text conversion using Whisper
- Audio file processing for uploaded recordings
- Multi-language support (English priority)
- Noise reduction and audio quality improvement

### 🎯 Tax Optimization Suggestions
- Analyze tax calculations for optimization opportunities
- Generate personalized recommendations
- Consider deduction maximization strategies
- Retirement account contribution suggestions

### ❓ Intelligent Tax Q&A
- Answer common tax questions
- Provide explanations for tax concepts
- Context-aware responses based on user's situation
- Cite relevant tax code sections

### 🔧 Advanced Features
- Prompt engineering system with templates
- Response quality control and validation
- Caching for improved performance
- Rate limiting for API protection

## Technology Stack

- **Framework**: Python + FastAPI
- **AI Models**: Hugging Face Transformers (Llama-compatible models)
- **Voice Processing**: OpenAI Whisper
- **NLP**: spaCy, NLTK, TextBlob
- **Caching**: Redis
- **Database**: MongoDB
- **Containerization**: Docker

## API Endpoints

### Core Services

#### `POST /api/v1/parse-text`
Parse natural language text to extract tax information.

```json
{
  "text": "I make 75k, married with 2 kids in California",
  "enhance_with_ai": true
}
```

#### `POST /api/v1/voice-to-text`
Convert voice audio to text.

```bash
curl -X POST "http://localhost:8003/api/v1/voice-to-text" \
  -F "audio_file=@recording.wav" \
  -F "language=en"
```

#### `POST /api/v1/optimize`
Get personalized tax optimization suggestions.

```json
{
  "income": 75000,
  "filing_status": "marriedFilingJointly",
  "dependents": 2,
  "state": "CA",
  "deductions": [
    {"type": "mortgage_interest", "amount": 12000}
  ]
}
```

#### `POST /api/v1/ask`
Ask tax questions with AI assistance.

```json
{
  "question": "What is the standard deduction for 2024?",
  "user_context": {
    "income": 75000,
    "filing_status": "marriedFilingJointly"
  }
}
```

### Utility Endpoints

- `GET /api/v1/health` - Service health check
- `GET /api/v1/model-info` - AI model information
- `GET /api/v1/supported-formats` - Supported audio formats
- `GET /api/v1/question-suggestions` - Suggested questions

## Quick Start

### Development Setup

1. **Clone and navigate to the project**:
   ```bash
   cd ai-service
   ```

2. **Create virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   python -m spacy download en_core_web_sm
   ```

4. **Set up environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Run the service**:
   ```bash
   python main.py
   ```

### Docker Setup

1. **Build the image**:
   ```bash
   docker build -t globaltaxcalc-ai .
   ```

2. **Run the container**:
   ```bash
   docker run -p 8003:8003 \
     -e HUGGINGFACE_TOKEN=your_token \
     -e OPENAI_API_KEY=your_key \
     globaltaxcalc-ai
   ```

### Production Deployment

```bash
docker run -d \
  --name globaltaxcalc-ai \
  -p 8003:8003 \
  -e ENVIRONMENT=production \
  -e HUGGINGFACE_TOKEN=your_production_token \
  -e OPENAI_API_KEY=your_production_key \
  -e MONGODB_URL=your_mongodb_connection \
  -e REDIS_URL=your_redis_connection \
  --restart unless-stopped \
  globaltaxcalc-ai
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HUGGINGFACE_TOKEN` | Hugging Face API token | None |
| `OPENAI_API_KEY` | OpenAI API key (fallback) | None |
| `MODEL_CACHE_DIR` | Directory for model caching | `./models` |
| `WHISPER_MODEL` | Whisper model size | `base` |
| `MAX_RESPONSE_TIME` | Max response time (seconds) | `3.0` |
| `CONFIDENCE_THRESHOLD` | Min confidence threshold | `0.7` |

### Model Configuration

The service uses a tiered approach for AI models:

1. **Primary**: Hugging Face Transformers (free)
   - Local inference with DialoGPT/Llama-compatible models
   - GPU acceleration when available
   - Model caching and optimization

2. **Fallback**: OpenAI API (free tier)
   - Used when local models fail
   - Rate limited for cost control

## AI Models

### Local Models (Hugging Face)
- **Primary**: `microsoft/DialoGPT-medium` (placeholder for Llama 3.2-1B)
- **Voice**: `openai/whisper-base`
- **NLP**: `en_core_web_sm` (spaCy)

### Model Requirements
- **RAM**: 4GB+ for base models
- **Storage**: 2GB+ for model cache
- **GPU**: Optional, improves performance

## Performance Optimization

### Response Time Targets
- **NLP Parsing**: < 1 second
- **Voice Transcription**: < 3 seconds
- **Tax Q&A**: < 2 seconds
- **Optimization**: < 3 seconds

### Caching Strategy
- **Response Caching**: High-quality responses cached for 24 hours
- **Model Caching**: Models cached locally to avoid re-downloads
- **Redis Caching**: API responses and parsed data

### Quality Control
- **Response Validation**: Automatic quality scoring
- **Content Filtering**: Harmful content detection
- **Accuracy Checks**: Tax information verification
- **Fallback Responses**: When quality is insufficient

## Security

### Data Protection
- No sensitive data stored permanently
- Request data sanitized and validated
- Rate limiting to prevent abuse
- Secure API token handling

### Content Safety
- Harmful content detection
- Tax advice disclaimers
- Professional consultation recommendations
- Legal compliance validation

## Monitoring

### Health Checks
```bash
# Service health
curl http://localhost:8003/ping

# Detailed health
curl http://localhost:8003/api/v1/health

# Model status
curl http://localhost:8003/api/v1/model-info
```

### Logging
- Structured JSON logging
- Request/response tracking
- Performance metrics
- Error monitoring

## Development

### Adding New Features

1. **Service Layer**: Add functionality in `src/services/`
2. **API Layer**: Add endpoints in `src/api/endpoints.py`
3. **Schemas**: Define request/response models in `src/api/schemas.py`
4. **Testing**: Add tests for new functionality

### Prompt Engineering

Customize AI prompts in `src/services/prompt_service.py`:

```python
# Add new prompt template
prompt_service.create_custom_template(
    name="my_template",
    prompt_type=PromptType.TAX_QA,
    template="Custom prompt with {variable}",
    variables=["variable"],
    max_tokens=200
)
```

## Troubleshooting

### Common Issues

1. **Model Loading Fails**
   ```bash
   # Check disk space and network
   df -h
   ping huggingface.co
   ```

2. **High Memory Usage**
   ```bash
   # Monitor memory usage
   docker stats globaltaxcalc-ai
   ```

3. **Slow Response Times**
   ```bash
   # Check model device
   curl http://localhost:8003/api/v1/model-info
   ```

### Performance Tuning

1. **GPU Acceleration**: Set `CUDA_VISIBLE_DEVICES` if GPU available
2. **Model Quantization**: Automatically enabled for GPU setups
3. **Worker Processes**: Keep at 1 for AI models
4. **Memory Limits**: Set appropriate Docker memory limits

## API Documentation

When running the service, visit:
- **Swagger UI**: http://localhost:8003/docs
- **ReDoc**: http://localhost:8003/redoc
- **OpenAPI Spec**: http://localhost:8003/openapi.json

## Support

For issues and questions:
1. Check the logs: `docker logs globaltaxcalc-ai`
2. Verify configuration: Review `.env` file
3. Test endpoints: Use `/health` and `/ping`
4. Monitor performance: Check `/api/v1/model-info`

## License

This service is part of the GlobalTaxCalc.com platform.