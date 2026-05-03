FROM python:3.9-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
  build-essential \
  ffmpeg \
  git \
  nodejs \
  npm \
  pkg-config \
  libsndfile1 \
  libavcodec-dev \
  libavdevice-dev \
  libavfilter-dev \
  libavformat-dev \
  libavutil-dev \
  libswresample-dev \
  libswscale-dev \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN python -m pip install --upgrade pip

RUN mkdir -p /app/services/ai
COPY requirements*.txt /app/services/ai/
RUN python -m pip install --no-cache-dir -r /app/services/ai/requirements.txt

COPY . /app/services/ai

RUN mkdir -p /app/storage /app/storage/uploads /app/storage/stems /app/storage/results /app/storage/temp /app/storage/ai

ENV PORT=8001

CMD ["sh", "-c", "python -m uvicorn services.ai.main:app --host 0.0.0.0 --port ${PORT}"]
