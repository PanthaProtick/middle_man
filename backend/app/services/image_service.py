import hashlib
import struct
import zlib
from dataclasses import dataclass

MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MiB
MAX_IMAGE_PIXELS = 20_000_000  # 20 megapixels

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
JPEG_SOI = b"\xff\xd8"
JPEG_EOI = b"\xff\xd9"


class ImageValidationError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(f"{code}: {message}")
        self.code = code
        self.message = message


@dataclass(frozen=True)
class ImageMetadata:
    media_type: str
    width: int
    height: int
    byte_size: int
    sha256_digest: str


def _sanitize_png(data: bytes) -> tuple[bytes, int, int]:
    if len(data) < 8 or not data.startswith(PNG_SIGNATURE):
        raise ImageValidationError("INVALID_IMAGE_CONTENT", "Malformed PNG signature")

    pos = 8
    chunks: list[bytes] = []
    width = 0
    height = 0
    seen_ihdr = False
    seen_idat = False
    seen_iend = False

    # Standard chunks to keep; metadata chunks (tEXt, zTXt, iTXt, eXIf, tIME, etc.) are omitted.
    safe_chunk_types = {b"IHDR", b"PLTE", b"IDAT", b"tRNS", b"sRGB", b"gAMA", b"cHRM", b"IEND"}

    while pos < len(data):
        if pos + 8 > len(data):
            raise ImageValidationError("INVALID_IMAGE_CONTENT", "Truncated PNG chunk header")
        length = struct.unpack(">I", data[pos : pos + 4])[0]
        chunk_type = data[pos + 4 : pos + 8]
        pos += 8
        if pos + length + 4 > len(data):
            raise ImageValidationError("INVALID_IMAGE_CONTENT", "Truncated PNG chunk data")
        chunk_data = data[pos : pos + length]
        crc_bytes = data[pos + length : pos + length + 4]
        pos += length + 4

        expected_crc = zlib.crc32(chunk_type + chunk_data) & 0xFFFFFFFF
        actual_crc = struct.unpack(">I", crc_bytes)[0]
        if expected_crc != actual_crc:
            raise ImageValidationError("INVALID_IMAGE_CONTENT", "Corrupted PNG chunk CRC")

        if not seen_ihdr:
            if chunk_type != b"IHDR" or length != 13:
                raise ImageValidationError("INVALID_IMAGE_CONTENT", "PNG must start with valid IHDR chunk")
            width, height = struct.unpack(">II", chunk_data[0:8])
            if width <= 0 or height <= 0:
                raise ImageValidationError("INVALID_IMAGE_CONTENT", "Invalid PNG dimensions")
            if width * height > MAX_IMAGE_PIXELS:
                raise ImageValidationError(
                    "IMAGE_DIMENSIONS_EXCEEDED", f"Image dimensions {width}x{height} exceed 20 megapixel limit"
                )
            seen_ihdr = True
            chunks.append(struct.pack(">I", length) + chunk_type + chunk_data + crc_bytes)
        elif chunk_type == b"IHDR":
            raise ImageValidationError("INVALID_IMAGE_CONTENT", "Duplicate IHDR chunk in PNG")
        elif chunk_type == b"IEND":
            seen_iend = True
            chunks.append(struct.pack(">I", length) + chunk_type + chunk_data + crc_bytes)
            break
        elif chunk_type in safe_chunk_types:
            if chunk_type == b"IDAT":
                seen_idat = True
            chunks.append(struct.pack(">I", length) + chunk_type + chunk_data + crc_bytes)

    if not seen_ihdr or not seen_idat or not seen_iend:
        raise ImageValidationError("INVALID_IMAGE_CONTENT", "PNG missing critical IHDR, IDAT, or IEND chunks")

    # Verify actual decoded image data
    idat_payload = b"".join(
        c[8:-4] for c in chunks if c[4:8] == b"IDAT"
    )
    try:
        decompressed = zlib.decompress(idat_payload)
        if len(decompressed) == 0:
            raise ImageValidationError("INVALID_IMAGE_CONTENT", "PNG raster data is empty")
    except zlib.error as err:
        raise ImageValidationError("INVALID_IMAGE_CONTENT", f"Corrupted PNG raster data: {err}") from err

    sanitized = PNG_SIGNATURE + b"".join(chunks)
    return sanitized, width, height


def _sanitize_jpeg(data: bytes) -> tuple[bytes, int, int]:
    if len(data) < 4 or not data.startswith(JPEG_SOI):
        raise ImageValidationError("INVALID_IMAGE_CONTENT", "Malformed JPEG SOI marker")

    pos = 2
    out_parts: list[bytes] = [JPEG_SOI]
    width = 0
    height = 0
    seen_sof = False
    seen_sos = False

    while pos < len(data):
        if data[pos] != 0xFF:
            raise ImageValidationError("INVALID_IMAGE_CONTENT", "Expected JPEG marker at offset")

        while pos < len(data) and data[pos] == 0xFF:
            pos += 1
        if pos >= len(data):
            break

        marker = data[pos]
        pos += 1

        # Standalone markers without length: RST0-RST7 (0xd0-0xd7), SOI (0xd8), TEM (0x01)
        if 0xD0 <= marker <= 0xD7 or marker == 0x01:
            out_parts.append(bytes([0xFF, marker]))
            continue
        if marker == 0xD9:  # EOI
            out_parts.append(bytes([0xFF, 0xD9]))
            break

        if pos + 2 > len(data):
            raise ImageValidationError("INVALID_IMAGE_CONTENT", "Truncated JPEG marker length")
        seg_len = struct.unpack(">H", data[pos : pos + 2])[0]
        if seg_len < 2 or pos + seg_len > len(data):
            raise ImageValidationError("INVALID_IMAGE_CONTENT", "Invalid JPEG segment length")
        seg_data = data[pos + 2 : pos + seg_len]
        pos += seg_len

        # Markers to strip:
        # APP1 (0xe1) - EXIF/XMP
        # APP2 - APP15 (0xe2 - 0xef) - metadata, ICC, IPTC, etc.
        # COM (0xfe) - Comments
        # Keep APP0 (0xe0 - JFIF) if present.
        if (0xE1 <= marker <= 0xEF) or marker == 0xFE:
            continue

        # SOF0, SOF1, SOF2 (0xc0, 0xc1, 0xc2) contain image height and width
        if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
            if len(seg_data) < 5:
                raise ImageValidationError("INVALID_IMAGE_CONTENT", "Truncated SOF segment")
            height, width = struct.unpack(">HH", seg_data[1:5])
            if width <= 0 or height <= 0:
                raise ImageValidationError("INVALID_IMAGE_CONTENT", "Invalid JPEG dimensions")
            if width * height > MAX_IMAGE_PIXELS:
                raise ImageValidationError(
                    "IMAGE_DIMENSIONS_EXCEEDED", f"Image dimensions {width}x{height} exceed 20 megapixel limit"
                )
            seen_sof = True

        out_parts.append(bytes([0xFF, marker]) + struct.pack(">H", seg_len) + seg_data)

        if marker == 0xDA:  # SOS (Start of Scan) - followed by entropy coded scan data until EOI
            seen_sos = True
            # Read until next 0xFF marker (excluding 0xFF00 byte stuffing)
            scan_start = pos
            while pos < len(data) - 1:
                if data[pos] == 0xFF:
                    next_byte = data[pos + 1]
                    if next_byte == 0x00:  # byte stuffing
                        pos += 2
                        continue
                    if 0xD0 <= next_byte <= 0xD7:  # RST marker in entropy data
                        pos += 2
                        continue
                    # Encountered non-stuffed marker
                    break
                pos += 1
            scan_data = data[scan_start:pos]
            out_parts.append(scan_data)

    if not seen_sof or not seen_sos:
        raise ImageValidationError("INVALID_IMAGE_CONTENT", "JPEG missing SOF or SOS segment")

    sanitized = b"".join(out_parts)
    if not sanitized.endswith(JPEG_EOI):
        sanitized += JPEG_EOI
    return sanitized, width, height


def validate_and_sanitize_image(data: bytes, hint_media_type: str | None = None) -> tuple[bytes, ImageMetadata]:
    if not data:
        raise ImageValidationError("INVALID_IMAGE_CONTENT", "Image payload is empty")
    if len(data) > MAX_IMAGE_BYTES:
        raise ImageValidationError("IMAGE_SIZE_EXCEEDED", f"Image exceeds maximum limit of 5 MiB ({len(data)} bytes)")

    if data.startswith(PNG_SIGNATURE):
        sanitized, width, height = _sanitize_png(data)
        media_type = "image/png"
    elif data.startswith(JPEG_SOI):
        sanitized, width, height = _sanitize_jpeg(data)
        media_type = "image/jpeg"
    else:
        raise ImageValidationError(
            "INVALID_IMAGE_CONTENT", "Unsupported or invalid image format; only JPEG and PNG are accepted"
        )

    digest = hashlib.sha256(sanitized).hexdigest()
    meta = ImageMetadata(
        media_type=media_type,
        width=width,
        height=height,
        byte_size=len(sanitized),
        sha256_digest=digest,
    )
    return sanitized, meta
