FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies for AI/ML libraries
RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    g++ \
    ffmpeg \
    libsndfile1 \
    portaudio19-dev \
    python3-dev \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create models directory
RUN mkdir -p /app/models

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip setuptools wheel
RUN pip install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

# Download spaCy model
RUN python -m spacy download en_core_web_sm

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app && \
    chmod -R 755 /app

USER appuser

# Expose port
EXPOSE 8003

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8003/ping || exit 1

# Run the application
CMD ["python", "main.py"]