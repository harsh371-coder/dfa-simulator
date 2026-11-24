# Production Dockerfile for ε-NFA to DFA Simulator
# Multi-platform: Linux, Cloud (Render, Railway, Fly.io, Cloud Run, AWS)

FROM python:3.12-slim

# Install g++ compiler for C++ simulator engine
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy project files
COPY . /app

# Compile C++ Simulator binary
RUN g++ -std=c++14 -O2 backend/simulator.cpp -o backend/simulator \
    && chmod +x backend/simulator

# Run tests during build to ensure binary integrity
RUN python tests/test_all_presets.py

# Create non-root user for security
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

# Cloud platforms like Render, Railway, Cloud Run inject $PORT
ENV PORT=8080
ENV PYTHONUNBUFFERED=1

EXPOSE 8080

CMD ["python", "server.py"]
