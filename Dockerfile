# All-in-one image: builds the React site, then serves it + the face-search API from FastAPI.
# (For Render, render.yaml uses backend/Dockerfile — API only, site on Vercel.)

# ---- frontend build ----
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci || npm install
COPY frontend/ ./
RUN npm run build

# ---- runtime ----
# Full python image: it has the toolchain dlib compiles with and the X11/image
# libraries dlib links against at runtime (see backend/Dockerfile).
FROM python:3.11
COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir cmake \
 && pip install --no-cache-dir -r /tmp/requirements.txt \
 && pip uninstall -y cmake

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
