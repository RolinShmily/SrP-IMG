"""Pure-stdlib image header sniffing and aspect-ratio normalisation.

Extracted verbatim from the original ``gen_img.py`` so that generated artifacts
stay byte-identical. The pipeline never decodes pixels: it only reads the
dimensions already present in the file header (JPEG / PNG / GIF / WebP).
"""
import struct
from pathlib import Path
from typing import Optional, Tuple


def get_image_size(file_path: Path) -> Tuple[Optional[int], Optional[int]]:
    """Pure-Python image dimension detection (no PIL dependency)."""
    try:
        with open(file_path, "rb") as f:
            head = f.read(32)
            if head.startswith(b"\x89PNG\r\n\x1a\n"):
                w, h = struct.unpack(">II", head[16:24])
                return w, h
            elif head[:6] in (b"GIF87a", b"GIF89a"):
                w, h = struct.unpack("<HH", head[6:10])
                return w, h
            elif head.startswith(b"RIFF") and head[8:12] == b"WEBP":
                if head[12:16] == b"VP8 ":
                    f.seek(26)
                    w, h = struct.unpack("<HH", f.read(4))
                    return w & 0x3FFF, h & 0x3FFF
                elif head[12:16] == b"VP8L":
                    f.seek(21)
                    b = f.read(4)
                    w = 1 + (((b[1] & 0x3F) << 8) | b[0])
                    h = 1 + (((b[3] & 0x0F) << 10) | (b[2] << 2) | ((b[1] & 0xC0) >> 6))
                    return w, h
                elif head[12:16] == b"VP8X":
                    f.seek(24)
                    w_bytes = f.read(3)
                    h_bytes = f.read(3)
                    w = 1 + struct.unpack("<I", w_bytes + b"\x00")[0]
                    h = 1 + struct.unpack("<I", h_bytes + b"\x00")[0]
                    return w, h
            elif head.startswith(b"\xff\xd8"):
                f.seek(2)
                while True:
                    marker_bytes = f.read(2)
                    if not marker_bytes or len(marker_bytes) < 2 or marker_bytes[0] != 0xFF:
                        break
                    marker = marker_bytes[1]
                    if marker in (0xC0, 0xC1, 0xC2, 0xC3):
                        f.read(3)
                        h, w = struct.unpack(">HH", f.read(4))
                        return w, h
                    elif marker in (0xD9, 0xDA):
                        break
                    else:
                        length_bytes = f.read(2)
                        if len(length_bytes) < 2:
                            break
                        length = struct.unpack(">H", length_bytes)[0]
                        f.seek(length - 2, 1)
    except Exception:
        pass
    return None, None

def detect_aspect_ratio(w: Optional[int], h: Optional[int], ext: str) -> Tuple[Optional[str], str]:
    if ext.lower() == '.gif' or not w or not h:
        return None, "动态格式"
    ratio = w / h
    if 0.92 <= ratio <= 1.08:
        return "1/1", "1:1"
    elif ratio >= 1.55:
        return "16/9", "16:9"
    elif ratio >= 1.15:
        return "4/3", "4:3"
    elif ratio <= 0.65:
        return "9/16", "9:16"
    elif ratio <= 0.88:
        return "3/4", "3:4"
    else:
        return f"{w}/{h}", f"{w}:{h}"
