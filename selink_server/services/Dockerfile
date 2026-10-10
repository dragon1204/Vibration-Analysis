# One image for api / ingest / analytics / notifier (command selects the service).
# Build context: selink_server/ (needs db/migrations).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    MIGRATIONS_DIR=/app/db/migrations TZ=Asia/Ho_Chi_Minh
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core tzdata && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY services/requirements.txt /app/requirements.txt
RUN pip install -r /app/requirements.txt
COPY services/smartmotor /app/smartmotor
COPY db/migrations /app/db/migrations
RUN useradd -r -u 10001 app && chown -R app /app
USER app
EXPOSE 8000
CMD ["uvicorn", "smartmotor.api.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
