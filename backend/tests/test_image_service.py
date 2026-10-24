import io
import struct
import zlib

import pytest

from app.services.image_service import (
    ImageValidationError,
    validate_and_sanitize_image,
)


def _create_minimal_png(width: int = 10, height: int = 10, with_metadata: bool = False) -> bytes:
    # 8-byte signature
    sig = b"\x89PNG\r\n\x1a\n"
    # IHDR chunk: 13 bytes
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)  # 8-bit truecolor RGB
    ihdr_crc = struct.pack(">I", zlib.crc32(b"IHDR" + ihdr_data) & 0xFFFFFFFF)
    ihdr_chunk = struct.pack(">I", 13) + b"IHDR" + ihdr_data + ihdr_crc

    extra_chunks = b""
    if with_metadata:
        # Add tEXt chunk with comments
        text_data = b"Comment\x00Sensitive EXIF or metadata"
        text_crc = struct.pack(">I", zlib.crc32(b"tEXt" + text_data) & 0xFFFFFFFF)
        extra_chunks += struct.pack(">I", len(text_data)) + b"tEXt" + text_data + text_crc

    # Minimal IDAT chunk
    compressed = zlib.compress(b"\x00" * 32)
    idat_crc = struct.pack(">I", zlib.crc32(b"IDAT" + compressed) & 0xFFFFFFFF)
    idat_chunk = struct.pack(">I", len(compressed)) + b"IDAT" + compressed + idat_crc

    # IEND chunk
    iend_crc = struct.pack(">I", zlib.crc32(b"IEND") & 0xFFFFFFFF)
    iend_chunk = struct.pack(">I", 0) + b"IEND" + iend_crc

    return sig + ihdr_chunk + extra_chunks + idat_chunk + iend_chunk


def _create_minimal_jpeg(width: int = 16, height: int = 16, with_exif: bool = False) -> bytes:
    out = io.BytesIO()
    # SOI
    out.write(b"\xff\xd8")

    # APP0 (JFIF)
    jfif_data = b"JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    out.write(b"\xff\xe0" + struct.pack(">H", len(jfif_data) + 2) + jfif_data)

    if with_exif:
        # APP1 (EXIF)
        exif_data = b"Exif\x00\x00SensitiveUserData"
        out.write(b"\xff\xe1" + struct.pack(">H", len(exif_data) + 2) + exif_data)

    # SOF0: precision (8), height (2 bytes), width (2 bytes), components (3)
    sof_data = struct.pack(">BHHB", 8, height, width, 3)
    # 3 components: id, subsampling, qtable
    sof_data += b"\x01\x11\x00\x02\x11\x01\x03\x11\x01"
    out.write(b"\xff\xc0" + struct.pack(">H", len(sof_data) + 2) + sof_data)

    # SOS: components + dummy entropy data
    sos_data = b"\x03\x01\x00\x02\x11\x03\x11\x00\x3f\x00"
    out.write(b"\xff\xda" + struct.pack(">H", len(sos_data) + 2) + sos_data)
    out.write(b"\x00\xff\x00\x12\x34")  # some entropy data

    # EOI
    out.write(b"\xff\xd9")
    return out.getvalue()


def test_valid_png_sanitized_and_metadata_stripped():
    raw_png = _create_minimal_png(width=50, height=40, with_metadata=True)
    assert b"Sensitive EXIF" in raw_png

    sanitized, meta = validate_and_sanitize_image(raw_png)
    assert meta.media_type == "image/png"
    assert meta.width == 50
    assert meta.height == 40
    assert meta.byte_size == len(sanitized)
    assert b"Sensitive EXIF" not in sanitized
    assert sanitized.startswith(b"\x89PNG\r\n\x1a\n")


def test_valid_jpeg_sanitized_and_exif_stripped():
    raw_jpeg = _create_minimal_jpeg(width=80, height=60, with_exif=True)
    assert b"SensitiveUserData" in raw_jpeg

    sanitized, meta = validate_and_sanitize_image(raw_jpeg)
    assert meta.media_type == "image/jpeg"
    assert meta.width == 80
    assert meta.height == 60
    assert meta.byte_size == len(sanitized)
    assert b"SensitiveUserData" not in sanitized
    assert sanitized.startswith(b"\xff\xd8")
    assert sanitized.endswith(b"\xff\xd9")


def test_rejects_non_image_or_invalid_mime():
    with pytest.raises(ImageValidationError, match="INVALID_IMAGE_CONTENT"):
        validate_and_sanitize_image(b"<!DOCTYPE html><html><body>Not an image</body></html>")


def test_rejects_oversized_file():
    # 5 MiB + 1 byte
    oversized = b"\x00" * (5 * 1024 * 1024 + 1)
    with pytest.raises(ImageValidationError, match="IMAGE_SIZE_EXCEEDED"):
        validate_and_sanitize_image(oversized)


def test_rejects_excessive_megapixels():
    # Dimensions exceeding 20 megapixels (e.g. 5000 x 4001 = 20,005,000 pixels)
    png = _create_minimal_png(width=5000, height=4001)
    with pytest.raises(ImageValidationError, match="IMAGE_DIMENSIONS_EXCEEDED"):
        validate_and_sanitize_image(png)
