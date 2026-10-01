# API-only image for hosts like Render (the frontend lives on Vercel).
#
# dlib (under face_recognition) has no prebuilt Linux wheel, so it compiles here.
# The full python image already has a C++ toolchain plus the X11/image libraries
# dlib links against at runtime, and cmake comes from PyPI, so no apt step is
# needed. (A slim runtime image fails with "libX11.so.6: cannot open shared object".)
# dlib's setup.py sizes its parallel build to available RAM, so it won't OOM.
FROM python:3.11

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir cmake \
 && pip install --no-cache-dir -r requirements.txt \
 && pip uninstall -y cmake

COPY app ./app

ENV PCR_PHOTOS_DIR=/data/photos \
    PCR_DB_PATH=/data/pcr.db \
    PYTHONUNBUFFERED=1

EXPOSE 8000
# One worker: the index job and its status live in-process, and dlib's models
# take ~150 MB of RAM per worker. Render supplies $PORT.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --proxy-headers --forwarded-allow-ips='*'"]
