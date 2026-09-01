# Production Dockerfile for ai-service (Python 3.11 / FastAPI / LangGraph)
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (curl for healthchecks, build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy and install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY . .

EXPOSE 8001
ENV PORT=8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
