"""Discovery stage: which categories and source files exist, and which qualify.

Ordering is part of the output contract. Directories and files are sorted with
``sorted()`` applied to :class:`pathlib.Path` objects, which on Windows compares
case-folded name keys — a plain string sort would reorder slots, and therefore
change which generated file each slot holds.
"""
import json
from pathlib import Path
from typing import Dict, List

from .config import Config
from .models import CategoryInput


def filter_valid_images(
    category: str,
    images: List[Path],
    size_limit_mb: float,
    *,
    verbose: bool = True,
) -> List[Path]:
    """Apply single-file size limit circuit breaker.

    ``verbose=False`` is for report-only passes (the format audit that runs
    before materialisation): the ignored-file notice must still be printed
    exactly once, by the pass that actually writes the slots.
    """
    valid: List[Path] = []
    ignored_count = 0
    for img in images:
        size_mb = img.stat().st_size / (1024 * 1024)
        if size_mb <= size_limit_mb:
            valid.append(img)
        else:
            ignored_count += 1

    if ignored_count > 0 and verbose:
        print(f"  [{category}] 忽略了 {ignored_count} 个超过 {size_limit_mb}MB 的文件")
    return valid


def load_category_meta(config: Config, category: str) -> Dict[str, object]:
    """Optional ``assets/original/<category>/meta.json`` overrides.

    A missing or malformed file is ignored silently: metadata is cosmetic and
    must never fail a build. Callers only reach this after the empty-category
    early return, matching the original generator.
    """
    meta_file = config.source_dir / category / "meta.json"
    if not meta_file.exists():
        return {}
    try:
        with open(meta_file, 'r', encoding='utf-8') as f:
            meta = json.load(f)
        return meta if isinstance(meta, dict) else {}
    except Exception:
        return {}


def scan_categories(config: Config) -> List[CategoryInput]:
    if not config.source_dir.exists():
        print(f"Error: source dir {config.source_dir} not found.")
        return []

    subdirs = sorted([d for d in config.source_dir.iterdir() if d.is_dir()])
    if not subdirs:
        print(f"No subdirectories under {config.source_dir}.")
        return []

    categories: List[CategoryInput] = []
    for subdir in subdirs:
        images = sorted([
            f for f in subdir.iterdir()
            if f.is_file() and f.suffix.lower() in config.allowed_extensions
        ])
        categories.append(CategoryInput(key=subdir.name, images=images))
    return categories
