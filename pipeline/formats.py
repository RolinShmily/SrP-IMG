"""Source-byte format probing: makes suffix/byte drift visible at build time.

The pipeline copies source bytes verbatim into a slot name derived from the
category's ``ext_policy`` (``catalog.py``). When the two disagree — a PNG kept
in a ``.jpg`` slot — the file on disk is fine but the suffix lies. Renaming a
slot would change its deployed URL, so the mapping is kept and published
instead: this module records one format code per slot (``pool.py``) and the
Worker rewrites ``Content-Type`` from it at request time. Nothing here renames,
re-encodes or rewrites a file.

Probing is header-only and dependency-free: the magic numbers are the same ones
``image_size.get_image_size`` already keys on, but here only the format matters,
so at most 12 bytes are read per file.
"""
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Optional, Sequence, Union

JPEG = "jpeg"
PNG = "png"
GIF = "gif"
WEBP = "webp"

#: Slot suffix -> the format those bytes are expected to be in. Suffixes absent
#: from this map are not judged: a custom category with ``ext_policy: "source"``
#: may legitimately follow an exotic source suffix after the first image, and a
#: guard that warns forever about it would be noise.
EXTENSION_FORMATS: Dict[str, str] = {
    ".jpg": JPEG,
    ".jpeg": JPEG,
    ".png": PNG,
    ".gif": GIF,
    ".webp": WEBP,
}

#: Single-character slot code per recognised format. The Worker maps these
#: back to MIME types, so the table is part of the generated data contract.
FORMAT_CODES: Dict[str, str] = {JPEG: "j", PNG: "p", GIF: "g", WEBP: "w"}

#: Slot code for a file whose header is not recognised. The Worker leaves the
#: response header alone in that case (no evidence, no rewrite).
UNKNOWN_FORMAT_CODE = "?"

#: Enough for every signature below, including ``RIFF``+size+``WEBP``.
_HEAD_BYTES = 12


def detect_format(path: Union[str, Path]) -> Optional[str]:
    """Return the real container format of ``path`` by reading its header.

    ``None`` means "not recognised" (unknown magic, empty file, unreadable
    path), which callers must treat as "no evidence" rather than as a mismatch.
    """
    try:
        with open(path, "rb") as f:
            head = f.read(_HEAD_BYTES)
    except OSError:
        return None

    if head.startswith(b"\xff\xd8"):
        return JPEG
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return PNG
    if head[:6] in (b"GIF87a", b"GIF89a"):
        return GIF
    if head.startswith(b"RIFF") and head[8:12] == b"WEBP":
        return WEBP
    return None


def format_code(path: Union[str, Path]) -> str:
    """Single-character slot code for ``path``'s bytes.

    ``?`` means "not recognised" and is deliberately not the same as a
    mismatch: the caller must not rewrite anything without evidence.
    """
    return FORMAT_CODES.get(detect_format(path), UNKNOWN_FORMAT_CODE)


def expected_format(ext: str) -> Optional[str]:
    """Format implied by a slot suffix, or ``None`` when the suffix is unjudged."""
    return EXTENSION_FORMATS.get((ext or "").lower())


@dataclass(frozen=True)
class FormatReport:
    """Per-category answer to "do the source bytes match the slot suffix?"."""

    category: str
    ext: str
    total: int
    mismatched: int
    #: Real format -> number of valid sources with it (mismatching ones only).
    formats: Dict[str, int] = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return self.mismatched == 0

    def warning(self, *, copied: bool = True) -> str:
        """One line naming the category, the counts and the target suffix."""
        names = "/".join(sorted(self.formats))
        if copied:
            detail = (
                "Worker 会按真实字节覆写 Content-Type；仅在绕过 Worker "
                "直接读静态资产时才会错"
            )
        else:
            detail = "Content-Type 由后缀决定；--no-copy 下槽位是占位图"
        return (
            f"  [{self.category}] {self.mismatched}/{self.total} 个有效源文件的真实字节是 "
            f"{names}，但槽位后缀为 {self.ext}（{detail}）"
        )


def build_format_report(
    category: str,
    ext: str,
    images: Sequence[Path],
) -> FormatReport:
    """Probe ``images`` (valid sources only) against the ``ext`` they land in."""
    expected = expected_format(ext)
    counts: Dict[str, int] = {}
    mismatched = 0
    if expected is not None:
        for image in images:
            actual = detect_format(image)
            if actual is not None and actual != expected:
                mismatched += 1
                counts[actual] = counts.get(actual, 0) + 1
    return FormatReport(
        category=category,
        ext=ext,
        total=len(images),
        mismatched=mismatched,
        formats=counts,
    )
