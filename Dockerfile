# One image: builds the React site, then serves it + the face-search API from FastAPI.

# ---- frontend build ----
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci || npm install
COPY frontend/ ./
RUN npm run build

# ---- runtime ----
FROM python:3.11-slim
# dlib (under face_recognition) compiles from source when no wheel matches.
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential cmake libopenblas-dev liblapack-dev \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY --from=web /web/dist /app/frontend/dist

ENV PCR_PHOTOS_DIR=/data/photos \
    PCR_DB_PATH=/data/pcr.db \
    PCR_FRONTEND_DIST=/app/frontend/dist
VOLUME ["/data"]
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
