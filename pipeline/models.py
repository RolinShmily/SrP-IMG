"""Value objects shared by the scan / pool / manifest stages."""
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional


@dataclass
class CategoryInput:
    """One source category directory, already filtered and sorted."""

    key: str
    images: List[Path]


@dataclass
class CategoryResult:
    name: str
    slots: int
    real_count: int
    ext: str
    label: str
    description: str
    name_zh: str = ""
    name_en: str = ""
    aspect: Optional[str] = None
    aspect_hint: str = "自适应"
    # One width/height ratio per generated slot, so the gallery can reserve the
    # exact box before the image loads (no masonry reflow / flicker).
    slot_ratios: List[float] = field(default_factory=list)
    # One single-letter format code per slot ('j'/'p'/'g'/'w'/'?', see
    # ``formats.FORMAT_CODES``), in the exact order the slots were written. The
    # Worker uses it to answer with the MIME type of the real bytes instead of
    # the one implied by the slot suffix.
    slot_formats: List[str] = field(default_factory=list)

