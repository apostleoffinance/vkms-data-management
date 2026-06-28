import io
import base64
import re

from PIL import Image

MAX_PHOTO_BYTES = 512_000
PHOTO_MAX_DIMENSION = 480


def process_upload_photo(content: bytes, content_type: str | None) -> tuple[bytes, str]:
    if len(content) > 2 * 1024 * 1024:
        raise ValueError("Photo must be under 2MB")

    try:
        with Image.open(io.BytesIO(content)) as img:
            img = img.convert("RGB")
            img.thumbnail((PHOTO_MAX_DIMENSION, PHOTO_MAX_DIMENSION), Image.Resampling.LANCZOS)
            buffer = io.BytesIO()
            img.save(buffer, format="JPEG", quality=85, optimize=True)
            data = buffer.getvalue()
    except Exception as exc:
        raise ValueError("Invalid image file") from exc

    if len(data) > MAX_PHOTO_BYTES:
        raise ValueError("Photo is too large after compression")

    return data, "image/jpeg"


def decode_photo_base64(value: str | None) -> tuple[bytes, str] | None:
    if not value or not value.strip():
        return None
    raw = value.strip()
    content_type = None
    if raw.startswith("data:"):
        match = re.match(r"data:([^;]+);base64,(.+)", raw, re.DOTALL)
        if not match:
            raise ValueError("Invalid photo data URL")
        content_type = match.group(1)
        raw = match.group(2)
    try:
        binary = base64.b64decode(raw)
    except Exception as exc:
        raise ValueError("Invalid photo encoding") from exc
    return process_upload_photo(binary, content_type)
