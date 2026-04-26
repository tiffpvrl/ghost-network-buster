# Cloud Run: deploy with --source or build this image.
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1
ENV PORT=8080

RUN pip install --no-cache-dir --upgrade pip

COPY pyproject.toml README.md ./
COPY ghost_network_buster ./ghost_network_buster
COPY data ./data

RUN pip install --no-cache-dir .

EXPOSE 8080

CMD sh -c 'exec uvicorn ghost_network_buster.main:app --host 0.0.0.0 --port ${PORT:-8080}'
