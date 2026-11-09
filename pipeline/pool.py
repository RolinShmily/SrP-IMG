"""Materialisation stage: turn one category's sources into hashed slots.

Everything here is observable: the slot count, the file names, whether bytes are
copied or replaced by placeholders, the per-slot aspect ratios and the aspect
label all end up in ``counts.json`` or in ``assets/generated/<category>/``.
"""
from itertools import cycle
from pathlib import Path
import shutil
from typing import Dict, List, Optional, Tuple

from .catalog import Catalog, CategorySpec, load_catalog
from .config import Config
from .formats import FormatReport, build_format_report, format_code
from .image_size import detect_aspect_ratio, get_image_size
from .models import CategoryInput, CategoryResult
from .placeholders import TINY_GIF, TINY_JPEG, TINY_PNG
from .scan import filter_valid_images, load_category_meta, scan_categories

DEFAULT_SLOT_RATIO = 4 / 3


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def clear_dir_files(path: Path) -> None:
    """Delete direct child files only; nested directories and their contents stay."""
    if not path.exists():
        return
    for item in path.iterdir():
        if item.is_file():
            try:
                item.unlink()
            except Exception:
                pass


def resolve_category_extension(
    config: Config,
    spec: CategorySpec,
    valid_images: List[Path],
) -> str:
    policy = spec.ext_policy
    if policy == "default":
        return config.default_ext
    if policy == "source":
        if valid_images:
            return valid_images[0].suffix.lower()
        return config.default_ext
    return policy


def _write_slot(dst: Path, src: Path, ext: str, no_copy: bool) -> None:
    if not no_copy:
        shutil.copy2(src, dst)
        return
    try:
        ext_lower = ext.lower()
        if ext_lower in ('.jpg', '.jpeg'):
            dst.write_bytes(TINY_JPEG)
        elif ext_lower == '.gif':
            dst.write_bytes(TINY_GIF)
        elif ext_lower == '.png':
            dst.write_bytes(TINY_PNG)
        else:
            dst.write_bytes(TINY_JPEG)
    except Exception:
        pass


def materialize_category(
    config: Config,
    item: CategoryInput,
    spec: CategorySpec,
    *,
    get_size=get_image_size,
) -> CategoryResult:
    valid_images = filter_valid_images(item.key, item.images, config.size_limit_mb)
    cat_ext = resolve_category_extension(config, spec, valid_images)

    out_dir = config.output_dir / item.key
    ensure_dir(out_dir)
    clear_dir_files(out_dir)

    if not valid_images:
        print(f"  [{item.key}] no valid source images (<={config.size_limit_mb}MB), skipping")
        return CategoryResult(
            name=item.key,
            slots=0,
            real_count=0,
            ext=cat_ext,
            label=spec.label,
            description=spec.description,
            name_zh=spec.name_zh,
            name_en=spec.name_en,
            aspect=None,
            aspect_hint="暂无素材",
            slot_ratios=[],
            slot_formats=[],
        )

    # Auto-detect aspect ratio from the first valid image.
    width, height = get_size(valid_images[0])
    aspect, aspect_hint = detect_aspect_ratio(width, height, cat_ext)

    cat_meta = load_category_meta(config, item.key)
    name_zh = cat_meta.get('name_zh') or spec.name_zh
    name_en = cat_meta.get('name_en') or spec.name_en
    if 'aspect' in cat_meta:
        aspect = cat_meta['aspect']
    if 'aspect_hint' in cat_meta:
        aspect_hint = cat_meta['aspect_hint']

    num_slots = config.num_slots
    print(f"  [{item.key}] {len(valid_images)} valid source images -> generating {num_slots} files")
    format_report = build_format_report(item.key, cat_ext, valid_images)
    if not format_report.ok:
        print(format_report.warning(copied=not config.no_copy))

    # Dimensions are read once per source file; the slot loop only repeats them.
    # The format code is cached the same way and appended in slot order, so
    # ``slot_formats[i]`` always describes the bytes of slot ``i``.
    size_cache: Dict[Path, Tuple[Optional[int], Optional[int]]] = {}
    code_cache: Dict[Path, str] = {}
    slot_ratios: List[float] = []
    slot_formats: List[str] = []
    src_cycle = cycle(valid_images)
    for i in range(num_slots):
        src = next(src_cycle)
        if src not in size_cache:
            size_cache[src] = get_size(src)
            code_cache[src] = format_code(src)
        src_w, src_h = size_cache[src]
        slot_formats.append(code_cache[src])
        if src_w and src_h:
            slot_ratios.append(round(src_w / src_h, 4))
        else:
            # Unknown dimensions fall back to the detected category ratio.
            slot_ratios.append(DEFAULT_SLOT_RATIO)
        filename = f"{i:0{config.hash_length}x}{cat_ext}"
        _write_slot(out_dir / filename, src, cat_ext, config.no_copy)

    return CategoryResult(
        name=item.key,
        slots=num_slots,
        real_count=len(valid_images),
        ext=cat_ext,
        label=spec.label,
        slot_ratios=slot_ratios,
        description=spec.description,
        name_zh=name_zh,
        name_en=name_en,
        aspect=aspect,
        aspect_hint=aspect_hint,
        slot_formats=slot_formats,
    )


def materialize_all(config: Config, catalog: Optional[Catalog] = None) -> List[CategoryResult]:
    catalog = catalog or load_catalog(config.catalog_path)
    return [
        materialize_category(config, item, catalog.get(item.key))
        for item in scan_categories(config)
    ]


def audit_source_formats(
    config: Config,
    catalog: Optional[Catalog] = None,
) -> List[FormatReport]:
    """Report-only pre-pass: which categories carry bytes that contradict their suffix.

    Deliberately writes nothing — no directory is created and no slot is touched
    — so ``--strict-formats`` can fail before ``materialize_all`` runs. It
    resolves each category's extension exactly like :func:`materialize_category`
    (so ``ext_policy: "source"`` is judged against the same suffix that would be
    deployed) and filters the same way, but stays silent about the size limit.
    """
    catalog = catalog or load_catalog(config.catalog_path)
    reports: List[FormatReport] = []
    for item in scan_categories(config):
        spec = catalog.get(item.key)
        valid_images = filter_valid_images(
            item.key, item.images, config.size_limit_mb, verbose=False
        )
        cat_ext = resolve_category_extension(config, spec, valid_images)
        reports.append(build_format_report(item.key, cat_ext, valid_images))
    return reports
