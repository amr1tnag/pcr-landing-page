"""Face detection and embedding, wrapped so the API still boots without dlib."""
from __future__ import annotations

from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

from .config import DETECTION_MODEL, MAX_EDGE, UPSAMPLE


class FaceEngineUnavailable(RuntimeError):
    """Raised when face_recognition (dlib) isn't installed in this environment."""


_fr = None


def engine():
    """Import face_recognition lazily — it's a heavy, native dependency."""
    global _fr
    if _fr is None:
        try:
            import face_recognition  # noqa: PLC0415
        except Exception as exc:  # pragma: no cover - depends on the host
            raise FaceEngineUnavailable(
                "face_recognition is not installed. Run: pip install -r requirements.txt "
                "(it needs cmake and dlib build tools)."
            ) from exc
        _fr = face_recognition
    return _fr


def engine_available() -> bool:
    try:
        engine()
        return True
    except FaceEngineUnavailable:
        return False


def load_array(source: str | Path | bytes) -> tuple[np.ndarray, tuple[int, int]]:
    """Open an image as an RGB uint8 array, EXIF-rotated and size-capped.

    Returns the array plus the ORIGINAL (width, height) for metadata.
    """
    img = Image.open(BytesIO(source) if isinstance(source, bytes) else source)
    img = ImageOps.exif_transpose(img)
    original = img.size
    img = img.convert("RGB")

    longest = max(img.size)
    if longest > MAX_EDGE:
        scale = MAX_EDGE / longest
        img = img.resize((max(1, int(img.width * scale)), max(1, int(img.height * scale))), Image.LANCZOS)

    return np.ascontiguousarray(np.array(img, dtype=np.uint8)), original


def encode_image(source: str | Path | bytes, *, model: str = DETECTION_MODEL, upsample: int = UPSAMPLE):
    """Detect every face in an image and return (encodings, locations, size)."""
    fr = engine()
    array, original_size = load_array(source)
    locations = fr.face_locations(array, number_of_times_to_upsample=upsample, model=model)
    if not locations:
        return [], [], original_size
    encodings = fr.face_encodings(array, known_face_locations=locations, num_jitters=1)
    return encodings, locations, original_size


def encode_query(data: bytes, *, model: str = DETECTION_MODEL) -> np.ndarray | None:
    """Encode the single most prominent face in an uploaded selfie."""
    # Selfies have one big face: try the cheap pass first, upsample only if it misses.
    encodings, locations, _ = encode_image(data, model=model, upsample=1)
    if not encodings:
        encodings, locations, _ = encode_image(data, model=model, upsample=max(2, UPSAMPLE))
    if not encodings:
        return None
    # Largest detected face wins — in a selfie that's the person searching.
    areas = [(b - t) * (r - l) for (t, r, b, l) in locations]
    return encodings[int(np.argmax(areas))]


def distances(matrix: np.ndarray, query: np.ndarray) -> np.ndarray:
    """Euclidean distance from the query embedding to every indexed face."""
    if matrix.size == 0:
        return np.empty(0)
    return np.linalg.norm(matrix - query, axis=1)


def confidence(distance: float, tolerance: float) -> float:
    """Map a face distance onto a 0–1 score that reads sensibly in the UI."""
    if tolerance <= 0:
        return 0.0
    return float(max(0.0, min(1.0, 1.0 - (distance / (tolerance * 2)))))
