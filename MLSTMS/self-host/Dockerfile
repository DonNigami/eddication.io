# Python Version
FROM python:3.11-slim

LABEL maintainer="MLSTMS"
LABEL description="PTG eZView API Integration Client - Python Version"

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY ptg_ezview_client.py .
COPY .env.example .env.example

# Create directories for data
RUN mkdir -p /app/data /app/logs

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PTG_SQLITE_PATH=/app/data/ptg_data.db
ENV PTG_CSV_PATH=/app/data/csv_output

# Create a non-root user
RUN useradd -m -u 1000 ptguser && \
    chown -R ptguser:ptguser /app

USER ptguser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import sqlite3; sqlite3.connect('/app/data/ptg_data.db').execute('SELECT 1')" || exit 1

# Default command
CMD ["python", "ptg_ezview_client.py", "--daemon"]
