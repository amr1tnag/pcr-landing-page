# All-in-one image: builds the React site, then serves it + the face-search API from FastAPI.
# (For Render, render.yaml uses backend/Dockerfile — API only, site on Vercel.)

# ---- frontend build ----
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci || npm install
COPY frontend/ ./
RUN npm run build

# ---- python wheels (dlib compiles here; see backend/Dockerfile) ----
FROM python:3.11 AS wheels
RUN pip install --no-cache-dir cmake
COPY backend/requirements.txt .
RUN pip wheel --no-cache-dir -r requirements.txt -w /wheels

# ---- runtime ----
FROM python:3.11-slim
COPY --from=wheels /wheels /wheels
RUN pip install --no-cache-dir /wheels/* && rm -rf /wheels

WORKDIR /app/backend
COPY backend/app ./app
COPY --from=web /web/dist /app/frontend/dist

ENV PCR_PHOTOS_DIR=/data/photos \
    PCR_DB_PATH=/data/pcr.db \
    PCR_FRONTEND_DIST=/app/frontend/dist \
    PYTHONUNBUFFERED=1
VOLUME ["/data"]
EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
