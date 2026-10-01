# API-only image for hosts like Render (the frontend lives on Vercel).

# ---- build: compile dlib once into wheels ----
# dlib (under face_recognition) has no prebuilt Linux wheel. The full python image
# already has a C++ toolchain and cmake comes from PyPI, so no apt step is needed.
# dlib's setup.py sizes its parallel build to available RAM, so it won't OOM.
FROM python:3.11 AS build
RUN pip install --no-cache-dir cmake
COPY requirements.txt .
RUN pip wheel --no-cache-dir -r requirements.txt -w /wheels

# ---- runtime: slim image, prebuilt wheels only ----
FROM python:3.11-slim
COPY --from=build /wheels /wheels
RUN pip install --no-cache-dir /wheels/* && rm -rf /wheels

WORKDIR /app
COPY app ./app

ENV PCR_PHOTOS_DIR=/data/photos \
    PCR_DB_PATH=/data/pcr.db \
    PYTHONUNBUFFERED=1

EXPOSE 8000
# One worker: the index job and its status live in-process, and dlib's models
# take ~150 MB of RAM per worker. Render supplies $PORT.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --proxy-headers --forwarded-allow-ips='*'"]
